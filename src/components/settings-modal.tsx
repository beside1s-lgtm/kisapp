'use client';
import { bulkRegisterUsers, getUsersDirectory, saveUserProfile, getDocConfig, saveDocConfig } from '@/app/actions';
import { DocConfig, UserProfile } from '@/lib/types';
import { compressImage } from '@/lib/utils';
import { ChangeEvent, useEffect, useState, useTransition } from 'react';
import { useToast } from '@/hooks/use-toast';
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
import { Loader2, Image as ImageIcon, Users, Settings as SettingsIcon, FileUp, Download, PlusCircle, Save, XCircle } from 'lucide-react';
import NextImage from 'next/image';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { ScrollArea } from './ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Switch } from './ui/switch';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import * as xlsx from 'xlsx';

const ROLES = ['교사', '부장', '교감', '교장', '행정실장', '주무관', '담당'];

export function SettingsModal() {
  const { toast } = useToast();
  const [isOpen, setIsOpen] = useState(false);
  const [isSaving, startSaving] = useTransition();
  const [isUploading, startUploading] = useTransition();
  const [config, setConfig] = useState<DocConfig>({});
  const [headerPreview, setHeaderPreview] = useState<string>('');
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  // For adding a new user
  const [isAddingNewUser, setIsAddingNewUser] = useState(false);
  const [newUser, setNewUser] = useState({ email: '', name: '', role: '교사' });

  const fetchUsers = async () => {
    const data = await getUsersDirectory();
    // Ensure uniqueness by email client-side as a fallback
    const uniqueUsers = Array.from(new Map(data.map(user => [user.email, user])).values());
    setUsers(uniqueUsers.sort((a,b) => a.name.localeCompare(b.name)));
  };

  useEffect(() => {
    if (isOpen) {
      getDocConfig().then(data => {
        setConfig(data);
        setHeaderPreview(data.headerImage || '');
      });
      fetchUsers();
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
      setUsers(prev => prev.map(u => u.email === email ? { ...u, [field]: value } as UserProfile : u));
    } else {
      toast({ variant: 'destructive', title: '업데이트 실패', description: result.error });
    }
  };

  const handleAddNewUser = async () => {
      if (!newUser.email || !newUser.name || !newUser.role) {
          toast({ variant: 'destructive', title: '입력 오류', description: '이메일, 이름, 직책을 모두 입력해야 합니다.' });
          return;
      }
      const result = await saveUserProfile('', newUser.email, newUser as any);
      if (result.success) {
          toast({ title: '사용자 추가됨' });
          fetchUsers(); // Refresh the list
          setIsAddingNewUser(false);
          setNewUser({ email: '', name: '', role: '교사' });
      } else {
          toast({ variant: 'destructive', title: '추가 실패', description: result.error });
      }
  };

  const handleBulkUpload = () => {
    if (!selectedFile) {
        toast({ variant: 'destructive', title: '파일 없음', description: '업로드할 엑셀 파일을 선택해주세요.'});
        return;
    }

    startUploading(async () => {
        const reader = new FileReader();
        reader.readAsDataURL(selectedFile);
        reader.onload = async (e) => {
            const fileData = e.target?.result as string;
            const result = await bulkRegisterUsers(fileData);
            if (result.success) {
                toast({ title: '사용자 일괄 등록 성공', description: result.summary });
                // Refresh user list
                fetchUsers();
            } else {
                toast({ variant: 'destructive', title: '일괄 등록 실패', description: result.error, duration: 8000 });
            }
        };
        reader.onerror = (error) => {
            toast({ variant: 'destructive', title: '파일 읽기 오류', description: '파일을 읽는 중 문제가 발생했습니다.' });
        }
    });
  }

  const onFileSelect = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
        setSelectedFile(e.target.files[0]);
    }
  };
  
  const handleDownloadTemplate = () => {
    const templateData = [
      { email: 'user1@example.com', name: '홍길동', role: '교사' },
      { email: 'user2@example.com', name: '김철수', role: '부장' },
    ];
    const worksheet = xlsx.utils.json_to_sheet(templateData);
    const workbook = xlsx.utils.book_new();
    xlsx.utils.book_append_sheet(workbook, worksheet, '사용자 목록');
    xlsx.writeFile(workbook, 'user_template.xlsx');
  };


  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogTrigger asChild>
           <Button variant="ghost" size="icon">
                <SettingsIcon className="h-5 w-5 text-muted-foreground" />
            </Button>
        </DialogTrigger>
      <DialogContent className="sm:max-w-3xl max-h-[90vh]">
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
            <div className="space-y-4 p-1">
                <Card>
                    <CardHeader>
                        <CardTitle className="text-lg">사용자 일괄 등록</CardTitle>
                        <CardDescription>
                           `email`, `name`, `role` 컬럼을 포함한 엑셀(.xlsx) 파일을 업로드하여 사용자를 추가하거나 업데이트합니다.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="flex flex-col sm:flex-row items-center gap-4">
                        <Input type="file" accept=".xlsx, .xls" onChange={onFileSelect} className="flex-grow"/>
                        <div className="flex gap-2 w-full sm:w-auto">
                            <Button onClick={handleDownloadTemplate} variant="outline">
                                <Download className="mr-2 h-4 w-4"/>
                                양식 다운로드
                            </Button>
                            <Button onClick={handleBulkUpload} disabled={isUploading || !selectedFile} className="flex-grow">
                                {isUploading ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <FileUp className="mr-2 h-4 w-4"/>}
                                업로드 및 등록
                            </Button>
                        </div>
                    </CardContent>
                </Card>
                <div className="px-4 py-2 flex justify-between items-center">
                    <h3 className="text-lg font-semibold">사용자 목록</h3>
                    {!isAddingNewUser && (
                        <Button variant="outline" size="sm" onClick={() => setIsAddingNewUser(true)}>
                            <PlusCircle className="mr-2 h-4 w-4" />
                            새 사용자 추가
                        </Button>
                    )}
                </div>
                <ScrollArea className="h-[40vh] p-1">
                  <div className="space-y-2 p-4">
                    {isAddingNewUser && (
                        <div className="flex items-center gap-2 p-3 bg-secondary/50 rounded-lg border border-dashed">
                             <Input 
                                placeholder="이메일" 
                                value={newUser.email} 
                                onChange={(e) => setNewUser(p => ({ ...p, email: e.target.value }))}
                                className="w-1/3"
                             />
                             <Input 
                                placeholder="이름" 
                                value={newUser.name}
                                onChange={(e) => setNewUser(p => ({ ...p, name: e.target.value }))}
                                className="w-1/4"
                             />
                             <Select value={newUser.role} onValueChange={(r) => setNewUser(p => ({ ...p, role: r }))}>
                                <SelectTrigger className="w-1/4"><SelectValue /></SelectTrigger>
                                <SelectContent>{ROLES.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}</SelectContent>
                             </Select>
                             <div className="flex gap-1">
                                <Button size="icon" variant="ghost" onClick={handleAddNewUser}><Save className="h-4 w-4 text-primary"/></Button>
                                <Button size="icon" variant="ghost" onClick={() => setIsAddingNewUser(false)}><XCircle className="h-4 w-4 text-destructive"/></Button>
                             </div>
                        </div>
                    )}
                    {users.map(user => (
                      <div key={user.email} className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-3 bg-card rounded-lg border gap-4">
                        <div className="flex-grow">
                          <p className="font-semibold">{user.name}</p>
                          <p className="text-sm text-muted-foreground">{user.email}</p>
                        </div>
                        <div className="flex items-center gap-4 w-full sm:w-auto">
                            <div className="flex items-center space-x-2">
                                <Switch 
                                    id={`admin-${user.email}`} 
                                    checked={user.isAdmin}
                                    onCheckedChange={(checked) => handleUserUpdate(user.uid, user.email, 'isAdmin', checked)}
                                    disabled={user.email === 'beside1s@kshcm.net'}
                                />
                                <Label htmlFor={`admin-${user.email}`} className="text-sm shrink-0">관리자</Label>
                            </div>
                            <div className="w-40">
                               <Select 
                                  value={user.role} 
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
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
