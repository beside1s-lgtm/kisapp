'use client';

import { Button } from '@/components/ui/button';
import { 
  FileClock, 
  Inbox, 
  ListFilter, 
  Plus, 
  Send, 
  Undo2, 
  Users, 
  CalendarOff, 
  Backpack, 
  Briefcase, 
  Clock, 
  UserPlus, 
  CalendarCheck, 
  BookOpen, 
  Bus, 
  FileText, 
  XCircle, 
  Eye,
  ChevronDown,
  FileSignature,
  GraduationCap,
  Calendar,
  Download,
  Smartphone,
  Activity,
  Stethoscope,
  Users2
} from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';
import { useEffect, useState, useMemo } from 'react';
import { 
  getInboxDocuments, 
  getPendingDocuments, 
  getMyTeacherDocuments, 
  getParentServiceDocuments 
} from '@/lib/services/documentService';
import { onAfterschoolCoursesUpdate, onOrgStructureUpdate } from '@/lib/services/settingsService';
import { checkPeAccessPermission, checkHealthAccessPermission } from '@/lib/services/permissionService';
import type { Course } from '@/lib/afterschool/types';
import type { OrgStructure } from '@/lib/types';
import { cn } from '@/lib/utils';
import { Card } from '../ui/card';
import { useSidebar } from './sidebar-context';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';

type NavItemProps = {
  href: string;
  label: string;
  icon: React.ReactNode;
  count?: number;
  isSubItem?: boolean;
  badgeColor?: string;
};

const NavItem = ({ href, label, icon, count, isSubItem = false, badgeColor = "bg-destructive text-destructive-foreground" }: NavItemProps) => {
  const pathname = usePathname();
  const isActive = pathname === href;

  return (
    <Link
      href={href}
      className={cn(
        'flex items-center justify-between rounded-lg font-medium transition-all text-sm group',
        isSubItem ? 'py-2 px-2.5 text-xs sm:text-sm pl-3' : 'p-2.5',
        isActive
          ? 'bg-primary/10 text-primary font-bold shadow-xs'
          : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground'
      )}
    >
      <div className="flex items-center gap-2.5 min-w-0">
        <span className={cn(
          "transition-colors shrink-0", 
          isActive ? "text-primary" : "text-muted-foreground group-hover:text-foreground"
        )}>
          {icon}
        </span>
        <span className="truncate">{label}</span>
      </div>
      {count != null && count > 0 && (
        <span className={cn(
          "text-[11px] font-black px-1.5 py-0.5 min-w-5 h-5 flex items-center justify-center rounded-full shrink-0 shadow-xs animate-pulse",
          badgeColor
        )}>
          {count}
        </span>
      )}
    </Link>
  );
};

interface DropdownSectionProps {
  id: string;
  title: string;
  icon: React.ReactNode;
  badge?: number;
  showNewBadge?: boolean;
  isOpen: boolean;
  onToggle: () => void;
  hasActiveChild: boolean;
  children: React.ReactNode;
}

