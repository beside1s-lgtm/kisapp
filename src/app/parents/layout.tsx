'use client';

import { useAuth } from '@/hooks/use-auth';
import { useRouter, usePathname } from 'next/navigation';
import { useEffect } from 'react';
import { Loader2, LogOut, FileText } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { ParentSettingsDialog } from '@/components/parent-settings-dialog';

export default function ParentsLayout({ children }: { children: React.ReactNode }) {
  const { user, loading, profile, profileLoading, logout, isParent } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!loading && !user && pathname !== '/parents/login') {
      router.push('/parents/login');
    } else if (!loading && user && !isParent) {
      router.push('/inbox');
    } else if (!loading && user && isParent && profile) {
      const hasSetup = !!profile.hashedPin && !!profile.parentSignature;
      if (!hasSetup && pathname !== '/parents/setup' && pathname !== '/parents/login') {
        router.push('/parents/setup');
      } else if (hasSetup && pathname === '/parents/setup') {
        router.push('/parents/apply');
      }
    }
  }, [user, loading, isParent, pathname, router, profile]);
  
  const isLoginPage = pathname === '/parents/login';

  if (loading || (!user && !isLoginPage) || (user && profileLoading)) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-12 w-12 animate-spin text-primary" />
          <p className="text-muted-foreground font-bold animate-pulse">시스템 로딩 중...</p>
        </div>
      </div>
    );
  }

  const isAuthPage = pathname === '/parents/login' || pathname === '/parents/setup';

  return (
    <div className="min-h-screen bg-background text-foreground font-body flex flex-col">
      {/* Header */}
      {!isAuthPage && (
        <>
      <header className="sticky top-0 z-50 flex h-16 items-center justify-between border-b bg-card px-4 md:px-8 print:hidden">
        <div className="flex items-center gap-6">
          <Link href="/parents" className="flex items-center gap-2 font-headline text-lg font-bold tracking-tight text-foreground hover:text-primary transition-colors">
            <div className="bg-primary p-1.5 rounded-md text-primary-foreground">
              <FileText size={18} />
            </div>
            KISAPP 학부모 서비스
          </Link>
          <nav className="hidden md:flex items-center gap-2">
            <Button 
              variant={pathname === '/parents/apply' ? 'default' : 'ghost'} 
              asChild
            >
              <Link href="/parents/apply">신청서 제출</Link>
            </Button>
            <Button 
              variant={pathname === '/parents/history' ? 'default' : 'ghost'} 
              asChild
            >
              <Link href="/parents/history">제출 내역</Link>
            </Button>
          </nav>
        </div>
        
        <div className="flex items-center gap-2 md:gap-4">
          <ParentSettingsDialog />
          <Button variant="ghost" size="sm" onClick={logout} className="text-muted-foreground hover:text-foreground">
            <LogOut className="mr-2 h-4 w-4" />
            <span className="hidden sm:inline">로그아웃</span>
          </Button>
        </div>
      </header>
      
      {/* Mobile nav */}
      <div className="md:hidden flex items-center justify-around border-b bg-muted/30 p-2 print:hidden">
        <Button 
          variant={pathname === '/parents/apply' ? 'default' : 'ghost'} 
          size="sm"
          className="flex-1"
          asChild
        >
          <Link href="/parents/apply">신청서 제출</Link>
        </Button>
        <Button 
          variant={pathname === '/parents/history' ? 'default' : 'ghost'} 
          size="sm"
          className="flex-1"
          asChild
        >
          <Link href="/parents/history">제출 내역</Link>
        </Button>
      </div>

      <main className="flex-1 p-4 md:p-8 overflow-y-auto print:p-0 print:m-0 print:block">
        {children}
      </main>
      </>
      )}
      {isAuthPage && (
        <main className="flex-1 w-full h-full">
            {children}
        </main>
      )}
    </div>
  );
}
