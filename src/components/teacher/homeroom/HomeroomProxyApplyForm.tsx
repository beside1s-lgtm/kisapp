'use client';

import React, { useRef } from 'react';
import { ArrowRight, CheckCircle2, Loader2, Camera, FileImage, X, FileText, ExternalLink } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { compressCertificateImage } from '@/lib/imageResize';
import { AbsenceDiseaseSelector } from '@/components/health/disease-surveillance/AbsenceDiseaseSelector';
import { DiseaseCategoryType } from '@/components/health/disease-surveillance/types';

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
  absDiseaseCategory?: DiseaseCategoryType;
  setAbsDiseaseCategory?: (value: DiseaseCategoryType) => void;
  absDiseaseName?: string;
  setAbsDiseaseName?: (value: string) => void;
  teacherConfirmMethod: '전화/문자' | '학부모 내교' | '가정방문' | '기타';
  setTeacherConfirmMethod: (value: '전화/문자' | '학부모 내교' | '가정방문' | '기타') => void;

  // 법적 신청인(학부모) 정보
  parentName?: string;
  setParentName?: (value: string) => void;
  parentSignature?: string;

  // 소견서/진단서 사진
  medicalCertificateUrl?: string;
  medicalCertificateName?: string;
  onCertificateChange?: (url: string | null, fileName?: string) => void;
}

