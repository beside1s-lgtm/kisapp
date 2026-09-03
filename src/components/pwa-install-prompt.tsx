'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { 
    Download, 
    Share, 
    PlusSquare, 
    X, 
    Smartphone, 
    CheckCircle2, 
    Sparkles,
    GraduationCap,
    School
} from 'lucide-react';
import { usePathname } from 'next/navigation';

// 대시보드 및 내부 서비스 경로 확인 (로그인 화면, 루트 리다이렉트, 약관 페이지 제외)
function isDashboardRoute(pathname: string | null): boolean {
    if (!pathname) return false;
    if (
        pathname === '/' ||
        pathname === '/login' ||
        pathname === '/parents/login' ||
        pathname === '/parents/setup' ||
        pathname === '/privacy'
    ) {
        return false;
    }
    return (
        pathname.startsWith('/inbox') ||
        pathname.startsWith('/admin') ||
        pathname.startsWith('/teacher') ||
        pathname.startsWith('/parents') ||
        pathname.startsWith('/new') ||
        pathname.startsWith('/sent') ||
        pathname.startsWith('/recalled') ||
        pathname.startsWith('/registry') ||
        pathname.startsWith('/attendance-registry') ||
        pathname.startsWith('/field-trip-registry') ||
        pathname.startsWith('/circular') ||
        pathname.startsWith('/documents') ||
        pathname.startsWith('/edit')
    );
}

