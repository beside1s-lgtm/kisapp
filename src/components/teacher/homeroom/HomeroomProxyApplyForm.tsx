'use client';

import { ArrowRight, CheckCircle2, Loader2 } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';

/**
 * "대리작성" 탭의 본문(교외체험학습 신청서 / 결석계 서식 + 제출 버튼).
 *
 * teacher/homeroom/page.tsx의 TabsContent value="proxy" 블록을 그대로
 * 옮긴 것으로, 상태/제출 로직은 전부 부모(page.tsx)에 남아 있고
 * 이 컴포넌트는 순수하게 마크업만 담당한다 (동작 변경 없음).
 */
export interface HomeroomProxyApplyFormProps {
  docCategory: 'field-trip' | 'absence';
  isSubmitting: boolean;
  selectedStudentId: string;
  onSubmit: () => void;

  // 체험학습 신청서 폼
  ftStartDate: string;
  setFtStartDate: (value: string) => void;
  ftEndDate: string;
  setFtEndDate: (value: string) => void;
  ftTotalDays: number;
  ftType: string;
  setFtType: (value: string) => void;
  ftDestination: string;
  setFtDestination: (value: string) => void;
  ftCompanionName: string;
  setFtCompanionName: (value: string) => void;
  ftCompanionRelation: string;
  setFtCompanionRelation: (value: string) => void;
  ftPurpose: string;
  setFtPurpose: (value: string) => void;
  ftDetailedPlan: string;
  setFtDetailedPlan: (value: string) => void;

  // 결석계 폼
  absStartDate: string;
  setAbsStartDate: (value: string) => void;
  absEndDate: string;
  setAbsEndDate: (value: string) => void;
  absTotalDays: number;
  absType: '병결' | '미인정' | '기타' | '출석인정';
  setAbsType: (value: '병결' | '미인정' | '기타' | '출석인정') => void;
  absReason: string;
  setAbsReason: (value: string) => void;
  teacherConfirmMethod: '전화/문자' | '학부모 내교' | '가정방문' | '기타';
  setTeacherConfirmMethod: (value: '전화/문자' | '학부모 내교' | '가정방문' | '기타') => void;
}

