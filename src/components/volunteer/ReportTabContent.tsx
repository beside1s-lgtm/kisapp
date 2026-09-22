'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { TabsContent } from '@/components/ui/tabs';
import { Loader2, CheckCircle2, FileCheck } from 'lucide-react';
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

export function ReportTabContent({
  originalPlanDoc,
  groupReportForm,
  setGroupReportForm,
  handlePhotoUpload,
  handleSubmitGroupReport,
  isSubmitting,
  setActiveTab,
}: {
  originalPlanDoc: ApprovalDoc | null;
  groupReportForm: GroupReportForm;
  setGroupReportForm: React.Dispatch<React.SetStateAction<GroupReportForm>>;
  handlePhotoUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  handleSubmitGroupReport: (e: React.FormEvent) => void;
  isSubmitting: boolean;
  setActiveTab: (tab: string) => void;
}) {
  return (
    <TabsContent value="report">
      {originalPlanDoc ? (
        <Card className="border shadow-xs">
          <CardHeader className="p-4 sm:p-5 bg-muted/20 border-b">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base sm:text-lg font-bold flex items-center gap-2">
                  <FileCheck className="w-5 h-5 text-teal-600" />
                  봉사활동 확인서 작성 (초등단체)
                </CardTitle>
                <CardDescription className="text-xs mt-1">
                  승인된 단체 계획서를 바탕으로 실제 활동 시간, 사진 및 확인 기관 정보를 등록합니다.
                </CardDescription>
              </div>
              <Badge variant="outline" className="text-xs text-teal-700 bg-teal-50 border-teal-200">
                서식 4
              </Badge>
            </div>
          </CardHeader>

          <form onSubmit={handleSubmitGroupReport}>
            <CardContent className="p-4 sm:p-6 space-y-4">
              {/* 연동된 원본 계획서 요약 정보 */}
              <div className="bg-teal-50/60 border border-teal-200 p-3.5 rounded-xl space-y-1.5 text-xs">
                <div className="font-bold text-teal-900 flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-teal-600" />
                  연동된 승인 단체 계획서: {originalPlanDoc.title}
                </div>
                <div className="text-slate-600 text-[11px]">
                  인원: <b>{originalPlanDoc.volunteerFormData?.groupStudents?.length || 1}명</b> &nbsp;|&nbsp;
                  기관: <b>{originalPlanDoc.volunteerFormData?.institution}</b> &nbsp;|&nbsp;
                  기간: <b>{originalPlanDoc.volunteerFormData?.period?.startDate} ~ {originalPlanDoc.volunteerFormData?.period?.endDate}</b>
                </div>
              </div>

              {/* 실제 활동 시간대 */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                <div>
                  <Label className="text-[11px] text-muted-foreground">시작 시각 (Start Time)</Label>
                  <Input
                    type="time"
                    value={groupReportForm.startTime}
                    onChange={e => setGroupReportForm({ ...groupReportForm, startTime: e.target.value })}
                    required
                    className="h-8 text-xs mt-1"
                  />
                </div>
                <div>
                  <Label className="text-[11px] text-muted-foreground">종료 시각 (End Time)</Label>
                  <Input
                    type="time"
                    value={groupReportForm.endTime}
                    onChange={e => setGroupReportForm({ ...groupReportForm, endTime: e.target.value })}
                    required
                    className="h-8 text-xs mt-1"
                  />
                </div>
                <div>
                  <Label className="text-[11px] text-muted-foreground">인정 실적 시간 (총 시간)</Label>
                  <Input
                    type="number"
                    min={1}
                    value={groupReportForm.totalHours}
                    onChange={e => setGroupReportForm({ ...groupReportForm, totalHours: Number(e.target.value) })}
                    required
                    className="h-8 text-xs mt-1 font-bold"
                  />
                </div>
              </div>

              <div className="text-[11px] text-red-600 font-medium">
                ※ 봉사활동 실적은 시간 단위로 기록 권장 &nbsp;|&nbsp; ※ 2026년 12월 31일 봉사활동 확인서 제출 마감
              </div>

              {/* 활동 사진 업로드 (최대 2장) */}
              <div className="space-y-2">
                <Label className="text-xs font-bold">활동 사진 첨부 (최대 2장)</Label>
                <Input
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={handlePhotoUpload}
                  className="text-xs h-9"
                />
                {groupReportForm.activityPhotos.length > 0 && (
                  <div className="flex gap-2.5 mt-2">
                    {groupReportForm.activityPhotos.map((src, i) => (
                      <div key={i} className="relative group border rounded-lg overflow-hidden">
                        <img src={src} alt="사진" className="h-20 w-32 object-cover" />
                        <button
                          type="button"
                          onClick={() => setGroupReportForm(prev => ({ ...prev, activityPhotos: prev.activityPhotos.filter((_, idx) => idx !== i) }))}
                          className="absolute top-1 right-1 bg-red-600 text-white rounded-full w-5 h-5 text-[10px] flex items-center justify-center shadow-xs"
                        >
                          ✕
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* 확인 기관 정보 */}
              <div className="bg-muted/40 p-3.5 rounded-xl border space-y-3">
                <div className="text-xs font-bold text-slate-700">확인 기관 정보 (Confirmation of Institution)</div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  <div>
                    <Label className="text-[11px] text-muted-foreground">기관명</Label>
                    <Input
                      value={groupReportForm.institutionName}
                      onChange={e => setGroupReportForm({ ...groupReportForm, institutionName: e.target.value })}
                      required
                      className="h-8 text-xs mt-1"
                    />
                  </div>
                  <div>
                    <Label className="text-[11px] text-muted-foreground">연락처</Label>
                    <Input
                      value={groupReportForm.phone}
                      onChange={e => setGroupReportForm({ ...groupReportForm, phone: e.target.value })}
                      placeholder="예: 028-1234-5678"
                      className="h-8 text-xs mt-1"
                    />
                  </div>
                  <div>
                    <Label className="text-[11px] text-muted-foreground">확인자 성명</Label>
                    <Input
                      value={groupReportForm.personInCharge}
                      onChange={e => setGroupReportForm({ ...groupReportForm, personInCharge: e.target.value })}
                      placeholder="예: 김담당"
                      required
                      className="h-8 text-xs mt-1"
                    />
                  </div>
                </div>
              </div>
            </CardContent>

            <CardFooter className="p-4 bg-muted/20 border-t flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-9 text-xs"
                onClick={() => setActiveTab('history')}
              >
                취소
              </Button>
              <Button
                type="submit"
                disabled={isSubmitting}
                className="h-9 px-4 font-bold bg-teal-600 hover:bg-teal-700 text-white shadow-xs"
              >
                {isSubmitting ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <CheckCircle2 className="w-4 h-4 mr-1.5" />}
                단체 확인서 최종 제출
              </Button>
            </CardFooter>
          </form>
        </Card>
      ) : (
        <Card className="p-8 text-center border shadow-xs">
          <FileCheck className="w-12 h-12 text-muted-foreground mx-auto mb-3 opacity-40" />
          <p className="font-bold text-sm mb-1">연동된 승인 단체 계획서가 없습니다.</p>
          <p className="text-xs text-muted-foreground mb-4">
            '나의 신청 내역' 탭에서 승인 완료된 단체 계획서의 [확인서 제출] 버튼을 눌러주세요.
          </p>
          <Button size="sm" onClick={() => setActiveTab('history')}>
            나의 신청 내역으로 이동
          </Button>
        </Card>
      )}
    </TabsContent>
  );
}
