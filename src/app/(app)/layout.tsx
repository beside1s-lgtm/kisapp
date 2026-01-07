'use client';

import { useAuth } from '@/hooks/use-auth';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { Loader2 } from 'lucide-react';
import AppHeader from '@/components/layout/header';
import AppSidebar from '@/components/layout/sidebar';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, loading, profile, profileLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
    }
  }, [user, loading, router]);
  
  if (loading || !user || profileLoading) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-12 w-12 animate-spin text-primary" />
          <p className="text-muted-foreground font-bold animate-pulse">Loading System...</p>
        </div>
      </div>
    );
  }

  // If profile doesn't exist or is incomplete, the modals in AuthProvider/Header will handle it.
  
  return (
    <div className="min-h-screen bg-background text-foreground font-body">
        <AppHeader />
        <div className="flex">
            <AppSidebar />
            <main className="flex-1 p-4 md:p-8 overflow-auto h-[calc(100vh-65px)]">
                {children}
            </main>
        </div>
    </div>
  );
}
