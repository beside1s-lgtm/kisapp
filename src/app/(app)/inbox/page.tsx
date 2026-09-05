'use client';

import {
  getInboxDocuments,
  getPendingDocuments,
  getMyTeacherDocuments,
  getParentServiceDocuments,
  getTeacherDutyStats,
  getOvertimeStatsByYear,
} from "@/lib/services/documentService";
import { saveUserProfile, getUsersDirectory } from "@/lib/services/userService";
import {
  getOrgStructure, 
  onAfterschoolCoursesUpdate, 
  onAfterschoolEnrollmentsUpdate, 
  onAfterschoolTimerUpdate,
  onDocConfigUpdate
} from "@/lib/services/settingsService";
import { 
  onDepartmentTasksUpdate 
} from "@/lib/services/departmentTaskService";
import {
  onDepartmentWeeklySchedulesUpdate,
  deleteDepartmentWeeklySchedule,
  onWeeklyProposalsUpdate,
  deleteWeeklyProposal
} from "@/lib/services/departmentWeeklyScheduleService";
import { formatToDateStr, DEFAULT_ACADEMIC_CALENDAR_CONFIG } from "@/lib/services/academicCalendarService";
import { DocumentList } from "@/components/document-list";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { ApprovalDoc, DepartmentTask, DepartmentWeeklySchedule, DepartmentWeeklyProposal, AcademicEvent } from "@/lib/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Inbox, Send, Briefcase, Users, Loader2, Clock, BookOpen, Bus, 
  ShieldAlert, Navigation, Calendar, CalendarDays, CalendarPlus, CalendarCheck, ClipboardList, CheckCircle2, 
  Plus, Trash2, CheckSquare, Sparkles, Building2, School, FileUp, 
  FileText, FolderOpen, ArrowRight, ArrowLeft, AlertCircle, CheckCircle, UserCheck, Lock, Eye, MessageSquare,
  SlidersHorizontal
} from "lucide-react";
import { useEffect, useState, useMemo } from "react";
import { cn } from "@/lib/utils";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { CreateDepartmentTaskDialog } from "@/components/tasks/create-department-task-dialog";
import { CreateWeeklyScheduleDialog } from "@/components/tasks/create-weekly-schedule-dialog";
import { CreateWeeklyProposalDialog } from "@/components/tasks/create-weekly-proposal-dialog";
import { ReviewWeeklyProposalDialog } from "@/components/tasks/review-weekly-proposal-dialog";
import { SubmitDepartmentTaskDialog } from "@/components/tasks/submit-department-task-dialog";
import { TaskSubmissionsDialog } from "@/components/tasks/task-submissions-dialog";
import { 
  MajorTasksModal, 
  ALL_MAJOR_TASKS, 
  getSavedMajorTaskIds, 
  MajorTaskDefinition 
} from "@/components/dashboard/major-tasks-modal";
import { MainLayout } from "@/components/layout/main-layout";
import { WeeklyEducationPlanModal } from "@/components/tasks/weekly-education-plan-modal";
import { MonthlyEducationPlanModal } from "@/components/tasks/monthly-education-plan-modal";
import { ScheduleCalendarSyncModal } from "@/components/tasks/schedule-calendar-sync-modal";
import { generateAssignedTasksIcs, downloadIcsFile } from "@/lib/services/calendarExportService";

// ─── 순수 SVG 막대 차트 컴포넌트 ─────────────────────────────────────
function OvertimeBarChart({ data }: { data: { month: string; hours: number }[] }) {
  const maxHours = Math.max(...data.map(d => d.hours), 1);
  const totalHours = parseFloat(data.reduce((s, d) => s + d.hours, 0).toFixed(1));
  const activeMonths = data.filter(d => d.hours > 0).length;

  // 현재 월까지만 표시 (미래 달은 0으로 두되, 회색으로)
  const currentMonth = new Date().getMonth(); // 0-based

  return (
    <div className="space-y-3">
      {/* 요약 수치 */}
      <div className="flex items-center gap-6 flex-wrap">
        <div>
          <span className="text-2xl font-black text-violet-600">{totalHours}</span>
          <span className="text-sm text-muted-foreground ml-1">시간 (연누계)</span>
        </div>
        <div>
          <span className="text-lg font-bold text-violet-400">{activeMonths}</span>
          <span className="text-sm text-muted-foreground ml-1">개월 실적</span>
        </div>
        {activeMonths > 0 && (
          <div>
            <span className="text-lg font-bold text-violet-400">
              {parseFloat((totalHours / activeMonths).toFixed(1))}
            </span>
            <span className="text-sm text-muted-foreground ml-1">시간/월 평균</span>
          </div>
        )}
      </div>

      {/* 막대 차트 */}
      <div className="flex items-end gap-1 h-28 w-full">
        {data.map((d, i) => {
          const barHeightPct = maxHours > 0 ? (d.hours / maxHours) * 100 : 0;
          const isFuture = i > currentMonth;
          const isCurrent = i === currentMonth;
          return (
            <div key={d.month} className="flex flex-col items-center gap-1 flex-1 h-full justify-end group relative">
              {/* 툴팁 */}
              {d.hours > 0 && (
                <div className="absolute bottom-full mb-1 left-1/2 -translate-x-1/2 bg-foreground text-background text-[10px] font-bold px-1.5 py-0.5 rounded whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
                  {d.hours}h
                </div>
              )}
              {/* 막대 */}
              <div
                className={cn(
                  "w-full rounded-t-sm transition-all duration-500",
                  isFuture
                    ? "bg-muted"
                    : isCurrent && d.hours > 0
                    ? "bg-violet-500 ring-2 ring-violet-300"
                    : d.hours > 0
                    ? "bg-violet-400 hover:bg-violet-500"
                    : "bg-muted/50"
                )}
                style={{ height: `${Math.max(barHeightPct, d.hours > 0 ? 4 : 0)}%` }}
              />
            </div>
          );
        })}
      </div>

      {/* 월 레이블 */}
      <div className="flex gap-1 w-full">
        {data.map((d, i) => (
          <div
            key={d.month}
            className={cn(
              "flex-1 text-center text-[10px] font-medium",
              i === currentMonth ? "text-violet-600 font-bold" : "text-muted-foreground"
            )}
          >
            {d.month.replace('월', '')}
          </div>
        ))}
      </div>
    </div>
  );
}
// ─────────────────────────────────────────────────────────────────────

