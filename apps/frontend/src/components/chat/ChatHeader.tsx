'use client';

import { ChatSession } from '@/types';

interface ChatHeaderProps {
  session: ChatSession | null;
  isConnected: boolean;
}

export function ChatHeader({ session, isConnected }: ChatHeaderProps) {
  return (
    <header className="bg-sorti-primary text-white px-4 py-3 flex items-center justify-between shadow-md">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-full bg-sorti-accent flex items-center justify-center">
          <svg
            className="w-6 h-6"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"
            />
          </svg>
        </div>
        <div>
          <h1 className="font-semibold text-lg">Sorti365 Asistente</h1>
          <p className="text-xs text-gray-300">
            {session ? 'Chat activo' : 'Sin sesión'}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <span
          className={`w-2 h-2 rounded-full ${
            isConnected ? 'bg-green-400' : 'bg-red-400'
          }`}
        />
        <span className="text-sm text-gray-300">
          {isConnected ? 'Conectado' : 'Desconectado'}
        </span>
      </div>
    </header>
  );
}
