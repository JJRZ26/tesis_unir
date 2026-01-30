'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import {
  ChatMessage,
  ChatSession,
  SendMessagePayload,
  ProcessingStatus,
  ContentType,
  ChatError,
  StatusUpdate,
} from '@/types';

interface UseChatOptions {
  playerId?: string;
  onError?: (error: ChatError) => void;
}

interface UseChatReturn {
  session: ChatSession | null;
  messages: ChatMessage[];
  isConnected: boolean;
  isLoading: boolean;
  isTyping: boolean;
  processingStatus: ProcessingStatus | null;
  error: ChatError | null;
  createSession: (playerId?: string) => Promise<ChatSession | null>;
  sendMessage: (text: string, images?: File[]) => Promise<void>;
  clearError: () => void;
}

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
const WS_URL = process.env.NEXT_PUBLIC_WS_URL || 'http://localhost:3001';

export function useChat(options: UseChatOptions = {}): UseChatReturn {
  const { playerId, onError } = options;

  const [session, setSession] = useState<ChatSession | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [processingStatus, setProcessingStatus] = useState<ProcessingStatus | null>(null);
  const [error, setError] = useState<ChatError | null>(null);

  const socketRef = useRef<Socket | null>(null);
  const sessionIdRef = useRef<string | null>(null);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  const handleError = useCallback((err: ChatError) => {
    setError(err);
    onError?.(err);
  }, [onError]);

  // Initialize socket connection
  useEffect(() => {
    socketRef.current = io(`${WS_URL}/chat`, {
      transports: ['websocket', 'polling'],
      autoConnect: true,
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    });

    socketRef.current.on('connect', () => {
      console.log('Chat socket connected');
      setIsConnected(true);

      // Rejoin session if we had one
      if (sessionIdRef.current) {
        socketRef.current?.emit('chat:join', { sessionId: sessionIdRef.current });
      }
    });

    socketRef.current.on('disconnect', () => {
      console.log('Chat socket disconnected');
      setIsConnected(false);
    });

    socketRef.current.on('connect_error', (err) => {
      console.error('Chat socket error:', err);
      handleError({ message: 'Error de conexión con el servidor' });
    });

    // Chat events
    socketRef.current.on('chat:message', (message: ChatMessage) => {
      console.log('Received message:', message);
      setMessages((prev) => {
        // Avoid duplicates - compare as strings in case of ObjectId
        const messageId = String(message.id);
        if (prev.some((m) => String(m.id) === messageId)) {
          console.log('Duplicate message, ignoring:', messageId);
          return prev;
        }
        console.log('Adding message to list:', messageId);
        return [...prev, message];
      });
      setIsTyping(false);
      setProcessingStatus(null);
    });

    socketRef.current.on('chat:typing', () => {
      setIsTyping(true);
    });

    socketRef.current.on('chat:status', (status: StatusUpdate) => {
      setProcessingStatus({
        step: status.step,
        message: status.message,
        progress: status.progress,
      });
    });

    socketRef.current.on('chat:error', (err: ChatError) => {
      handleError(err);
      setIsLoading(false);
      setIsTyping(false);
    });

    socketRef.current.on('chat:joined', (data: { sessionId: string }) => {
      console.log('Joined session:', data.sessionId);
    });

    return () => {
      socketRef.current?.disconnect();
      socketRef.current = null;
    };
  }, [handleError]);

  // Create a new chat session
  const createSession = useCallback(async (sessionPlayerId?: string): Promise<ChatSession | null> => {
    try {
      setIsLoading(true);
      clearError();

      const response = await fetch(`${API_URL}/api/chat/sessions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          playerId: sessionPlayerId || playerId,
        }),
      });

      if (!response.ok) {
        throw new Error('Error al crear la sesión');
      }

      const newSession: ChatSession = await response.json();
      setSession(newSession);
      sessionIdRef.current = newSession.id;

      // Join the socket room
      if (socketRef.current?.connected) {
        socketRef.current.emit('chat:join', { sessionId: newSession.id });
      }

      // Load existing messages if any
      const messagesResponse = await fetch(
        `${API_URL}/api/chat/sessions/${newSession.id}/messages`
      );

      if (messagesResponse.ok) {
        const existingMessages: ChatMessage[] = await messagesResponse.json();
        setMessages(existingMessages);
      }

      return newSession;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Error desconocido';
      handleError({ message: errorMessage });
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [playerId, clearError, handleError]);

  // Convert file to base64
  const fileToBase64 = useCallback((file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => {
        const result = reader.result as string;
        // Remove data URL prefix (e.g., "data:image/png;base64,")
        const base64 = result.split(',')[1];
        resolve(base64);
      };
      reader.onerror = (error) => reject(error);
    });
  }, []);

  // Send a message
  const sendMessage = useCallback(async (text: string, images?: File[]): Promise<void> => {
    if (!session || !socketRef.current?.connected) {
      handleError({ message: 'No hay sesión activa o conexión' });
      return;
    }

    if (!text.trim() && (!images || images.length === 0)) {
      return;
    }

    try {
      setIsLoading(true);
      clearError();

      // Process images if any
      let imagePayloads: Array<{ base64: string }> | undefined;
      if (images && images.length > 0) {
        imagePayloads = await Promise.all(
          images.map(async (file) => ({
            base64: await fileToBase64(file),
          }))
        );
      }

      const payload: SendMessagePayload = {
        sessionId: session.id,
        playerId: playerId,
        content: {
          type: imagePayloads ? ContentType.MIXED : ContentType.TEXT,
          text: text.trim() || undefined,
        },
        images: imagePayloads,
      };

      socketRef.current.emit('chat:message', payload);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Error al enviar mensaje';
      handleError({ message: errorMessage });
    } finally {
      setIsLoading(false);
    }
  }, [session, playerId, clearError, handleError, fileToBase64]);

  return {
    session,
    messages,
    isConnected,
    isLoading,
    isTyping,
    processingStatus,
    error,
    createSession,
    sendMessage,
    clearError,
  };
}
