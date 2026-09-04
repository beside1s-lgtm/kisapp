'use client';

import { generateContentAction } from '@/app/ai-actions';
import { useAuth } from '@/hooks/use-auth';
import { ApprovalDoc, ApprovalDocPayload, Approver, DocConfig, UserProfile, DelegationRule } from '@/lib/types';
import { useForm, useFieldArray, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useRef, useState, useTransition } from 'react';
import { File as FileIcon, Loader2, Plus, Sparkles, User as UserIcon, X, Paperclip, Trash2, Settings2, FolderOpen, Lock, FileText, CheckCircle2 } from 'lucide-react';
import { getTeacherApplySettings, defaultTeacherApplySettings, getOrgStructure, getDelegationRules } from '@/lib/services/settingsService';
import { useToast } from '@/hooks/use-toast';
import { Input } from './ui/input';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Label } from './ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Switch } from './ui/switch';
import UserSearch from './user-search';
import { cn } from '@/lib/utils';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from './ui/form';
import { RadioGroup, RadioGroupItem } from './ui/radio-group';
import RichEditor from "./rich-editor";
import { getDb } from '@/lib/firebase';
import { doc, getDoc, getDocs, collection, runTransaction, serverTimestamp, setDoc, updateDoc, addDoc, query, where, deleteDoc, limit } from 'firebase/firestore';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { sendMailNotification } from '@/lib/services/documentService';
import { getDocumentById } from '@/lib/services/documentService';
import { generateAfterschoolSettlementWorkbook } from '@/lib/afterschool/excel';
import { getRealtimeSemesterInfo } from '@/lib/services/academicCalendarService';

const approverSchema = z.object({
  name: z.string().optional().default(''),
  email: z.string().optional().default(''),
  role: z.string().optional().default(''),
  type: z.enum(['normal', 'final', 'proxy']).optional().default('normal'),
  active: z.boolean().optional().default(false),
  status: z.enum(['pending', 'approved', 'rejected']).optional(),
  approverName: z.string().optional(),
  signature: z.string().optional(),
  comment: z.string().optional(),
}).passthrough();

const formSchema = z.object({
  title: z.string().min(1, '제목은 필수입니다.'),
  content: z.string().min(1, '내용은 필수입니다.'),
  approvers: z.array(approverSchema).optional().default([]),
  circulars: z.array(z.object({ name: z.string(), email: z.string(), role: z.string().optional() })).optional().default([]),
  attachments: z.array(z.object({ name: z.string(), size: z.number().optional().default(0), data: z.string() })).optional().default([]),
  publishStatus: z.enum(['공개', '비공개', '부분공개']).optional().default('공개'),
  docType: z.enum(['internal', 'external', 'parent', 'teacher-duty', 'teacher-overtime', 'teacher-afterschool']).optional().default('internal'),
  receiverName: z.string().optional().default(''),
  receiverEmail: z.string().optional().default(''),
});
type FormData = z.infer<typeof formSchema>;

const defaultApproversTemplate = [
    { name: '', email: '', role: '부장', type: 'normal' as const, status: 'pending' as const },
    { name: '', email: '', role: '교감', type: 'normal' as const, status: 'pending' as const },
    { name: '', email: '', role: '협조', type: 'normal' as const, status: 'pending' as const },
    { name: '', email: '', role: '교장', type: 'normal' as const, status: 'pending' as const },
];

