'use client';

import { ChatMessage, MessageRole, ContentType, FlowType } from '@/types';

interface MessageBubbleProps {
  message: ChatMessage;
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
        {message.content.type !== ContentType.TEXT &&
          message.content.images &&
          message.content.images.length > 0 && (
            <div className="mb-2 flex flex-wrap gap-2">
              {message.content.images.map((img, idx) => (
                <div
                  key={idx}
                  className="relative w-32 h-32 rounded-lg overflow-hidden"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={img.url || `data:${img.mimeType || 'image/jpeg'};base64,${img.base64}`}
                    alt={img.filename || `Imagen ${idx + 1}`}
                    className="w-full h-full object-cover"
                  />
                </div>
              ))}
            </div>
          )}

        {/* Text content */}
        {message.content.text && (
          <p className="whitespace-pre-wrap break-words">
            {message.content.text}
          </p>
        )}

        {/* Timestamp */}
        <div
          className={`text-xs mt-1 ${
            isUser ? 'text-gray-300' : 'text-gray-400'
          }`}
        >
          {formatTime(message.createdAt)}
        </div>
      </div>
    </div>
  );
}
