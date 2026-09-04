'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';
import { getAllMasterStudents } from '@/lib/services/masterStudentService';
import {
  getPeItems,
  getPeRecords,
  getPeTeamGroups,
  getPeSportsClubs,
  getPeStatistics,
} from '@/lib/services/peService';
import type {
  Student,
  MeasurementItem,
  MeasurementRecord,
  TeamGroup,
  SportsClub,
  ItemStatistics,
} from '@/lib/pe/types';

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import RecordInput from '@/components/pe/RecordInput';
import ClassAnalytics from '@/components/pe/ClassAnalytics';
import RecordBrowser from '@/components/pe/RecordBrowser';
import Ranking from '@/components/pe/Ranking';
import TournamentManagement from '@/components/pe/TournamentManagement';
import TeamBalancer from '@/components/pe/TeamBalancer';
import SportsClubManagement from '@/components/pe/SportsClubManagement';
import { PeEventManagement } from '@/components/pe/PeEventManagement';
import TheoryExamManagement from '@/components/pe/TheoryExamManagement';
import MeasurementManagement from '@/components/pe/MeasurementManagement';
import { getOrgStructure } from '@/lib/services/settingsService';
import { checkPeAccessPermission } from '@/lib/services/permissionService';
import type { OrgStructure } from '@/lib/types';
import {
  LineChart,
  BookOpen,
  Swords,
  Database,
  Activity,
  Bot,
  RefreshCw,
  ShieldAlert,
  Home,
  Settings2,
  Filter,
  ChevronUp,
  ChevronDown
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { AiIntelligenceCenterDialog } from '@/components/pe/AiIntelligenceCenterDialog';
import { cn } from '@/lib/utils';
import PeSettingsDialog from '@/components/pe/PeSettingsDialog';

function PeDashboardSkeleton() {
  return (
    <div className="container mx-auto p-4 space-y-4">
      <Skeleton className="h-14 w-full rounded-xl" />
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Skeleton className="h-10 w-full rounded-lg" />
        <Skeleton className="h-10 w-full rounded-lg" />
        <Skeleton className="h-10 w-full rounded-lg" />
        <Skeleton className="h-10 w-full rounded-lg" />
      </div>
      <Skeleton className="h-[400px] w-full rounded-2xl" />
    </div>
  );
}

export default function TeacherPePage() {
  const { user, profile } = useAuth();
  const school = 'KISH';
  const router = useRouter();

  const [data, setData] = useState<{
    students: Student[];
    items: MeasurementItem[];
    records: MeasurementRecord[];
    teams: TeamGroup[];
    clubs: SportsClub[];
    statistics: ItemStatistics[];
  }>({
    students: [],
    items: [],
    records: [],
    teams: [],
    clubs: [],
    statistics: [],
  });

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

  const hasPePermission = useMemo(() => {
    return checkPeAccessPermission(user?.email, profile, org);
  }, [user?.email, profile, org]);

  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('measurement');
  const [isAiCenterOpen, setIsAiCenterOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isHeaderCollapsed, setIsHeaderCollapsed] = useState(false);

  // 체육 교과 전담 교사의 담당 학년 설정 상태
  const [assignedGrades, setAssignedGrades] = useState<string[]>(() => {
    if (typeof window !== 'undefined' && user?.email) {
      try {
        const saved = localStorage.getItem(`pe_assigned_grades_${user.email}`);
        if (saved) return JSON.parse(saved);
      } catch (e) {}
    }
    return [];
  });

  // 사용자 프로필 로드 시 peAssignedGrades 동기화
  useEffect(() => {
    if (profile && (profile as any).peAssignedGrades && Array.isArray((profile as any).peAssignedGrades)) {
      setAssignedGrades((profile as any).peAssignedGrades);
    }
  }, [profile]);

  const CACHE_KEY = `pe_dash_cache_v4_${school}`;

  // 마스터 학생 및 체육 데이터 초고속 단계적 로드 (Progressive SWR Loading)
  const loadData = useCallback(async (force = false) => {
    // 1. 세션 캐시 즉각 복원 (0.05초 즉시 렌더링)
    if (!force) {
      try {
        const cached = sessionStorage.getItem(CACHE_KEY);
        if (cached) {
          const parsed = JSON.parse(cached);
          if (parsed && Array.isArray(parsed.students) && parsed.students.length > 0) {
            setData(parsed);
            setIsLoading(false);
          }
        }
      } catch (e) {}
    } else {
      setIsRefreshing(true);
    }

    try {
      // 1단계: 화면 구성에 필요한 핵심 필수 데이터(학생 목록 + 측정 종목) 우선 로드 (< 150ms)
      const [masterList, items] = await Promise.all([
        getAllMasterStudents(),
        getPeItems(school),
      ]);

      const peUuidToMasterIdMap = new Map<string, string>();
      masterList.forEach(s => {
        const masterId = s.id || s.studentId;
        if ((s as any).peStudentId) peUuidToMasterIdMap.set((s as any).peStudentId, masterId);
        peUuidToMasterIdMap.set(masterId, masterId);
      });

      const mappedStudents: Student[] = masterList.map(s => ({
        id: s.id || s.studentId,
        school: '호치민시한국국제학교',
        grade: String(s.grade || ''),
        classNum: String(s.classNum || (s as any).class || ''),
        studentNum: String(s.studentNum || (s as any).number || ''),
        name: s.nameKo || s.name,
        gender: (s.gender as string)?.toLowerCase() === 'female' || (s.gender as any) === '여' ? '여' : '남',
        accessCode: (s as any).studentCode || '',
        personalCode: (s as any).studentCode || '',
        photoUrl: s.photoUrl || (s as any).photo || '',
        peStudentId: (s as any).peStudentId || '',
      }));

      // 필수 기본 데이터가 확보되는 즉시 화면 렌더링 해제 (사용자가 즉시 UI 조작 가능)
      setData(prev => ({
        ...prev,
        students: mappedStudents,
        items,
      }));
      setIsLoading(false);

      // 2단계: 대용량 기록 및 부가 데이터(측정기록, 팀, 클럽, 통계)를 백그라운드에서 병렬 비동기 스트리밍 로드
      Promise.all([
        getPeRecords(school),
        getPeTeamGroups(school),
        getPeSportsClubs(school),
        getPeStatistics(school),
      ]).then(([rawRecords, teams, clubs, statistics]) => {
        const records = rawRecords.map(r => ({
          ...r,
          studentId: peUuidToMasterIdMap.get(r.studentId) || r.studentId
        }));

        setData(prev => {
          const fullData = {
            ...prev,
            records,
            teams,
            clubs,
            statistics,
          };
          // 백그라운드 로드 완료 후 세션 캐시 갱신
          try {
            sessionStorage.setItem(CACHE_KEY, JSON.stringify(fullData));
          } catch (e) {}
          return fullData;
        });
      }).catch(err => {
        console.error('Background PE secondary data load error:', err);
      });

    } catch (e) {
      console.error('Failed to load PE primary data:', e);
      setIsLoading(false);
    } finally {
      setIsRefreshing(false);
    }
  }, [school, CACHE_KEY]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // 기록 업데이트 핸들러
  const handleRecordUpdate = useCallback((recordsOrId?: MeasurementRecord[] | string, action: 'update' | 'delete' = 'update') => {
    setData(prev => {
      let updatedRecords = [...prev.records];
      if (action === 'delete') {
        const idToDelete = typeof recordsOrId === 'string' ? recordsOrId : '';
        updatedRecords = updatedRecords.filter(r => r.id !== idToDelete);
      } else if (Array.isArray(recordsOrId)) {
        const newRecordsMap = new Map(recordsOrId.map(r => [r.id, r]));
        const existingIds = new Set<string>();
        updatedRecords = updatedRecords.map(r => {
          if (newRecordsMap.has(r.id)) {
            existingIds.add(r.id);
            return newRecordsMap.get(r.id)!;
          }
          return r;
        });
        recordsOrId.forEach(r => {
          if (!existingIds.has(r.id)) {
            updatedRecords.push(r);
          }
        });
      }
      return { ...prev, records: updatedRecords };
    });
  }, []);

  const handleTeamGroupUpdate = useCallback((updatedGroup: TeamGroup) => {
    setData(prev => {
      const exists = prev.teams.some(t => t.id === updatedGroup.id);
      const newTeams = exists
        ? prev.teams.map(t => (t.id === updatedGroup.id ? updatedGroup : t))
        : [...prev.teams, updatedGroup];
      return { ...prev, teams: newTeams };
    });
  }, []);

  const handleTeamGroupDelete = useCallback((groupId: string) => {
    setData(prev => ({
      ...prev,
      teams: prev.teams.filter(t => t.id !== groupId),
    }));
  }, []);

  const handleClubUpdate = useCallback(() => {
    getPeSportsClubs(school).then(clubs => {
      setData(prev => ({ ...prev, clubs }));
    });
  }, [school]);

  const [mainCategory, setMainCategory] = useState<'measurement' | 'competition' | 'theory' | 'data'>('measurement');
  const [subCategory, setSubCategory] = useState<string>('input');

  const handleMainCategoryChange = (val: 'measurement' | 'competition' | 'theory' | 'data') => {
    setMainCategory(val);
    if (val === 'measurement') setSubCategory('input');
    else if (val === 'competition') setSubCategory('events');
    else if (val === 'theory') setSubCategory('theory');
    else if (val === 'data') setSubCategory('data');
  };

  const subOptions = useMemo(() => {
    switch (mainCategory) {
      case 'measurement':
        return [
          { value: 'input', label: '기록 입력' },
          { value: 'analysis', label: '성장 분석' },
          { value: 'browser', label: '기록 조회' },
          { value: 'ranking', label: '명예의 전당' },
        ];
      case 'competition':
        return [
          { value: 'events', label: '체육행사 기획 & 일정' },
          { value: 'tournament', label: '토너먼트/리그' },
          { value: 'balancer', label: '팀 밸런서' },
          { value: 'clubs', label: '스포츠클럽' },
        ];
      case 'theory':
        return [
          { value: 'theory', label: 'AI 문제 출제 및 배포' },
        ];
      case 'data':
        return [
          { value: 'data', label: '종목 및 PAPS 설정' },
        ];
      default:
        return [];
    }
  }, [mainCategory]);

  // 전체 사용 가능한 학년 목록
  const availableGrades = useMemo(() => {
    const set = new Set<string>();
    data.students.forEach(s => {
      if (s.grade) set.add(String(s.grade));
    });
    return Array.from(set).sort((a, b) => (parseInt(a) || 0) - (parseInt(b) || 0));
  }, [data.students]);

  // 체육 교사가 설정한 담당 학년의 학생만 필터링 (미설정 시 전체 학생)
  const filteredStudents = useMemo(() => {
    if (assignedGrades.length === 0) return data.students;
    return data.students.filter(s => assignedGrades.includes(String(s.grade)));
  }, [data.students, assignedGrades]);

  const handleTournamentUpdate = useCallback(() => {
    getPeTeamGroups(school).then(teams => {
      setData(prev => ({ ...prev, teams }));
    });
  }, [school]);

  if (isLoading || isOrgLoading) {
    return <PeDashboardSkeleton />;
  }

  if (!hasPePermission) {
    return (
      <div className="w-full max-w-2xl mx-auto py-12 px-4">
        <div className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 shadow-xs text-center space-y-4">
          <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 border border-amber-200 flex items-center justify-center mx-auto shadow-2xs">
            <ShieldAlert className="w-6 h-6" />
          </div>
          <div className="space-y-1.5">
            <h2 className="text-base sm:text-lg font-black text-slate-900">학교 체육 시스템 접근 권한 필요</h2>
            <p className="text-xs sm:text-sm text-slate-600 leading-relaxed max-w-md mx-auto">
              현재 계정({user?.email || '알 수 없음'})에는 학교 체육 성장 기록 시스템 담당 권한이 부여되어 있지 않습니다.
            </p>
          </div>
          <div className="bg-slate-50 rounded-xl p-3 text-left text-xs text-slate-600 space-y-1 border border-slate-200/70 max-w-md mx-auto">
            <p className="font-bold text-slate-800">권한 부여 안내:</p>
            <p>1. 관리자 메뉴의 [설정] &gt; [업무 담당 설정] 탭으로 이동</p>
            <p>2. [학교 체육 / 체육교사] 직책에 본인 계정을 배정</p>
            <p>3. 또는 소속 부서 관리에서 [학교체육] 업무 담당자로 배정</p>
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
    <div className="w-full max-w-7xl mx-auto px-2 sm:px-4 py-1 space-y-2 pb-1">
      {/* 1. 컴팩트 헤더: 제목 + 단계별 드롭다운 메뉴 + 설정/AI 액션 버튼 (직선 접기 지원) */}
      {isHeaderCollapsed ? (
        /* 접힘 상태: 얇은 직선 구분선 + 우측 아래 살짝 돌출된 수직 4mm 역세모(▼) 탭 */
        <div className="relative w-full pt-1 pb-2 group">
          <div className="h-[1.5px] w-full bg-slate-200 group-hover:bg-indigo-300 transition-colors rounded-full" />
          <button
            type="button"
            onClick={() => setIsHeaderCollapsed(false)}
            title="상단 메뉴 펼치기 (클릭)"
            className="absolute top-[3px] right-8 w-7 h-4 bg-white border border-slate-300 border-t-0 rounded-b-md shadow-2xs flex items-center justify-center text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 hover:border-indigo-400 transition-all cursor-pointer z-10"
          >
            <ChevronDown className="w-3.5 h-3.5 stroke-[2.5]" />
          </button>
        </div>
      ) : (
        /* 펼침 상태: 전체 컨트롤 바 */
        <div className="bg-white px-3.5 py-2.5 rounded-2xl border border-slate-200/90 shadow-xs transition-all flex flex-col md:flex-row items-start md:items-center justify-between gap-2.5">
            {/* 좌측: 타이틀 & 담당 학생수 요약 배지 */}
            <div className="flex items-center gap-2 shrink-0">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-600 to-indigo-800 flex items-center justify-center text-white shadow-xs">
                <Activity className="w-4 h-4" />
              </div>
              <div className="flex items-center gap-1.5 flex-wrap">
                <h1 className="text-sm sm:text-base font-black text-slate-900 whitespace-nowrap">학교 체육 성장 기록</h1>
                <Badge
                  variant="outline"
                  onClick={() => setIsSettingsOpen(true)}
                  className="text-[10px] font-bold text-indigo-700 bg-indigo-50 border-indigo-200 px-2 py-0.5 cursor-pointer hover:bg-indigo-100 transition-colors"
                  title="클릭하여 담당 학년 설정"
                >
                  {assignedGrades.length > 0 ? (
                    <>담당 {assignedGrades.join(',')}학년 ({filteredStudents.length}명 / 전체 {data.students.length}명)</>
                  ) : (
                    <>학생 {data.students.length}명 (전체)</>
                  )}
                </Badge>
              </div>
            </div>

            {/* 우측/중앙: 1단계 대메뉴 + 2단계 세부기능 드롭다운 + 설정/AI/새로고침/접기 버튼 */}
            <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap sm:flex-nowrap justify-start md:justify-end w-full md:w-auto">
              {/* 1단계 대메뉴 선택 */}
              <div className="flex items-center gap-1">
                <span className="text-[11px] font-bold text-slate-500 whitespace-nowrap hidden sm:inline">구분:</span>
                <Select value={mainCategory} onValueChange={(v) => handleMainCategoryChange(v as any)}>
                  <SelectTrigger className="w-[120px] sm:w-[130px] h-8 text-xs font-bold bg-slate-50 border-slate-300 focus:ring-1">
                    <SelectValue placeholder="메뉴 선택" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="measurement" className="text-xs font-bold">측정 & 분석</SelectItem>
                    <SelectItem value="competition" className="text-xs font-bold">체육행사 & 대회</SelectItem>
                    <SelectItem value="theory" className="text-xs font-bold">이론 평가</SelectItem>
                    <SelectItem value="data" className="text-xs font-bold">종목 관리</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* 2단계 세부기능 선택 */}
              <div className="flex items-center gap-1">
                <span className="text-[11px] font-bold text-slate-500 whitespace-nowrap hidden sm:inline">기능:</span>
                <Select value={subCategory} onValueChange={setSubCategory}>
                  <SelectTrigger className="w-[125px] sm:w-[145px] h-8 text-xs font-bold bg-indigo-50/70 border-indigo-200 text-indigo-900 focus:ring-1">
                    <SelectValue placeholder="세부 기능" />
                  </SelectTrigger>
                  <SelectContent>
                    {subOptions.map(opt => (
                      <SelectItem key={opt.value} value={opt.value} className="text-xs font-bold">
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* 담당 학년 설정 버튼 */}
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsSettingsOpen(true)}
                className="h-8 px-2.5 text-xs font-bold text-indigo-700 bg-indigo-50/60 border-indigo-200 hover:bg-indigo-100 shrink-0 flex items-center gap-1"
                title="체육 교과 담당 학년 설정"
              >
                <Settings2 className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">담당 설정</span>
              </Button>

              {/* AI 인텔리전스 센터 */}
              <Button
                variant="default"
                size="sm"
                onClick={() => setIsAiCenterOpen(true)}
                className="h-8 px-2.5 bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-700 hover:to-indigo-800 text-white font-bold rounded-lg shadow-xs text-xs flex items-center gap-1 shrink-0 ml-auto md:ml-0"
              >
                <Bot className="w-3.5 h-3.5 text-amber-300" />
                <span className="hidden lg:inline">AI 인텔리전스</span>
                <span className="lg:hidden">AI</span>
              </Button>

              {/* 새로고침 */}
              <Button
                variant="outline"
                size="sm"
                onClick={() => loadData(true)}
                disabled={isRefreshing}
                className="h-8 px-2 text-xs text-slate-700 border-slate-200 shrink-0"
                title="데이터 새로고침"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
              </Button>

              {/* 리본 숨기기 (접기) 버튼 */}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsHeaderCollapsed(true)}
                className="h-8 px-2 text-xs text-slate-500 hover:text-slate-900 hover:bg-slate-100 shrink-0"
                title="상단 메뉴 접기 (화면 세로 공간 확보)"
              >
                <ChevronUp className="w-4 h-4" />
              </Button>
            </div>
          </div>
        )}

      {/* 2. 메인 작업 영역 (담당 학년 필터링된 학생 데이터 전달) */}
      <div className="w-full">
        {mainCategory === 'measurement' && subCategory === 'input' && (
          <RecordInput
            allStudents={filteredStudents}
            allItems={data.items}
            allRecords={data.records}
            onRecordUpdate={handleRecordUpdate}
            allTeamGroups={data.teams}
            sportsClubs={data.clubs}
          />
        )}
        {mainCategory === 'measurement' && subCategory === 'analysis' && (
          <ClassAnalytics
            allStudents={filteredStudents}
            allItems={data.items}
            allRecords={data.records}
            onRecordUpdate={handleRecordUpdate}
            sportsClubs={data.clubs}
          />
        )}
        {mainCategory === 'measurement' && subCategory === 'browser' && (
          <RecordBrowser
            allStudents={filteredStudents}
            allItems={data.items}
            allRecords={data.records}
            sportsClubs={data.clubs}
          />
        )}
        {mainCategory === 'measurement' && subCategory === 'ranking' && (
          <Ranking
            allStudents={filteredStudents}
            allItems={data.items}
            allRecords={data.records}
            sportsClubs={data.clubs}
          />
        )}

        {mainCategory === 'competition' && subCategory === 'events' && (
          <PeEventManagement allStudents={data.students} />
        )}

        {mainCategory === 'competition' && subCategory === 'tournament' && (
          <TournamentManagement
            allTeamGroups={data.teams}
            allStudents={data.students}
            onTournamentUpdate={handleTournamentUpdate}
          />
        )}
        {mainCategory === 'competition' && subCategory === 'balancer' && (
          <TeamBalancer
            allStudents={filteredStudents}
            allItems={data.items}
            allRecords={data.records}
            teamGroups={data.teams}
            onTeamGroupUpdate={handleTeamGroupUpdate}
            onTeamGroupDelete={handleTeamGroupDelete}
            sportsClubs={data.clubs}
          />
        )}
        {mainCategory === 'competition' && subCategory === 'clubs' && (
          <SportsClubManagement
            allStudents={data.students}
            sportsClubs={data.clubs}
            onClubUpdate={handleClubUpdate}
          />
        )}

        {mainCategory === 'theory' && (
          <TheoryExamManagement allStudents={data.students} sportsClubs={data.clubs} />
        )}

        {mainCategory === 'data' && (
          <MeasurementManagement
            items={data.items}
            onItemsUpdate={(newItems) => setData(prev => ({ ...prev, items: newItems }))}
          />
        )}
      </div>

      {/* 체육 교과 담당 학년 설정 다이얼로그 */}
      <PeSettingsDialog
        isOpen={isSettingsOpen}
        onOpenChange={setIsSettingsOpen}
        userEmail={user?.email}
        assignedGrades={assignedGrades}
        onSaveAssignedGrades={setAssignedGrades}
        availableGrades={availableGrades}
        totalStudentCount={data.students.length}
      />

      {/* AI 인텔리전스 센터 다이얼로그 */}
      <AiIntelligenceCenterDialog
        open={isAiCenterOpen}
        onOpenChange={setIsAiCenterOpen}
        allStudents={filteredStudents}
        items={data.items}
        records={data.records}
        statistics={data.statistics}
        sportsClubs={data.clubs}
      />
    </div>
  );
}
