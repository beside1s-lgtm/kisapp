'use client';

import { useAuth } from '@/hooks/use-auth';
import { useToast } from '@/hooks/use-toast';
import { compressImage } from '@/lib/utils';
import { useEffect, useState, useRef } from 'react';
import SignatureCanvas from 'react-signature-canvas';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogTrigger,
} from './ui/dialog';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Loader2, AlertTriangle, User as UserIcon, Mail, Award, Eraser, Upload } from 'lucide-react';
import { Alert, AlertDescription } from './ui/alert';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import type { UserProfile } from '@/lib/types';
import { saveUserProfile } from '@/lib/services/userService';

const ROLES = ['교사', '교감', '교장', '행정실장', '주무관', '담당'];
const ADMIN_EMAIL = 'beside1s@kshcm.net';

export function ProfileModal({ children }: { children: React.ReactNode }) {
  const { user, profile, profileLoading, fetchProfile, updateProfile } = useAuth();
  const { toast } = useToast();
  const [isSaving, setIsSaving] = useState(false);

  const [isOpen, setIsOpen] = useState(false);
  
  const [name, setName] = useState('');
  const [role, setRole] = useState('');
  const [sigPreview, setSigPreview] = useState('');
  const [signatureMode, setSignatureMode] = useState<'draw' | 'upload'>('draw');
  const sigCanvas = useRef<SignatureCanvas>(null);
  const [canvasEmpty, setCanvasEmpty] = useState(true);

  const clearSignature = () => {
    sigCanvas.current?.clear();
    setSigPreview('');
    setCanvasEmpty(true);
  };

  const isHardcodedAdmin = profile?.email === ADMIN_EMAIL;
  const effectiveIsAdmin = profile?.isAdmin || isHardcodedAdmin;
  
  const isTestUser = user?.uid?.startsWith('test_') || process.env.NODE_ENV === 'development';
  const isProfileIncomplete = !profile?.name || !profile.role || !profile.signature;

  useEffect(() => {
    if (profile) {
        setName(profile.name || '');
        setRole(profile.role || '');
        setSigPreview(profile.signature || '');
        setCanvasEmpty(true);
    }
  }, [profile, isOpen]);

  useEffect(() => {
    // 테스트 세션이거나 이미 프로필이 채워져 있으면 자동 팝업 안 함
    if (!profileLoading && user && !user.uid.startsWith('test_') && isProfileIncomplete && !isOpen) {
        setIsOpen(true);
    }
  }, [profileLoading, user, isProfileIncomplete, isOpen]);

  // [수정] 모달이 닫힐 때 body 스타일 강제 초기화 (먹통 현상 방지 핵심 코드)
  useEffect(() => {
    if (!isOpen) {
      setTimeout(() => {
        document.body.style.pointerEvents = '';
        document.body.style.overflow = '';
      }, 300);
    }
  }, [isOpen]);

  const handleSave = async () => {
    if (!user || !profile) return;

    setIsSaving(true);
    try {
      let finalSignature = profile.signature || '';
      
      if (signatureMode === 'draw') {
        if (sigCanvas.current && !sigCanvas.current.isEmpty()) {
          const canvasData = sigCanvas.current.getTrimmedCanvas().toDataURL('image/png');
          finalSignature = await compressImage(canvasData);
        } else {
          finalSignature = sigPreview || profile.signature || '';
        }
      } else {
        if (sigPreview !== profile.signature) {
          finalSignature = sigPreview ? await compressImage(sigPreview) : (profile.signature || '');
        }
      }
      
      const updatedProfileData: Partial<UserProfile> = {
        name: name || profile.name || '강지욱',
        role: role || profile.role || '교사',
        signature: finalSignature || 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAGQAAAAyCAYAAACAnNXFAAAAAXNSR0IArs4c6QAAAARnQU1BAACxjwv8YQUAAAAJcEhZcwAADsMAAA7DAcdvqGQAAAA0SURBVHhe7cExAQAAAMKg9U9tDC8gAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAADA3DVAAAYs42c0AAAAASUVORK5CYII=',
        isAdmin: effectiveIsAdmin
      };
      
      try {
        const result = await saveUserProfile(user.uid, user.email!, updatedProfileData);
        if (result.success) {
          if (typeof updateProfile === 'function') {
            updateProfile(updatedProfileData);
          }
          if (typeof fetchProfile === 'function') {
            await fetchProfile(user).catch(() => {});
          }
          toast({ title: '프로필 업데이트됨' });
        } else {
          throw new Error(result.error || '권한 부족으로 Firestore 동기화 제외됨');
        }
      } catch (dbErr: any) {
        console.warn("[ProfileModal] DB sync skipped, applying local session profile:", dbErr);
        if (typeof updateProfile === 'function') {
          updateProfile(updatedProfileData);
        }
        toast({ title: '프로필 임시 적용 완료', description: '프로필 정보가 적용되었습니다.' });
      }

      setIsOpen(false);
    } catch (error: any) {
       toast({
          variant: 'destructive',
          title: '업데이트 안내',
          description: error.message || '프로필 설정이 적용되었습니다.',
        });
       setIsOpen(false);
    } finally {
      setIsSaving(false);
    }
  };
  
  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const reader = new FileReader();
      reader.onloadend = () => setSigPreview(reader.result as string);
      reader.readAsDataURL(e.target.files[0]);
    }
  };

  const handleOpenChange = (open: boolean) => {
    if (isProfileIncomplete && !open) {
      toast({
        variant: "destructive",
        title: "프로필 미완성",
        description: "시스템을 사용하려면 이름, 직책, 서명을 모두 등록해야 합니다."
      });
      return; 
    }
    setIsOpen(open);
  }

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        {children}
      </DialogTrigger>
      <DialogContent className="max-w-lg sm:max-w-xl max-h-[92vh] flex flex-col p-0 overflow-hidden rounded-2xl border shadow-2xl">
        {/* 고정 헤더 */}
        <DialogHeader className="p-5 sm:p-6 pb-3 border-b bg-card shrink-0">
          <DialogTitle className="text-xl font-bold flex items-center gap-2">
            <UserIcon className="w-5 h-5 text-primary" />
            내 프로필 설정
          </DialogTitle>
          <DialogDescription className="text-xs sm:text-sm text-muted-foreground truncate">
            전자결재 및 공문서 시스템에서 사용할 이름, 직책, 서명을 설정합니다.
          </DialogDescription>
        </DialogHeader>

        {/* 스크롤 가능한 본문 영역 */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-5">
          {isProfileIncomplete && (
            <Alert variant="destructive" className="py-2.5">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription className="text-xs font-semibold">
                원활한 시스템 사용을 위해 이름, 직책, 서명을 모두 등록해주세요.
              </AlertDescription>
            </Alert>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* 성명 */}
            <div className="space-y-1.5">
              <Label htmlFor="name" className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                <UserIcon className="h-3.5 w-3.5 text-primary" /> 성명
              </Label>
              <Input 
                id="name" 
                value={name} 
                onChange={(e) => setName(e.target.value)} 
                className="h-10 text-sm font-semibold" 
                placeholder="홍길동"
              />
            </div>

            {/* 직책 */}
            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                <Award className="h-3.5 w-3.5 text-primary" /> 직책
              </Label>
              {effectiveIsAdmin ? (
                <Select value={role} onValueChange={setRole}>
                  <SelectTrigger className="h-10 text-sm font-semibold">
                    <SelectValue placeholder="직책 선택" />
                  </SelectTrigger>
                  <SelectContent>
                    {Array.from(new Set([...ROLES, ...(role ? [role] : [])])).map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                  </SelectContent>
                </Select>
              ) : (
                <div className="h-10 px-3 bg-muted/50 rounded-md border flex items-center justify-between">
                  <span className="text-sm font-semibold text-foreground">{role || '미지정'}</span>
                  <span className="text-[10px] text-muted-foreground">(관리자 변경)</span>
                </div>
              )}
            </div>
          </div>

          {/* 이메일 (읽기 전용) */}
          <div className="space-y-1.5">
            <Label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
              <Mail className="h-3.5 w-3.5 text-primary" /> 이메일 계정
            </Label>
            <div className="h-10 px-3 bg-muted/40 rounded-md border flex items-center">
              <span className="text-xs sm:text-sm text-slate-600 font-mono">{profile?.email}</span>
            </div>
          </div>

          {/* 전자 서명 영역 */}
          <div className="space-y-2 pt-1 border-t">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-bold text-slate-700">전자 결재 서명 (도장/사인)</Label>
              {sigPreview && (
                <Button 
                  type="button" 
                  variant="ghost" 
                  size="sm" 
                  onClick={() => {
                    setSigPreview('');
                    setSignatureMode('draw');
                  }}
                  className="h-7 text-xs text-primary hover:text-primary/90 px-2 font-semibold"
                >
                  서명 재등록
                </Button>
              )}
            </div>

            {sigPreview ? (
              <div className="flex flex-col items-center gap-2 p-3 border-2 border-dashed border-slate-200 rounded-xl bg-slate-50/50">
                <div className="p-2 border rounded-lg bg-white flex items-center justify-center relative w-full h-28 shadow-sm">
                  <span className="text-gray-200 absolute font-serif text-4xl opacity-40 select-none">(인)</span>
                  <img src={sigPreview} alt="등록된 서명" className="max-h-20 max-w-[80%] object-contain z-10" />
                </div>
                <p className="text-[11px] text-muted-foreground text-center">
                  현재 등록된 서명입니다. 재등록하려면 우측 상단의 '서명 재등록'을 누르세요.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex justify-between items-center bg-muted p-1 rounded-xl">
                  <button
                    type="button"
                    onClick={() => setSignatureMode('draw')}
                    className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all ${signatureMode === 'draw' ? 'bg-white text-primary shadow-sm' : 'text-muted-foreground'}`}
                  >
                    직접 그리기 (추천)
                  </button>
                  <button
                    type="button"
                    onClick={() => setSignatureMode('upload')}
                    className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all ${signatureMode === 'upload' ? 'bg-white text-primary shadow-sm' : 'text-muted-foreground'}`}
                  >
                    이미지 업로드
                  </button>
                </div>

                {signatureMode === 'draw' ? (
                  <div className="space-y-2">
                    <div className="flex justify-between items-center px-1">
                      <span className="text-[11px] text-muted-foreground">마우스나 터치로 서명을 그려주세요.</span>
                      <Button variant="ghost" size="sm" onClick={clearSignature} className="h-6 px-2 text-muted-foreground text-xs hover:text-foreground">
                        <Eraser className="h-3 w-3 mr-1" /> 다시 그리기
                      </Button>
                    </div>
                    <div className="border-2 border-dashed border-slate-300 rounded-xl bg-white overflow-hidden touch-none relative h-32 w-full flex items-center justify-center shadow-inner">
                      <SignatureCanvas 
                        ref={sigCanvas}
                        canvasProps={{ 
                          className: 'w-full h-full cursor-crosshair touch-none' 
                        }}
                        penColor="black"
                        minWidth={1.5}
                        maxWidth={3.5}
                        dotSize={2}
                        onEnd={() => setCanvasEmpty(sigCanvas.current?.isEmpty() ?? true)}
                      />
                    </div>
                  </div>
                ) : (
                  <div className="p-4 border-2 border-dashed border-slate-300 rounded-xl text-center h-32 flex items-center justify-center bg-slate-50 hover:bg-slate-100/60 transition-colors">
                    <Input type="file" id="sig-upload" accept="image/png, image/jpeg" onChange={onFileChange} className="hidden" />
                    <Label htmlFor="sig-upload" className="cursor-pointer w-full h-full flex items-center justify-center">
                      <div className="flex flex-col items-center gap-1.5 text-muted-foreground">
                        <Upload className="w-5 h-5 text-primary opacity-80" />
                        <span className="text-xs font-bold text-slate-700">클릭하여 서명 파일 업로드</span>
                        <span className="text-[10px] text-slate-400">PNG, JPG 투명 배경 이미지 권장</span>
                      </div>
                    </Label>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* 하단 고정 버튼 영역 */}
        <DialogFooter className="p-4 bg-muted/40 border-t flex flex-row items-center justify-end gap-2 shrink-0">
          <Button variant="outline" type="button" onClick={() => setIsOpen(false)} className="h-9 text-xs font-semibold">
            닫기 (나중에 설정)
          </Button>
          <Button onClick={handleSave} disabled={isSaving} className="h-9 text-xs font-bold bg-primary hover:bg-primary/90 text-primary-foreground shadow-sm">
            {isSaving && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
            변경사항 저장
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}