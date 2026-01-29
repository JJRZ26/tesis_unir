'use client';

import { ProcessingStatus, ProcessingStep } from '@/types';

interface TypingIndicatorProps {
  isTyping: boolean;
  processingStatus: ProcessingStatus | null;
}

const stepMessages: Record<ProcessingStep, string> = {
  [ProcessingStep.ANALYZING_IMAGE]: 'Analizando imagen...',
  [ProcessingStep.EXTRACTING_TEXT]: 'Extrayendo texto...',
  [ProcessingStep.CLASSIFYING_INTENT]: 'Clasificando intención...',
  [ProcessingStep.QUERYING_API]: 'Consultando información...',
  [ProcessingStep.VERIFYING_DOCUMENT]: 'Verificando documento...',
  [ProcessingStep.COMPARING_FACES]: 'Comparando rostros...',
  [ProcessingStep.GENERATING_RESPONSE]: 'Generando respuesta...',
};

export function TypingIndicator({ isTyping, processingStatus }: TypingIndicatorProps) {
  if (!isTyping && !processingStatus) return null;

  const message = processingStatus
    ? processingStatus.message || stepMessages[processingStatus.step]
    : 'Escribiendo...';

  return (
    <div className="flex justify-start mb-4">
      <div className="bg-white text-gray-600 rounded-r-2xl rounded-tl-2xl shadow-md px-4 py-3 max-w-[75%]">
        <div className="flex items-center gap-3">
          {/* Animated dots */}
          <div className="flex gap-1">
            <span className="w-2 h-2 bg-sorti-accent rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
            <span className="w-2 h-2 bg-sorti-accent rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
            <span className="w-2 h-2 bg-sorti-accent rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
          </div>

          <span className="text-sm">{message}</span>
        </div>

        {/* Progress bar */}
        {processingStatus?.progress !== undefined && (
          <div className="mt-2 w-full bg-gray-200 rounded-full h-1.5">
            <div
              className="bg-sorti-accent h-1.5 rounded-full transition-all duration-300"
              style={{ width: `${processingStatus.progress}%` }}
            />
          </div>
        )}
      </div>
    </div>
  );
}
