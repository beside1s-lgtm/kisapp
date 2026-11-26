'use client';

import { generateContentAction } from '@/app/ai-actions';
import { useAuth } from '@/hooks/use-auth';
import { ApprovalDoc, ApprovalDocPayload, Approver, DocConfig, UserProfile, DelegationRule, OrgStructure, GoogleDriveConfig } from '@/lib/types';
import { useForm, useFieldArray, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useMemo, useRef, useState, useTransition } from 'react';
import { File as FileIcon, Loader2, Plus, Sparkles, User as UserIcon, X, Paperclip, Trash2, Settings2, FolderOpen, Lock, FileText, CheckCircle2 } from 'lucide-react';
import { getTeacherApplySettings, defaultTeacherApplySettings, getOrgStructure, getDelegationRules, getGoogleDriveConfig } from '@/lib/services/settingsService';
import { useToast } from '@/hooks/use-toast';
import { Input } from './ui/input';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Label } from './ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Switch } from './ui/switch';
import {
  resolveTeacherFilingDutiesList,
  syncCompletedApprovalToHandoverTimeline,
  CURRENT_SCHOOL_YEAR,
} from '@/lib/services/handoverService';
import {
  resolveDriveFoldersForDuties,
  listDriveFilingFolderOptions,
  resolveDefaultFilingFolderOption,
  inferHandoverCategoryFromTarget,
  type DriveFilingFolderOption,
} from '@/lib/drive/deptFolderMapping';
import { format } from 'date-fns';
import UserSearch from './user-search';
import { cn } from '@/lib/utils';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from './ui/form';
import { RadioGroup, RadioGroupItem } from './ui/radio-group';
import RichEditor from "./rich-editor";
import { getDb } from '@/lib/firebase';
import { doc, getDoc, getDocs, collection, runTransaction, serverTimestamp, setDoc, updateDoc, addDoc, query, where, deleteDoc, limit } from 'firebase/firestore';
import { computeSettlement, termFromSettingsAndDocConfig, termPeriodLabel } from '@/lib/afterschool/settlement';
import { DEFAULT_ACADEMIC_CALENDAR_CONFIG as AS_DEFAULT_CALENDAR } from '@/lib/services/academicCalendarService';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { sendMailNotification, getDocumentById, archiveAndSyncCompletedApprovalDoc } from '@/lib/services/documentService';
import { generateAfterschoolSettlementWorkbook } from '@/lib/afterschool/excel';
import { getRealtimeSemesterInfo } from '@/lib/services/academicCalendarService';
import { PresetManagementDialog } from './document-form/PresetManagementDialog';
import { MobileCirculationDialog } from './document-form/MobileCirculationDialog';
import { DriveFilingHandoverCard } from './document-form/DriveFilingHandoverCard';
import { StandardTemplateBanner } from './document-form/StandardTemplateBanner';
import {
  loadStandardDocTemplateOverride,
  saveStandardDocTemplateOverride,
  resetStandardDocTemplateOverride,
} from '@/lib/services/standardDocTemplateService';
import {
  resolveAssignedCustomDuties,
  getCustomDutyWorkspaceId,
  upsertCustomDutyStandardDoc,
} from '@/lib/services/customDutyService';

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
  docType: z.enum(['internal', 'external', 'parent', 'teacher-duty', 'teacher-overtime', 'teacher-afterschool', 'volunteer']).optional().default('internal'),
  receiverName: z.string().optional().default(''),
  receiverEmail: z.string().optional().default(''),
  addToHandover: z.boolean().optional().default(false),
  handoverCategory: z.string().optional().default('일반업무'),
  driveTargetFolderId: z.string().optional().default(''),
  driveTargetFolderUrl: z.string().optional().default(''),
  driveTargetFolderLabel: z.string().optional().default(''),
  driveTargetDeptName: z.string().optional().default(''),
  driveTargetTaskName: z.string().optional().default(''),
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
  const [orgStructure, setOrgStructure] = useState<Partial<OrgStructure> | null>(null);
  const [docConfig, setDocConfig] = useState<DocConfig>({});
  const [driveConfig, setDriveConfig] = useState<GoogleDriveConfig | null>(null);
  const [selectedFilingValue, setSelectedFilingValue] = useState<string>('');
  const [loadedSavedFiling, setLoadedSavedFiling] = useState<{
    folderId?: string;
    deptName?: string;
    taskName?: string;
  } | null>(null);
  const userEditedFilingRef = useRef<boolean>(false);
  
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
  const [isMobileCircularDialogOpen, setIsMobileCircularDialogOpen] = useState(false);
  
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

  // 표준 기안문서 기본값 설정/저장 상태
  const [activeTemplateKey, setActiveTemplateKey] = useState<string | null>(() => searchParams.get('templateKey'));
  const [activeTemplateName, setActiveTemplateName] = useState<string>('');
  const [hasCustomOverride, setHasCustomOverride] = useState<boolean>(false);
  const [isSavingTemplateDefault, setIsSavingTemplateDefault] = useState<boolean>(false);
  const [isResettingTemplateDefault, setIsResettingTemplateDefault] = useState<boolean>(false);
  const [afterschoolRebuildTick, setAfterschoolRebuildTick] = useState<number>(0);
  const afterschoolOverrideLockedRef = useRef<boolean>(false);

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      title: '', content: '',
      approvers: defaultApproversTemplate.map(ap => ({...ap, active: ap.role !== '협조'})),
      circulars: [], attachments: [], publishStatus: '공개', docType: 'internal',
      addToHandover: false, handoverCategory: '일반업무',
      driveTargetFolderId: '', driveTargetFolderUrl: '', driveTargetFolderLabel: '',
      driveTargetDeptName: '', driveTargetTaskName: '',
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

  const handleQuickTemplate = async (type: 'annual' | 'detail' | 'dept' | 'general') => {
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

    const quickKey = `quick_${type}`;
    setActiveTemplateKey(quickKey);
    setActiveTemplateName(targetRuleName);

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

    try {
      const override = await loadStandardDocTemplateOverride(quickKey);
      if (override) {
        setHasCustomOverride(true);
        if (override.title) form.setValue('title', override.title, { shouldDirty: true });
        if (override.content) form.setValue('content', override.content, { shouldDirty: true });
        if (override.includeAttachments && Array.isArray(override.attachments)) {
          const normalizedAtts = override.attachments.map(a => ({ name: a.name, data: a.data, size: a.size ?? 0 }));
          form.setValue('attachments', normalizedAtts);
          replaceAttachments(normalizedAtts);
        }
        toast({
          title: '저장된 표준 기본값 불러오기 완료',
          description: `[${targetRuleName}] 수정 기본값이 본문에 적용되었습니다.`,
        });
      } else {
        setHasCustomOverride(false);
      }
    } catch {
      setHasCustomOverride(false);
    }
  };

  useEffect(() => {
    const fetchBasics = async () => {
        try {
            const usersSnap = await getDocs(collection(getDb(), 'users'));
            const userList = usersSnap.docs.map(d => ({ email: d.id, ...d.data() } as UserProfile));

            // 조직도 설정에서 학교장/행정실장 임의 입력 성명 조회 및 가상 프로필 연동
            try {
                const org = await getOrgStructure();
                setOrgStructure(org);
                const virtualUsers: UserProfile[] = [];
                if (org?.principalName?.trim()) {
                    const existingP = userList.find(u => u.email && org.principal && u.email.toLowerCase() === org.principal.toLowerCase());
                    if (!existingP) {
                        virtualUsers.push({
                            uid: 'leadership_principal',
                            name: org.principalName.trim(),
                            email: org.principal || '',
                            role: '교장' as any,
                        });
                    } else if (org.principalName.trim()) {
                        existingP.name = org.principalName.trim();
                    }
                }
                if (org?.administrativeHeadName?.trim()) {
                    const existingA = userList.find(u => u.email && org.administrativeHead && u.email.toLowerCase() === org.administrativeHead.toLowerCase());
                    if (!existingA) {
                        virtualUsers.push({
                            uid: 'leadership_admin_head',
                            name: org.administrativeHeadName.trim(),
                            email: org.administrativeHead || '',
                            role: '행정실장' as any,
                        });
                    } else if (org.administrativeHeadName.trim()) {
                        existingA.name = org.administrativeHeadName.trim();
                    }
                }
                setUsers([...userList, ...virtualUsers]);
            } catch (orgErr) {
                console.warn("Org structure fetch skipped in fetchBasics:", orgErr);
                setUsers(userList);
            }

            const configSnap = await getDoc(doc(getDb(), 'settings', 'docConfig'));
            if (configSnap.exists()) {
                setDocConfig(configSnap.data() as DocConfig);
            }

            // Google Drive 문서함 설정 불러오기
            getGoogleDriveConfig().then(cfg => {
              if (cfg) setDriveConfig(cfg);
            }).catch(() => {});

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

            const principalName = org?.principalName?.trim() || principalUser?.name || (org?.principal && !org.principal.includes('@') ? org.principal : '') || '교장';
            const principalEmail = principalUser?.email || (org?.principal?.includes('@') ? org.principal : '');

            const vicePrincipalUser = org?.vicePrincipal 
                ? userList.find(u => u.email?.trim().toLowerCase() === org.vicePrincipal?.trim().toLowerCase() || u.name?.trim() === org.vicePrincipal?.trim()) 
                : userList.find(u => u.role === 'vicePrincipal' || u.role === '교감');

            const vicePrincipalName = org?.vicePrincipalName?.trim() || vicePrincipalUser?.name || (org?.vicePrincipal && !org.vicePrincipal.includes('@') ? org.vicePrincipal : '') || '교감';
            const vicePrincipalEmail = vicePrincipalUser?.email || (org?.vicePrincipal?.includes('@') ? org.vicePrincipal : '');
            
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
                    name: vicePrincipalName,
                    email: vicePrincipalEmail,
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
                    name: principalName,
                    email: principalEmail,
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
        const safetyTemplate = searchParams.get('safetyTemplate');
        const customTemplate = searchParams.get('customTemplate');
        const templateKeyParam = searchParams.get('templateKey');
        if (
            busTemplate === 'true' ||
            peTemplate === 'true' ||
            safetyTemplate === 'true' ||
            customTemplate === 'true' ||
            Boolean(templateKeyParam)
        ) {
            const draftJson = sessionStorage.getItem('pending_doc_draft');
            if (draftJson) {
                try {
                    const draft = JSON.parse(draftJson);
                    sessionStorage.removeItem('pending_doc_draft');
                    const resolvedKey: string | null = draft.templateKey || templateKeyParam || null;
                    let finalTitle = draft.title || '';
                    let finalContent = draft.content || '';
                    let initialAttachments = draft.attachments || [];
                    let loadedOverride = false;

                    if (resolvedKey) {
                        setActiveTemplateKey(resolvedKey);
                        const override = await loadStandardDocTemplateOverride(resolvedKey);
                        if (override) {
                            loadedOverride = true;
                            finalTitle = override.title || finalTitle;
                            finalContent = override.content || finalContent;
                            if (override.includeAttachments) {
                                initialAttachments = (override.attachments || []).map(a => ({ name: a.name, data: a.data, size: a.size ?? 0 }));
                            }
                            setActiveTemplateName(override.templateName || draft.templateName || '');
                        } else if (draft.templateName) {
                            setActiveTemplateName(draft.templateName);
                        }
                        setHasCustomOverride(loadedOverride);
                    }

                    if (draft.driveTargetFolderId || (draft.driveTargetDeptName && draft.driveTargetTaskName)) {
                        setLoadedSavedFiling({
                            folderId: draft.driveTargetFolderId || '',
                            deptName: draft.driveTargetDeptName || '',
                            taskName: draft.driveTargetTaskName || '',
                        });
                    }
                    form.reset({
                        title: finalTitle,
                        content: finalContent,
                        publishStatus: '공개',
                        docType: 'internal',
                        receiverName: '',
                        receiverEmail: '',
                        circulars: [],
                        attachments: initialAttachments,
                        approvers: dynamicDefaultApprovers,
                        addToHandover: draft.addToHandover ?? false,
                        handoverCategory: draft.handoverCategory || draft.dutyName || form.getValues('handoverCategory') || '일반업무',
                        driveTargetFolderId: draft.driveTargetFolderId || form.getValues('driveTargetFolderId') || '',
                        driveTargetFolderUrl: draft.driveTargetFolderUrl || form.getValues('driveTargetFolderUrl') || '',
                        driveTargetFolderLabel: draft.driveTargetFolderLabel || form.getValues('driveTargetFolderLabel') || '',
                        driveTargetDeptName: draft.driveTargetDeptName || form.getValues('driveTargetDeptName') || '',
                        driveTargetTaskName: draft.driveTargetTaskName || form.getValues('driveTargetTaskName') || '',
                    });
                    replaceApprovers(dynamicDefaultApprovers);
                    replaceAttachments(initialAttachments);
                    const templateName =
                        peTemplate === 'true'
                            ? '체육 행사'
                            : safetyTemplate === 'true'
                              ? '학생 안전교육'
                              : customTemplate === 'true'
                                ? (draft.dutyName || '커스텀 업무')
                                : '스쿨버스';
                    toast({
                        title: `${templateName} 기안 불러오기 완료`,
                        description: loadedOverride
                            ? `[${finalTitle}] 저장된 사용자 기본 서식이 적용되었습니다.`
                            : `[${finalTitle}] 양식 및 첨부파일(${initialAttachments.length}건)이 탑재되었습니다.`,
                    });
                    return;
                } catch (err) {
                    console.error("Draft Parse Error:", err);
                }
            }
        }

        const afterschoolMode = searchParams.get('afterschoolMode');
        if (afterschoolMode === 'plan' || afterschoolMode === 'result') {
            const asKey = afterschoolMode === 'plan' ? 'afterschool_plan' : 'afterschool_result';
            setActiveTemplateKey(asKey);
            const override = await loadStandardDocTemplateOverride(asKey);
            const hasOverride = Boolean(override);
            if (hasOverride) {
                afterschoolOverrideLockedRef.current = true;
            }
            setHasCustomOverride(hasOverride);
            const asAttachments = hasOverride && override?.includeAttachments
                ? (override.attachments || []).map(a => ({ name: a.name, data: a.data, size: a.size ?? 0 }))
                : [];

            form.reset({
                title:
                    override?.title ||
                    (afterschoolMode === 'plan'
                        ? '[계획] 방과후학교 운영 계획 승인의 건'
                        : '[결과] 방과후학교 운영 결과 보고 및 수당 지급 청구의 건'),
                content: override?.content || '<p>데이터 로딩 중...</p>',
                publishStatus: '공개',
                docType: 'teacher-afterschool',
                receiverName: '',
                receiverEmail: '',
                circulars: [],
                attachments: asAttachments,
                approvers: dynamicDefaultApprovers,
                addToHandover: false,
                handoverCategory: form.getValues('handoverCategory') || '방과후학교',
                driveTargetFolderId: form.getValues('driveTargetFolderId') || '',
                driveTargetFolderUrl: form.getValues('driveTargetFolderUrl') || '',
                driveTargetFolderLabel: form.getValues('driveTargetFolderLabel') || '',
                driveTargetDeptName: form.getValues('driveTargetDeptName') || '',
                driveTargetTaskName: form.getValues('driveTargetTaskName') || '',
            });
            replaceApprovers(dynamicDefaultApprovers);
            if (asAttachments.length > 0) {
                replaceAttachments(asAttachments);
            }
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
            if (targetData.driveTargetFolderId || (targetData.driveTargetDeptName && targetData.driveTargetTaskName)) {
                setLoadedSavedFiling({
                    folderId: targetData.driveTargetFolderId || '',
                    deptName: targetData.driveTargetDeptName || '',
                    taskName: targetData.driveTargetTaskName || '',
                });
            }
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
                addToHandover: targetData.addToHandover ?? false,
                handoverCategory: targetData.handoverCategory || form.getValues('handoverCategory') || '일반업무',
                driveTargetFolderId: targetData.driveTargetFolderId || form.getValues('driveTargetFolderId') || '',
                driveTargetFolderUrl: targetData.driveTargetFolderUrl || form.getValues('driveTargetFolderUrl') || '',
                driveTargetFolderLabel: targetData.driveTargetFolderLabel || form.getValues('driveTargetFolderLabel') || '',
                driveTargetDeptName: targetData.driveTargetDeptName || form.getValues('driveTargetDeptName') || '',
                driveTargetTaskName: targetData.driveTargetTaskName || form.getValues('driveTargetTaskName') || '',
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

  // 로그인한 사용자의 담당 업무 기준 Google Drive 저장 문서함(편철) 목록 및 기본 선택 계산
  const teacherDeptName = useMemo(() => {
    if (myDepartments.length > 0 && myDepartments[0]?.name) {
      return myDepartments[0].name;
    }
    return profile?.dept || '';
  }, [myDepartments, profile?.dept]);

  const myAssignedFilingDuties = useMemo(() => {
    if (!profile?.email || !orgStructure) return [];
    return resolveTeacherFilingDutiesList(profile.email, orgStructure, teacherDeptName);
  }, [profile?.email, orgStructure, teacherDeptName]);

  const myMatchedDriveFolders = useMemo(() => {
    if (!driveConfig || myAssignedFilingDuties.length === 0) return [];
    return resolveDriveFoldersForDuties(
      myAssignedFilingDuties,
      driveConfig,
      CURRENT_SCHOOL_YEAR,
      teacherDeptName,
      orgStructure
    );
  }, [myAssignedFilingDuties, driveConfig, teacherDeptName, orgStructure]);

  const filingOptions = useMemo(
    () => listDriveFilingFolderOptions(driveConfig, orgStructure, CURRENT_SCHOOL_YEAR, myMatchedDriveFolders),
    [driveConfig, orgStructure, myMatchedDriveFolders]
  );

  const selectedFilingOption = useMemo(
    () => filingOptions.find(o => o.value === selectedFilingValue) || null,
    [filingOptions, selectedFilingValue]
  );

  const applySelectedFilingOption = (opt: DriveFilingFolderOption | null) => {
    if (!opt) return;
    setSelectedFilingValue(opt.value);
    form.setValue('driveTargetFolderId', opt.folderId || '');
    form.setValue('driveTargetFolderUrl', opt.folderUrl || '');
    form.setValue('driveTargetFolderLabel', opt.label || '');
    form.setValue('driveTargetDeptName', opt.deptName || '');
    form.setValue('driveTargetTaskName', opt.folderName || '');
    form.setValue(
      'handoverCategory',
      inferHandoverCategoryFromTarget(opt.deptName, opt.folderName, myAssignedFilingDuties)
    );
  };

  useEffect(() => {
    if (userEditedFilingRef.current) return;
    if (filingOptions.length === 0) return;

    const defaultOpt = resolveDefaultFilingFolderOption(filingOptions, {
      myMatchedFolders: myMatchedDriveFolders,
      teacherDeptName,
      busTemplate: searchParams.get('busTemplate') === 'true',
      peTemplate: searchParams.get('peTemplate') === 'true',
      afterschoolMode: searchParams.get('afterschoolMode'),
      savedFolderId: loadedSavedFiling?.folderId || docToEdit?.driveTargetFolderId || '',
      savedDeptName: loadedSavedFiling?.deptName || docToEdit?.driveTargetDeptName || '',
      savedTaskName: loadedSavedFiling?.taskName || docToEdit?.driveTargetTaskName || '',
    });

    if (defaultOpt) {
      applySelectedFilingOption(defaultOpt);
    }
  }, [
    filingOptions,
    myMatchedDriveFolders,
    teacherDeptName,
    searchParams,
    loadedSavedFiling,
    docToEdit?.driveTargetFolderId,
    docToEdit?.driveTargetDeptName,
    docToEdit?.driveTargetTaskName,
  ]);

  // 방과후 기안 본문 및 제목 실시간 동적 생성
  useEffect(() => {
        const afterschoolMode = searchParams.get('afterschoolMode');
        if (!afterschoolMode) return;
        if (afterschoolOverrideLockedRef.current) return;

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
            // 정산 기준: [실시간 제어실 › 강사 신청 제어]의 운영 기간 + 학사일정 휴업일, 실제 수업한 차시, 강사별 출근 차시
            const term = termFromSettingsAndDocConfig(targetSettings, docConfig, AS_DEFAULT_CALENDAR.events || []);
            const activeCourses = afterschoolCourses.filter(c => c.status === 'OPEN' || c.status === 'CLOSED');
            const settle = computeSettlement(activeCourses, afterschoolAttendance as any, afterschoolSubstitutes as any, afterschoolApprovalDocs as any, term);
            const cur = term.currency || 'VND';
            const approvedCount = settle.courses.filter(r => r.evidence === '교감 결재 완료').length;
            const inProgressCount = settle.courses.filter(r => r.evidence === '결재 진행 중').length;
            const unsubmittedCount = settle.courses.filter(r => r.evidence === '미제출').length;
            const absentEvents = settle.substituteEvents.filter(e => e.conducted);
            const xlsxName = `${selectedYear}-${selectedSemester}_방과후학교_출석부_및_강사출근부_취합본.xlsx`;

            const resultContent = `
<p><strong>1. 관련</strong>: ${relatedDocText}</p>
<p><strong>2. 보고</strong>: ${semesterFull} 방과후학교 운영(운영 기간 ${termPeriodLabel(term)})이 종료됨에 따라, 다음과 같이 강좌별 운영 결과와 출석부·강사출근부 내역을 보고하고 강사료 지급을 청구합니다.</p>
<br/>
<p><strong>가. 운영 결과 및 증빙서류 현황</strong></p>
<p>① 운영 기간: ${termPeriodLabel(term)} (강좌별 요일·휴업일 반영)</p>
<p>② 운영 강좌 수: ${settle.totals.courses}개 강좌 / 총 수강 학생 수: ${settle.totals.students}명</p>
<p>③ 실제 수업 차시: 누적 ${settle.totals.conductedSessions}차시</p>
<p>④ 증빙서류(출석부·강사출근부) 교감 결재 완료: <strong>${approvedCount}개 강좌</strong>${inProgressCount ? ` / 결재 진행 중: ${inProgressCount}개 강좌` : ''}${unsubmittedCount ? ` / 미제출: ${unsubmittedCount}개 강좌` : ''}</p>
<br/>
<p><strong>나. 강사료 정산 및 청구 내역</strong></p>
<p>① 지급 대상 강사: ${settle.totals.instructors}명 (공동 강사는 각자 출근한 차시 기준)</p>
<p>② 총 지급 차시: ${settle.totals.paidSessions}차시 (결근 차시 제외, 대강 차시는 대강 강사에게 지급)${absentEvents.length ? ` — 결근·대강 ${absentEvents.length}건` : ''}</p>
<p>③ 총 강사료 청구액: <strong>${settle.totals.amount.toLocaleString()} ${cur}</strong> (산정 기준: 강사별 지급 차시 × ${term.feeType} ${term.fee.toLocaleString()} ${cur})</p>
<p>④ 강사별 지급액: 붙임 1의 [강사별_강사료정산표] 참조</p>
<br/>
<p><strong>다. 붙임</strong></p>
<p>1. ${xlsxName} 1부 (강사별 강사료 정산표, 강좌별 운영 현황, 결근·대강 내역, 출석부·강사출근부 취합본)</p>
<p>2. 별첨: 방과후 강사료 증빙서류(출석부·강사출근부, 교감 결재 완료) ${approvedCount}개 강좌 1부. 끝.</p>
            `.trim();

            form.setValue('title', formattedTitle);
            form.setValue('content', resultContent);
            form.setValue('attachments', [
                {
                    name: xlsxName,
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
        teacherApplySettings,
        afterschoolRebuildTick,
        docConfig,
        afterschoolSubstitutes
    ]);

  const myAssignedCustomDuties = useMemo(
    () => resolveAssignedCustomDuties(profile?.email, orgStructure, profile),
    [profile, orgStructure]
  );

  const handleSaveTemplateAsDefault = async (
    includeAttachments: boolean,
    targetOverride?: { templateKey?: string; customDutyName?: string }
  ) => {
    const titleVal = form.getValues('title')?.trim();
    const contentVal = form.getValues('content')?.trim();
    const attsVal = form.getValues('attachments') || [];
    const docTypeVal = form.getValues('docType');

    if (!titleVal || !contentVal) {
      toast({
        variant: 'destructive',
        title: '입력 필요',
        description: '기본값으로 저장할 제목과 본문 내용을 먼저 입력하세요.',
      });
      return;
    }

    setIsSavingTemplateDefault(true);
    try {
      const actorEmail = profile?.email || 'unknown';
      const actorName = profile?.name || actorEmail;
      let targetKey = targetOverride?.templateKey || activeTemplateKey;
      let templateName = activeTemplateName;
      let dutyName: string | undefined;

      if (targetOverride?.customDutyName) {
        dutyName = targetOverride.customDutyName;
        const wsId = getCustomDutyWorkspaceId(dutyName);
        const docId = `std_${Date.now()}`;
        targetKey = `custom_duty__${wsId}__${docId}`;
        templateName = `${dutyName} - ${titleVal}`;
        await upsertCustomDutyStandardDoc(
          dutyName,
          {
            id: docId,
            templateKey: targetKey,
            title: titleVal,
            description: '기안 작성기에서 기본값으로 저장된 표준 문서',
            content: contentVal,
            docType: docTypeVal === 'external' ? 'external' : 'internal',
            attachments: includeAttachments ? attsVal : [],
            isDefault: true,
            updatedAt: new Date().toISOString(),
            updatedBy: actorEmail,
            updatedByName: actorName,
          },
          orgStructure
        );
      }

      if (!targetKey) {
        toast({
          variant: 'destructive',
          title: '저장 대상 필요',
          description: '저장할 업무 또는 표준 서식 대상을 선택하세요.',
        });
        return;
      }

      const saved = await saveStandardDocTemplateOverride({
        templateKey: targetKey,
        templateName,
        dutyName,
        title: titleVal,
        content: contentVal,
        docType: docTypeVal as any,
        includeAttachments,
        attachments: attsVal,
        updatedBy: actorEmail,
        updatedByName: actorName,
      });

      setActiveTemplateKey(targetKey);
      setActiveTemplateName(saved.templateName);
      setHasCustomOverride(true);
      if (targetKey === 'afterschool_plan' || targetKey === 'afterschool_result') {
        afterschoolOverrideLockedRef.current = true;
      }

      toast({
        title: '표준 기안문서 기본값 저장 완료',
        description: `[${saved.templateName}] 서식이 수정된 상태로 저장되어 다음 업무 실행 시 기본으로 적용됩니다.`,
      });
    } catch (err: any) {
      console.error('Save template default error:', err);
      toast({
        variant: 'destructive',
        title: '기본값 저장 실패',
        description: err?.message || '표준 서식 저장 중 오류가 발생했습니다.',
      });
    } finally {
      setIsSavingTemplateDefault(false);
    }
  };

  const handleResetTemplateDefault = async () => {
    if (!activeTemplateKey) return;
    if (!window.confirm('수정된 기본 서식을 삭제하고 시스템 초기 양식으로 되돌리시겠습니까?')) {
      return;
    }

    setIsResettingTemplateDefault(true);
    try {
      await resetStandardDocTemplateOverride(activeTemplateKey);
      setHasCustomOverride(false);
      if (activeTemplateKey === 'afterschool_plan' || activeTemplateKey === 'afterschool_result') {
        afterschoolOverrideLockedRef.current = false;
        setAfterschoolRebuildTick((c) => c + 1);
      }
      toast({
        title: '초기 서식 복원 완료',
        description: '사용자 수정 기본값이 초기화되었습니다. 다음 열기부터 시스템 초기 양식이 적용됩니다.',
      });
    } catch (err: any) {
      toast({
        variant: 'destructive',
        title: '초기화 실패',
        description: err?.message || '초기화 중 오류가 발생했습니다.',
      });
    } finally {
      setIsResettingTemplateDefault(false);
    }
  };

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
          afterschoolSubstitutes,
          termFromSettingsAndDocConfig(teacherApplySettings, docConfig, AS_DEFAULT_CALENDAR.events || [])
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
             },
             addToHandover: !!data.addToHandover,
             handoverCategory:
               data.handoverCategory ||
               inferHandoverCategoryFromTarget(
                 data.driveTargetDeptName || selectedFilingOption?.deptName,
                 data.driveTargetTaskName || selectedFilingOption?.folderName,
                 myAssignedFilingDuties
               ),
             driveTargetFolderId: data.driveTargetFolderId || selectedFilingOption?.folderId || '',
             driveTargetFolderUrl: data.driveTargetFolderUrl || selectedFilingOption?.folderUrl || '',
             driveTargetFolderLabel: data.driveTargetFolderLabel || selectedFilingOption?.label || '',
             driveTargetDeptName: data.driveTargetDeptName || selectedFilingOption?.deptName || '',
             driveTargetTaskName: data.driveTargetTaskName || selectedFilingOption?.folderName || '',
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

             const activeFilingOpt =
               filingOptions.find(o => o.value === selectedFilingValue) || selectedFilingOption;
             const newDocRef = doc(collection(getDb(), 'approvals'));
             const nowIso = new Date().toISOString();

             const baseFaceToFacePayload: any = {
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
                 addToHandover: !!data.addToHandover,
                 handoverCategory:
                   data.handoverCategory ||
                   inferHandoverCategoryFromTarget(
                     data.driveTargetDeptName || activeFilingOpt?.deptName,
                     data.driveTargetTaskName || activeFilingOpt?.folderName,
                     myAssignedFilingDuties
                   ),
                 driveTargetFolderId: data.driveTargetFolderId || activeFilingOpt?.folderId || '',
                 driveTargetFolderUrl: data.driveTargetFolderUrl || activeFilingOpt?.folderUrl || '',
                 driveTargetFolderLabel: data.driveTargetFolderLabel || activeFilingOpt?.label || '',
                 driveTargetDeptName: data.driveTargetDeptName || activeFilingOpt?.deptName || '',
                 driveTargetTaskName: data.driveTargetTaskName || activeFilingOpt?.folderName || '',
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
             };

             // 대면 결재는 즉시 승인 완료 상태이므로 선택한 편철 문서함(Google Drive) 아카이빙 실행
             const archiveRes = await archiveAndSyncCompletedApprovalDoc(
               newDocRef.id,
               { ...baseFaceToFacePayload, id: newDocRef.id, createdAt: nowIso, completedAt: nowIso },
               { skipApprovalsDocUpdate: true, skipHandoverSync: true, docConfigOverride: docConfig }
             );

             const finalFaceToFaceDoc: any = {
                 ...baseFaceToFacePayload,
                 ...(archiveRes.archivedFileId
                   ? {
                       driveArchived: true,
                       driveFileId: archiveRes.archivedFileId,
                       driveFileUrl: archiveRes.archivedFileUrl || '',
                       archivedAt: serverTimestamp(),
                     }
                   : {}),
                 ...(archiveRes.archivedFolderUrl && !baseFaceToFacePayload.driveTargetFolderUrl
                   ? { driveTargetFolderUrl: archiveRes.archivedFolderUrl }
                   : {}),
                 createdAt: serverTimestamp(),
                 completedAt: serverTimestamp(),
             };

             await setDoc(newDocRef, finalFaceToFaceDoc);

             if (baseFaceToFacePayload.addToHandover && profile.email) {
                 await syncCompletedApprovalToHandoverTimeline(newDocRef.id, {
                   ...baseFaceToFacePayload,
                   id: newDocRef.id,
                   driveFileUrl: archiveRes.archivedFileUrl || '',
                   driveTargetFolderUrl: archiveRes.archivedFolderUrl || baseFaceToFacePayload.driveTargetFolderUrl || '',
                   createdAt: nowIso,
                   completedAt: nowIso,
                 }).catch(e => console.warn('[HandoverTimeline] 대면 결재 타임라인 동기화 오류:', e));
             }

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
        
        {/* 전결규정 빠른 템플릿 선택 바 (모바일 1줄 3개 / 데스크톱 4개 분리) */}
        <div className="flex sm:hidden items-center gap-1.5 p-2 bg-slate-50 border border-slate-200 rounded-xl">
          <div className="grid grid-cols-3 gap-1.5 w-full">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => handleQuickTemplate('general')}
              className="h-7 text-xs px-1 bg-white hover:bg-slate-100 border-indigo-200 text-indigo-900 font-bold"
            >
              교장 결재
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => handleQuickTemplate('detail')}
              className="h-7 text-xs px-1 bg-white hover:bg-slate-100 border-emerald-200 text-emerald-900 font-bold"
            >
              교감 전결
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => handleQuickTemplate('dept')}
              className="h-7 text-xs px-1 bg-white hover:bg-slate-100 border-amber-200 text-amber-900 font-bold"
            >
              부장 전결
            </Button>
          </div>
        </div>

        <div className="hidden sm:flex flex-wrap items-center gap-2 p-3 bg-slate-50 border border-slate-200 rounded-xl">
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

        {/* 표준 기안문서 기본값 설정/저장 바 */}
        <StandardTemplateBanner
          activeTemplateKey={activeTemplateKey}
          activeTemplateName={activeTemplateName}
          hasCustomOverride={hasCustomOverride}
          isSaving={isSavingTemplateDefault}
          isResetting={isResettingTemplateDefault}
          afterschoolMode={searchParams.get('afterschoolMode')}
          customDuties={myAssignedCustomDuties}
          onSaveAsDefault={handleSaveTemplateAsDefault}
          onResetDefault={handleResetTemplateDefault}
          onRebuildAfterschoolLive={() => {
            afterschoolOverrideLockedRef.current = false;
            setAfterschoolRebuildTick((c) => c + 1);
            toast({
              title: '최신 강좌 데이터 반영',
              description: '현재 개설 강좌 및 정산 데이터 기준으로 본문이 다시 생성되었습니다.',
            });
          }}
        />

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
          <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4 p-3 sm:p-6 pb-3 sm:pb-4 border-b">
            <div className="flex items-center gap-2">
              <FolderOpen className="h-4 w-4 sm:h-5 sm:w-5 text-primary" />
              <CardTitle className="text-base sm:text-lg">결재선 지정</CardTitle>
            </div>
            <div className="grid grid-cols-3 gap-1.5 w-full sm:flex sm:flex-wrap sm:items-center sm:gap-2 sm:w-auto">
              {/* 위임전결규정 선택 셀렉트 */}
              {delegationRules.length > 0 ? (
                <div className="w-full sm:w-[180px]">
                  <Select 
                    value={selectedDelegationId} 
                    onValueChange={(id) => {
                      const r = delegationRules.find(x => x.id === id);
                      if (r) handleApplyDelegationRule(r);
                    }}
                  >
                    <SelectTrigger className="h-8 sm:h-9 bg-background text-[11px] sm:text-xs px-1.5 sm:px-3 truncate">
                      <SelectValue placeholder="전결규정" />
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
              ) : <div className="hidden sm:block" />}

              {/* 프리셋 선택 셀렉트 */}
              <div className="w-full sm:w-[200px]">
                <Select value={selectedPresetId} onValueChange={handleApplyPreset}>
                  <SelectTrigger className="h-8 sm:h-9 bg-background text-[11px] sm:text-xs px-1.5 sm:px-3 truncate">
                    <SelectValue placeholder="프리셋" />
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
                className="h-8 sm:h-9 text-[11px] sm:text-xs px-1.5 sm:px-3 gap-1 shrink-0 w-full sm:w-auto"
              >
                <Settings2 className="h-3.5 w-3.5 sm:h-4 sm:w-4 shrink-0" />
                <span className="sm:hidden">관리</span>
                <span className="hidden sm:inline">프리셋 관리</span>
              </Button>
            </div>
          </CardHeader>
          {/* 모바일 전용: 부장, 교감, 협조, 교장, 공람 5칸 한 줄 결재선 직인 박스 */}
          <div className="block sm:hidden p-2">
            <div className="grid grid-cols-5 gap-1 border border-slate-200 rounded-xl bg-slate-50/50 p-1">
              {approverFields.map((field, index) => {
                const targetRole = field.role;
                const isActive = form.watch(`approvers.${index}.active`);
                const approverName = form.watch(`approvers.${index}.name`) || '';
                const approverType = form.watch(`approvers.${index}.type`) || 'normal';
                const filteredUsers = users.filter(u => {
                  if (u.email !== 'beside1s@kshcm.net' && (u.studentName || u.studentGrade || u.role === '학부모' || u.role === 'student' || u.role === 'parent')) return false;
                  if (/^\d{4}[a-zA-Z]+@kshcm\.net$/i.test(u.email)) return false;
                  if (targetRole === '협조') return true;
                  return u.role === targetRole;
                });

                return (
                  <div 
                    key={field.id}
                    className={cn(
                      "flex flex-col justify-between rounded-lg border p-1 text-center min-h-[92px] transition-all",
                      isActive ? "bg-white border-indigo-200 shadow-2xs" : "bg-slate-100/70 border-slate-200 opacity-60"
                    )}
                  >
                    {/* 상단: 직책 + 온/오프 체크박스 */}
                    <div className="flex items-center justify-between gap-0.5 border-b border-slate-100 pb-1">
                      <span className="text-[11px] font-black text-slate-800 truncate">
                        {targetRole === '협조' ? (field.role === '행정실장' ? '행정' : '협조') : targetRole}
                      </span>
                      <input 
                        type="checkbox"
                        checked={isActive}
                        onChange={(e) => {
                          const checked = e.target.checked;
                          form.setValue(`approvers.${index}.active`, checked, { shouldDirty: true });
                          const cur = form.getValues(`approvers.${index}`);
                          updateApprover(index, { ...cur, active: checked });
                        }}
                        className="w-3 h-3 accent-indigo-600 rounded cursor-pointer shrink-0"
                        title={isActive ? "결재선 포함" : "결재선 제외"}
                      />
                    </div>

                    {/* 중앙: 결재자 이름 셀렉트 */}
                    <div className="py-1 min-w-0 flex-1 flex flex-col justify-center items-center">
                      {isActive ? (
                        <Select
                          value={approverName || undefined}
                          onValueChange={(val) => {
                            const selected = filteredUsers.find(u => u.name === val || u.email === val);
                            const nameToSet = selected?.name || val;
                            const emailToSet = selected?.email || '';
                            form.setValue(`approvers.${index}.name`, nameToSet, { shouldValidate: true, shouldDirty: true });
                            form.setValue(`approvers.${index}.email`, emailToSet, { shouldValidate: true, shouldDirty: true });
                            const cur = form.getValues(`approvers.${index}`);
                            updateApprover(index, { ...cur, name: nameToSet, email: emailToSet });
                          }}
                        >
                          <SelectTrigger className="h-6 text-[11px] font-black p-0 border-none justify-center focus:ring-0 text-slate-900 truncate">
                            <span className="truncate">{approverName || '선택'}</span>
                          </SelectTrigger>
                          <SelectContent className="max-h-60">
                            {filteredUsers.map(u => (
                              <SelectItem key={u.email} value={u.name} className="text-xs">
                                {u.name} ({u.role || targetRole})
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      ) : (
                        <span className="text-[10px] text-slate-400 font-medium">제외</span>
                      )}
                    </div>

                    {/* 하단: 결재 구분 (일반/전결/대결) 원터치 토글 */}
                    {isActive ? (
                      <button
                        type="button"
                        onClick={() => {
                          const nextType = approverType === 'normal' ? 'final' : approverType === 'final' ? 'proxy' : 'normal';
                          form.setValue(`approvers.${index}.type`, nextType as any, { shouldDirty: true });
                          const cur = form.getValues(`approvers.${index}`);
                          updateApprover(index, { ...cur, type: nextType as any });
                        }}
                        className={cn(
                          "w-full py-0.5 rounded text-[9px] font-bold border transition-colors",
                          approverType === 'final' 
                            ? "bg-amber-100 text-amber-800 border-amber-300" 
                            : approverType === 'proxy' 
                            ? "bg-purple-100 text-purple-800 border-purple-300" 
                            : "bg-slate-100 text-slate-600 border-slate-200"
                        )}
                        title="클릭하여 일반/전결/대결 전환"
                      >
                        {approverType === 'final' ? '전결' : approverType === 'proxy' ? '대결' : '일반'}
                      </button>
                    ) : (
                      <div className="h-4" />
                    )}
                  </div>
                );
              })}

              {/* 5번째 박스: 공람 */}
              <div 
                onClick={() => setIsMobileCircularDialogOpen(true)}
                className="flex flex-col justify-between rounded-lg border border-indigo-200 bg-indigo-50/60 p-1 text-center min-h-[92px] cursor-pointer hover:bg-indigo-100/70 transition-all shadow-2xs"
              >
                <div className="flex items-center justify-between border-b border-indigo-100 pb-1">
                  <span className="text-[11px] font-black text-indigo-900">공람</span>
                  <span className="px-1 py-0 bg-indigo-600 text-white rounded-full text-[8px] font-bold">
                    {circularFields.length}
                  </span>
                </div>

                <div className="py-1 min-w-0 flex-1 flex flex-col justify-center items-center">
                  {circularFields.length > 0 ? (
                    <span className="text-[10px] font-bold text-indigo-950 truncate max-w-full">
                      {circularFields[0].name}
                      {circularFields.length > 1 ? ` 외 ${circularFields.length - 1}` : ''}
                    </span>
                  ) : (
                    <span className="text-[10px] text-slate-400">미지정</span>
                  )}
                </div>

                <div className="w-full py-0.5 rounded text-[9px] font-bold bg-indigo-600 text-white shadow-2xs">
                  공람 설정
                </div>
              </div>
            </div>
          </div>

          {/* 데스크톱 전용 4열 카드 결재선 그리드 */}
          <CardContent className="hidden sm:grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
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
                    {index === 2 ? (
                      <div className="flex items-center gap-1">
                        <Select
                          value={field.role === '행정실장' ? '행정실장' : '협조'}
                          onValueChange={(val) => {
                            form.setValue(`approvers.${index}.role`, val, { shouldDirty: true });
                            const cur = form.getValues(`approvers.${index}`);
                            if (val === '행정실장' && orgStructure?.administrativeHeadName) {
                              form.setValue(`approvers.${index}.name`, orgStructure.administrativeHeadName, { shouldDirty: true, shouldValidate: true });
                              form.setValue(`approvers.${index}.email`, orgStructure.administrativeHead || '', { shouldDirty: true });
                              updateApprover(index, { ...cur, role: val, name: orgStructure.administrativeHeadName, email: orgStructure.administrativeHead || '' });
                            } else {
                              updateApprover(index, { ...cur, role: val });
                            }
                          }}
                        >
                          <SelectTrigger className="h-7 text-base font-semibold border-none p-0 focus:ring-0 w-auto gap-1 bg-transparent hover:text-primary">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="협조">협조</SelectItem>
                            <SelectItem value="행정실장">행정실장</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    ) : (
                      <CardTitle className="text-base">{field.role}</CardTitle>
                    )}
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
                                        const updatedRole = (u.role === '행정실장' && index === 2) ? '행정실장' : cur.role;
                                        if (updatedRole !== cur.role) {
                                            form.setValue(`approvers.${index}.role`, updatedRole, { shouldDirty: true });
                                        }
                                        updateApprover(index, { ...cur, role: updatedRole, name: u.name, email: u.email });
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

        <MobileCirculationDialog
          open={isMobileCircularDialogOpen}
          onOpenChange={setIsMobileCircularDialogOpen}
          users={users}
          circularQuery={circularQuery}
          setCircularQuery={setCircularQuery}
          circularFields={circularFields}
          onAppendCircular={appendCircular}
          onRemoveCircular={removeCircular}
        />

        {/* 데스크톱 전용 공람 / 문서 번호 / 게시 상태 / 저장 문서함 그리드 */}
        {!isFamily && (
        <div className="hidden sm:grid md:grid-cols-2 gap-8 items-start">
            <Card className={!docConfig.enableFaceToFaceApproval ? 'md:col-span-2' : ''}>
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

            {/* 우측 하단 박스: 저장 문서함(편철) 선택 & 인수인계 타임라인 자동 추가 */}
            <DriveFilingHandoverCard
              options={filingOptions}
              selectedValue={selectedFilingValue}
              selectedOption={selectedFilingOption}
              onSelectFolder={(val) => {
                if (!val) return;
                const matched = filingOptions.find(o => o.value === val) || null;
                if (!matched) return;
                userEditedFilingRef.current = true;
                applySelectedFilingOption(matched);
              }}
              addToHandover={!!form.watch('addToHandover')}
              onToggleAddToHandover={(checked) => form.setValue('addToHandover', !!checked)}
              driveEnabled={driveConfig?.enabled !== false}
              idSuffix="desktop"
            />
        </div>
        )}

        {/* 모바일 전용: 문서 번호, 게시 상태, 문서 종류 1줄 (3열 그리드) 배치 */}
        <div className="grid sm:hidden grid-cols-3 gap-1.5 w-full bg-slate-50 p-2.5 rounded-xl border border-slate-200">
          {/* 1. 문서 번호 */}
          <div className="space-y-1">
            <Label className="text-[11px] font-bold text-slate-700">문서 번호</Label>
            {docConfig.enableFaceToFaceApproval ? (
              <Input
                value={faceToFaceDocNo}
                onChange={(e) => setFaceToFaceDocNo(e.target.value)}
                placeholder="문서번호"
                className="h-8 text-[11px] font-semibold bg-white border-slate-300 px-2"
              />
            ) : (
              <Input
                disabled
                value="(자동 채번)"
                className="h-8 text-[10.5px] font-medium bg-slate-100 text-slate-500 border-slate-200 px-1.5"
              />
            )}
          </div>

          {/* 2. 게시 상태 */}
          <FormField
            control={form.control}
            name="publishStatus"
            render={({ field }) => (
              <FormItem className="space-y-1">
                <FormLabel className="text-[11px] font-bold text-slate-700">게시 상태</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl>
                    <SelectTrigger className="h-8 text-[11px] font-semibold bg-white border-slate-300 px-2">
                      <SelectValue />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="공개" className="text-xs">공개</SelectItem>
                    <SelectItem value="비공개" className="text-xs">비공개</SelectItem>
                    <SelectItem value="부분공개" className="text-xs">부분공개</SelectItem>
                  </SelectContent>
                </Select>
              </FormItem>
            )}
          />

          {/* 3. 문서 종류 */}
          <FormField
            control={form.control}
            name="docType"
            render={({ field }) => (
              <FormItem className="space-y-1">
                <FormLabel className="text-[11px] font-bold text-slate-700">문서 종류</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl>
                    <SelectTrigger className="h-8 text-[11px] font-semibold bg-white border-slate-300 px-2">
                      <SelectValue />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="internal" className="text-xs">내부결재</SelectItem>
                    <SelectItem value="external" className="text-xs">대외공문</SelectItem>
                  </SelectContent>
                </Select>
              </FormItem>
            )}
          />
        </div>

        {/* 모바일 전용: 저장 문서함(편철) & 인수인계 타임라인에 추가 */}
        {!isFamily && (
          <div className="sm:hidden">
            <DriveFilingHandoverCard
              compact
              options={filingOptions}
              selectedValue={selectedFilingValue}
              selectedOption={selectedFilingOption}
              onSelectFolder={(val) => {
                if (!val) return;
                const matched = filingOptions.find(o => o.value === val) || null;
                if (!matched) return;
                userEditedFilingRef.current = true;
                applySelectedFilingOption(matched);
              }}
              addToHandover={!!form.watch('addToHandover')}
              onToggleAddToHandover={(checked) => form.setValue('addToHandover', !!checked)}
              driveEnabled={driveConfig?.enabled !== false}
              idSuffix="mobile"
            />
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
            <CardHeader className="flex flex-row items-center justify-between p-3 sm:p-6 pb-2 sm:pb-4 border-b sm:border-b-0">
                <CardTitle className="text-sm sm:text-base flex items-center gap-1.5 sm:gap-2">
                  <span>첨부파일</span>
                  <span className="text-xs text-muted-foreground font-normal hidden sm:inline">(파일당 최대 50MB)</span>
                </CardTitle>
                <div className="flex items-center gap-2">
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
                      size="sm"
                      onClick={() => attachmentInputRef.current?.click()}
                      disabled={isUploadingFiles}
                      className="h-7 sm:h-8 text-xs font-bold gap-1 text-indigo-700 border-indigo-200 hover:bg-indigo-50"
                  >
                      {isUploadingFiles ? <><Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> 업로드 중...</> : <><Paperclip className="h-3.5 w-3.5" /> 파일 선택</>}
                  </Button>
                </div>
            </CardHeader>
            <CardContent className="p-3 sm:p-6 pt-2 sm:pt-0">
                <div className="space-y-3">
                    {/* 데스크톱 전용 대형 드래그 앤 드롭 영역 (모바일에서는 숨김) */}
                    <div className="hidden sm:flex p-6 border-2 border-dashed rounded-lg flex-col items-center justify-center text-center">
                        <Paperclip className="h-10 w-10 text-muted-foreground mb-2" />
                        <p className="mb-2 text-sm text-muted-foreground">파일을 드래그 앤 드롭하거나 클릭하여 업로드하세요.</p>
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

    <PresetManagementDialog
      open={isPresetDialogOpen}
      onOpenChange={setIsPresetDialogOpen}
      newPresetName={newPresetName}
      setNewPresetName={setNewPresetName}
      newPresetType={newPresetType}
      setNewPresetType={setNewPresetType}
      canSaveDeptPreset={canSaveDeptPreset}
      selectedDeptIdForPreset={selectedDeptIdForPreset}
      setSelectedDeptIdForPreset={setSelectedDeptIdForPreset}
      isAdmin={profile?.isAdmin}
      allDepartments={allDepartments}
      leadDepartments={leadDepartments}
      onSavePreset={handleSavePreset}
      presets={presets}
      myDepartments={myDepartments}
      currentUserEmail={profile?.email}
      onDeletePreset={handleDeletePreset}
    />
    </>
  );
}