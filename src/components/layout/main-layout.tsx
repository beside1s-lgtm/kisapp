
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
  const headerStickyClass = 'sticky top-0 z-30';

  return (
    <div className="flex flex-col min-h-screen bg-background w-full max-w-full min-w-0">
       <header className={`${headerStickyClass} flex flex-col gap-1 border-b bg-card/95 px-2.5 sm:px-4 md:px-6 py-1.5 sm:py-2 backdrop-blur-md shadow-xs w-full max-w-full`}>
          {/* 모바일 뷰 (sm:hidden): 2줄 레이아웃 */}
          <div className="flex sm:hidden flex-col gap-1.5 w-full min-w-0">
              {/* Row 1: 뒤로가기/홈 + 타이틀 + 언어선택기 */}
              <div className="flex items-center justify-between gap-2 w-full min-w-0">
                  <div className="flex items-center gap-1.5 min-w-0 shrink">
                      {user ? (
                        <div className="flex items-center gap-1 shrink-0">
                          {pathname !== '/' && pathname !== '/inbox' && (
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
                          <Bus className="h-4 w-4 text-indigo-600 shrink-0" />
                          <span className="font-extrabold tracking-tight">KIS BUS</span>
                        </div>
                      )}

                      {!hideTitle && (
                        <div className={typeof title === 'string' ? "min-w-0 truncate" : "min-w-0 flex items-center"}>
                            <div className={`text-sm font-bold font-headline text-slate-800 dark:text-slate-100 ${typeof title === 'string' ? 'truncate' : ''}`}>
                              {title || getPageTitle()}
                            </div>
                        </div>
                      )}
                  </div>

                  {/* Row 1 우측: rightActions + LanguageSwitcher */}
                  <div className="flex items-center gap-1 shrink-0">
                      {rightActions}
                      <LanguageSwitcher />
                      {user && pathname.startsWith('/admin') && (
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
                      {pathname !== '/' && pathname !== '/inbox' && (
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
                      <Bus className="h-4 w-4 text-indigo-600 shrink-0" />
                      <span className="font-extrabold tracking-tight">KIS BUS</span>
                    </div>
                  )}

                  {!hideTitle && (
                    <div className={typeof title === 'string' ? "min-w-0 truncate" : "min-w-0 flex items-center"}>
                        <div className={`text-base md:text-lg font-bold font-headline ${typeof title === 'string' ? 'truncate' : ''}`}>
                          {title || getPageTitle()}
                        </div>
                    </div>
                  )}
              </div>

              {/* 우측 영역: titleActions + rightActions + LanguageSwitcher + 로그아웃 */}
              <div className="flex items-center gap-2 shrink-0 justify-end">
                  {titleActions && (
                      <div className="flex items-center gap-1.5 flex-nowrap min-w-0">
                          {titleActions}
                      </div>
                  )}
                  
                  <div className="flex items-center gap-1.5 shrink-0">
                      {rightActions}
                      <LanguageSwitcher />
                      {user && pathname.startsWith('/admin') && (
                          <Button variant="outline" size="sm" onClick={handleLogout} className="h-8 px-2.5 text-xs text-rose-600 border-rose-200 hover:bg-rose-50">
                            <LogOut className="h-4 w-4 mr-1.5" />
                            <span className="hidden md:inline text-xs">{t('logout.button')}</span>
                          </Button>
                      )}
                  </div>
              </div>
          </div>
          {headerContent && (
            <div className="w-full min-w-0 relative z-50">
              {headerContent}
            </div>
          )}
      </header>
      <main className={cn("flex-1 w-full max-w-full overflow-x-hidden min-w-0", contentClassName || "p-2 sm:p-4 md:p-6 lg:p-8")}>
        {children}
      </main>
    </div>
  );
};
