
'use client';

import { useAuth } from '@/hooks/use-auth';
import { useRouter } from 'next/navigation';
import { useEffect, useRef } from 'react';
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
  const appHeaderWrapRef = useRef<HTMLDivElement>(null);
  const appFooterWrapRef = useRef<HTMLDivElement>(null);

  // 데스크톱 상단 AppHeader / 하단 AppFooter의 실제 렌더링 높이를 CSS 변수로 노출.
  // MainLayout(페이지별 h-dvh 레이아웃)이 이 두 값을 빼서 자신의 높이를 계산하는 데 쓴다.
  // (모바일에서는 각 래퍼가 display:none이라 offsetHeight가 0이 되어 자동으로 보정됨)
  useEffect(() => {
    const headerEl = appHeaderWrapRef.current;
    const footerEl = appFooterWrapRef.current;
    if (!headerEl || !footerEl) return;
    const updateHeights = () => {
      document.documentElement.style.setProperty('--app-header-height', `${headerEl.offsetHeight}px`);
      document.documentElement.style.setProperty('--app-footer-height', `${footerEl.offsetHeight}px`);
    };
    updateHeights();
    const observer = new ResizeObserver(updateHeights);
    observer.observe(headerEl);
    observer.observe(footerEl);
    window.addEventListener('resize', updateHeights);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', updateHeights);
      document.documentElement.style.removeProperty('--app-header-height');
      document.documentElement.style.removeProperty('--app-footer-height');
    };
    // 인증 로딩 중에는 이 래퍼들이 아직 DOM에 없으므로(로딩 화면만 렌더),
    // 로딩이 끝나고 실제 레이아웃이 마운트된 뒤에도 다시 시도해야 한다.
  }, [loading, user, profileLoading]);

  useEffect(() => {
    if (!loading && !user) {
      const redirectUrl = pathname && pathname !== '/' ? `/login?redirect=${encodeURIComponent(pathname)}` : '/login';
      router.push(redirectUrl);
    } else if (!loading && user && isParent) {
      if (!pathname.startsWith('/parents')) {
        router.push('/parents');
      }
    } else if (!loading && user && profile?.role === '강사') {
      const isAllowed = 
        pathname.startsWith('/teacher/afterschool') || 
        pathname.startsWith('/teacher/bus') || 
        pathname.startsWith('/attendance/share/');
      if (!isAllowed) {
        router.replace('/teacher/afterschool');
      }
    }
  }, [user, loading, isParent, profile?.role, router, pathname]);
  
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
      <div className="h-screen max-h-screen overflow-hidden flex flex-col bg-background text-foreground font-body w-full max-w-full overscroll-none">
        <div ref={appHeaderWrapRef} className="print:hidden w-full max-w-full shrink-0 z-50 hidden sm:block">
          <AppHeader />
        </div>
        <div className="flex-1 min-h-0 flex print:block print:pt-0 min-w-0 w-full max-w-full overflow-hidden">
          <div className="print:hidden shrink-0 h-full">
            <AppSidebar />
          </div>
          <main className="flex-1 min-w-0 w-full max-w-full h-full print:p-0 print:m-0 print:block flex flex-col justify-between overflow-hidden pb-0 overscroll-none">
            <div className="flex-1 min-w-0 w-full h-full min-h-0 flex flex-col overflow-hidden">
              {children}
            </div>
            {/* 개인정보처리방침 푸터는 넓은 화면(데스크톱)에서만 바닥에 고정 노출되고, 모바일에서는 하단 네비게이션이 대신하므로 숨김 */}
            <div ref={appFooterWrapRef} className="shrink-0 hidden lg:block">
              <AppFooter />
            </div>
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
