'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  FileText,
  Printer,
  Send,
  Loader2,
  Calendar,
  MapPin,
  Clock,
  UserCheck,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
} from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import { getOrgStructure } from '@/lib/services/settingsService';
import { createDocument } from '@/lib/services/documentService';
import { useToast } from '@/hooks/use-toast';
import { useRouter } from 'next/navigation';

import {
  YearlyPlanFormState,
  DEFAULT_YEARLY_PLAN_STATE,
  generateYearlyPlanDraftHtml,
  generateYearlyPlanAttachmentHtml,
  generateYearlyPlanCombinedHtml,
} from './templates/yearlyPlanHtml';

import {
  EvacuationPlanFormState,
  DEFAULT_EVACUATION_PLAN_STATE,
  generateEvacuationDraftHtml,
  generateEvacuationAttachmentHtml,
  generateEvacuationCombinedHtml,
} from './templates/evacuationPlanHtml';

export type PlanTemplateType = 'yearly' | 'evacuation';

interface PlanDraftModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultTemplate?: PlanTemplateType;
  onSuccess?: (docId: string) => void;
}

export function PlanDraftModal({
  isOpen,
  onClose,
  defaultTemplate = 'yearly',
  onSuccess,
}: PlanDraftModalProps) {
  const { user, profile } = useAuth();
  const router = useRouter();
  const { toast } = useToast();

  const [selectedTemplate, setSelectedTemplate] = useState<PlanTemplateType>(defaultTemplate);
  const [viewTab, setViewTab] = useState<'draft' | 'attachment' | 'combined'>('combined');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [createdDocId, setCreatedDocId] = useState<string | null>(null);

  // 1. 학년도 안전교육 운영 계획 폼 상태
  const [yearlyState, setYearlyState] = useState<YearlyPlanFormState>(DEFAULT_YEARLY_PLAN_STATE);

  // 2. 재난대피 훈련 실시 계획 폼 상태
  const [evacuationState, setEvacuationState] = useState<EvacuationPlanFormState>(DEFAULT_EVACUATION_PLAN_STATE);

  // 초기 열릴 때 defaultTemplate 동기화 및 조직도 기반 결재자 자동 세팅
  useEffect(() => {
    if (isOpen) {
      setSelectedTemplate(defaultTemplate);
      setCreatedDocId(null);

      // 사용자 정보 바인딩
      const myName = profile?.name || user?.displayName || '강지욱';
      const myRole = profile?.role || '교사';

      getOrgStructure()
        .then((org) => {
          const deptHead = org?.academicHeadName || '오형석';
          const vp = org?.vicePrincipalName || '신선영';
          const principal = org?.principalName || '김명환';
          const adminHead = org?.administrativeHeadName || '배경희';

          setYearlyState((prev) => ({
            ...prev,
            drafterName: myName,
            drafterRole: '담당',
            deptHeadName: deptHead,
            vpName: vp,
            principalName: principal,
            adminHeadName: adminHead,
          }));

          setEvacuationState((prev) => ({
            ...prev,
            drafterName: myName,
            drafterRole: '담당',
            deptHeadName: deptHead,
            vpName: vp,
            principalName: principal,
            adminHeadName: adminHead,
          }));
        })
        .catch(() => {});
    }
  }, [isOpen, defaultTemplate, user, profile]);

  // 실시간 HTML 미리보기 계산
  const currentPreviewHtml = useMemo(() => {
    if (selectedTemplate === 'yearly') {
      if (viewTab === 'draft') return generateYearlyPlanDraftHtml(yearlyState);
      if (viewTab === 'attachment') return generateYearlyPlanAttachmentHtml(yearlyState);
      return generateYearlyPlanCombinedHtml(yearlyState);
    } else {
      if (viewTab === 'draft') return generateEvacuationDraftHtml(evacuationState);
      if (viewTab === 'attachment') return generateEvacuationAttachmentHtml(evacuationState);
      return generateEvacuationCombinedHtml(evacuationState);
    }
  }, [selectedTemplate, viewTab, yearlyState, evacuationState]);

  // 인쇄 및 PDF 저장 핸들러 (독립 팝업)
  const handlePrint = () => {
    const title =
      selectedTemplate === 'yearly'
        ? `${yearlyState.year}학년도_안전교육_운영_계획_공문서`
        : `${evacuationState.year}학년도_${evacuationState.disasterType}_대피_훈련_실시_계획_공문서`;

    const printWin = window.open('', '_blank', 'width=1050,height=900');
    if (!printWin) {
      toast({
        variant: 'destructive',
        title: '팝업 차단',
        description: '브라우저 팝업 차단을 해제해주세요.',
      });
      return;
    }

    printWin.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>${title}</title>
          <meta charset="utf-8" />
          <style>
            @page {
              size: A4 portrait;
              margin: 10mm;
            }
            * {
              box-sizing: border-box;
            }
            body {
              margin: 0;
              padding: 0;
              background: #fff;
              font-family: 'Batang', 'Malgun Gothic', serif;
              color: #111;
              -webkit-print-color-adjust: exact;
              print-color-adjust: exact;
            }
            .a4-page {
              width: 100% !important;
              min-height: auto !important;
              padding: 0 !important;
              margin: 0 auto !important;
              page-break-after: always;
            }
            .a4-page:last-child {
              page-break-after: avoid;
            }
            table {
              border-collapse: collapse !important;
            }
            th, td {
              border-color: #000 !important;
            }
          </style>
        </head>
        <body>
          ${currentPreviewHtml}
          <script>
            window.onload = function() {
              setTimeout(function() {
                window.print();
              }, 400);
            };
          </script>
        </body>
      </html>
    `);
    printWin.document.close();
  };

  // 전자결재 상신 (createDocument 호출)
  const handleSubmitApproval = async () => {
    if (!user || !profile) {
      toast({
        variant: 'destructive',
        title: '로그인 필요',
        description: '로그인 정보가 필요합니다.',
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const isYearly = selectedTemplate === 'yearly';
      const title = isYearly
        ? `[안전지도] ${yearlyState.year}학년도 안전교육 운영 계획`
        : `[안전지도] ${evacuationState.year}학년도 ${evacuationState.disasterType} 대피 훈련 실시 계획`;

      const fullContentHtml = isYearly
        ? generateYearlyPlanCombinedHtml(yearlyState)
        : generateEvacuationCombinedHtml(evacuationState);

      const drafterName = isYearly ? yearlyState.drafterName : evacuationState.drafterName;
      const deptHeadName = isYearly ? yearlyState.deptHeadName : evacuationState.deptHeadName;
      const vpName = isYearly ? yearlyState.vpName : evacuationState.vpName;
      const principalName = isYearly ? yearlyState.principalName : evacuationState.principalName;

      // 결재선 구성 (담당 -> 부장 -> 교감 -> 교장)
      const approvers = [
        {
          role: '담당',
          name: drafterName,
          approverName: drafterName,
          userId: user.uid,
          email: user.email || '',
          type: 'normal' as const,
          status: 'approved' as const, // 기안자는 승인 상태
          signature: profile?.signature || '',
        },
        {
          role: '부장',
          name: deptHeadName,
          approverName: deptHeadName,
          userId: '',
          email: '',
          type: 'normal' as const,
          status: 'pending' as const,
        },
        {
          role: '교감',
          name: vpName,
          approverName: vpName,
          userId: '',
          email: '',
          type: 'normal' as const,
          status: 'pending' as const,
        },
        {
          role: '교장',
          name: principalName,
          approverName: principalName,
          userId: '',
          email: '',
          type: 'final' as const,
          status: 'pending' as const,
        },
      ];

      const payload = {
        title,
        content: fullContentHtml,
        docType: 'internal' as const,
        category: 'general' as const,
        publishStatus: '공개' as const,
        approvers: approvers as any,
        status: 'pending' as const,
      };

      const result = await createDocument(payload as any, user.uid, profile);
      if (result && result.success && result.docId) {
        setCreatedDocId(result.docId);
        toast({
          title: '전자결재 기안 완료',
          description: `문서번호: ${result.docNo || '등록 완료'}로 기안이 상신되었습니다.`,
        });
        if (onSuccess) onSuccess(result.docId);
      } else {
        throw new Error(result?.error || '전자결재 상신에 실패했습니다.');
      }
    } catch (e: any) {
      console.error('전자결재 상신 오류:', e);
      toast({
        variant: 'destructive',
        title: '상신 실패',
        description: e?.message || '전자결재 상신 중 오류가 발생했습니다.',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-6xl w-[96vw] h-[92vh] max-h-[92vh] flex flex-col p-0 gap-0 overflow-hidden bg-slate-100">
        {/* 1. 상단 다이얼로그 헤더 */}
        <div className="bg-white border-b border-slate-200 px-6 py-3.5 flex items-center justify-between shrink-0">
          <div>
            <DialogTitle className="text-lg font-black text-slate-900 flex items-center gap-2">
              <FileText className="w-5 h-5 text-rose-600" />
              학생 안전교육 계획 수립 및 기안문 작성기
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500 mt-0.5">
              공식 템플릿의 날짜, 장소, 일시만 수정하면 원본 공문서와 1:1 일치하는 기안문과 붙임문서가 즉시 완성됩니다.
            </DialogDescription>
          </div>

          {/* 템플릿 선택 버튼 토글 */}
          <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl border border-slate-200">
            <Button
              type="button"
              size="sm"
              variant={selectedTemplate === 'yearly' ? 'default' : 'ghost'}
              className={`h-8 text-xs font-bold px-3 rounded-lg ${
                selectedTemplate === 'yearly' ? 'bg-rose-600 hover:bg-rose-700 text-white shadow-xs' : 'text-slate-600'
              }`}
              onClick={() => setSelectedTemplate('yearly')}
            >
              1. 안전교육 운영 계획
            </Button>
            <Button
              type="button"
              size="sm"
              variant={selectedTemplate === 'evacuation' ? 'default' : 'ghost'}
              className={`h-8 text-xs font-bold px-3 rounded-lg ${
                selectedTemplate === 'evacuation' ? 'bg-blue-600 hover:bg-blue-700 text-white shadow-xs' : 'text-slate-600'
              }`}
              onClick={() => setSelectedTemplate('evacuation')}
            >
              2. 재난대피 훈련 계획
            </Button>
          </div>
        </div>

        {/* 2. 본문: 좌측 간편 수정 폼 + 우측 실시간 A4 미리보기 */}
        <div className="flex-1 flex min-h-0 overflow-hidden">
          {/* 좌측: 간편 편집 컨트롤 패널 */}
          <div className="w-[340px] sm:w-[380px] bg-white border-r border-slate-200 flex flex-col shrink-0 overflow-y-auto p-4 space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <span className="text-xs font-black text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-rose-500" />
                간편 수정 항목
              </span>
              <span className="text-[11px] text-slate-400">수정 시 우측 실시간 반영</span>
            </div>

            {selectedTemplate === 'yearly' ? (
              /* A. 학년도 안전교육 운영 계획 폼 */
              <div className="space-y-3.5 text-xs">
                <div className="grid grid-cols-2 gap-2.5">
                  <div className="space-y-1">
                    <Label className="text-[11px] font-bold text-slate-700">학년도</Label>
                    <Input
                      type="number"
                      value={yearlyState.year}
                      onChange={(e) =>
                        setYearlyState({ ...yearlyState, year: parseInt(e.target.value) || 2026 })
                      }
                      className="h-8 text-xs font-semibold"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[11px] font-bold text-slate-700">시행일자</Label>
                    <Input
                      value={yearlyState.docDate}
                      onChange={(e) => setYearlyState({ ...yearlyState, docDate: e.target.value })}
                      placeholder="2026. 03. 24."
                      className="h-8 text-xs"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <Label className="text-[11px] font-bold text-slate-700">문서 시행 번호</Label>
                  <Input
                    value={yearlyState.docNo}
                    onChange={(e) => setYearlyState({ ...yearlyState, docNo: e.target.value })}
                    placeholder="Kish-초등-77"
                    className="h-8 text-xs"
                  />
                </div>

                <div className="pt-2 border-t border-slate-100 space-y-2.5">
                  <div className="text-[11px] font-black text-slate-700 flex items-center gap-1">
                    <UserCheck className="w-3.5 h-3.5 text-indigo-500" />
                    결재선 및 담당자 성명
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label className="text-[10px] text-slate-500">기안 담당자</Label>
                      <Input
                        value={yearlyState.drafterName}
                        onChange={(e) => setYearlyState({ ...yearlyState, drafterName: e.target.value })}
                        className="h-7 text-xs"
                      />
                    </div>
                    <div>
                      <Label className="text-[10px] text-slate-500">부장</Label>
                      <Input
                        value={yearlyState.deptHeadName}
                        onChange={(e) => setYearlyState({ ...yearlyState, deptHeadName: e.target.value })}
                        className="h-7 text-xs"
                      />
                    </div>
                    <div>
                      <Label className="text-[10px] text-slate-500">교감</Label>
                      <Input
                        value={yearlyState.vpName}
                        onChange={(e) => setYearlyState({ ...yearlyState, vpName: e.target.value })}
                        className="h-7 text-xs"
                      />
                    </div>
                    <div>
                      <Label className="text-[10px] text-slate-500">교장</Label>
                      <Input
                        value={yearlyState.principalName}
                        onChange={(e) => setYearlyState({ ...yearlyState, principalName: e.target.value })}
                        className="h-7 text-xs"
                      />
                    </div>
                  </div>
                  <div>
                    <Label className="text-[10px] text-slate-500">협조자 (행정실장)</Label>
                    <Input
                      value={yearlyState.adminHeadName}
                      onChange={(e) => setYearlyState({ ...yearlyState, adminHeadName: e.target.value })}
                      className="h-7 text-xs"
                    />
                  </div>
                </div>

                <div className="p-3 bg-rose-50 rounded-xl border border-rose-100 text-[11px] text-rose-800 leading-relaxed space-y-1">
                  <div className="font-bold flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5 text-rose-600" />
                    붙임 운영 계획서 자동 포함:
                  </div>
                  <p>• 7대 표준 안전교육 기준시수표 (연간 51~52차시)</p>
                  <p>• 1학년~6학년 전 학년별 상세 교과/단원/시기/시수표</p>
                  <p>• 재난대피 훈련(지진/화재) 및 가정연계 지도 계획</p>
                </div>
              </div>
            ) : (
              /* B. 재난대피 훈련 실시 계획 폼 */
              <div className="space-y-3.5 text-xs">
                <div className="grid grid-cols-2 gap-2.5">
                  <div className="space-y-1">
                    <Label className="text-[11px] font-bold text-slate-700">훈련 종류</Label>
                    <select
                      value={evacuationState.disasterType}
                      onChange={(e) =>
                        setEvacuationState({
                          ...evacuationState,
                          disasterType: e.target.value as '지진' | '화재',
                          trainingContent: `${e.target.value} 대피 훈련 사전교육 및 실제 대피 훈련`,
                        })
                      }
                      className="h-8 w-full rounded-md border border-slate-200 bg-white px-2 text-xs font-semibold"
                    >
                      <option value="지진">지진 대피 훈련</option>
                      <option value="화재">화재 대피 훈련</option>
                    </select>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[11px] font-bold text-slate-700">훈련 월</Label>
                    <Input
                      type="number"
                      value={evacuationState.month}
                      onChange={(e) =>
                        setEvacuationState({ ...evacuationState, month: parseInt(e.target.value) || 5 })
                      }
                      className="h-8 text-xs font-semibold"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <Label className="text-[11px] font-bold text-slate-700 flex items-center gap-1">
                    <Clock className="w-3 h-3 text-blue-500" />
                    훈련 일시
                  </Label>
                  <Input
                    value={evacuationState.trainingDateTime}
                    onChange={(e) =>
                      setEvacuationState({ ...evacuationState, trainingDateTime: e.target.value })
                    }
                    placeholder="2026. 5. 23.(금), 7교시"
                    className="h-8 text-xs font-medium"
                  />
                </div>

                <div className="space-y-1">
                  <Label className="text-[11px] font-bold text-slate-700 flex items-center gap-1">
                    <MapPin className="w-3 h-3 text-emerald-500" />
                    훈련 장소
                  </Label>
                  <Input
                    value={evacuationState.trainingLocation}
                    onChange={(e) =>
                      setEvacuationState({ ...evacuationState, trainingLocation: e.target.value })
                    }
                    placeholder="각 교실 및 학교 전체"
                    className="h-8 text-xs"
                  />
                </div>

                <div className="space-y-1">
                  <Label className="text-[11px] font-bold text-slate-700">문서 시행 번호 및 일자</Label>
                  <div className="grid grid-cols-2 gap-2">
                    <Input
                      value={evacuationState.docNo}
                      onChange={(e) => setEvacuationState({ ...evacuationState, docNo: e.target.value })}
                      placeholder="Kish -초등-146"
                      className="h-8 text-xs"
                    />
                    <Input
                      value={evacuationState.docDate}
                      onChange={(e) =>
                        setEvacuationState({ ...evacuationState, docDate: e.target.value })
                      }
                      placeholder="2026. 05. 06."
                      className="h-8 text-xs"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <Label className="text-[11px] font-bold text-slate-700">관련 문서 근거</Label>
                  <Input
                    value={evacuationState.relatedDoc}
                    onChange={(e) =>
                      setEvacuationState({ ...evacuationState, relatedDoc: e.target.value })
                    }
                    placeholder="2026학년도 안전교육 운영 계획(2026.03.24.)"
                    className="h-8 text-xs"
                  />
                </div>

                <div className="pt-2 border-t border-slate-100 space-y-2.5">
                  <div className="text-[11px] font-black text-slate-700 flex items-center gap-1">
                    <UserCheck className="w-3.5 h-3.5 text-indigo-500" />
                    결재선 및 담당자 성명
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label className="text-[10px] text-slate-500">기안 담당자</Label>
                      <Input
                        value={evacuationState.drafterName}
                        onChange={(e) =>
                          setEvacuationState({ ...evacuationState, drafterName: e.target.value })
                        }
                        className="h-7 text-xs"
                      />
                    </div>
                    <div>
                      <Label className="text-[10px] text-slate-500">부장</Label>
                      <Input
                        value={evacuationState.deptHeadName}
                        onChange={(e) =>
                          setEvacuationState({ ...evacuationState, deptHeadName: e.target.value })
                        }
                        className="h-7 text-xs"
                      />
                    </div>
                    <div>
                      <Label className="text-[10px] text-slate-500">교감</Label>
                      <Input
                        value={evacuationState.vpName}
                        onChange={(e) =>
                          setEvacuationState({ ...evacuationState, vpName: e.target.value })
                        }
                        className="h-7 text-xs"
                      />
                    </div>
                    <div>
                      <Label className="text-[10px] text-slate-500">교장</Label>
                      <Input
                        value={evacuationState.principalName}
                        onChange={(e) =>
                          setEvacuationState({ ...evacuationState, principalName: e.target.value })
                        }
                        className="h-7 text-xs"
                      />
                    </div>
                  </div>
                  <div>
                    <Label className="text-[10px] text-slate-500">협조자 (행정실장)</Label>
                    <Input
                      value={evacuationState.adminHeadName}
                      onChange={(e) =>
                        setEvacuationState({ ...evacuationState, adminHeadName: e.target.value })
                      }
                      className="h-7 text-xs"
                    />
                  </div>
                </div>

                <div className="p-3 bg-blue-50 rounded-xl border border-blue-100 text-[11px] text-blue-800 leading-relaxed space-y-1">
                  <div className="font-bold flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5 text-blue-600" />
                    붙임 훈련 계획서 자동 포함:
                  </div>
                  <p>• 사전 점검표 (소방시설/응급조치/방송PPT)</p>
                  <p>• 당일 타임테이블 (안내 $\rightarrow$ 사전교육 $\rightarrow$ 경보 $\rightarrow$ 대피)</p>
                  <p>• 대피 방법 8대 수칙 & 1~3층 대피경로도 안내</p>
                </div>
              </div>
            )}
          </div>

          {/* 우측: 실시간 A4 미리보기 화면 */}
          <div className="flex-1 flex flex-col min-w-0 bg-slate-200/80">
            {/* 뷰 모드 탭 바 */}
            <div className="bg-white border-b border-slate-200 px-4 py-2 flex items-center justify-between shrink-0">
              <Tabs
                value={viewTab}
                onValueChange={(v) => setViewTab(v as any)}
                className="w-auto"
              >
                <TabsList className="h-8 bg-slate-100 p-0.5 rounded-lg">
                  <TabsTrigger value="combined" className="text-xs h-7 px-3 font-bold">
                    통합 문서 보기 (기안+붙임)
                  </TabsTrigger>
                  <TabsTrigger value="draft" className="text-xs h-7 px-3 font-bold">
                    기안문 (1p)
                  </TabsTrigger>
                  <TabsTrigger value="attachment" className="text-xs h-7 px-3 font-bold">
                    붙임 계획서
                  </TabsTrigger>
                </TabsList>
              </Tabs>

              <div className="text-xs text-slate-500 flex items-center gap-2">
                <span>표준 규격: A4 세로 (210 × 297mm)</span>
              </div>
            </div>

            {/* A4 렌더링 스크롤 영역 */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-6 flex justify-center">
              <div
                className="shadow-xl rounded-sm transition-all"
                style={{ width: '210mm' }}
                dangerouslySetInnerHTML={{ __html: currentPreviewHtml }}
              />
            </div>
          </div>
        </div>

        {/* 3. 하단 액션 버튼 바 */}
        <div className="bg-white border-t border-slate-200 px-6 py-3.5 flex items-center justify-between shrink-0">
          <div>
            {createdDocId ? (
              <div className="flex items-center gap-2 text-xs font-bold text-emerald-700 bg-emerald-50 px-3 py-1.5 rounded-lg border border-emerald-200">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                기안 완료: 문서번호 등록됨
                <Button
                  size="sm"
                  variant="link"
                  className="h-auto p-0 text-xs font-black text-emerald-800 underline ml-1"
                  onClick={() => router.push(`/documents/${createdDocId}`)}
                >
                  기안 문서 열기 <ExternalLink className="w-3 h-3 ml-0.5 inline" />
                </Button>
              </div>
            ) : (
              <span className="text-xs text-slate-500">
                상신 시 전자결재 시스템의 [진행 문서함]으로 즉시 연동됩니다.
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handlePrint}
              className="h-9 px-4 text-xs font-bold border-slate-300 hover:bg-slate-50"
            >
              <Printer className="w-4 h-4 mr-1.5 text-slate-600" />
              공문서 인쇄 / PDF 다운로드
            </Button>

            <Button
              type="button"
              size="sm"
              disabled={isSubmitting}
              onClick={handleSubmitApproval}
              className="h-9 px-4 text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white shadow-xs"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />
                  전자결재 상신 중...
                </>
              ) : (
                <>
                  <Send className="w-4 h-4 mr-1.5" />
                  전자결재 기안하기
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
