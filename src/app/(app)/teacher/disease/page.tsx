'use client';

import React, { Suspense, useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { Activity, ShieldCheck, HeartPulse } from 'lucide-react';
import { StaffDiseaseForm } from '@/components/teacher/disease/StaffDiseaseForm';
import { StaffDiseaseHistory } from '@/components/teacher/disease/StaffDiseaseHistory';
import { getMyStaffDiseaseReports, DiseaseRecord } from '@/lib/services/healthService';

function TeacherDiseaseContent() {
  const { user, profile } = useAuth();
  const [historyRecords, setHistoryRecords] = useState<DiseaseRecord[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(true);

  const userEmail = user?.email || profile?.email || '';
  const defaultName = profile?.name || user?.displayName || '';
  const rawDept = String((profile as any)?.department || (profile as any)?.dept || '');
  const defaultDepartment = rawDept.includes('중') || rawDept.includes('고')
    ? '중등'
    : rawDept.includes('행정') || rawDept.includes('실')
    ? '행정실'
    : '유초등';
  const defaultPosition = (profile as any)?.position || '교사';

  // 내 신고 내역 로드
  const loadHistory = useCallback(async () => {
    if (!userEmail) {
      setLoadingHistory(false);
      return;
    }
    setLoadingHistory(true);
    try {
      const records = await getMyStaffDiseaseReports(userEmail);
      setHistoryRecords(records);
    } catch (e) {
      console.error('Failed to load staff disease reports:', e);
    } finally {
      setLoadingHistory(false);
    }
  }, [userEmail]);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  return (
    <div className="flex-1 w-full h-full min-h-0 overflow-y-auto overscroll-contain">
      <div className="w-full max-w-5xl mx-auto px-3 sm:px-6 py-4 space-y-6 pb-32">
        {/* ── 1. 페이지 헤더 ── */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-gradient-to-r from-purple-500/10 via-indigo-500/5 to-transparent p-4 rounded-2xl border border-purple-200/50 shadow-2xs">
          <div>
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-xl bg-purple-600 text-white shadow-2xs">
                <HeartPulse className="w-5 h-5" />
              </div>
              <div>
                <h1 className="text-lg sm:text-xl font-black text-slate-900 tracking-tight">
                  교직원 건강/질병 신고
                </h1>
                <p className="text-xs text-slate-500 mt-0.5">
                  교원 및 행정 교직원의 법정 감염병 및 질병 발생을 신고하여 보건실과 공유하고 출근중지·병가를 지원합니다.
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-auto">
            <div className="text-xs bg-white px-3 py-1.5 rounded-lg border border-purple-200 shadow-2xs flex items-center gap-1.5 text-purple-900 font-semibold">
              <ShieldCheck className="w-4 h-4 text-purple-600" />
              보건실 연동 시스템
            </div>
          </div>
        </div>

        {/* ── 2. 질병 직접 신고서 작성 폼 ── */}
        <StaffDiseaseForm
          userEmail={userEmail}
          defaultName={defaultName}
          defaultDepartment={defaultDepartment}
          defaultPosition={defaultPosition}
          onSubmitted={loadHistory}
        />

        {/* ── 3. 나의 신고 내역 목록 ── */}
        <StaffDiseaseHistory
          records={historyRecords}
          loading={loadingHistory}
          onRefresh={loadHistory}
        />
      </div>
    </div>
  );
}

export default function TeacherDiseasePage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-xs text-muted-foreground">로딩 중...</div>}>
      <TeacherDiseaseContent />
    </Suspense>
  );
}
