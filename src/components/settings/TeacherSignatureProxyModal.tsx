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
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { SignaturePad, type SignaturePadRef } from '@/components/ui/signature-pad';
import { optimizeSignatureImage, type OptimizeResult } from '@/lib/utils/imageOptimizer';
import { isActualSignature, generateStampSvgDataUrl } from '@/lib/safety/stampHelper';
import { checkDrawnSignature } from '@/lib/signatureQuality';
import { useToast } from '@/hooks/use-toast';
import type { UserProfile } from '@/lib/types';
import { 
  Upload, 
  Trash2, 
  CheckCircle2, 
  AlertCircle, 
  FileImage, 
  PenTool, 
  RotateCcw, 
  Loader2, 
  Sparkles,
  Info
} from 'lucide-react';

interface TeacherSignatureProxyModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user: UserProfile | null;
  currentSignature?: string | null;
  onSaveSignature: (user: UserProfile, signatureDataUrl: string) => Promise<void>;
}

export function TeacherSignatureProxyModal({
  open,
  onOpenChange,
  user,
  currentSignature,
  onSaveSignature,
}: TeacherSignatureProxyModalProps) {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const sigCanvasRef = useRef<SignaturePadRef>(null);

  const [activeTab, setActiveTab] = useState<'upload' | 'draw'>('upload');
  const [newSignaturePreview, setNewSignaturePreview] = useState<string>('');
  const [optimizeInfo, setOptimizeInfo] = useState<OptimizeResult | null>(null);
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // 모달이 열릴 때 초기화
  useEffect(() => {
    if (open) {
      setNewSignaturePreview('');
      setOptimizeInfo(null);
      setActiveTab('upload');
      sigCanvasRef.current?.clear();
    }
  }, [open, user]);

  if (!user) return null;

  const currentSigUrl = currentSignature || user.signature || '';
  const hasValidSignature = isActualSignature(currentSigUrl);
  const teacherName = user.name || '교직원';

  // 파일 업로드 처리
  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast({
        variant: 'destructive',
        title: '지원하지 않는 파일 형식',
        description: 'PNG, JPG, WEBP 등 이미지 파일만 등록할 수 있습니다.',
      });
      return;
    }

    try {
      setIsOptimizing(true);
      const result = await optimizeSignatureImage(file, 280, 140);
      setNewSignaturePreview(result.dataUrl);
      setOptimizeInfo(result);
      toast({
        title: '서명 이미지 최적화 완료',
        description: `투명 PNG 변환 및 초경량 압축 완료 (${result.originalSize} → ${result.optimizedSize})`,
      });
    } catch (err: any) {
      console.error('[TeacherSignatureProxyModal] File optimize error:', err);
      toast({
        variant: 'destructive',
        title: '이미지 변환 실패',
        description: '서명 이미지를 처리하는 중 오류가 발생했습니다. 다른 이미지를 선택해주세요.',
      });
    } finally {
      setIsOptimizing(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // 직접 그리기 초기화
  const handleClearCanvas = () => {
    sigCanvasRef.current?.clear();
    setNewSignaturePreview('');
    setOptimizeInfo(null);
  };

  // 서명 저장 실행
  const handleSave = async () => {
    let finalSignatureUrl = '';

    if (activeTab === 'upload') {
      if (!newSignaturePreview) {
        toast({
          variant: 'destructive',
          title: '파일 미선택',
          description: '등록할 서명 또는 도장 이미지 파일을 선택해주세요.',
        });
        return;
      }
      finalSignatureUrl = newSignaturePreview;
    } else {
      // 직접 그리기 모드
      if (!sigCanvasRef.current || sigCanvasRef.current.isEmpty()) {
        toast({
          variant: 'destructive',
          title: '서명 미입력',
          description: '서명 패드에 서명을 그려주세요.',
        });
        return;
      }

      const canvasData = sigCanvasRef.current.toDataURL('image/png');
      const problem = await checkDrawnSignature(canvasData);
      if (problem) {
        toast({
          variant: 'destructive',
          title: '서명을 다시 그려주세요',
          description: problem,
        });
        return;
      }

      setIsOptimizing(true);
      try {
        const opt = await optimizeSignatureImage(canvasData, 280, 140);
        finalSignatureUrl = opt.dataUrl;
      } catch (err) {
        finalSignatureUrl = canvasData;
      } finally {
        setIsOptimizing(false);
      }
    }

    try {
      setIsSaving(true);
      await onSaveSignature(user, finalSignatureUrl);
      onOpenChange(false);
    } catch (err: any) {
      console.error('[TeacherSignatureProxyModal] Save error:', err);
    } finally {
      setIsSaving(false);
    }
  };

  // 서명 삭제 실행
  const handleDelete = async () => {
    if (!confirm(`${teacherName} 교직원의 등록된 서명/도장을 삭제하시겠습니까?\n삭제 시 결재 시 가짜 성명 직인이 임시로 사용됩니다.`)) {
      return;
    }

    try {
      setIsDeleting(true);
      await onSaveSignature(user, '');
      onOpenChange(false);
    } catch (err: any) {
      console.error('[TeacherSignatureProxyModal] Delete error:', err);
    } finally {
      setIsDeleting(false);
    }
  };

  // 결재란 날인 예시 프리뷰 대상 (새 서명이 있으면 새 서명, 없으면 현재 서명, 둘 다 없으면 가짜 직인)
  const previewSignatureToDisplay = newSignaturePreview || (hasValidSignature ? currentSigUrl : null);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader className="pb-2 border-b">
          <div className="flex items-center justify-between">
            <div>
              <DialogTitle className="text-lg font-bold flex items-center gap-2">
                <span>교직원 서명 / 도장 관리</span>
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                전자결재 문서 날인 및 각종 장부 날인에 사용되는 서명/도장을 확인하고 대리로 등록·관리합니다.
              </DialogDescription>
            </div>
            {hasValidSignature ? (
              <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-300 font-bold px-2 py-0.5 text-xs">
                <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
                등록 완료
              </Badge>
            ) : (
              <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-300 font-bold px-2 py-0.5 text-xs">
                <AlertCircle className="w-3.5 h-3.5 mr-1" />
                서명 미등록
              </Badge>
            )}
          </div>
        </DialogHeader>

        {/* 1. 교직원 기본 정보 카드 */}
        <div className="bg-slate-50 border rounded-lg p-3 flex items-center justify-between text-xs">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-bold text-sm text-slate-800">{teacherName}</span>
            <span className="text-muted-foreground">{user.email}</span>
            {user.dept && (
              <Badge variant="secondary" className="bg-emerald-100 text-emerald-800 text-[11px] px-1.5 py-0 font-medium">
                {user.dept}
              </Badge>
            )}
            {user.role && (
              <Badge variant="outline" className="text-[11px] px-1.5 py-0 font-medium">
                {user.role}
              </Badge>
            )}
          </div>
          <div className="text-[11px] text-slate-500 shrink-0">
            {hasValidSignature ? '실제 서명 파일이 연결됨' : '현재 가짜 도장 임시 표기 상태'}
          </div>
        </div>

        {/* 2. 현재 상태 & 결재 날인 시뮬레이션 미리보기 */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {/* 현재 등록된 서명 뷰어 */}
          <div className="border rounded-lg p-3 bg-white flex flex-col justify-between">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs font-semibold text-slate-700">현재 등록된 서명/도장</span>
              {hasValidSignature && (
                <span className="text-[10px] text-emerald-600 font-medium">정상 이미지</span>
              )}
            </div>
            <div className="h-24 w-full rounded border border-dashed border-slate-200 bg-[radial-gradient(#e5e7eb_1px,transparent_1px)] [background-size:12px_12px] flex items-center justify-center overflow-hidden p-2">
              {hasValidSignature ? (
                <img
                  src={currentSigUrl}
                  alt="현재 등록된 서명"
                  className="max-h-full max-w-full object-contain mix-blend-multiply"
                />
              ) : (
                <div className="text-center text-xs text-slate-400 flex flex-col items-center">
                  <AlertCircle className="w-5 h-5 text-amber-500 mb-1" />
                  <span>등록된 서명(도장) 없음</span>
                  <span className="text-[10px] text-slate-400 mt-0.5">대리 등록으로 파일을 업로드해주세요</span>
                </div>
              )}
            </div>
          </div>

          {/* 전자결재 문서 직인 날인 예시 시뮬레이터 */}
          <div className="border rounded-lg p-3 bg-white flex flex-col justify-between">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs font-semibold text-slate-700">결재란 날인 예시 (시뮬레이션)</span>
              <span className="text-[10px] text-blue-600 font-medium">
                {newSignaturePreview ? '새 서명 적용 시' : (hasValidSignature ? '실제 날인 모습' : '임시 도장')}
              </span>
            </div>
            <div className="h-24 w-full rounded border bg-slate-50 flex items-center justify-center p-2">
              {/* 결재란 직인 박스 */}
              <div className="w-24 border border-black bg-white flex flex-col text-center shadow-2xs">
                <div className="bg-slate-100 text-[10px] py-0.5 border-b border-black font-semibold">
                  {user.role || '담당'}
                </div>
                <div className="h-14 relative flex items-center justify-center overflow-hidden px-1">
                  {previewSignatureToDisplay ? (
                    <img
                      src={previewSignatureToDisplay}
                      alt="결재 날인 예시"
                      className="max-h-12 max-w-full object-contain mix-blend-multiply"
                    />
                  ) : (
                    // 가짜 자동 성명 직인 (실제 결재 시스템 fallback 직인)
                    <img
                      src={generateStampSvgDataUrl(teacherName)}
                      alt="임시 자동 성명 직인"
                      className="max-h-12 max-w-full object-contain"
                    />
                  )}
                </div>
                <div className="text-[9px] text-slate-600 py-0.5 border-t border-slate-200">
                  {teacherName}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* 3. 대리 등록 탭 (파일 업로드 / 직접 서명) */}
        <div className="border rounded-lg p-3 bg-slate-50/50">
          <div className="text-xs font-bold text-slate-800 mb-2 flex items-center gap-1.5">
            <Sparkles className="w-4 h-4 text-blue-600" />
            <span>서명 / 도장 대리 등록 및 변경</span>
          </div>

          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'upload' | 'draw')}>
            <TabsList className="grid grid-cols-2 h-8 w-full max-w-xs mb-3">
              <TabsTrigger value="upload" className="text-xs flex items-center gap-1.5">
                <Upload className="w-3.5 h-3.5" />
                파일 업로드 (추천)
              </TabsTrigger>
              <TabsTrigger value="draw" className="text-xs flex items-center gap-1.5">
                <PenTool className="w-3.5 h-3.5" />
                직접 그리기
              </TabsTrigger>
            </TabsList>

            {/* 파일 업로드 탭 컨텐츠 */}
            <TabsContent value="upload" className="m-0 space-y-3">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleFileSelect}
              />

              <div
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-slate-300 hover:border-blue-500 hover:bg-blue-50/30 rounded-lg p-4 cursor-pointer text-center transition-all bg-white"
              >
                {isOptimizing ? (
                  <div className="flex flex-col items-center justify-center py-4 text-slate-600">
                    <Loader2 className="w-6 h-6 animate-spin text-blue-600 mb-2" />
                    <span className="text-xs font-semibold">이미지 초경량 투명화 최적화 중...</span>
                  </div>
                ) : newSignaturePreview ? (
                  <div className="flex flex-col items-center justify-center gap-2">
                    <div className="h-20 w-40 rounded border bg-[radial-gradient(#e5e7eb_1px,transparent_1px)] [background-size:10px_10px] flex items-center justify-center p-1 overflow-hidden">
                      <img
                        src={newSignaturePreview}
                        alt="새 서명 미리보기"
                        className="max-h-full max-w-full object-contain mix-blend-multiply"
                      />
                    </div>
                    <div className="text-xs text-blue-600 font-semibold flex items-center gap-1">
                      <CheckCircle2 className="w-4 h-4" />
                      새 서명 파일이 준비되었습니다. (클릭하여 다른 파일 선택)
                    </div>
                    {optimizeInfo && (
                      <div className="text-[11px] text-slate-500">
                        용량 최적화: {optimizeInfo.originalSize} →{' '}
                        <span className="font-bold text-emerald-600">{optimizeInfo.optimizedSize}</span> (투명 PNG)
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-2 text-slate-600">
                    <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center text-blue-600 mb-2">
                      <FileImage className="w-5 h-5" />
                    </div>
                    <p className="text-xs font-bold text-slate-700">도장 사진 또는 서명 이미지 파일 클릭하여 선택</p>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      PNG, JPG, WEBP 파일 지원 (배경 투명화 및 리사이징 자동 처리)
                    </p>
                  </div>
                )}
              </div>

              <div className="flex items-start gap-1.5 text-[11px] text-slate-500 bg-blue-50/60 p-2 rounded border border-blue-100">
                <Info className="w-3.5 h-3.5 text-blue-600 shrink-0 mt-0.5" />
                <span>
                  교직원에게 카카오톡이나 메일로 받은 도장 사진(종이에 찍은 사진도 가능)을 그대로 올리시면 결재란 규격에 맞춰 자동 보정 및 투명화됩니다.
                </span>
              </div>
            </TabsContent>

            {/* 직접 그리기 탭 컨텐츠 */}
            <TabsContent value="draw" className="m-0 space-y-2">
              <div className="border rounded-md bg-white p-2">
                <div className="flex justify-between items-center mb-1">
                  <span className="text-[11px] text-slate-500 font-medium">서명 패드에 서명 또는 도장 형태를 그려주세요.</span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={handleClearCanvas}
                    className="h-6 px-2 text-[11px] text-slate-500 hover:text-slate-800"
                  >
                    <RotateCcw className="w-3 h-3 mr-1" />
                    지우기
                  </Button>
                </div>
                <div className="border rounded bg-slate-50 overflow-hidden flex items-center justify-center">
                  <SignaturePad
                    ref={sigCanvasRef}
                    className="w-full h-32 bg-white cursor-crosshair"
                  />
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </div>

        <DialogFooter className="pt-2 border-t flex items-center justify-between sm:justify-between">
          <div>
            {hasValidSignature && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleDelete}
                disabled={isSaving || isDeleting}
                className="text-destructive border-destructive/30 hover:bg-destructive/10 text-xs h-8"
              >
                {isDeleting ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" /> : <Trash2 className="w-3.5 h-3.5 mr-1" />}
                서명 삭제
              </Button>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(false)}
              disabled={isSaving || isDeleting}
              className="text-xs h-8"
            >
              닫기
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={handleSave}
              disabled={isSaving || isDeleting || isOptimizing || (activeTab === 'upload' && !newSignaturePreview)}
              className="text-xs h-8 bg-blue-600 hover:bg-blue-700"
            >
              {isSaving ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" />
                  저장 중...
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
                  서명 등록 및 적용
                </>
              )}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
