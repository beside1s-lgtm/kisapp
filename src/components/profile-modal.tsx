'use client';
import { useAuth } from '@/hooks/use-auth';
import { useToast } from '@/hooks/use-toast';
import { compressImage } from '@/lib/utils';
import { saveUserProfile } from '@/app/actions';
import { useEffect, useState, useTransition } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from './ui/dialog';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './ui/select';
import { Loader2, AlertTriangle } from 'lucide-react';
import Image from 'next/image';
import { Alert, AlertDescription } from './ui/alert';

type ProfileModalProps = {
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
};

const ROLES = ['교사', '부장', '교감', '교장', '행정실장', '주무관', '담당'];

export function ProfileModal({ isOpen, setIsOpen }: ProfileModalProps) {
  const { user, profile, setProfile } = useAuth();
  const { toast } = useToast();
  const [isSaving, startSaving] = useTransition();

  const [name, setName] = useState(profile?.name || '');
  const [role, setRole] = useState(profile?.role || '담당');
  const [sigPreview, setSigPreview] = useState(profile?.signature || '');

  const isProfileIncomplete = profile?.name === 'New User' || !profile?.signature;

  useEffect(() => {
    if (profile) {
        setName(profile.name);
        setRole(profile.role);
        setSigPreview(profile.signature || '');
    }
  }, [profile]);

  const handleSave = () => {
    startSaving(async () => {
      if (!user || !profile) return;
      
      let finalSignature = profile.signature || '';
      if (sigPreview !== profile.signature) {
        finalSignature = sigPreview ? await compressImage(sigPreview) : '';
      }

      const updatedProfile = {
        ...profile,
        name,
        role,
        signature: finalSignature,
        email: user.email!,
      };

      const result = await saveUserProfile(user.uid, user.email!, updatedProfile);

      if (result.success) {
        setProfile(updatedProfile);
        toast({ title: '프로필 업데이트됨' });
        setIsOpen(false);
      } else {
        toast({
          variant: 'destructive',
          title: '업데이트 실패',
          description: result.error,
        });
      }
    });
  };
  
  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const reader = new FileReader();
      reader.onloadend = () => setSigPreview(reader.result as string);
      reader.readAsDataURL(e.target.files[0]);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={isProfileIncomplete ? () => {} : setIsOpen}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>내 프로필</DialogTitle>
          <DialogDescription>
            이름, 직책, 서명을 업데이트하세요. 결재 시스템을 사용하려면 모든 정보가 필요합니다.
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

        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="name" className="text-right">
              이름
            </Label>
            <Input id="name" value={name} onChange={(e) => setName(e.target.value)} className="col-span-3" />
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="role" className="text-right">
              직책
            </Label>
            <Select value={role} onValueChange={setRole}>
              <SelectTrigger className="col-span-3">
                <SelectValue placeholder="직책 선택" />
              </SelectTrigger>
              <SelectContent>
                {ROLES.map((r) => (
                  <SelectItem key={r} value={r}>
                    {r}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-4 items-start gap-4">
            <Label className="text-right pt-2">서명</Label>
            <div className="col-span-3 space-y-2">
                <div className="p-4 border-2 border-dashed rounded-lg text-center h-32 flex items-center justify-center">
                    <Input type="file" id="sig-upload" accept="image/png, image/jpeg" onChange={onFileChange} className="hidden" />
                    <Label htmlFor="sig-upload" className="cursor-pointer">
                        {sigPreview ? (
                            <Image src={sigPreview} alt="서명 미리보기" width={120} height={120} className="max-h-24 object-contain" />
                        ) : (
                            <span className="text-sm text-muted-foreground">이미지 업로드</span>
                        )}
                    </Label>
                </div>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button onClick={handleSave} disabled={isSaving || !name || !role || !sigPreview}>
            {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            변경사항 저장
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
