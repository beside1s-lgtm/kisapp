
'use client';

import { useAuth } from '@/hooks/use-auth';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { Loader2 } from 'lucide-react';
import { AppHeader } from '@/components/layout/header';
import AppSidebar from '@/components/layout/sidebar';
import { AppFooter } from '@/components/layout/app-footer';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { SidebarProvider } from '@/components/layout/sidebar-context';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, loading, profile, profileLoading, isParent } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!loading && !user) {
      const redirectUrl = pathname && pathname !== '/' ? `/login?redirect=${encodeURIComponent(pathname)}` : '/login';
      router.push(redirectUrl);
    } else if (!loading && user && isParent) {
      if (!pathname.startsWith('/parents')) {
        router.push('/parents');
      }
    }
  }, [user, loading, isParent, router, pathname]);
  
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

  return (
    <SidebarProvider>
      <div className="h-screen max-h-screen overflow-hidden flex flex-col bg-background text-foreground font-body w-full max-w-full">
        <div className="print:hidden w-full max-w-full shrink-0 z-50 hidden sm:block">
          <AppHeader />
        </div>
        <div className="flex-1 min-h-0 flex print:block pt-0 sm:pt-16 print:pt-0 min-w-0 w-full max-w-full overflow-hidden">
          <div className="print:hidden shrink-0 h-full">
            <AppSidebar />
          </div>
          <main className="flex-1 min-w-0 w-full max-w-full h-full pb-20 lg:pb-0 overflow-y-auto print:p-0 print:m-0 print:block flex flex-col justify-between">
            <div className="flex-1 min-w-0">
              {children}
            </div>
            <AppFooter />
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
