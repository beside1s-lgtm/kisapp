'use client';

import { useAuth } from '@/hooks/use-auth';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { Loader2, Plus, Inbox, Send, FileClock, ListFilter } from 'lucide-react';
import { AppHeader } from '@/components/layout/header';
import AppSidebar from '@/components/layout/sidebar';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';

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

  return (
    <div className="min-h-screen bg-background text-foreground font-body">
      <AppHeader />
      <div className="flex">
        <AppSidebar />
        <main className="flex-1 p-4 md:p-8 overflow-auto h-[calc(100vh-65px)] pb-24 md:pb-8">
            {children}
        </main>
      </div>

      {/* Mobile Bottom Navigation */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 h-20 bg-card border-t z-40 flex items-center justify-around px-2">
          <div className="w-1/5"><MobileNavItem href="/inbox" label="미결재함" icon={<Inbox size={20} />} /></div>
          <div className="w-1/5"><MobileNavItem href="/sent" label="상신함" icon={<Send size={20} />} /></div>
          <div className="w-1/5 flex justify-center">
            <Button asChild className="h-16 w-16 rounded-full shadow-lg -mt-8 bg-primary hover:bg-primary/90" size="icon">
              <Link href="/new">
                <Plus className="h-8 w-8" />
                <span className="sr-only">새 결재문서 작성</span>
              </Link>
            </Button>
          </div>
          <div className="w-1/5"><MobileNavItem href="/pending" label="진행함" icon={<FileClock size={20} />} /></div>
          <div className="w-1/5"><MobileNavItem href="/registry" label="문서대장" icon={<ListFilter size={20} />} /></div>
      </div>
    </div>
  );
}
