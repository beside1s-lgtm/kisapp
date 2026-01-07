'use client';

import {
  createDocument,
  getUsersDirectory,
  generateContentAction,
  getDocConfig,
} from '@/app/actions';
import { useAuth } from '@/hooks/use-auth';
import {
  ApprovalDocPayload,
  Approver,
  Circular,
  DocConfig,
  UserProfile,
} from '@/lib/types';
import { useForm, Controller, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState, useTransition } from 'react';
import {
  File as FileIcon,
  Loader2,
  Plus,
  Sparkles,
  Upload,
  User as UserIcon,
  X,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Input } from './ui/input';
import { Textarea } from './ui/textarea';
import { Button } from './ui/button';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Label } from './ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './ui/select';
import { Switch } from './ui/switch';
import { UserSearch } from './user-search';
import { cn, compressImage } from '@/lib/utils';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from './ui/form';

const approverSchema = z.object({
  name: z.string(),
  email: z.string(),
  role: z.string(),
  type: z.enum(['normal', 'final', 'proxy']),
  active: z.boolean(),
});

const formSchema = z.object({
  title: z.string().min(1, '제목은 필수입니다.'),
  content: z.string().min(1, '내용은 필수입니다.'),
  approvers: z
    .array(approverSchema)
    .superRefine((approvers, ctx) => {
      approvers.forEach((approver, index) => {
        if (approver.active) {
          if (!approver.name) {
            ctx.addIssue({
              path: [index, 'name'],
              message: '결재자 이름은 필수입니다.',
            });
          }
          if (!approver.email) {
            ctx.addIssue({
              path: [index, 'email'],
              message: '결재자 이메일은 필수입니다.',
            });
          }
        }
      });
    }),
  circulars: z.array(
    z.object({ name: z.string(), email: z.string(), role: z.string() })
  ),
  attachments: z.array(
    z.object({ name: z.string(), size: z.number(), data: z.string() })
  ),
  publishStatus: z.enum(['공개', '비공개']),
  docType: z.enum(['internal', 'external']),
  receiverName: z.string().optional(),
  receiverEmail: z.string().email().optional(),
});

type FormData = z.infer<typeof formSchema>;