type DocumentFormProps = {
    docToEdit?: ApprovalDoc | null;
    category?: 'draft' | 'family' | 'general';
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

  // 대면 결재 관련 상태
  const [faceToFaceDocNo, setFaceToFaceDocNo] = useState('');
  const [isFaceToFacePending, startFaceToFaceTransition] = useTransition();


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
        const orgSnap = await getDoc(doc(getDb(), 'settings', 'orgStructure'));
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
          collection(getDb(), 'approval_presets'),
          where('type', '==', 'personal'),
          where('ownerEmail', '==', profile.email)
        );
        
        const deptQuery = query(
          collection(getDb(), 'approval_presets'),
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

      const docRef = await addDoc(collection(getDb(), 'approval_presets'), newPreset);
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
      await deleteDoc(doc(getDb(), 'approval_presets', presetId));
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
  
  const isEditMode = !!docToEdit && !!docToEdit.id && !isTemplateMode && !cloneId;
  const isFamily = category === 'family';

  // 방과후 기안 자동화 설정 상태
  const [approvedDocs, setApprovedDocs] = useState<any[]>([]);
  const [afterschoolCourses, setAfterschoolCourses] = useState<any[]>([]);
  const [afterschoolEnrollments, setAfterschoolEnrollments] = useState<any[]>([]);
  const [afterschoolAttendance, setAfterschoolAttendance] = useState<any[]>([]);
  const [afterschoolApprovalDocs, setAfterschoolApprovalDocs] = useState<any[]>([]);
  const [afterschoolSubstitutes, setAfterschoolSubstitutes] = useState<any[]>([]);
  const [teacherApplySettings, setTeacherApplySettings] = useState<any>(null);

  const [selectedRelatedDocId, setSelectedRelatedDocId] = useState<string>('none');
  const [selectedYear, setSelectedYear] = useState<string>('2026');
  const [selectedSemester, setSelectedSemester] = useState<string>('1학기');
  const [selectedTermType, setSelectedTermType] = useState<string>('학기중');

  // 전결규정 연동 상태
  const [delegationRules, setDelegationRules] = useState<DelegationRule[]>([]);
  const [selectedDelegationId, setSelectedDelegationId] = useState<string>('');

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      title: '', content: '',
      approvers: defaultApproversTemplate.map(ap => ({...ap, active: ap.role !== '협조'})),
      circulars: [], attachments: [], publishStatus: '공개', docType: 'internal',
    },
  });

  const handleApplyDelegationRule = (rule: DelegationRule) => {
    const currentApprovers = form.getValues('approvers') || [];
    const isDeptFinal = rule.finalApprover === 'GRADE_HEAD' || rule.finalApprover === 'ACADEMIC_HEAD' || rule.finalApprover === 'DEPT_HEAD';
    const isVpFinal = rule.finalApprover === 'VP';
    
    const updated = currentApprovers.map((ap: any) => {
      if (ap.role === '교장') {
        return { ...ap, active: !isDeptFinal && !isVpFinal, type: 'normal' };
      }
      if (ap.role === '교감') {
        return { ...ap, active: !isDeptFinal, type: isVpFinal ? 'final' : 'normal' };
      }
      if (ap.role === '부장') {
        return { ...ap, active: true, type: isDeptFinal ? 'final' : 'normal' };
      }
      return ap;
    });

    form.setValue('approvers', updated, { shouldDirty: true, shouldValidate: true });
    replaceApprovers(updated);
    setSelectedDelegationId(rule.id);
    toast({ 
      title: "전결규정 적용 완료", 
      description: `[${rule.subType || rule.mainType}] 전결규정(${isDeptFinal ? '부장 전결' : isVpFinal ? '교감 전결' : '교장 결재'})에 따라 결재선이 설정되었습니다.` 
    });
  };

  const handleQuickTemplate = (type: 'annual' | 'detail' | 'dept' | 'general') => {
    let targetRuleName = '연간계획공문';
    let defaultTitlePrefix = '[연간계획] ';
    if (type === 'detail') {
      targetRuleName = '세부계획공문';
      defaultTitlePrefix = '[세부계획] ';
    } else if (type === 'dept') {
      targetRuleName = '부서계획공문';
      defaultTitlePrefix = '[부서업무] ';
    } else if (type === 'general') {
      targetRuleName = '기본 기안문';
      defaultTitlePrefix = '';
    }

    const curTitle = form.getValues('title') || '';
    const cleanTitle = curTitle.replace(/^\[(연간계획|세부계획|부서업무|기안)\]\s*/, '');
    if (defaultTitlePrefix) {
      form.setValue('title', defaultTitlePrefix + cleanTitle, { shouldDirty: true, shouldValidate: true });
    }

    const matchedRule = delegationRules.find(r => r.subType === targetRuleName || r.mainType === targetRuleName);
    if (matchedRule) {
      handleApplyDelegationRule(matchedRule);
    } else {
      const isDept = type === 'dept';
      const isVp = type === 'detail';
      const currentApprovers = form.getValues('approvers') || [];
      const updated = currentApprovers.map((ap: any) => {
        if (ap.role === '교장') return { ...ap, active: !isDept && !isVp, type: 'normal' };
        if (ap.role === '교감') return { ...ap, active: !isDept, type: isVp ? 'final' : 'normal' };
        if (ap.role === '부장') return { ...ap, active: true, type: isDept ? 'final' : 'normal' };
        return ap;
      });
      form.setValue('approvers', updated, { shouldDirty: true, shouldValidate: true });
      replaceApprovers(updated);
      toast({
        title: "템플릿 결재선 적용",
        description: isDept ? '부서업무공문 (부장 전결) 결재선이 설정되었습니다.' : isVp ? '세부계획공문 (교감 전결) 결재선이 설정되었습니다.' : '연간계획공문 (교장 결재) 결재선이 설정되었습니다.'
      });
    }
  };

  useEffect(() => {
    const fetchBasics = async () => {
        try {
            const usersSnap = await getDocs(collection(getDb(), 'users'));
            const userList = usersSnap.docs.map(d => ({ email: d.id, ...d.data() } as UserProfile));
            setUsers(userList);

            const configSnap = await getDoc(doc(getDb(), 'settings', 'docConfig'));
            if (configSnap.exists()) {
                setDocConfig(configSnap.data() as DocConfig);
            }

            // 위임전결규정 불러오기
            getDelegationRules().then(rules => setDelegationRules(rules || []));

            // 관련 공문 매핑용 기안 목록 조회 (안전한 쿼리 처리)
            try {
                const approvalsSnap = await getDocs(query(collection(getDb(), 'approvals'), where('status', '==', 'approved'), limit(50)));
                const appList = approvalsSnap.docs.map(d => ({ id: d.id, ...d.data() } as any));
                setApprovedDocs(appList);
            } catch (appErr) {
                console.warn("Approvals query skipped:", appErr);
            }

            // 방과후 강좌 목록 조회
            try {
                const coursesSnap = await getDocs(collection(getDb(), 'afterschool_courses'));
                const courseList = coursesSnap.docs.map(d => ({ id: d.id, ...d.data() } as any));
                setAfterschoolCourses(courseList);
            } catch (courseErr) {
                console.warn("Courses query skipped:", courseErr);
            }

            // 방과후 수강생, 출석부, 서류제출, 보결 기록 목록 조회
            try {
                const [enrSnap, attSnap, appDocSnap, subSnap] = await Promise.all([
                  getDocs(collection(getDb(), 'afterschool_enrollments')).catch(() => ({ docs: [] })),
                  getDocs(collection(getDb(), 'afterschool_attendance')).catch(() => ({ docs: [] })),
                  getDocs(collection(getDb(), 'afterschool_approval_docs')).catch(() => ({ docs: [] })),
                  getDocs(collection(getDb(), 'afterschool_substitutes')).catch(() => ({ docs: [] })),
                ]);
                setAfterschoolEnrollments(enrSnap.docs.map(d => ({ id: d.id, ...d.data() } as any)));
                setAfterschoolAttendance(attSnap.docs.map(d => ({ id: d.id, ...d.data() } as any)));
                setAfterschoolApprovalDocs(appDocSnap.docs.map(d => ({ id: d.id, ...d.data() } as any)));
                setAfterschoolSubstitutes(subSnap.docs.map(d => ({ id: d.id, ...d.data() } as any)));
            } catch (subErr) {
                console.warn("Afterschool sub collections query skipped:", subErr);
            }

            // 강사용 개설 기준 설정 조회
            const settings = await getTeacherApplySettings();
            setTeacherApplySettings(settings);

            const cfgData = configSnap.exists() ? (configSnap.data() as DocConfig) : undefined;
            const realtimeSem = getRealtimeSemesterInfo(new Date(), cfgData?.academicCalendar);

            if (settings) {
              setSelectedYear(settings.year || realtimeSem.yearStr);
              setSelectedSemester(settings.semester || realtimeSem.name);
              setSelectedTermType((settings.semester || realtimeSem.name)?.includes('방학') ? '방학중' : '학기중');
            } else {
              setSelectedYear(realtimeSem.yearStr);
              setSelectedSemester(realtimeSem.name);
              setSelectedTermType(realtimeSem.isVacation ? '방학중' : '학기중');
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

        // 1. 시스템 설정의 조직도 및 사용자 목록으로부터 실제 기본 결재선 구성
        let dynamicDefaultApprovers: (Approver & { active: boolean })[] = defaultApproversTemplate.map(ap => ({...ap, active: ap.role !== '협조'}));
        try {
            const org = await getOrgStructure();
            const usersSnap = await getDocs(collection(getDb(), 'users'));
            const userList = usersSnap.docs.map(d => ({ email: d.id, ...d.data() } as UserProfile));

            const principalUser = org?.principal 
                ? userList.find(u => u.email?.trim().toLowerCase() === org.principal?.trim().toLowerCase() || u.name?.trim() === org.principal?.trim()) 
                : userList.find(u => u.role === 'principal' || u.role === '교장');

            const vicePrincipalUser = org?.vicePrincipal 
                ? userList.find(u => u.email?.trim().toLowerCase() === org.vicePrincipal?.trim().toLowerCase() || u.name?.trim() === org.vicePrincipal?.trim()) 
                : userList.find(u => u.role === 'vicePrincipal' || u.role === '교감');
            
            // 작성자 소속 부서 부장 찾기
            const myDept = org?.departments?.find(d => 
                d.memberEmails?.some(m => m?.trim().toLowerCase() === profile?.email?.trim().toLowerCase()) ||
                d.headEmail?.trim().toLowerCase() === profile?.email?.trim().toLowerCase()
            );
            const headUser = myDept?.headEmail 
                ? userList.find(u => u.email?.trim().toLowerCase() === myDept.headEmail?.trim().toLowerCase() || u.name?.trim() === myDept.headEmail?.trim()) 
                : null;

            dynamicDefaultApprovers = [
                {
                    name: headUser?.name || myDept?.headEmail || '부장',
                    email: headUser?.email || (myDept?.headEmail?.includes('@') ? myDept.headEmail : ''),
                    role: '부장',
                    type: 'normal' as const,
                    status: 'pending' as const,
                    active: true,
                },
                {
                    name: vicePrincipalUser?.name || org?.vicePrincipal || '교감',
                    email: vicePrincipalUser?.email || (org?.vicePrincipal?.includes('@') ? org.vicePrincipal : ''),
                    role: '교감',
                    type: 'normal' as const,
                    status: 'pending' as const,
                    active: true,
                },
                {
                    name: '',
                    email: '',
                    role: '협조',
                    type: 'normal' as const,
                    status: 'pending' as const,
                    active: false,
                },
                {
                    name: principalUser?.name || org?.principal || '교장',
                    email: principalUser?.email || (org?.principal?.includes('@') ? org.principal : ''),
                    role: '교장',
                    type: 'final' as const,
                    status: 'pending' as const,
                    active: true,
                },
            ];
        } catch (err) {
            console.error("Failed to load dynamic approvers from org structure:", err);
        }

        const busTemplate = searchParams.get('busTemplate');
        const peTemplate = searchParams.get('peTemplate');
        if (busTemplate === 'true' || peTemplate === 'true') {
            const draftJson = sessionStorage.getItem('pending_doc_draft');
            if (draftJson) {
                try {
                    const draft = JSON.parse(draftJson);
                    sessionStorage.removeItem('pending_doc_draft');
                    const initialAttachments = draft.attachments || [];
                    form.reset({
                        title: draft.title || '',
                        content: draft.content || '',
                        publishStatus: '공개',
                        docType: 'internal',
                        receiverName: '',
                        receiverEmail: '',
                        circulars: [],
                        attachments: initialAttachments,
                        approvers: dynamicDefaultApprovers,
                    });
                    replaceApprovers(dynamicDefaultApprovers);
                    replaceAttachments(initialAttachments);
                    const templateName = peTemplate === 'true' ? '체육 행사' : '스쿨버스';
                    toast({ title: `${templateName} 기안 불러오기 완료`, description: `[${draft.title}] 양식 및 첨부파일(${initialAttachments.length}건)이 탑재되었습니다.` });
                    return;
                } catch (err) {
                    console.error("Draft Parse Error:", err);
                }
            }
        }

        const afterschoolMode = searchParams.get('afterschoolMode');
        if (afterschoolMode === 'plan' || afterschoolMode === 'result') {
            form.reset({
                title: afterschoolMode === 'plan' ? '[계획] 방과후학교 운영 계획 승인의 건' : '[결과] 방과후학교 운영 결과 보고 및 수당 지급 청구의 건',
                content: '<p>데이터 로딩 중...</p>',
                publishStatus: '공개',
                docType: 'teacher-afterschool',
                receiverName: '',
                receiverEmail: '',
                circulars: [],
                attachments: [],
                approvers: dynamicDefaultApprovers,
            });
            replaceApprovers(dynamicDefaultApprovers);
            return;
        }

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

            const formattedAttachments = targetData.attachments?.map(a => ({...a, size: a.size || 0})) || [];
            form.reset({
                title: targetData.title || '',
                content: targetData.content || '',
                publishStatus: targetData.publishStatus || '공개',
                docType: targetData.docType || 'internal',
                receiverName: targetData.receiverInfo?.name || '',
                receiverEmail: targetData.receiverInfo?.email || '',
                circulars: targetData.circulars || [],
                attachments: formattedAttachments,
                approvers: mappedApprovers,
            });
            replaceAttachments(formattedAttachments);
        } else {
            // 일반 신규 기안문 작성 시 동적 기본 결재선 세팅
            form.setValue('approvers', dynamicDefaultApprovers);
            replaceApprovers(dynamicDefaultApprovers);
        }
    };

    initializeForm();
  }, [docToEdit, cloneId, form]);

  // 방과후 기안 본문 및 제목 실시간 동적 생성
  useEffect(() => {
        const afterschoolMode = searchParams.get('afterschoolMode');
        if (!afterschoolMode) return;

        const targetSettings = teacherApplySettings || defaultTeacherApplySettings;
        const openCourses = afterschoolCourses.filter(c => c.status === 'OPEN');
        
        let relatedDocText = '';
        if (selectedRelatedDocId && selectedRelatedDocId !== 'none') {
            const docItem = approvedDocs.find(d => d.id === selectedRelatedDocId);
            if (docItem) {
                const dateStr = docItem.createdAt ? new Date(docItem.createdAt).toLocaleDateString() : '2026.07.07';
                relatedDocText = `${docItem.docNo || '예체능방과후부-' + docItem.id.slice(0, 4).toUpperCase()} (${dateStr}) 「${docItem.title}」`;
            }
        } else {
            relatedDocText = `예체능방과후부-102 (2026.07.07) 「2026학년도 방과후학교 운영 계획 수립 기본계획(안)」`;
        }

        const termLabel = selectedTermType === '방학중' ? '방학중' : '학기중';
        const semesterFull = `${selectedYear}학년도 제${selectedSemester} (${termLabel})`;

        if (afterschoolMode === 'plan') {
            const formattedTitle = `[계획] ${selectedYear}학년도 제${selectedSemester} 방과후학교 운영 계획 승인의 건`;
            const firstCourseTitle = openCourses[0]?.title || '3D 크리에이터 되기';
            const remainingCount = openCourses.length - 1;
            const courseSummaryText = remainingCount > 0 
                ? `${firstCourseTitle} 외 ${remainingCount}개` 
                : `${firstCourseTitle}`;

            const rate = targetSettings.teacherFee || 40000;
            const rCurr = targetSettings.teacherFeeCurrency || 'KRW';
            const formattedRateVal = rCurr === 'USD' ? `${rate.toLocaleString()}` : `${rate.toLocaleString()}${rCurr === 'VND' ? '동' : '원'}`;
            const formattedRate = `${targetSettings.teacherFeeType || '시간당'} ${formattedRateVal}`;

            const tFee = targetSettings.tuitionPerSession || 15000;
            const tCurr = targetSettings.tuitionCurrency || 'KRW';
            const formattedTuitionVal = tCurr === 'USD' ? `${tFee.toLocaleString()}` : `${tFee.toLocaleString()}${tCurr === 'VND' ? '동' : '원'}`;

            const tuitionLabel = targetSettings.tuitionType === '학교예산' 
                ? '학교 예산 지원 (학생 무료 수강)' 
                : `수익자 부담 (유료 수강: 차시당 ${formattedTuitionVal})`;

            const planContent = `
<p><strong>1. 관련</strong>: ${relatedDocText}</p>
<p><strong>2. 목적</strong>: 본교 학생들의 소질 계발과 창의적 체험 활동 기회 확대를 위해 ${semesterFull} 방과후학교 강좌 개설 예정 목록을 심의하고, 일괄 운영 계획을 보고합니다.</p>
<br/>
<p><strong>가. 개설 개요</strong></p>
<p>① 운영 기간: ${semesterFull} (${targetSettings.operatingStartDate} ~ ${targetSettings.operatingEndDate})</p>
<p>② 운영 대상: 초·중·고등부 신청 학생</p>
<p>③ 수강료 구분: ${tuitionLabel}</p>
<p>④ 강사료 단가: ${formattedRate} (지급 재원: ${targetSettings.fundingSource === '수익자부담' ? '수익자 부담' : targetSettings.fundingSource === '학교예산' ? '학교 예산 지원' : '혼용 (수익자 부담 + 학교 예산 지원)'})</p>
<br/>
<p><strong>나. 개설 강좌</strong></p>
<p>① 개설 강좌: ${courseSummaryText}</p>
<br/>
<p><strong>다. 기대 효과</strong>: 사교육비 경감 및 다채로운 예체능·IT 융합 프로그램 제공</p>
<p><strong>라. 붙임파일</strong>: ${selectedYear}-${selectedSemester}_방과후학교_운영계획_강좌목록.xlsx 1부. 끝.</p>
            `.trim();

            form.setValue('title', formattedTitle);
            form.setValue('content', planContent);
            form.setValue('attachments', [
                {
                    name: `${selectedYear}-${selectedSemester}_방과후학교_운영계획_강좌목록.xlsx`,
                    size: 14200,
                    data: 'data:text/plain;base64,QXNzaWdubmVudCBkYXRhCg=='
                }
            ]);
        } else if (afterschoolMode === 'result') {
            const formattedTitle = `[결과] ${selectedYear}학년도 제${selectedSemester} 방과후학교 운영 결과 보고 및 수당 지급 청구의 건`;
            const totalStudents = openCourses.reduce((sum, c) => sum + (c.currentStudents || 0), 0);
            const rate = targetSettings.teacherFee || 800000;
            const submittedCourses = openCourses.filter(c => (afterschoolApprovalDocs || []).some((d: any) => d.courseId === c.id));
            const unsubmittedCount = openCourses.length - submittedCourses.length;
            
            // ★ 올바른 계산: 학생 수와 무관하게 [강좌별 총 수업 차시 × 차시당 강사료 단가]
            const totalSessionsSum = openCourses.reduce((sum, c) => {
              const sessionsPerClass = c.sessionsPerClass || 2;
              return sum + (c.totalSessions || (c.operatingWeeks ? c.operatingWeeks * sessionsPerClass : 20));
            }, 0);
            const totalRate = totalSessionsSum * rate;

            const resultContent = `
<p><strong>1. 관련</strong>: ${relatedDocText}</p>
<p><strong>2. 보고</strong>: ${semesterFull} 방과후학교 프로그램이 성공적으로 종료됨에 따라, 다음과 같이 강좌별 운영 결과 및 출석부·강사출근부 내역을 종합 보고하고 강사료 수당 지급을 청구합니다.</p>
<br/>
<p><strong>가. 운영 결과 및 서류 제출 현황</strong></p>
<p>① 총 개설 강좌 수: ${openCourses.length}개 강좌</p>
<p>② 출석부·출근부 제출 완료: <strong>${submittedCourses.length}개 강좌 (정산 대상)</strong> ${unsubmittedCount > 0 ? ` / 서류 미제출: ${unsubmittedCount}개 강좌 (정산 보류)` : ''}</p>
<p>③ 총 수강 학생 수: ${totalStudents}명</p>
<p>④ 총 수업 이수 차시: 누적 ${totalSessionsSum}차시</p>
<br/>
<p><strong>나. 강사 수당 정산 및 청구 내역</strong></p>
<p>① 총 강사 수당 청구액: <strong>${totalRate.toLocaleString()} VND</strong> (산정 기준: 총 ${totalSessionsSum}차시 × 차시당 ${rate.toLocaleString()} VND)</p>
<p>② 지급 예정일: ${new Date().toLocaleDateString('ko-KR')} (학교 운영위원회 심의 및 서류 검토 후 지급)</p>
<br/>
<p><strong>다. 붙임파일</strong>: ${selectedYear}-${selectedSemester}_방과후학교_출석부_및_강사출근부_취합본.xlsx 1부 (강사료정산 총괄표, 수강생 출석부 취합본, 강사출근부 취합본 포함). 끝.</p>
            `.trim();

            form.setValue('title', formattedTitle);
            form.setValue('content', resultContent);
            form.setValue('attachments', [
                {
                    name: `${selectedYear}-${selectedSemester}_방과후학교_출석부_및_강사출근부_취합본.xlsx`,
                    size: 28500,
                    data: 'data:text/plain;base64,QXNzaWdubmVudCBkYXRhCg=='
                }
            ]);
        }
    }, [
        selectedRelatedDocId,
        selectedYear,
        selectedSemester,
        selectedTermType,
        approvedDocs,
        afterschoolCourses,
        afterschoolEnrollments,
        afterschoolAttendance,
        afterschoolApprovalDocs,
        teacherApplySettings
    ]);

  const handleDownloadAttachment = async (field: any) => {
    if (field.name.includes('_방과후학교_운영계획_강좌목록.xlsx')) {
      try {
        const XLSX = await import('xlsx');
        const openCourses = afterschoolCourses.filter(c => c.status === 'OPEN' || c.status === 'CLOSED');
        const data = openCourses.map((c, idx) => ({
          '순번': idx + 1,
          '강좌명': c.title,
          '담당강사': c.instructorName || '-',
          '수업교실': c.classroom || '-',
          '정원(명)': c.maxStudents,
          '수강료(VND)': c.tuition,
          '교재비(VND)': c.textbookFee || 0,
          '재료비(VND)': c.materialFee || 0,
          '요일': (c.classDays || []).join(','),
          '시간': c.classTime || '09:00 ~ 12:00',
        }));
        
        const worksheet = XLSX.utils.json_to_sheet(data);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, '개설강좌목록');
        XLSX.writeFile(workbook, field.name);
        
        toast({
          title: "다운로드 완료",
          description: `"${field.name}" 엑셀 파일이 성공적으로 생성되어 다운로드되었습니다.`
        });
        return;
      } catch (err) {
        console.error("XLSX export error:", err);
      }
    }
    
    if (field.name.includes('_방과후학교_출석부_및_강사출근부_취합본.xlsx')) {
      try {
        const rate = teacherApplySettings?.teacherFee || 800000;
        const targetCourses = afterschoolCourses.filter(c => c.status === 'OPEN' || c.status === 'CLOSED');
        const coursesToUse = targetCourses.length > 0 ? targetCourses : afterschoolCourses;
        
        const workbook = generateAfterschoolSettlementWorkbook(
          coursesToUse,
          afterschoolEnrollments,
          afterschoolAttendance,
          afterschoolApprovalDocs,
          rate,
          `${selectedYear}-${selectedSemester}`,
          afterschoolSubstitutes
        );

        const XLSX = await import('xlsx');
        XLSX.writeFile(workbook, field.name);
        
        toast({
          title: "다운로드 완료",
          description: `"${field.name}" 종합 취합본(정산총괄표, 출석부, 강사출근부) 파일이 다운로드되었습니다.`
        });
        return;
      } catch (err) {
        console.error("XLSX export error:", err);
      }
    }

    if (field.data) {
      try {
        if (field.data.startsWith('data:')) {
          const res = await fetch(field.data);
          const blob = await res.blob();
          const blobUrl = URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = blobUrl;
          link.download = field.name;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
        } else {
          const link = document.createElement('a');
          link.href = field.data;
          link.download = field.name;
          link.target = '_blank';
          link.rel = 'noopener noreferrer';
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
        }
      } catch (e) {
        console.error("Download error:", e);
        window.open(field.data, '_blank');
      }
    } else {
      toast({
        variant: "destructive",
        title: "오류",
        description: "다운로드할 수 없는 첨부파일이거나 데이터가 유실되었습니다."
      });
    }
  };

  const { fields: approverFields, replace: replaceApprovers, update: updateApprover } = useFieldArray({ control: form.control, name: 'approvers' });
  const { fields: circularFields, append: appendCircular, remove: removeCircular, replace: replaceCirculars } = useFieldArray({ control: form.control, name: 'circulars' });
  const { fields: attachmentFields, append: appendAttachment, remove: removeAttachment, replace: replaceAttachments } = useFieldArray({ control: form.control, name: 'attachments' });
  const formDocType = form.watch('docType'); 

  const handleGenerateContent = async () => {
    if (docConfig.enableAiDraft === false) {
        toast({ variant: "destructive", title: "AI 기능 잠김", description: "관리자 설정에 의해 AI 초안 생성이 비활성화되어 있습니다." });
        return;
    }
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
    const storage = getStorage(getDb().app, 'gs://studio-9153973571-7837c.firebasestorage.app');

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
    console.error("Form Invalid Details:", errors);
    let msg = "입력 내용을 확인해주세요.";
    if (errors.title?.message) msg = String(errors.title.message);
    else if (errors.content?.message) msg = String(errors.content.message);
    else if (errors.approvers) msg = "결재선 정보를 확인해주세요.";
    else {
      const firstKey = Object.keys(errors)[0];
      if (firstKey && errors[firstKey]?.message) {
        msg = String(errors[firstKey].message);
      }
    }
    toast({ variant: "destructive", title: "입력 확인 필요", description: msg });
  };

  const handleClientSubmit = async (data: FormData) => {
     if (!user || !profile) {
         return { success: false, error: "로그인 정보가 없습니다." };
     }

     try {
         const activeApprovers = data.approvers.filter(a => a.active && a.name && a.name.trim() !== '');
         
         if (activeApprovers.length === 0 && !isEditMode) { 
             return { success: false, error: '최소 한 명 이상의 결재자를 지정해 주세요. (우측 결재선에서 부장, 교감, 교장 등 결재자를 선택해 주세요.)' };
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
             approvers: activeApprovers.map(a => {
                 let resolvedEmail = (a.email || '').trim();
                 if (!resolvedEmail && a.name) {
                     const matchedUser = users.find(u => u.name?.trim() === a.name?.trim());
                     if (matchedUser?.email) {
                         resolvedEmail = matchedUser.email.trim();
                     }
                 }
                 return {
                     name: a.name.trim(),
                     email: resolvedEmail,
                     role: a.role,
                     type: a.type,
                     status: 'pending'
                 };
             }),
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

         const approverEmails = (payload.approvers || [])
             .map((a: any) => a.email?.trim().toLowerCase())
             .filter(Boolean);

         const circularEmails = (data.circulars || [])
             .map((c: any) => c.email?.trim().toLowerCase())
             .filter(Boolean);

         payload.approverEmails = approverEmails;
         payload.circularEmails = circularEmails;

         // 1. 수정 모드 (기존 문서 ID가 존재하는 경우)
         if (isEditMode && docToEdit && docToEdit.id) {
             const docRef = doc(getDb(), 'approvals', docToEdit.id);
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
             const newDocRef = doc(collection(getDb(), 'approvals'));
             const settingsRef = doc(getDb(), 'settings', 'docConfig');
             
             const finalDocNoStr = '(결재 진행 중)';

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

             // 첫 번째 결재자에게 이메일 도착 알림 큐잉
             if (payload.approvers && payload.approvers.length > 0) {
                 const firstApprover = payload.approvers[0];
                 if (firstApprover?.email) {
                     const mailSubject = `[Kish 결재 시스템] 새 결재 문서가 상신되었습니다.`;
                     const mailContent = `
                       <div style="font-family: sans-serif; padding: 20px; border: 1px solid #eee; border-radius: 10px; max-width: 600px;">
                         <h2 style="color: #6366f1; margin-top: 0;">새 결재 대기 알림</h2>
                         <p><strong>기안자:</strong> ${profile.name} (${profile.email})</p>
                         <p><strong>문서번호:</strong> ${finalDocNoStr}</p>
                         <p><strong>제목:</strong> ${payload.title}</p>
                         <hr style="border: 0; border-top: 1px solid #eee; margin: 20px 0;" />
                         <p>결재 대기 중인 새 기안문이 있습니다. 결재 시스템 대시보드에 접속하여 확인해 주세요.</p>
                         <a href="https://app.cjwave.kr/inbox" 
                            style="display: inline-block; background-color: #6366f1; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; font-weight: bold; margin-top: 10px;">
                            미결재함으로 이동
                         </a>
                       </div>
                     `;
                     sendMailNotification(firstApprover.email, mailSubject, mailContent, true).catch(() => {});
                 }
             }

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

  const handleFaceToFaceSubmit = (data: FormData) => {
     if (!user || !profile) {
         toast({ variant: "destructive", title: "권한 오류", description: "로그인이 필요합니다." });
         return;
     }
     if (!faceToFaceDocNo.trim()) {
         toast({ variant: "destructive", title: "문서 번호 필요", description: "대면 결재 시 문서 번호를 직접 입력해야 합니다." });
         return;
     }

     startFaceToFaceTransition(async () => {
         try {
             if (!user || !profile) return;

             const activeApprovers = data.approvers.filter(a => a.active && a.name && a.name.trim() !== '');

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
                 approvers: activeApprovers.map(a => {
                     let resolvedEmail = (a.email || '').trim();
                     if (!resolvedEmail && a.name) {
                         const matchedUser = users.find(u => u.name?.trim() === a.name?.trim());
                         if (matchedUser?.email) resolvedEmail = matchedUser.email.trim();
                     }
                     return {
                         name: a.name.trim(),
                         email: resolvedEmail,
                         role: a.role,
                         type: a.type,
                         status: 'approved', // 대면 결재이므로 모두 승인 처리
                     };
                 }),
                 receiverInfo: data.docType === 'external' ? { name: data.receiverName || '', email: data.receiverEmail || '' } : null,
                 headerImage: (docConfig as any).headerImage || '',
                 footerInfo: {
                     address: docConfig.address || '',
                     phone: docConfig.phone || '',
                     fax: docConfig.fax || '',
                     email: docConfig.email || '',
                     homepage: docConfig.homepage || '',
                 },
                 approverEmails: activeApprovers.map(a => a.email?.trim().toLowerCase()).filter(Boolean),
                 circularEmails: data.circulars.map(c => c.email?.trim().toLowerCase()).filter(Boolean),
                 // 대면 결재 전용 필드
                 isFaceToFace: true,
                 faceToFaceDocNo: faceToFaceDocNo.trim(),
                 docNo: faceToFaceDocNo.trim(),
                 requesterId: user.uid,
                 requesterName: profile.name,
                 requesterEmail: profile.email,
                 requesterRole: profile.role,
                 requesterSignature: profile.signature || '',
                 currentStep: activeApprovers.length > 0 ? activeApprovers.length - 1 : 0,
                 status: 'approved',
                 createdAt: serverTimestamp(),
                 completedAt: serverTimestamp(),
             };

             const newDocRef = doc(collection(getDb(), 'approvals'));
             await setDoc(newDocRef, payload);

             toast({ title: "대면 결재 완료", description: `문서 번호 [${faceToFaceDocNo.trim()}]로 대면결재문서대장에 등록되었습니다.` });
             router.push('/registry');
             router.refresh();
         } catch (error: any) {
             console.error("FaceToFace Submit Error:", error);
             toast({ variant: "destructive", title: "대면 결재 실패", description: error.message });
         }
     });
  };



  return (
    <>
      <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit, onInvalid)} className="space-y-8">
        
        {/* 방과후학교 일괄 기안 도우미 패널 */}
        {searchParams.get('afterschoolMode') && (
          <Card className="bg-slate-50/80 border border-slate-200 shadow-sm rounded-2xl p-5 mb-6 space-y-4 text-left">
            <div className="flex items-center gap-2 border-b pb-2.5">
              <Settings2 className="h-5 w-5 text-indigo-600" />
              <div>
                <h3 className="font-bold text-slate-800 text-sm">방과후학교 일괄 기안 도우미 설정</h3>
                <p className="text-[10px] text-slate-500">선택된 항목에 따라 결재 기안서 본문 및 제목이 실시간으로 동적 조립됩니다.</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-xs">
              {/* 1. 관련 기안문 선택 */}
              <div className="md:col-span-2 space-y-1.5">
                <Label className="font-semibold text-slate-600">1. 관련 기안문 선택 (기존 결재 완료 문서)</Label>
                <Select value={selectedRelatedDocId} onValueChange={setSelectedRelatedDocId}>
                  <SelectTrigger className="bg-white h-10 rounded-xl border-slate-300">
                    <SelectValue placeholder="관련 공문을 선택해 주세요..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">(관련 문서 없음 - 디폴트 기본문서 자동 반영)</SelectItem>
                    {approvedDocs.map(doc => (
                      <SelectItem key={doc.id} value={doc.id}>
                        {doc.docNo || '예체능방과후부-' + doc.id.slice(0, 4).toUpperCase()} | {doc.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* 2. 학년도 선택 */}
              <div className="space-y-1.5">
                <Label className="font-semibold text-slate-600">2. 학년도 설정</Label>
                <Select value={selectedYear} onValueChange={setSelectedYear}>
                  <SelectTrigger className="bg-white h-10 rounded-xl border-slate-300">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="2025">2025학년도</SelectItem>
                    <SelectItem value="2026">2026학년도</SelectItem>
                    <SelectItem value="2027">2027학년도</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* 3. 학기 및 운영 구분 */}
              <div className="space-y-1.5">
                <Label className="font-semibold text-slate-600">3. 학기 및 운영 시점</Label>
                <div className="flex gap-2">
                  <Select value={selectedSemester} onValueChange={(val) => {
                    setSelectedSemester(val);
                    if (val.includes('방학')) {
                      setSelectedTermType('방학중');
                    } else {
                      setSelectedTermType('학기중');
                    }
                  }}>
                    <SelectTrigger className="bg-white h-10 rounded-xl border-slate-300 w-1/2">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1학기">1학기</SelectItem>
                      <SelectItem value="여름방학">여름방학</SelectItem>
                      <SelectItem value="2학기">2학기</SelectItem>
                      <SelectItem value="겨울방학">겨울방학</SelectItem>
                      <SelectItem value="특별강좌">특별강좌</SelectItem>
                    </SelectContent>
                  </Select>

                  <Select value={selectedTermType} onValueChange={setSelectedTermType}>
                    <SelectTrigger className="bg-white h-10 rounded-xl border-slate-300 w-1/2">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="학기중">학기중</SelectItem>
                      <SelectItem value="방학중">방학중</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          </Card>
        )}
        
        {/* 전결규정 빠른 템플릿 선택 바 */}
        <div className="flex flex-wrap items-center gap-2 p-3 bg-slate-50 border border-slate-200 rounded-xl">
          <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5 shrink-0">
            <FileText className="w-3.5 h-3.5 text-indigo-600" />
            전결규정 템플릿:
          </span>
          <div className="flex flex-wrap gap-1.5">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => handleQuickTemplate('general')}
              className="h-7 text-xs px-2.5 bg-white hover:bg-slate-100"
            >
              기본 기안문 (교장 결재)
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => handleQuickTemplate('annual')}
              className="h-7 text-xs px-2.5 bg-white hover:bg-slate-100 border-indigo-200 text-indigo-900"
            >
              연간계획공문 (교장 결재)
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => handleQuickTemplate('detail')}
              className="h-7 text-xs px-2.5 bg-white hover:bg-slate-100 border-emerald-200 text-emerald-900 font-semibold"
            >
              세부계획공문 (교감 전결)
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => handleQuickTemplate('dept')}
              className="h-7 text-xs px-2.5 bg-white hover:bg-slate-100 border-amber-200 text-amber-900 font-semibold"
            >
              부서업무공문 (부장 전결)
            </Button>
          </div>
        </div>

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
              {/* 위임전결규정 선택 셀렉트 */}
              {delegationRules.length > 0 && (
                <div className="w-[180px]">
                  <Select 
                    value={selectedDelegationId} 
                    onValueChange={(id) => {
                      const r = delegationRules.find(x => x.id === id);
                      if (r) handleApplyDelegationRule(r);
                    }}
                  >
                    <SelectTrigger className="h-9 bg-background text-xs">
                      <SelectValue placeholder="전결규정 선택..." />
                    </SelectTrigger>
                    <SelectContent>
                      {delegationRules.map(rule => (
                        <SelectItem key={rule.id} value={rule.id} className="text-xs">
                          {rule.subType || rule.mainType} ({rule.finalApprover === 'VP' ? '교감전결' : rule.finalApprover === 'PRINCIPAL' ? '교장결재' : rule.finalApprover === 'GRADE_HEAD' ? '부장전결' : '전결'})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

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
                  // 학생/학부모 계정 원천 제외 (교직원만 결재선 지정 가능)
                  if (u.email !== 'beside1s@kshcm.net' && (u.studentName || u.studentGrade || u.role === '학부모' || u.role === 'student' || u.role === 'parent')) return false;
                  if (/^\d{4}[a-zA-Z]+@kshcm\.net$/i.test(u.email)) return false;
                  if (targetRole === '협조') return true;
                  return u.role === targetRole;
              });

              return (
                <Card key={field.id} className={cn(!form.watch(`approvers.${index}.active`) && 'bg-muted/50')}>
                  <CardHeader className="p-4 flex-row items-center justify-between">
                    <CardTitle className="text-base">{field.role}</CardTitle>
                    <FormField control={form.control} name={`approvers.${index}.active`} render={({field: f}) => (
                      <FormItem className="flex gap-2 items-center space-y-0">
                        <FormControl>
                          <Switch 
                            checked={f.value} 
                            onCheckedChange={(checked) => {
                              f.onChange(checked);
                              const cur = form.getValues(`approvers.${index}`);
                              updateApprover(index, { ...cur, active: checked });
                            }}
                          />
                        </FormControl>
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
                                        const cur = form.getValues(`approvers.${index}`);
                                        updateApprover(index, { ...cur, name: u.name, email: u.email });
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
                          render={({ field: typeField }) => (
                             <Select 
                                value={typeField.value || 'normal'}
                                onValueChange={(val) => {
                                   typeField.onChange(val);
                                   const cur = form.getValues(`approvers.${index}`);
                                   updateApprover(index, { ...cur, type: val as any });
                                }}
                             >
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
                <div className="flex flex-wrap gap-2 min-h-[36px] items-center p-2 rounded-lg bg-slate-50/60 border border-dashed border-slate-200">
                    {circularFields.length === 0 ? (
                        <span className="text-xs text-muted-foreground">지정된 공람자가 없습니다. (필요 시 검색하여 추가)</span>
                    ) : (
                        circularFields.map((field, i) => (
                            <div key={field.id} className="bg-white border shadow-xs px-2.5 py-1 rounded-md flex gap-2 items-center text-xs font-semibold">
                                <span>{field.name} ({field.role})</span>
                                <button type="button" onClick={() => removeCircular(i)} className="hover:text-destructive">
                                    <X className="h-3.5 w-3.5 text-muted-foreground hover:text-destructive"/>
                                </button>
                            </div>
                        ))
                    )}
                </div>
            </CardContent>
            </Card>

            {/* 대면 결재 활성화 시 문서 번호 직접 입력 */}
            {docConfig.enableFaceToFaceApproval && (
              <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl space-y-2">
                <div className="flex items-center gap-2">
                  <FileText className="h-4 w-4 text-amber-700 shrink-0" />
                  <Label htmlFor="faceToFaceDocNo" className="font-bold text-amber-900 text-sm cursor-pointer">
                    문서 번호
                  </Label>
                  <span className="text-xs text-amber-700 font-medium">(대면 결재 시 등록대장 번호를 직접 입력)</span>
                </div>
                <Input
                  id="faceToFaceDocNo"
                  value={faceToFaceDocNo}
                  onChange={(e) => setFaceToFaceDocNo(e.target.value)}
                  placeholder="예: 교무-2026-001"
                  className="h-10 text-sm font-semibold border-amber-300 bg-white focus-visible:ring-amber-400"
                />
              </div>
            )}

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
          render={({ field }) => {
            const isAiDraftEnabled = docConfig?.enableAiDraft !== false;
            return (
              <FormItem>
                <div className="flex justify-between items-center">
                  <FormLabel className="text-lg font-bold">내용</FormLabel>
                  {isAiDraftEnabled ? (
                    <Button 
                      type="button" 
                      onClick={handleGenerateContent} 
                      disabled={isGenerating}
                      className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-xs flex items-center gap-1.5"
                    >
                      {isGenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4 text-amber-300" />}
                      AI로 생성
                    </Button>
                  ) : (
                    <Button 
                      type="button" 
                      disabled 
                      variant="outline" 
                      className="opacity-60 cursor-not-allowed text-xs text-slate-400 border-slate-200 bg-slate-50 flex items-center gap-1"
                      title="시스템 관리자에 의해 AI 초안 생성이 잠겨 있습니다."
                    >
                      <Lock className="w-3.5 h-3.5 text-slate-400" />
                      AI 초안 생성 잠김
                    </Button>
                  )}
                </div>
                <FormControl>
                  <RichEditor value={field.value} onChange={field.onChange} />
                </FormControl>
                <FormMessage />
              </FormItem>
            );
          }}
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

                    {(() => {
                        const watchedAttachments = form.watch('attachments') || [];
                        const listToRender = attachmentFields.length > 0 ? attachmentFields : watchedAttachments;
                        if (listToRender.length === 0) return null;

                        return (
                            <div className="space-y-2 pt-2 border-t border-slate-100">
                                <div className="text-xs font-bold text-slate-700 flex items-center gap-1.5 mb-1">
                                    <span>📎 첨부된 파일 ({listToRender.length}건)</span>
                                </div>
                                {listToRender.map((field: any, index: number) => (
                                    <div key={field.id || index} className="flex items-center justify-between p-2.5 bg-slate-50 border border-slate-200 rounded-lg">
                                        <div className="flex items-center gap-2 flex-1 min-w-0">
                                            <FileIcon className="h-4 w-4 text-indigo-600 shrink-0" />
                                            <span 
                                                className="text-xs font-bold hover:underline cursor-pointer text-indigo-700 truncate"
                                                onClick={() => handleDownloadAttachment(field)}
                                                title="파일 다운로드 받기"
                                            >
                                                {field.name}
                                            </span>
                                            { field.size > 0 && (
                                                <span className="text-[11px] text-slate-400 shrink-0 font-medium">
                                                    ({field.size < 1024 * 1024 
                                                        ? (field.size / 1024).toFixed(1) + ' KB' 
                                                        : (field.size / 1024 / 1024).toFixed(2) + ' MB'
                                                    })
                                                </span>
                                            )}
                                        </div>
                                        <Button 
                                            type="button" 
                                            variant="ghost" 
                                            size="icon" 
                                            className="h-7 w-7 text-slate-400 hover:text-rose-600 hover:bg-rose-50"
                                            onClick={() => {
                                                if (attachmentFields.length > 0) {
                                                    removeAttachment(index);
                                                }
                                                const curr = form.getValues('attachments') || [];
                                                form.setValue('attachments', curr.filter((_, i) => i !== index));
                                            }}
                                        >
                                            <Trash2 className="h-4 w-4" />
                                        </Button>
                                    </div>
                                ))}
                            </div>
                        );
                    })()}
                </div>
            </CardContent>
        </Card>

        {/* 하단 버튼 영역 */}
        <div className={`grid gap-3 ${docConfig.enableFaceToFaceApproval ? 'grid-cols-2' : 'grid-cols-1'}`}>
          <Button
            type="submit"
            disabled={isPending || isUploadingFiles || isFaceToFacePending}
            className="h-12 text-base font-bold"
          >
            {isPending || isUploadingFiles
              ? <Loader2 className="animate-spin" />
              : (isEditMode ? '수정 후 재상신' : '결재 상신')}
          </Button>

          {docConfig.enableFaceToFaceApproval && (
            <Button
              type="button"
              variant="outline"
              disabled={isPending || isUploadingFiles || isFaceToFacePending}
              onClick={form.handleSubmit(
                (data) => handleFaceToFaceSubmit(data),
                onInvalid
              )}
              className="h-12 text-base font-bold border-amber-400 text-amber-800 bg-amber-50 hover:bg-amber-100 hover:text-amber-900"
            >
              {isFaceToFacePending
                ? <Loader2 className="animate-spin" />
                : '대면 결재'}
            </Button>
          )}
        </div>
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