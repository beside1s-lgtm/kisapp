'use client';

import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { TabsContent } from '@/components/ui/tabs';
import { Loader2, History, Building, Calendar, FileText, Printer, FileCheck } from 'lucide-react';
import type { ApprovalDoc } from '@/lib/types';

interface GroupReportForm {
  startTime: string;
  endTime: string;
  totalHours: number;
  activityPhotos: string[];
  institutionName: string;
  phone: string;
  personInCharge: string;
  signImageUrl: string;
}

export function HistoryTabContent({
  loadingDocs,
  allDocs,
  user,
  router,
  setPreviewDoc,
  setOriginalPlanDoc,
  setGroupReportForm,
  setActiveTab,
}: {
  loadingDocs: boolean;
  allDocs: ApprovalDoc[];
  user: any;
  router: any;
  setPreviewDoc: (doc: ApprovalDoc | null) => void;
  setOriginalPlanDoc: (doc: ApprovalDoc | null) => void;
  setGroupReportForm: React.Dispatch<React.SetStateAction<GroupReportForm>>;
  setActiveTab: (tab: string) => void;
}) {
  return (
    <TabsContent value="history">
      {loadingDocs ? (
        <div className="flex justify-center p-12">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      ) : allDocs.filter(d => d.requesterEmail?.toLowerCase() === user?.email?.toLowerCase()).length === 0 ? (
        <Card className="p-8 text-center border shadow-xs">
          <History className="w-12 h-12 text-muted-foreground mx-auto mb-3 opacity-40" />
          <p className="font-bold text-sm mb-1">교사 계정으로 제출한 신청 내역이 없습니다.</p>
          <p className="text-xs text-muted-foreground mb-4">
            학생 단체를 대표하여 새 단체 봉사활동 계획서를 작성해 보세요.
          </p>
          <Button size="sm" onClick={() => setActiveTab('apply')}>
            단체 계획서 작성하기
          </Button>
        </Card>
      ) : (
        <div className="space-y-3">
          {allDocs
            .filter(d => d.requesterEmail?.toLowerCase() === user?.email?.toLowerCase())
            .map(doc => {
              const v = (doc.volunteerFormData || doc.parentFormData || {}) as any;
              const isGroup = v.category === 'group' || v.type === 'volunteer-group-plan';
              const isApproved = doc.status === 'approved';
              const hasReport = Boolean(v.reportSubmitted || doc.reportSubmitted);
              const needsReport = isApproved && !hasReport;

              return (
                <div
                  key={doc.id}
                  className="bg-card border rounded-xl p-4 shadow-xs hover:border-primary/40 transition-all space-y-2.5"
                >
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className={isGroup ? 'bg-purple-50 text-purple-700 border-purple-200' : 'bg-blue-50 text-blue-700 border-blue-200'}>
                        {isGroup ? '단체 봉사' : '개인 봉사'}
                      </Badge>
                      <span className="text-xs font-bold text-foreground">
                        {doc.title}
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5">
                      {doc.status === 'submitted' && (
                        <Badge variant="outline" className="bg-sky-50 text-sky-700 border-sky-200 text-xs font-bold">
                          접수 완료 (수합 대기)
                        </Badge>
                      )}
                      {doc.status === 'pending' && (
                        <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200 text-xs font-bold">
                          결재 진행 중
                        </Badge>
                      )}
                      {doc.status === 'approved' && (
                        <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 text-xs font-bold">
                          승인 완료
                        </Badge>
                      )}
                      {doc.status === 'rejected' && (
                        <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200 text-xs font-bold">
                          반려됨
                        </Badge>
                      )}

                      {needsReport && (
                        <Badge className="bg-amber-500 text-white text-[10px] font-bold">
                          확인서 미제출
                        </Badge>
                      )}
                      {hasReport && (
                        <Badge className="bg-teal-600 text-white text-[10px] font-bold">
                          확인서 완료
                        </Badge>
                      )}
                    </div>
                  </div>

                  {/* 요약 정보 */}
                  <div className="bg-muted/30 p-2.5 rounded-lg text-xs space-y-1">
                    <div className="flex items-center gap-1.5 text-muted-foreground">
                      <Building className="w-3.5 h-3.5 shrink-0" />
                      <span>기관: <b>{v.institution || '미입력'}</b> ({v.location || ''})</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-muted-foreground">
                      <Calendar className="w-3.5 h-3.5 shrink-0" />
                      <span>
                        기간: {v.period?.startDate} ~ {v.period?.endDate} (총 {v.period?.totalDays || 1}일간, {v.period?.totalHours || 0}시간)
                      </span>
                    </div>
                    {isGroup && (
                      <div className="text-[11px] text-slate-500">
                        참여 학생: {(v.groupStudents || []).map((s: any) => s.name).filter(Boolean).join(', ')} (총 {v.groupStudents?.length || 0}명)
                      </div>
                    )}
                  </div>

                  {/* 액션 버튼 */}
                  <div className="flex items-center gap-2 pt-1 border-t">
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-8 text-xs font-bold"
                      onClick={() => router.push(`/documents/${doc.id}`)}
                    >
                      <FileText className="w-3.5 h-3.5 mr-1" />
                      문서 보기
                    </Button>

                    <Button
                      size="sm"
                      variant="outline"
                      className="h-8 text-xs font-bold"
                      onClick={() => setPreviewDoc(doc)}
                    >
                      <Printer className="w-3.5 h-3.5 mr-1" />
                      A4 인쇄
                    </Button>

                    {needsReport && (
                      <Button
                        size="sm"
                        className="h-8 text-xs font-bold bg-teal-600 hover:bg-teal-700 text-white ml-auto"
                        onClick={() => {
                          setOriginalPlanDoc(doc);
                          const prevV = (doc.volunteerFormData || doc.parentFormData || {}) as any;
                          setGroupReportForm(prev => ({
                            ...prev,
                            institutionName: prevV.institution || '',
                            totalHours: prevV.period?.totalHours || 4,
                          }));
                          setActiveTab('report');
                        }}
                      >
                        <FileCheck className="w-3.5 h-3.5 mr-1" />
                        확인서 제출하기
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
        </div>
      )}
    </TabsContent>
  );
}
