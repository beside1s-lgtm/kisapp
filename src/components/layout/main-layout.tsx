
'use client';
import type { FC, ReactNode } from 'react';
import React from 'react';
import Link from 'next/link';
import { Home, LogOut, ArrowLeft } from 'lucide-react';
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
       <header className="sticky top-0 z-10 flex flex-col gap-2 border-b bg-card/80 px-3 py-2 backdrop-blur-sm sm:gap-4 sm:px-4 md:px-6">
          <div className="flex w-full flex-col sm:flex-row sm:items-center justify-between gap-3">
              {/* 상단 라인: 뒤로가기/홈 + 타이틀 또는 모바일 1번 라인 배지 */}
              <div className="flex items-center justify-between w-full sm:w-auto gap-2 min-w-0">
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                      {/* 뒤로가기 버튼: 메인 홈과 인박스를 제외한 모든 페이지에서 항상 노출 */}
                      {pathname !== '/' && pathname !== '/inbox' && (
                        <Button variant="outline" size="icon" className="h-8 w-8 flex-shrink-0" onClick={() => router.back()}>
                          <ArrowLeft className="h-4 w-4" />
                          <span className="sr-only">Back</span>
                        </Button>
                      )}
                      {showHomeButton && (
                        <Button asChild variant="outline" size="icon" className="h-8 w-8 flex-shrink-0">
                          <Link href="/">
                            <Home className="h-4 w-4" />
                            <span className="sr-only">Home</span>
                          </Link>
                        </Button>
                      )}
                      {!hideTitle ? (
                        <h1 className="text-base font-semibold sm:text-lg md:text-xl font-headline truncate">
                            {title || getPageTitle()}
                        </h1>
                      ) : (
                        <div className="flex-1 sm:hidden min-w-0">
                            {mobileHeaderRow1}
                        </div>
                      )}
                  </div>
              </div>

              {/* 하단/우측 영역: titleActions + LanguageSwitcher(데스크탑) */}
              <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
                  {titleActions && (
                      <div className="w-full sm:w-auto">
                          {titleActions}
                      </div>
                  )}
                  
                  {/* 데스크탑 화면에서 LanguageSwitcher 배치 */}
                  <div className="hidden sm:flex items-center gap-1.5 sm:gap-2 flex-shrink-0">
                      <LanguageSwitcher />
                      {user && pathname.startsWith('/admin') && (
                          <Button variant="outline" size="sm" onClick={handleLogout} className="h-8 px-2 sm:px-3">
                            <LogOut className="h-4 w-4 sm:mr-2" />
                            <span className="hidden sm:inline">{t('logout.button')}</span>
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
