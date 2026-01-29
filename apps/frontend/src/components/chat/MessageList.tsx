'use client';

import { useEffect, useRef } from 'react';
import { ChatMessage, ProcessingStatus } from '@/types';
import { MessageBubble } from './MessageBubble';
import { TypingIndicator } from './TypingIndicator';

interface MessageListProps {
  messages: ChatMessage[];
  isTyping: boolean;
  processingStatus: ProcessingStatus | null;
}

export function MessageList({ messages, isTyping, processingStatus }: MessageListProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isTyping, processingStatus]);

  return (
    <div className="flex-1 overflow-y-auto p-4 space-y-2 bg-gray-100">
      {messages.length === 0 && !isTyping && (
        <div className="flex flex-col items-center justify-center h-full text-gray-500">
          <svg
            className="w-16 h-16 mb-4 text-gray-300"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
            />
          </svg>
          <p className="text-lg font-medium">Bienvenido a Sorti365</p>
          <p className="text-sm text-center mt-2">
            Envía un mensaje o una imagen para comenzar.<br />
            Puedo ayudarte con verificación de tickets y procesos KYC.
          </p>
        </div>
      )}

      {messages.map((message) => (
        <MessageBubble key={message.id} message={message} />
      ))}

      <TypingIndicator isTyping={isTyping} processingStatus={processingStatus} />

      <div ref={messagesEndRef} />
    </div>
  );
}
