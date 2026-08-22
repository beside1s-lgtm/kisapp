
'use client';
import type { FC, ReactNode } from 'react';
import React from 'react';
import Link from 'next/link';
import { Home, LogOut, ArrowLeft, Bus } from 'lucide-react';
import { Button } from '../ui/button';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';
import { useToast } from '@/hooks/use-toast';
import { useTranslation } from '@/hooks/use-translation';
import { LanguageSwitcher } from './language-switcher';
import { AcademicCalendarSyncModal } from '../academic-calendar-sync-modal';

interface MainLayoutProps {
  children: ReactNode;
  headerContent?: ReactNode;
  titleActions?: ReactNode;
  hideTitle?: boolean;
  mobileHeaderRow1?: ReactNode;
  title?: ReactNode;
}

export const MainLayout: FC<MainLayoutProps> = ({ 
  children, 
  headerContent, 
  titleActions, 
  hideTitle = false, 
  mobileHeaderRow1,
  title,
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

  if (authLoading && pathname.startsWith('/admin')) {
    return (
      <div className="flex justify-center items-center h-screen">
        <p>{t('loading.auth')}</p>
      </div>
    );
  }

  const showHomeButton = pathname.startsWith('/admin') || pathname.startsWith('/teacher');

  return (
    <div className="flex flex-col min-h-screen bg-background">
       <AcademicCalendarSyncModal />
       <header className="sticky top-0 z-10 flex flex-col gap-1.5 border-b bg-card/85 px-2.5 sm:px-4 md:px-6 py-1.5 sm:py-2 backdrop-blur-md shadow-xs">
          <div className="flex w-full items-center justify-between gap-1.5 sm:gap-3 flex-nowrap min-w-0">
              {/* 좌측 영역: 뒤로가기/홈(로그인 시) 또는 버스 로고(비로그인 시) + 타이틀 */}
              <div className="flex items-center gap-1.5 sm:gap-2 min-w-0 flex-shrink-0">
                  {/* 로그인된 사용자에게만 뒤로가기 및 홈 버튼 노출 */}
                  {user ? (
                    <>
                      {pathname !== '/' && pathname !== '/inbox' && (
                        <Button variant="outline" size="icon" className="h-7 w-7 sm:h-8 sm:w-8 flex-shrink-0" onClick={() => router.back()} title="뒤로가기">
                          <ArrowLeft className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                          <span className="sr-only">Back</span>
                        </Button>
                      )}
                      {showHomeButton && (
                        <Button asChild variant="outline" size="icon" className="h-7 w-7 sm:h-8 sm:w-8 flex-shrink-0" title="결재 홈">
                          <Link href="/">
                            <Home className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                            <span className="sr-only">Home</span>
                          </Link>
                        </Button>
                      )}
                    </>
                  ) : (
                    /* 비로그인 사용자: 결재 화면 이탈 방지용 깔끔한 전용 버스 배지 표출 */
                    <div className="flex items-center gap-1 px-1.5 sm:px-2 py-0.5 sm:py-1 bg-indigo-50/90 text-indigo-700 rounded-lg border border-indigo-200/70 text-[11px] sm:text-xs font-bold shrink-0 shadow-xs">
                      <Bus className="h-3.5 w-3.5 text-indigo-600 shrink-0" />
                      <span className="font-extrabold tracking-tight">KIS BUS</span>
                    </div>
                  )}

                  {!hideTitle ? (
                    <h1 className="text-xs sm:text-sm md:text-base font-bold font-headline truncate whitespace-nowrap">
                        {title || getPageTitle()}
                    </h1>
                  ) : (
                    <div className="flex-1 sm:hidden min-w-0">
                        {mobileHeaderRow1}
                    </div>
                  )}
              </div>

              {/* 우측 영역: titleActions + LanguageSwitcher + 로그아웃 (항상 1줄 유지) */}
              <div className="flex items-center gap-1 sm:gap-1.5 flex-shrink-0 flex-nowrap min-w-0">
                  {titleActions && (
                      <div className="flex items-center flex-nowrap min-w-0">
                          {titleActions}
                      </div>
                  )}
                  
                  {/* LanguageSwitcher 배치 */}
                  <div className="flex items-center gap-1 flex-shrink-0">
                      <LanguageSwitcher />
                      {user && pathname.startsWith('/admin') && (
                          <Button variant="outline" size="sm" onClick={handleLogout} className="h-7 sm:h-8 px-2 sm:px-2.5">
                            <LogOut className="h-3.5 w-3.5 sm:mr-1.5" />
                            <span className="hidden md:inline text-xs">{t('logout.button')}</span>
                          </Button>
                      )}
                  </div>
              </div>
          </div>
          {headerContent && (
            <div className="w-full">
              {headerContent}
            </div>
          )}
      </header>
      <main className="flex-1 p-4 md:p-6 lg:p-8">
        {children}
      </main>
      <footer className="border-t py-4 text-center text-xs text-muted-foreground bg-card/30 backdrop-blur-sm no-print">
        <div className="flex flex-col sm:flex-row justify-center items-center gap-2 sm:gap-6">
          <span>© {new Date().getFullYear()} KIS School Bus. All rights reserved.</span>
          <Link href="/privacy" className="font-semibold text-primary hover:underline transition-all">
            개인정보처리방침 (Privacy Policy)
          </Link>
        </div>
      </footer>
    </div>
  );
};