export function HomeroomProxyApplyForm({
  docCategory,
  isSubmitting,
  selectedStudentId,
  onSubmit,
  ftStartDate,
  setFtStartDate,
  ftEndDate,
  setFtEndDate,
  ftTotalDays,
  ftType,
  setFtType,
  ftDestination,
  setFtDestination,
  ftCompanionName,
  setFtCompanionName,
  ftCompanionRelation,
  setFtCompanionRelation,
  ftPurpose,
  setFtPurpose,
  ftDetailedPlan,
  setFtDetailedPlan,
  absStartDate,
  setAbsStartDate,
  absEndDate,
  setAbsEndDate,
  absTotalDays,
  absType,
  setAbsType,
  absReason,
  setAbsReason,
  teacherConfirmMethod,
  setTeacherConfirmMethod,
}: HomeroomProxyApplyFormProps) {
  return (
    <>
      <Card className="flex-1 min-h-0 flex flex-col rounded-xl border border-slate-200/80 shadow-xs bg-white">
        <CardContent className="flex-1 min-h-0 p-2.5 sm:p-3.5 flex flex-col justify-between gap-2">
          {/* 2-A. 체험학습 신청서 폼 */}
          {docCategory === 'field-trip' && (
            <div className="space-y-2 animate-in fade-in flex-1 flex flex-col justify-between min-h-0">
              {/* 시작일, 종료일 & 수업일수 뱃지 인라인 헤더 */}
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <Label className="text-[11px] sm:text-xs font-bold text-slate-700">신청 기간 및 수업일수 <span className="text-red-500">*</span></Label>
                  <Badge variant="outline" className="bg-indigo-50/80 border-indigo-200 text-indigo-700 text-[10px] font-bold px-1.5 py-0">
                    수업 {ftTotalDays}일간 (공휴일/주말 제외)
                  </Badge>
                </div>
                <div className="grid grid-cols-2 gap-1.5 sm:gap-2">
                  <Input type="date" value={ftStartDate} onChange={(e) => setFtStartDate(e.target.value)} className="h-8 text-xs bg-white px-2" />
                  <Input type="date" value={ftEndDate} onChange={(e) => setFtEndDate(e.target.value)} className="h-8 text-xs bg-white px-2" />
                </div>
              </div>

              {/* 학습 형태, 장소, 보호자, 관계 4개 입력칸 1줄 배치 */}
              <div className="grid grid-cols-4 gap-1 sm:gap-2">
                <div className="space-y-0.5 min-w-0">
                  <Label className="text-[10px] sm:text-[11px] font-bold truncate block text-slate-600">학습 형태</Label>
                  <Select value={ftType} onValueChange={setFtType}>
                    <SelectTrigger className="h-7 sm:h-8 text-[11px] sm:text-xs bg-white px-1 sm:px-2 truncate">
                      <SelectValue placeholder="형태" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="가족동반여행" className="text-xs">가족동반여행</SelectItem>
                      <SelectItem value="친인척 방문" className="text-xs">친인척 방문</SelectItem>
                      <SelectItem value="답사·견학 활동" className="text-xs">답사·견학 활동</SelectItem>
                      <SelectItem value="체험활동" className="text-xs">체험활동</SelectItem>
                      <SelectItem value="기타" className="text-xs">기타</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-0.5 min-w-0">
                  <Label className="text-[10px] sm:text-[11px] font-bold truncate block text-slate-600">장소 <span className="text-red-500">*</span></Label>
                  <Input
                    placeholder="다낭, 서울 등"
                    value={ftDestination}
                    onChange={(e) => setFtDestination(e.target.value)}
                    className="h-7 sm:h-8 text-[11px] sm:text-xs bg-white px-1.5"
                  />
                </div>

                <div className="space-y-0.5 min-w-0">
                  <Label className="text-[10px] sm:text-[11px] font-bold truncate block text-slate-600">보호자</Label>
                  <Input
                    placeholder="성명"
                    value={ftCompanionName}
                    onChange={(e) => setFtCompanionName(e.target.value)}
                    className="h-7 sm:h-8 text-[11px] sm:text-xs bg-white px-1.5"
                  />
                </div>

                <div className="space-y-0.5 min-w-0">
                  <Label className="text-[10px] sm:text-[11px] font-bold truncate block text-slate-600">관계</Label>
                  <Input
                    placeholder="부, 모"
                    value={ftCompanionRelation}
                    onChange={(e) => setFtCompanionRelation(e.target.value)}
                    className="h-7 sm:h-8 text-[11px] sm:text-xs bg-white px-1.5"
                  />
                </div>
              </div>

              {/* 목적 */}
              <div className="space-y-0.5">
                <Label className="text-[10px] sm:text-[11px] font-bold text-slate-600">체험학습 목적</Label>
                <Input
                  placeholder="예: 현지 문화 탐방 및 가족 유대 강화"
                  value={ftPurpose}
                  onChange={(e) => setFtPurpose(e.target.value)}
                  className="h-7 sm:h-8 text-xs bg-white px-2"
                />
              </div>

              {/* 구체적 계획 */}
              <div className="space-y-0.5 flex-1 flex flex-col min-h-0">
                <Label className="text-[10px] sm:text-[11px] font-bold text-slate-600">구체적 계획</Label>
                <Textarea
                  placeholder="예: 1일차 유적지 탐방, 2일차 자연 생태 체험 등"
                  value={ftDetailedPlan}
                  onChange={(e) => setFtDetailedPlan(e.target.value)}
                  rows={2}
                  className="text-xs bg-white resize-none flex-1 min-h-[56px]"
                />
              </div>
            </div>
          )}

          {/* 2-B. 결석계 폼 */}
          {docCategory === 'absence' && (
            <div className="space-y-2 animate-in fade-in flex-1 flex flex-col justify-between min-h-0">
              {/* 시작일, 종료일 & 결석일수 뱃지 인라인 헤더 */}
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <Label className="text-[11px] sm:text-xs font-bold text-slate-700">결석 기간 및 일수 <span className="text-red-500">*</span></Label>
                  <Badge variant="outline" className="bg-rose-50/80 border-rose-200 text-rose-600 text-[10px] font-bold px-1.5 py-0">
                    결석 {absTotalDays}일간 (공휴일/주말 제외)
                  </Badge>
                </div>
                <div className="grid grid-cols-2 gap-1.5 sm:gap-2">
                  <Input type="date" value={absStartDate} onChange={(e) => setAbsStartDate(e.target.value)} className="h-8 text-xs bg-white px-2" />
                  <Input type="date" value={absEndDate} onChange={(e) => setAbsEndDate(e.target.value)} className="h-8 text-xs bg-white px-2" />
                </div>
              </div>

              {/* 결석 종류, 담임 확인 방법 한 줄 나란히 배치 */}
              <div className="grid grid-cols-2 gap-1.5 sm:gap-2">
                <div className="space-y-0.5 min-w-0">
                  <Label className="text-[10px] sm:text-[11px] font-bold text-slate-600">결석 종류</Label>
                  <Select value={absType} onValueChange={(val) => setAbsType(val as any)}>
                    <SelectTrigger className="h-7 sm:h-8 text-xs bg-white px-2">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="병결" className="text-xs">병결</SelectItem>
                      <SelectItem value="미인정" className="text-xs">미인정</SelectItem>
                      <SelectItem value="기타" className="text-xs">기타</SelectItem>
                      <SelectItem value="출석인정" className="text-xs">출석인정</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-0.5 min-w-0">
                  <Label className="text-[10px] sm:text-[11px] font-bold text-slate-600">담임 확인 방법</Label>
                  <Select value={teacherConfirmMethod} onValueChange={(val) => setTeacherConfirmMethod(val as any)}>
                    <SelectTrigger className="h-7 sm:h-8 text-xs bg-white px-2">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="전화/문자" className="text-xs">전화/문자</SelectItem>
                      <SelectItem value="학부모 내교" className="text-xs">학부모 내교</SelectItem>
                      <SelectItem value="가정방문" className="text-xs">가정방문</SelectItem>
                      <SelectItem value="기타" className="text-xs">기타</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* 결석 사유 */}
              <div className="space-y-0.5 flex-1 flex flex-col min-h-0">
                <Label className="text-[10px] sm:text-[11px] font-bold text-slate-600">결석 사유 <span className="text-red-500">*</span></Label>
                <Textarea
                  placeholder="예: 감기 몸살 및 발열로 인한 가료 요양"
                  value={absReason}
                  onChange={(e) => setAbsReason(e.target.value)}
                  rows={3}
                  className="text-xs bg-white resize-none flex-1 min-h-[60px]"
                />
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 제출 액션 버튼 */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-1.5 pt-1.5 shrink-0">
        <p className="text-[10px] text-muted-foreground hidden sm:block">
          * '작성 및 담임 결재 완료' 시 문서가 즉시 승인되어 상신됩니다.
        </p>
        <Button
          size="default"
          onClick={onSubmit}
          disabled={isSubmitting || !selectedStudentId}
          className="w-full sm:w-auto font-bold px-4 h-9 gap-1.5 bg-primary shadow-sm hover:shadow-md transition-all text-xs"
        >
          {isSubmitting ? (
            <>
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              처리 중...
            </>
          ) : (
            <>
              <CheckCircle2 className="w-3.5 h-3.5" />
              작성 및 담임 결재 완료
              <ArrowRight className="w-3.5 h-3.5" />
            </>
          )}
        </Button>
      </div>
    </>
  );
}
