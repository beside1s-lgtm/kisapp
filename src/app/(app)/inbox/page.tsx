'use client';

import {
  getInboxDocuments,
  getPendingDocuments,
  getMyTeacherDocuments,
  getParentServiceDocuments,
  getTeacherDutyStats,
  getOvertimeStatsByYear,
} from "@/lib/services/documentService";
import { saveUserProfile } from "@/lib/services/userService";
import { DocumentList } from "@/components/document-list";
import { useAuth } from "@/hooks/use-auth";
import { ApprovalDoc } from "@/lib/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Inbox, Send, Briefcase, Users, Loader2, Clock } from "lucide-react";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

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
    const { user, profile } = useAuth();
    
    const [inboxDocs, setInboxDocs] = useState<ApprovalDoc[]>([]);
    const [pendingDocs, setPendingDocs] = useState<ApprovalDoc[]>([]);
    const [teacherDocs, setTeacherDocs] = useState<ApprovalDoc[]>([]);
    const [parentDocs, setParentDocs] = useState<ApprovalDoc[]>([]);
    const [dutyStats, setDutyStats] = useState<any>(null);
    const [overtimeChart, setOvertimeChart] = useState<{ month: string; hours: number }[]>([]);
    
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState("inbox");

    useEffect(() => {
        if (profile?.email && user?.uid) {
            setLoading(true);
            const currentYear = new Date().getFullYear().toString();
            Promise.all([
                getInboxDocuments(profile.email),
                getPendingDocuments(user.uid, profile.email),
                getMyTeacherDocuments(profile.email),
                getParentServiceDocuments(profile.email, !!profile.isAdmin),
                getTeacherDutyStats(profile.email, currentYear, profile.annualLeaveLimit || 21),
                getOvertimeStatsByYear(profile.email, currentYear),
            ]).then(([inboxData, pendingData, teacherData, parentData, statsData, overtimeData]) => {
                setInboxDocs(inboxData);
                setPendingDocs(pendingData);
                setTeacherDocs(teacherData);
                setParentDocs(parentData);
                setDutyStats(statsData);
                setOvertimeChart(overtimeData);
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

    const stats = [
        {
            id: "inbox",
            title: "결재 대기 문서",
            count: inboxDocs.length,
            icon: Inbox,
            description: "내가 결재해야 할 결재 문서",
            color: "text-blue-500",
            bgColor: "bg-blue-500/10",
        },
        {
            id: "pending",
            title: "진행 중인 상신 문서",
            count: pendingDocs.length,
            icon: Send,
            description: "내가 기안하여 결재 진행 중",
            color: "text-amber-500",
            bgColor: "bg-amber-500/10",
        },
        {
            id: "teacher",
            title: "내 복무 신청 현황",
            count: teacherDocs.length,
            icon: Briefcase,
            description: "내 복무/초과근무 신청 현황",
            color: "text-emerald-500",
            bgColor: "bg-emerald-500/10",
        },
        {
            id: "parent",
            title: "학부모 출결 문서",
            count: parentDocs.length,
            icon: Users,
            description: "학부모 제출 결석계/체험학습서",
            color: "text-purple-500",
            bgColor: "bg-purple-500/10",
        },
    ];

    return (
        <div className="space-y-8 p-4 md:p-8 font-body">
            <div>
                <h1 className="font-headline text-3xl font-bold">대시보드</h1>
                <p className="text-muted-foreground mt-1">결재 문서 및 대내외 업무 진행 상황 요약입니다.</p>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {stats.map((stat) => {
                    const Icon = stat.icon;
                    const isActive = activeTab === stat.id;
                    return (
                        <Card
                            key={stat.id}
                            className={cn(
                                "cursor-pointer transition-all duration-200 hover:-translate-y-1 hover:shadow-md border",
                                isActive ? "ring-2 ring-primary border-primary shadow-sm" : "hover:border-primary/30"
                            )}
                            onClick={() => setActiveTab(stat.id)}
                        >
                            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                                <CardTitle className="text-sm font-medium text-muted-foreground">{stat.title}</CardTitle>
                                <div className={cn("p-2 rounded-lg", stat.bgColor)}>
                                    <Icon className={cn("h-5 w-5", stat.color)} />
                                </div>
                            </CardHeader>
                            <CardContent>
                                <div className="text-3xl font-black">{stat.count}</div>
                                <p className="text-xs text-muted-foreground mt-1">{stat.description}</p>
                            </CardContent>
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
                    <div className="flex items-center gap-2 mb-2">
                        <Send className="h-5 w-5 text-amber-500" />
                        <h2 className="text-xl font-bold">진행 중인 상신 문서 목록 ({pendingDocs.length})</h2>
                    </div>
                    <DocumentList documents={pendingDocs} />
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

                            {/* 병가 및 기타 휴가 */}
                            <div className="space-y-3 md:pl-6">
                                <div className="text-sm font-medium text-muted-foreground">기타 복무 사용 현황</div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="bg-muted/30 p-3 rounded-xl text-center">
                                        <div className="text-xs text-muted-foreground font-semibold">병가</div>
                                        <div className="text-xl font-bold text-destructive mt-1">{dutyStats.sickUsed}일</div>
                                    </div>
                                    <div className="bg-muted/30 p-3 rounded-xl text-center">
                                        <div className="text-xs text-muted-foreground font-semibold">기타 휴가</div>
                                        <div className="text-xl font-bold text-slate-700 mt-1">{dutyStats.otherUsed}일</div>
                                    </div>
                                </div>
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
                    <div className="flex items-center gap-2 mb-2">
                        <Users className="h-5 w-5 text-purple-500" />
                        <h2 className="text-xl font-bold">학부모 출결 관련 문서 목록 ({parentDocs.length})</h2>
                    </div>
                    <DocumentList documents={parentDocs} />
                </TabsContent>
            </Tabs>
        </div>
    );
}
