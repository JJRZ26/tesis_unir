'use client';

import { useEffect } from 'react';
import { useChat } from '@/hooks';
import { ChatHeader } from './ChatHeader';
import { MessageList } from './MessageList';
import { MessageInput } from './MessageInput';
import { ErrorBanner } from './ErrorBanner';

interface ChatContainerProps {
  playerId?: string;
}

export function ChatContainer({ playerId }: ChatContainerProps) {
  const {
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
  } = useChat({ playerId });

  // Create session on mount
  useEffect(() => {
    if (!session && isConnected) {
      createSession(playerId);
    }
  }, [session, isConnected, createSession, playerId]);

  const handleSend = (text: string, images?: File[]) => {
    sendMessage(text, images);
  };

  return (
    <div className="flex flex-col h-screen max-h-screen bg-gray-50">
      <ChatHeader session={session} isConnected={isConnected} />

      <ErrorBanner error={error} onDismiss={clearError} />

      <MessageList
        messages={messages}
        isTyping={isTyping}
        processingStatus={processingStatus}
      />

      <MessageInput
        onSend={handleSend}
        disabled={!session || !isConnected || isLoading}
        placeholder={
          !isConnected
            ? 'Conectando...'
            : !session
            ? 'Iniciando sesión...'
            : 'Escribe un mensaje o adjunta una imagen...'
        }
      />
    </div>
  );
}