export function HomeroomProxyApplyForm({
  docCategory,
  isSubmitting,
  selectedStudentId,
  onSubmit,
  parentName,
  setParentName,
  parentSignature,
  medicalCertificateUrl,
  medicalCertificateName,
  onCertificateChange,
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
  absDiseaseCategory,
  setAbsDiseaseCategory,
  absDiseaseName,
  setAbsDiseaseName,
  teacherConfirmMethod,
  setTeacherConfirmMethod,
}: HomeroomProxyApplyFormProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const compressed = await compressCertificateImage(file);
      if (onCertificateChange) {
        onCertificateChange(compressed, file.name);
      }
    } catch (err: any) {
      alert(err.message || '이미지 처리에 실패했습니다.');
    }
  };

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
              <div className="space-y-1 flex-1 flex flex-col min-h-0">
                <Label className="text-[10px] sm:text-[11px] font-bold text-slate-600">
                  결석 사유 <span className="text-red-500">*</span>
                  {absType === '병결' && (
                    <span className="text-[10px] font-normal text-indigo-600 ml-1.5">
                      (질병 분류 선택 및 병명 검색)
                    </span>
                  )}
                </Label>
                {absType === '병결' ? (
                  <AbsenceDiseaseSelector
                    value={absReason}
                    initialCategory={absDiseaseCategory}
                    initialDiseaseName={absDiseaseName}
                    onChange={(val, meta) => {
                      setAbsReason(val);
                      if (meta?.category && setAbsDiseaseCategory) setAbsDiseaseCategory(meta.category);
                      if (meta?.diseaseName && setAbsDiseaseName) setAbsDiseaseName(meta.diseaseName);
                    }}
                  />
                ) : (
                  <Textarea
                    placeholder="결석 사유를 입력해 주세요 (예: 집안 사정, 경조사 참석 등)"
                    value={absReason}
                    onChange={(e) => setAbsReason(e.target.value)}
                    rows={3}
                    className="text-xs bg-white resize-none flex-1 min-h-[60px]"
                  />
                )}
              </div>

              {/* 소견서/진단서 사진/PDF 첨부 (선택) */}
              <div className="space-y-1 pt-1">
                <div className="flex items-center justify-between">
                  <Label className="text-[10px] sm:text-[11px] font-bold text-slate-600">
                    증빙서류 (의사소견서/진단서/처방전 사진 또는 PDF)
                  </Label>
                  <span className="text-[10px] text-slate-400">선택</span>
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*,application/pdf"
                  onChange={handleFileSelect}
                  className="hidden"
                />
                {medicalCertificateUrl ? (() => {
                  const isPdf = medicalCertificateUrl?.startsWith('data:application/pdf') || medicalCertificateName?.toLowerCase().endsWith('.pdf');
                  return (
                    <div className="flex items-center gap-2 bg-slate-50 p-2 rounded-lg border border-slate-200">
                      {isPdf ? (
                        <div className="w-12 h-12 rounded-lg bg-rose-50 border border-rose-200 flex flex-col items-center justify-center text-rose-600 shrink-0 shadow-2xs">
                          <FileText className="w-5 h-5" />
                          <span className="text-[7px] font-black uppercase tracking-tighter">PDF</span>
                        </div>
                      ) : (
                        <img
                          src={medicalCertificateUrl}
                          alt="소견서 사진"
                          className="w-12 h-12 object-cover rounded border border-slate-300 shrink-0"
                        />
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1">
                          {isPdf ? (
                            <FileText className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                          ) : (
                            <FileImage className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                          )}
                          <span className="text-xs font-bold text-slate-800 truncate">
                            {medicalCertificateName || (isPdf ? '소견서_진단서_첨부파일.pdf' : '소견서_사진.jpg')}
                          </span>
                        </div>
                        <p className="text-[10px] text-emerald-600 font-medium">
                          {isPdf ? 'PDF 문서 첨부 완료' : '사진 첨부 완료 (문서용 최적화)'}
                        </p>
                        {isPdf && (
                          <button
                            type="button"
                            onClick={() => {
                              const w = window.open();
                              if (w) w.location.href = medicalCertificateUrl;
                            }}
                            className="text-[10px] text-blue-600 hover:underline font-semibold inline-flex items-center gap-0.5 mt-0.5"
                          >
                            <ExternalLink className="w-2.5 h-2.5" />
                            새 탭에서 열기
                          </button>
                        )}
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => fileInputRef.current?.click()}
                          className="h-6 px-1.5 text-[10px]"
                        >
                          변경
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => onCertificateChange && onCertificateChange(null, '')}
                          className="h-6 w-6 p-0 text-slate-400 hover:text-rose-600"
                        >
                          <X className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </div>
                  );
                })() : (
                  <div className="flex items-center justify-between bg-slate-50/70 p-2 rounded-lg border border-dashed border-slate-300">
                    <span className="text-[11px] text-slate-500">
                      소견서 또는 진료확인서 사진/PDF 첨부
                    </span>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => fileInputRef.current?.click()}
                      className="h-7 text-xs gap-1 font-semibold"
                    >
                      <Camera className="w-3.5 h-3.5 text-indigo-600" />
                      파일 첨부
                    </Button>
                  </div>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 법적 기준: 신청인(학부모) 명의 및 서명 표기 안내 패널 */}
      <div className="bg-amber-50/90 border border-amber-200/90 rounded-xl p-2 sm:p-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 text-xs text-amber-900 shadow-2xs">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="font-bold text-[11px] text-amber-950">법적 신청인(보호자):</span>
          <span className="font-bold text-blue-900 bg-white px-2 py-0.5 rounded border border-blue-200 text-xs">
            {parentName || '학부모 성명'}
          </span>
          <span className="text-[11px] text-amber-800 font-medium">
            {parentSignature ? '(등록된 학부모 서명 날인)' : '(학부모 성명 도장(인) 자동 생성 날인)'}
          </span>
        </div>
        <span className="text-[10px] text-amber-700 font-normal">
          ※ 신청서·결석계에는 담임 교사가 아닌 학부모 성명과 서명만 기재됩니다.
        </span>
      </div>

      {/* 제출 액션 버튼 */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-1.5 pt-1 shrink-0">
        <p className="text-[10px] text-muted-foreground hidden sm:block">
          * '작성 및 담임 결재 완료' 시 학부모 명의로 문서가 등록되며, 담임 결재가 즉시 처리됩니다.
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
