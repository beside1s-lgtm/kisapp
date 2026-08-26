'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { CalendarCheck, Search, ArrowLeft, Home } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { getDocConfig } from '@/lib/services/settingsService';
import { DocConfig } from '@/lib/types';
import { ParentBusFareModal } from '@/components/bus/parent-bus-fare-modal';

export default function ParentsBusIndexPage() {
  const router = useRouter();
  const [config, setConfig] = useState<DocConfig | null>(null);

  useEffect(() => {
    getDocConfig().then(cfg => setConfig(cfg));
  }, []);

  return (
    <div className="max-w-4xl mx-auto py-3 px-2 sm:py-8 sm:px-4 space-y-3 sm:space-y-6">
      {/* 통일된 상단 네비게이션 헤더 */}
      <div className="flex items-center gap-1.5 sm:gap-2 print:hidden">
        <Button variant="outline" size="sm" className="h-8 sm:h-9 text-xs sm:text-sm bg-white hover:bg-slate-50 text-muted-foreground hover:text-foreground shadow-xs" onClick={() => router.back()}>
          <ArrowLeft className="mr-1.5 h-3.5 w-3.5 sm:h-4 sm:w-4" />
          뒤로가기
        </Button>
        <Button variant="outline" size="sm" className="h-8 sm:h-9 text-xs sm:text-sm bg-white hover:bg-slate-50 text-muted-foreground hover:text-foreground shadow-xs" onClick={() => router.push('/parents')}>
          <Home className="mr-1.5 h-3.5 w-3.5 sm:h-4 sm:w-4" />
          홈
        </Button>
      </div>

      <div className="bg-white p-3.5 sm:p-6 rounded-xl sm:rounded-2xl border shadow-xs sm:shadow-sm mb-3 sm:mb-6">
        <h1 className="text-lg sm:text-2xl font-bold font-headline text-slate-800">스쿨버스 서비스</h1>
        <p className="text-xs sm:text-sm text-muted-foreground mt-0.5 sm:mt-1">
          자녀의 스쿨버스 탑승 신청을 진행하거나, 배정된 노선 및 좌석 정보를 실시간으로 확인합니다.
        </p>
      </div>

      <div className="grid gap-3 sm:gap-6 md:grid-cols-2">
        {/* 탑승 신청 카드 */}
        <Card className={`hover:shadow-lg transition-all duration-300 hover:-translate-y-1 ${config?.isBusApplyActive ? 'border-amber-200 bg-amber-50/10' : 'border-slate-200 opacity-80'}`}>
          <CardHeader className="p-3.5 sm:p-6">
            <CardTitle className="flex items-center gap-2 text-base sm:text-xl text-amber-600 font-headline">
              <CalendarCheck className="h-5 w-5 sm:h-6 sm:w-6 text-amber-500" />
              스쿨버스 탑승 신청
            </CardTitle>
            <CardDescription className="text-xs sm:text-sm mt-1">
              정규 학기 등하교 버스 및 토요 방과후학교 버스 탑승 신청을 작성합니다.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-3.5 sm:p-6 pt-0 sm:pt-0 space-y-3 sm:space-y-4">
            {config?.isBusApplyActive ? (
              <Button className="w-full font-bold bg-amber-600 hover:bg-amber-700 text-white shadow-xs sm:shadow-md transition-all h-9 sm:h-10 text-xs sm:text-sm" asChild>
                <Link href="/parents/bus/apply">탑승 신청하기</Link>
              </Button>
            ) : (
              <div className="space-y-2">
                <Button className="w-full font-bold text-muted-foreground bg-slate-100 cursor-not-allowed h-9 sm:h-10 text-xs sm:text-sm" variant="secondary" disabled>
                  탑승 신청 (기간 종료)
                </Button>
                <p className="text-xs text-amber-600 text-center font-medium bg-amber-50 border border-amber-200/50 py-1.5 rounded-lg">
                  ※ 현재는 스쿨버스 탑승 신청 기간이 아닙니다.
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* 자녀 탑승 조회 카드 */}
        <Card className="hover:shadow-lg transition-all duration-300 hover:-translate-y-1 border-blue-200 bg-blue-50/10">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-xl text-blue-600 font-headline">
              <Search className="h-6 w-6 text-blue-500" />
              자녀 탑승 조회
            </CardTitle>
            <CardDescription className="text-sm">
              자녀의 노선 배정 결과, 좌석 번호, 등하교 탑승 여부를 실시간으로 조회합니다.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button className="w-full font-bold bg-blue-600 hover:bg-blue-700 text-white shadow-md transition-all" asChild>
              <Link href="/parents/bus/student">탑승 정보 조회</Link>
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* 스쿨버스 분기 요금 청구서 팝업 */}
      <ParentBusFareModal />
    </div>
  );
}

