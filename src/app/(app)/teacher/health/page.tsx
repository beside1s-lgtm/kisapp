'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { getAllMasterStudents } from '@/lib/services/masterStudentService';
import { getPeItems, getPeRecords } from '@/lib/services/peService';
import { getAllHealthStudentRecords } from '@/lib/services/healthService';
import type { Student, MeasurementItem, MeasurementRecord } from '@/lib/pe/types';
import { getOrgStructure } from '@/lib/services/settingsService';
import { checkHealthAccessPermission } from '@/lib/services/permissionService';
import type { OrgStructure } from '@/lib/types';
import { useRouter } from 'next/navigation';
import { HeartPulse, RefreshCw, Loader2, ShieldCheck, Stethoscope, ShieldAlert, Home } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';

function HealthDashboardSkeleton() {
  return (
    <div className="container mx-auto p-4 space-y-4">
      <Skeleton className="h-14 w-full rounded-xl" />
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Skeleton className="h-10 w-full rounded-lg" />
        <Skeleton className="h-10 w-full rounded-lg" />
        <Skeleton className="h-10 w-full rounded-lg" />
      </div>
      <Skeleton className="h-[500px] w-full rounded-2xl" />
    </div>
  );
}

export default function TeacherHealthPage() {
  const { user, profile } = useAuth();
  const school = 'KISH';
  const router = useRouter();

  const [students, setStudents] = useState<Student[]>([]);
  const [items, setItems] = useState<MeasurementItem[]>([]);
  const [records, setRecords] = useState<MeasurementRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const [org, setOrg] = useState<Partial<OrgStructure> | null>(null);
  const [isOrgLoading, setIsOrgLoading] = useState(true);

  // 조직도 및 담당 업무 로드
  useEffect(() => {
    getOrgStructure().then(data => {
      setOrg(data || null);
      setIsOrgLoading(false);
    }).catch(() => {
      setIsOrgLoading(false);
    });
  }, []);

  const hasHealthPermission = useMemo(() => {
    return checkHealthAccessPermission(user?.email, profile, org);
  }, [user?.email, profile, org]);

  const CACHE_KEY = `health_dash_cache_v3_${school}`;

  const loadData = useCallback(async (force = false) => {
    // 1. 캐시 복원
    if (!force) {
      try {
        const cached = sessionStorage.getItem(CACHE_KEY);
        if (cached) {
          const parsed = JSON.parse(cached);
          if (parsed && Array.isArray(parsed.students) && parsed.students.length > 0) {
            setStudents(parsed.students);
            setItems(parsed.items || []);
            setRecords(parsed.records || []);
            setIsLoading(false);
          }
        }
      } catch (e) {}
    } else {
      setIsRefreshing(true);
    }

    try {
      // 1단계: 마스터 학생 명단(1,006명) 및 기본 측정 종목 우선 초고속 로드 (< 150ms)
      const [masterList, peItems] = await Promise.all([
        getAllMasterStudents(),
        getPeItems(school),
      ]);

      const baseStudents: Student[] = masterList.map(s => ({
        id: s.id || s.studentId,
        school: '호치민시한국국제학교',
        grade: String(s.grade || ''),
        classNum: String(s.classNum || (s as any).class || ''),
        studentNum: String(s.studentNum || (s as any).number || ''),
        name: s.nameKo || s.name,
        gender: s.gender === 'Female' || s.gender === 'female' || (s.gender as any) === '여' ? '여' : '남',
        accessCode: (s as any).studentCode || '',
        personalCode: (s as any).studentCode || '',
        photoUrl: (s as any).photoUrl || '',
        officialSchoolName: '호치민시한국국제학교',
      }));

      // 1차 학생 명단으로 UI 즉시 표시 (스켈레톤 해제)
      setStudents(baseStudents);
      setItems(peItems);
      setIsLoading(false);

      // 2단계: 건강기록부 상세 맵 및 PAPS 측정 기록 백그라운드 비동기 스트리밍 병합
      Promise.all([
        getAllHealthStudentRecords(),
        getPeRecords(school),
      ]).then(([healthRecordsMap, peRecords]) => {
        setRecords(peRecords);
        setStudents(prev => {
          const merged = prev.map(s => {
            const hData = healthRecordsMap[s.id] || {};
            return {
              ...s,
              residentRegistrationNumber: hData.residentRegistrationNumber,
              guardianName: hData.guardianName,
              bloodType: hData.bloodType,
              officialSchoolName: hData.officialSchoolName || '호치민시한국국제학교',
              teacherName: hData.teacherName,
              schoolHistory: hData.schoolHistory || [],
              preSchoolImmunizations: hData.preSchoolImmunizations || {},
              postSchoolImmunizations: hData.postSchoolImmunizations || [],
              healthExams: hData.healthExams || {},
              otherExams: hData.otherExams || [],
            };
          });

          // 캐시 갱신
          try {
            sessionStorage.setItem(CACHE_KEY, JSON.stringify({
              students: merged,
              items: peItems,
              records: peRecords,
            }));
          } catch (e) {}

          return merged;
        });
      }).catch(err => {
        console.error('Background health records fetch error:', err);
      });

    } catch (e) {
      console.error('Failed to load Health primary data:', e);
      setIsLoading(false);
    } finally {
      setIsRefreshing(false);
    }
  }, [school, CACHE_KEY]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  if (isLoading || isOrgLoading) {
    return <HealthDashboardSkeleton />;
  }

  if (!hasHealthPermission) {
    return (
      <div className="w-full max-w-2xl mx-auto py-12 px-4">
        <div className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 shadow-xs text-center space-y-4">
          <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 border border-amber-200 flex items-center justify-center mx-auto shadow-2xs">
            <ShieldAlert className="w-6 h-6" />
          </div>
          <div className="space-y-1.5">
            <h2 className="text-base sm:text-lg font-black text-slate-900">학생 건강기록부(보건실) 접근 권한 필요</h2>
            <p className="text-xs sm:text-sm text-slate-600 leading-relaxed max-w-md mx-auto">
              현재 계정({user?.email || '알 수 없음'})에는 보건실 및 학생 건강기록부 관리 권한이 부여되어 있지 않습니다.
            </p>
          </div>
          <div className="bg-slate-50 rounded-xl p-3 text-left text-xs text-slate-600 space-y-1 border border-slate-200/70 max-w-md mx-auto">
            <p className="font-bold text-slate-800">권한 부여 안내:</p>
            <p>1. 관리자 메뉴의 [설정] &gt; [업무 담당 설정] 탭으로 이동</p>
            <p>2. [보건교사 / 학생 건강] 직책에 본인 계정을 배정</p>
            <p>3. 또는 소속 부서 관리에서 [보건교사] 업무 담당자로 배정</p>
          </div>
          <div className="pt-2 flex justify-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => router.push('/inbox')}
              className="text-xs font-bold"
            >
              <Home className="w-3.5 h-3.5 mr-1" />
              메인으로 이동
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-7xl mx-auto px-2 sm:px-6 py-2 space-y-4 pb-28">
      {/* 1. 보건실 상단 타이틀 & 액션 바 */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-white p-3.5 sm:p-4 rounded-2xl border border-slate-200/80 shadow-xs">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-700 flex items-center justify-center text-white shadow-md">
            <Stethoscope className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base sm:text-lg font-black text-slate-900">학생 건강기록부 및 보건 관리</h1>
              <Badge variant="outline" className="text-[10px] font-bold text-emerald-700 bg-emerald-50 border-emerald-200">
                보건실 전용
              </Badge>
            </div>
            <p className="text-xs text-slate-500 font-medium">
              등록 학생 {students.length}명 · PAPS 신체능력 실시간 연동 · 법정 예방접종 및 검진 관리
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
          <Button
            variant="outline"
            size="sm"
            onClick={() => loadData(true)}
            disabled={isRefreshing}
            className="h-8 px-2.5 text-xs text-slate-700 border-slate-200"
          >
            <RefreshCw className={`w-3.5 h-3.5 mr-1 ${isRefreshing ? 'animate-spin' : ''}`} />
            새로고침
          </Button>
        </div>
      </div>

      {/* 2. 학생 건강기록부 메인 관리 컴포넌트 */}
      <HealthRecordManagement
        students={students}
        items={items}
        records={records}
        onUpdate={() => loadData(true)}
      />
    </div>
  );
}
