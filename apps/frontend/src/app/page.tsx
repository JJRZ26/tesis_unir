'use client';

import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import { ChatContainer } from '@/components';

function ChatPage() {
  const searchParams = useSearchParams();
  const playerId = searchParams.get('playerId') || undefined;

  return <ChatContainer playerId={playerId} />;
}

function LoadingFallback() {
  return (
    <div className="flex items-center justify-center h-screen bg-gray-100">
      <div className="text-center">
        <div className="w-16 h-16 mx-auto mb-4 border-4 border-sorti-primary border-t-transparent rounded-full animate-spin" />
        <p className="text-gray-600">Cargando chat...</p>
      </div>
    </div>
  );
}

export default function Home() {
  return (
    <main className="min-h-screen">
      <Suspense fallback={<LoadingFallback />}>
        <ChatPage />
      </Suspense>
    </main>
  );
}
