'use client';

import React, { useState, useRef, useEffect } from 'react';
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
import { Textarea } from '@/components/ui/textarea';
import {
  FileEdit,
  Camera,
  FileText,
  FileImage,
  X,
  Loader2,
  ExternalLink,
  Calendar,
  AlertTriangle,
  CheckCircle2,
} from 'lucide-react';
import type { ApprovalDoc, Attachment } from '@/lib/types';
import { uploadCertificateAttachment, compressCertificateImage } from '@/lib/imageResize';
import { updateAbsenceApplication } from '@/lib/services/documentService';
import { useToast } from '@/hooks/use-toast';
import { openFileInNewTab } from '@/lib/utils';

interface AbsenceEditDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  doc: ApprovalDoc | null;
  onSuccess?: (updatedDocId: string) => void;
  userEmail?: string;
  role?: 'parent' | 'teacher';
}

const QUICK_DISEASES = [
  { name: '독감(인플루엔자)', category: '감염병', type: '출석인정' },
  { name: '코로나19', category: '감염병', type: '출석인정' },
  { name: '수족구', category: '감염병', type: '출석인정' },
  { name: '수두', category: '감염병', type: '출석인정' },
  { name: '감기/발열', category: '단순질병', type: '병결' },
  { name: '인후통/편도염', category: '단순질병', type: '병결' },
  { name: '급성 장염', category: '식중독', type: '병결' },
  { name: '복통/위장염', category: '단순질병', type: '병결' },
  { name: '중이염', category: '단순질병', type: '병결' },
];