export default function DocumentForm() {
  const router = useRouter();
  const { toast } = useToast();
  const { user, profile } = useAuth();
  const [isPending, startTransition] = useTransition();
  const [isGenerating, startGenerating] = useTransition();
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [docConfig, setDocConfig] = useState<DocConfig>({});
  const attachmentInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    getUsersDirectory().then(setUsers);
    getDocConfig().then(setDocConfig);
  }, []);

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      title: '',
      content: '',
      approvers: [
        { name: '', email: '', role: '부장', type: 'normal', active: true },
        { name: '', email: '', role: '교감', type: 'normal', active: true },
        { name: '', email: '', role: '협조', type: 'normal', active: false },
        { name: '', email: '', role: '교장', type: 'final', active: true },
      ],
      circulars: [],
      attachments: [],
      publishStatus: '공개',
      docType: 'internal',
    },
  });

  const { fields: approverFields } = useFieldArray({
    control: form.control,
    name: 'approvers',
  });
  const {
    fields: circularFields,
    append: appendCircular,
    remove: removeCircular,
  } = useFieldArray({ control: form.control, name: 'circulars' });
  const {
    fields: attachmentFields,
    append: appendAttachment,
    remove: removeAttachment,
  } = useFieldArray({ control: form.control, name: 'attachments' });

  const docType = form.watch('docType');

  const handleGenerateContent = () => {
    startGenerating(async () => {
      const { title, approvers } = form.getValues();
      if (!title) {
        toast({
          variant: 'destructive',
          title: '제목 필요',
          description: '내용을 생성하려면 제목을 입력하세요.',
        });
        return;
      }
      const activeApprovers = approvers
        .filter((a) => a.active && a.name && a.role)
        .map((a) => ({ name: a.name, role: a.role }));

      const result = await generateContentAction({
        title,
        approvers: activeApprovers,
      });
      if (result.success) {
        form.setValue('content', result.content);
        toast({
          title: '내용 생성됨',
          description: 'AI가 문서 내용을 생성했습니다.',
        });
      } else {
        toast({
          variant: 'destructive',
          title: '생성 실패',
          description: result.error,
        });
      }
    });
  };

  const onSubmit = (data: FormData) => {
    startTransition(async () => {
      if (!user || !profile) {
        toast({
          variant: 'destructive',
          title: '인증 오류',
          description: '문서를 제출하려면 로그인해야 합니다.',
        });
        return;
      }
      
      const activeApprovers = data.approvers.filter(a => a.active && a.name && a.email);

      if (activeApprovers.length === 0) {
        const proceed = window.confirm("결재자 없이 문서를 상신하시겠습니까? 이 문서는 즉시 완료 처리됩니다.");
        if (!proceed) return;
      }


      if (!profile.signature) {
        const confirmed = window.confirm(
          '저장된 서명이 없습니다. 서명 없이 계속하시겠습니까?'
        );
        if (!confirmed) return;
      }

      if (
        data.docType === 'external' &&
        (!data.receiverName || !data.receiverEmail)
      ) {
        form.setError('receiverName', {
          message: '외부 문서에는 수신처가 필요합니다.',
        });
        form.setError('receiverEmail', {
          message: '외부 문서에는 이메일이 필요합니다.',
        });
        return;
      }

      const payload: ApprovalDocPayload = {
        title: data.title,
        content: data.content,
        approvers: activeApprovers.map(
          (a) =>
            ({
              name: a.name,
              email: a.email,
              role: a.role,
              type: a.type,
              status: 'pending',
            } as Approver)
        ),
        circulars: data.circulars,
        attachments: data.attachments,
        publishStatus: data.publishStatus,
        docType: data.docType,
        receiverInfo:
          data.docType === 'external'
            ? { name: data.receiverName!, email: data.receiverEmail! }
            : null,
        headerImage: docConfig.headerImage || '',
        footerInfo: {
          address: docConfig.address || '',
          phone: docConfig.phone || '',
          fax: docConfig.fax || '',
          email: docConfig.email || '',
          homepage: docConfig.homepage || '',
        },
      };
      
      const result = await createDocument(payload, user.uid, profile);

      if (result.success && result.docId) {
        toast({
          title: '문서 제출 완료!',
          description: `문서(번호: ${result.docNo})가 결재를 위해 전송되었습니다.`,
        });
        router.push(`/documents/${result.docId}`);
      } else {
        toast({
          variant: 'destructive',
          title: '제출 실패',
          description: result.error || '알 수 없는 오류가 발생했습니다.',
        });
      }
    });
  };

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(onSubmit)}
        className="space-y-6 md:space-y-8"
      >
        <Card>
          <CardContent className="p-4 md:p-6 space-y-6">
            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-base md:text-lg font-bold">
                    제목
                  </FormLabel>
                  <FormControl>
                    <Input
                      placeholder="문서 제목"
                      {...field}
                      className="h-12 text-base md:text-lg"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
              <FormField
                control={form.control}
                name="docType"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>문서 종류</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      defaultValue={field.value}
                    >
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
              <FormField
                control={form.control}
                name="publishStatus"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>공개여부</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      defaultValue={field.value}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="공개여부 선택" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="공개">공개</SelectItem>
                        <SelectItem value="비공개">비공개</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            {docType === 'external' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6 p-4 border rounded-lg bg-secondary/50">
                <FormField
                  control={form.control}
                  name="receiverName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>수신처</FormLabel>
                      <FormControl>
                        <Input placeholder="예: 교육부" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="receiverEmail"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>수신처 이메일</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="예: contact@moe.gov"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>결재선</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {approverFields.map((field, index) => (
              <Card
                key={field.id}
                className={cn(!field.active && 'bg-muted/50')}
              >
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <Label className="font-bold">{field.role}</Label>
                    <FormField
                      control={form.control}
                      name={`approvers.${index}.active`}
                      render={({ field }) => (
                        <FormItem className="flex items-center gap-2 space-y-0">
                          <FormControl>
                            <Switch
                              checked={field.value}
                              onCheckedChange={field.onChange}
                            />
                          </FormControl>
                          <FormLabel>활성</FormLabel>
                        </FormItem>
                      )}
                    />
                  </div>
                  {form.watch(`approvers.${index}.active`) && (
                    <div className="space-y-2">
                       <FormField
                        control={form.control}
                        name={`approvers.${index}.name`}
                        render={({ field: nameField }) => (
                          <FormItem>
                            <FormControl>
                                <UserSearch
                                users={users}
                                onSelectUser={(user) => {
                                    form.setValue(`approvers.${index}.name`, user.name, { shouldValidate: true });
                                    form.setValue(`approvers.${index}.email`, user.email, { shouldValidate: true });
                                }}
                                value={nameField.value}
                                onValueChange={nameField.onChange}
                                />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name={`approvers.${index}.type`}
                        render={({ field: selectField }) => (
                          <Select
                            onValueChange={selectField.onChange}
                            defaultValue={selectField.value}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="결재 종류" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="normal">일반</SelectItem>
                              <SelectItem value="final">전결</SelectItem>
                              <SelectItem value="proxy">대결</SelectItem>
                            </SelectContent>
                          </Select>
                        )}
                      />
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
             <FormMessage>{(form.formState.errors.approvers as any)?.root?.message}</FormMessage>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>공람</CardTitle>
            <FormDescription>
              결재는 필요 없지만 문서를 확인해야 하는 사용자를 추가하세요.
            </FormDescription>
          </CardHeader>
          <CardContent>
            <div className="mb-4">
              <UserSearch
                users={users}
                onSelectUser={(user) => appendCircular(user)}
                placeholder="추가할 사용자 검색..."
              />
            </div>
            <div className="flex flex-wrap gap-2">
              {circularFields.map((field, index) => (
                <div
                  key={field.id}
                  className="flex items-center gap-2 bg-muted p-2 rounded-lg"
                >
                  <UserIcon className="h-4 w-4" />
                  <span className="text-sm font-medium">{field.name}</span>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    onClick={() => removeCircular(index)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>내용</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex justify-end">
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={handleGenerateContent}
                disabled={isGenerating}
              >
                {isGenerating ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Sparkles className="mr-2 h-4 w-4 text-yellow-500" />
                )}
                AI로 생성하기
              </Button>
            </div>
            <FormField
              control={form.control}
              name="content"
              render={({ field }) => (
                <FormItem>
                  <FormControl>
                    <Textarea
                      placeholder="문서 내용을 여기에 작성하세요..."
                      rows={15}
                      className="font-serif text-base leading-relaxed"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>첨부파일</CardTitle>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => attachmentInputRef.current?.click()}
            >
              <Plus className="mr-2 h-4 w-4" /> 파일 추가
            </Button>
            <input
              type="file"
              multiple
              ref={attachmentInputRef}
              className="hidden"
              onChange={(e) => {
                const files = Array.from(e.target.files || []);
                files.forEach((file) => {
                  const reader = new FileReader();
                  reader.onloadend = async () => {
                    let data = reader.result as string;
                    if (file.type.startsWith('image/')) {
                      data = await compressImage(data);
                    }
                    appendAttachment({
                      name: file.name,
                      size: file.size,
                      data,
                    });
                  };
                  reader.readAsDataURL(file);
                });
              }}
            />
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {attachmentFields.map((field, index) => (
                <div
                  key={field.id}
                  className="flex items-center justify-between bg-muted p-2 rounded-lg"
                >
                  <div className="flex items-center gap-2">
                    <FileIcon className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm font-medium">{field.name}</span>
                    <span className="text-xs text-muted-foreground">
                      ({(field.size / 1024).toFixed(1)} KB)
                    </span>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    onClick={() => removeAttachment(index)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ))}
              {attachmentFields.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">
                  첨부된 파일이 없습니다.
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        <Button
          type="submit"
          disabled={isPending}
          size="lg"
          className="w-full h-12 md:h-14 text-base md:text-lg"
        >
          {isPending && <Loader2 className="mr-2 h-5 w-5 animate-spin" />}
          결재 요청
        </Button>
      </form>
    </Form>
  );
}