const DropdownSection = ({
  title,
  icon,
  badge,
  showNewBadge,
  isOpen,
  onToggle,
  hasActiveChild,
  children,
}: DropdownSectionProps) => {
  return (
    <Collapsible open={isOpen} onOpenChange={onToggle} className="w-full">
      <CollapsibleTrigger asChild>
        <button
          type="button"
          className={cn(
            'flex items-center justify-between w-full p-2.5 rounded-lg text-sm font-semibold transition-all select-none',
            hasActiveChild 
              ? 'text-primary bg-primary/5 hover:bg-primary/10' 
              : 'text-foreground/80 hover:bg-muted/70 hover:text-foreground'
          )}
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <span className={cn(
              "shrink-0",
              hasActiveChild ? "text-primary" : "text-muted-foreground"
            )}>
              {icon}
            </span>
            <span className="font-bold text-sm truncate">{title}</span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {/* 드롭다운이 닫혀 있을 때 빨간색 동그라미 안의 'N' 배지 표시 */}
            {!isOpen && showNewBadge && (
              <span className="w-5 h-5 rounded-full bg-red-600 text-white font-black text-[11px] flex items-center justify-center shadow-xs animate-pulse">
                N
              </span>
            )}
            {!isOpen && !showNewBadge && badge != null && badge > 0 && (
              <span className="bg-destructive text-destructive-foreground text-[10px] font-black px-1.5 py-0.5 rounded-full">
                {badge}
              </span>
            )}
            <ChevronDown
              size={16}
              className={cn(
                'text-muted-foreground transition-transform duration-200 ease-in-out',
                isOpen && 'rotate-180 text-foreground'
              )}
            />
          </div>
        </button>
      </CollapsibleTrigger>
      <CollapsibleContent className="data-[state=open]:animate-accordion-down data-[state=closed]:animate-accordion-up overflow-hidden">
        <div className="pl-3.5 pr-1 py-1 my-0.5 ml-2.5 border-l-2 border-border/60 space-y-0.5">
          {children}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
};

export default function AppSidebar() {
  const pathname = usePathname();
  const { user, profile, isParent } = useAuth();
  
  // 카운트 상태들
  const [inboxCount, setInboxCount] = useState(0);
  const [pendingCount, setPendingCount] = useState(0);
  const [teacherDutyCount, setTeacherDutyCount] = useState(0);
  const [parentAbsenceCount, setParentAbsenceCount] = useState(0);
  const [parentFieldTripCount, setParentFieldTripCount] = useState(0);
  
  // N 배지 확인 여부 관리 (드롭다운 열면 지워짐)
  const [hasApprovalNew, setHasApprovalNew] = useState(false);
  const [hasTeacherNew, setHasTeacherNew] = useState(false);

  // 방과후 강좌 목록 & 본인 강좌 상태
  const [myAfterschoolCourses, setMyAfterschoolCourses] = useState<Course[]>([]);
  // 조직도 및 담당 업무 상태
  const [orgStructure, setOrgStructure] = useState<Partial<OrgStructure> | null>(null);

  useEffect(() => {
    if (!user || isParent) return;
    const unsubOrg = onOrgStructureUpdate((org) => setOrgStructure(org));
    return () => unsubOrg();
  }, [user, isParent]);

  // 학교 체육 & 학생 건강 업무 접근 권한 판별
  const canAccessPe = useMemo(() => {
    return checkPeAccessPermission(user?.email, profile, orgStructure);
  }, [user?.email, profile, orgStructure]);

  const canAccessHealth = useMemo(() => {
    return checkHealthAccessPermission(user?.email, profile, orgStructure);
  }, [user?.email, profile, orgStructure]);

  // 담임 교사 또는 관리자 여부 판별 (담임 업무 바로가기 노출 조건)
  const isHomeroomTeacher = useMemo(() => {
    if (!user?.email || isParent) return false;
    if (profile?.isAdmin || profile?.role === '관리자' || profile?.role === 'admin') return true;
    if (!orgStructure?.homerooms) return false;
    const normalizedEmail = user.email.trim().toLowerCase();
    return Object.values(orgStructure.homerooms).some(
      (teacherEmail) => teacherEmail && teacherEmail.trim().toLowerCase() === normalizedEmail
    );
  }, [user?.email, isParent, profile, orgStructure]);

  useEffect(() => {
    if (!user || isParent) return;

    const unsub = onAfterschoolCoursesUpdate((allCourses) => {
      const currentTeacherName = (profile?.name || user?.displayName || '').trim();
      const currentTeacherId = user?.uid || '';

      const myCourses = (allCourses || []).filter((course) => {
        if (!course) return false;
        if (course.teacherId && course.teacherId === currentTeacherId) return true;
        if (currentTeacherName) {
          if (course.instructorName === currentTeacherName) return true;
          if (course.teacherName === currentTeacherName) return true;
          if (course.instructor2 === currentTeacherName || course.instructor3 === currentTeacherName || course.instructor4 === currentTeacherName) return true;
          if (Array.isArray(course.assistantTeachers) && course.assistantTeachers.includes(currentTeacherName)) return true;
        }
        return false;
      });
      setMyAfterschoolCourses(myCourses);
    });

    return () => unsub();
  }, [user, profile, isParent]);

  // 전용 앱(PWA Standalone 모드) 실행 여부 감지 (앱 실행 중에는 설치 버튼 자동 숨김)
  const [isStandalone, setIsStandalone] = useState(false);

  useEffect(() => {
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
    return () => mediaQuery.removeEventListener?.('change', handleDisplayModeChange);
  }, []);

  const handleInstallPwa = async () => {
    const globalPrompt = typeof window !== 'undefined' ? (window as any).__deferredPwaPrompt : null;
    if (globalPrompt) {
      globalPrompt.prompt();
      const { outcome } = await globalPrompt.userChoice;
      if (outcome === 'accepted') {
        (window as any).__deferredPwaPrompt = null;
        setIsStandalone(true);
      }
      return;
    }
    // 전역 PWA 이벤트 발송 (가이드 모달 오픈)
    window.dispatchEvent(new CustomEvent('trigger-pwa-install'));
  };

  const { isSidebarOpen } = useSidebar();

  // 섹션별 열림/닫힘 상태 관리 (기본적으로 닫힘 상태 유지)
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    approval: false,
    teacher: false,
    parents: false,
  });

  const toggleSection = (key: string) => {
    setOpenSections((prev) => {
      const nextState = !prev[key];
      // 사용자가 드롭다운을 열어 확인하면 'N' 배지 해제
      if (nextState) {
        if (key === 'approval') setHasApprovalNew(false);
        if (key === 'teacher') setHasTeacherNew(false);
      }
      return {
        ...prev,
        [key]: nextState,
      };
    });
  };

  // 하위 상세 문서함(상신함, 진행문서함 등)에 직접 진입했을 때만 열고, 대시보드(/inbox) 및 일반 진입 시에는 기본 닫힘 유지
  useEffect(() => {
    const isSpecificApprovalSubPath = [
      '/sent',
      '/pending',
      '/circular',
      '/recalled',
      '/rejected',
      '/registry',
      '/attendance-registry',
      '/field-trip-registry',
    ].some((p) => pathname === p || pathname?.startsWith(p + '/'));

    const isSpecificTeacherSubPath = [
      '/teacher/duty',
      '/teacher/overtime',
      '/teacher/substitution',
      '/teacher/registry',
    ].some((p) => pathname === p || pathname?.startsWith(p + '/'));

    if (isSpecificApprovalSubPath) {
      setHasApprovalNew(false);
      setOpenSections((prev) => ({ ...prev, approval: true }));
    }
    if (isSpecificTeacherSubPath) {
      setHasTeacherNew(false);
      setOpenSections((prev) => ({ ...prev, teacher: true }));
    }
  }, [pathname]);

  // 대시보드 문서 데이터 실시간 동기화하여 뱃지 수치 반영
  useEffect(() => {
    if (user?.email && user?.uid && !isParent) {
      const fetchCounts = async () => {
        try {
          const [inboxItems, pendingItems, teacherItems, parentItems] = await Promise.all([
            getInboxDocuments(user.email!, profile?.name),
            getPendingDocuments(user.uid, user.email!, profile?.name),
            getMyTeacherDocuments(user.email!),
            getParentServiceDocuments(user.email!, profile?.name),
          ]);

          const inboxLen = inboxItems?.length || 0;
          const pendingLen = pendingItems?.length || 0;
          const teacherLen = teacherItems?.length || 0;
          
          const absenceLen = (parentItems || []).filter(d => d.parentFormData?.type === 'absence').length;
          const tripLen = (parentItems || []).filter(d => d.parentFormData?.type !== 'absence').length;

          setInboxCount(inboxLen);
          setPendingCount(pendingLen);
          setTeacherDutyCount(teacherLen);
          setParentAbsenceCount(absenceLen);
          setParentFieldTripCount(tripLen);

          // 미결재 문서나 대기 문서가 있으면 'N' 배지 활성화 (현재 닫혀있는 경우)
          if (inboxLen > 0 || pendingLen > 0 || absenceLen > 0 || tripLen > 0) {
            setHasApprovalNew(true);
          }
          if (teacherLen > 0) {
            setHasTeacherNew(true);
          }
        } catch {
          setInboxCount(0);
        }
      };

      fetchCounts();
      const interval = setInterval(fetchCounts, 30000);
      return () => clearInterval(interval);
    }
  }, [user, profile, isParent]);

  // 방과후 바로가기 라벨 (본인의 강좌명 8자 제한 + 수업 관리, 강좌가 있는 경우만 노출)
  const afterschoolShortcutLabel = useMemo(() => {
    if (myAfterschoolCourses.length === 0) return null;
    const rawTitle = (myAfterschoolCourses[0].title || '방과후').trim();
    const shortTitle = rawTitle.length > 8 ? `${rawTitle.slice(0, 8)}...` : rawTitle;
    return `${shortTitle} 수업 관리`;
  }, [myAfterschoolCourses]);

  if (!isSidebarOpen) {
    return null;
  }

  // 각 섹션 활성 자식 유무 판별
  const isApprovalActive = [
    '/inbox',
    '/sent',
    '/pending',
    '/circular',
    '/recalled',
    '/rejected',
    '/registry',
    '/attendance-registry',
    '/field-trip-registry',
  ].some((p) => pathname === p || pathname?.startsWith(p + '/'));

  const isTeacherActive = pathname?.startsWith('/teacher');
  const isParentsActive = pathname?.startsWith('/parents');

  // 전자결재 총 대기 합계
  const totalApprovalBadge = inboxCount + pendingCount + parentAbsenceCount + parentFieldTripCount;

  return (
    <aside className="w-64 space-y-2.5 shrink-0 p-3 h-full max-h-full hidden lg:block overflow-y-auto pb-6 transition-all scrollbar-thin">
      {!isParent && (
        <Button
          asChild
          size="lg"
          className="w-full font-bold text-base h-11 rounded-xl shadow-md shadow-primary/20 hover:shadow-primary/30 transition-shadow"
        >
          <Link href="/new">
            <Plus className="mr-2 h-5 w-5" />
            신규 기안 작성
          </Link>
        </Button>
      )}

      <Card className="p-2 bg-card shadow-xs space-y-1.5 border-border/80">
        {!isParent ? (
          <>
            {/* 1. 전자결재 서비스 드롭다운 */}
            <DropdownSection
              id="approval"
              title="전자결재 서비스"
              icon={<FileSignature size={18} />}
              badge={totalApprovalBadge}
              showNewBadge={hasApprovalNew && !openSections.approval}
              isOpen={openSections.approval}
              onToggle={() => toggleSection('approval')}
              hasActiveChild={isApprovalActive}
            >
              <NavItem href="/inbox" label="미결재함" icon={<Inbox size={16} />} count={inboxCount} isSubItem badgeColor="bg-red-500 text-white" />
              <NavItem href="/sent" label="상신함" icon={<Send size={16} />} isSubItem />
              <NavItem href="/pending" label="진행 문서함" icon={<FileClock size={16} />} count={pendingCount} isSubItem badgeColor="bg-amber-500 text-white" />
              <NavItem href="/circular" label="공람 문서함" icon={<Eye size={16} />} isSubItem />
              <NavItem href="/recalled" label="회수 문서함" icon={<Undo2 size={16} />} isSubItem />
              <NavItem href="/rejected" label="반려 문서함" icon={<XCircle size={16} className="text-red-500" />} isSubItem />
              <div className="h-px bg-border/60 my-1"></div>
              <NavItem href="/registry" label="문서등록대장" icon={<ListFilter size={16} />} isSubItem />
              <NavItem href="/attendance-registry" label="결석계 보관함" icon={<CalendarCheck size={16} />} count={parentAbsenceCount} isSubItem badgeColor="bg-purple-600 text-white" />
              <NavItem href="/field-trip-registry" label="체험학습 문서함" icon={<FileText size={16} />} count={parentFieldTripCount} isSubItem badgeColor="bg-purple-600 text-white" />
            </DropdownSection>

            <div className="h-px bg-border/60 my-1 mx-1"></div>

            {/* 2. 교원 서비스 드롭다운 */}
            <DropdownSection
              id="teacher"
              title="교원 서비스"
              icon={<GraduationCap size={18} />}
              badge={teacherDutyCount}
              showNewBadge={hasTeacherNew && !openSections.teacher}
              isOpen={openSections.teacher}
              onToggle={() => toggleSection('teacher')}
              hasActiveChild={isTeacherActive}
            >
              <NavItem href="/teacher/duty" label="교원 복무" icon={<Briefcase size={16} />} count={teacherDutyCount} isSubItem badgeColor="bg-emerald-600 text-white" />
              <NavItem href="/teacher/overtime" label="초과근무" icon={<Clock size={16} />} isSubItem />
              <NavItem href="/teacher/substitution" label="보결 관리" icon={<UserPlus size={16} />} isSubItem />
              <NavItem href="/teacher/registry" label="교원 서비스 조회" icon={<ListFilter size={16} />} isSubItem />
            </DropdownSection>

            <div className="h-px bg-border/60 my-1 mx-1"></div>

            {/* 3. 자주 찾는 주요 연계 서비스 (방과후 강사 강좌, 스쿨버스, 통합학생관리 바로가기) */}
            <div className="pt-1.5 pb-1">
              <div className="text-[11px] font-extrabold text-slate-500 uppercase tracking-wider px-2.5 mb-1 flex items-center justify-between">
                <span>주요 바로가기</span>
              </div>
              <div className="space-y-1">
                {/* 담임 교사 및 관리자에게 노출: '담임 업무 (출결/체험 대리)' */}
                {isHomeroomTeacher && (
                  <Link
                    href="/teacher/homeroom"
                    className={cn(
                      "flex items-center justify-between p-2 rounded-xl text-xs font-bold transition-all group",
                      pathname?.startsWith('/teacher/homeroom')
                        ? "bg-amber-500/15 text-amber-900 font-black shadow-xs"
                        : "text-slate-700 hover:bg-amber-50 hover:text-amber-900"
                    )}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="p-1 rounded-lg bg-amber-500/10 text-amber-700 group-hover:bg-amber-600 group-hover:text-white transition-colors">
                        <Users2 size={14} />
                      </div>
                      <span className="truncate">담임 업무 (출결/체험 대리)</span>
                    </div>
                    <span className="text-[10px] text-amber-700 font-bold opacity-0 group-hover:opacity-100 transition-opacity">
                      이동
                    </span>
                  </Link>
                )}

                {/* 방과후학교 강사를 하고 있는 선생님에게만 노출: '(나의 강좌명) 수업 관리' */}
                {afterschoolShortcutLabel && (
                  <Link
                    href="/teacher/afterschool"
                    className={cn(
                      "flex items-center justify-between p-2 rounded-xl text-xs font-bold transition-all group",
                      pathname?.startsWith('/teacher/afterschool')
                        ? "bg-teal-500/15 text-teal-800 font-black shadow-xs"
                        : "text-slate-700 hover:bg-teal-50 hover:text-teal-800"
                    )}
                    title={myAfterschoolCourses[0]?.title ? `${myAfterschoolCourses[0].title} 수업 관리` : '방과후 수업 관리'}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="p-1 rounded-lg bg-teal-500/10 text-teal-600 group-hover:bg-teal-600 group-hover:text-white transition-colors">
                        <BookOpen size={14} />
                      </div>
                      <span className="truncate">{afterschoolShortcutLabel}</span>
                    </div>
                    <span className="text-[10px] text-teal-600 font-bold opacity-0 group-hover:opacity-100 transition-opacity">
                      →
                    </span>
                  </Link>
                )}

                <Link
                  href="/teacher/bus"
                  className={cn(
                    "flex items-center justify-between p-2 rounded-xl text-xs font-bold transition-all group",
                    pathname?.startsWith('/teacher/bus') || pathname?.startsWith('/admin/bus')
                      ? "bg-blue-500/15 text-blue-800 font-black shadow-xs"
                      : "text-slate-700 hover:bg-blue-50 hover:text-blue-800"
                  )}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="p-1 rounded-lg bg-blue-500/10 text-blue-600 group-hover:bg-blue-600 group-hover:text-white transition-colors">
                      <Bus size={14} />
                    </div>
                    <span className="truncate">스쿨버스 탑승 관리</span>
                  </div>
                  <span className="text-[10px] text-blue-600 font-bold opacity-0 group-hover:opacity-100 transition-opacity">
                    →
                  </span>
                </Link>

                {canAccessPe && (
                  <Link
                    href="/teacher/pe"
                    className={cn(
                      "flex items-center justify-between p-2 rounded-xl text-xs font-bold transition-all group",
                      pathname?.startsWith('/teacher/pe')
                        ? "bg-indigo-500/15 text-indigo-800 font-black shadow-xs"
                        : "text-slate-700 hover:bg-indigo-50 hover:text-indigo-800"
                    )}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="p-1 rounded-lg bg-indigo-500/10 text-indigo-600 group-hover:bg-indigo-600 group-hover:text-white transition-colors">
                        <Activity size={14} />
                      </div>
                      <span className="truncate">학교 체육 (PAPS)</span>
                    </div>
                    <span className="text-[10px] text-indigo-600 font-bold opacity-0 group-hover:opacity-100 transition-opacity">
                      →
                    </span>
                  </Link>
                )}

                {canAccessHealth && (
                  <Link
                    href="/teacher/health"
                    className={cn(
                      "flex items-center justify-between p-2 rounded-xl text-xs font-bold transition-all group",
                      pathname?.startsWith('/teacher/health')
                        ? "bg-emerald-500/15 text-emerald-800 font-black shadow-xs"
                        : "text-slate-700 hover:bg-emerald-50 hover:text-emerald-800"
                    )}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="p-1 rounded-lg bg-emerald-500/10 text-emerald-600 group-hover:bg-emerald-600 group-hover:text-white transition-colors">
                        <Stethoscope size={14} />
                      </div>
                      <span className="truncate">학생 건강 (보건실)</span>
                    </div>
                    <span className="text-[10px] text-emerald-600 font-bold opacity-0 group-hover:opacity-100 transition-opacity">
                      →
                    </span>
                  </Link>
                )}

                <Link
                  href="/admin/students"
                  className={cn(
                    "flex items-center justify-between p-2 rounded-xl text-xs font-bold transition-all group",
                    pathname?.startsWith('/admin/students')
                      ? "bg-purple-500/15 text-purple-800 font-black shadow-xs"
                      : "text-slate-700 hover:bg-purple-50 hover:text-purple-800"
                  )}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="p-1 rounded-lg bg-purple-500/10 text-purple-600 group-hover:bg-purple-600 group-hover:text-white transition-colors">
                      <Users size={14} />
                    </div>
                    <span className="truncate">통합 학생 계정 관리</span>
                  </div>
                  <span className="text-[10px] text-purple-600 font-bold opacity-0 group-hover:opacity-100 transition-opacity">
                    →
                  </span>
                </Link>
              </div>
            </div>
          </>
        ) : (
          /* 학부모 서비스 드롭다운 */
          <DropdownSection
            id="parents"
            title="학부모 서비스"
            icon={<Users size={18} />}
            isOpen={openSections.parents}
            onToggle={() => toggleSection('parents')}
            hasActiveChild={isParentsActive}
          >
            <NavItem href="/parents-absence" label="결석계 조회" icon={<CalendarOff size={16} />} isSubItem />
            <NavItem href="/parents-fieldtrip" label="체험학습 신청서 조회" icon={<Backpack size={16} />} isSubItem />
            <NavItem href="/parents/registry" label="출결/체험 내역 조회" icon={<ListFilter size={16} />} isSubItem />
            <NavItem href="/parents/afterschool" label="방과후학교" icon={<BookOpen size={16} />} isSubItem />
            <NavItem href="/parents/bus" label="스쿨버스" icon={<Bus size={16} />} isSubItem />
          </DropdownSection>
        )}

        {/* 4. 빠른 도구 (캘린더 동기화 & 전용 앱 설치 - 앱 실행 시 설치 버튼 자동 숨김) */}
        <div className="h-px bg-border/60 my-1 mx-1"></div>
        <div className="pt-1 pb-1">
          <div className="text-[11px] font-extrabold text-slate-500 uppercase tracking-wider px-2.5 mb-1">
            <span>빠른 도구</span>
          </div>
          <div className="space-y-1">
            <button
              type="button"
              onClick={() => window.dispatchEvent(new CustomEvent('openAcademicCalendarSyncModal'))}
              className="w-full flex items-center justify-between p-2 rounded-xl text-xs font-bold text-slate-700 hover:bg-indigo-50 hover:text-indigo-800 transition-all group select-none text-left"
            >
              <div className="flex items-center gap-2 min-w-0">
                <div className="p-1 rounded-lg bg-indigo-500/10 text-indigo-600 group-hover:bg-indigo-600 group-hover:text-white transition-colors">
                  <Calendar size={14} />
                </div>
                <span className="truncate">캘린더 동기화 열기</span>
              </div>
              <span className="text-[10px] text-indigo-600 font-bold opacity-0 group-hover:opacity-100 transition-opacity">
                연동
              </span>
            </button>

            {!isStandalone && (
              <button
                type="button"
                onClick={handleInstallPwa}
                className="w-full flex items-center justify-between p-2 rounded-xl text-xs font-bold text-slate-700 hover:bg-amber-50 hover:text-amber-900 transition-all group select-none text-left"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <div className="p-1 rounded-lg bg-amber-500/10 text-amber-600 group-hover:bg-amber-500 group-hover:text-white transition-colors">
                    <Download size={14} />
                  </div>
                  <span className="truncate">전용 앱 설치하기</span>
                </div>
                <span className="text-[9px] bg-amber-100 text-amber-800 font-black px-1.5 py-0.5 rounded-full">
                  설치
                </span>
              </button>
            )}
          </div>
        </div>
      </Card>
    </aside>
  );
}

