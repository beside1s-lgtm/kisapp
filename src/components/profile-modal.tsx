'use client';

import { useAuth } from '@/hooks/use-auth';
import { useToast } from '@/hooks/use-toast';
import { compressImage } from '@/lib/utils';
import { useEffect, useState, useTransition } from 'react';
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
import { Loader2, AlertTriangle, User, Mail, Award } from 'lucide-react';
import Image from 'next/image';
import { Alert, AlertDescription } from './ui/alert';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { saveUserProfile } from '@/app/actions';
import type { UserProfile } from '@/lib/types';


const ROLES = ['교사', '부장', '교감', '교장', '행정실장', '주무관', '담당'];

export function ProfileModal() {
  const { user, profile, loading: authLoading, profileLoading, fetchProfile } = useAuth();
  const { toast } = useToast();
  const [isSaving, startSaving] = useTransition();

  const [isOpen, setIsOpen] = useState(false);
  
  const [name, setName] = useState('');
  const [role, setRole] = useState('');
  const [sigPreview, setSigPreview] = useState('');
  
  const isProfileIncomplete = !profile?.name || !profile.role;

  // When the modal opens, populate the state from the profile in auth context
  useEffect(() => {
    if (profile) {
        setName(profile.name || '');
        setRole(profile.role || '');
        setSigPreview(profile.signature || '');
    }
  }, [profile, isOpen]);

  // When user first logs in and profile is incomplete, open the modal automatically.
  useEffect(() => {
    if (!authLoading && !profileLoading && user && isProfileIncomplete) {
        setIsOpen(true);
    }
  }, [authLoading, profileLoading, user, isProfileIncomplete])

  const handleSave = () => {
    if (!user || !profile) return;

    startSaving(async () => {
      let finalSignature = profile.signature || '';
      if (sigPreview !== profile.signature) {
        finalSignature = sigPreview ? await compressImage(sigPreview) : '';
      }
      
      const updatedProfileData: Partial<UserProfile> = {
        name,
        role,
        signature: finalSignature,
      };
      
      const result = await saveUserProfile(user.uid, user.email!, updatedProfileData);

      if (result.success) {
        await fetchProfile(user); // Refetch profile to update context
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

  const handleOpenChange = (open: boolean) => {
     if (isProfileIncomplete && !open) {
      toast({
        variant: "destructive",
        title: "프로필 미완성",
        description: "시스템을 사용하려면 먼저 이름과 직책을 설정해야 합니다."
      })
      return; //
    }
    setIsOpen(open);
  }

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
         <Button variant="ghost" className="relative h-10 w-10 rounded-full">
            <Avatar className="h-10 w-10">
                <AvatarImage src={user?.photoURL || ''} alt={profile?.name || ''} />
                <AvatarFallback>
                    {profile?.name?.charAt(0).toUpperCase() || <UserIcon />}
                </AvatarFallback>
            </Avatar>
        </Button>
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
            <User className="h-5 w-5 text-muted-foreground" />
            <div className="w-full">
              <Label htmlFor="name">이름</Label>
              <Input id="name" value={name} onChange={(e) => setName(e.target.value)} className="mt-1" />
            </div>
          </div>
          <div className="flex items-start gap-4">
            <Award className="h-5 w-5 text-muted-foreground mt-1" />
            <div className="w-full">
              <Label>직책</Label>
              {profile?.isAdmin ? (
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
        <DialogFooter>
          <Button onClick={handleSave} disabled={isSaving || !name || !role}>
            {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            변경사항 저장
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
