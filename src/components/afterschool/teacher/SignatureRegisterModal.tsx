'use client';

import React, { useState, useRef } from 'react';
import SignatureCanvas from 'react-signature-canvas';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Eraser, Upload, CheckCircle2, AlertCircle } from 'lucide-react';
import { compressImage } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { getDb } from '@/lib/firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';

interface SignatureRegisterModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  teacherName: string;
  teacherEmail?: string;
  courseId?: string;
  onSuccess: (savedSignatureUrl: string) => void;
}

export function SignatureRegisterModal({
  open,
  onOpenChange,
  teacherName,
  teacherEmail = '',
  courseId = '',
  onSuccess
}: SignatureRegisterModalProps) {
  const { toast } = useToast();
  const sigCanvas = useRef<any>(null);

  const [signatureMode, setSignatureMode] = useState<'draw' | 'upload'>('draw');
  const [sigPreview, setSigPreview] = useState<string>('');
  const [isSaving, setIsSaving] = useState(false);

  const clearSignature = () => {
    if (sigCanvas.current) {
      sigCanvas.current.clear();
    }
    setSigPreview('');
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast({
        variant: 'destructive',
        title: '파일 형식 오류',
        description: '이미지 파일(PNG, JPG)만 등록할 수 있습니다.'
      });
      return;
    }

    const reader = new FileReader();
    reader.onload = async (event) => {
      const base64 = event.target?.result as string;
      if (base64) {
        try {
          const compressed = await compressImage(base64, 300);
          setSigPreview(compressed);
        } catch {
          setSigPreview(base64);
        }
      }
    };
    reader.readAsDataURL(file);
  };

  const handleSave = async () => {
    let finalSignature = sigPreview;

    if (signatureMode === 'draw' && !finalSignature) {
      if (sigCanvas.current && !sigCanvas.current.isEmpty()) {
        finalSignature = sigCanvas.current.getTrimmedCanvas().toDataURL('image/png');
      }
    }

    if (!finalSignature) {
      toast({
        variant: 'destructive',
        title: '서명 필요',
        description: '서명을 그리거나 도장 이미지 파일을 업로드해 주세요.'
      });
      return;
    }

    setIsSaving(true);
    try {
      // 1. 이메일이 있거나 users 컬렉션에서 교사 이름으로 프로필 업데이트
      const targetEmail = teacherEmail.trim().toLowerCase();
      if (targetEmail) {
        const userRef = doc(getDb(), 'users', targetEmail);
        await setDoc(userRef, { signature: finalSignature, updatedAt: new Date().toISOString() }, { merge: true });
      }

      // 2. 강좌별 서명 저장 (결재 문서가 있는 경우를 대비)
      if (courseId) {
        const approvalDocRef = doc(getDb(), 'afterschool_approval_docs', courseId);
        const snap = await getDoc(approvalDocRef);
        if (snap.exists()) {
          const currentSignatures = snap.data()?.instructorSignatures || {};
          await setDoc(approvalDocRef, {
            instructorSignatures: {
              ...currentSignatures,
              [teacherName]: finalSignature
            }
          }, { merge: true });
        }
      }

      toast({
        title: '서명(도장) 등록 완료',
        description: `${teacherName} 선생님의 서명(도장)이 정상 등록되었습니다.`
      });

      onSuccess(finalSignature);
      onOpenChange(false);
    } catch (err: any) {
      toast({
        variant: 'destructive',
        title: '저장 오류',
        description: err?.message || '서명 등록 중 오류가 발생했습니다.'
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md p-6">
        <DialogHeader className="space-y-1">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-indigo-600 shrink-0" />
            <DialogTitle className="text-base font-bold text-slate-900">
              강사 서명 (도장) 등록
            </DialogTitle>
          </div>
          <DialogDescription className="text-xs text-slate-500">
            출석부 및 출근부에 날인할 <strong className="text-slate-800">{teacherName}</strong> 선생님의 도장 또는 서명을 등록합니다.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-2 text-xs">
          {/* 모드 선택 */}
          <div className="flex justify-between items-center bg-slate-100 p-1 rounded-xl">
            <button
              type="button"
              onClick={() => {
                setSignatureMode('draw');
                setSigPreview('');
              }}
              className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all ${signatureMode === 'draw' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-600'}`}
            >
              직접 서명 그리기
            </button>
            <button
              type="button"
              onClick={() => {
                setSignatureMode('upload');
                setSigPreview('');
              }}
              className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all ${signatureMode === 'upload' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-600'}`}
            >
              도장 이미지 파일 업로드
            </button>
          </div>

          {signatureMode === 'draw' && (
            <div className="space-y-2">
              <div className="flex justify-between items-center px-1">
                <span className="text-[11px] text-slate-500">마우스나 터치펜으로 서명을 그려주세요.</span>
                <Button variant="ghost" size="sm" onClick={clearSignature} className="h-6 px-2 text-slate-500 text-xs hover:text-slate-800">
                  <Eraser className="h-3 w-3 mr-1" /> 지우기
                </Button>
              </div>
              <div className="border-2 border-dashed border-slate-300 rounded-xl bg-white overflow-hidden touch-none relative h-36 w-full flex items-center justify-center shadow-inner">
                <SignatureCanvas 
                  ref={sigCanvas}
                  canvasProps={{ 
                    className: 'w-full h-full cursor-crosshair touch-none' 
                  }}
                  backgroundColor="rgba(255,255,255,0)"
                  penColor="#b91c1c"
                />
              </div>
            </div>
          )}

          {signatureMode === 'upload' && (
            <div className="space-y-2">
              <div className="flex flex-col items-center justify-center border-2 border-dashed border-slate-300 rounded-xl p-4 bg-slate-50/50 hover:bg-slate-50 transition">
                <input 
                  type="file" 
                  accept="image/*" 
                  onChange={handleImageUpload} 
                  id="teacher-signature-file" 
                  className="hidden" 
                />
                <Label htmlFor="teacher-signature-file" className="cursor-pointer flex flex-col items-center gap-2 text-center w-full">
                  <div className="w-10 h-10 rounded-full bg-indigo-50 flex items-center justify-center text-indigo-600">
                    <Upload className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="text-xs font-bold text-indigo-600 hover:underline">도장/서명 이미지 파일 선택</span>
                    <p className="text-[11px] text-slate-400 mt-0.5">PNG, JPG 권장 (투명 배경 도장 이미지 최적)</p>
                  </div>
                </Label>
              </div>

              {sigPreview && (
                <div className="p-3 border rounded-xl bg-white flex items-center justify-center relative h-28">
                  <img src={sigPreview} alt="도장 미리보기" className="max-h-24 max-w-[80%] object-contain" />
                </div>
              )}
            </div>
          )}

          <div className="p-2.5 rounded-lg bg-amber-50/80 border border-amber-200 text-[11px] text-amber-900 leading-relaxed">
            등록된 도장(서명)은 공식 출석부 및 강사출근부의 날인란에 즉시 반영되며, 추후 프로필 설정에서도 언제든지 변경할 수 있습니다.
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => onOpenChange(false)}
            className="h-8 text-xs font-semibold"
          >
            취소
          </Button>
          <Button 
            size="sm" 
            onClick={handleSave}
            disabled={isSaving}
            className="h-8 text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white"
          >
            {isSaving ? '저장 중...' : '도장(서명) 저장'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
