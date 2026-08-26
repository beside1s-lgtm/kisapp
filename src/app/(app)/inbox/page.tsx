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
  onAfterschoolTimerUpdate 
} from "@/lib/services/settingsService";
import { 
  onDepartmentTasksUpdate 
} from "@/lib/services/departmentTaskService";
import { DocumentList } from "@/components/document-list";
import { useAuth } from "@/hooks/use-auth";
import { ApprovalDoc, DepartmentTask } from "@/lib/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Inbox, Send, Briefcase, Users, Loader2, Clock, BookOpen, Bus, 
  ShieldAlert, Navigation, Calendar, ClipboardList, CheckCircle2, 
  Plus, Trash2, CheckSquare, Sparkles, Building2, School, FileUp, 
  FileText, FolderOpen, ArrowRight, AlertCircle, CheckCircle, UserCheck
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
import { SubmitDepartmentTaskDialog } from "@/components/tasks/submit-department-task-dialog";
import { TaskSubmissionsDialog } from "@/components/tasks/task-submissions-dialog";
import { PwaInstallBanner } from "@/components/pwa-install-banner";

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

    // 방과후학교 실시간 단계 연동 상태
    const [afterschoolCourses, setAfterschoolCourses] = useState<any[]>([]);
    const [afterschoolEnrollments, setAfterschoolEnrollments] = useState<any[]>([]);
    const [afterschoolTimer, setAfterschoolTimer] = useState<any>(null);

    // 나의 업무 할 일 (Todo) 상태
    const [myTasks, setMyTasks] = useState<Array<{ id: string; text: string; completed: boolean; createdAt: string }>>([]);
    const [newTaskText, setNewTaskText] = useState("");

    // 1. 실시간 부서 업무 구독
    useEffect(() => {
        const unsub = onDepartmentTasksUpdate((tasks) => {
            setDeptTasks(tasks);
        });
        return () => unsub();
    }, []);

    // 2. 전체 교직원 목록 로드
    useEffect(() => {
        getUsersDirectory().then(users => {
            setAllFaculty(users.map(u => ({ email: u.email, name: u.name, dept: u.dept || u.role })));
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

    // Load & Persist My Tasks (Todo list)
    useEffect(() => {
        if (profile?.email && typeof window !== 'undefined') {
            const storageKey = `my_dept_tasks_${profile.email.toLowerCase()}`;
            const saved = localStorage.getItem(storageKey);
            if (saved) {
                try {
                    setMyTasks(JSON.parse(saved));
                } catch {
                    // fallback
                }
            } else {
                const starterTasks = [
                    { id: '1', text: '2026학년도 학사 및 등교지도 캘린더 동기화 확인', completed: false, createdAt: new Date().toISOString() },
                    { id: '2', text: '소속 부서 및 학급 주간 계획 검토', completed: false, createdAt: new Date().toISOString() },
                    { id: '3', text: '결재 대기 문서 확인 및 처리', completed: false, createdAt: new Date().toISOString() }
                ];
                setMyTasks(starterTasks);
                localStorage.setItem(storageKey, JSON.stringify(starterTasks));
            }
        }
    }, [profile?.email]);

    const saveTasks = (tasks: typeof myTasks) => {
        setMyTasks(tasks);
        if (profile?.email && typeof window !== 'undefined') {
            localStorage.setItem(`my_dept_tasks_${profile.email.toLowerCase()}`, JSON.stringify(tasks));
        }
    };

    const handleToggleTask = (id: string) => {
        const updated = myTasks.map(t => t.id === id ? { ...t, completed: !t.completed } : t);
        saveTasks(updated);
    };

    const handleAddTask = (e: React.FormEvent) => {
        e.preventDefault();
        if (!newTaskText.trim()) return;
        const newTask = {
            id: Date.now().toString(),
            text: newTaskText.trim(),
            completed: false,
            createdAt: new Date().toISOString()
        };
        const updated = [newTask, ...myTasks];
        saveTasks(updated);
        setNewTaskText("");
    };

    const handleDeleteTask = (id: string) => {
        const updated = myTasks.filter(t => t.id !== id);
        saveTasks(updated);
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
            belongs: belongsList.length > 0 ? belongsList.join(', ') : (profile.dept || '교직원'),
            managers: managerList.length > 0 ? managerList.join(', ') : '업무 미지정',
            homeroom,
            department,
            isHead,
            belongsList,
            managerList
        };
    }, [profile, orgData]);

    const handleBusClick = (e: React.MouseEvent) => {
        if (isBusManager) {
            e.preventDefault();
            setIsBusDialogOpen(true);
        }
        // 담당자가 아니면 Link의 원래 href(/teacher/bus)로 기본 이동
    };

    const handleAfterschoolClick = (e: React.MouseEvent) => {
        if (isAfterschoolManager) {
            e.preventDefault();
            setIsAfterschoolDialogOpen(true);
        }
        // 담당자가 아니면 Link의 원래 href(/teacher/afterschool)로 기본 이동
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

    const pendingParentDocs = useMemo(() => {
        return parentDocs.filter(d => d.status === 'pending');
    }, [parentDocs]);

    if (loading) {
        return (
            <div className="flex h-full w-full items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        );
    }

    const stats = [
        {
            id: "inbox",
            title: "결재 대기 문서",
            count: inboxDocs.length,
            icon: Inbox,
            color: "text-blue-500",
            bgColor: "bg-blue-500/10",
        },
        {
            id: "pending",
            title: "진행 중인 상신 문서",
            count: pendingDocs.length,
            icon: Send,
            color: "text-amber-500",
            bgColor: "bg-amber-500/10",
        },
        {
            id: "teacher",
            title: "내 복무 신청 현황",
            count: teacherDocs.length,
            icon: Briefcase,
            color: "text-emerald-500",
            bgColor: "bg-emerald-500/10",
        },
        {
            id: "parent",
            title: "학부모 출결 문서",
            count: pendingParentDocs.length,
            icon: Users,
            color: "text-purple-500",
            bgColor: "bg-purple-500/10",
        },
    ];

    return (
        <div className="space-y-6 p-4 md:p-8 font-body">
            <div>
                <h1 className="font-headline text-2xl sm:text-3xl font-bold">대시보드</h1>
                <p className="text-muted-foreground text-xs sm:text-sm mt-0.5">결재 문서 및 대내외 업무 진행 상황 요약입니다.</p>
            </div>

            {/* Stats Grid - 컴팩트 슬림 카드 (하단 설명 문구 제거 및 높이 50% 축소) */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
                {stats.map((stat) => {
                    const Icon = stat.icon;
                    const isActive = activeTab === stat.id;
                    return (
                        <Card
                            key={stat.id}
                            className={cn(
                                "cursor-pointer transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md border p-3 sm:p-4 rounded-xl",
                                isActive ? "ring-2 ring-primary border-primary shadow-xs bg-primary/[0.02]" : "hover:border-primary/30"
                            )}
                            onClick={() => setActiveTab(stat.id)}
                        >
                            <div className="flex items-center justify-between gap-2">
                                <span className="text-xs sm:text-sm font-semibold text-muted-foreground truncate whitespace-nowrap">
                                    {stat.title}
                                </span>
                                <div className={cn("p-1.5 rounded-lg shrink-0", stat.bgColor)}>
                                    <Icon className={cn("h-4 w-4 sm:h-4.5 sm:w-4.5", stat.color)} />
                                </div>
                            </div>
                            <div className="text-2xl sm:text-3xl font-black text-foreground mt-1">
                                {stat.count}
                            </div>
                        </Card>
                    );
                })}
            </div>

            {/* Tabs Content */}
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                <TabsList className="hidden">
                    <TabsTrigger value="inbox">결재 대기 문서</TabsTrigger>
                    <TabsTrigger value="pending">진행 중인 상신 문서</TabsTrigger>
                    <TabsTrigger value="teacher">내 복무 신청 현황</TabsTrigger>
                    <TabsTrigger value="parent">학부모 출결 문서</TabsTrigger>
                </TabsList>
                
                <TabsContent value="inbox" className="space-y-4">
                    <div className="flex items-center gap-2 mb-2">
                        <Inbox className="h-5 w-5 text-blue-500" />
                        <h2 className="text-xl font-bold">결재 대기 문서 목록 ({inboxDocs.length})</h2>
                    </div>
                    <DocumentList documents={inboxDocs} />
                </TabsContent>
                
                <TabsContent value="pending" className="space-y-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2">
                        <div className="flex items-center gap-2">
                            <Send className="h-5 w-5 text-amber-500" />
                            <h2 className="text-xl font-bold">진행 중인 상신 문서 목록 ({pendingDocs.length})</h2>
                        </div>
                        <div className="flex items-center gap-2 text-xs">
                            <Button asChild variant="outline" size="sm" className="h-8 text-xs font-semibold gap-1">
                                <Link href="/sent">
                                    <Send className="w-3.5 h-3.5" /> 상신함 전체보기
                                </Link>
                            </Button>
                            <Button asChild variant="outline" size="sm" className="h-8 text-xs font-semibold gap-1 text-primary border-primary/30">
                                <Link href="/registry">
                                    문서등록대장 바로가기 →
                                </Link>
                            </Button>
                        </div>
                    </div>
                    {pendingDocs.length === 0 && (
                        <div className="p-6 bg-slate-50 border rounded-xl text-center space-y-2">
                            <p className="text-sm font-semibold text-slate-700">현재 결재가 진행 중인 상신 문서가 없습니다.</p>
                            <p className="text-xs text-muted-foreground">
                                결재가 최종 완료된 문서는 <Link href="/sent" className="text-primary underline font-bold">상신함</Link> 또는 <Link href="/registry" className="text-primary underline font-bold">문서등록대장</Link>에서 확인하실 수 있습니다.
                            </p>
                        </div>
                    )}
                    {pendingDocs.length > 0 && <DocumentList documents={pendingDocs} />}
                </TabsContent>
                
                <TabsContent value="teacher" className="space-y-4">
                    <div className="flex items-center gap-2 mb-2">
                        <Briefcase className="h-5 w-5 text-emerald-500" />
                        <h2 className="text-xl font-bold">내 복무 및 초과근무 신청 목록 ({teacherDocs.length})</h2>
                    </div>

                    {/* ── 복무 통계 카드 ── */}
                    {dutyStats && (
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 bg-card border rounded-2xl p-6 shadow-sm mb-2">
                            {/* 연가 현황 */}
                            <div className="space-y-4">
                                <div className="flex justify-between items-center">
                                    <span className="text-sm font-medium text-muted-foreground">연가 사용 현황 (잔여 / 총)</span>
                                    <span className="text-sm font-bold text-emerald-500">
                                        {dutyStats.annualRemaining}일 / {dutyStats.annualLimit}일
                                    </span>
                                </div>
                                <div className="space-y-2">
                                    <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
                                        <div 
                                            className="h-full bg-emerald-500 transition-all duration-500"
                                            style={{ width: `${Math.min((dutyStats.totalAnnualUsed / dutyStats.annualLimit) * 100, 100)}%` }}
                                        />
                                    </div>
                                    <div className="flex justify-between text-xs text-muted-foreground">
                                        <span>사용 {dutyStats.totalAnnualUsed}일 (연가 {dutyStats.annualUsed}일 + 조퇴 {dutyStats.earlyConvertedDays}일 환산)</span>
                                        <span>잔여 {dutyStats.annualRemaining}일</span>
                                    </div>
                                </div>
                            </div>

                            {/* 조퇴/지참 시간 누계 */}
                            <div className="space-y-3 md:border-l md:border-r md:px-6">
                                <div className="text-sm font-medium text-muted-foreground">조퇴/지참 누계 시간</div>
                                <div className="text-2xl font-black text-amber-500">{dutyStats.earlyUsedHours} 시간</div>
                                <p className="text-xs text-muted-foreground">
                                    누계 {dutyStats.earlyUsedHours}시간 중 {dutyStats.earlyConvertedDays}일은 연가로 차감 완료되었으며, 
                                    현재 8시간 미만 잔여 분은 <strong>{dutyStats.remainingEarlyHours}시간</strong> 입니다.
                                </p>
                            </div>

                            {/* 병결 및 기타 복무 */}
                            <div className="space-y-3">
                                <div className="text-sm font-medium text-muted-foreground">기타 복무 사용 내역</div>
                                <div className="flex items-center gap-4 text-sm font-bold">
                                    <div>병결: <span className="text-rose-500">{dutyStats.sickUsed}일</span></div>
                                    <div>기타: <span className="text-blue-500">{dutyStats.otherUsed}일</span></div>
                                </div>
                                <p className="text-xs text-muted-foreground">
                                    병결 및 특별휴가는 연가 일수에서 차감되지 않습니다.
                                </p>
                            </div>
                        </div>
                    )}

                    {/* ── 월별 초과근무 차트 카드 ── */}
                    <div className="bg-card border rounded-2xl p-6 shadow-sm mb-2">
                        <div className="flex items-center gap-2 mb-4">
                            <div className="p-2 rounded-lg bg-violet-500/10">
                                <Clock className="h-4 w-4 text-violet-500" />
                            </div>
                            <div>
                                <h3 className="text-sm font-semibold">월별 초과근무 현황</h3>
                                <p className="text-xs text-muted-foreground">{new Date().getFullYear()}년 · 결재 완료·진행중 기준</p>
                            </div>
                        </div>
                        <OvertimeBarChart data={overtimeChart} />
                    </div>

                    <DocumentList documents={teacherDocs} />
                </TabsContent>
                
                <TabsContent value="parent" className="space-y-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2">
                        <div className="flex items-center gap-2">
                            <Users className="h-5 w-5 text-purple-500" />
                            <h2 className="text-xl font-bold">진행 중인 학부모 출결 문서 ({pendingParentDocs.length})</h2>
                        </div>
                        <div className="flex items-center gap-2 text-xs">
                            <Button asChild variant="outline" size="sm" className="h-8 text-xs font-semibold gap-1">
                                <Link href="/attendance-registry">
                                    <FileText className="w-3.5 h-3.5" /> 결석계 보관함
                                </Link>
                            </Button>
                            <Button asChild variant="outline" size="sm" className="h-8 text-xs font-semibold gap-1">
                                <Link href="/field-trip-registry">
                                    <FolderOpen className="w-3.5 h-3.5" /> 체험학습 문서함
                                </Link>
                            </Button>
                        </div>
                    </div>
                    <DocumentList documents={pendingParentDocs} />
                </TabsContent>
            </Tabs>

            {/* ── 나의 업무 (My Tasks & Department Duties) ── */}
            <div className="space-y-5 pt-6 border-t border-slate-200">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5">
                        <div className="p-2 bg-indigo-500/10 rounded-xl text-indigo-600">
                            <ClipboardList className="h-5 w-5" />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-slate-900 font-headline">나의 업무</h2>
                            <p className="text-xs text-muted-foreground">소속 부서와 학급의 현행 운영 업무를 실시간으로 해결하고, 부서/학년 업무를 할당·제출합니다.</p>
                        </div>
                    </div>

                    {/* 소속 / 담당 배지 요약 */}
                    <div className="flex items-center gap-1.5 flex-wrap">
                        {myBelongingInfo.belongsList.map((b, idx) => (
                            <Badge key={idx} variant="outline" className="bg-indigo-50/70 border-indigo-200 text-indigo-800 text-[11px] font-semibold">
                                {b}
                            </Badge>
                        ))}
                        {myBelongingInfo.managerList.map((m, idx) => (
                            <Badge key={idx} variant="outline" className="bg-blue-50/70 border-blue-200 text-blue-800 text-[11px] font-semibold">
                                담당: {m}
                            </Badge>
                        ))}
                        <Badge variant="outline" className="bg-slate-100 border-slate-200 text-slate-700 text-[11px] font-semibold">
                            {profile?.role || '교사'}
                        </Badge>
                    </div>
                </div>

                {/* ── 1. 소속 부서 및 학급 '실시간 현행 업무(Current Stage Operations)' 브리핑 카드 ── */}
                <div className="space-y-2.5">
                    <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                        <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                        소속 부서 & 학급 현행 단계별 실시간 업무
                    </h3>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
                        {/* 1) 방과후학교 현행 단계별 동적 카드 (담당자 / 부서원) */}
                        {(isAfterschoolManager || myBelongingInfo.department?.includes('방과후') || myBelongingInfo.managerList.includes('방과후학교')) && (() => {
                            const pendingCourses = afterschoolCourses.filter(c => c.status === 'PENDING');
                            const openCourses = afterschoolCourses.filter(c => c.status === 'OPEN');
                            const isTimerOpen = afterschoolTimer?.masterStatus === 'OPEN';

                            let stageBadge = '운영 단계: 강좌 개설 및 심사';
                            let stageTitle = '신규 강좌 개설 신청 현황';
                            let stageDesc = `신규 개설 신청 강좌 ${pendingCourses.length}건이 심사 대기 중입니다.`;
                            let actionText = '강좌 심사 및 승인 →';

                            if (isTimerOpen) {
                                stageBadge = '운영 단계: 수강 신청 접수 기간';
                                stageTitle = '방과후 수강 신청 실시간 접수 현황';
                                stageDesc = `현재 총 ${afterschoolEnrollments.length}건의 학생 수강 신청이 접수되었습니다.`;
                                actionText = '수강 신청 현황 보기 →';
                            } else if (pendingCourses.length > 0) {
                                stageBadge = '운영 단계: 강좌 심사 기간';
                                stageTitle = `강좌 신청 승인 대기 (${pendingCourses.length}건)`;
                                stageDesc = `제출된 강좌 계획서 ${pendingCourses.length}건의 검토 및 승인이 필요합니다.`;
                                actionText = '강좌 검토 바로가기 →';
                            } else if (openCourses.length > 0) {
                                stageBadge = '운영 단계: 학기 운영 및 출결 관리';
                                stageTitle = '방과후 출석부 및 수강생 관리';
                                stageDesc = `총 ${openCourses.length}개 강좌가 정상 개설되어 운영 중입니다.`;
                                actionText = '출석부 관리 콘솔 →';
                            } else {
                                stageBadge = '운영 단계: 강사 모집 및 강좌 개설 기간';
                                stageTitle = '방과후 신규 강사 모집 및 강좌 신청';
                                stageDesc = '2026학년도 방과후학교 신규 강사 모집 및 개설 강좌를 접수·관리합니다.';
                                actionText = '강좌 개설 및 관리 →';
                            }

                            return (
                                <Link 
                                    href={isAfterschoolManager ? "/admin/afterschool" : "/teacher/afterschool"} 
                                    className="group" 
                                    onClick={handleAfterschoolClick}
                                >
                                    <div className="p-4 rounded-2xl border border-teal-200 bg-linear-to-br from-teal-50/80 via-white to-white hover:border-teal-400 hover:shadow-md transition-all h-full flex flex-col justify-between">
                                        <div className="space-y-1.5">
                                            <div className="flex items-center justify-between">
                                                <Badge className="bg-teal-600 text-white text-[10px] px-2 py-0.5 font-bold">
                                                    {stageBadge}
                                                </Badge>
                                                <span className="text-xs font-bold text-teal-600 group-hover:translate-x-0.5 transition-transform">
                                                    {actionText}
                                                </span>
                                            </div>
                                            <h4 className="font-bold text-slate-900 text-sm mt-1">{stageTitle}</h4>
                                            <p className="text-xs text-slate-600 leading-relaxed">
                                                {stageDesc}
                                            </p>
                                        </div>
                                    </div>
                                </Link>
                            );
                        })()}

                        {/* 3) 스쿨버스 현행 운행 관리 카드 (담당자 / 교사) */}
                        {(isBusManager || myBelongingInfo.managerList.includes('스쿨버스')) && (
                            <Link href={isBusManager ? "/admin/bus" : "/teacher/bus"} className="group" onClick={handleBusClick}>
                                <div className="p-4 rounded-2xl border border-blue-200 bg-linear-to-br from-blue-50/80 via-white to-white hover:border-blue-400 hover:shadow-md transition-all h-full flex flex-col justify-between">
                                    <div className="space-y-1.5">
                                        <div className="flex items-center justify-between">
                                            <Badge className="bg-blue-600 text-white text-[10px] px-2 py-0.5 font-bold">
                                                스쿨버스 현행 업무
                                            </Badge>
                                            <span className="text-xs font-bold text-blue-600 group-hover:translate-x-0.5 transition-transform">
                                                탑승 현황 관리 →
                                            </span>
                                        </div>
                                        <h4 className="font-bold text-slate-900 text-sm mt-1">오늘의 스쿨버스 운행 및 승하차</h4>
                                        <p className="text-xs text-slate-600 leading-relaxed">
                                            호차별 탑승 명단 확인 및 실시간 탑승·하차 체크, 안전 운행을 관리합니다.
                                        </p>
                                    </div>
                                </div>
                            </Link>
                        )}
                    </div>
                </div>

                {/* ── 2. 부서·학년·선택 그룹 업무 할당 및 제출 관리 워크플로우 ── */}
                <div className="space-y-3 pt-2">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b pb-2">
                        {/* Sub Tabs: 나에게 할당된 업무 vs 내가 요청한 업무 현황 */}
                        <div className="flex items-center gap-2">
                            {(() => {
                                const myEmail = profile?.email?.toLowerCase() || '';
                                const assignedCount = deptTasks.filter(t => t.targetEmails?.some(e => e.toLowerCase() === myEmail)).length;
                                const createdCount = deptTasks.filter(t => t.creatorEmail?.toLowerCase() === myEmail || myBelongingInfo.isHead || profile?.isAdmin).length;

                                return (
                                    <>
                                        <button
                                            type="button"
                                            onClick={() => setActiveTaskSubTab('assigned')}
                                            className={cn(
                                                "px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5",
                                                activeTaskSubTab === 'assigned'
                                                    ? "bg-indigo-600 text-white shadow-xs"
                                                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                                            )}
                                        >
                                            <Inbox className="w-3.5 h-3.5" />
                                            <span>나에게 할당된 업무</span>
                                            <Badge className={cn("px-1.5 py-0 text-[10px] h-4 leading-none font-bold", activeTaskSubTab === 'assigned' ? "bg-white text-indigo-700" : "bg-slate-300 text-slate-800")}>
                                                {assignedCount}
                                            </Badge>
                                        </button>

                                        <button
                                            type="button"
                                            onClick={() => setActiveTaskSubTab('created')}
                                            className={cn(
                                                "px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5",
                                                activeTaskSubTab === 'created'
                                                    ? "bg-indigo-600 text-white shadow-xs"
                                                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                                            )}
                                        >
                                            <Send className="w-3.5 h-3.5" />
                                            <span>내가 요청한 업무 현황 (부서장/출제자)</span>
                                            <Badge className={cn("px-1.5 py-0 text-[10px] h-4 leading-none font-bold", activeTaskSubTab === 'created' ? "bg-white text-indigo-700" : "bg-slate-300 text-slate-800")}>
                                                {createdCount}
                                            </Badge>
                                        </button>
                                    </>
                                );
                            })()}
                        </div>

                        {/* 부서/학년 업무 신규 할당 버튼 */}
                        <Button 
                            size="sm" 
                            onClick={() => setIsCreateTaskOpen(true)}
                            className="h-8 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl shadow-xs flex items-center gap-1.5"
                        >
                            <Plus className="w-3.5 h-3.5 text-amber-300" />
                            <span>+ 새 부서 / 학년 업무 요청 생성</span>
                        </Button>
                    </div>

                    {/* 워크플로우 뷰 영역 + 우측 Todo 체크리스트 */}
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
                        {/* 좌측 2열: 업무 카드 목록 */}
                        <div className="lg:col-span-2 space-y-3">
                            {/* [View 1] 나에게 할당된 업무 목록 (부서원 뷰) */}
                            {activeTaskSubTab === 'assigned' && (() => {
                                const myEmail = profile?.email?.toLowerCase() || '';
                                const myAssignedList = deptTasks.filter(t => t.targetEmails?.some(e => e.toLowerCase() === myEmail));

                                if (myAssignedList.length === 0) {
                                    return (
                                        <div className="bg-slate-50 border border-dashed border-slate-200 rounded-2xl p-8 text-center text-slate-400 space-y-2">
                                            <ClipboardList className="w-8 h-8 mx-auto text-slate-300" />
                                            <p className="text-xs font-semibold">현재 나에게 할당된 부서 및 학년 업무가 없습니다.</p>
                                            <p className="text-[11px] text-slate-400">부서장이나 학년부장이 업무를 요청하면 이곳에 제출 버튼과 함께 표시됩니다.</p>
                                        </div>
                                    );
                                }

                                return (
                                    <div className="space-y-2.5">
                                        {myAssignedList.map((task) => {
                                            const sub = task.submissions?.[myEmail];
                                            const isSubmitted = !!sub;

                                            return (
                                                <div 
                                                    key={task.id} 
                                                    className="p-4 rounded-2xl border border-slate-200 bg-white shadow-xs hover:border-indigo-300 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3.5"
                                                >
                                                    <div className="space-y-1.5 min-w-0 flex-1">
                                                        <div className="flex items-center gap-2 flex-wrap">
                                                            <Badge className="bg-indigo-600 text-white text-[10px] px-2 py-0.5 font-bold">
                                                                {task.creatorDept || '부서 요청'}
                                                            </Badge>
                                                            <span className="text-xs text-slate-500 font-medium">
                                                                요청자: <strong>{task.creatorName}</strong>
                                                            </span>
                                                            <span className="text-xs text-rose-600 font-semibold flex items-center gap-0.5">
                                                                <Calendar className="w-3 h-3" />
                                                                마감: {task.deadline}
                                                            </span>
                                                            {isSubmitted ? (
                                                                <Badge className="bg-emerald-500 text-white text-[10px] px-1.5 py-0 h-4 leading-none font-bold">
                                                                    ✓ 제출 완료
                                                                </Badge>
                                                            ) : (
                                                                <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-300 text-[10px] px-1.5 py-0 h-4 leading-none font-semibold">
                                                                    ⏳ 미제출
                                                                </Badge>
                                                            )}
                                                        </div>

                                                        <h4 className="font-bold text-slate-900 text-sm">{task.title}</h4>
                                                        {task.description && (
                                                            <p className="text-xs text-slate-500 line-clamp-2 leading-relaxed">
                                                                {task.description}
                                                            </p>
                                                        )}
                                                    </div>

                                                    {/* 액션: OO문서 제출하기 버튼 */}
                                                    <div className="shrink-0 flex items-center gap-2">
                                                        <Button
                                                            size="sm"
                                                            onClick={() => setSubmittingTask(task)}
                                                            className={cn(
                                                                "h-9 px-4 text-xs font-extrabold rounded-xl shadow-xs flex items-center gap-1.5",
                                                                isSubmitted 
                                                                    ? "bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300"
                                                                    : "bg-indigo-600 hover:bg-indigo-700 text-white"
                                                            )}
                                                        >
                                                            <FileUp className="w-3.5 h-3.5 text-amber-300" />
                                                            <span>
                                                                {isSubmitted 
                                                                    ? '제출 내역 수정/확인' 
                                                                    : task.taskType === 'file_submission' 
                                                                    ? `${task.title.length > 12 ? '문서' : task.title} 제출하기` 
                                                                    : '확인 완료하기'}
                                                            </span>
                                                        </Button>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                );
                            })()}

                            {/* [View 2] 내가 요청한 업무 현황 (부서장 뷰) */}
                            {activeTaskSubTab === 'created' && (() => {
                                const myEmail = profile?.email?.toLowerCase() || '';
                                const myCreatedList = deptTasks.filter(t => 
                                    t.creatorEmail?.toLowerCase() === myEmail || 
                                    myBelongingInfo.isHead || 
                                    profile?.isAdmin
                                );

                                if (myCreatedList.length === 0) {
                                    return (
                                        <div className="bg-slate-50 border border-dashed border-slate-200 rounded-2xl p-8 text-center text-slate-400 space-y-2">
                                            <Send className="w-8 h-8 mx-auto text-slate-300" />
                                            <p className="text-xs font-semibold">내가 생성하여 요청한 부서/학년 업무가 없습니다.</p>
                                            <Button 
                                                size="sm" 
                                                variant="outline" 
                                                onClick={() => setIsCreateTaskOpen(true)}
                                                className="h-8 text-xs font-bold rounded-xl mt-2"
                                            >
                                                <Plus className="w-3.5 h-3.5 mr-1" />
                                                첫 부서 업무 생성하기
                                            </Button>
                                        </div>
                                    );
                                }

                                return (
                                    <div className="space-y-2.5">
                                        {myCreatedList.map((task) => {
                                            const submissions = task.submissions || {};
                                            const total = (task.targetEmails || []).length;
                                            const submitted = Object.keys(submissions).length;
                                            const percent = total > 0 ? Math.round((submitted / total) * 100) : 0;

                                            return (
                                                <div 
                                                    key={task.id} 
                                                    className="p-4 rounded-2xl border border-slate-200 bg-white shadow-xs hover:border-indigo-300 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3.5"
                                                >
                                                    <div className="space-y-1.5 min-w-0 flex-1">
                                                        <div className="flex items-center gap-2 flex-wrap">
                                                            <Badge className="bg-indigo-600 text-white text-[10px] px-2 py-0.5 font-bold">
                                                                {task.creatorDept || '부서 업무'}
                                                            </Badge>
                                                            <span className="text-xs text-slate-500 font-medium">
                                                                대상: <strong>{total}명</strong>
                                                            </span>
                                                            <span className="text-xs text-rose-600 font-semibold flex items-center gap-0.5">
                                                                <Calendar className="w-3 h-3" />
                                                                마감: {task.deadline}
                                                            </span>
                                                            <Badge variant="outline" className={percent === 100 ? "bg-emerald-50 text-emerald-700 border-emerald-300 text-[10px]" : "bg-slate-100 text-slate-700 text-[10px]"}>
                                                                {percent === 100 ? '✓ 전원 제출 완료' : `${submitted}/${total}명 제출`}
                                                            </Badge>
                                                        </div>

                                                        <h4 className="font-bold text-slate-900 text-sm">{task.title}</h4>
                                                        
                                                        {/* 실시간 제출 진행률 바 */}
                                                        <div className="flex items-center gap-2 max-w-sm pt-0.5">
                                                            <Progress value={percent} className="h-2 bg-slate-100 flex-1" />
                                                            <span className="text-[11px] font-bold text-indigo-600 shrink-0">{percent}%</span>
                                                        </div>
                                                    </div>

                                                    {/* 액션: 제출 현황 및 제출한 파일 확인하기 버튼 */}
                                                    <div className="shrink-0 flex items-center gap-2">
                                                        <Button
                                                            size="sm"
                                                            onClick={() => setViewingSubmissionsTask(task)}
                                                            className="h-9 px-4 text-xs font-extrabold bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-xl shadow-2xs flex items-center gap-1.5"
                                                        >
                                                            <FolderOpen className="w-3.5 h-3.5 text-indigo-600" />
                                                            <span>제출 현황 및 제출 파일 확인하기</span>
                                                        </Button>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                );
                            })()}
                        </div>

                        {/* 우측 1열: 나의 업무 할 일 (Todo Widget) */}
                        <div className="bg-card border rounded-2xl p-4 sm:p-5 shadow-xs flex flex-col justify-between">
                            <div className="space-y-3">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <CheckCircle2 className="w-4 h-4 text-primary" />
                                        <h3 className="font-bold text-sm text-slate-900">업무 할 일 (Todo)</h3>
                                    </div>
                                    <span className="text-[11px] text-muted-foreground font-semibold">
                                        {myTasks.filter(t => t.completed).length}/{myTasks.length} 완료
                                    </span>
                                </div>

                                {/* Task List */}
                                <div className="space-y-1.5 max-h-[220px] overflow-y-auto pr-1">
                                    {myTasks.map((task) => (
                                        <div 
                                            key={task.id}
                                            className={cn(
                                                "flex items-start justify-between gap-2 p-2 rounded-lg border text-xs transition-all",
                                                task.completed ? "bg-slate-50/80 border-slate-200 text-slate-400 line-through" : "bg-white border-slate-200 text-slate-800"
                                            )}
                                        >
                                            <div 
                                                className="flex items-start gap-2 cursor-pointer flex-1 min-w-0"
                                                onClick={() => handleToggleTask(task.id)}
                                            >
                                                <input 
                                                    type="checkbox" 
                                                    checked={task.completed} 
                                                    onChange={() => {}} 
                                                    className="mt-0.5 rounded text-primary focus:ring-0 cursor-pointer"
                                                />
                                                <span className="leading-snug break-all">{task.text}</span>
                                            </div>
                                            <button 
                                                onClick={() => handleDeleteTask(task.id)}
                                                className="text-slate-300 hover:text-rose-500 transition-colors p-0.5"
                                                title="삭제"
                                            >
                                                <Trash2 className="w-3.5 h-3.5" />
                                            </button>
                                        </div>
                                    ))}

                                    {myTasks.length === 0 && (
                                        <div className="text-center py-6 text-slate-400 text-xs">
                                            등록된 할 일이 없습니다.
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Add Task Form */}
                            <form onSubmit={handleAddTask} className="flex gap-1.5 pt-3 border-t mt-3">
                                <input 
                                    type="text"
                                    placeholder="새 업무 할 일 입력..."
                                    value={newTaskText}
                                    onChange={(e) => setNewTaskText(e.target.value)}
                                    className="flex-1 h-8 px-2.5 rounded-lg border text-xs focus:outline-none focus:ring-1 focus:ring-primary"
                                />
                                <Button type="submit" size="sm" className="h-8 px-2.5 text-xs font-bold shrink-0">
                                    <Plus className="w-3.5 h-3.5 mr-0.5" /> 추가
                                </Button>
                            </form>
                        </div>
                    </div>
                </div>
            </div>

            {/* ── 부서 업무 생성 / 제출 / 현황 다이얼로그 모달 ── */}
            <CreateDepartmentTaskDialog 
                open={isCreateTaskOpen}
                onOpenChange={setIsCreateTaskOpen}
                orgData={orgData}
                allTeachers={allFaculty}
            />

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

            {/* 하단 교원 연계 서비스 바로가기 배너 */}
            <div className="pt-6 border-t border-slate-200">
                <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
                    <Briefcase className="h-5 w-5 text-primary" />
                    교원 연계 서비스 바로가기
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {/* 방과후학교 배너 */}
                    <Link href="/teacher/afterschool" className="group" onClick={handleAfterschoolClick}>
                        <div className="p-6 rounded-2xl bg-gradient-to-br from-teal-500 via-emerald-600 to-teal-700 text-white shadow-lg shadow-teal-500/15 hover:shadow-teal-500/25 transition-all duration-300 hover:-translate-y-1 relative overflow-hidden flex flex-col justify-center min-h-[195px] border border-teal-400/20">
                            <div className="absolute right-0 bottom-0 translate-x-6 translate-y-6 opacity-10 group-hover:scale-110 transition-transform duration-500 pointer-events-none">
                                <BookOpen size={180} />
                            </div>
                            <div className="relative z-10 space-y-2.5">
                                <div className="flex items-center justify-between">
                                    <span className="bg-white/20 backdrop-blur-md text-white text-[10px] px-2.5 py-0.5 rounded-full font-bold uppercase tracking-wider whitespace-nowrap">
                                        Afterschool Program
                                    </span>
                                    <span className="text-xs font-bold flex items-center gap-1 group-hover:translate-x-1 transition-transform whitespace-nowrap bg-white/10 px-2 py-0.5 rounded-full">
                                        바로가기 &rarr;
                                    </span>
                                </div>
                                <h4 className="text-xl font-bold font-headline whitespace-nowrap">방과후학교 콘솔</h4>
                                <p className="text-xs text-teal-100/90 leading-relaxed">
                                    강좌 개설 기안, 출석부 기록, 대기 신청자 및 환불 조회를 종합 관리합니다.
                                </p>
                            </div>
                        </div>
                    </Link>

                    {/* 스쿨버스 배너 */}
                    <Link href="/teacher/bus" className="group" onClick={handleBusClick}>
                        <div className="p-6 rounded-2xl bg-gradient-to-br from-blue-500 via-indigo-600 to-blue-700 text-white shadow-lg shadow-blue-500/15 hover:shadow-blue-500/25 transition-all duration-300 hover:-translate-y-1 relative overflow-hidden flex flex-col justify-center min-h-[195px] border border-blue-400/20">
                            <div className="absolute right-0 bottom-0 translate-x-6 translate-y-6 opacity-10 group-hover:scale-110 transition-transform duration-500 pointer-events-none">
                                <Bus size={180} />
                            </div>
                            <div className="relative z-10 space-y-2.5">
                                <div className="flex items-center justify-between">
                                    <span className="bg-white/20 backdrop-blur-md text-white text-[10px] px-2.5 py-0.5 rounded-full font-bold uppercase tracking-wider whitespace-nowrap">
                                        School Bus System
                                    </span>
                                    <span className="text-xs font-bold flex items-center gap-1 group-hover:translate-x-1 transition-transform whitespace-nowrap bg-white/10 px-2 py-0.5 rounded-full">
                                        바로가기 &rarr;
                                    </span>
                                </div>
                                <h4 className="text-xl font-bold font-headline whitespace-nowrap">스쿨버스 노선 & 출결</h4>
                                <p className="text-xs text-blue-100/90 leading-relaxed">
                                    차량별 매핑된 학생 현황 및 실시간 노선 조회, 도우미용 출결을 확인합니다.
                                </p>
                            </div>
                        </div>
                    </Link>

                    {/* 통합 학생 마스터 계정 대시보드 배너 */}
                    <Link href="/admin/students" className="group">
                        <div className="p-6 rounded-2xl bg-gradient-to-br from-purple-600 via-indigo-700 to-slate-900 text-white shadow-lg shadow-indigo-500/15 hover:shadow-indigo-500/25 transition-all duration-300 hover:-translate-y-1 relative overflow-hidden flex flex-col justify-center min-h-[195px] border border-indigo-400/20">
                            <div className="absolute right-0 bottom-0 translate-x-6 translate-y-6 opacity-10 group-hover:scale-110 transition-transform duration-500 pointer-events-none">
                                <Users size={180} />
                            </div>
                            <div className="relative z-10 space-y-2.5">
                                <div className="flex items-center justify-between">
                                    <span className="bg-white/20 backdrop-blur-md text-white text-[10px] px-2.5 py-0.5 rounded-full font-bold uppercase tracking-wider whitespace-nowrap">
                                        Master Student DB
                                    </span>
                                    <span className="text-xs font-bold flex items-center gap-1 group-hover:translate-x-1 transition-transform whitespace-nowrap bg-white/10 px-2 py-0.5 rounded-full">
                                        대시보드 바로가기 &rarr;
                                    </span>
                                </div>
                                <h4 className="text-xl font-bold font-headline whitespace-nowrap">통합 학생 계정 관리</h4>
                                <p className="text-xs text-indigo-100/90 leading-relaxed">
                                    이메일 단일 계정 기반으로 방과후, 스쿨버스, 출결, 체험학습을 한곳에서 통합 관리합니다.
                                </p>
                            </div>
                        </div>
                    </Link>
                </div>
            </div>

            {/* 맨 하단: 2026학년도 학사 일정 & 등교지도 캘린더 동기화 배너 */}
            <div className="pt-2">
                <div 
                    onClick={() => window.dispatchEvent(new CustomEvent('openAcademicCalendarSyncModal'))}
                    className="group cursor-pointer p-4 sm:p-5 rounded-2xl bg-gradient-to-r from-indigo-50/90 via-blue-50/70 to-sky-50/90 border border-indigo-200/80 hover:border-indigo-400 hover:shadow-md transition-all duration-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3"
                >
                    <div className="flex items-center gap-3 min-w-0">
                        <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center font-bold shadow-xs shrink-0 group-hover:scale-105 transition-transform">
                            <Calendar className="w-5 h-5" />
                        </div>
                        <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-extrabold text-slate-900 text-sm sm:text-base">
                                    2026학년도 학사 일정 & 등교지도 캘린더 동기화
                                </span>
                                <Badge className="bg-indigo-100 text-indigo-700 hover:bg-indigo-200 text-[10px] font-bold border-indigo-200">
                                    교직원 맞춤
                                </Badge>
                            </div>
                            <p className="text-xs text-slate-600 mt-0.5">
                                학기/방학 기간, 휴업일, 행사 및 <strong>나의 등교지도 근무일(07:40~08:20, 하루 전 알림)</strong>을 내 구글/스마트폰 캘린더에 연동합니다.
                            </p>
                        </div>
                    </div>
                    <Button 
                        type="button" 
                        size="sm" 
                        onClick={(e) => {
                            e.stopPropagation();
                            window.dispatchEvent(new CustomEvent('openAcademicCalendarSyncModal'));
                        }}
                        className="h-9 px-4 text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl shadow-xs shrink-0 whitespace-nowrap self-stretch sm:self-auto"
                    >
                        <Calendar className="w-3.5 h-3.5 mr-1.5" />
                        캘린더 동기화 열기
                    </Button>
                </div>
            </div>

            {/* 메인 대시보드 하단 KIS 전용 앱 설치 배너 */}
            <PwaInstallBanner className="mt-6 mb-2" />

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
        </div>
    );
}
