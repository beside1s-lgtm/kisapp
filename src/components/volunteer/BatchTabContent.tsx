'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { TabsContent } from '@/components/ui/tabs';
import { Loader2, Send, CheckCircle2, CheckSquare } from 'lucide-react';
import { format } from 'date-fns';
import type { ApprovalDoc } from '@/lib/types';

export function BatchTabContent({
  submittedPlans,
  selectedDocIds,
  loadingSubmitted,
  handleSelectAllPlans,
  handleTogglePlanSelect,
  handleOpenBatchModal,
  loadSubmittedPlans,
  setPreviewDoc,
  setRejectModalDoc,
  setRejectReason,
}: {
  submittedPlans: ApprovalDoc[];
  selectedDocIds: string[];
  loadingSubmitted: boolean;
  handleSelectAllPlans: (checked: boolean) => void;
  handleTogglePlanSelect: (docId: string) => void;
  handleOpenBatchModal: () => void;
  loadSubmittedPlans: () => Promise<void>;
  setPreviewDoc: (doc: ApprovalDoc | null) => void;
  setRejectModalDoc: (doc: ApprovalDoc | null) => void;
  setRejectReason: (reason: string) => void;
}) {
  return (
    <TabsContent value="batch" className="space-y-4">
      <Card className="border shadow-xs">
        <CardHeader className="p-4 sm:p-5 bg-muted/20 border-b flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <CardTitle className="text-base sm:text-lg font-bold flex items-center gap-2">
              <CheckSquare className="w-5 h-5 text-primary" />
              봉사활동 계획서 수합 및 일괄 기안
            </CardTitle>
            <CardDescription className="text-xs mt-1">
              교사 및 학부모(학생)가 제출한 계획서를 다중 선택하여 공문서로 일괄 수합 기안을 상신합니다.
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              className="h-8 text-xs font-bold"
              onClick={loadSubmittedPlans}
              disabled={loadingSubmitted}
            >
              {loadingSubmitted ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" /> : null}
              새로고침
            </Button>
            <Button
              size="sm"
              className="h-8 px-3 text-xs font-bold bg-primary hover:bg-primary/90 text-primary-foreground shadow-xs"
              onClick={handleOpenBatchModal}
              disabled={selectedDocIds.length === 0}
            >
              <Send className="w-3.5 h-3.5 mr-1.5" />
              선택 계획서 일괄 기안 상신 ({selectedDocIds.length}건)
            </Button>
          </div>
        </CardHeader>

        <CardContent className="p-4 sm:p-5 space-y-4">
          {/* 선택 상태 요약 바 */}
          <div className="flex items-center justify-between bg-sky-50 border border-sky-200 rounded-lg p-3 text-xs flex-wrap gap-2">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <Checkbox
                  id="select-all-plans"
                  checked={submittedPlans.length > 0 && selectedDocIds.length === submittedPlans.length}
                  onCheckedChange={(checked) => handleSelectAllPlans(!!checked)}
                />
                <label htmlFor="select-all-plans" className="font-bold text-sky-900 cursor-pointer text-xs">
                  전체 선택 ({selectedDocIds.length}/{submittedPlans.length}건)
                </label>
              </div>
            </div>
            <div className="flex items-center gap-3 text-sky-950 font-medium">
              <span>
                총 선택 학생: <b>
                  {submittedPlans
                    .filter(p => selectedDocIds.includes(p.id))
                    .reduce((sum, p) => {
                      const v = (p.volunteerFormData || p.parentFormData || {}) as any;
                      const count = (v.category === 'group' || v.type === 'volunteer-group-plan')
                        ? (v.groupStudents?.filter((s: any) => s.name?.trim())?.length || 1)
                        : 1;
                      return sum + count;
                    }, 0)}
                </b>명
              </span>
              <span className="text-sky-300">|</span>
              <span>
                총 인정 시간: <b>
                  {submittedPlans
                    .filter(p => selectedDocIds.includes(p.id))
                    .reduce((sum, p) => {
                      const v = (p.volunteerFormData || p.parentFormData || {}) as any;
                      return sum + (Number(v.period?.totalHours) || 0);
                    }, 0)}
                </b>시간
              </span>
            </div>
          </div>

          {/* 수합 대기 목록 테이블 */}
          <div className="border rounded-xl bg-card overflow-hidden shadow-2xs">
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left border-collapse">
                <thead className="bg-muted/50 text-[11px] font-bold border-b text-slate-700">
                  <tr>
                    <th className="p-2.5 text-center w-10">선택</th>
                    <th className="p-2.5 text-center w-14">구분</th>
                    <th className="p-2.5 w-36">신청자/학생</th>
                    <th className="p-2.5 w-24 text-center">학년/반</th>
                    <th className="p-2.5">대상 기관 및 활동 장소</th>
                    <th className="p-2.5 w-36 text-center">활동 기간</th>
                    <th className="p-2.5 text-center w-16">시간</th>
                    <th className="p-2.5 text-center w-24">제출일</th>
                    <th className="p-2.5 text-center w-28">관리</th>
                  </tr>
                </thead>
                <tbody className="divide-y text-xs">
                  {loadingSubmitted ? (
                    <tr>
                      <td colSpan={9} className="p-8 text-center text-muted-foreground">
                        <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-primary" />
                        수합 대기 계획서를 조회하고 있습니다...
                      </td>
                    </tr>
                  ) : submittedPlans.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="p-12 text-center text-muted-foreground">
                        <CheckCircle2 className="w-8 h-8 mx-auto mb-2 text-muted-foreground/50" />
                        <p className="font-bold text-sm">현재 수합 대기 중인 봉사활동 계획서가 없습니다.</p>
                        <p className="text-xs text-muted-foreground mt-1">교사나 학부모가 새 계획서를 제출하면 이곳에 자동으로 표시됩니다.</p>
                      </td>
                    </tr>
                  ) : (
                    submittedPlans.map((p) => {
                      const v = (p.volunteerFormData || p.parentFormData || {}) as any;
                      const isGroup = v.category === 'group' || v.type === 'volunteer-group-plan';
                      const isSelected = selectedDocIds.includes(p.id);
                      const studentName = isGroup
                        ? `${v.groupStudents?.[0]?.name || ''} 외 ${(v.groupStudents?.length || 1) - 1}명`
                        : (v.studentName || p.title);
                      const gradeClass = isGroup ? '단체' : (v.gradeClassNumber || `${v.grade || ''}-${v.classNum || ''}`);

                      return (
                        <tr key={p.id} className={`hover:bg-muted/30 transition-colors ${isSelected ? 'bg-primary/5' : ''}`}>
                          <td className="p-2.5 text-center">
                            <Checkbox
                              checked={isSelected}
                              onCheckedChange={() => handleTogglePlanSelect(p.id)}
                            />
                          </td>
                          <td className="p-2.5 text-center">
                            <Badge variant="outline" className={`text-[10px] ${isGroup ? 'bg-purple-50 text-purple-700 border-purple-200' : 'bg-blue-50 text-blue-700 border-blue-200'}`}>
                              {isGroup ? '단체' : '개인'}
                            </Badge>
                          </td>
                          <td className="p-2.5 font-bold">
                            <div className="flex flex-col">
                              <span>{studentName}</span>
                              <span className="text-[10px] text-muted-foreground font-normal">신청: {p.requesterName}</span>
                            </div>
                          </td>
                          <td className="p-2.5 text-center text-muted-foreground font-medium">
                            {gradeClass}
                          </td>
                          <td className="p-2.5">
                            <div className="font-semibold truncate max-w-[200px]">{v.institution || '미입력'}</div>
                            <div className="text-[11px] text-muted-foreground truncate max-w-[200px]">{v.location || ''}</div>
                          </td>
                          <td className="p-2.5 text-center text-[11px] text-muted-foreground whitespace-nowrap">
                            {v.period?.startDate} ~ {v.period?.endDate}
                          </td>
                          <td className="p-2.5 text-center font-bold">
                            {v.period?.totalHours || 0}h
                          </td>
                          <td className="p-2.5 text-center text-muted-foreground text-[11px]">
                            {p.createdAt ? format(new Date(p.createdAt), 'yyyy-MM-dd') : '-'}
                          </td>
                          <td className="p-2.5 text-center">
                            <div className="flex items-center justify-center gap-1">
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-7 px-2 text-xs"
                                onClick={() => setPreviewDoc(p)}
                                title="계획서 미리보기"
                              >
                                미리보기
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-7 px-2 text-xs text-red-600 hover:text-red-700 hover:bg-red-50"
                                onClick={() => {
                                  setRejectModalDoc(p);
                                  setRejectReason('');
                                }}
                                title="접수 반려"
                              >
                                반려
                              </Button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </CardContent>
      </Card>
    </TabsContent>
  );
}
