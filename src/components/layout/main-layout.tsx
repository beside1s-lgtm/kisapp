
'use client';
import type { FC, ReactNode } from 'react';
import React from 'react';
import Link from 'next/link';
import { Home, LogOut, ArrowLeft, Bus, ShieldAlert, Loader2 } from 'lucide-react';
import { Button } from '../ui/button';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';
import { useToast } from '@/hooks/use-toast';
import { useTranslation } from '@/hooks/use-translation';
import { LanguageSwitcher } from './language-switcher';
import { MobileBottomNav } from './mobile-bottom-nav';
import { cn } from '@/lib/utils';

interface MainLayoutProps {
  children: ReactNode;
  headerContent?: ReactNode;
  titleActions?: ReactNode;
  rightActions?: ReactNode;
  hideTitle?: boolean;
  mobileHeaderRow1?: ReactNode;
  title?: ReactNode;
  contentClassName?: string;
  hideMobileBottomNav?: boolean;
}

export const MainLayout: FC<MainLayoutProps> = ({ 
  children, 
  headerContent, 
  titleActions, 
  rightActions,
  hideTitle = false, 
  mobileHeaderRow1,
  title,
  contentClassName,
  hideMobileBottomNav = false,
}) => {
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout, loading: authLoading } = useAuth();
  const { toast } = useToast();
  const { t } = useTranslation();
  
  const getPageTitle = () => {
    const currentPath = pathname.split('/')[1];
    return t(`page.title.${currentPath || 'home'}`);
  }

  const handleLogout = async () => {
      try {
        await logout();
        toast({ title: t('logout.success'), description: t('logout.success.description') });
      } catch (error) {
        toast({ title: t('logout.error'), description: t('logout.error.description'), variant: 'destructive' });
      }
  }

  if (authLoading) {
    // 공개 페이지(/teacher/bus, /attendance/share/)는 인증 로딩 중에도 스피너 없이 바로 표시
    const isPublicPathForLoading = pathname === '/teacher/bus' || pathname.startsWith('/attendance/share/');
    if (!isPublicPathForLoading) {
      return (
        <div className="flex flex-col justify-center items-center h-screen bg-background gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-xs text-muted-foreground font-semibold">{t('loading.auth') || '인증 정보 확인 중...'}</p>
        </div>
      );
    }
  }

  // 비로그인 사용자 접근 통제 가드:
  // /teacher/bus (스쿨버스 선생님 페이지) 및 /attendance/share/ (외부 강사용 공유 출석부)만
  // 비로그인 접근이 허용되며, 그 외의 모든 MainLayout 페이지는 비로그인 시 접근 불가 화면을 노출하고 로그인을 요구함.
  const isPublicPage = pathname === '/teacher/bus' || pathname.startsWith('/attendance/share/');
  if (!authLoading && !user && !isPublicPage) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-slate-50 p-4 font-sans text-center">
        <div className="bg-white p-8 rounded-2xl shadow-xl border border-slate-200/80 max-w-md w-full flex flex-col items-center">
          <div className="w-16 h-16 bg-rose-100 rounded-2xl flex items-center justify-center mb-4 text-rose-600">
            <ShieldAlert className="w-9 h-9 stroke-[2]" />
          </div>
          <h2 className="text-xl font-bold text-slate-800 mb-2">접근 권한 없음 (Access Denied)</h2>
          <p className="text-xs text-slate-500 leading-relaxed mb-6">
            로그인이 필요한 시스템 기능입니다.<br />
            비로그인 사용자는 해당 페이지에 접근할 수 없습니다.
          </p>
          <div className="flex flex-col gap-2.5 w-full">
            <Button asChild className="w-full h-11 font-bold text-sm bg-primary hover:bg-primary/95 shadow-md">
              <Link href={`/login?redirect=${encodeURIComponent(pathname)}`}>
                로그인 페이지로 이동
              </Link>
            </Button>
            <Button asChild variant="outline" className="w-full h-10 text-xs font-semibold text-slate-600">
              <Link href="/teacher/bus">
                스쿨버스 선생님 페이지로 이동
              </Link>
            </Button>
          </div>
        </div>
      </div>
    );
  }

  const showHomeButton = pathname.startsWith('/admin') || pathname.startsWith('/teacher') || pathname === '/inbox';
  const headerStickyClass = 'sticky top-0 z-30';
  const headerRef = React.useRef<HTMLElement>(null);

  React.useEffect(() => {
    if (!headerRef.current) return;
    const updateHeight = () => {
      if (headerRef.current) {
        const height = headerRef.current.offsetHeight;
        document.documentElement.style.setProperty('--site-header-height', `${height}px`);
      }
    };
    updateHeight();
    const observer = new ResizeObserver(updateHeight);
    observer.observe(headerRef.current);
    window.addEventListener('resize', updateHeight);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', updateHeight);
    };
  }, []);

  return (
    <div className="flex flex-col min-h-screen bg-background w-full max-w-full min-w-0">
       <header ref={headerRef} className={`${headerStickyClass} flex flex-col gap-1 border-b bg-card/95 px-2.5 sm:px-4 md:px-6 py-1.5 sm:py-2 backdrop-blur-md shadow-xs w-full max-w-full`}>
          {/* 모바일 뷰 (sm:hidden): 2줄 레이아웃 */}
          <div className="flex sm:hidden flex-col gap-1.5 w-full min-w-0">
              {/* Row 1: 뒤로가기/홈 + 타이틀 + 언어선택기 */}
              <div className="flex items-center justify-between gap-1.5 w-full min-w-0">
                  <div className="flex items-center gap-1 min-w-0 flex-1">
                      {user ? (
                        <div className="flex items-center gap-1 shrink-0">
                          {pathname !== '/' && (
                            <Button variant="outline" size="icon" className="h-8 w-8 shrink-0" onClick={() => router.back()} title="뒤로가기">
                              <ArrowLeft className="h-4 w-4" />
                              <span className="sr-only">Back</span>
                            </Button>
                          )}
                          {showHomeButton && (
                            <Button asChild variant="outline" size="icon" className="h-8 w-8 shrink-0" title="결재 홈">
                              <Link href="/">
                                <Home className="h-4 w-4" />
                                <span className="sr-only">Home</span>
                              </Link>
                            </Button>
                          )}
                        </div>
                      ) : (
                        <div className="flex items-center gap-1 px-2 py-1 bg-indigo-50/90 text-indigo-700 rounded-lg border border-indigo-200/70 text-xs font-bold shrink-0 shadow-xs">
                          {pathname.startsWith('/attendance/share/') ? (
                            <span className="font-extrabold tracking-tight">KIS 출석부</span>
                          ) : (
                            <>
                              <Bus className="h-4 w-4 text-indigo-600 shrink-0" />
                              <span className="font-extrabold tracking-tight">KIS BUS</span>
                            </>
                          )}
                        </div>
                      )}

                      {!hideTitle && (
                        <div className="min-w-0 flex-1 flex items-center">
                            <div className="text-sm font-bold font-headline text-slate-800 dark:text-slate-100 truncate">
                              {title || getPageTitle()}
                            </div>
                        </div>
                      )}
                  </div>

                  {/* Row 1 우측: rightActions + LanguageSwitcher + 로그아웃 */}
                  <div className="flex items-center gap-1 shrink-0">
                      {rightActions}
                      <LanguageSwitcher />
                      {user && (
                          <Button variant="outline" size="sm" onClick={handleLogout} className="h-8 px-2 text-xs text-rose-600 border-rose-200 hover:bg-rose-50" title={t('logout.button')}>
                            <LogOut className="h-4 w-4" />
                          </Button>
                      )}
                  </div>
              </div>

              {/* Row 2: titleActions 전체 폭 균등/나란히 배치 */}
              {titleActions && (
                  <div className="flex items-center justify-between gap-1 w-full min-w-0 pt-1 border-t border-slate-100/80 dark:border-slate-800/80">
                      {titleActions}
                  </div>
              )}
          </div>

          {/* 데스크탑 뷰 (hidden sm:flex): 1줄 레이아웃 */}
          <div className="hidden sm:flex w-full items-center justify-between gap-3 flex-nowrap min-w-0">
              {/* 좌측 영역: 뒤로가기/홈 + 타이틀 */}
              <div className="flex items-center gap-2 min-w-0">
                  {user ? (
                    <div className="flex items-center gap-1.5 shrink-0">
                      {pathname !== '/' && (
                        <Button variant="outline" size="icon" className="h-8 w-8 shrink-0" onClick={() => router.back()} title="뒤로가기">
                          <ArrowLeft className="h-4 w-4" />
                          <span className="sr-only">Back</span>
                        </Button>
                      )}
                      {showHomeButton && (
                        <Button asChild variant="outline" size="icon" className="h-8 w-8 shrink-0" title="결재 홈">
                          <Link href="/">
                            <Home className="h-4 w-4" />
                            <span className="sr-only">Home</span>
                          </Link>
                        </Button>
                      )}
                    </div>
                  ) : (
                    <div className="flex items-center gap-1 px-2 py-1 bg-indigo-50/90 text-indigo-700 rounded-lg border border-indigo-200/70 text-xs font-bold shrink-0 shadow-xs">
                      {pathname.startsWith('/attendance/share/') ? (
                        <span className="font-extrabold tracking-tight">KIS 출석부</span>
                      ) : (
                        <>
                          <Bus className="h-4 w-4 text-indigo-600 shrink-0" />
                          <span className="font-extrabold tracking-tight">KIS BUS</span>
                        </>
                      )}
                    </div>
                  )}

                  {!hideTitle && (
                    <div className="shrink-0 flex items-center">
                        <div className="text-base md:text-lg font-bold font-headline whitespace-nowrap shrink-0 text-slate-800 dark:text-slate-100">
                          {title || getPageTitle()}
                        </div>
                    </div>
                  )}
              </div>

              {/* 우측 영역: titleActions + rightActions (데스크톱 언어선택/로그아웃은 최상단 AppHeader로 일원화) */}
              <div className="flex items-center gap-2 min-w-0 flex-1 justify-end overflow-hidden">
              {titleActions && (
              <div className="flex items-center gap-1.5 flex-nowrap overflow-x-auto no-scrollbar py-0.5 min-w-0">
              {titleActions}
              </div>
              )}
              
              {rightActions && (
              <div className="flex items-center gap-1.5 shrink-0">
                 {rightActions}
              </div>
              )}
              </div>
          </div>
          {headerContent && (
            <div className="w-full min-w-0 relative z-50">
              {headerContent}
            </div>
          )}
      </header>
      <main className={cn("flex-1 w-full max-w-full min-w-0", (!hideMobileBottomNav && user) ? "pb-20 lg:pb-0" : "", contentClassName || "p-2 sm:p-4 md:p-6 lg:p-8")}>
        {children}
      </main>
      {!hideMobileBottomNav && <MobileBottomNav />}
    </div>
  );
};
