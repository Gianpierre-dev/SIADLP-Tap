'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/lib/auth';

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { isAuthenticated, hydrate } = useAuthStore();
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    hydrate();
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIsReady(true);
  }, [hydrate]);

  useEffect(() => {
    if (isReady && !isAuthenticated) {
      router.replace('/login');
    }
  }, [isReady, isAuthenticated, router]);

  if (!isReady || !isAuthenticated) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  return <>{children}</>;
}
