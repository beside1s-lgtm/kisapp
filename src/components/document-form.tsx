'use client';

import { generateContentAction } from '@/app/ai-actions';
import { useAuth } from '@/hooks/use-auth';
import { ApprovalDoc, ApprovalDocPayload, Approver, DocConfig, UserProfile } from '@/lib/types';
import { useForm, useFieldArray, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useRef, useState, useTransition } from 'react';
import { File as FileIcon, Loader2, Plus, Sparkles, User as UserIcon, X, Paperclip, Trash2, Settings2, FolderOpen } from 'lucide-react';
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
import { doc, getDoc, getDocs, collection, runTransaction, serverTimestamp, setDoc, updateDoc, addDoc, query, where, deleteDoc } from 'firebase/firestore';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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

  // 프리셋 관련 상태
  const [presets, setPresets] = useState<any[]>([]);
  const [selectedPresetId, setSelectedPresetId] = useState<string>('');
  const [myDepartments, setMyDepartments] = useState<any[]>([]);
  const [allDepartments, setAllDepartments] = useState<any[]>([]);
  const [isPresetDialogOpen, setIsPresetDialogOpen] = useState(false);
  
  // 프리셋 저장/관리용 폼 상태
  const [newPresetName, setNewPresetName] = useState('');
  const [newPresetType, setNewPresetType] = useState<'personal' | 'department'>('personal');
  const [selectedDeptIdForPreset, setSelectedDeptIdForPreset] = useState<string>('');

  const leadDepartments = myDepartments.filter(d => d.headEmail?.trim().toLowerCase() === profile?.email?.trim().toLowerCase());
  const canSaveDeptPreset = profile?.isAdmin || leadDepartments.length > 0;

  // 프리셋 및 조직도 로드
  useEffect(() => {
    if (!profile?.email) return;

    const loadPresetsAndOrg = async () => {
      try {
        const orgSnap = await getDoc(doc(db, 'settings', 'orgStructure'));
        let myDepts: any[] = [];
        let allDepts: any[] = [];
        if (orgSnap.exists()) {
          const orgData = orgSnap.data();
          if (orgData.departments) {
            allDepts = orgData.departments;
            setAllDepartments(allDepts);
            
            const emailNormal = profile.email.trim().toLowerCase();
            myDepts = orgData.departments.filter((dept: any) => {
              const headMatch = dept.headEmail?.trim().toLowerCase() === emailNormal;
              const memberMatch = dept.memberEmails?.some((m: string) => m.trim().toLowerCase() === emailNormal);
              return headMatch || memberMatch;
            });
            setMyDepartments(myDepts);
            
            const leadDepts = myDepts.filter(d => d.headEmail?.trim().toLowerCase() === emailNormal);
            if (leadDepts.length > 0) {
              setSelectedDeptIdForPreset(leadDepts[0].id);
            } else if (myDepts.length > 0) {
              setSelectedDeptIdForPreset(myDepts[0].id);
            } else if (allDepts.length > 0) {
              setSelectedDeptIdForPreset(allDepts[0].id);
            }
          }
        }

        const personalQuery = query(
          collection(db, 'approval_presets'),
          where('type', '==', 'personal'),
          where('ownerEmail', '==', profile.email)
        );
        
        const deptQuery = query(
          collection(db, 'approval_presets'),
          where('type', '==', 'department')
        );

        const [personalSnap, deptSnap] = await Promise.all([
          getDocs(personalQuery),
          getDocs(deptQuery)
        ]);

        const personalList = personalSnap.docs.map(d => ({ id: d.id, ...d.data() }));
        const deptList = deptSnap.docs.map(d => ({ id: d.id, ...d.data() }));
        
        setPresets([...personalList, ...deptList]);
      } catch (e) {
        console.error("Load Presets Error:", e);
      }
    };

    loadPresetsAndOrg();
  }, [profile]);

  const handleApplyPreset = (presetId: string) => {
    if (!presetId) return;
    const selected = presets.find(p => p.id === presetId);
    if (!selected) return;

    selected.approvers.forEach((ap: any, idx: number) => {
      form.setValue(`approvers.${idx}.name`, ap.name, { shouldValidate: true, shouldDirty: true });
      form.setValue(`approvers.${idx}.email`, ap.email, { shouldValidate: true, shouldDirty: true });
      form.setValue(`approvers.${idx}.type`, ap.type, { shouldValidate: true, shouldDirty: true });
      form.setValue(`approvers.${idx}.active`, ap.active, { shouldValidate: true, shouldDirty: true });
      form.clearErrors(`approvers.${idx}.name`);
    });

    setSelectedPresetId(presetId);
    toast({
      title: "결재선 프리셋 적용",
      description: `"${selected.name}" 프리셋이 적용되었습니다.`
    });
  };

  const handleSavePreset = async () => {
    if (!newPresetName.trim()) {
      toast({ variant: 'destructive', title: '입력 오류', description: '프리셋 이름을 입력해주세요.' });
      return;
    }

    if (!profile?.email) return;

    const currentApprovers = form.getValues('approvers');
    const activeApprovers = currentApprovers.filter(a => a.active && a.name && a.name.trim() !== '');
    
    if (activeApprovers.length === 0) {
      toast({ variant: 'destructive', title: '저장 불가', description: '활성화되고 이름이 입력된 결재자가 최소 한 명 이상 필요합니다.' });
      return;
    }

    try {
      const newPreset: any = {
        name: newPresetName,
        type: newPresetType,
        approvers: currentApprovers.map(a => ({
          name: a.name || '',
          email: a.email || '',
          role: a.role,
          type: a.type,
          active: a.active
        })),
        createdAt: serverTimestamp()
      };

      if (newPresetType === 'personal') {
        newPreset.ownerEmail = profile.email;
      } else {
        const dept = allDepartments.find(d => d.id === selectedDeptIdForPreset);
        if (!dept) {
          toast({ variant: 'destructive', title: '저장 실패', description: '선택한 부서 정보를 찾을 수 없습니다.' });
          return;
        }
        newPreset.departmentId = dept.id;
        newPreset.departmentName = dept.name;
      }

      const docRef = await addDoc(collection(db, 'approval_presets'), newPreset);
      const addedPreset = {
        id: docRef.id,
        ...newPreset
      };

      setPresets(prev => [...prev, addedPreset]);
      setSelectedPresetId(docRef.id);
      setNewPresetName('');
      toast({ title: '프리셋 저장 완료', description: `"${newPresetName}" 결재선 프리셋이 저장되었습니다.` });
    } catch (e: any) {
      console.error("Save Preset Error:", e);
      toast({ variant: 'destructive', title: '저장 실패', description: e.message });
    }
  };

  const handleDeletePreset = async (presetId: string) => {
    const selected = presets.find(p => p.id === presetId);
    if (!selected) return;

    if (!window.confirm(`"${selected.name}" 프리셋을 삭제하시겠습니까?`)) return;

    try {
      await deleteDoc(doc(db, 'approval_presets', presetId));
      setPresets(prev => prev.filter(p => p.id !== presetId));
      if (selectedPresetId === presetId) {
        setSelectedPresetId('');
      }
      toast({ title: '프리셋 삭제 완료', description: `"${selected.name}" 프리셋이 삭제되었습니다.` });
    } catch (e: any) {
      console.error("Delete Preset Error:", e);
      toast({ variant: 'destructive', title: '삭제 실패', description: e.message });
    }
  };

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
                const now = new Date();
                const currentYear = now.getFullYear();
                const currentMonth = now.getMonth() + 1;
                const schoolYear = (currentMonth === 1 || currentMonth === 2) ? currentYear - 1 : currentYear;

                let nextNum = 1;
                const isFamilyCat = category === 'family'; 

                if (settingsSnap.exists()) {
                    const data = settingsSnap.data() as any;
                    const savedYear = data.currentSchoolYear || 0;
                    
                    if (savedYear !== schoolYear) {
                        nextNum = 1;
                        if (isFamilyCat) {
                            transaction.update(settingsRef, {
                                nextFamilyNumber: 2,
                                nextNumber: 1,
                                currentSchoolYear: schoolYear
                            });
                        } else {
                            transaction.update(settingsRef, {
                                nextNumber: 2,
                                nextFamilyNumber: 1,
                                currentSchoolYear: schoolYear
                            });
                        }
                    } else {
                        if (isFamilyCat) {
                            nextNum = data.nextFamilyNumber || 1;
                            transaction.update(settingsRef, { nextFamilyNumber: nextNum + 1 });
                        } else {
                            nextNum = data.nextNumber || 1;
                            transaction.update(settingsRef, { nextNumber: nextNum + 1 });
                        }
                    }
                } else {
                    const initialData = isFamilyCat 
                      ? { nextNumber: 1, nextFamilyNumber: 2, currentSchoolYear: schoolYear } 
                      : { nextNumber: 2, nextFamilyNumber: 1, currentSchoolYear: schoolYear };
                    transaction.set(settingsRef, initialData);
                }
                return isFamilyCat ? `Kish-${schoolYear}-가통-${nextNum}` : `Kish-${schoolYear}-초등-${nextNum}`;
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
    <>
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
          <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b">
            <div className="flex items-center gap-2">
              <FolderOpen className="h-5 w-5 text-primary" />
              <CardTitle>결재선 지정</CardTitle>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {/* 프리셋 선택 셀렉트 */}
              <div className="w-[200px]">
                <Select value={selectedPresetId} onValueChange={handleApplyPreset}>
                  <SelectTrigger className="h-9 bg-background">
                    <SelectValue placeholder="결재선 프리셋 적용..." />
                  </SelectTrigger>
                  <SelectContent>
                    {/* 개인 프리셋 목록 */}
                    {presets.filter(p => p.type === 'personal').length > 0 && (
                      <>
                        <div className="px-2 py-1 text-[10px] font-bold text-muted-foreground bg-muted/40 rounded-sm">개인 프리셋</div>
                        {presets.filter(p => p.type === 'personal').map(preset => (
                          <SelectItem key={preset.id} value={preset.id!}>
                            {preset.name}
                          </SelectItem>
                        ))}
                      </>
                    )}

                    {/* 부서 프리셋 목록 */}
                    {presets.filter(p => p.type === 'department').length > 0 && (
                      <>
                        <div className="px-2 py-1 text-[10px] font-bold text-muted-foreground bg-muted/40 rounded-sm mt-1">부서 프리셋</div>
                        {presets.filter(p => p.type === 'department').map(preset => {
                          const isMyDept = myDepartments.some(d => d.id === preset.departmentId);
                          return (
                            <SelectItem key={preset.id} value={preset.id!}>
                              [{preset.departmentName || '부서'}] {preset.name}
                              {isMyDept && ' (소속)'}
                            </SelectItem>
                          );
                        })}
                      </>
                    )}
                    {presets.length === 0 && (
                      <div className="text-xs text-muted-foreground text-center py-2">등록된 프리셋이 없습니다.</div>
                    )}
                  </SelectContent>
                </Select>
              </div>

              {/* 프리셋 저장 및 관리 다이얼로그 호출 버튼 */}
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  setIsPresetDialogOpen(true);
                }}
                className="h-9 gap-1.5"
              >
                <Settings2 className="h-4 w-4" />
                프리셋 관리
              </Button>
            </div>
          </CardHeader>
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

    {/* 결재선 프리셋 관리 다이얼로그 */}
    <Dialog open={isPresetDialogOpen} onOpenChange={setIsPresetDialogOpen}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>결재선 프리셋 관리</DialogTitle>
          <DialogDescription>
            자주 사용하는 결재선을 프리셋으로 저장하여 빠르게 기안할 수 있습니다.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* 새 프리셋 저장 섹션 */}
          <div className="space-y-3 border-b pb-4">
            <h4 className="text-sm font-bold">현재 결재선을 프리셋으로 저장</h4>
            
            <div className="space-y-2">
              <Label htmlFor="preset-name">프리셋 이름</Label>
              <Input
                id="preset-name"
                placeholder="예: 교무부 복무 결재선, 내 기안 결재선"
                value={newPresetName}
                onChange={(e) => setNewPresetName(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label>프리셋 종류</Label>
              <RadioGroup
                value={newPresetType}
                onValueChange={(val: any) => setNewPresetType(val)}
                className="flex gap-4 pt-1"
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="personal" id="type-personal" />
                  <Label htmlFor="type-personal" className="cursor-pointer">개인 프리셋</Label>
                </div>
                {canSaveDeptPreset && (
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="department" id="type-department" />
                    <Label htmlFor="type-department" className="cursor-pointer">부서 프리셋</Label>
                  </div>
                )}
              </RadioGroup>
            </div>

            {newPresetType === 'department' && (
              <div className="space-y-2 animate-in fade-in duration-200">
                <Label htmlFor="preset-dept-select">대상 부서</Label>
                <Select
                  value={selectedDeptIdForPreset}
                  onValueChange={setSelectedDeptIdForPreset}
                >
                  <SelectTrigger id="preset-dept-select">
                    <SelectValue placeholder="부서 선택" />
                  </SelectTrigger>
                  <SelectContent>
                    {profile?.isAdmin ? (
                      allDepartments.map(d => (
                        <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                      ))
                    ) : (
                      leadDepartments.map(d => (
                        <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
                <p className="text-[10px] text-muted-foreground">
                  * 부서 공통 프리셋은 해당 부서원 모두가 기안 시 조회하고 적용할 수 있습니다.
                </p>
              </div>
            )}

            <Button
              type="button"
              onClick={handleSavePreset}
              className="w-full mt-2"
              size="sm"
            >
              현재 결재선 추가
            </Button>
          </div>

          {/* 저장된 프리셋 목록 섹션 */}
          <div className="space-y-3">
            <h4 className="text-sm font-bold">저장된 프리셋 목록</h4>
            <div className="max-h-[200px] overflow-y-auto space-y-2 border rounded-md p-2 bg-muted/20">
              {presets.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-6">저장된 프리셋이 없습니다.</p>
              ) : (
                presets.map((preset) => {
                  const isPersonal = preset.type === 'personal';
                  const isMyDept = myDepartments.some(d => d.id === preset.departmentId);
                  
                  const canDelete = isPersonal || 
                    profile?.isAdmin || 
                    myDepartments.some(d => d.id === preset.departmentId && d.headEmail?.trim().toLowerCase() === profile?.email?.trim().toLowerCase());

                  return (
                    <div
                      key={preset.id}
                      className="flex items-center justify-between p-2.5 rounded-lg border bg-background shadow-sm text-xs"
                    >
                      <div className="flex flex-col gap-1 min-w-0 pr-2">
                        <span className="font-semibold text-foreground truncate">{preset.name}</span>
                        <span className="text-[10px] text-muted-foreground">
                          {isPersonal ? (
                            <span className="text-indigo-600 font-medium">개인 프리셋</span>
                          ) : (
                            <span className="text-emerald-600 font-medium">
                              부서 공통 ({preset.departmentName}) {isMyDept && '• 내 소속'}
                            </span>
                          )}
                        </span>
                      </div>
                      
                      {canDelete && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDeletePreset(preset.id!)}
                          className="h-7 w-7 text-destructive hover:bg-destructive/10 shrink-0"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => setIsPresetDialogOpen(false)}>
            닫기
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    </>
  );
}