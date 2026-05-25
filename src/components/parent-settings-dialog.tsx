'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Settings } from 'lucide-react';
import { saveUserProfile } from '@/lib/services/userService';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogTrigger,
} from '@/components/ui/dialog';

export function ParentSettingsDialog() {
  const { user, profile, fetchProfile } = useAuth();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const [studentName, setStudentName] = useState('');
  const [studentGrade, setStudentGrade] = useState('');
  const [studentClass, setStudentClass] = useState('');
  const [studentNumber, setStudentNumber] = useState('');
  const [parentName, setParentName] = useState('');
  const [phone, setPhone] = useState('');

  useEffect(() => {
    if (open && profile) {
      setStudentName(profile.studentName || '');
      setStudentGrade(profile.studentGrade || '');
      setStudentClass(profile.studentClass || '');
      setStudentNumber(profile.studentNumber || '');
      setParentName(profile.parentName || '');
      setPhone(profile.parentPhone || '');
    }
  }, [open, profile]);

  const handleSave = async () => {
    if (!user) return;
    
    if (!parentName.trim()) {
      toast({ variant: 'destructive', title: '입력 오류', description: '학부모 성명을 입력해주세요.' });
      return;
    }
    
    setIsSaving(true);
    try {
      const res = await saveUserProfile(user.uid, user.email!, {
        studentName: studentName.trim(),
        studentGrade,
        studentClass,
        studentNumber,
        parentName: parentName.trim(),
        parentPhone: phone,
      });

      if (res.success) {
        toast({ title: '설정 저장', description: '학부모 정보가 성공적으로 업데이트되었습니다.' });
        await fetchProfile(user);
        setOpen(false);
        // 상태 동기화를 위한 강제 새로고침
        window.location.reload();
      } else {
        throw new Error(res.error);
      }
    } catch (error: any) {
      console.error('Settings save failed:', error);
      toast({ variant: 'destructive', title: '저장 실패', description: error.message || '정보 업데이트 중 오류가 발생했습니다.' });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-foreground">
          <Settings className="h-5 w-5" />
          <span className="sr-only">설정</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>학부모 정보 설정</DialogTitle>
          <DialogDescription>
            신청서 작성 시 자동으로 입력될 기본 정보를 수정할 수 있습니다.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="sName">학생 이름</Label>
            <Input id="sName" value={studentName} onChange={(e) => setStudentName(e.target.value)} placeholder="예: 홍길동" />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-2">
              <Label htmlFor="sGrade">학년</Label>
              <Input id="sGrade" type="number" value={studentGrade} onChange={(e) => setStudentGrade(e.target.value)} placeholder="예: 5" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="sClass">반</Label>
              <Input id="sClass" type="number" value={studentClass} onChange={(e) => setStudentClass(e.target.value)} placeholder="예: 1" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="sNum">번호</Label>
              <Input id="sNum" type="number" value={studentNumber} onChange={(e) => setStudentNumber(e.target.value)} placeholder="예: 15" />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="pName">학부모 성명 <span className="text-destructive">*</span></Label>
            <Input id="pName" value={parentName} onChange={(e) => setParentName(e.target.value)} placeholder="예: 홍길동" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="pPhone">학부모 연락처</Label>
            <Input id="pPhone" type="tel" value={phone} onChange={(e) => setPhone(e.target.value.replace(/[^0-9-]/g, ''))} placeholder="010-0000-0000" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>취소</Button>
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            저장
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
