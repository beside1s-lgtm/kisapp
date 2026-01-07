'use client';
import { getDocConfig, saveDocConfig, getUsersDirectory, saveUserProfile } from '@/app/actions';
import { DocConfig, User, UserProfile } from '@/lib/types';
import { compressImage } from '@/lib/utils';
import { useEffect, useState, useTransition } from 'react';
import { useToast } from '@/hooks/use-toast';
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
import { Loader2, Image as ImageIcon, Users, Settings as SettingsIcon } from 'lucide-react';
import NextImage from 'next/image';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { ScrollArea } from './ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Switch } from './ui/switch';

const ROLES = ['교사', '부장', '교감', '교장', '행정실장', '주무관', '담당'];

type SettingsModalProps = {
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
};

export function SettingsModal({ isOpen, setIsOpen }: SettingsModalProps) {
  const { toast } = useToast();
  const [isSaving, startSaving] = useTransition();
  const [config, setConfig] = useState<DocConfig>({});
  const [headerPreview, setHeaderPreview] = useState<string>('');
  const [users, setUsers] = useState<(User & UserProfile)[]>([]);

  useEffect(() => {
    if (isOpen) {
      getDocConfig().then(data => {
        setConfig(data);
        setHeaderPreview(data.headerImage || '');
      });
      getUsersDirectory().then(setUsers);
    }
  }, [isOpen]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setConfig(prev => ({ ...prev, [name]: name === 'nextNumber' ? parseInt(value) : value }));
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const reader = new FileReader();
      reader.onloadend = () => setHeaderPreview(reader.result as string);
      reader.readAsDataURL(e.target.files[0]);
    }
  };

  const handleSave = () => {
    startSaving(async () => {
      let finalConfig = { ...config };
      if (headerPreview && headerPreview !== config.headerImage) {
        finalConfig.headerImage = await compressImage(headerPreview, 600);
      }

      const result = await saveDocConfig(finalConfig);
      if (result.success) {
        toast({ title: '설정 저장됨' });
        setIsOpen(false);
      } else {
        toast({ variant: 'destructive', title: '저장 실패', description: result.error });
      }
    });
  };
  
  const handleUserUpdate = async (uid: string, email: string, field: 'role' | 'isAdmin', value: string | boolean) => {
    const result = await saveUserProfile(uid, email, { [field]: value });
    if (result.success) {
      toast({ title: '사용자 정보 업데이트됨' });
      setUsers(prev => prev.map(u => u.uid === uid ? { ...u, [field]: value } : u));
    } else {
      toast({ variant: 'destructive', title: '업데이트 실패', description: result.error });
    }
  };


  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle>시스템 설정</DialogTitle>
          <DialogDescription>
            문서 템플릿, 번호 체계, 사용자 권한을 관리합니다.
          </DialogDescription>
        </DialogHeader>
        
        <Tabs defaultValue="general">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="general"><SettingsIcon className="mr-2"/>일반 설정</TabsTrigger>
            <TabsTrigger value="users"><Users className="mr-2"/>사용자 관리</TabsTrigger>
          </TabsList>
          <TabsContent value="general">
            <ScrollArea className="h-[60vh]">
              <div className="space-y-6 p-4">
                <div className="space-y-2">
                  <Label htmlFor="nextNumber">다음 문서 번호</Label>
                  <Input id="nextNumber" name="nextNumber" type="number" value={config.nextNumber || 1} onChange={handleChange} />
                </div>
                <div className="space-y-2">
                  <Label>헤더 이미지</Label>
                  <div className="p-4 border-2 border-dashed rounded-lg text-center relative group">
                    <Input id="header-up" type="file" accept="image/*" onChange={handleFileChange} className="hidden" />
                    <Label htmlFor="header-up" className="cursor-pointer block">
                      {headerPreview ? (
                        <div className="relative h-16 w-full">
                          <NextImage src={headerPreview} alt="헤더 미리보기" layout="fill" objectFit="contain" />
                          <div className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity text-xs font-bold text-white rounded-md">변경</div>
                        </div>
                      ) : (
                        <div className="flex flex-col items-center gap-1 py-2">
                          <ImageIcon className="text-muted-foreground" size={24} />
                          <span className="text-sm font-medium text-muted-foreground">헤더 이미지 업로드</span>
                        </div>
                      )}
                    </Label>
                  </div>
                </div>
                <div className="space-y-4 pt-4 border-t">
                  <h4 className="font-semibold">바닥글 정보</h4>
                  <div className="space-y-2">
                    <Label htmlFor="address">주소</Label>
                    <Input id="address" name="address" value={config.address || ''} onChange={handleChange} />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="phone">전화번호</Label>
                        <Input id="phone" name="phone" value={config.phone || ''} onChange={handleChange} />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="fax">팩스</Label>
                        <Input id="fax" name="fax" value={config.fax || ''} onChange={handleChange} />
                      </div>
                  </div>
                  <div className="space-y-2">
                      <Label htmlFor="email">이메일</Label>
                      <Input id="email" name="email" type="email" value={config.email || ''} onChange={handleChange} />
                  </div>
                  <div className="space-y-2">
                      <Label htmlFor="homepage">홈페이지</Label>
                      <Input id="homepage" name="homepage" value={config.homepage || ''} onChange={handleChange} />
                  </div>
                </div>
              </div>
            </ScrollArea>
             <DialogFooter className="mt-4 pr-4">
              <Button onClick={handleSave} disabled={isSaving}>
                {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                일반 설정 저장
              </Button>
            </DialogFooter>
          </TabsContent>
          <TabsContent value="users">
            <ScrollArea className="h-[60vh] p-1">
              <div className="space-y-4 p-4">
                {users.map(user => (
                  <div key={user.uid} className="flex items-center justify-between p-3 bg-card rounded-lg border">
                    <div>
                      <p className="font-semibold">{user.name}</p>
                      <p className="text-sm text-muted-foreground">{user.email}</p>
                    </div>
                    <div className="flex items-center gap-4">
                        <div className="flex items-center space-x-2">
                            <Switch 
                                id={`admin-${user.uid}`} 
                                checked={user.isAdmin}
                                onCheckedChange={(checked) => handleUserUpdate(user.uid, user.email, 'isAdmin', checked)}
                            />
                            <Label htmlFor={`admin-${user.uid}`} className="text-sm">관리자</Label>
                        </div>
                        <div className="w-40">
                           <Select 
                              defaultValue={user.role} 
                              onValueChange={(newRole) => handleUserUpdate(user.uid, user.email, 'role', newRole)}
                            >
                              <SelectTrigger>
                                <SelectValue placeholder="직책 선택" />
                              </SelectTrigger>
                              <SelectContent>
                                {ROLES.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                              </SelectContent>
                            </Select>
                        </div>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