export function AbsenceEditDialog({
  open,
  onOpenChange,
  doc,
  onSuccess,
  userEmail = '',
  role = 'parent',
}: AbsenceEditDialogProps) {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const pfd = doc?.parentFormData;

  // 폼 상태
  const [absenceType, setAbsenceType] = useState<'병결' | '출석인정' | '기타' | '미인정'>('병결');
  const [diseaseCategory, setDiseaseCategory] = useState<string>('단순질병');
  const [diseaseName, setDiseaseName] = useState<string>('');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [absenceReason, setAbsenceReason] = useState<string>('');
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [isProcessingFiles, setIsProcessingFiles] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // 문서 열릴 때 초기값 바인딩
  useEffect(() => {
    if (doc && open) {
      const data = doc.parentFormData;
      const initialType = (data?.absenceType as any) || '병결';
      setAbsenceType(initialType);
      setDiseaseCategory(data?.diseaseCategory || (initialType === '출석인정' ? '감염병' : '단순질병'));
      setDiseaseName(data?.diseaseName || '');
      setStartDate(data?.absencePeriod?.startDate || '');
      setEndDate(data?.absencePeriod?.endDate || '');
      setAbsenceReason(data?.absenceReason || '');

      // 첨부파일 복원 (attachments 배열 우선, 없으면 medicalCertificate 단일 파일)
      let initialAtts: Attachment[] = [];
      if (Array.isArray(data?.attachments) && data.attachments.length > 0) {
        initialAtts = [...data.attachments];
      } else if (Array.isArray(doc.attachments) && doc.attachments.length > 0) {
        initialAtts = [...doc.attachments];
      } else if (data?.medicalCertificateUrl) {
        initialAtts = [
          {
            name: data.medicalCertificateName || '소견서_진단서.jpg',
            data: data.medicalCertificateUrl,
          },
        ];
      }
      setAttachments(initialAtts.slice(0, 5));
    }
  }, [doc, open]);

  // 주말 제외 결석 일수 계산
  const calculateTotalDays = (start: string, end: string) => {
    if (!start || !end) return 0;
    const s = new Date(start + 'T00:00:00');
    const e = new Date(end + 'T00:00:00');
    if (isNaN(s.getTime()) || isNaN(e.getTime()) || s > e) return 0;

    let count = 0;
    const cur = new Date(s);
    while (cur <= e) {
      const day = cur.getDay();
      if (day !== 0 && day !== 6) {
        count++;
      }
      cur.setDate(cur.getDate() + 1);
    }
    return count;
  };

  const totalDays = calculateTotalDays(startDate, endDate);

  // 파일 선택 및 압축 처리 (최대 5개)
  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const availableSlots = 5 - attachments.length;
    if (availableSlots <= 0) {
      toast({
        variant: 'destructive',
        title: '첨부파일 한도 초과',
        description: '첨부파일은 최대 5개까지만 등록할 수 있습니다.',
      });
      return;
    }

    const filesToProcess = Array.from(files).slice(0, availableSlots);
    setIsProcessingFiles(true);

    try {
      const newAttachments: Attachment[] = [];
      for (const file of filesToProcess) {
        const uploadResult = await uploadCertificateAttachment(file);
        newAttachments.push({
          name: file.name,
          data: uploadResult.url,
          size: uploadResult.size,
        });
      }

      setAttachments((prev) => [...prev, ...newAttachments].slice(0, 5));
      toast({
        title: '파일이 추가되었습니다.',
        description: `${newAttachments.length}개의 증빙서류가 등록되었습니다.`,
      });
    } catch (err: any) {
      toast({
        variant: 'destructive',
        title: '파일 처리 오류',
        description: err.message || '파일을 불러오지 못했습니다.',
      });
    } finally {
      setIsProcessingFiles(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleRemoveAttachment = (index: number) => {
    setAttachments((prev) => prev.filter((_, i) => i !== index));
  };

  // 빠른 질병 칩 선택
  const handleSelectQuickDisease = (item: (typeof QUICK_DISEASES)[0]) => {
    setDiseaseName(item.name);
    setDiseaseCategory(item.category);
    setAbsenceType(item.type as any);
    if (!absenceReason) {
      setAbsenceReason(`${item.name} 진단 및 치료로 인한 결석`);
    }
  };

  // 저장 제출
  const handleSave = async () => {
    if (!doc?.id) return;
    if (!startDate || !endDate) {
      toast({ variant: 'destructive', title: '결석 기간을 입력해 주세요.' });
      return;
    }
    if (totalDays <= 0) {
      toast({ variant: 'destructive', title: '시작일은 종료일보다 이전이어야 합니다.' });
      return;
    }
    if (!absenceReason.trim()) {
      toast({ variant: 'destructive', title: '결석 사유를 입력해 주세요.' });
      return;
    }

    setIsSaving(true);
    try {
      const res = await updateAbsenceApplication(doc.id, {
        absencePeriod: {
          startDate,
          endDate,
          totalDays,
        },
        absenceType,
        absenceReason: absenceReason.trim(),
        diseaseCategory,
        diseaseName: diseaseName.trim(),
        attachments,
        modifiedBy: userEmail || 'user',
        modifiedRole: role,
      });

      if (res.success) {
        toast({
          title: '결석계가 성공적으로 수정되었습니다.',
          description: '출석부 및 보건실 질병대장에 변경 사항이 실시간 동기화되었습니다.',
        });
        onOpenChange(false);
        if (onSuccess) onSuccess(doc.id);
      } else {
        toast({
          variant: 'destructive',
          title: '수정 실패',
          description: res.error || '수정 중 오류가 발생했습니다.',
        });
      }
    } catch (err: any) {
      toast({
        variant: 'destructive',
        title: '오류 발생',
        description: err.message,
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl max-h-[90vh] flex flex-col p-0 overflow-hidden bg-white">
        <DialogHeader className="p-4 sm:p-5 border-b border-slate-100 bg-slate-50/80 shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-indigo-100 text-indigo-700 flex items-center justify-center">
              <FileEdit className="w-4 h-4" />
            </div>
            <div>
              <DialogTitle className="text-base font-bold text-slate-900">
                결석계 내용 수정
              </DialogTitle>
              <DialogDescription className="text-xs text-slate-500 mt-0.5">
                {pfd?.studentName || doc?.title} ({pfd?.gradeClassNumber || ''}) 학생의 결석계 정보 및 증빙서류를 수정합니다.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4 text-xs">
          {/* 1. 결석 구분 (병결 vs 출석인정) */}
          <div className="space-y-1.5">
            <Label className="font-bold text-slate-700 text-xs">결석 구분 선택</Label>
            <div className="grid grid-cols-4 gap-1.5">
              {(['병결', '출석인정', '기타', '미인정'] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => {
                    setAbsenceType(t);
                    if (t === '출석인정') setDiseaseCategory('감염병');
                    else if (t === '병결' && diseaseCategory === '감염병') setDiseaseCategory('단순질병');
                  }}
                  className={`py-2 px-1 text-center rounded-lg border font-bold text-xs transition-all ${
                    absenceType === t
                      ? t === '출석인정'
                        ? 'bg-rose-50 border-rose-400 text-rose-700 ring-2 ring-rose-200'
                        : 'bg-indigo-50 border-indigo-500 text-indigo-700 ring-2 ring-indigo-200'
                      : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  {t}
                  {t === '출석인정' && <span className="block text-[9px] font-normal text-rose-500">독감/감염병</span>}
                </button>
              ))}
            </div>
          </div>

          {/* 2. 빠른 질병 칩 (독감, 코로나 등 원클릭 선택) */}
          {(absenceType === '병결' || absenceType === '출석인정') && (
            <div className="space-y-1.5 p-3 bg-slate-50 rounded-xl border border-slate-200">
              <div className="flex items-center justify-between">
                <span className="font-bold text-slate-700 text-xs flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5 text-indigo-600" />
                  빠른 질병명 선택
                </span>
                <span className="text-[10px] text-slate-500">원클릭 자동 분류</span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {QUICK_DISEASES.map((d) => (
                  <button
                    key={d.name}
                    type="button"
                    onClick={() => handleSelectQuickDisease(d)}
                    className={`px-2 py-1 rounded text-[11px] font-semibold border transition-all ${
                      diseaseName === d.name
                        ? 'bg-indigo-600 text-white border-indigo-600 shadow-2xs'
                        : 'bg-white text-slate-700 border-slate-300 hover:border-indigo-400 hover:bg-indigo-50/50'
                    }`}
                  >
                    {d.name}
                    {d.category === '감염병' && (
                      <span className={`ml-1 text-[9px] ${diseaseName === d.name ? 'text-indigo-200' : 'text-rose-600'}`}>
                        [감염]
                      </span>
                    )}
                  </button>
                ))}
              </div>

              {/* 질병 형태 & 직접 입력 */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2 border-t border-slate-200 mt-2">
                <div>
                  <Label className="text-[11px] text-slate-600 mb-1 block">질병 형태</Label>
                  <div className="grid grid-cols-3 gap-1">
                    {(['단순질병', '감염병', '식중독'] as const).map((cat) => (
                      <button
                        key={cat}
                        type="button"
                        onClick={() => {
                          setDiseaseCategory(cat);
                          if (cat === '감염병') setAbsenceType('출석인정');
                        }}
                        className={`py-1 text-[10px] font-bold rounded border ${
                          diseaseCategory === cat
                            ? cat === '감염병'
                              ? 'bg-rose-100 text-rose-800 border-rose-400'
                              : 'bg-indigo-100 text-indigo-800 border-indigo-400'
                            : 'bg-white text-slate-600 border-slate-200'
                        }`}
                      >
                        {cat}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <Label className="text-[11px] text-slate-600 mb-1 block">세부 병명 (수기 입력)</Label>
                  <Input
                    value={diseaseName}
                    onChange={(e) => setDiseaseName(e.target.value)}
                    placeholder="예: A형 독감, 급성 장염"
                    className="h-7 text-xs bg-white"
                  />
                </div>
              </div>
            </div>
          )}

          {/* 3. 결석 기간 및 일수 */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label className="font-bold text-slate-700 text-xs flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5 text-slate-500" />
                결석 기간 (등교 중지 기간)
              </Label>
              <span className="text-[11px] font-extrabold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200">
                수업일수: {totalDays}일간 (주말 제외)
              </span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <span className="text-[10px] text-slate-500 block mb-0.5">시작일</span>
                <Input
                  type="date"
                  value={startDate}
                  onChange={(e) => {
                    setStartDate(e.target.value);
                    if (!endDate || e.target.value > endDate) setEndDate(e.target.value);
                  }}
                  className="h-8 text-xs font-mono bg-white"
                />
              </div>
              <div>
                <span className="text-[10px] text-slate-500 block mb-0.5">종료일</span>
                <Input
                  type="date"
                  value={endDate}
                  min={startDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="h-8 text-xs font-mono bg-white"
                />
              </div>
            </div>
          </div>

          {/* 4. 결석 사유 */}
          <div className="space-y-1">
            <Label className="font-bold text-slate-700 text-xs">결석 사유 상세</Label>
            <Textarea
              value={absenceReason}
              onChange={(e) => setAbsenceReason(e.target.value)}
              placeholder="상세 증상 및 결석 사유를 입력하세요 (예: 39도 고열로 병원 방문 후 A형 독감 확진 판정받아 5일간 등교 중지 격리 치료 필요)"
              className="h-20 text-xs resize-none"
            />
          </div>

          {/* 5. 첨부파일 관리 (최대 5개) */}
          <div className="space-y-2 pt-2 border-t border-slate-200">
            <div className="flex items-center justify-between">
              <div>
                <Label className="font-bold text-slate-700 text-xs flex items-center gap-1">
                  <FileText className="w-3.5 h-3.5 text-indigo-600" />
                  증빙서류 첨부 (소견서·진단서·처방전)
                </Label>
                <span className="text-[10px] text-slate-500 block">
                  사진(JPG, PNG) 및 PDF 문서를 최대 5개까지 첨부할 수 있습니다.
                </span>
              </div>
              <Badge variant="outline" className="text-[10px] font-bold">
                {attachments.length} / 5개
              </Badge>
            </div>

            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept="image/*,application/pdf"
              onChange={handleFileSelect}
              className="hidden"
            />

            {/* 첨부파일 목록 카드 */}
            {attachments.length > 0 && (
              <div className="space-y-1.5 max-h-48 overflow-y-auto p-1">
                {attachments.map((att, idx) => {
                  const isPdf = att.data?.startsWith('data:application/pdf') || att.name?.toLowerCase().endsWith('.pdf');
                  return (
                    <div
                      key={idx}
                      className="flex items-center justify-between p-2 rounded-lg bg-slate-50 border border-slate-200 gap-2"
                    >
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        {isPdf ? (
                          <div className="w-8 h-8 rounded bg-rose-50 border border-rose-200 flex flex-col items-center justify-center text-rose-600 shrink-0 font-sans">
                            <FileText className="w-4 h-4" />
                            <span className="text-[6px] font-black uppercase">PDF</span>
                          </div>
                        ) : (
                          <img
                            src={att.data}
                            alt={att.name}
                            className="w-8 h-8 object-cover rounded border border-slate-300 shrink-0"
                          />
                        )}
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-bold text-slate-800 truncate">{att.name}</p>
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] text-slate-400">
                              {isPdf ? 'PDF 문서' : '이미지 사진'}
                            </span>
                            <button
                              type="button"
                              onClick={() => openFileInNewTab(att.data, att.name)}
                              className="text-[10px] text-blue-600 hover:underline font-semibold inline-flex items-center gap-0.5"
                            >
                              <ExternalLink className="w-2.5 h-2.5" />
                              새 탭에서 열기
                            </button>
                          </div>
                        </div>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRemoveAttachment(idx)}
                        className="h-7 w-7 p-0 text-slate-400 hover:text-rose-600 shrink-0"
                        title="첨부 삭제"
                      >
                        <X className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  );
                })}
              </div>
            )}

            {/* 파일 추가 버튼 */}
            {attachments.length < 5 && (
              <Button
                type="button"
                variant="outline"
                onClick={() => fileInputRef.current?.click()}
                disabled={isProcessingFiles}
                className="w-full h-8 text-xs border-dashed border-indigo-300 hover:border-indigo-500 text-indigo-700 bg-indigo-50/40 hover:bg-indigo-50 gap-1.5"
              >
                {isProcessingFiles ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    파일 압축 처리 중...
                  </>
                ) : (
                  <>
                    <Camera className="w-3.5 h-3.5" />
                    파일 추가하기 (사진 또는 PDF, {5 - attachments.length}개 추가 가능)
                  </>
                )}
              </Button>
            )}
          </div>
        </div>

        <DialogFooter className="p-3 sm:p-4 border-t border-slate-100 bg-slate-50 flex items-center justify-end gap-2 shrink-0">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onOpenChange(false)}
            disabled={isSaving}
            className="h-8 text-xs font-semibold"
          >
            취소
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={handleSave}
            disabled={isSaving || isProcessingFiles}
            className="h-8 text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white gap-1.5"
          >
            {isSaving ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                수정 사항 저장 및 동기화 중...
              </>
            ) : (
              '결석계 수정 저장'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
