'use client';

import { useAuth } from '@/hooks/use-auth';
import { useRouter, usePathname } from 'next/navigation';
import { useState, useEffect } from 'react';
import { Loader2, LogOut, FileText, Globe } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { ParentSettingsDialog } from '@/components/parent-settings-dialog';
import { LanguageSwitcher } from '@/components/layout/language-switcher';
import { AppFooter } from '@/components/layout/app-footer';
import { useTranslation } from '@/hooks/use-translation';
import { onDocConfigUpdate } from '@/lib/services/settingsService';
import type { DocConfig } from '@/lib/types';

export default function ParentsLayout({ children }: { children: React.ReactNode }) {
  const { user, loading, profile, profileLoading, logout, isParent } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const { t } = useTranslation();
  const [docConfig, setDocConfig] = useState<DocConfig | null>(null);

  useEffect(() => {
    const unsub = onDocConfigUpdate((cfg) => {
      setDocConfig(cfg as DocConfig);
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    if (!loading && !user && pathname !== '/parents/login') {
      router.push('/parents/login');
    } else if (!loading && user && !isParent) {
      router.push('/inbox');
    } else if (!loading && user && isParent && profile) {
      const requirePin = docConfig ? docConfig.requireParentPin !== false : true;
      const hasSetup = (requirePin ? !!profile.hashedPin : true) && !!profile.parentSignature;
      if (!hasSetup && pathname !== '/parents/setup' && pathname !== '/parents/login') {
        router.push('/parents/setup');
      } else if (hasSetup && pathname === '/parents/setup') {
        router.push('/parents');
      }
    }
  }, [user, loading, isParent, pathname, router, profile, docConfig]);
  
  const isLoginPage = pathname === '/parents/login';

  if (loading || (!user && !isLoginPage) || (user && profileLoading)) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-12 w-12 animate-spin text-primary" />
          <p className="text-muted-foreground font-bold animate-pulse">
            {t('loading.data') || '시스템 로딩 중...'}
          </p>
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
      <header className="sticky top-0 z-50 flex h-13 sm:h-16 items-center justify-between border-b bg-card px-2 sm:px-4 md:px-8 print:hidden w-full min-w-0">
        <div className="flex items-center gap-1.5 sm:gap-6 min-w-0">
          <Link href="/parents" className="flex items-center gap-1.5 sm:gap-2 font-headline text-sm sm:text-base md:text-lg font-bold tracking-tight text-foreground hover:text-primary transition-colors min-w-0 shrink">
            <div className="bg-primary p-1 sm:p-1.5 rounded-md text-primary-foreground shrink-0">
              <FileText className="w-3.5 h-3.5 sm:w-[18px] sm:h-[18px]" />
            </div>
            <span className="truncate max-w-[115px] sm:max-w-none">{t('parents.title') || 'KIS 학부모서비스'}</span>
          </Link>
          <nav className="hidden xl:flex items-center gap-2">
            <Button 
              variant={pathname === '/parents/apply' ? 'default' : 'ghost'} 
              asChild
            >
              <Link href="/parents/apply">{t('nav.apply') || '신청서 제출'}</Link>
            </Button>
            <Button 
              variant={pathname === '/parents/history' ? 'default' : 'ghost'} 
              asChild
            >
              <Link href="/parents/history">{t('nav.history') || '제출 내역'}</Link>
            </Button>
            <Button 
              variant={pathname.startsWith('/parents/bus') ? 'default' : 'ghost'} 
              asChild
            >
              <Link href="/parents/bus">{t('nav.bus') || '스쿨버스'}</Link>
            </Button>
            <Button 
              variant={pathname.startsWith('/parents/afterschool') ? 'default' : 'ghost'} 
              asChild
            >
              <Link href="/parents/afterschool">{t('nav.afterschool') || '방과후학교'}</Link>
            </Button>
          </nav>
          <nav className="hidden lg:flex xl:hidden items-center gap-1">
            <Button 
              variant={pathname === '/parents/apply' ? 'default' : 'ghost'} 
              className="text-xs px-2"
              asChild
            >
              <Link href="/parents/apply">{t('nav.apply_short') || '신청서'}</Link>
            </Button>
            <Button 
              variant={pathname === '/parents/history' ? 'default' : 'ghost'} 
              className="text-xs px-2"
              asChild
            >
              <Link href="/parents/history">{t('nav.history_short') || '내역'}</Link>
            </Button>
            <Button 
              variant={pathname.startsWith('/parents/bus') ? 'default' : 'ghost'} 
              className="text-xs px-2"
              asChild
            >
              <Link href="/parents/bus">{t('nav.bus_short') || '스쿨버스'}</Link>
            </Button>
            <Button 
              variant={pathname.startsWith('/parents/afterschool') ? 'default' : 'ghost'} 
              className="text-xs px-2"
              asChild
            >
              <Link href="/parents/afterschool">{t('nav.afterschool_short') || '방과후'}</Link>
            </Button>
          </nav>
        </div>
        
        <div className="flex items-center gap-1 sm:gap-2 md:gap-3 shrink-0">
          {/* 다국어 언어 변경 스위처 */}
          <LanguageSwitcher />

          <ParentSettingsDialog />
          <Button variant="ghost" size="sm" onClick={logout} className="h-8 px-1.5 sm:px-2 text-muted-foreground hover:text-foreground shrink-0" title={t('logout.button') || '로그아웃'}>
            <LogOut className="h-4 w-4 sm:mr-1.5" />
            <span className="hidden sm:inline">{t('logout.button') || '로그아웃'}</span>
          </Button>
        </div>
      </header>
      
      {/* Mobile nav */}
      <div className="lg:hidden grid grid-cols-4 gap-1 border-b bg-muted/30 p-1.5 print:hidden w-full min-w-0">
        <Button 
          variant={pathname === '/parents/apply' ? 'default' : 'ghost'} 
          size="sm"
          className="text-[11px] sm:text-xs h-8 px-0.5 font-bold truncate min-w-0"
          asChild
        >
          <Link href="/parents/apply">{t('nav.apply_short') || '신청서'}</Link>
        </Button>
        <Button 
          variant={pathname === '/parents/history' ? 'default' : 'ghost'} 
          size="sm"
          className="text-[11px] sm:text-xs h-8 px-0.5 font-bold truncate min-w-0"
          asChild
        >
          <Link href="/parents/history">{t('nav.history_short') || '내역'}</Link>
        </Button>
        <Button 
          variant={pathname.startsWith('/parents/bus') ? 'default' : 'ghost'} 
          size="sm"
          className="text-[11px] sm:text-xs h-8 px-0.5 font-bold truncate min-w-0"
          asChild
        >
          <Link href="/parents/bus">{t('nav.bus_short') || '스쿨버스'}</Link>
        </Button>
        <Button 
          variant={pathname.startsWith('/parents/afterschool') ? 'default' : 'ghost'} 
          size="sm"
          className="text-[11px] sm:text-xs h-8 px-0.5 font-bold truncate min-w-0"
          asChild
        >
          <Link href="/parents/afterschool">{t('nav.afterschool_short') || '방과후'}</Link>
        </Button>
      </div>

      <main className="flex-1 p-2.5 sm:p-4 md:p-8 overflow-y-auto print:p-0 print:m-0 print:block print:overflow-visible flex flex-col justify-between">
        <div className="flex-1">
          {children}
        </div>
        <AppFooter className="mt-6" />
      </main>
      </>
      )}
      {isAuthPage && (
        <div className="flex-1 w-full h-full flex flex-col">
          {/* 로그인 / 설정 페이지 상단 언어 선택 바 */}
          <div className="w-full flex justify-end p-3 sm:p-4 border-b bg-card/60">
            <LanguageSwitcher />
          </div>
          <main className="flex-1 w-full h-full">
            {children}
          </main>
        </div>
      )}
    </div>
  );
}

