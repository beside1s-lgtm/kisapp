'use client';

import {
  createDocument,
  getUsersDirectory,
  generateContentAction,
  getDocConfig
} from '@/app/actions';
import { useAuth } from '@/hooks/use-auth';
import {
  ApprovalDocPayload,
  Approver,
  Attachment,
  Circular,
  DocConfig,
  User,
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

const formSchema = z.object({
  title: z.string().min(1, 'Title is required.'),
  content: z.string().min(1, 'Content is required.'),
  approvers: z
    .array(
      z.object({
        name: z.string().min(1, 'Approver name is required.'),
        email: z.string().email(),
        role: z.string(),
        type: z.enum(['normal', 'final', 'proxy']),
        active: z.boolean(),
      })
    )
    .refine((approvers) => approvers.filter((a) => a.active).length > 0, {
      message: 'At least one approver must be active.',
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
  const [users, setUsers] = useState<User[]>([]);
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

  const { fields: approverFields, update: updateApprover } = useFieldArray({
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
          title: 'Title Required',
          description: 'Please enter a title to generate content.',
        });
        return;
      }
      const activeApprovers = approvers
        .filter((a) => a.active)
        .map((a) => ({ name: a.name, role: a.role }));

      const result = await generateContentAction({ title, approvers: activeApprovers });
      if (result.success) {
        form.setValue('content', result.content);
        toast({ title: 'Content Generated', description: 'AI has generated the document content.' });
      } else {
        toast({ variant: 'destructive', title: 'Generation Failed', description: result.error });
      }
    });
  };

  const onSubmit = (data: FormData) => {
    startTransition(async () => {
      if (!user || !profile) {
        toast({
          variant: 'destructive',
          title: 'Authentication Error',
          description: 'You must be logged in to submit a document.',
        });
        return;
      }

      if (!profile.signature) {
        const confirmed = window.confirm("You don't have a signature saved. Continue without one?");
        if (!confirmed) return;
      }
      
      if (data.docType === 'external' && (!data.receiverName || !data.receiverEmail)) {
          form.setError('receiverName', { message: 'Receiver is required for external documents.'});
          form.setError('receiverEmail', { message: 'Email is required for external documents.'});
          return;
      }

      const payload: ApprovalDocPayload = {
        title: data.title,
        content: data.content,
        approvers: data.approvers
          .filter((a) => a.active)
          .map(
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

      if (result.success) {
        toast({
          title: 'Document Submitted!',
          description: `Your document (No: ${result.docNo}) has been sent for approval.`,
        });
        router.push(`/documents/${result.docId}`);
      } else {
        toast({
          variant: 'destructive',
          title: 'Submission Failed',
          description: result.error,
        });
      }
    });
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
        <Card>
          <CardContent className="p-6 space-y-6">
            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-lg font-bold">Title</FormLabel>
                  <FormControl>
                    <Input placeholder="Document Title" {...field} className="h-12 text-lg" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
               <FormField
                  control={form.control}
                  name="docType"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Document Type</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select document type" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="internal">Internal</SelectItem>
                          <SelectItem value="external">External</SelectItem>
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
                      <FormLabel>Visibility</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select visibility" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="공개">Public</SelectItem>
                          <SelectItem value="비공개">Private</SelectItem>
                        </SelectContent>
                      </Select>
                       <FormMessage />
                    </FormItem>
                  )}
                />
            </div>
             {docType === 'external' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-4 border rounded-lg bg-secondary/50">
                     <FormField
                        control={form.control}
                        name="receiverName"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>Receiver Name</FormLabel>
                                <FormControl>
                                    <Input placeholder="e.g., Ministry of Education" {...field} />
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
                                <FormLabel>Receiver Email</FormLabel>
                                <FormControl>
                                    <Input placeholder="e.g., contact@moe.gov" {...field} />
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
            <CardTitle>Approval Line</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {approverFields.map((field, index) => (
              <Card key={field.id} className={cn(!field.active && 'bg-muted/50')}>
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <Label className="font-bold">{field.role}</Label>
                    <FormField
                      control={form.control}
                      name={`approvers.${index}.active`}
                      render={({ field }) => (
                        <FormItem className="flex items-center gap-2 space-y-0">
                          <FormControl>
                             <Switch checked={field.value} onCheckedChange={field.onChange} />
                          </FormControl>
                          <FormLabel>Active</FormLabel>
                        </FormItem>
                      )}
                    />
                  </div>
                  {field.active && (
                    <div className="space-y-2">
                       <UserSearch
                            users={users}
                            onSelectUser={(user) => {
                                form.setValue(`approvers.${index}.name`, user.name);
                                form.setValue(`approvers.${index}.email`, user.email);
                            }}
                            value={field.name}
                            onChange={(e) => form.setValue(`approvers.${index}.name`, e.target.value)}
                        />
                        <FormField
                            control={form.control}
                            name={`approvers.${index}.type`}
                            render={({ field: selectField }) => (
                            <Select onValueChange={selectField.onChange} defaultValue={selectField.value}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Approval Type" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="normal">Normal</SelectItem>
                                    <SelectItem value="final">Final</SelectItem>
                                    <SelectItem value="proxy">Proxy</SelectItem>
                                </SelectContent>
                            </Select>
                            )}
                        />
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </CardContent>
        </Card>
        
        <Card>
            <CardHeader>
                <CardTitle>Circulars (CC)</CardTitle>
                <FormDescription>Add users who need to see this document but not approve it.</FormDescription>
            </CardHeader>
            <CardContent>
                <div className="mb-4">
                    <UserSearch users={users} onSelectUser={(user) => appendCircular(user)} placeholder="Search for users to add..."/>
                </div>
                <div className="flex flex-wrap gap-2">
                    {circularFields.map((field, index) => (
                        <div key={field.id} className="flex items-center gap-2 bg-muted p-2 rounded-lg">
                           <UserIcon className="h-4 w-4"/>
                           <span className="text-sm font-medium">{field.name}</span>
                            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => removeCircular(index)}>
                                <X className="h-4 w-4"/>
                            </Button>
                        </div>
                    ))}
                </div>
            </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Content</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex justify-end">
              <Button type="button" size="sm" variant="outline" onClick={handleGenerateContent} disabled={isGenerating}>
                {isGenerating ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Sparkles className="mr-2 h-4 w-4 text-yellow-500" />
                )}
                Generate with AI
              </Button>
            </div>
            <FormField
              control={form.control}
              name="content"
              render={({ field }) => (
                <FormItem>
                  <FormControl>
                    <Textarea
                      placeholder="Write the document content here..."
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
            <CardTitle>Attachments</CardTitle>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => attachmentInputRef.current?.click()}
            >
              <Plus className="mr-2 h-4 w-4" /> Add Files
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
                    appendAttachment({ name: file.name, size: file.size, data });
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
                <p className="text-sm text-muted-foreground text-center py-4">No files attached.</p>
              )}
            </div>
          </CardContent>
        </Card>

        <Button type="submit" disabled={isPending} size="lg" className="w-full h-14 text-lg">
          {isPending && <Loader2 className="mr-2 h-5 w-5 animate-spin" />}
          Submit for Approval
        </Button>
      </form>
    </Form>
  );
}
