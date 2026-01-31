'use client';

import { ReactNode } from 'react';
import ReactMarkdown from 'react-markdown';
import { ChatMessage, MessageRole, FlowType } from '@/types';

interface MessageBubbleProps {
  message: ChatMessage;
}

interface MarkdownComponentProps {
  children?: ReactNode;
}

const flowTypeLabels: Record<FlowType, string> = {
  [FlowType.TICKET_VERIFICATION]: 'Verificación de Ticket',
  [FlowType.KYC_DOCUMENT]: 'Documento KYC',
  [FlowType.KYC_SELFIE]: 'Selfie KYC',
  [FlowType.GENERAL_QUERY]: 'Consulta General',
};

export function MessageBubble({ message }: MessageBubbleProps) {
  const isUser = message.role === MessageRole.USER;
  const isSystem = message.role === MessageRole.SYSTEM;

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString('es-ES', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (isSystem) {
    return (
      <div className="flex justify-center my-2">
        <div className="bg-gray-200 text-gray-600 text-sm px-4 py-2 rounded-full">
          {message.content.text}
        </div>
      </div>
    );
  }

  return (
    <div
      className={`flex ${isUser ? 'justify-end' : 'justify-start'} mb-4`}
    >
      <div
        className={`max-w-[75%] ${
          isUser
            ? 'bg-sorti-primary text-white rounded-l-2xl rounded-tr-2xl'
            : 'bg-white text-gray-800 rounded-r-2xl rounded-tl-2xl shadow-md'
        } px-4 py-3`}
      >
        {/* Flow type badge for assistant messages */}
        {!isUser && message.flowType && (
          <div className="mb-2">
            <span className="text-xs bg-sorti-accent/20 text-sorti-accent px-2 py-0.5 rounded-full">
              {flowTypeLabels[message.flowType]}
            </span>
          </div>
        )}

        {/* Images */}
        {message.content.images && message.content.images.length > 0 && (
          <div className="mb-2 flex flex-wrap gap-2">
            {message.content.images.map((img, idx) => {
              // Construir la URL de la imagen
              let imgSrc = '';
              if (img.url) {
                imgSrc = img.url;
              } else if (img.base64) {
                const mimeType = img.mimeType || 'image/jpeg';
                imgSrc = `data:${mimeType};base64,${img.base64}`;
              }

              if (!imgSrc) return null;

              return (
                <div
                  key={idx}
                  className="relative w-40 h-40 rounded-lg overflow-hidden border border-gray-200"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={imgSrc}
                    alt={img.filename || `Imagen ${idx + 1}`}
                    className="w-full h-full object-cover cursor-pointer hover:opacity-90 transition-opacity"
                    onClick={() => window.open(imgSrc, '_blank')}
                  />
                </div>
              );
            })}
          </div>
        )}

        {/* Text content */}
        {message.content.text && (
          <div className={`${isUser ? '' : 'prose prose-sm max-w-none'}`}>
            {isUser ? (
              <p className="whitespace-pre-wrap break-words m-0">
                {message.content.text}
              </p>
            ) : (
              <ReactMarkdown
                components={{
                  p: ({ children }: MarkdownComponentProps) => (
                    <p className="mb-2 last:mb-0 whitespace-pre-wrap">{children}</p>
                  ),
                  strong: ({ children }: MarkdownComponentProps) => (
                    <strong className="font-bold">{children}</strong>
                  ),
                  ul: ({ children }: MarkdownComponentProps) => (
                    <ul className="list-disc pl-4 mb-2">{children}</ul>
                  ),
                  ol: ({ children }: MarkdownComponentProps) => (
                    <ol className="list-decimal pl-4 mb-2">{children}</ol>
                  ),
                  li: ({ children }: MarkdownComponentProps) => (
                    <li className="mb-1">{children}</li>
                  ),
                  h1: ({ children }: MarkdownComponentProps) => (
                    <h1 className="text-lg font-bold mb-2">{children}</h1>
                  ),
                  h2: ({ children }: MarkdownComponentProps) => (
                    <h2 className="text-base font-bold mb-2">{children}</h2>
                  ),
                  h3: ({ children }: MarkdownComponentProps) => (
                    <h3 className="text-sm font-bold mb-1">{children}</h3>
                  ),
                }}
              >
                {message.content.text}
              </ReactMarkdown>
            )}
          </div>
        )}

        {/* Timestamp */}
        <div
          className={`text-xs mt-2 ${
            isUser ? 'text-gray-300' : 'text-gray-400'
          }`}
        >
          {formatTime(message.createdAt)}
        </div>
      </div>
    </div>
  );
}
