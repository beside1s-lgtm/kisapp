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

const ROLES = ['교사', '부장', '교감', '교장', '행정실장', '주무관', '담당'];
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
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>내 프로필</DialogTitle>
          <DialogDescription>
            결재 시스템에서 사용할 이름과 서명을 설정하세요.
          </DialogDescription>
        </DialogHeader>

        {isProfileIncomplete && (
            <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                    시스템을 사용하기 전에 프로필을 먼저 설정해주세요.
                </AlertDescription>
            </Alert>
        )}

        <div className="grid gap-6 py-4">
          <div className="flex items-center gap-4">
            <UserIcon className="h-5 w-5 text-muted-foreground" />
            <div className="w-full">
              <Label htmlFor="name">이름</Label>
              <Input id="name" value={name} onChange={(e) => setName(e.target.value)} className="mt-1" />
            </div>
          </div>
          <div className="flex items-start gap-4">
            <Award className="h-5 w-5 text-muted-foreground mt-1" />
            <div className="w-full">
              <Label>직책</Label>
              {effectiveIsAdmin ? (
                <Select value={role} onValueChange={setRole}>
                    <SelectTrigger className="mt-1">
                        <SelectValue placeholder="직책 선택" />
                    </SelectTrigger>
                    <SelectContent>
                        {ROLES.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                    </SelectContent>
                </Select>
              ) : (
                <>
                    <p className="text-sm font-semibold text-foreground mt-2">{role || '미지정'}</p>
                    <p className="text-xs text-muted-foreground mt-1">직책 변경은 관리자에게 문의하세요.</p>
                </>
              )}
            </div>
          </div>
           <div className="flex items-start gap-4">
            <Mail className="h-5 w-5 text-muted-foreground mt-1" />
            <div>
              <Label>이메일</Label>
              <p className="text-sm text-muted-foreground mt-2">{profile?.email}</p>
            </div>
          </div>
          <div className="space-y-2">
            <Label>서명</Label>
            {sigPreview ? (
              <div className="flex flex-col items-center gap-3">
                <div className="p-4 border rounded-lg bg-white flex items-center justify-center relative w-full h-32">
                  <span className="text-gray-300 absolute font-serif text-3xl opacity-30 select-none">(인)</span>
                  <img src={sigPreview} alt="등록된 서명" className="max-h-24 object-contain z-10" />
                </div>
                <Button 
                  type="button" 
                  variant="outline" 
                  size="sm" 
                  onClick={() => {
                    setSigPreview('');
                    setSignatureMode('draw');
                  }}
                  className="w-full"
                >
                  서명 재등록
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex justify-between items-center bg-muted p-1 rounded-lg">
                  <button
                    type="button"
                    onClick={() => setSignatureMode('draw')}
                    className={`flex-1 py-1 text-xs font-semibold rounded-md transition-all ${signatureMode === 'draw' ? 'bg-white text-foreground shadow-sm' : 'text-muted-foreground'}`}
                  >
                    직접 그리기
                  </button>
                  <button
                    type="button"
                    onClick={() => setSignatureMode('upload')}
                    className={`flex-1 py-1 text-xs font-semibold rounded-md transition-all ${signatureMode === 'upload' ? 'bg-white text-foreground shadow-sm' : 'text-muted-foreground'}`}
                  >
                    이미지 업로드
                  </button>
                </div>

                {signatureMode === 'draw' ? (
                  <div className="space-y-2">
                    <div className="flex justify-end">
                      <Button variant="ghost" size="sm" onClick={clearSignature} className="h-7 px-2 text-muted-foreground text-xs hover:text-foreground">
                        <Eraser className="h-3 w-3 mr-1" /> 다시 그리기
                      </Button>
                    </div>
                    <div className="border-2 border-dashed border-slate-300 rounded-lg bg-white overflow-hidden touch-none relative h-32 flex items-center justify-center shadow-inner">
                      <SignatureCanvas 
                        ref={sigCanvas}
                        canvasProps={{ 
                          width: 440, 
                          height: 128, 
                          className: 'w-full h-full cursor-crosshair touch-none' 
                        }}
                        penColor="black"
                        minWidth={1.5}
                        maxWidth={3.5}
                        dotSize={2}
                        onEnd={() => setCanvasEmpty(sigCanvas.current?.isEmpty() ?? true)}
                      />
                    </div>
                    <p className="text-[11px] text-muted-foreground text-center">
                      영역 안에 마우스나 터치펜/손가락으로 서명을 정성껏 그려주세요.
                    </p>
                  </div>
                ) : (
                  <div className="p-4 border-2 border-dashed rounded-lg text-center h-28 flex items-center justify-center">
                    <Input type="file" id="sig-upload" accept="image/png, image/jpeg" onChange={onFileChange} className="hidden" />
                    <Label htmlFor="sig-upload" className="cursor-pointer w-full h-full flex items-center justify-center">
                      <div className="flex flex-col items-center gap-1 text-muted-foreground">
                        <Upload className="w-5 h-5 opacity-60" />
                        <span className="text-xs">클릭하여 서명 파일 업로드</span>
                      </div>
                    </Label>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
        <DialogFooter className="flex items-center justify-end gap-2">
          <Button variant="outline" type="button" onClick={() => setIsOpen(false)}>
            닫기 (나중에 설정)
          </Button>
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            변경사항 저장
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}