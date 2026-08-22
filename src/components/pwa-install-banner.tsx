'use client';

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
    Download, 
    Smartphone, 
    Sparkles, 
    CheckCircle2, 
    Share, 
    PlusSquare, 
    X,
    ExternalLink
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export function PwaInstallBanner({ className }: { className?: string }) {
    const [isStandalone, setIsStandalone] = useState(false);
    const [isMounted, setIsMounted] = useState(false);
    const [showGuideModal, setShowGuideModal] = useState(false);
    const [isIos, setIsIos] = useState(false);
    const { toast } = useToast();

    useEffect(() => {
        setIsMounted(true);
        const isStandaloneMode = 
            window.matchMedia('(display-mode: standalone)').matches || 
            (window.navigator as any).standalone === true;
        setIsStandalone(isStandaloneMode);

        const userAgent = window.navigator.userAgent.toLowerCase();
        setIsIos(/iphone|ipad|ipod/.test(userAgent));
    }, []);

    const handleInstallClick = async () => {
        if (isStandalone) {
            toast({
                title: "이미 앱으로 실행 중입니다",
                description: "현재 KIS 통합 포털 전용 앱 모드로 안전하게 사용하고 계십니다.",
            });
            return;
        }

        // 글로벌 윈도우 프롬프트 확인
        const globalPrompt = (window as any).__deferredPwaPrompt;
        if (globalPrompt) {
            globalPrompt.prompt();
            const { outcome } = await globalPrompt.userChoice;
            if (outcome === 'accepted') {
                (window as any).__deferredPwaPrompt = null;
                toast({
                    title: "앱 설치 완료",
                    description: "바탕화면/홈 화면에 KIS 통합 포털 앱이 추가되었습니다.",
                });
            }
            return;
        }

        // 이벤트 트리거 발송
        window.dispatchEvent(new CustomEvent('trigger-pwa-install'));

        // 안드로이드 / PC 크롬에서 프롬프트가 없을 때 안내 모달 오픈
        setShowGuideModal(true);
    };

    if (!isMounted || isStandalone) {
        return null;
    }

    return (
        <>
            <Card className={`overflow-hidden border border-indigo-200 bg-gradient-to-r from-indigo-900 via-indigo-800 to-slate-900 text-white shadow-lg rounded-2xl ${className || ''}`}>
                <CardContent className="p-4 sm:p-5 flex flex-col sm:flex-row items-center justify-between gap-4">
                    <div className="flex items-center gap-3.5 w-full sm:w-auto">
                        <div className="relative w-12 h-12 rounded-2xl bg-gradient-to-br from-amber-400 via-indigo-500 to-indigo-700 p-0.5 shadow-md shrink-0 flex items-center justify-center">
                            <img src="/icons/icon-192x192.png?v=2" alt="KIS Icon" className="w-full h-full rounded-[14px] object-cover" />
                            <span className="absolute -top-1 -right-1 flex h-3 w-3">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                                <span className="relative inline-flex rounded-full h-3 w-3 bg-amber-500"></span>
                            </span>
                        </div>
                        <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                                <h3 className="font-bold text-sm sm:text-base text-white tracking-tight">
                                    KIS 통합 포털 전용 앱 설치
                                </h3>
                                <Badge className="bg-amber-400 hover:bg-amber-400 text-indigo-950 font-black text-[10px] px-1.5 py-0 h-4">
                                    PC · 폰 홈 화면 1초 설치
                                </Badge>
                            </div>
                            <p className="text-xs text-indigo-200 mt-0.5 leading-snug">
                                번거로운 주소 입력 없이 홈 화면에서 전자결재·학사일정·방과후·스쿨버스를 즉시 실행하세요.
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-2 w-full sm:w-auto justify-end shrink-0">
                        <Button
                            onClick={handleInstallClick}
                            className="w-full sm:w-auto bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-500 hover:to-amber-600 text-indigo-950 font-black text-xs sm:text-sm h-10 px-5 rounded-xl shadow-md flex items-center justify-center gap-2 border border-amber-300 transition-all transform active:scale-95"
                        >
                            <Download className="w-4 h-4 text-indigo-950 stroke-[2.5]" />
                            <span>전용 앱 설치하기</span>
                        </Button>
                    </div>
                </CardContent>
            </Card>

            {/* 설치 안내 모달 (브라우저별 가이드) */}
            {showGuideModal && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
                    <div className="bg-white text-slate-900 w-full max-w-md rounded-3xl p-6 shadow-2xl border flex flex-col gap-4 animate-in zoom-in-95 duration-200">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2.5">
                                <div className="w-9 h-9 rounded-xl bg-indigo-600 flex items-center justify-center text-white font-bold shadow-sm">
                                    <Smartphone className="w-5 h-5" />
                                </div>
                                <div>
                                    <h3 className="font-bold text-base text-slate-900">전용 앱 간편 설치 안내</h3>
                                    <p className="text-[11px] text-slate-500">별도 APK 파일 다운로드 없이 브라우저에서 1초 만에 설치됩니다.</p>
                                </div>
                            </div>
                            <button 
                                type="button"
                                onClick={() => setShowGuideModal(false)}
                                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 transition"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        {isIos ? (
                            <div className="space-y-3 text-xs text-slate-700 bg-slate-50 p-4 rounded-2xl border">
                                <div className="font-bold text-indigo-700 pb-1 border-b text-[13px] flex items-center gap-1.5">
                                    <span>🍏 아이폰 / 아이패드 (Safari)</span>
                                </div>
                                <div className="flex items-start gap-2.5">
                                    <span className="w-5 h-5 rounded-full bg-indigo-100 text-indigo-700 font-black flex items-center justify-center shrink-0 text-[11px]">1</span>
                                    <p>Safari 브라우저 하단 중앙의 <strong>공유 버튼</strong>(<Share className="inline w-3.5 h-3.5 text-indigo-600 mx-0.5" />)을 누릅니다.</p>
                                </div>
                                <div className="flex items-start gap-2.5">
                                    <span className="w-5 h-5 rounded-full bg-indigo-100 text-indigo-700 font-black flex items-center justify-center shrink-0 text-[11px]">2</span>
                                    <p>스크롤을 내려 <strong>[홈 화면에 추가]</strong>(<PlusSquare className="inline w-3.5 h-3.5 text-indigo-600 mx-0.5" />) 항목을 누릅니다.</p>
                                </div>
                                <div className="flex items-start gap-2.5">
                                    <span className="w-5 h-5 rounded-full bg-indigo-100 text-indigo-700 font-black flex items-center justify-center shrink-0 text-[11px]">3</span>
                                    <p>우측 상단의 <strong>[추가]</strong>를 누르면 홈 화면에 KIS 통합 포털 앱이 생성됩니다.</p>
                                </div>
                            </div>
                        ) : (
                            <div className="space-y-3 text-xs text-slate-700 bg-slate-50 p-4 rounded-2xl border">
                                <div className="font-bold text-indigo-700 pb-1 border-b text-[13px] flex items-center gap-1.5">
                                    <span>🤖 안드로이드 (크롬 / 삼성인터넷) & PC 데스크톱</span>
                                </div>
                                <div className="flex items-start gap-2.5">
                                    <span className="w-5 h-5 rounded-full bg-indigo-100 text-indigo-700 font-black flex items-center justify-center shrink-0 text-[11px]">1</span>
                                    <p>브라우저 우측 상단 <strong>메뉴 [ ⋮ ]</strong> 또는 주소창 우측 <strong>설치 아이콘(⊕)</strong>을 누릅니다.</p>
                                </div>
                                <div className="flex items-start gap-2.5">
                                    <span className="w-5 h-5 rounded-full bg-indigo-100 text-indigo-700 font-black flex items-center justify-center shrink-0 text-[11px]">2</span>
                                    <p><strong>[앱 설치]</strong> 또는 <strong>[홈 화면에 추가]</strong>를 선택합니다.</p>
                                </div>
                                <div className="flex items-start gap-2.5">
                                    <span className="w-5 h-5 rounded-full bg-indigo-100 text-indigo-700 font-black flex items-center justify-center shrink-0 text-[11px]">3</span>
                                    <p>확인을 누르면 바탕화면/홈 화면에 KIS 통합 포털 앱이 바로 설치됩니다.</p>
                                </div>
                            </div>
                        )}

                        <Button 
                            className="w-full bg-indigo-600 hover:bg-indigo-700 font-bold text-xs h-10 rounded-xl"
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