export default function InboxPage() {
    const { user, profile, isParent } = useAuth();
    const router = useRouter();
    const { toast } = useToast();
    
    // 학생/학부모 계정 접근 차단 가드 (학생/학부모는 /parents 포털로 자동 안내)
    useEffect(() => {
        if (profile || user) {
            const isStudentOrParent = isParent || profile?.role === '학부모' || profile?.role === '학생';
            if (isStudentOrParent) {
                router.replace('/parents');
            }
        }
    }, [user, profile, isParent, router]);
    
    const [inboxDocs, setInboxDocs] = useState<ApprovalDoc[]>([]);
    const [pendingDocs, setPendingDocs] = useState<ApprovalDoc[]>([]);
    const [teacherDocs, setTeacherDocs] = useState<ApprovalDoc[]>([]);
    const [parentDocs, setParentDocs] = useState<ApprovalDoc[]>([]);
    const [dutyStats, setDutyStats] = useState<any>(null);
    const [overtimeChart, setOvertimeChart] = useState<{ month: string; hours: number }[]>([]);
    
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState("inbox");

    // 조직 및 권한 분기용 상태
    const [orgData, setOrgData] = useState<any>(null);
    const [isBusManager, setIsBusManager] = useState(false);
    const [isAfterschoolManager, setIsAfterschoolManager] = useState(false);
    const [isBusDialogOpen, setIsBusDialogOpen] = useState(false);
    const [isAfterschoolDialogOpen, setIsAfterschoolDialogOpen] = useState(false);

    // 부서 및 학년 업무 할당/제출 워크플로우 상태
    const [deptTasks, setDeptTasks] = useState<DepartmentTask[]>([]);
    const [allFaculty, setAllFaculty] = useState<Array<{ email: string; name: string; dept?: string }>>([]);
    const [isCreateTaskOpen, setIsCreateTaskOpen] = useState(false);
    const [submittingTask, setSubmittingTask] = useState<DepartmentTask | null>(null);
    const [viewingSubmissionsTask, setViewingSubmissionsTask] = useState<DepartmentTask | null>(null);
    const [activeTaskSubTab, setActiveTaskSubTab] = useState<'assigned' | 'created'>('assigned');

    // 부서 주간 일정 및 학사 일정 연동 상태
    const [weeklySchedules, setWeeklySchedules] = useState<DepartmentWeeklySchedule[]>([]);
    const [academicEvents, setAcademicEvents] = useState<AcademicEvent[]>([]);
    const [isCreateWeeklyScheduleOpen, setIsCreateWeeklyScheduleOpen] = useState(false);
    const [isWeeklyPlanModalOpen, setIsWeeklyPlanModalOpen] = useState(false);
    const [isMonthlyPlanModalOpen, setIsMonthlyPlanModalOpen] = useState(false);
    const [isScheduleSyncModalOpen, setIsScheduleSyncModalOpen] = useState(false);

    // 부서원 주간 일정 제안 상태
    const [weeklyProposals, setWeeklyProposals] = useState<DepartmentWeeklyProposal[]>([]);
    const [isCreateProposalOpen, setIsCreateProposalOpen] = useState(false);
    const [reviewingProposal, setReviewingProposal] = useState<DepartmentWeeklyProposal | null>(null);

    // 방과후학교 실시간 단계 연동 상태
    const [afterschoolCourses, setAfterschoolCourses] = useState<any[]>([]);
    const [afterschoolEnrollments, setAfterschoolEnrollments] = useState<any[]>([]);
    const [afterschoolTimer, setAfterschoolTimer] = useState<any>(null);

    // 대시보드 주요 업무 바로가기 개인화 설정 상태
    const [isMajorTasksModalOpen, setIsMajorTasksModalOpen] = useState(false);
    const [selectedMajorTaskIds, setSelectedMajorTaskIds] = useState<string[]>(['afterschool', 'bus']);

    useEffect(() => {
        setSelectedMajorTaskIds(getSavedMajorTaskIds());
    }, []);

    // 1. 실시간 부서 업무 구독
    useEffect(() => {
        const unsub = onDepartmentTasksUpdate((tasks) => {
            setDeptTasks(tasks);
        });
        return () => unsub();
    }, []);

    // 1-1. 부서별 주간 일정 및 학사 일정 실시간 구독
    useEffect(() => {
        const unsubSched = onDepartmentWeeklySchedulesUpdate((list) => {
            setWeeklySchedules(list);
        });
        const unsubDoc = onDocConfigUpdate((cfg) => {
            if (cfg.academicCalendar?.events && cfg.academicCalendar.events.length > 0) {
                setAcademicEvents(cfg.academicCalendar.events);
            } else {
                setAcademicEvents(DEFAULT_ACADEMIC_CALENDAR_CONFIG.events || []);
            }
        });
        return () => {
            unsubSched();
            unsubDoc();
        };
    }, []);

    // 1-2. 부서원 주간 일정 제안 실시간 구독
    useEffect(() => {
        const unsub = onWeeklyProposalsUpdate((proposals) => {
            setWeeklyProposals(proposals);
        });
        return () => unsub();
    }, []);

    // 2. 전체 교직원 목록 로드 (학생 및 학부모 계정 제외)
    useEffect(() => {
        getUsersDirectory().then(users => {
            const facultyOnly = users.filter(u => {
                const roleLower = (u.role || '').toLowerCase();
                const isStudent = roleLower.includes('student') || roleLower.includes('학생') || !!u.studentGrade || !!u.studentNumber;
                const isParent = roleLower.includes('parent') || roleLower.includes('학부모') || !!u.parentName || !!u.parentPhone;
                return !isStudent && !isParent && !!u.email && !!u.name;
            });
            setAllFaculty(facultyOnly.map(u => ({ email: u.email, name: u.name, dept: u.dept || u.role || '교직원' })));
        }).catch(err => {
            console.warn("Failed to load faculty directory:", err);
        });
    }, []);

    // 3. 방과후학교 실시간 데이터 구독 (운영 단계별 동적 브리핑용)
    useEffect(() => {
        const unsubCourses = onAfterschoolCoursesUpdate((courses) => {
            setAfterschoolCourses(courses);
        });
        const unsubEnroll = onAfterschoolEnrollmentsUpdate((enrollments) => {
            setAfterschoolEnrollments(enrollments);
        });
        const unsubTimer = onAfterschoolTimerUpdate((timer) => {
            setAfterschoolTimer(timer);
        });
        return () => {
            unsubCourses();
            unsubEnroll();
            unsubTimer();
        };
    }, []);

    // 나에게 할당된 업무 캘린더 동기화 (마감일 오전 08:30 알림 포함 ICS)
    const handleSyncAssignedTasksToCalendar = () => {
        const myEmail = profile?.email?.toLowerCase() || '';
        const myAssignedList = deptTasks.filter(t => t.targetEmails?.some(e => e.toLowerCase() === myEmail));
        const tasksWithDeadline = myAssignedList.filter(t => t.deadline && /^\d{4}-\d{2}-\d{2}$/.test(t.deadline.trim()));

        if (tasksWithDeadline.length === 0) {
            toast({
                title: "동기화할 업무 없음",
                description: "마감기한(날짜)이 지정된 할당 업무가 없습니다."
            });
            return;
        }

        try {
            const ics = generateAssignedTasksIcs(tasksWithDeadline);
            const userPrefix = myEmail ? myEmail.split('@')[0] : 'user';
            downloadIcsFile(ics, `kis_assigned_tasks_${userPrefix}.ics`);
            toast({
                title: "할당 업무 캘린더 동기화 완료",
                description: `마감 업무 ${tasksWithDeadline.length}건이 담긴 캘린더 파일이 다운로드되었습니다. 마감 당일 오전 08:30 알림이 제공됩니다.`
            });
        } catch (e: any) {
            toast({
                variant: "destructive",
                title: "동기화 오류",
                description: e?.message || "캘린더 파일 생성 중 오류가 발생했습니다."
            });
        }
    };

    useEffect(() => {
        if (profile?.email) {
            getOrgStructure().then(org => {
                setOrgData(org);
                const emailLower = profile.email.toLowerCase();
                const systemAdmin = profile.isAdmin === true;
                
                // 스쿨버스 담당자 여부 확인
                const busManagers = org.busManagers || (org.busManager ? [org.busManager] : []);
                const hasBusAuth = systemAdmin || busManagers.some((m: string) => m.toLowerCase() === emailLower);
                setIsBusManager(hasBusAuth);

                // 방과후학교 담당자 여부 확인
                const afterschoolManagers = org.afterschoolManagers || (org.afterschoolManager ? [org.afterschoolManager] : []);
                const hasAfterschoolAuth = systemAdmin || afterschoolManagers.some((m: string) => m.toLowerCase() === emailLower);
                setIsAfterschoolManager(hasAfterschoolAuth);
            }).catch(err => {
                console.error("Failed to load org structure for auth check in inbox:", err);
            });
        }
    }, [profile]);

    const myBelongingInfo = useMemo(() => {
        if (!profile?.email || !orgData) {
            return {
                belongs: profile?.dept || '소속 정보 없음',
                managers: '일반 교직원',
                homeroom: null as string | null,
                department: null as string | null,
                isHead: false,
                belongsList: [] as string[],
                managerList: [] as string[]
            };
        }
        const emailLower = profile.email.toLowerCase();
        const belongsList: string[] = [];
        const managerList: string[] = [];
        let homeroom: string | null = null;
        let department: string | null = null;
        let isHead = false;

        if (orgData.principal?.toLowerCase() === emailLower) belongsList.push('교장');
        if (orgData.vicePrincipal?.toLowerCase() === emailLower) belongsList.push('교감');

        if (orgData.gradeHeads) {
            for (const [grade, headEmail] of Object.entries(orgData.gradeHeads)) {
                if ((headEmail as string)?.toLowerCase() === emailLower) {
                    belongsList.push(`${grade}학년 부장`);
                    isHead = true;
                }
            }
        }

        if (orgData.homerooms) {
            for (const [gradeClass, teacherEmail] of Object.entries(orgData.homerooms)) {
                if ((teacherEmail as string)?.toLowerCase() === emailLower) {
                    belongsList.push(`${gradeClass} 담임`);
                    homeroom = gradeClass;
                }
            }
        }

        if (orgData.departments) {
            for (const dept of orgData.departments) {
                if (dept.headEmail?.toLowerCase() === emailLower) {
                    belongsList.push(`${dept.name} (부장)`);
                    department = dept.name;
                    isHead = true;
                }
                if (dept.memberEmails?.some((m: string) => m?.toLowerCase() === emailLower)) {
                    belongsList.push(`${dept.name} (부원)`);
                    if (!department) department = dept.name;
                }
            }
        }

        if (orgData.systemManagers?.map((m: string) => m.toLowerCase()).includes(emailLower) || profile.isAdmin) {
            managerList.push('시스템 설정');
        }
        if (orgData.afterschoolManagers?.map((m: string) => m.toLowerCase()).includes(emailLower)) {
            managerList.push('방과후학교');
        }
        if (orgData.busManagers?.map((m: string) => m.toLowerCase()).includes(emailLower)) {
            managerList.push('스쿨버스');
        }

        return {
            belongs: belongsList.length > 0 ? belongsList.join(' · ') : (profile?.dept || '일반 교직원'),
            managers: managerList.length > 0 ? managerList.join(', ') : '해당 없음',
            homeroom,
            department,
            isHead,
            belongsList,
            managerList
        };
    }, [profile, orgData]);

    // ── 주요 학교 일정 계산 (오늘 D-day ~ 향후 7일간 일정) ──
    const mainSchoolSchedules = useMemo(() => {
        const now = new Date();
        const end = new Date(now);
        end.setDate(end.getDate() + 7); // D-day ~ D+7 (향후 7일간)

        const todayStr = formatToDateStr(now);
        const endDateStr = formatToDateStr(end);

        const emailLower = profile?.email?.toLowerCase() || '';
        const isHeadOrAdmin = myBelongingInfo.isHead || profile?.isAdmin || (profile?.role && (profile.role.includes('부장') || profile.role === '교장' || profile.role === '교감'));
        const myDept = myBelongingInfo.department || profile?.dept || '';

        const results: Array<{
            id: string;
            title: string;
            date: string;
            endDate?: string;
            deptName?: string;
            isAcademic: boolean;
            isMainSchool: boolean;
            isPrivateDept: boolean;
            isToday: boolean;
            isPast: boolean;
            isFuture: boolean;
            diffDays: number;
            canDelete: boolean;
            creatorEmail?: string;
            content?: string;
        }> = [];

        // 1. 학사일정 events (오늘 D-day 시점에 진행 중이거나 향후 7일 이내 시작되는 일정만)
        academicEvents.forEach((ev) => {
            const evEnd = ev.endDate || ev.date;
            if (evEnd >= todayStr && ev.date <= endDateStr) {
                const diffTime = new Date(ev.date).getTime() - new Date(todayStr).getTime();
                const diffDays = Math.round(diffTime / (1000 * 3600 * 24));
                results.push({
                    id: ev.id,
                    title: ev.title,
                    date: ev.date,
                    endDate: ev.endDate,
                    isAcademic: true,
                    isMainSchool: true,
                    isPrivateDept: false,
                    isToday: ev.date <= todayStr && evEnd >= todayStr,
                    isPast: evEnd < todayStr,
                    isFuture: ev.date > todayStr,
                    diffDays,
                    canDelete: false
                });
            }
        });

        // 2. 부서별 주간 일정 (오늘 D-day 시점에 진행 중이거나 향후 7일 이내 시작되는 일정만)
        weeklySchedules.forEach((sch) => {
            if (sch.endDate >= todayStr && sch.startDate <= endDateStr) {
                const isCreator = sch.creatorEmail?.toLowerCase() === emailLower;
                const isMyDept = sch.deptName === myDept || myBelongingInfo.belongsList.some(b => b.includes(sch.deptName));
                const isPrivate = !sch.isMainSchoolSchedule && !sch.sendToAcademicCalendar;

                // 권한 체크: 공개/학사일정은 모두에게 노출, 자체종료는 교장/교감/부장단/해당부서원/작성자에게만 노출
                const canView = !isPrivate || isHeadOrAdmin || isMyDept || isCreator;
                if (!canView) return;

                const diffTime = new Date(sch.startDate).getTime() - new Date(todayStr).getTime();
                const diffDays = Math.round(diffTime / (1000 * 3600 * 24));

                results.push({
                    id: sch.id,
                    title: sch.title,
                    date: sch.startDate,
                    endDate: sch.endDate,
                    deptName: sch.deptName,
                    isAcademic: sch.sendToAcademicCalendar,
                    isMainSchool: sch.isMainSchoolSchedule,
                    isPrivateDept: isPrivate,
                    isToday: sch.startDate <= todayStr && sch.endDate >= todayStr,
                    isPast: sch.endDate < todayStr,
                    isFuture: sch.startDate > todayStr,
                    diffDays,
                    canDelete: isCreator || profile?.isAdmin === true,
                    creatorEmail: sch.creatorEmail,
                    content: sch.content
                });
            }
        });

        // 날짜 오름차순 정렬 (동일 날짜면 학사일정 우선)
        return results.sort((a, b) => {
            if (a.date !== b.date) return a.date.localeCompare(b.date);
            if (a.isAcademic !== b.isAcademic) return a.isAcademic ? -1 : 1;
            return a.title.localeCompare(b.title);
        });
    }, [academicEvents, weeklySchedules, profile, myBelongingInfo]);

    // 내가 부장으로 있는 부서 목록
    const myHeadDepartments = useMemo(() => {
        if (!orgData?.departments || !profile?.email) return [];
        const emailLower = profile.email.toLowerCase();
        return orgData.departments
            .filter((d: any) => d.headEmail?.toLowerCase() === emailLower)
            .map((d: any) => d.name);
    }, [orgData, profile]);

    // 부장 또는 결재권자 권한 여부 (실제 부장 직책/조직도 부장 또는 교장/교감인 경우만 인정)
    const isDepartmentHead = useMemo(() => {
        return !!(
            myHeadDepartments.length > 0 ||
            myBelongingInfo.isHead ||
            (profile?.role && (profile.role.includes('부장') || profile.role === '교장' || profile.role === '교감'))
        );
    }, [myHeadDepartments, myBelongingInfo, profile]);

    // 부장/관리자가 검토해야 할 부서원 제안 목록 (pending)
    const pendingProposalsForHead = useMemo(() => {
        const isSuperAdmin = profile?.isAdmin || profile?.role === '교장' || profile?.role === '교감';
        if (isSuperAdmin) {
            return weeklyProposals.filter(p => p.status === 'pending');
        }
        if (myHeadDepartments.length === 0) return [];
        return weeklyProposals.filter(p => myHeadDepartments.includes(p.deptName) && p.status === 'pending');
    }, [weeklyProposals, myHeadDepartments, profile]);

    // 내가 부원으로서 부장에게 제안한 목록
    const mySubmittedProposals = useMemo(() => {
        if (!profile?.email) return [];
        const emailLower = profile.email.toLowerCase();
        return weeklyProposals.filter(p => p.submitterEmail?.toLowerCase() === emailLower);
    }, [weeklyProposals, profile]);

    const handleDeleteProposal = async (proposalId: string, title: string) => {
        if (!window.confirm(`제안하신 [${title}] 일정을 삭제하시겠습니까?`)) {
            return;
        }
        try {
            const res = await deleteWeeklyProposal(proposalId);
            if (res.success) {
                toast({ title: "제안 삭제 완료", description: "주간 일정 제안이 삭제되었습니다." });
            } else {
                toast({ title: "삭제 실패", description: res.error || "삭제 중 오류가 발생했습니다.", variant: "destructive" });
            }
        } catch (e: any) {
            toast({ title: "삭제 실패", description: e.message || "삭제 중 오류가 발생했습니다.", variant: "destructive" });
        }
    };

    const handleBusClick = (e: React.MouseEvent) => {
        if (!isBusManager) {
            e.preventDefault();
            setIsBusDialogOpen(true);
        }
    };

    const handleAfterschoolClick = (e: React.MouseEvent) => {
        if (!isAfterschoolManager) {
            e.preventDefault();
            setIsAfterschoolDialogOpen(true);
        }
    };

    useEffect(() => {
        if (profile?.email && user?.uid) {
            setLoading(true);
            const currentYear = new Date().getFullYear().toString();
            const isTeacherOrAdmin = profile.role === 'teacher' || !!profile.isAdmin || profile.role === 'admin' || profile.role === '부장' || profile.role === '교감' || profile.role === '교장';
            
            Promise.allSettled([
                getInboxDocuments(profile.email, profile.name),
                getPendingDocuments(user.uid, profile.email, profile?.name),
                getMyTeacherDocuments(profile.email),
                getParentServiceDocuments(profile.email, profile.name),
                isTeacherOrAdmin
                    ? getTeacherDutyStats(profile.email, currentYear, profile.annualLeaveLimit || 21)
                    : Promise.resolve({ annualUsed: 0, sickUsed: 0, otherUsed: 0, earlyUsedHours: 0, earlyConvertedDays: 0, remainingEarlyHours: 0, totalAnnualUsed: 0, annualLimit: 21, annualRemaining: 21 }),
                isTeacherOrAdmin
                    ? getOvertimeStatsByYear(profile.email, currentYear)
                    : Promise.resolve([] as { month: string; hours: number; }[]),
            ]).then((results) => {
                if (results[0].status === 'fulfilled') setInboxDocs(results[0].value || []);
                if (results[1].status === 'fulfilled') setPendingDocs(results[1].value || []);
                if (results[2].status === 'fulfilled') setTeacherDocs(results[2].value || []);
                if (results[3].status === 'fulfilled') setParentDocs(results[3].value || []);
                if (results[4].status === 'fulfilled') setDutyStats(results[4].value as any);
                if (results[5].status === 'fulfilled') setOvertimeChart(results[5].value as any);
                setLoading(false);

                // 읽지 않은 결재 알림 상태가 true일 경우 리셋
                if ((profile as any)?.hasUnreadInboxNotification === true) {
                    saveUserProfile(user.uid, profile.email, { hasUnreadInboxNotification: false })
                        .catch(err => console.error("[InboxPage] Failed to reset notification flag:", err));
                }
            }).catch(err => {
                console.error("Dashboard Load Error:", err);
                setLoading(false);
            });
        } else if (!user || !profile) {
            setLoading(false);
        }
    }, [user, profile]);

    if (loading) {
        return (
            <div className="flex h-full w-full items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        );
    }

    return (
        <MainLayout title="전자결재 대시보드" contentClassName="p-2 sm:p-4 h-full max-h-full flex flex-col gap-3 font-body overflow-hidden">
            {/* ── 2열 50:50 나란한 배치: [결재 대기 문서 + 주요 학교 일정] (좌) & [나의 업무] (우) ── */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 flex-1 min-h-0 items-stretch overflow-y-auto lg:overflow-hidden">
                {/* 1. 좌측 (50%): [결재 대기 문서 목록] (상단) + [주요 학교 일정] (하단) */}
                <div className="flex flex-col gap-3 flex-1 min-h-0 h-full">
                    {/* 1-1. 상단: 결재 대기 문서 목록 카드 (높이를 절반으로 줄여 콤팩트화) */}
                    <Card className="rounded-2xl border bg-card shadow-xs flex flex-col shrink-0 overflow-hidden">
                        <div className="p-3 sm:p-3.5 border-b flex items-center justify-between gap-2 shrink-0 bg-slate-50/70 rounded-t-2xl min-h-[53px]">
                            <div className="flex items-center gap-2 min-w-0">
                                <div className="p-1.5 bg-blue-500/10 rounded-xl text-blue-600 shrink-0">
                                    <Inbox className="h-4 w-4" />
                                </div>
                                <div className="min-w-0">
                                    <div className="flex items-center gap-1.5 whitespace-nowrap">
                                        <h2 className="text-sm sm:text-base font-bold text-slate-900 font-headline whitespace-nowrap">
                                            <span className="sm:hidden">결재 대기</span>
                                            <span className="hidden sm:inline">결재 대기 문서 목록</span>
                                        </h2>
                                        <Badge className="bg-blue-600 text-white text-[10px] font-bold px-1.5 py-0 rounded-full shrink-0">
                                            {inboxDocs.length}
                                        </Badge>
                                    </div>
                                </div>
                            </div>
                            <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
                                <Button asChild variant="outline" size="sm" className="h-7 text-xs font-semibold gap-1 px-2 sm:px-2.5">
                                    <Link href="/sent">
                                        <Send className="w-3 h-3" /> <span className="hidden sm:inline">상신함</span><span className="sm:hidden">상신</span>
                                    </Link>
                                </Button>
                                <Button asChild variant="outline" size="sm" className="h-7 text-xs font-semibold gap-1 text-primary border-primary/30 px-2 sm:px-2.5">
                                    <Link href="/registry">
                                        대장 →
                                    </Link>
                                </Button>
                            </div>
                        </div>

                        <div className={cn("p-2 sm:p-3", inboxDocs.length > 0 ? "max-h-[160px] overflow-y-auto scrollbar-thin" : "flex flex-col")}>
                            {inboxDocs.length === 0 ? (
                                <div className="w-full flex items-center justify-center gap-2 py-2 px-3 bg-slate-50/60 rounded-xl border border-dashed text-slate-400">
                                    <Inbox className="w-4 h-4 text-slate-400 shrink-0 stroke-[1.5]" />
                                    <p className="text-xs font-semibold text-slate-600 truncate">현재 결재 대기 중인 문서가 없습니다.</p>
                                </div>
                            ) : (
                                <DocumentList documents={inboxDocs} />
                            )}
                        </div>
                    </Card>

                    {/* 1-2. 하단: 주요 학교 일정 (위로 끌어올려 충분한 세로 공간 확보) */}
                    <Card className="rounded-2xl border bg-card shadow-xs flex flex-col flex-1 min-h-0 overflow-hidden">
                        <div className="p-3 sm:p-3.5 border-b flex items-center justify-between gap-2 shrink-0 bg-blue-50/50 rounded-t-2xl">
                            <div className="flex items-center gap-2 min-w-0">
                                <div className="p-1.5 bg-blue-600/10 rounded-xl text-blue-600 shrink-0">
                                    <CalendarDays className="h-4 w-4" />
                                </div>
                                <div className="min-w-0">
                                    <div className="flex items-center gap-1.5 whitespace-nowrap">
                                        <h2 className="text-sm sm:text-base font-bold text-slate-900 font-headline whitespace-nowrap">
                                            <span className="sm:hidden">일정</span>
                                            <span className="hidden sm:inline">주요 학교 일정</span>
                                        </h2>
                                        <Badge variant="outline" className="bg-blue-50 border-blue-200 text-blue-700 text-[10px] font-bold px-1.5 py-0 whitespace-nowrap shrink-0">
                                            D-day ~ D+7
                                        </Badge>
                                    </div>
                                    <p className="text-[11px] text-muted-foreground hidden sm:block truncate">오늘 기준 향후 1주일간의 주요 학교 일정입니다.</p>
                                </div>
                            </div>

                            <div className="flex items-center gap-1 sm:gap-1.5 shrink-0 flex-nowrap">
                                <Button 
                                    size="sm" 
                                    variant="outline"
                                    onClick={() => setIsScheduleSyncModalOpen(true)}
                                    className="h-7 px-2 sm:px-2.5 border-blue-200 text-blue-700 hover:bg-blue-50 text-[11px] font-bold rounded-lg shadow-2xs flex items-center gap-1 shrink-0 whitespace-nowrap"
                                    title="주간 및 월간 교육 일정을 내 캘린더에 동기화"
                                >
                                    <CalendarCheck className="w-3 h-3 text-blue-600 shrink-0" />
                                    <span className="sm:hidden">동기화</span>
                                    <span className="hidden sm:inline">내 캘린더 동기화</span>
                                </Button>
                                <Button 
                                    size="sm" 
                                    variant="outline"
                                    onClick={() => setIsWeeklyPlanModalOpen(true)}
                                    className="h-7 px-2 sm:px-2.5 border-blue-200 text-blue-700 hover:bg-blue-50 text-[11px] font-bold rounded-lg shadow-2xs flex items-center gap-1 shrink-0 whitespace-nowrap"
                                    title="유초등 주간교육계획 조회 및 관리"
                                >
                                    <CalendarDays className="w-3 h-3 text-blue-600 shrink-0" />
                                    <span className="sm:hidden">주간</span>
                                    <span className="hidden sm:inline">주간 일정</span>
                                </Button>
                                <Button 
                                    size="sm" 
                                    variant="outline"
                                    onClick={() => setIsMonthlyPlanModalOpen(true)}
                                    className="h-7 px-2 sm:px-2.5 border-blue-200 text-blue-700 hover:bg-blue-50 text-[11px] font-bold rounded-lg shadow-2xs flex items-center gap-1 shrink-0 whitespace-nowrap"
                                    title="유초등 월간 교육활동 계획 조회 및 관리"
                                >
                                    <Calendar className="w-3 h-3 text-blue-600 shrink-0" />
                                    <span className="sm:hidden">월간</span>
                                    <span className="hidden sm:inline">월간 일정</span>
                                </Button>
                            </div>
                        </div>

                        <div className={cn("p-2.5 sm:p-3 space-y-1.5", mainSchoolSchedules.length > 0 ? "overflow-visible lg:overflow-y-auto scrollbar-thin lg:flex-1 lg:min-h-0" : "flex flex-col")}>
                            {mainSchoolSchedules.length === 0 ? (
                                <div className="w-full flex items-center justify-center gap-2 py-2.5 px-3 bg-slate-50/60 rounded-xl border border-dashed text-slate-400">
                                    <Calendar className="w-4 h-4 text-slate-400 shrink-0 stroke-[1.5]" />
                                    <p className="text-xs font-semibold text-slate-600">해당 기간(오늘 ~ D+7)에 예정된 학교 일정이 없습니다.</p>
                                </div>
                            ) : (
                                mainSchoolSchedules.map((item) => {
                                    const dateObj = new Date(item.date);
                                    const month = dateObj.getMonth() + 1;
                                    const day = dateObj.getDate();
                                    const dayOfWeekNames = ['일', '월', '화', '수', '목', '금', '토'];
                                    const dayName = dayOfWeekNames[dateObj.getDay()];

                                    return (
                                        <div 
                                            key={item.id}
                                            className={cn(
                                                "p-2 sm:p-2.5 rounded-xl border text-xs transition-all flex items-center justify-between gap-2.5",
                                                item.isToday 
                                                    ? "bg-blue-50/80 border-blue-300 shadow-2xs ring-1 ring-blue-400/50" 
                                                    : item.isPast 
                                                        ? "bg-slate-50/80 border-slate-200 text-slate-500 opacity-80" 
                                                        : "bg-white border-slate-200 hover:border-blue-200"
                                            )}
                                        >
                                            <div className="flex items-center gap-2 min-w-0 flex-1">
                                                {/* 날짜 배지 */}
                                                <div className={cn(
                                                    "px-2 py-1 rounded-lg text-center shrink-0 flex flex-col items-center justify-center min-w-[52px]",
                                                    item.isToday 
                                                        ? "bg-blue-600 text-white font-black" 
                                                        : "bg-slate-100 text-slate-700 font-bold"
                                                )}>
                                                    <span className="text-[11px] leading-none">{month}.{day}({dayName})</span>
                                                    {item.isToday ? (
                                                        <span className="text-[9px] text-amber-300 leading-none mt-0.5">오늘</span>
                                                    ) : item.diffDays > 0 ? (
                                                        <span className="text-[9px] text-slate-400 leading-none mt-0.5">D-{item.diffDays}</span>
                                                    ) : (
                                                        <span className="text-[9px] text-slate-400 leading-none mt-0.5">D+{Math.abs(item.diffDays)}</span>
                                                    )}
                                                </div>

                                                {/* 일정 내용 및 태그 */}
                                                <div className="space-y-0.5 min-w-0 flex-1">
                                                    <div className="flex items-center gap-1.5 flex-wrap">
                                                        {item.isAcademic && (
                                                            <Badge className="bg-indigo-600 text-white text-[9px] px-1 py-0 font-bold">
                                                                학사일정
                                                            </Badge>
                                                        )}
                                                        {item.deptName && (
                                                            <Badge variant="outline" className="bg-slate-100 text-slate-700 border-slate-300 text-[9px] px-1 py-0 font-semibold">
                                                                {item.deptName}
                                                            </Badge>
                                                        )}
                                                        {item.isPrivateDept && (
                                                            <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-300 text-[9px] px-1 py-0 font-semibold flex items-center gap-0.5">
                                                                <Lock className="w-2.5 h-2.5" /> 자체종료
                                                            </Badge>
                                                        )}
                                                        {item.endDate && item.endDate !== item.date && (
                                                            <span className="text-[10px] text-slate-400">
                                                                (~{item.endDate.split('-').slice(1).join('.')})
                                                            </span>
                                                        )}
                                                    </div>
                                                    <h4 className={cn("font-bold text-xs truncate", item.isToday ? "text-blue-950 font-black" : "text-slate-900")}>
                                                        {item.title}
                                                    </h4>
                                                </div>
                                            </div>

                                            {/* 삭제 버튼 (부서 일정 작성자/관리자) */}
                                            {item.canDelete && (
                                                <button
                                                    onClick={async () => {
                                                        if (confirm(`'${item.title}' 일정을 삭제하시겠습니까?`)) {
                                                            await deleteDepartmentWeeklySchedule(item.id);
                                                        }
                                                    }}
                                                    className="text-slate-300 hover:text-rose-500 p-1 transition-colors shrink-0"
                                                    title="일정 삭제"
                                                >
                                                    <Trash2 className="w-3.5 h-3.5" />
                                                </button>
                                            )}
                                        </div>
                                    );
                                })
                            )}
                        </div>
                    </Card>
                </div>

                {/* 2. 우측 (50%): 나의 업무 (부서/학급 현행 업무 + 워크플로우 + Todo) 카드 */}
                <Card className="rounded-2xl border bg-card shadow-xs flex flex-col flex-1 min-h-0 h-full overflow-hidden">
                    <div className="p-3 sm:p-3.5 border-b flex items-center justify-between gap-2 shrink-0 bg-indigo-50/50 rounded-t-2xl min-w-0 min-h-[53px]">
                        <div className="flex items-center gap-2 min-w-0 flex-1">
                            <div className="p-1.5 bg-indigo-500/10 rounded-xl text-indigo-600 shrink-0">
                                <ClipboardList className="h-4 w-4" />
                            </div>
                            <div className="min-w-0 flex-1">
                                <h2 className="text-sm sm:text-base font-bold text-slate-900 font-headline">
                                    나의 업무
                                </h2>
                            </div>
                        </div>

                        <div className="flex items-center gap-1 sm:gap-1.5 shrink-0 flex-nowrap">
                            {/* 주요 업무 바로가기 설정 버튼 (일정 건의 왼쪽) */}
                            <Button 
                                size="sm" 
                                variant="outline"
                                onClick={() => setIsMajorTasksModalOpen(true)}
                                className="h-7 px-2 sm:px-2.5 border-indigo-200 text-indigo-700 hover:bg-indigo-50 text-[11px] font-bold rounded-lg shadow-2xs flex items-center gap-1 shrink-0 whitespace-nowrap"
                                title="대시보드 주요 업무 바로가기 설정"
                            >
                                <SlidersHorizontal className="w-3 h-3 text-indigo-600 shrink-0" />
                                <span className="hidden sm:inline">주요 업무 설정</span>
                                <span className="sm:hidden">설정</span>
                            </Button>

                            {isDepartmentHead ? (
                                <Button 
                                    size="sm" 
                                    variant="outline"
                                    onClick={() => {
                                        if (pendingProposalsForHead.length > 0) {
                                            setReviewingProposal(pendingProposalsForHead[0]);
                                        } else {
                                            setIsCreateWeeklyScheduleOpen(true);
                                        }
                                    }}
                                    className="relative h-7 px-2 sm:px-2.5 border-indigo-200 text-indigo-700 hover:bg-indigo-50 text-[11px] font-bold rounded-lg shadow-2xs flex items-center gap-1 shrink-0 whitespace-nowrap"
                                    title={pendingProposalsForHead.length > 0 ? `부서원 건의 ${pendingProposalsForHead.length}건 검토 대기 중` : "부서 주간 일정 등록"}
                                >
                                    <CalendarDays className="w-3 h-3 text-indigo-600 shrink-0" />
                                    <span>일정 등록</span>
                                    {pendingProposalsForHead.length > 0 && (
                                        <span className="min-w-4 h-4 px-1 rounded-full bg-red-500 text-white font-black text-[9px] flex items-center justify-center shadow-xs animate-pulse ml-0.5">
                                            {pendingProposalsForHead.length}
                                        </span>
                                    )}
                                </Button>
                            ) : (
                                <Button 
                                    size="sm" 
                                    variant="outline"
                                    onClick={() => setIsCreateProposalOpen(true)}
                                    className="h-7 px-2 sm:px-2.5 border-indigo-200 text-indigo-700 hover:bg-indigo-50 text-[11px] font-bold rounded-lg shadow-2xs flex items-center gap-1 shrink-0 whitespace-nowrap"
                                    title="부장에게 주간 일정 건의"
                                >
                                    <CalendarPlus className="w-3 h-3 text-blue-600 shrink-0" />
                                    <span>일정 건의</span>
                                </Button>
                            )}

                            <Button 
                                size="sm" 
                                onClick={() => setIsCreateTaskOpen(true)}
                                className="h-7 px-2 sm:px-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-[11px] font-bold rounded-lg shadow-xs flex items-center gap-1 shrink-0 whitespace-nowrap"
                                title="새 업무 요청"
                            >
                                <Plus className="w-3 h-3 text-amber-300 shrink-0" />
                                <span>새 업무 요청</span>
                            </Button>
                        </div>
                    </div>

                    <div className="p-3 sm:p-3.5 flex-1 flex flex-col justify-start overflow-y-auto scrollbar-thin gap-3">
                        {/* 2-0. 부장 전용: 부서원 주간 일정 제안 검토 대기 알림 배너 */}
                        {pendingProposalsForHead.length > 0 && (
                            <div className="p-3 rounded-xl bg-amber-50/90 border border-amber-200 shadow-2xs space-y-2 shrink-0">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-1.5">
                                        <div className="p-1 bg-amber-500/10 rounded-lg text-amber-700">
                                            <MessageSquare className="w-3.5 h-3.5" />
                                        </div>
                                        <span className="font-bold text-xs text-amber-950">
                                            부서원 주간 일정 제안 검토
                                        </span>
                                        <Badge className="bg-amber-600 text-white text-[9px] px-1.5 py-0 font-bold">
                                            {pendingProposalsForHead.length}건 대기
                                        </Badge>
                                    </div>
                                    <span className="text-[10px] text-amber-700 font-medium">부서 일정 반영 / 부서내 종결</span>
                                </div>
                                <div className="grid grid-cols-1 gap-1.5 max-h-28 overflow-y-auto scrollbar-thin">
                                    {pendingProposalsForHead.map((p) => (
                                        <div 
                                            key={p.id}
                                            onClick={() => setReviewingProposal(p)}
                                            className="p-2 bg-white rounded-lg border border-amber-200 hover:border-amber-400 hover:shadow-2xs cursor-pointer flex items-center justify-between gap-2 transition-all"
                                        >
                                            <div className="min-w-0 flex-1">
                                                <div className="flex items-center gap-1.5">
                                                    <Badge variant="outline" className="text-[9px] px-1 py-0 bg-slate-50 text-slate-700 font-semibold">
                                                        {p.deptName}
                                                    </Badge>
                                                    <span className="text-xs font-bold text-slate-900 truncate">
                                                        {p.title}
                                                    </span>
                                                </div>
                                                <p className="text-[10px] text-slate-500 truncate mt-0.5">
                                                    제안: <strong>{p.submitterName}</strong> 선생님 ({p.startDate} ~ {p.endDate})
                                                </p>
                                            </div>
                                            <Button size="sm" variant="outline" className="h-6 text-[10px] px-2 text-indigo-700 border-indigo-200 font-bold shrink-0">
                                                검토 →
                                            </Button>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* 2-0-1. 일반 교사 전용: 내가 제안한 주간 일정 현황 (최근 제안이 있을 때) */}
                        {mySubmittedProposals.length > 0 && !myBelongingInfo.isHead && (
                            <div className="p-2.5 rounded-xl bg-indigo-50/50 border border-indigo-100 text-xs space-y-1.5 shrink-0">
                                <div className="flex items-center justify-between">
                                    <span className="font-bold text-indigo-950 flex items-center gap-1 text-[11px]">
                                        <MessageSquare className="w-3 h-3 text-indigo-600" />
                                        내가 제안한 주간 일정 ({mySubmittedProposals.length}건)
                                    </span>
                                    <button 
                                        onClick={() => setIsCreateProposalOpen(true)}
                                        className="text-[10px] text-indigo-600 font-bold hover:underline"
                                    >
                                        + 추가 제안
                                    </button>
                                </div>
                                <div className="space-y-1">
                                    {mySubmittedProposals.slice(0, 3).map((p) => (
                                        <div key={p.id} className="p-1.5 bg-white rounded-lg border border-indigo-100 text-[11px] flex items-center justify-between gap-1.5 group/item">
                                            <span className="font-medium text-slate-800 truncate flex-1" title={p.title}>{p.title}</span>
                                            <div className="flex items-center gap-1 shrink-0">
                                                <Badge variant="outline" className={cn(
                                                    "text-[9px] px-1 py-0 shrink-0 font-bold",
                                                    p.status === 'approved' ? "bg-emerald-50 text-emerald-700 border-emerald-300" :
                                                    p.status === 'closed_internal' ? "bg-amber-50 text-amber-700 border-amber-300" :
                                                    p.status === 'rejected' ? "bg-rose-50 text-rose-700 border-rose-300" :
                                                    "bg-blue-50 text-blue-700 border-blue-300"
                                                )}>
                                                    {p.status === 'approved' ? '승인반영' : p.status === 'closed_internal' ? '부서종결' : p.status === 'rejected' ? '반려' : '검토대기'}
                                                </Badge>
                                                <button
                                                    type="button"
                                                    onClick={() => handleDeleteProposal(p.id, p.title)}
                                                    className="text-slate-400 hover:text-rose-600 p-0.5 rounded transition-colors"
                                                    title="제안 삭제"
                                                >
                                                    <Trash2 className="w-3 h-3" />
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* 2-1. 개인화 주요 업무 바로가기 (최대 3개 나란히 배치) */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                            {selectedMajorTaskIds.map((taskId) => {
                                if (taskId === 'afterschool') {
                                    const pendingCourses = afterschoolCourses.filter(c => c.status === 'PENDING');
                                    const openCourses = afterschoolCourses.filter(c => c.status === 'OPEN');
                                    const isTimerOpen = afterschoolTimer?.masterStatus === 'OPEN';

                                    let stageBadge = '강좌 개설';
                                    let stageTitle = '방과후학교';
                                    let stageDesc = `신규 강좌 ${pendingCourses.length}건 심사 대기`;

                                    if (isTimerOpen) {
                                        stageBadge = '수강신청 접수';
                                        stageDesc = `수강신청 총 ${afterschoolEnrollments.length}건 접수`;
                                    } else if (pendingCourses.length > 0) {
                                        stageBadge = '강좌 심사';
                                        stageDesc = `계획서 ${pendingCourses.length}건 검토·승인`;
                                    } else if (openCourses.length > 0) {
                                        stageBadge = '운영 관리';
                                        stageDesc = `총 ${openCourses.length}개 강좌·출석 관리`;
                                    } else {
                                        stageBadge = '방과후 총괄';
                                        stageDesc = '강좌 개설, 수강 확정, 출석부';
                                    }

                                    return (
                                        <Link 
                                            key={taskId}
                                            href={isAfterschoolManager ? "/admin/afterschool" : "/teacher/afterschool"} 
                                            className="group block" 
                                            onClick={handleAfterschoolClick}
                                        >
                                            <div className="p-2 sm:p-2.5 rounded-xl border border-teal-200 bg-linear-to-br from-teal-50/70 via-white to-white hover:border-teal-400 hover:shadow-2xs transition-all h-full flex flex-col justify-between">
                                                <div className="space-y-0.5 min-w-0">
                                                    <div className="flex items-center justify-between">
                                                        <Badge className="bg-teal-600 text-white text-[9px] px-1.5 py-0 font-bold leading-tight">
                                                            {stageBadge}
                                                        </Badge>
                                                        <span className="text-[10px] text-teal-600 font-bold group-hover:translate-x-0.5 transition-transform">
                                                            →
                                                        </span>
                                                    </div>
                                                    <h4 className="font-bold text-slate-900 text-xs truncate mt-0.5">{stageTitle}</h4>
                                                    <p className="text-[10.5px] text-slate-500 truncate">
                                                        {stageDesc}
                                                    </p>
                                                </div>
                                            </div>
                                        </Link>
                                    );
                                }

                                if (taskId === 'bus') {
                                    return (
                                        <Link 
                                            key={taskId}
                                            href={isBusManager ? "/admin/bus" : "/teacher/bus"} 
                                            className="group block" 
                                            onClick={handleBusClick}
                                        >
                                            <div className="p-2 sm:p-2.5 rounded-xl border border-blue-200 bg-linear-to-br from-blue-50/70 via-white to-white hover:border-blue-400 hover:shadow-2xs transition-all h-full flex flex-col justify-between">
                                                <div className="space-y-0.5 min-w-0">
                                                    <div className="flex items-center justify-between">
                                                        <Badge className="bg-blue-600 text-white text-[9px] px-1.5 py-0 font-bold leading-tight">
                                                            {isBusManager ? '스쿨버스 관리' : '스쿨버스 탑승'}
                                                        </Badge>
                                                        <span className="text-[10px] text-blue-600 font-bold group-hover:translate-x-0.5 transition-transform">
                                                            →
                                                        </span>
                                                    </div>
                                                    <h4 className="font-bold text-slate-900 text-xs truncate mt-0.5">
                                                        스쿨버스
                                                    </h4>
                                                    <p className="text-[10.5px] text-slate-500 truncate">
                                                        {isBusManager ? '버스 등록, 노선, 좌석 및 탑승 관리' : '호차별 탑승 명단 및 실시간 체크'}
                                                    </p>
                                                </div>
                                            </div>
                                        </Link>
                                    );
                                }

                                const def = ALL_MAJOR_TASKS.find(t => t.id === taskId);
                                if (!def) return null;

                                const href = def.getHref(profile?.isAdmin, myBelongingInfo.isHead);
                                const colorStyles: Record<string, { border: string; bg: string; badge: string; text: string }> = {
                                    emerald: { border: 'border-emerald-200 hover:border-emerald-400', bg: 'from-emerald-50/70 via-white to-white', badge: 'bg-emerald-600', text: 'text-emerald-600' },
                                    amber: { border: 'border-amber-200 hover:border-amber-400', bg: 'from-amber-50/70 via-white to-white', badge: 'bg-amber-600', text: 'text-amber-600' },
                                    violet: { border: 'border-violet-200 hover:border-violet-400', bg: 'from-violet-50/70 via-white to-white', badge: 'bg-violet-600', text: 'text-violet-600' },
                                    rose: { border: 'border-rose-200 hover:border-rose-400', bg: 'from-rose-50/70 via-white to-white', badge: 'bg-rose-600', text: 'text-rose-600' },
                                    indigo: { border: 'border-indigo-200 hover:border-indigo-400', bg: 'from-indigo-50/70 via-white to-white', badge: 'bg-indigo-600', text: 'text-indigo-600' },
                                    teal: { border: 'border-teal-200 hover:border-teal-400', bg: 'from-teal-50/70 via-white to-white', badge: 'bg-teal-600', text: 'text-teal-600' },
                                    blue: { border: 'border-blue-200 hover:border-blue-400', bg: 'from-blue-50/70 via-white to-white', badge: 'bg-blue-600', text: 'text-blue-600' },
                                };
                                const cStyle = colorStyles[def.themeColor] || colorStyles.indigo;

                                return (
                                    <Link key={taskId} href={href} className="group block">
                                        <div className={cn("p-2 sm:p-2.5 rounded-xl border bg-linear-to-br transition-all h-full flex flex-col justify-between shadow-2xs", cStyle.border, cStyle.bg)}>
                                            <div className="space-y-0.5 min-w-0">
                                                <div className="flex items-center justify-between">
                                                    <Badge className={cn("text-white text-[9px] px-1.5 py-0 font-bold leading-tight", cStyle.badge)}>
                                                        {def.badge}
                                                    </Badge>
                                                    <span className={cn("text-[10px] font-bold group-hover:translate-x-0.5 transition-transform", cStyle.text)}>
                                                        →
                                                    </span>
                                                </div>
                                                <h4 className="font-bold text-slate-900 text-xs truncate mt-0.5">
                                                    {def.name}
                                                </h4>
                                                <p className="text-[10.5px] text-slate-500 truncate">
                                                    {def.description}
                                                </p>
                                            </div>
                                        </div>
                                    </Link>
                                );
                            })}
                        </div>

                        {/* 2-2. 부서·학년 업무 할당/제출 워크플로우 탭 */}
                        <div className="space-y-2 pt-1 border-t border-slate-100 flex-1 flex flex-col min-h-0">
                            <div className="flex items-center justify-between gap-1.5 shrink-0">
                                {(() => {
                                    const myEmail = profile?.email?.toLowerCase() || '';
                                    // 내가 대상자(targetEmails)에 포함되어 있는 모든 업무를 '나에게 할당된 업무'로 표시 (본인이 직접 할당한 경우도 포함)
                                    const assignedCount = deptTasks.filter(t => t.targetEmails?.some(e => e.toLowerCase() === myEmail)).length;
                                    const createdCount = deptTasks.filter(t => t.creatorEmail?.toLowerCase() === myEmail || myBelongingInfo.isHead || profile?.isAdmin).length;

                                    return (
                                        <div className="flex items-center gap-1.5">
                                            <button
                                                type="button"
                                                onClick={() => setActiveTaskSubTab('assigned')}
                                                className={cn(
                                                    "px-2.5 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1",
                                                    activeTaskSubTab === 'assigned'
                                                        ? "bg-indigo-600 text-white shadow-xs"
                                                        : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                                                )}
                                            >
                                                <Inbox className="w-3 h-3" />
                                                <span>나에게 할당된 업무</span>
                                                <Badge className={cn("px-1 py-0 text-[9px] h-3.5 leading-none font-bold", activeTaskSubTab === 'assigned' ? "bg-white text-indigo-700" : "bg-slate-300 text-slate-800")}>
                                                    {assignedCount}
                                                </Badge>
                                            </button>

                                            <button
                                                type="button"
                                                onClick={() => setActiveTaskSubTab('created')}
                                                className={cn(
                                                    "px-2.5 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1",
                                                    activeTaskSubTab === 'created'
                                                        ? "bg-indigo-600 text-white shadow-xs"
                                                        : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                                                )}
                                            >
                                                <Send className="w-3 h-3" />
                                                <span>요청 업무</span>
                                                <Badge className={cn("px-1 py-0 text-[9px] h-3.5 leading-none font-bold", activeTaskSubTab === 'created' ? "bg-white text-indigo-700" : "bg-slate-300 text-slate-800")}>
                                                    {createdCount}
                                                </Badge>
                                            </button>
                                        </div>
                                    );
                                })()}

                                <Button
                                    type="button"
                                    size="sm"
                                    variant="outline"
                                    onClick={handleSyncAssignedTasksToCalendar}
                                    className="h-7 px-2 sm:px-2.5 border-indigo-200 text-indigo-700 hover:bg-indigo-50 text-[11px] font-bold rounded-lg shadow-2xs flex items-center gap-1 shrink-0 whitespace-nowrap"
                                    title="마감기한이 지정된 할당 업무를 내 캘린더(오전 08:30 알림)에 동기화"
                                >
                                    <CalendarCheck className="w-3 h-3 text-indigo-600 shrink-0" />
                                    <span className="sm:hidden">동기화</span>
                                    <span className="hidden sm:inline">내 캘린더 동기화</span>
                                </Button>
                            </div>

                            {/* 업무 목록 뷰 (컴팩트 높이) */}
                            {activeTaskSubTab === 'assigned' && (() => {
                                const myEmail = profile?.email?.toLowerCase() || '';
                                const myAssignedList = deptTasks.filter(t => t.targetEmails?.some(e => e.toLowerCase() === myEmail));

                                if (myAssignedList.length === 0) {
                                    return (
                                        <div className="bg-slate-50/60 border border-dashed border-slate-200 rounded-xl py-2.5 px-3 text-center text-slate-400 flex items-center justify-center gap-2">
                                            <ClipboardList className="w-4 h-4 text-slate-300 shrink-0" />
                                            <span className="text-xs font-medium">할당된 부서 및 학년 업무가 없습니다.</span>
                                        </div>
                                    );
                                }

                                return (
                                    <div className="space-y-1.5 flex-1 min-h-[220px] max-h-[520px] overflow-y-auto pr-1 scrollbar-thin">
                                        {myAssignedList.map((task) => {
                                            const sub = task.submissions?.[myEmail];
                                            const isSubmitted = !!sub;

                                            return (
                                                <div 
                                                    key={task.id} 
                                                    className="p-2 rounded-xl border border-slate-200 bg-white shadow-xs hover:border-indigo-300 transition-all flex items-center justify-between gap-2"
                                                >
                                                    <div className="space-y-0.5 min-w-0 flex-1">
                                                        <div className="flex items-center gap-1.5 flex-wrap">
                                                            <Badge className="bg-indigo-600 text-white text-[9px] px-1 py-0 font-bold">
                                                                {task.creatorDept || '부서'}
                                                            </Badge>
                                                            <span className="text-[10px] text-slate-500">
                                                                {task.creatorName}
                                                            </span>
                                                            <span className="text-[10px] text-rose-600 font-semibold">
                                                                마감: {task.deadline}
                                                            </span>
                                                            {isSubmitted ? (
                                                                <Badge className="bg-emerald-500 text-white text-[8px] px-1 py-0 font-bold">
                                                                    완료
                                                                </Badge>
                                                            ) : (
                                                                <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-300 text-[8px] px-1 py-0 font-semibold">
                                                                    미제출
                                                                </Badge>
                                                            )}
                                                        </div>
                                                        <h4 className="font-bold text-slate-900 text-xs truncate">{task.title}</h4>
                                                    </div>

                                                    <Button
                                                        size="sm"
                                                        onClick={() => setSubmittingTask(task)}
                                                        className={cn(
                                                            "h-6 px-2 text-[10px] font-extrabold rounded-lg shadow-xs flex items-center gap-1 shrink-0",
                                                            isSubmitted 
                                                                ? "bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300" 
                                                                : "bg-indigo-600 hover:bg-indigo-700 text-white"
                                                        )}
                                                    >
                                                        <FileUp className="w-2.5 h-2.5 text-amber-300" />
                                                        <span>{isSubmitted ? '수정' : '제출'}</span>
                                                    </Button>
                                                </div>
                                            );
                                        })}
                                    </div>
                                );
                            })()}

                            {activeTaskSubTab === 'created' && (() => {
                                const myEmail = profile?.email?.toLowerCase() || '';
                                const myCreatedList = deptTasks.filter(t => 
                                    t.creatorEmail?.toLowerCase() === myEmail || 
                                    myBelongingInfo.isHead || 
                                    profile?.isAdmin
                                );

                                if (myCreatedList.length === 0) {
                                    return (
                                        <div className="bg-slate-50/60 border border-dashed border-slate-200 rounded-xl py-2.5 px-3 text-center text-slate-400 flex items-center justify-center gap-2">
                                            <Send className="w-4 h-4 text-slate-300 shrink-0" />
                                            <span className="text-xs font-medium">요청한 부서/학년 업무가 없습니다.</span>
                                        </div>
                                    );
                                }

                                return (
                                    <div className="space-y-1.5 flex-1 min-h-[220px] max-h-[520px] overflow-y-auto pr-1 scrollbar-thin">
                                        {myCreatedList.map((task) => {
                                            const emails = task.targetEmails || [];
                                            const targetNames = task.targetNames || {};
                                            const submissions = task.submissions || {};

                                            // 학년별 배정 업무인 경우
                                            const seenGrades = new Set<string>();
                                            Object.entries(targetNames).forEach(([email, name]) => {
                                                const match = name.match(/([1-6])학년/);
                                                if (match) seenGrades.add(match[1]);
                                            });

                                            let total = 0;
                                            let submittedCount = 0;

                                            if (seenGrades.size > 0) {
                                                total = seenGrades.size;
                                                seenGrades.forEach(g => {
                                                    const isSub = Object.entries(submissions).some(([k, s]) => String(s.grade) === g || k.endsWith(`_${g}`));
                                                    if (isSub) submittedCount++;
                                                });
                                            } else {
                                                const uniqueEmails = [...new Set(emails.map(e => e.toLowerCase()))];
                                                total = uniqueEmails.length;
                                                uniqueEmails.forEach(email => {
                                                    const isSub = !!submissions[email] || Object.values(submissions).some(s => s.submitterEmail?.toLowerCase() === email);
                                                    if (isSub) submittedCount++;
                                                });
                                            }

                                            total = Math.max(total, 1);
                                            submittedCount = Math.min(submittedCount, total);
                                            const pct = Math.min(100, Math.round((submittedCount / total) * 100));

                                            return (
                                                <div 
                                                    key={task.id} 
                                                    className="p-2 rounded-xl border border-slate-200 bg-white shadow-xs hover:border-indigo-300 transition-all flex items-center justify-between gap-2"
                                                >
                                                    <div className="space-y-0.5 min-w-0 flex-1">
                                                        <div className="flex items-center gap-1.5">
                                                            <span className="text-[10px] text-slate-500 font-semibold">
                                                                제출: {submittedCount}/{total}명 ({pct}%)
                                                            </span>
                                                            <span className="text-[10px] text-rose-600">
                                                                마감: {task.deadline}
                                                            </span>
                                                        </div>
                                                        <h4 className="font-bold text-slate-900 text-xs truncate">{task.title}</h4>
                                                    </div>

                                                    <Button
                                                        size="sm"
                                                        variant="outline"
                                                        onClick={() => setViewingSubmissionsTask(task)}
                                                        className="h-6 px-2 text-[10px] font-bold rounded-lg border-indigo-200 text-indigo-700 hover:bg-indigo-50 shrink-0"
                                                    >
                                                        조회
                                                    </Button>
                                                </div>
                                            );
                                        })}
                                    </div>
                                );
                            })()}
                        </div>
                    </div>
                </Card>
            </div>

            {/* ── 부서 업무 생성 / 제출 / 현황 다이얼로그 모달 ── */}
            {isCreateTaskOpen && (
                <CreateDepartmentTaskDialog 
                    open={isCreateTaskOpen}
                    onOpenChange={setIsCreateTaskOpen}
                    orgData={orgData}
                    allTeachers={allFaculty}
                />
            )}

            {isCreateWeeklyScheduleOpen && (
                <CreateWeeklyScheduleDialog 
                    open={isCreateWeeklyScheduleOpen}
                    onOpenChange={setIsCreateWeeklyScheduleOpen}
                    orgData={orgData}
                    userDept={myBelongingInfo.department || profile?.dept}
                />
            )}

            {isCreateProposalOpen && (
                <CreateWeeklyProposalDialog 
                    open={isCreateProposalOpen}
                    onOpenChange={setIsCreateProposalOpen}
                    orgData={orgData}
                    userDept={myBelongingInfo.department || profile?.dept}
                />
            )}

            {reviewingProposal && (
                <ReviewWeeklyProposalDialog 
                    open={!!reviewingProposal}
                    proposal={reviewingProposal}
                    onOpenChange={(open) => !open && setReviewingProposal(null)}
                />
            )}

            <SubmitDepartmentTaskDialog 
                task={submittingTask}
                open={!!submittingTask}
                onOpenChange={(open) => !open && setSubmittingTask(null)}
            />

            <TaskSubmissionsDialog 
                task={viewingSubmissionsTask}
                open={!!viewingSubmissionsTask}
                onOpenChange={(open) => !open && setViewingSubmissionsTask(null)}
            />

            {/* 스쿨버스 이동 분기 선택 다이얼로그 */}
            <Dialog open={isBusDialogOpen} onOpenChange={setIsBusDialogOpen}>
              <DialogContent className="sm:max-w-md p-6">
                <DialogHeader className="text-center">
                  <DialogTitle className="text-lg font-bold flex items-center justify-center gap-2">
                    <Bus className="h-5 w-5 text-blue-500" />스쿨버스 서비스 연결
                  </DialogTitle>
                  <DialogDescription className="text-xs pt-1">
                    스쿨버스 담당자 권한을 가지고 있습니다. 이동할 페이지를 선택해주세요.
                  </DialogDescription>
                </DialogHeader>
                <div className="flex flex-col gap-3 py-4">
                  <Button 
                    className="h-12 justify-start px-4 text-left font-semibold text-sm border-blue-100 hover:bg-blue-50/50" 
                    variant="outline"
                    onClick={() => {
                      setIsBusDialogOpen(false);
                      router.push("/admin/bus");
                    }}
                  >
                    <ShieldAlert className="mr-3 h-5 w-5 text-blue-600 shrink-0" />
                    <div className="flex flex-col">
                      <span>스쿨버스 관리자 페이지 이동</span>
                      <span className="text-[11px] text-muted-foreground font-normal">노선 기안, 버스 배치, 전반적인 데이터 셋업</span>
                    </div>
                  </Button>
                  <Button 
                    className="h-12 justify-start px-4 text-left font-semibold text-sm border-slate-100 hover:bg-slate-50" 
                    variant="outline"
                    onClick={() => {
                      setIsBusDialogOpen(false);
                      router.push("/teacher/bus");
                    }}
                  >
                    <Navigation className="mr-3 h-5 w-5 text-slate-500 shrink-0" />
                    <div className="flex flex-col">
                      <span>스쿨버스 선생님/도우미 페이지 이동</span>
                      <span className="text-[11px] text-muted-foreground font-normal">노선 조회, 학생 탑승 출결 등록 및 체크</span>
                    </div>
                  </Button>
                </div>
              </DialogContent>
            </Dialog>

            {/* 방과후학교 이동 분기 선택 다이얼로그 */}
            <Dialog open={isAfterschoolDialogOpen} onOpenChange={setIsAfterschoolDialogOpen}>
              <DialogContent className="sm:max-w-md p-6">
                <DialogHeader className="text-center">
                  <DialogTitle className="text-lg font-bold flex items-center justify-center gap-2">
                    <BookOpen className="h-5 w-5 text-teal-500" />방과후학교 서비스 연결
                  </DialogTitle>
                  <DialogDescription className="text-xs pt-1">
                    방과후학교 담당자 권한을 가지고 있습니다. 이동할 페이지를 선택해주세요.
                  </DialogDescription>
                </DialogHeader>
                <div className="flex flex-col gap-3 py-4">
                  <Button 
                    className="h-12 justify-start px-4 text-left font-semibold text-sm border-teal-100 hover:bg-teal-50/50" 
                    variant="outline"
                    onClick={() => {
                      setIsAfterschoolDialogOpen(false);
                      router.push("/admin/afterschool");
                    }}
                  >
                    <ShieldAlert className="mr-3 h-5 w-5 text-teal-600 shrink-0" />
                    <div className="flex flex-col">
                      <span>방과후학교 관리자 콘솔 이동</span>
                      <span className="text-[11px] text-muted-foreground font-normal">강좌 개설, 수강생 승인, 대기 현황 관리</span>
                    </div>
                  </Button>
                  <Button 
                    className="h-12 justify-start px-4 text-left font-semibold text-sm border-slate-100 hover:bg-slate-50" 
                    variant="outline"
                    onClick={() => {
                      setIsAfterschoolDialogOpen(false);
                      router.push("/teacher/afterschool");
                    }}
                  >
                    <Navigation className="mr-3 h-5 w-5 text-slate-500 shrink-0" />
                    <div className="flex flex-col">
                      <span>방과후학교 선생님 페이지 이동</span>
                      <span className="text-[11px] text-muted-foreground font-normal">강사 일지 및 강좌별 출석부 체크</span>
                    </div>
                  </Button>
                </div>
              </DialogContent>
            </Dialog>

            {/* 6. 유초등 주간교육계획 모달 다이얼로그 */}
            <WeeklyEducationPlanModal 
              open={isWeeklyPlanModalOpen}
              onOpenChange={setIsWeeklyPlanModalOpen}
              academicEvents={academicEvents}
              weeklySchedules={weeklySchedules}
              orgData={orgData}
            />

            {/* 7. 유초등 월간 교육활동 계획 모달 다이얼로그 */}
            <MonthlyEducationPlanModal 
              open={isMonthlyPlanModalOpen}
              onOpenChange={setIsMonthlyPlanModalOpen}
              academicEvents={academicEvents}
              weeklySchedules={weeklySchedules}
              orgData={orgData}
            />

            {/* 8. 대시보드 주요 업무 바로가기 개인화 설정 모달 */}
            <MajorTasksModal
              open={isMajorTasksModalOpen}
              onOpenChange={setIsMajorTasksModalOpen}
              selectedIds={selectedMajorTaskIds}
              onSave={(newIds) => setSelectedMajorTaskIds(newIds)}
            />

            {/* 9. 주간 및 월간 교육일정 캘린더 동기화 모달 */}
            <ScheduleCalendarSyncModal
              open={isScheduleSyncModalOpen}
              onOpenChange={setIsScheduleSyncModalOpen}
              weeklySchedules={weeklySchedules}
              academicEvents={academicEvents}
            />
        </MainLayout>
    );
}
