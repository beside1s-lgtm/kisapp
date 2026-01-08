'use client';

import { createDocument, getUsersDirectory, generateContentAction, getDocConfig } from '@/app/actions';
import { useAuth } from '@/hooks/use-auth';
import { ApprovalDocPayload, Approver, DocConfig, UserProfile } from '@/lib/types';
import { useForm, Controller, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState, useTransition } from 'react';
import { File as FileIcon, Loader2, Plus, Sparkles, User as UserIcon, X } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Input } from './ui/input';
import { Textarea } from './ui/textarea';
import { Button } from './ui/button';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Label } from './ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Switch } from './ui/switch';
import UserSearch from './user-search';
import { cn, compressImage } from '@/lib/utils';
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from './ui/form';

// ... (Schema 정의는 기존과 동일) ...
const approverSchema = z.object({
  name: z.string(),
  email: z.string().email().or(z.literal('')),
  role: z.string(),
  type: z.enum(['normal', 'final', 'proxy']),
  active: z.boolean(),
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
const defaultApprovers = [
    { name: '', email: '', role: '부장', type: 'normal' },
    { name: '', email: '', role: '교감', type: 'normal' },
    { name: '', email: '', role: '협조', type: 'normal' },
    { name: '', email: '', role: '교장', type: 'final' },
];

export default function DocumentForm() {
  const router = useRouter();
  const { toast } = useToast();
  const { user, profile } = useAuth();
  const [isPending, startTransition] = useTransition();
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [docConfig, setDocConfig] = useState<DocConfig>({});
  
  // [수정] 공람자 검색용 상태 추가 (입력 끊김 방지)
  const [circularQuery, setCircularQuery] = useState('');
  const attachmentInputRef = useRef<HTMLInputElement>(null);

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      title: '', content: '',
      approvers: defaultApprovers.map(ap => ({...ap, active: ap.role !== '협조'})),
      circulars: [], attachments: [], publishStatus: '공개', docType: 'internal',
    },
  });

  useEffect(() => {
    getUsersDirectory().then(setUsers);
    getDocConfig().then(setDocConfig);
  }, []);

  const { fields: approverFields } = useFieldArray({ control: form.control, name: 'approvers' });
  const { fields: circularFields, append: appendCircular, remove: removeCircular } = useFieldArray({ control: form.control, name: 'circulars' });
  const { fields: attachmentFields, append: appendAttachment, remove: removeAttachment } = useFieldArray({ control: form.control, name: 'attachments' });
  const docType = form.watch('docType');

  // ... (handleGenerateContent 등 생략 - 기존 유지) ...
  const onSubmit = (data: FormData) => {
     /* 기존 onSubmit 로직 유지 - createDocument 호출 */ 
     startTransition(async () => {
         const activeApprovers = data.approvers.filter(a => a.active && a.name);
         const payload: ApprovalDocPayload = {
             ...data,
             approvers: activeApprovers.map(a => ({...a, status: 'pending'} as Approver)),
             receiverInfo: data.docType === 'external' ? { name: data.receiverName!, email: data.receiverEmail! } : null,
             headerImage: docConfig.headerImage || '',
             footerInfo: { ...docConfig }
         };
         const result = await createDocument(payload, user?.uid!, profile!);
         if(result.success) {
             toast({ title: "상신 완료" });
             router.push(`/pending`); // 진행 문서함으로 이동
         } else {
             toast({ variant: "destructive", title: "실패", description: result.error });
         }
     });
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        {/* ... 제목 등 상단 필드 생략 ... */}
        
        <Card>
          <CardHeader><CardTitle>결재선</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {approverFields.map((field, index) => (
              <Card key={field.id} className={cn(!form.watch(`approvers.${index}.active`) && 'bg-muted/50')}>
                <CardContent className="p-4 space-y-3">
                  <div className="flex justify-between">
                    <Label className="font-bold">{field.role}</Label>
                    <FormField control={form.control} name={`approvers.${index}.active`} render={({field: f}) => (
                        <FormItem className="flex gap-2 items-center"><FormControl><Switch checked={f.value} onCheckedChange={f.onChange}/></FormControl><FormLabel>활성</FormLabel></FormItem>
                    )} />
                  </div>
                  {form.watch(`approvers.${index}.active`) && (
                    <div className="space-y-2">
                        {/* [핵심 수정] Controller 사용 시 field.value를 UserSearch의 value로 전달 */}
                        <Controller
                          control={form.control}
                          name={`approvers.${index}.name`}
                          render={({ field: nameField }) => (
                             <FormItem>
                                <FormControl>
                                  <UserSearch
                                    users={users}
                                    value={nameField.value} // 여기서 form.watch 대신 field.value 사용
                                    onChange={nameField.onChange}
                                    onSelectUser={(u) => {
                                        form.setValue(`approvers.${index}.name`, u.name);
                                        form.setValue(`approvers.${index}.email`, u.email);
                                    }}
                                    placeholder="이름 검색..."
                                  />
                                </FormControl>
                             </FormItem>
                          )}
                        />
                        {/* 직책 선택 필드 등... */}
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>공람</CardTitle></CardHeader>
          <CardContent>
            <div className="mb-4">
              {/* [핵심 수정] 공람자는 별도 state로 입력 제어 */}
              <UserSearch
                users={users}
                value={circularQuery}
                onChange={(value) => setCircularQuery(value)}
                onSelectUser={(u) => {
                  if (!circularFields.some(f => f.email === u.email)) appendCircular({name: u.name, email: u.email, role: u.role});
                  setCircularQuery(''); // 선택 후 초기화
                }}
                placeholder="공람자 검색..."
              />
            </div>
            <div className="flex flex-wrap gap-2">
                {circularFields.map((field, i) => (
                    <div key={field.id} className="bg-muted p-2 rounded flex gap-2 items-center text-sm">
                        <span>{field.name}</span>
                        <X className="h-4 w-4 cursor-pointer" onClick={() => removeCircular(i)}/>
                    </div>
                ))}
            </div>
          </CardContent>
        </Card>
        
        {/* ... 본문, 첨부파일 등 ... */}
        <Button type="submit" disabled={isPending} className="w-full h-12 text-lg">결재 상신</Button>
      </form>
    </Form>
  );
}
