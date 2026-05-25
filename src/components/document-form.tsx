'use client';

import { generateContentAction } from '@/app/ai-actions';
import { useAuth } from '@/hooks/use-auth';
import { ApprovalDoc, ApprovalDocPayload, Approver, DocConfig, UserProfile } from '@/lib/types';
import { useForm, useFieldArray, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useRef, useState, useTransition } from 'react';
import { File as FileIcon, Loader2, Plus, Sparkles, User as UserIcon, X, Paperclip, Trash2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Input } from './ui/input';
import { Button } from './ui/button';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Label } from './ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Switch } from './ui/switch';
import UserSearch from './user-search';
import { cn } from '@/lib/utils';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from './ui/form';
import { RadioGroup, RadioGroupItem } from './ui/radio-group';
import RichEditor from "./rich-editor";
import { db } from '@/lib/firebase';
import { doc, getDoc, getDocs, collection, runTransaction, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore';
import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { getDocumentById } from '@/lib/services/documentService';

const approverSchema = z.object({
  name: z.string(),
  email: z.string().email().or(z.literal('')),
  role: z.string(),
  type: z.enum(['normal', 'final', 'proxy']),
  active: z.boolean(),
  status: z.enum(['pending', 'approved', 'rejected']).optional(),
});

const formSchema = z.object({
  title: z.string().min(1, '제목은 필수입니다.'),
  content: z.string().min(1, '내용은 필수입니다.'),
  approvers: z.array(approverSchema),
  circulars: z.array(z.object({ name: z.string(), email: z.string(), role: z.string() })),
  attachments: z.array(z.object({ name: z.string(), size: z.number(), data: z.string() })),
  publishStatus: z.enum(['공개', '비공개', '부분공개']),
  docType: z.enum(['internal', 'external', 'parent', 'teacher-duty', 'teacher-overtime']),
  receiverName: z.string().optional(),
  receiverEmail: z.string().email().or(z.literal('')).optional(),
});
type FormData = z.infer<typeof formSchema>;

const defaultApproversTemplate = [
    { name: '', email: '', role: '부장', type: 'normal' as const, status: 'pending' as const },
    { name: '', email: '', role: '교감', type: 'normal' as const, status: 'pending' as const },
    { name: '', email: '', role: '협조', type: 'normal' as const, status: 'pending' as const },
    { name: '', email: '', role: '교장', type: 'final' as const, status: 'pending' as const },
];

type DocumentFormProps = {
    docToEdit?: ApprovalDoc | null;
    category?: 'draft' | 'family';
}

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB 제한

export default function DocumentForm({ docToEdit, category = 'draft' }: DocumentFormProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const { user, profile } = useAuth();
  const [isPending, startTransition] = useTransition();
  const [isGenerating, startGenerateTransition] = useTransition();
  const [isUploadingFiles, setIsUploadingFiles] = useState(false);

  const [users, setUsers] = useState<UserProfile[]>([]);
  const [docConfig, setDocConfig] = useState<DocConfig>({});
  
  const [circularQuery, setCircularQuery] = useState('');
  const attachmentInputRef = useRef<HTMLInputElement>(null);

  const isTemplateMode = !!searchParams.get('templateId');
  const cloneId = searchParams.get('cloneId');
  
  const isEditMode = !!docToEdit && !isTemplateMode && !cloneId;
  const isFamily = category === 'family';

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      title: '', content: '',
      approvers: defaultApproversTemplate.map(ap => ({...ap, active: ap.role !== '협조'})),
      circulars: [], attachments: [], publishStatus: '공개', docType: 'internal',
    },
  });

  useEffect(() => {
    const fetchBasics = async () => {
        try {
            const usersSnap = await getDocs(collection(db, 'users'));
            const userList = usersSnap.docs.map(d => ({ email: d.id, ...d.data() } as UserProfile));
            setUsers(userList);

            const configSnap = await getDoc(doc(db, 'settings', 'docConfig'));
            if (configSnap.exists()) {
                setDocConfig(configSnap.data() as DocConfig);
            }
        } catch (e) {
            console.error("Load Error:", e);
        }
    };
    fetchBasics();
  }, []);

  useEffect(() => {
    const initializeForm = async () => {
        let targetData: ApprovalDoc | null = null;
        let isClone = false;

        if (cloneId) {
            try {
                const fetched = await getDocumentById(cloneId);
                if (fetched) {
                    targetData = fetched;
                    isClone = true;
                    toast({ title: "문서 복사됨", description: "이전 문서 내용을 불러왔습니다." });
                }
            } catch(e) { console.error(e); }
        } 
        else if (docToEdit) {
            targetData = docToEdit;
        }

        if (targetData) {
            let mappedApprovers = [];
            if (targetData.approvers && targetData.approvers.length > 0) {
                 mappedApprovers = defaultApproversTemplate.map(template => {
                    const existing = targetData!.approvers.find(a => a.role === template.role);
                    if (existing) {
                        return {
                            ...template,
                            name: existing.name,
                            email: existing.email,
                            type: existing.type,
                            active: true,
                        };
                    }
                    return { ...template, active: template.role !== '협조' };
                 });
            } else {
                 mappedApprovers = defaultApproversTemplate.map(ap => ({...ap, active: ap.role !== '협조'}));
            }

            form.reset({
                title: targetData.title || '',
                content: targetData.content || '',
                publishStatus: targetData.publishStatus || '공개',
                docType: targetData.docType || 'internal',
                receiverName: targetData.receiverInfo?.name || '',
                receiverEmail: targetData.receiverInfo?.email || '',
                circulars: targetData.circulars || [],
                attachments: targetData.attachments?.map(a => ({...a, size: a.size || 0})) || [],
                approvers: mappedApprovers,
            });
        }
    };

    initializeForm();
  }, [docToEdit, cloneId, form]);

  const { fields: approverFields } = useFieldArray({ control: form.control, name: 'approvers' });
  const { fields: circularFields, append: appendCircular, remove: removeCircular } = useFieldArray({ control: form.control, name: 'circulars' });
  const { fields: attachmentFields, append: appendAttachment, remove: removeAttachment } = useFieldArray({ control: form.control, name: 'attachments' });
  const formDocType = form.watch('docType'); 

  const handleGenerateContent = async () => {
    const { title, approvers, attachments } = form.getValues();
    if (!title) {
        toast({ variant: "destructive", title: "제목 필요", description: "제목을 먼저 입력해주세요." });
        return;
    }
    
    startGenerateTransition(async () => {
        try {
            const result = await generateContentAction({
                title,
                approvers: approvers.filter(a => a.active),
                attachments
            });
            if (result.success && result.content) {
                form.setValue('content', result.content.replace(/\n/g, '<br>')); 
                toast({ title: "AI 콘텐츠 생성됨" });
            } else {
                throw new Error(result.error || "오류 발생");
            }
        } catch(e: any) {
            toast({ variant: "destructive", title: "생성 실패", description: e.message });
        }
    });
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;

    setIsUploadingFiles(true);
    
    // [에러 원인 해결] 환경변수(config)에 스토리지 주소가 누락되었을 경우를 대비해
    // 알려주신 스토리지 주소를 명시적으로 강제 주입하여 길잃음(타임아웃)을 방지합니다.
    const storage = getStorage(db.app, 'gs://studio-9153973571-7837c.firebasestorage.app');

    try {
        const uploadPromises = Array.from(e.target.files).map(async (file) => {
            if (file.size > MAX_FILE_SIZE) {
                toast({
                    variant: "destructive",
                    title: "용량 초과",
                    description: `${file.name} 파일이 너무 큽니다 (최대 50MB).`,
                });
                return null;
            }

            const fileRef = ref(storage, `attachments/${Date.now()}_${file.name}`);
            
            await uploadBytes(fileRef, file);
            const downloadURL = await getDownloadURL(fileRef);

            return {
                name: file.name,
                size: file.size,
                data: downloadURL, 
            };
        });

        const results = await Promise.all(uploadPromises);
        let count = 0;
        
        results.forEach(res => {
            if (res) {
                appendAttachment(res);
                count++;
            }
        });

        if (count > 0) {
            toast({ title: "업로드 완료", description: `${count}개의 파일이 첨부되었습니다.` });
        }
    } catch (error: any) {
        console.error("File upload error:", error);
        toast({ 
            variant: "destructive", 
            title: "업로드 실패", 
            description: "파일 전송 중 오류가 발생했습니다. 네트워크 상태나 스토리지 설정을 확인해주세요." 
        });
    } finally {
        setIsUploadingFiles(false);
        if (attachmentInputRef.current) {
            attachmentInputRef.current.value = '';
        }
    }
  };

  const onInvalid = (errors: any) => {
    console.error("Form Invalid:", errors);
    let msg = "입력 내용을 확인해주세요.";
    if (errors.title) msg = "제목을 입력해주세요.";
    else if (errors.content) msg = "내용을 입력해주세요.";
    else if (errors.approvers) msg = "결재선 정보를 확인해주세요.";
    toast({ variant: "destructive", title: "입력 오류", description: msg });
  };

  const handleClientSubmit = async (data: FormData) => {
     if (!user || !profile) {
         return { success: false, error: "로그인 정보가 없습니다." };
     }

     try {
         const activeApprovers = data.approvers.filter(a => a.active && a.name && a.name.trim() !== '');
         
         if (activeApprovers.length === 0 && !isEditMode) { 
             throw new Error('최소 한 명 이상의 결재자를 지정해주세요.');
         }

         const payload: any = {
             title: data.title,
             content: data.content,
             docType: data.docType,
             publishStatus: data.publishStatus,
             attachments: data.attachments.map(a => ({
                 name: a.name || '',
                 size: a.size || 0,
                 data: a.data || ''
             })),
             circulars: data.circulars.map(c => ({
                 name: c.name || '',
                 email: c.email || '',
                 role: c.role || ''
             })),
             category: category || 'draft',
             approvers: activeApprovers.map(a => ({
                 name: a.name,
                 email: a.email,
                 role: a.role,
                 type: a.type,
                 status: 'pending'
             })),
             receiverInfo: data.docType === 'external' ? { name: data.receiverName || '', email: data.receiverEmail || '' } : null,
             headerImage: (docConfig as any).headerImage || '',
             footerInfo: { 
                address: docConfig.address || '',
                phone: docConfig.phone || '',
                fax: docConfig.fax || '',
                email: docConfig.email || '',
                homepage: docConfig.homepage || '',
             }
         };

         // 1. 수정 모드
         if (isEditMode && docToEdit) {
             const docRef = doc(db, 'approvals', docToEdit.id);
             const docSnap = await getDoc(docRef);
             if (!docSnap.exists()) throw new Error("문서를 찾을 수 없습니다.");
             const docData = docSnap.data() as ApprovalDoc;

             const normalizedUserEmail = profile.email.trim().toLowerCase();
             const isRequester = docData.requesterId === user.uid;
             const isCurrentApprover = docData.status === 'pending' && 
                                     docData.approvers[docData.currentStep]?.email?.trim().toLowerCase() === normalizedUserEmail;

             if (!isRequester && !isCurrentApprover) throw new Error("수정 권한이 없습니다.");

             let mergedApprovers = payload.approvers;
             let newStep = 0;
             let newStatus: any = 'pending';

             if (isCurrentApprover) {
                 newStep = docData.currentStep;
                 mergedApprovers = payload.approvers.map((newAp: any, idx: number) => {
                     const oldAp = docData.approvers[idx];
                     if (oldAp && oldAp.email === newAp.email && oldAp.status === 'approved') {
                         return { ...newAp, status: 'approved', signature: oldAp.signature || '', approvedAt: oldAp.approvedAt || '' };
                     }
                     return { ...newAp, status: 'pending' };
                 });
             } 
             else {
                 mergedApprovers = payload.approvers.map((a: any) => ({...a, status: 'pending', signature: '', approvedAt: ''}));
             }

             await updateDoc(docRef, {
                 ...payload,
                 status: newStatus,
                 currentStep: newStep,
                 approvers: mergedApprovers,
                 completedAt: null,
                 updatedAt: serverTimestamp(),
                 comment: '',
             });
             return { success: true };
         } 
         // 2. 신규 생성
         else {
             const newDocRef = doc(collection(db, 'approvals'));
             const settingsRef = doc(db, 'settings', 'docConfig');
             
             const finalDocNoStr = await runTransaction(db, async (transaction) => {
                const settingsSnap = await transaction.get(settingsRef);
                let nextNum = 1;
                const isFamilyCat = category === 'family'; 

                if (settingsSnap.exists()) {
                    const data = settingsSnap.data() as DocConfig;
                    if (isFamilyCat) {
                        nextNum = data.nextFamilyNumber || 1;
                        transaction.update(settingsRef, { nextFamilyNumber: nextNum + 1 });
                    } else {
                        nextNum = data.nextNumber || 1;
                        transaction.update(settingsRef, { nextNumber: nextNum + 1 });
                    }
                } else {
                    const initialData = isFamilyCat ? { nextNumber: 1, nextFamilyNumber: 2 } : { nextNumber: 2, nextFamilyNumber: 1 };
                    transaction.set(settingsRef, initialData);
                }
                return isFamilyCat ? `Kish-가통-${nextNum}` : `Kish-초등-${nextNum}`;
             });

             await setDoc(newDocRef, {
                 ...payload,
                 docNo: finalDocNoStr,
                 requesterId: user.uid,
                 requesterName: profile.name,
                 requesterEmail: profile.email,
                 requesterRole: profile.role,
                 requesterSignature: profile.signature || '',
                 currentStep: 0,
                 status: 'pending',
                 createdAt: serverTimestamp(),
                 completedAt: null,
             });
             return { success: true };
         }
     } catch (error: any) {
         console.error("Submit Error:", error);
         return { success: false, error: error.message };
     }
  };

  const onSubmit = (data: FormData) => {
     if (!user || !profile) {
         toast({ variant: "destructive", title: "권한 오류", description: "로그인이 필요합니다." });
         return;
     }

     startTransition(async () => {
         const result = await handleClientSubmit(data);
         if(result.success) {
             toast({ title: isEditMode ? "수정 완료" : "상신 완료", description: "문서가 처리되었습니다." });
             router.push('/inbox');
             router.refresh();
         } else {
             toast({ variant: "destructive", title: "실패", description: result.error });
         }
     });
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit, onInvalid)} className="space-y-8">
        
        <FormField
          control={form.control}
          name="title"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-lg font-bold">제목</FormLabel>
              <FormControl>
                <Input placeholder={isFamily ? "가정통신문 제목" : "문서 제목"} {...field} className="h-12 text-base" />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        
        <Card>
          <CardHeader><CardTitle>결재선</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {approverFields.map((field, index) => {
              const targetRole = field.role;
              const filteredUsers = users.filter(u => {
                  if (targetRole === '협조') return true;
                  return u.role === targetRole;
              });

              return (
                <Card key={field.id} className={cn(!form.watch(`approvers.${index}.active`) && 'bg-muted/50')}>
                  <CardHeader className="p-4 flex-row items-center justify-between">
                    <CardTitle className="text-base">{field.role}</CardTitle>
                    <FormField control={form.control} name={`approvers.${index}.active`} render={({field: f}) => (
                      <FormItem className="flex gap-2 items-center space-y-0">
                        <FormControl><Switch checked={f.value} onCheckedChange={f.onChange}/></FormControl>
                      </FormItem>
                    )} />
                  </CardHeader>
                  {form.watch(`approvers.${index}.active`) && (
                    <CardContent className="p-4 pt-0 space-y-2">
                        <Controller
                          control={form.control}
                          name={`approvers.${index}.name`}
                          render={({ field: nameField }) => (
                             <FormItem>
                                <FormControl>
                                  <UserSearch
                                    users={filteredUsers}
                                    value={nameField.value}
                                    onSelectUser={(u) => {
                                        form.setValue(`approvers.${index}.name`, u.name, { shouldValidate: true, shouldDirty: true });
                                        form.setValue(`approvers.${index}.email`, u.email, { shouldValidate: true, shouldDirty: true });
                                        form.clearErrors(`approvers.${index}.name`);
                                    }}
                                    placeholder={`${targetRole} 검색...`}
                                  />
                                </FormControl>
                             </FormItem>
                          )}
                        />
                        <Controller
                          control={form.control}
                          name={`approvers.${index}.type`}
                          render={({ field }) => (
                             <Select onValueChange={field.onChange} defaultValue={field.value}>
                                 <SelectTrigger>
                                     <SelectValue placeholder="결재 유형" />
                                 </SelectTrigger>
                                 <SelectContent>
                                     <SelectItem value="normal">일반</SelectItem>
                                     <SelectItem value="final">전결</SelectItem>
                                     <SelectItem value="proxy">대결</SelectItem>
                                 </SelectContent>
                             </Select>
                          )}
                        />
                    </CardContent>
                  )}
                </Card>
              );
            })}
          </CardContent>
        </Card>

        {!isFamily && (
        <div className="grid md:grid-cols-2 gap-8">
            <Card>
            <CardHeader><CardTitle>공람</CardTitle></CardHeader>
            <CardContent>
                <div className="mb-4">
                <UserSearch
                    users={users}
                    value={circularQuery}
                    onChange={(value) => setCircularQuery(value)}
                    onSelectUser={(u) => {
                    if (!circularFields.some(f => f.email === u.email)) appendCircular({name: u.name, email: u.email, role: u.role});
                    setCircularQuery(''); 
                    }}
                    placeholder="공람자 검색..."
                />
                </div>
                <div className="flex flex-wrap gap-2 min-h-[40px]">
                    {circularFields.map((field, i) => (
                        <div key={field.id} className="bg-muted p-2 rounded-md flex gap-2 items-center text-sm font-medium">
                            <span>{field.name} ({field.role})</span>
                            <button type="button" onClick={() => removeCircular(i)}>
                                <X className="h-4 w-4 text-muted-foreground hover:text-foreground"/>
                            </button>
                        </div>
                    ))}
                </div>
            </CardContent>
            </Card>

            <div className="space-y-4">
                <FormField
                    control={form.control}
                    name="publishStatus"
                    render={({ field }) => (
                    <FormItem>
                        <FormLabel className="text-lg font-bold">게시 상태</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                                <SelectTrigger>
                                    <SelectValue placeholder="게시 상태 선택" />
                                </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                                <SelectItem value="공개">공개</SelectItem>
                                <SelectItem value="비공개">비공개</SelectItem>
                                <SelectItem value="부분공개">부분공개</SelectItem>
                            </SelectContent>
                        </Select>
                        <FormMessage />
                    </FormItem>
                )}/>
                <FormField
                  control={form.control}
                  name="docType"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-lg font-bold">문서 종류</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="문서 종류 선택" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="internal">내부결재</SelectItem>
                          <SelectItem value="external">대외공문</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                 {formDocType === 'external' && (
                    <div className="grid grid-cols-2 gap-4">
                        <FormField control={form.control} name="receiverName" render={({field}) => (
                           <FormItem><FormLabel>수신처명</FormLabel><FormControl><Input placeholder="예: KISH" {...field} /></FormControl></FormItem>
                        )}/>
                         <FormField control={form.control} name="receiverEmail" render={({field}) => (
                           <FormItem><FormLabel>수신처 이메일</FormLabel><FormControl><Input placeholder="수신처 이메일" {...field} /></FormControl></FormItem>
                        )}/>
                    </div>
                )}
            </div>
        </div>
        )}

        <FormField
          control={form.control}
          name="content"
          render={({ field }) => (
            <FormItem>
              <div className="flex justify-between items-center">
                <FormLabel className="text-lg font-bold">내용</FormLabel>
                <Button type="button" onClick={handleGenerateContent} disabled={isGenerating}>
                    {isGenerating ? <Loader2 className="animate-spin" /> : <Sparkles />}
                    AI로 생성
                </Button>
              </div>
              <FormControl>
                <RichEditor value={field.value} onChange={field.onChange} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        
        <Card>
            <CardHeader>
                <CardTitle>첨부파일 <span className="text-xs text-muted-foreground font-normal ml-2">(파일당 최대 50MB)</span></CardTitle>
            </CardHeader>
            <CardContent>
                <div className="space-y-4">
                    <div className="p-6 border-2 border-dashed rounded-lg flex flex-col items-center justify-center text-center">
                        <Paperclip className="h-10 w-10 text-muted-foreground mb-2" />
                        <p className="mb-2 text-sm text-muted-foreground">파일을 드래그 앤 드롭하거나 클릭하여 업로드하세요.</p>
                        <Input 
                            ref={attachmentInputRef}
                            type="file"
                            multiple
                            onChange={handleFileChange}
                            className="hidden"
                        />
                        <Button 
                            type="button" 
                            variant="outline" 
                            onClick={() => attachmentInputRef.current?.click()}
                            disabled={isUploadingFiles}
                        >
                            {isUploadingFiles ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> 업로드 중...</> : '파일 선택'}
                        </Button>
                    </div>

                    {attachmentFields.length > 0 && (
                        <div className="space-y-2">
                            {attachmentFields.map((field, index) => (
                                <div key={field.id} className="flex items-center justify-between p-2 bg-muted rounded-md">
                                    <div className="flex items-center gap-2">
                                        <FileIcon className="h-4 w-4 text-muted-foreground" />
                                        <span className="text-sm font-medium">{field.name}</span>
                                        { field.size > 0 && <span className="text-xs text-muted-foreground">({(field.size / 1024 / 1024).toFixed(2)} MB)</span> }
                                    </div>
                                    <Button type="button" variant="ghost" size="icon" onClick={() => removeAttachment(index)}>
                                        <Trash2 className="h-4 w-4 text-destructive" />
                                    </Button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </CardContent>
        </Card>

        <Button type="submit" disabled={isPending || isUploadingFiles} className="w-full h-12 text-lg font-bold">
            {isPending || isUploadingFiles ? <Loader2 className="animate-spin" /> : (isEditMode ? '수정 후 재상신' : '결재 상신')}
        </Button>
      </form>
    </Form>
  );
}