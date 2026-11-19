'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { FileText, FilePlus, Check, Clock, MapPin } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import {
  getYearlyDraftContent,
  generateYearlyPlanAttachmentHtml,
  getEvacuationDraftContent,
  generateEvacuationPlanAttachmentHtml,
} from './templates/safetyHtmlGenerator';
import {
  loadYearlyTemplate,
  loadEvacuationTemplate,
} from '@/lib/safety/safetyTemplateService';

export type SafetyDocTypeId = 1 | 2;

interface SafetyDocModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultDocType?: SafetyDocTypeId;
}

export function SafetyDocModal({
  isOpen,
  onClose,
  defaultDocType = 1,
}: SafetyDocModalProps) {
  const router = useRouter();
  const { toast } = useToast();

  const [docAcademicYear, setDocAcademicYear] = useState('2026');
  const [docSemesterName, setDocSemesterName] = useState('1학기');
  const [selectedDocType, setSelectedDocType] = useState<SafetyDocTypeId>(defaultDocType);

  // 재난대피 훈련 옵션
  const [disasterType, setDisasterType] = useState<'지진' | '화재'>('지진');
  const [trainingDateTime, setTrainingDateTime] = useState('2026. 5. 23.(금) 7교시');
  const [trainingLocation, setTrainingLocation] = useState('각 교실 및 학교 전체 대피소');

  useEffect(() => {
    if (isOpen) {
      setSelectedDocType(defaultDocType);
      if (defaultDocType === 2) {
        setDisasterType('지진');
        setTrainingDateTime('2026. 5. 23.(금) 7교시');
      }
    }
  }, [isOpen, defaultDocType]);

  // 학기 변경 시 대피훈련 종류 추천 동기화
  const handleSemesterChange = (val: string) => {
    setDocSemesterName(val);
    if (val === '2학기') {
      setDisasterType('화재');
      setTrainingDateTime(`${docAcademicYear}. 10. 21.(수) 6교시`);
    } else {
      setDisasterType('지진');
      setTrainingDateTime(`${docAcademicYear}. 5. 23.(금) 7교시`);
    }
  };

  // 공문서 2종 정의
  const SAFETY_DOCUMENT_TYPES = [
    {
      id: 1 as SafetyDocTypeId,
      category: '학생 안전교육 기본 계획안',
      displayTitle: (year: string, sem?: string, disType?: string) =>
        `${year}학년도 학생 안전교육 운영 계획 수립`,
      description:
        '교육부 7대 표준 안전교육(51~52차시), 학년별 차시 배당, 재난대피 훈련 및 가정연계 지도 종합 계획수립 건',
      badgeColor: 'bg-rose-50 text-rose-700 border-rose-200',
    },
    {
      id: 2 as SafetyDocTypeId,
      category: '재난대비 실무 훈련 계획안',
      displayTitle: (year: string, sem?: string, disType?: string) =>
        `${year}학년도 ${sem || '1학기'} ${disType || '지진'} 대피 훈련 실시 계획`,
      description:
        '사전 준비 점검표, 당일 타임테이블(08:15~14:50), 행동요령 8대 수칙 및 1~3층 대피경로가 포함된 현장 실무 계획 건',
      badgeColor: 'bg-blue-50 text-blue-700 border-blue-200',
    },
  ];

  // 기안 작성 시작 (시스템 기안기 연동 및 커스텀 서식 템플릿 자동 반영)
  const handleCreateDraft = async () => {
    let title = '';
    let content = '';
    let attachments: Array<{ name: string; size: number; data: string }> = [];

    if (selectedDocType === 1) {
      const yearlyTpl = await loadYearlyTemplate();
      title = `${docAcademicYear}학년도 학생 안전교육 운영 계획 수립`;
      content = getYearlyDraftContent(docAcademicYear, docSemesterName, yearlyTpl);
      const planHtml = generateYearlyPlanAttachmentHtml(docAcademicYear, docSemesterName, yearlyTpl);

      attachments = [
        {
          name: `붙임 1. ${docAcademicYear}학년도 학생 안전교육 운영 계획.html`,
          size: planHtml.length * 2,
          data: 'data:text/html;charset=utf-8,' + encodeURIComponent(planHtml),
        },
      ];
    } else {
      const evacTpl = await loadEvacuationTemplate();
      title = `${docAcademicYear}학년도 ${docSemesterName} ${disasterType} 대피 훈련 실시 계획`;
      content = getEvacuationDraftContent(
        docAcademicYear,
        docSemesterName,
        disasterType,
        trainingDateTime,
        trainingLocation,
        evacTpl
      );
      const evacHtml = generateEvacuationPlanAttachmentHtml(
        docAcademicYear,
        docSemesterName,
        disasterType,
        trainingDateTime,
        trainingLocation,
        evacTpl
      );

      attachments = [
        {
          name: `붙임 1. ${docAcademicYear}학년도 ${disasterType} 대피 훈련 실시 계획.html`,
          size: evacHtml.length * 2,
          data: 'data:text/html;charset=utf-8,' + encodeURIComponent(evacHtml),
        },
      ];
    }

    // 시스템 기안기 전송을 위한 세션 스토리지 저장 (스쿨버스 기안 방식과 100% 동일)
    const tplKey = `safety_doc_${selectedDocType}`;
    sessionStorage.setItem('pending_doc_draft', JSON.stringify({ templateKey: tplKey, dutyName: '학생 안전지도 관리', title, content, attachments }));
    onClose();
    router.push(`/new?safetyTemplate=true&templateKey=${tplKey}`);
    toast({
      title: '안전교육 공문서 기안 생성',
      description: `[${title}] 양식으로 시스템 기안기가 구동됩니다.`,
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[620px] max-h-[85vh] overflow-y-auto rounded-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base font-extrabold text-slate-900">
            <FileText className="w-5 h-5 text-rose-600 shrink-0" />
            <span>📝 학생 안전교육 관련 공문서 기안 작성</span>
            <Badge
              variant="outline"
              className="text-[10px] bg-rose-50 text-rose-700 border-rose-200 font-bold shrink-0"
            >
              전용 서식 2종
            </Badge>
          </DialogTitle>
          <DialogDescription className="text-xs text-slate-500">
            기안 작성할 공문서 종류를 선택하세요. 학년도 및 학기를 설정한 후 기안 작성을 시작할 수 있습니다.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2 text-xs">
          {/* 학년도 / 학기 선택 바 */}
          <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl border border-slate-200">
            <div className="flex items-center gap-1.5 flex-1">
              <Label className="text-xs font-bold text-slate-700 whitespace-nowrap">학년도:</Label>
              <Input
                value={docAcademicYear}
                onChange={(e) => setDocAcademicYear(e.target.value)}
                className="h-8 text-xs font-bold w-24 bg-white"
                placeholder="2026"
              />
            </div>
            <div className="flex items-center gap-1.5 flex-1">
              <Label className="text-xs font-bold text-slate-700 whitespace-nowrap">학기/구분:</Label>
              <Select value={docSemesterName} onValueChange={handleSemesterChange}>
                <SelectTrigger className="h-8 text-xs font-bold w-32 bg-white border-slate-200">
                  <SelectValue placeholder="학기 선택" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1학기" className="text-xs font-semibold">1학기</SelectItem>
                  <SelectItem value="2학기" className="text-xs font-semibold">2학기</SelectItem>
                  <SelectItem value="연간" className="text-xs font-semibold">연간</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* 재난대피 훈련 선택 시 추가 입력 옵션 */}
          {selectedDocType === 2 && (
            <div className="p-3 bg-blue-50/70 rounded-xl border border-blue-200 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="font-bold text-blue-900 text-xs flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5 text-blue-600" />
                  재난대피 세부 훈련 정보
                </span>
                <div className="flex items-center gap-1">
                  <Button
                    type="button"
                    size="sm"
                    variant={disasterType === '지진' ? 'default' : 'outline'}
                    className={cn(
                      'h-6 text-[11px] px-2.5 font-bold rounded-md',
                      disasterType === '지진' ? 'bg-blue-600 hover:bg-blue-700 text-white' : 'bg-white text-slate-700'
                    )}
                    onClick={() => {
                      setDisasterType('지진');
                      setTrainingDateTime(`${docAcademicYear}. 5. 23.(금) 7교시`);
                    }}
                  >
                    지진 대피
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant={disasterType === '화재' ? 'default' : 'outline'}
                    className={cn(
                      'h-6 text-[11px] px-2.5 font-bold rounded-md',
                      disasterType === '화재' ? 'bg-amber-600 hover:bg-amber-700 text-white' : 'bg-white text-slate-700'
                    )}
                    onClick={() => {
                      setDisasterType('화재');
                      setTrainingDateTime(`${docAcademicYear}. 10. 21.(수) 6교시`);
                    }}
                  >
                    화재 대피
                  </Button>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label className="text-[11px] text-blue-800 font-semibold">훈련 일시</Label>
                  <Input
                    value={trainingDateTime}
                    onChange={(e) => setTrainingDateTime(e.target.value)}
                    placeholder="2026. 5. 23.(금) 7교시"
                    className="h-7 text-xs bg-white border-blue-200"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-[11px] text-blue-800 font-semibold flex items-center gap-1">
                    <MapPin className="w-3 h-3" />
                    훈련 장소
                  </Label>
                  <Input
                    value={trainingLocation}
                    onChange={(e) => setTrainingLocation(e.target.value)}
                    placeholder="각 교실 및 학교 전체 대피소"
                    className="h-7 text-xs bg-white border-blue-200"
                  />
                </div>
              </div>
            </div>
          )}

          {/* 공문서 2종 선택 목록 카드 */}
          <div className="space-y-2.5">
            <Label className="font-bold text-slate-800 text-xs">
              📋 결재 공문서 종류 선택 (클릭 시 미리보기 및 기안 생성)
            </Label>
            <div className="grid grid-cols-1 gap-2.5">
              {SAFETY_DOCUMENT_TYPES.map((docType) => {
                const isSelected = selectedDocType === docType.id;
                const title =
                  docType.id === 1
                    ? docType.displayTitle(docAcademicYear)
                    : docType.displayTitle(docAcademicYear, docSemesterName, disasterType);

                return (
                  <div
                    key={docType.id}
                    onClick={() => setSelectedDocType(docType.id)}
                    className={cn(
                      'p-3.5 rounded-xl border transition-all cursor-pointer flex flex-col gap-1.5 relative',
                      isSelected
                        ? docType.id === 1
                          ? 'bg-rose-50/80 border-rose-500 ring-2 ring-rose-500/20 shadow-xs'
                          : 'bg-blue-50/80 border-blue-500 ring-2 ring-blue-500/20 shadow-xs'
                        : 'bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50/50'
                    )}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className={cn('text-[10px] font-bold px-2 py-0.5 rounded-md border', docType.badgeColor)}>
                        {docType.category}
                      </span>
                      {isSelected && (
                        <Badge
                          className={cn(
                            'text-white text-[10px] px-2 py-0.5 font-bold flex items-center gap-1',
                            docType.id === 1 ? 'bg-rose-600' : 'bg-blue-600'
                          )}
                        >
                          <Check className="w-3 h-3" /> 선택됨
                        </Badge>
                      )}
                    </div>

                    <h5 className="font-bold text-slate-900 text-xs sm:text-sm mt-0.5 leading-snug">
                      {title}
                    </h5>

                    <p className="text-[11px] text-slate-500 leading-relaxed">
                      {docType.description}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2 pt-2 border-t">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            className="h-9 text-xs font-semibold text-slate-600 border-slate-300 rounded-xl"
          >
            취소
          </Button>

          <Button
            type="button"
            onClick={handleCreateDraft}
            className={cn(
              'h-9 text-xs font-bold text-white rounded-xl shadow-xs',
              selectedDocType === 1 ? 'bg-rose-600 hover:bg-rose-700' : 'bg-blue-600 hover:bg-blue-700'
            )}
          >
            <FilePlus className="w-3.5 h-3.5 mr-1.5" />
            선택한 양식으로 기안 작성 시작
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
