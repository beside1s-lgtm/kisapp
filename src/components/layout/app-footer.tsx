'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { Download, Smartphone, Share, PlusSquare, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export function AppFooter({ className }: { className?: string }) {
  const [isStandalone, setIsStandalone] = useState(false);
  const [isMounted, setIsMounted] = useState(false);
  const [showGuideModal, setShowGuideModal] = useState(false);
  const [isIos, setIsIos] = useState(false);

  useEffect(() => {
    setIsMounted(true);

    const checkStandalone = () => {
      const isStandaloneMode =
        typeof window !== 'undefined' &&
        (window.matchMedia('(display-mode: standalone)').matches ||
          (window.navigator as any).standalone === true);
      setIsStandalone(isStandaloneMode);
    };

    checkStandalone();

    const mediaQuery = window.matchMedia('(display-mode: standalone)');
    const handleDisplayModeChange = (e: MediaQueryListEvent) => {
      setIsStandalone(e.matches);
    };
    mediaQuery.addEventListener?.('change', handleDisplayModeChange);

    const userAgent = typeof window !== 'undefined' ? window.navigator.userAgent.toLowerCase() : '';
    setIsIos(/iphone|ipad|ipod/.test(userAgent));

    return () => {
      mediaQuery.removeEventListener?.('change', handleDisplayModeChange);
    };
  }, []);

  const handleInstallClick = async () => {
    // 1. 브라우저 PWA 설치 프롬프트가 준비되어 있는 경우 즉시 실행
    const globalPrompt = typeof window !== 'undefined' ? (window as any).__deferredPwaPrompt : null;
    if (globalPrompt) {
      try {
        globalPrompt.prompt();
        const { outcome } = await globalPrompt.userChoice;
        if (outcome === 'accepted') {
          (window as any).__deferredPwaPrompt = null;
          setIsStandalone(true);
          return;
        }
      } catch (err) {
        console.warn('PWA prompt error:', err);
      }
    }

    // 2. 전역 PWA 이벤트 발송
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('trigger-pwa-install'));
    }

    // 3. 브라우저별 안내 모달 오픈
    setShowGuideModal(true);
  };

  return (
    <>
      <footer
        className={cn(
          'border-t py-3 text-center text-xs text-muted-foreground bg-card/30 backdrop-blur-sm no-print print:hidden w-full overflow-x-hidden shrink-0 mt-2',
          className
        )}
      >
        <div className="flex flex-col items-center justify-center gap-2 px-3 max-w-xl mx-auto">
          {/* 전용 앱으로 접속하지 않은 경우 개인정보처리방침 바로 위에 전용 앱 설치 버튼 노출 */}
          {isMounted && !isStandalone && (
            <div className="w-full flex justify-center pb-1">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleInstallClick}
                className="h-8 px-3.5 rounded-full border-indigo-200 hover:border-indigo-400 bg-indigo-50/70 hover:bg-indigo-100/80 text-indigo-900 font-bold text-xs shadow-xs transition-all flex items-center gap-1.5 cursor-pointer active:scale-95"
              >
                <Download className="w-3.5 h-3.5 text-indigo-600 stroke-[2.2]" />
                <span>전용 앱 설치하기</span>
                <span className="text-[10px] bg-indigo-600 text-white font-extrabold px-1.5 py-0.2 rounded-full ml-0.5">
                  설치
                </span>
              </Button>
            </div>
          )}

          <div className="flex flex-col sm:flex-row justify-center items-center gap-1.5 sm:gap-6">
            <span>© {new Date().getFullYear()} KIS 통합 포털. All rights reserved.</span>
            <Link
              href="/privacy"
              className="font-semibold text-primary hover:underline transition-all"
            >
              개인정보처리방침 (Privacy Policy)
            </Link>
          </div>
        </div>
      </footer>

      {/* 모바일 및 브라우저 전용 앱 설치 안내 모달 */}
      {showGuideModal && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-end sm:items-center justify-center p-3 sm:p-4 animate-in fade-in duration-200"
        >
          <div className="bg-white text-slate-900 w-full max-w-sm rounded-3xl p-5 shadow-2xl border flex flex-col gap-4 animate-in slide-in-from-bottom-4 duration-300">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-indigo-600 flex items-center justify-center text-white font-bold shadow-xs">
                  <Smartphone className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-slate-900">전용 앱 간편 설치 안내</h3>
                  <p className="text-[11px] text-slate-500">
                    홈 화면에 추가하여 앱처럼 빠르게 실행할 수 있습니다.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowGuideModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 transition"
                aria-label="닫기"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {isIos ? (
              <div className="space-y-2.5 text-xs text-slate-700 bg-slate-50 p-3.5 rounded-2xl border">
                <div className="font-bold text-indigo-700 pb-1 border-b text-xs flex items-center gap-1.5">
                  <span>아이폰 / 아이패드 (Safari)</span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="w-4.5 h-4.5 rounded-full bg-indigo-100 text-indigo-700 font-extrabold flex items-center justify-center shrink-0 text-[11px]">
                    1
                  </span>
                  <p>
                    Safari 브라우저 하단의 <strong>공유 버튼</strong>(
                    <Share className="inline w-3 h-3 text-indigo-600 mx-0.5" />
                    )을 누릅니다.
                  </p>
                </div>
                <div className="flex items-start gap-2">
                  <span className="w-4.5 h-4.5 rounded-full bg-indigo-100 text-indigo-700 font-extrabold flex items-center justify-center shrink-0 text-[11px]">
                    2
                  </span>
                  <p>
                    메뉴에서 <strong>[홈 화면에 추가]</strong>(
                    <PlusSquare className="inline w-3 h-3 text-indigo-600 mx-0.5" />
                    ) 항목을 선택합니다.
                  </p>
                </div>
                <div className="flex items-start gap-2">
                  <span className="w-4.5 h-4.5 rounded-full bg-indigo-100 text-indigo-700 font-extrabold flex items-center justify-center shrink-0 text-[11px]">
                    3
                  </span>
                  <p>우측 상단의 <strong>[추가]</strong>를 누르면 홈 화면에 앱 아이콘이 생성됩니다.</p>
                </div>
              </div>
            ) : (
              <div className="space-y-2.5 text-xs text-slate-700 bg-slate-50 p-3.5 rounded-2xl border">
                <div className="font-bold text-indigo-700 pb-1 border-b text-xs flex items-center gap-1.5">
                  <span>안드로이드 (Chrome / 삼성인터넷) & PC</span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="w-4.5 h-4.5 rounded-full bg-indigo-100 text-indigo-700 font-extrabold flex items-center justify-center shrink-0 text-[11px]">
                    1
                  </span>
                  <p>
                    브라우저 우측 상단 <strong>메뉴 [ ⋮ ]</strong> 또는 주소창의 <strong>설치 아이콘</strong>을 누릅니다.
                  </p>
                </div>
                <div className="flex items-start gap-2">
                  <span className="w-4.5 h-4.5 rounded-full bg-indigo-100 text-indigo-700 font-extrabold flex items-center justify-center shrink-0 text-[11px]">
                    2
                  </span>
                  <p>
                    <strong>[앱 설치]</strong> 또는 <strong>[홈 화면에 추가]</strong>를 선택합니다.
                  </p>
                </div>
                <div className="flex items-start gap-2">
                  <span className="w-4.5 h-4.5 rounded-full bg-indigo-100 text-indigo-700 font-extrabold flex items-center justify-center shrink-0 text-[11px]">
                    3
                  </span>
                  <p>확인을 누르면 홈 화면에 KIS 통합 포털 앱이 즉시 추가됩니다.</p>
                </div>
              </div>
            )}

            <Button
              type="button"
              className="w-full bg-indigo-600 hover:bg-indigo-700 font-bold text-xs h-9 rounded-xl text-white cursor-pointer"
              onClick={() => setShowGuideModal(false)}
            >
              확인했습니다
            </Button>
          </div>
        </div>
      )}
    </>
  );
}
