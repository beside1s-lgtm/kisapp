
'use client';

import { createDocument, getUsersDirectory, getDocConfig, updateDocument } from '@/app/actions';
import { generateContentAction } from '@/app/ai-actions';
import { useAuth } from '@/hooks/use-auth';
import { ApprovalDoc, ApprovalDocPayload, Approver, DocConfig, UserProfile } from '@/lib/types';
import { useForm, Controller, useFieldArray } from 'react-hook-form';
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
  publishStatus: z.enum(['공개', '비공개']),
  docType: z.enum(['internal', 'external']),
  receiverName: z.string().optional(),
  receiverEmail: z.string().email().optional(),
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
}

export default function DocumentForm({ docToEdit }: DocumentFormProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const { user, profile } = useAuth();
  const [isPending, startTransition] = useTransition();
  const [isGenerating, startGenerateTransition] = useTransition();
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [docConfig, setDocConfig] = useState<DocConfig>({});
  
  const [circularQuery, setCircularQuery] = useState('');
  const attachmentInputRef = useRef<HTMLInputElement>(null);

  const isTemplateMode = !!searchParams.get('templateId');
  const isEditMode = !!docToEdit && !isTemplateMode;

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      title: '', content: '',
      approvers: defaultApproversTemplate.map(ap => ({...ap, active: ap.role !== '협조'})),
      circulars: [], attachments: [], publishStatus: '공개', docType: 'internal',
    },
  });

  useEffect(() => {
    getUsersDirectory().then(setUsers);
    getDocConfig().then(setDocConfig);
  }, []);

  useEffect(() => {
    if (docToEdit) {
        form.reset({
            title: docToEdit.title,
            content: docToEdit.content,
            publishStatus: docToEdit.publishStatus,
            docType: docToEdit.docType,
            receiverName: docToEdit.receiverInfo?.name || '',
            receiverEmail: docToEdit.receiverInfo?.email || '',
            circulars: docToEdit.circulars || [],
            attachments: docToEdit.attachments?.map(a => ({...a, size: 0})) || [],
            // 재기안(template) 모드일때는 결재선 초기화, 수정 모드일때는 기존 결재선 로드
            approvers: isTemplateMode
              ? defaultApproversTemplate.map(ap => ({...ap, active: ap.role !== '협조'}))
              : defaultApproversTemplate.map(template => {
                  const existing = docToEdit.approvers.find(a => a.role === template.role);
                  return {
                      ...template,
                      name: existing?.name || '',
                      email: existing?.email || '',
                      type: existing?.type || template.type,
                      active: !!existing,
                  }
              })
        });
    }
  }, [docToEdit, form, isTemplateMode]);

  const { fields: approverFields } = useFieldArray({ control: form.control, name: 'approvers' });
  const { fields: circularFields, append: appendCircular, remove: removeCircular } = useFieldArray({ control: form.control, name: 'circulars' });
  const { fields: attachmentFields, append: appendAttachment, remove: removeAttachment } = useFieldArray({ control: form.control, name: 'attachments' });
  const docType = form.watch('docType');

  const handleGenerateContent = async () => {
    const { title, approvers, attachments } = form.getValues();
    if (!title) {
        toast({ variant: "destructive", title: "제목 필요", description: "AI 콘텐츠를 생성하려면 제목을 먼저 입력해야 합니다." });
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
                throw new Error(result.error || "알 수 없는 오류");
            }
        } catch(e: any) {
            toast({ variant: "destructive", title: "AI 생성 실패", description: e.message });
        }
    });
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
        Array.from(e.target.files).forEach(file => {
            const reader = new FileReader();
            reader.onload = (event) => {
                appendAttachment({
                    name: file.name,
                    size: file.size,
                    data: event.target?.result as string,
                });
            };
            reader.readAsDataURL(file);
        });
    }
  };


  const onSubmit = (data: FormData) => {
     if (!user || !profile) return;
     startTransition(async () => {
         const activeApprovers = data.approvers.filter(a => a.active && a.name);
         if (activeApprovers.length === 0 && !isEditMode) { 
             toast({ variant: 'destructive', title: '결재선 오류', description: '활성화된 결재자가 한 명 이상 있어야 합니다.'});
             return;
         }

         const payload: ApprovalDocPayload = {
             ...data,
             approvers: activeApprovers.map(a => ({...a, status: 'pending'} as Approver)),
             receiverInfo: data.docType === 'external' ? { name: data.receiverName!, email: data.receiverEmail! } : null,
             headerImage: docConfig.headerImage || '',
             footerInfo: { 
                address: docConfig.address || '',
                phone: docConfig.phone || '',
                fax: docConfig.fax || '',
                email: docConfig.email || '',
                homepage: docConfig.homepage || '',
             }
         };
         
         let result;
         if (isEditMode && docToEdit) {
            result = await updateDocument(docToEdit.id, payload, user.uid, profile.email);
         } else {
            result = await createDocument(payload, user.uid, profile);
         }
         
         if(result.success) {
             toast({ title: isEditMode ? "수정 완료" : "상신 완료", description: `문서가 성공적으로 ${isEditMode ? '수정 및 재상신' : '상신'}되었습니다.` });
             router.push(`/sent`);
             router.refresh();
         } else {
             toast({ variant: "destructive", title: "실패", description: result.error });
         }
     });
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
        
        <FormField
          control={form.control}
          name="title"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-lg font-bold">제목</FormLabel>
              <FormControl>
                <Input placeholder="문서의 제목을 입력하세요." {...field} className="h-12 text-base" />
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
              // [수정] 직책에 따른 사용자 필터링 (협조는 모두, 나머지는 직책 일치)
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

        <div className="grid md:grid-cols-2 gap-8">
            <Card>
            <CardHeader><CardTitle>공람</CardTitle></CardHeader>
            <CardContent>
                <div className="mb-4">
                <UserSearch
                    users={users}
                    value={circularQuery}
                    onSelectUser={(u) => {
                    if (!circularFields.some(f => f.email === u.email)) appendCircular({name: u.name, email: u.email, role: u.role});
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
                    <FormItem className="space-y-3">
                        <FormLabel className="text-lg font-bold">게시 상태</FormLabel>
                         <FormControl>
                            <RadioGroup
                                onValueChange={field.onChange}
                                defaultValue={field.value}
                                className="flex space-x-4"
                            >
                                <FormItem className="flex items-center space-x-2 space-y-0">
                                <FormControl><RadioGroupItem value="공개" /></FormControl>
                                <FormLabel className="font-normal">공개</FormLabel>
                                </FormItem>
                                <FormItem className="flex items-center space-x-2 space-y-0">
                                <FormControl><RadioGroupItem value="비공개" /></FormControl>
                                <FormLabel className="font-normal">비공개</FormLabel>
                                </FormItem>
                            </RadioGroup>
                         </FormControl>
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
                 {docType === 'external' && (
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
                <CardTitle>첨부파일</CardTitle>
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
                        <Button type="button" variant="outline" onClick={() => attachmentInputRef.current?.click()}>파일 선택</Button>
                    </div>

                    {attachmentFields.length > 0 && (
                        <div className="space-y-2">
                            {attachmentFields.map((field, index) => (
                                <div key={field.id} className="flex items-center justify-between p-2 bg-muted rounded-md">
                                    <div className="flex items-center gap-2">
                                        <FileIcon className="h-4 w-4 text-muted-foreground" />
                                        <span className="text-sm font-medium">{field.name}</span>
                                        { field.size > 0 && <span className="text-xs text-muted-foreground">({(field.size / 1024).toFixed(1)} KB)</span> }
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

        <Button type="submit" disabled={isPending} className="w-full h-12 text-lg font-bold">
            {isPending ? <Loader2 className="animate-spin" /> : (isEditMode ? '수정 후 재상신' : '결재 상신')}
        </Button>
      </form>
    </Form>
  );
}