export function PwaInstallPrompt() {
    const { user, loading } = useAuth();
    const pathname = usePathname();
    const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
    const [isInstallable, setIsInstallable] = useState(false);
    const [isIos, setIsIos] = useState(false);
    const [isStandalone, setIsStandalone] = useState(false);
    const [dismissed, setDismissed] = useState(false);
    const [neverShowAgain, setNeverShowAgain] = useState(false);
    const [showIosGuide, setShowIosGuide] = useState(false);
    const [isMounted, setIsMounted] = useState(false);

    useEffect(() => {
        setIsMounted(true);

        // 1. Check if already installed / standalone
        const isStandaloneMode = 
            window.matchMedia('(display-mode: standalone)').matches || 
            (window.navigator as any).standalone === true;
        
        setIsStandalone(isStandaloneMode);
        if (isStandaloneMode) return;

        // 2. Check if dismissed permanently or within 7 days
        const dismissedForever = localStorage.getItem('kis_pwa_install_dismissed_forever');
        if (dismissedForever === 'true') {
            setDismissed(true);
            return;
        }

        const lastDismissed = localStorage.getItem('kis_pwa_install_dismissed');
        if (lastDismissed) {
            const timeDiff = Date.now() - parseInt(lastDismissed, 10);
            if (timeDiff < 7 * 24 * 60 * 60 * 1000) { // 7 days
                setDismissed(true);
            }
        }

        // 3. Detect iOS
        const userAgent = window.navigator.userAgent.toLowerCase();
        const isIosDevice = /iphone|ipad|ipod/.test(userAgent);
        setIsIos(isIosDevice);

        // 4. Register Service Worker
        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.register('/sw.js')
                .then((reg) => {
                    console.log('PWA Service Worker registered:', reg.scope);
                })
                .catch((err) => {
                    console.warn('PWA Service Worker registration failed:', err);
                });
        }

        // 5. Listen to beforeinstallprompt event (Android / Chrome)
        const handleBeforeInstallPrompt = (e: Event) => {
            e.preventDefault();
            (window as any).__deferredPwaPrompt = e;
            setDeferredPrompt(e);
            setIsInstallable(true);
        };

        window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

        // 6. Listen to custom trigger event from dashboard buttons
        const handleTriggerInstall = () => {
            const prompt = (window as any).__deferredPwaPrompt || deferredPrompt;
            if (prompt) {
                prompt.prompt();
            } else if (isIosDevice) {
                setShowIosGuide(true);
            }
        };
        window.addEventListener('trigger-pwa-install', handleTriggerInstall);

        // Check display mode changes
        const mediaQuery = window.matchMedia('(display-mode: standalone)');
        const handleDisplayModeChange = (e: MediaQueryListEvent) => {
            setIsStandalone(e.matches);
        };
        mediaQuery.addEventListener('change', handleDisplayModeChange);

        return () => {
            window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
            window.removeEventListener('trigger-pwa-install', handleTriggerInstall);
            mediaQuery.removeEventListener('change', handleDisplayModeChange);
        };
    }, [deferredPrompt]);

    const handleInstallClick = async () => {
        const prompt = (window as any).__deferredPwaPrompt || deferredPrompt;
        if (prompt) {
            prompt.prompt();
            const { outcome } = await prompt.userChoice;
            if (outcome === 'accepted') {
                setIsInstallable(false);
                setDeferredPrompt(null);
                (window as any).__deferredPwaPrompt = null;
            }
        } else if (isIos) {
            setShowIosGuide(true);
        }
    };

    const handleDismiss = () => {
        setDismissed(true);
        if (neverShowAgain) {
            localStorage.setItem('kis_pwa_install_dismissed_forever', 'true');
        } else {
            localStorage.setItem('kis_pwa_install_dismissed', Date.now().toString());
        }
    };

    if (!isMounted || isStandalone || dismissed || loading || !user || !isDashboardRoute(pathname)) {
        return null;
    }

    // Only display prompt if installable on Android/desktop OR if it's iOS Safari outside standalone
    if (!isInstallable && !isIos) {
        return null;
    }

    return (
        <>
            {/* Floating Bottom Banner */}
            <aside 
                aria-label="앱 설치 안내"
                className="fixed bottom-3 left-3 right-3 sm:left-auto sm:right-6 sm:max-w-md z-50 animate-in fade-in slide-in-from-bottom-5 duration-300 no-print"
            >
                <div className="bg-slate-900/95 backdrop-blur-md text-white p-3.5 sm:p-4 rounded-2xl shadow-2xl border border-indigo-500/40 flex flex-col gap-2.5">
                    <div className="flex items-start justify-between gap-2.5">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-indigo-700 flex items-center justify-center text-white shadow-md shrink-0 border border-indigo-400/30">
                                <GraduationCap className="w-5 h-5 text-amber-300" />
                            </div>
                            <div className="min-w-0">
                                <div className="flex items-center gap-1.5">
                                    <h4 className="font-bold text-xs sm:text-sm text-white truncate">
                                        KIS 통합 포털 전용 앱
                                    </h4>
                                    <Badge className="bg-indigo-500 text-white text-[9px] px-1 py-0 h-4 leading-none font-bold">
                                        홈 화면 추가
                                    </Badge>
                                </div>
                                <p className="text-[11px] text-slate-300 mt-0.5 leading-snug">
                                    전자결재·학사일정·방과후·스쿨버스 통합 포털을 앱처럼 빠르고 편리하게 이용하세요!
                                </p>
                            </div>
                        </div>
                        <button 
                            type="button"
                            onClick={handleDismiss} 
                            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition shrink-0"
                            aria-label="닫기"
                            title="닫기"
                        >
                            <X className="w-4 h-4" />
                        </button>
                    </div>

                    <div className="flex items-center justify-between pt-1 gap-2">
                        <label className="flex items-center gap-1.5 text-[11px] text-slate-300 cursor-pointer select-none">
                            <input 
                                type="checkbox" 
                                checked={neverShowAgain} 
                                onChange={(e) => setNeverShowAgain(e.target.checked)}
                                className="w-3.5 h-3.5 rounded text-indigo-600 focus:ring-indigo-500 bg-slate-800 border-slate-600 accent-indigo-500 cursor-pointer" 
                            />
                            <span>다시 띄우지 않기</span>
                        </label>
                        <span className="text-[10px] text-slate-400">대시보드 하단에서도 설치 가능</span>
                    </div>

                    <div className="flex items-center gap-2 pt-0.5">
                        <Button 
                            size="sm" 
                            onClick={handleInstallClick} 
                            className="flex-1 h-8 bg-indigo-600 hover:bg-indigo-500 text-white font-extrabold text-xs shadow-md flex items-center justify-center gap-1.5 rounded-xl border border-indigo-400/40"
                        >
                            <Download className="w-3.5 h-3.5 text-amber-300" />
                            <span>전용 앱 설치하기 (1초)</span>
                        </Button>
                        <Button 
                            variant="ghost" 
                            size="sm" 
                            onClick={handleDismiss} 
                            className="h-8 text-xs text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl px-2.5"
                        >
                            {neverShowAgain ? '닫기 (영구)' : '닫기'}
                        </Button>
                    </div>
                </div>
            </aside>

            {/* iOS Safari Guide Modal */}
            {showIosGuide && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-end sm:items-center justify-center p-4 animate-in fade-in duration-200">
                    <div className="bg-white text-slate-900 w-full max-w-sm rounded-3xl p-5 shadow-2xl border flex flex-col gap-4 animate-in slide-in-from-bottom-5 duration-300">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center text-white font-bold">
                                    <Smartphone className="w-4 h-4" />
                                </div>
                                <h3 className="font-bold text-sm text-slate-900">아이폰(iOS) 앱 설치 방법</h3>
                            </div>
                            <button 
                                type="button"
                                onClick={() => setShowIosGuide(false)}
                                className="text-slate-400 hover:text-slate-600 p-1"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </div>

                        <div className="space-y-3 text-xs text-slate-600 bg-slate-50 p-3.5 rounded-2xl border">
                            <div className="flex items-start gap-2.5">
                                <span className="w-5 h-5 rounded-full bg-indigo-100 text-indigo-700 font-extrabold flex items-center justify-center shrink-0 text-[11px]">1</span>
                                <p>Safari 브라우저 하단의 <strong>공유 버튼</strong>(<Share className="inline w-3.5 h-3.5 text-indigo-600 mx-0.5" />)을 누릅니다.</p>
                            </div>
                            <div className="flex items-start gap-2.5">
                                <span className="w-5 h-5 rounded-full bg-indigo-100 text-indigo-700 font-extrabold flex items-center justify-center shrink-0 text-[11px]">2</span>
                                <p>메뉴에서 <strong>[홈 화면에 추가]</strong>(<PlusSquare className="inline w-3.5 h-3.5 text-indigo-600 mx-0.5" />) 항목을 선택합니다.</p>
                            </div>
                            <div className="flex items-start gap-2.5">
                                <span className="w-5 h-5 rounded-full bg-indigo-100 text-indigo-700 font-extrabold flex items-center justify-center shrink-0 text-[11px]">3</span>
                                <p>우측 상단의 <strong>[추가]</strong>를 누르면 홈 화면에 앱 아이콘이 생성됩니다!</p>
                            </div>
                        </div>

                        <Button 
                            className="w-full bg-indigo-600 hover:bg-indigo-700 font-bold text-xs h-9 rounded-xl"
                            onClick={() => setShowIosGuide(false)}
                        >
                            확인했습니다
                        </Button>
                    </div>
                </div>
            )}
        </>
    );
}
