
'use client';

import { useAuth } from '@/hooks/use-auth';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { Loader2, Plus, Inbox, Send, FileClock, ListFilter, Undo2 } from 'lucide-react';
import { AppHeader } from '@/components/layout/header';
import AppSidebar from '@/components/layout/sidebar';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';

import { SidebarProvider } from '@/components/layout/sidebar-context';

const MobileNavItem = ({ href, label, icon }: { href: string, label: string, icon: React.ReactNode}) => {
  const pathname = usePathname();
  const isActive = pathname === href;

  return (
    <Link href={href} className={cn(
      "flex flex-col items-center justify-center gap-1 w-full h-full rounded-lg text-xs",
      isActive ? "text-primary font-bold" : "text-muted-foreground"
    )}>
      {icon}
      <span>{label}</span>
    </Link>
  )
}

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
        <div className="print:hidden w-full max-w-full shrink-0 z-50">
          <AppHeader />
        </div>
        <div className="flex-1 min-h-0 flex print:block pt-14 sm:pt-16 print:pt-0 min-w-0 w-full max-w-full overflow-hidden">
          <div className="print:hidden shrink-0 h-full">
            <AppSidebar />
          </div>
          <main className="flex-1 min-w-0 w-full max-w-full h-full pb-20 lg:pb-0 overflow-y-auto print:p-0 print:m-0 print:block flex flex-col justify-between">
            <div className="flex-1 min-w-0">
              {children}
            </div>
            <footer className="border-t py-2 text-center text-xs text-muted-foreground bg-card/30 backdrop-blur-sm no-print print:hidden w-full overflow-x-hidden shrink-0 mt-2">
              <div className="flex flex-col sm:flex-row justify-center items-center gap-1.5 sm:gap-6 px-2">
                <span>© {new Date().getFullYear()} KIS 통합 포털. All rights reserved.</span>
                <Link href="/privacy" className="font-semibold text-primary hover:underline transition-all">
                  개인정보처리방침 (Privacy Policy)
                </Link>
              </div>
            </footer>
          </main>
        </div>

        {/* Mobile Bottom Navigation */}
        <div className="lg:hidden fixed bottom-0 left-0 right-0 h-20 bg-card border-t z-40 grid grid-cols-5 items-center justify-around px-2 print:hidden">
            <MobileNavItem href="/inbox" label="미결재함" icon={<Inbox size={20} />} />
            <MobileNavItem href="/sent" label="상신함" icon={<Send size={20} />} />
            <div className="flex justify-center">
              <Button asChild className="h-16 w-16 rounded-full shadow-lg -mt-8 bg-primary hover:bg-primary/90" size="icon">
                <Link href="/new">
                  <Plus className="h-8 w-8" />
                  <span className="sr-only">새 결재문서 작성</span>
                </Link>
              </Button>
            </div>
            <MobileNavItem href="/recalled" label="회수함" icon={<Undo2 size={20} />} />
            <MobileNavItem href="/registry" label="문서대장" icon={<ListFilter size={20} />} />
        </div>
      </div>
    </SidebarProvider>
  );
}
