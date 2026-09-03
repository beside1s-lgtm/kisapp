'use client';

import React, { useState, useMemo, useEffect, useRef } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { cn } from '@/lib/utils';
import type { TargetGroupType } from '@/lib/types';
import { createDepartmentTask } from '@/lib/services/departmentTaskService';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  ClipboardList, 
  Users, 
  Building2, 
  GraduationCap, 
  CheckCircle2, 
  Loader2, 
  Plus, 
  Trash2, 
  Calendar, 
  Clock, 
  MapPin, 
  Coins, 
  Trophy, 
  Check, 
  FileText, 
  FileSpreadsheet, 
  Sparkles, 
  ExternalLink, 
  Table, 
  HelpCircle,
  Link2,
  ArrowUp,
  ArrowDown,
  Layers,
  RotateCcw,
  Save,
  Paperclip,
  FileUp,
  X,
  Image as ImageIcon,
  HardDrive,
  Presentation
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import type { TaskAttachment } from '@/lib/types';
import { GoogleDrivePickerModal } from './google-drive-picker-modal';
import { getDriveTypeInfo } from '@/lib/services/googleDriveService';
import { getGoogleDriveConfig } from '@/lib/services/settingsService';
import { 
  onSystemTaskTemplatesUpdate, 
  saveSystemTaskTemplate, 
  SystemTaskTemplate, 
  BUILTIN_TASK_TEMPLATES 
} from '@/lib/services/taskTemplateService';

interface CreateDepartmentTaskDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orgData?: any;
  allTeachers?: Array<{ email: string; name: string; dept?: string }>;
}

const ALL_GRADES = ['1학년', '2학년', '3학년', '4학년', '5학년', '6학년'];

const EVENT_TYPE_OPTIONS = [
  { value: 'sports_day', label: '스포츠 데이 (운동회 / 체육대회)' },
  { value: 'arts_festival', label: '학예발표회 (축제 / 전시회)' },
  { value: 'field_trip', label: '현장체험학습 (수련활동 / 수학여행)' },
  { value: 'career_volunteer', label: '진로체험 및 학생 봉사활동' },
  { value: 'competition', label: '교내 대회 및 특별 활동' },
  { value: 'general_event', label: '기타 교내외 주요 행사' },
];

const LOCATION_QUICK_TAGS = [
  '대운동장',
  '메인 체육관',
  '소체육관',
  '강당',
  '시청각실',
  '각 학급 교실',
  '풋살장',
  '도서관',
];

export const PRESET_SHEET_TEMPLATES = [
  {
    id: 'sports_scenario',
    name: '[체육/행사] 학년별 세부 운영 시나리오 및 타임테이블 양식',
    desc: '학년별 경기 종목, 세부 규칙, 시간대, 장소 및 안전 유의사항 취합',
    columns: ['학년/반', '프로그램명', '시간대', '진행장소', '담당교사', '준비물', '안전지도대책']
  },
  {
    id: 'budget_supply',
    name: '[예산/물품] 부서 및 학년 소요 교구/기자재 신청 양식',
    desc: '학년/부서별 필요 교구, 수량, 단가, 규격, 소요 예산 취합',
    columns: ['신청부서/학년', '품명/규격', '수량', '예상단가(VND)', '총금액(VND)', '활용목적/비고']
  },
  {
    id: 'afterschool_roster',
    name: '[방과후/동아리] 학생 활동 명단 및 강사 출결 취합 양식',
    desc: '강좌별/부서별 학생 명단, 강의실, 강사 출결 현황 실시간 집계',
    columns: ['강좌명/동아리', '담당교사/강사', '활동장소', '참여학생수', '주요활동내용', '출결특이사항']
  },
  {
    id: 'facility_inspection',
    name: '[시설/환경] 교실 환경구성 및 안전 점검 체크리스트 양식',
    desc: '각 학급 및 특별실 시설 점검 상태, 보수 요청 사항 취합',
    columns: ['점검구역/학급', '점검일자', '시설상태(양호/요보수)', '보수요청내용', '점검자', '조치기한']
  }
];

export interface DraftColumnDef {
  id: string;
  name: string;   // 컬럼명 (예: "프로그램명")
  guide: string;  // 작성 안내 / 입력 예시 (예: "예: 볼풀공 던지기 / 줄다리기")
}

export const COLUMN_PRESETS: { id: string; title: string; columns: DraftColumnDef[] }[] = [
  {
    id: 'sports_event',
    title: '행사 / 타임테이블',
    columns: [
      { id: '1', name: '구분(학년)', guide: '예: 1학년 전체 또는 1반' },
      { id: '2', name: '프로그램명', guide: '예: 볼풀공 던지기, 릴레이' },
      { id: '3', name: '시간대', guide: '예: 09:00 ~ 09:40' },
      { id: '4', name: '진행 장소', guide: '예: 메인 체육관, 대운동장' },
      { id: '5', name: '담당교사', guide: '예: 담임교사 및 체육담당' },
      { id: '6', name: '준비물/교구', guide: '예: 바구니 4개, 호루라기' },
      { id: '7', name: '안전 및 유의사항', guide: '예: 준비운동 철저, 보건교사 대기' },
    ]
  },
  {
    id: 'budget_order',
    title: '예산 / 교구 신청',
    columns: [
      { id: '1', name: '신청 학년/부서', guide: '예: 3학년부 / 예체능과' },
      { id: '2', name: '품명 및 규격', guide: '예: 배구공 (소프트 4호)' },
      { id: '3', name: '수량', guide: '예: 10개' },
      { id: '4', name: '예상 단가(VND)', guide: '예: 150,000' },
      { id: '5', name: '총 금액(VND)', guide: '예: 1,500,000' },
      { id: '6', name: '활용 목적 및 비고', guide: '예: 2학기 배구 단원 수업용' },
    ]
  },
  {
    id: 'roster_activity',
    title: '명단 / 활동 취합',
    columns: [
      { id: '1', name: '소속 / 학급', guide: '예: 5학년 2반' },
      { id: '2', name: '학생/교사 성명', guide: '예: 홍길동' },
      { id: '3', name: '담당 역할', guide: '예: 진행 보조, 계측' },
      { id: '4', name: '활동 장소', guide: '예: 컴퓨터실 2관' },
      { id: '5', name: '제출/확인 일자', guide: '예: 2026-09-10' },
      { id: '6', name: '비고 / 특이사항', guide: '예: 알레르기 유무 등' },
    ]
  },
  {
    id: 'facility_inspection',
    title: '시설 / 안전 점검',
    columns: [
      { id: '1', name: '점검 구역/교실', guide: '예: 1학년 1반 교실' },
      { id: '2', name: '점검 일시', guide: '예: 2026-09-02' },
      { id: '3', name: '점검 상태', guide: '예: 양호 / 요보수' },
      { id: '4', name: '보수 요청 내용', guide: '예: 에어컨 필터 세척 필요' },
      { id: '5', name: '점검 교사', guide: '예: 김선생' },
    ]
  }
];

export type ExtendedTaskType = 
  | 'file_submission' 
  | 'acknowledgment' 
  | 'sheets_custom' 
  | 'sheets_template' 
  | 'html_draft';

interface ScheduleItem {
  id: string;
  time: string;
  program: string;
  location: string;
  manager: string;
}

interface BudgetItem {
  id: string;
  item: string;
  amount: number;
  note: string;
}

export function CreateDepartmentTaskDialog({
  open,
  onOpenChange,
  orgData,
  allTeachers = []
}: CreateDepartmentTaskDialogProps) {
  const { profile } = useAuth();
  const { toast } = useToast();

  // 업무 대분류: 일반 업무 vs 행사/프로젝트 계획
  const [taskCategory, setTaskCategory] = useState<'general' | 'event'>('general');

  // 공통 기본 정보
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [targetType, setTargetType] = useState<TargetGroupType>('dept');
  
  // 복수 선택 지원: 부서 및 학년
  const [selectedDepts, setSelectedDepts] = useState<string[]>([]);
  const [selectedGrades, setSelectedGrades] = useState<string[]>(['1학년']);
  const [selectedCustomEmails, setSelectedCustomEmails] = useState<string[]>([]);
  
  // 확장된 업무 해결 방식 (사용자 지정 시트 / 프리셋 템플릿 / 기안문 직행 표)
  const [taskType, setTaskType] = useState<ExtendedTaskType>('file_submission');
  
  // 구글 시트 / 협업 서식 전용 상태
  const [customSheetUrl, setCustomSheetUrl] = useState('');
  const [selectedTemplateId, setSelectedTemplateId] = useState('sports_scenario');
  
  // 표준 템플릿 DB 실시간 동기화 상태
  const [systemTemplates, setSystemTemplates] = useState<SystemTaskTemplate[]>(BUILTIN_TASK_TEMPLATES);

  // 세부 옵션 B(표준 템플릿)에서 선택한 프리셋의 컬럼을 직접 수정/추가/삭제할 수 있는 상태
  const [templateColumns, setTemplateColumns] = useState<DraftColumnDef[]>(() => {
    const t = BUILTIN_TASK_TEMPLATES[0];
    return t.columns.map((colName, idx) => ({ id: `${Date.now()}_${idx}`, name: colName, guide: '' }));
  });

  // DB 템플릿 실시간 구독
  useEffect(() => {
    const unsub = onSystemTaskTemplatesUpdate((list) => {
      setSystemTemplates(list);
    });
    return () => unsub();
  }, []);

  // 템플릿 선택이 바뀔 때 해당 템플릿의 컬럼들로 자동 로드
  useEffect(() => {
    const tpl = systemTemplates.find(t => t.id === selectedTemplateId);
    if (tpl) {
      if (tpl.columnDefs && tpl.columnDefs.length > 0) {
        setTemplateColumns(tpl.columnDefs.map((c, i) => ({ ...c, id: `${Date.now()}_${i}` })));
      } else {
        setTemplateColumns(tpl.columns.map((colName, i) => ({
          id: `${Date.now()}_${i}`,
          name: colName,
          guide: ''
        })));
      }
    }
  }, [selectedTemplateId, systemTemplates]);

  // 세부 옵션 B 템플릿 컬럼 조작 함수들 (컬럼명 변경, 추가, 삭제, 순서이동)
  const handleTemplateAddColumn = () => {
    setTemplateColumns(prev => [
      ...prev,
      { id: `${Date.now()}_${Math.random()}`, name: '', guide: '' }
    ]);
  };

  const handleTemplateUpdateColumn = (id: string, name: string) => {
    setTemplateColumns(prev => prev.map(c => c.id === id ? { ...c, name } : c));
  };

  const handleTemplateRemoveColumn = (id: string) => {
    if (templateColumns.length <= 1) {
      toast({ title: '삭제 불가', description: '템플릿에는 최소 1개 이상의 컬럼이 필요합니다.', variant: 'destructive' });
      return;
    }
    setTemplateColumns(prev => prev.filter(c => c.id !== id));
  };

  const handleTemplateMoveColumn = (index: number, direction: 'up' | 'down') => {
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= templateColumns.length) return;
    setTemplateColumns(prev => {
      const copy = [...prev];
      const temp = copy[index];
      copy[index] = copy[targetIndex];
      copy[targetIndex] = temp;
      return copy;
    });
  };

  const handleTemplateClearColumns = () => {
    setTemplateColumns([{ id: `${Date.now()}_1`, name: '', guide: '' }]);
    toast({ title: '내용 비우기 완료', description: '템플릿 컬럼이 초기화되었습니다. 원하는 컬럼을 입력해주세요.' });
  };

  const handleTemplateResetToOriginal = () => {
    const tpl = systemTemplates.find(t => t.id === selectedTemplateId);
    if (tpl) {
      setTemplateColumns(tpl.columns.map((colName, i) => ({
        id: `${Date.now()}_${i}`,
        name: colName,
        guide: ''
      })));
      toast({ title: '초기화 완료', description: '원래 템플릿의 기본 컬럼으로 복원되었습니다.' });
    }
  };

  // 관리자 기능: 현재 수정한 템플릿 구성을 학교 표준 템플릿(DB)으로 영구 저장
  const [isSavingTemplate, setIsSavingTemplate] = useState(false);
  const handleSaveCurrentAsSchoolTemplate = async () => {
    const currentTpl = systemTemplates.find(t => t.id === selectedTemplateId);
    const validColNames = templateColumns.map(c => c.name.trim()).filter(Boolean);
    if (validColNames.length === 0) {
      toast({ title: '저장 불가', description: '최소 1개 이상의 유효한 컬럼명이 필요합니다.', variant: 'destructive' });
      return;
    }

    setIsSavingTemplate(true);
    try {
      await saveSystemTaskTemplate({
        id: selectedTemplateId,
        name: currentTpl?.name || '[학교 표준] 맞춤형 업무 양식',
        desc: currentTpl?.desc || '학교 맞춤형으로 수정된 표준 양식',
        columns: validColNames,
        columnDefs: templateColumns.filter(c => c.name.trim()),
        updatedBy: profile?.name || '관리자'
      });
      toast({
        title: '학교 표준 템플릿 저장 완료',
        description: '수정한 컬럼 구성이 학교 표준 양식으로 영구 저장되어 전 교원에게 반영됩니다.'
      });
    } catch (err: any) {
      toast({
        title: '저장 실패',
        description: err.message || '템플릿 저장 중 오류가 발생했습니다.',
        variant: 'destructive'
      });
    } finally {
      setIsSavingTemplate(false);
    }
  };
  
  // 기안문 직행 HTML 표 전용 스마트 컬럼 빌더 상태 (개별 입력칸 지원)
  const [draftColumns, setDraftColumns] = useState<DraftColumnDef[]>(COLUMN_PRESETS[0].columns);

  const handleAddColumn = () => {
    setDraftColumns(prev => [
      ...prev,
      { id: `${Date.now()}_${Math.random()}`, name: '', guide: '' }
    ]);
  };

  const handleUpdateColumn = (id: string, field: 'name' | 'guide', val: string) => {
    setDraftColumns(prev => prev.map(c => c.id === id ? { ...c, [field]: val } : c));
  };

  const handleRemoveColumn = (id: string) => {
    if (draftColumns.length <= 1) {
      toast({ title: '삭제 불가', description: '표에는 최소 1개 이상의 컬럼이 필요합니다.', variant: 'destructive' });
      return;
    }
    setDraftColumns(prev => prev.filter(c => c.id !== id));
  };

  const handleMoveColumn = (index: number, direction: 'up' | 'down') => {
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= draftColumns.length) return;
    setDraftColumns(prev => {
      const copy = [...prev];
      const temp = copy[index];
      copy[index] = copy[targetIndex];
      copy[targetIndex] = temp;
      return copy;
    });
  };

  const handleApplyPreset = (presetId: string) => {
    const p = COLUMN_PRESETS.find(x => x.id === presetId);
    if (p) {
      setDraftColumns(p.columns.map((c, i) => ({ ...c, id: `${Date.now()}_${i}` })));
      toast({ title: '템플릿 적용 완료', description: `[${p.title}] 템플릿 컬럼 구성이 적용되었습니다.` });
    }
  };

  const handleClearColumns = () => {
    setDraftColumns([{ id: `${Date.now()}_1`, name: '', guide: '' }]);
    toast({ title: '내용 비우기 완료', description: '표 항목이 초기화되었습니다. 원하는 컬럼을 입력해주세요.' });
  };

  // 업무 참고자료 (공문, 운영계획서 PDF, 안내 이미지 등)
  const [attachments, setAttachments] = useState<TaskAttachment[]>([]);
  const [isUploadingAttachment, setIsUploadingAttachment] = useState(false);
  const [drivePickerOpen, setDrivePickerOpen] = useState(false);
  const attachmentInputRef = useRef<HTMLInputElement>(null);

  const handleSelectDriveAttachment = (item: TaskAttachment) => {
    setAttachments(prev => [...prev, item]);
  };

  const handleAttachmentUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    const files = Array.from(e.target.files);
    setIsUploadingAttachment(true);

    try {
      const storage = getStorage();
      const uploadedList: TaskAttachment[] = [];

      for (const file of files) {
        if (file.size > 50 * 1024 * 1024) {
          toast({
            variant: 'destructive',
            title: '용량 초과',
            description: `${file.name} 파일이 너무 큽니다 (최대 50MB).`,
          });
          continue;
        }

        const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
        const fileRef = ref(storage, `task_materials/${Date.now()}_${safeName}`);
        await uploadBytes(fileRef, file);
        const downloadUrl = await getDownloadURL(fileRef);

        uploadedList.push({
          name: file.name,
          url: downloadUrl,
          size: file.size,
          type: file.type || 'application/octet-stream',
        });
      }

      if (uploadedList.length > 0) {
        setAttachments(prev => [...prev, ...uploadedList]);
        toast({
          title: '참고자료 첨부 완료',
          description: `${uploadedList.length}건의 파일이 등록되었습니다.`
        });
      }
    } catch (err: any) {
      console.error('Task attachment upload error:', err);
      toast({
        variant: 'destructive',
        title: '업로드 실패',
        description: err.message || '참고자료 업로드 중 오류가 발생했습니다.'
      });
    } finally {
      setIsUploadingAttachment(false);
      if (attachmentInputRef.current) {
        attachmentInputRef.current.value = '';
      }
    }
  };

  const handleRemoveAttachment = (index: number) => {
    setAttachments(prev => prev.filter((_, i) => i !== index));
  };

  const [deadline, setDeadline] = useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() + 7);
    return d.toISOString().split('T')[0];
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [customSearchQuery, setCustomSearchQuery] = useState('');

  // ── 행사/프로젝트 전용 상태 ──
  const [eventType, setEventType] = useState<string>('sports_day');
  const [startDate, setStartDate] = useState<string>(() => new Date().toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState<string>(() => new Date().toISOString().split('T')[0]);
  const [location, setLocation] = useState('학교 대운동장 및 메인 체육관');
  const [purpose, setPurpose] = useState('전교생이 함께 참여하는 활동을 통해 창의적 역량을 함양하고 소통과 배려를 실천함.');
  
  // 시간대별 일정표
  const [schedules, setSchedules] = useState<ScheduleItem[]>([
    { id: '1', time: '08:30 ~ 09:00', program: '개회식 및 준비활동', location: '대운동장', manager: '진행위원, 체육담당' },
    { id: '2', time: '09:00 ~ 11:30', program: '오전 메인 프로그램 및 학년별 활동', location: '대운동장/체육관', manager: '각 학년 담임교사' },
    { id: '3', time: '13:00 ~ 15:00', program: '오후 종합 활동 및 폐회식', location: '메인 체육관', manager: '전 교직원' },
  ]);

  // 소요 예산 내역
  const [budgets, setBudgets] = useState<BudgetItem[]>([
    { id: '1', item: '기념품 및 시상품 구입비', amount: 3000000, note: '참가 학생 전원' },
    { id: '2', item: '행사 운영 물품 및 현수막 제작', amount: 1500000, note: '현수막, 진행 소품' },
    { id: '3', item: '학생 음료 및 다과비', amount: 1200000, note: '생수 및 간식' },
  ]);

  // 총 예산 계산
  const totalBudget = useMemo(() => {
    return budgets.reduce((sum, b) => sum + (Number(b.amount) || 0), 0);
  }, [budgets]);

  // 1. 순수 교직원 목록만 필터링 (학생/학부모 원천 배제)
  const facultyOnlyList = useMemo(() => {
    return (allTeachers || []).filter(t => {
      const deptLower = (t.dept || '').toLowerCase();
      const nameLower = (t.name || '').toLowerCase();
      const isStudent = deptLower.includes('student') || deptLower.includes('학생') || nameLower.includes('student') || nameLower.includes('학생');
      const isParent = deptLower.includes('parent') || deptLower.includes('학부모') || nameLower.includes('parent') || nameLower.includes('학부모');
      return !isStudent && !isParent && !!t.email && !!t.name;
    });
  }, [allTeachers]);

  // User's department list from orgData
  const myDepartments = useMemo(() => {
    if (!orgData?.departments || !profile?.email) return [];
    const emailLower = profile.email.toLowerCase();
    return orgData.departments.filter((d: any) => 
      d.headEmail?.toLowerCase() === emailLower || 
      d.memberEmails?.some((m: string) => m?.toLowerCase() === emailLower)
    );
  }, [orgData, profile]);

  // Available departments in school
  const allDepartments: string[] = useMemo(() => {
    return (orgData?.departments || []).map((d: any) => d.name);
  }, [orgData]);

  // Set default selected dept only when dialog opens
  useEffect(() => {
    if (open) {
      if (myDepartments.length > 0) {
        setSelectedDepts([myDepartments[0].name]);
      } else if (allDepartments.length > 0) {
        setSelectedDepts([allDepartments[0]]);
      }
    }
  }, [open]);

  // 행사 템플릿 전환 시 기본값 설정
  useEffect(() => {
    if (taskCategory === 'event') {
      if (!title || title.includes('방과후 지도계획서')) {
        const year = new Date().getFullYear();
        setTitle(`${year}학년도 초등 스포츠 데이(체육대회) 한마당 운영 계획`);
      }
      if (targetType === 'dept') {
        setTargetType('grade');
        setSelectedGrades(['1학년', '2학년', '3학년', '4학년', '5학년', '6학년']);
      }
      // 행사 계획일 때는 기본적으로 [기안문 직행 HTML 표] 또는 [시트 템플릿] 권장
      if (taskType === 'file_submission') {
        setTaskType('html_draft');
      }
    }
  }, [taskCategory]);

  // 부서 토글
  const toggleDept = (dept: string) => {
    setSelectedDepts(prev => 
      prev.includes(dept) ? prev.filter(d => d !== dept) : [...prev, dept]
    );
  };

  const selectAllDepts = () => {
    setSelectedDepts([...allDepartments]);
  };

  const clearAllDepts = () => {
    setSelectedDepts([]);
  };

  // 학년 토글
  const toggleGrade = (grade: string) => {
    setSelectedGrades(prev => 
      prev.includes(grade) ? prev.filter(g => g !== grade) : [...prev, grade]
    );
  };

  const setGradePreset = (preset: 'low' | 'mid' | 'high' | 'all' | 'none') => {
    if (preset === 'low') setSelectedGrades(['1학년', '2학년']);
    else if (preset === 'mid') setSelectedGrades(['3학년', '4학년']);
    else if (preset === 'high') setSelectedGrades(['5학년', '6학년']);
    else if (preset === 'all') setSelectedGrades(['1학년', '2학년', '3학년', '4학년', '5학년', '6학년']);
    else if (preset === 'none') setSelectedGrades([]);
  };

  // 일정 항목 추가/삭제
  const addScheduleItem = () => {
    setSchedules(prev => [
      ...prev,
      { id: Date.now().toString(), time: '10:00 ~ 11:00', program: '신규 프로그램', location: '대운동장', manager: '담당교사' }
    ]);
  };

  const removeScheduleItem = (id: string) => {
    setSchedules(prev => prev.filter(s => s.id !== id));
  };

  const updateScheduleItem = (id: string, field: keyof ScheduleItem, value: string) => {
    setSchedules(prev => prev.map(s => s.id === id ? { ...s, [field]: value } : s));
  };

  // 예산 항목 추가/삭제
  const addBudgetItem = () => {
    setBudgets(prev => [
      ...prev,
      { id: Date.now().toString(), item: '신규 예산 항목', amount: 500000, note: '산출 내역' }
    ]);
  };

  const removeBudgetItem = (id: string) => {
    setBudgets(prev => prev.filter(b => b.id !== id));
  };

  const updateBudgetItem = (id: string, field: keyof BudgetItem, value: any) => {
    setBudgets(prev => prev.map(b => b.id === id ? { ...b, [field]: value } : b));
  };

  // Calculate target recipients
  const targetRecipients = useMemo(() => {
    const emailToNameMap: { [email: string]: string } = {};
    facultyOnlyList.forEach(t => {
      if (t.email) emailToNameMap[t.email.toLowerCase()] = t.name;
    });

    if (targetType === 'all') {
      const list = facultyOnlyList.map(t => t.email.toLowerCase());
      return { emails: Array.from(new Set(list)), names: emailToNameMap };
    }

    if (targetType === 'dept' && selectedDepts.length > 0 && orgData?.departments) {
      const emails = new Set<string>();
      selectedDepts.forEach(deptName => {
        const deptObj = orgData.departments.find((d: any) => d.name === deptName);
        if (deptObj) {
          if (deptObj.headEmail) emails.add(deptObj.headEmail.toLowerCase());
          (deptObj.memberEmails || []).forEach((m: string) => {
            if (m) emails.add(m.toLowerCase());
          });
        }
      });
      return { emails: Array.from(emails), names: emailToNameMap };
    }

    if (targetType === 'grade' && selectedGrades.length > 0 && orgData?.homerooms) {
      const emails = new Set<string>();
      selectedGrades.forEach(gradeName => {
        const gradeNum = gradeName.replace('학년', '');
        Object.entries(orgData.homerooms).forEach(([gc, email]) => {
          if (gc.startsWith(gradeNum) && email) {
            emails.add((email as string).toLowerCase());
          }
        });
        if (orgData.gradeHeads?.[gradeName]) {
          emails.add(orgData.gradeHeads[gradeName].toLowerCase());
        }
      });
      return { emails: Array.from(emails), names: emailToNameMap };
    }

    if (targetType === 'custom') {
      return { emails: selectedCustomEmails.map(e => e.toLowerCase()), names: emailToNameMap };
    }

    return { emails: [], names: emailToNameMap };
  }, [targetType, selectedDepts, selectedGrades, selectedCustomEmails, facultyOnlyList, orgData]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      toast({ variant: 'destructive', title: '입력 오류', description: '업무(행사) 제목을 입력해주세요.' });
      return;
    }
    if (targetRecipients.emails.length === 0) {
      toast({ variant: 'destructive', title: '대상 오류', description: '업무를 할당할 대상 교직원이 1명 이상이어야 합니다.' });
      return;
    }

    if (taskType === 'sheets_custom' && !customSheetUrl.trim()) {
      toast({ variant: 'destructive', title: '입력 오류', description: '연결할 Google Sheets 공유 링크(URL)를 입력해주세요.' });
      return;
    }

    setIsSubmitting(true);
    try {
      const targetDeptSummary = targetType === 'dept' ? selectedDepts.join(', ') : undefined;
      const targetGradeSummary = targetType === 'grade' ? selectedGrades.join(', ') : undefined;

      const eventPayload = taskCategory === 'event' ? {
        eventType,
        startDate,
        endDate,
        location,
        targetGrades: selectedGrades,
        purpose,
        schedules,
        budgets,
        totalBudget
      } : undefined;

      const activeTemplate = systemTemplates.find(t => t.id === selectedTemplateId) || PRESET_SHEET_TEMPLATES.find(t => t.id === selectedTemplateId);
      const parsedDraftColumns = draftColumns.map(c => c.name.trim()).filter(Boolean);
      const parsedTemplateColumns = templateColumns.map(c => c.name.trim()).filter(Boolean);

      if (taskType === 'html_draft' && parsedDraftColumns.length === 0) {
        toast({ variant: 'destructive', title: '입력 오류', description: '표 컬럼 항목을 최소 1개 이상 입력해주세요.' });
        setIsSubmitting(false);
        return;
      }
      if (taskType === 'sheets_template' && parsedTemplateColumns.length === 0) {
        toast({ variant: 'destructive', title: '입력 오류', description: '템플릿 컬럼 항목을 최소 1개 이상 입력해주세요.' });
        setIsSubmitting(false);
        return;
      }

      let autoGeneratedSheetUrl: string | undefined = undefined;
      let finalAttachments = [...attachments];

      // Google Drive 연동 활성화 상태 시 Google Spreadsheet 자동 생성 (파일명: 업무 제목)
      if (taskType === 'sheets_template') {
        try {
          const driveCfg = await getGoogleDriveConfig();
          if (driveCfg && driveCfg.enabled && driveCfg.rootFolderId) {
            const targetFolderId = driveCfg.subFolders?.taskWorkId || driveCfg.rootFolderId;
            const createRes = await fetch('/api/drive/create-sheet', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                title: title.trim(),
                parentFolderId: targetFolderId,
                columns: parsedTemplateColumns,
                columnDefs: templateColumns.filter(c => c.name.trim())
              })
            });
            const createData = await createRes.json();
            if (createData.success && createData.sheetUrl) {
              autoGeneratedSheetUrl = createData.sheetUrl;
              // 참고자료 목록에도 자동 생성된 구글 시트 추가
              finalAttachments.push({
                name: `${title.trim()} [Google 시트]`,
                url: createData.sheetUrl,
                size: 0,
                type: 'application/vnd.google-apps.sheet',
                isGoogleDrive: true,
                driveFileType: 'sheet',
                driveFileId: createData.fileId
              });
            } else {
              console.warn('[CreateTask] Google Sheet 자동 생성 안내:', createData.error);
            }
          }
        } catch (driveErr) {
          console.warn('[CreateTask] Google Drive 연동 중 예외 발생, 시스템 내부 양식으로 대체:', driveErr);
        }
      }

      const sheetsConfig = (taskType === 'sheets_custom' || taskType === 'sheets_template' || taskType === 'html_draft') ? {
        mode: taskType === 'sheets_custom' ? 'custom' as const : taskType === 'sheets_template' ? 'template' as const : 'html_draft' as const,
        sheetUrl: taskType === 'sheets_custom' ? customSheetUrl.trim() : (autoGeneratedSheetUrl || undefined),
        templateId: taskType === 'sheets_template' ? selectedTemplateId : undefined,
        templateName: taskType === 'sheets_template' ? activeTemplate?.name : undefined,
        columns: taskType === 'html_draft' ? parsedDraftColumns : (taskType === 'sheets_template' ? parsedTemplateColumns : undefined),
        columnDefs: taskType === 'html_draft' 
          ? draftColumns.filter(c => c.name.trim()) 
          : (taskType === 'sheets_template' ? templateColumns.filter(c => c.name.trim()) : undefined),
        autoDraftTable: taskType === 'html_draft'
      } : undefined;

      const res = await createDepartmentTask({
        title: title.trim(),
        description: description.trim() || (taskCategory === 'event' ? purpose : ''),
        attachments: finalAttachments.length > 0 ? finalAttachments : undefined,
        creatorEmail: profile?.email || '',
        creatorName: profile?.name || '교직원',
        creatorDept: selectedDepts[0] || profile?.dept || '소속',
        targetType,
        targetDept: targetDeptSummary,
        targetGrade: targetGradeSummary,
        targetEmails: targetRecipients.emails,
        targetNames: targetRecipients.names,
        taskType: taskType as any,
        sheetsConfig,
        deadline,
        status: 'active',
        category: taskCategory,
        eventDetails: eventPayload,
        eventSchedules: taskCategory === 'event' ? schedules : undefined
      });

      if (res.success) {
        toast({ 
          title: taskCategory === 'event' ? '행사 계획 생성 및 업무 할당 완료' : '업무 생성 완료', 
          description: autoGeneratedSheetUrl 
            ? `Google Drive에 업무 시트가 자동 생성되었으며, 총 ${targetRecipients.emails.length}명에게 할당되었습니다.`
            : `총 ${targetRecipients.emails.length}명에게 업무가 성공적으로 할당되었습니다.` 
        });
        setTitle('');
        setDescription('');
        setCustomSheetUrl('');
        setSelectedCustomEmails([]);
        onOpenChange(false);
      } else {
        toast({ variant: 'destructive', title: '생성 실패', description: res.error });
      }
    } catch (err: any) {
      toast({ variant: 'destructive', title: '오류 발생', description: err.message });
    } finally {
      setIsSubmitting(false);
    }
  };

  const toggleCustomEmail = (email: string) => {
    setSelectedCustomEmails(prev => 
      prev.includes(email) ? prev.filter(e => e !== email) : [...prev, email]
    );
  };

  const selectAllCustom = () => {
    setSelectedCustomEmails(facultyOnlyList.map(t => t.email));
  };

  const clearAllCustom = () => {
    setSelectedCustomEmails([]);
  };

  const filteredCustomTeachers = useMemo(() => {
    if (!customSearchQuery.trim()) return facultyOnlyList;
    const q = customSearchQuery.trim().toLowerCase();
    return facultyOnlyList.filter(t => 
      t.name.toLowerCase().includes(q) || 
      (t.dept && t.dept.toLowerCase().includes(q)) || 
      t.email.toLowerCase().includes(q)
    );
  }, [facultyOnlyList, customSearchQuery]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[92vh] p-0 flex flex-col overflow-hidden rounded-2xl">
        <DialogHeader className="p-4 sm:p-5 border-b shrink-0 bg-slate-50/90">
          <div className="flex items-center justify-between">
            <DialogTitle className="text-base sm:text-lg font-bold flex items-center gap-2 text-slate-900">
              <ClipboardList className="w-5 h-5 text-indigo-600" />
              새 부서 / 학년 업무 요청 생성
            </DialogTitle>
          </div>
          <DialogDescription className="text-xs text-slate-500 mt-0.5">
            일반 업무 배포, Google Sheets 동시 협업, 또는 기안문 직행 HTML 표 취합 업무를 생성합니다.
          </DialogDescription>

          {/* 최상단: 업무 양식 유형 탭 */}
          <div className="grid grid-cols-2 gap-2 pt-3">
            <button
              type="button"
              onClick={() => setTaskCategory('general')}
              className={`flex items-center justify-center gap-2 py-2 px-3 rounded-xl border text-xs font-bold transition-all cursor-pointer select-none ${
                taskCategory === 'general'
                  ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm ring-2 ring-indigo-200'
                  : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
              }`}
            >
              <FileText className="w-4 h-4" />
              <span>일반 업무 요청</span>
            </button>

            <button
              type="button"
              onClick={() => setTaskCategory('event')}
              className={`flex items-center justify-center gap-2 py-2 px-3 rounded-xl border text-xs font-bold transition-all cursor-pointer select-none ${
                taskCategory === 'event'
                  ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm ring-2 ring-indigo-200'
                  : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
              }`}
            >
              <Trophy className="w-4 h-4 text-amber-300" />
              <span>행사 / 프로젝트 계획 (체육/축제/체험 등)</span>
            </button>
          </div>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden min-h-0">
          <div className="p-4 sm:p-5 overflow-y-auto flex-1 space-y-4 scrollbar-thin">
            
            {/* ── 1. 기본 정보 ── */}
            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-slate-700">
                {taskCategory === 'event' ? '행사 / 프로젝트 명 *' : '업무 제목 *'}
              </Label>
              <Input 
                placeholder={taskCategory === 'event' ? "예: 2026학년도 초등 스포츠 데이(체육대회) 한마당 운영 계획" : "예: 2026학년도 1학기 방과후 지도계획서 제출, 3월 환경구성 점검 등"}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="h-10 text-sm rounded-xl font-medium"
                required
              />
            </div>

            {/* ── 행사 전용 추가 양식 섹션 (시작/종료일, 장소, 유형, 방침, 일정표, 예산) ── */}
            {taskCategory === 'event' && (
              <div className="space-y-4 pt-1">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-bold text-slate-700">행사 유형 *</Label>
                    <Select value={eventType} onValueChange={setEventType}>
                      <SelectTrigger className="h-9 text-xs rounded-xl font-semibold">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {EVENT_TYPE_OPTIONS.map(opt => (
                          <SelectItem key={opt.value} value={opt.value} className="text-xs font-medium">
                            {opt.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs font-bold text-slate-700">운영 시작일 *</Label>
                    <Input 
                      type="date" 
                      value={startDate} 
                      onChange={(e) => setStartDate(e.target.value)} 
                      className="h-9 text-xs rounded-xl font-medium" 
                      required 
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs font-bold text-slate-700">운영 종료일 *</Label>
                    <Input 
                      type="date" 
                      value={endDate} 
                      onChange={(e) => setEndDate(e.target.value)} 
                      className="h-9 text-xs rounded-xl font-medium" 
                      required 
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                      <MapPin className="w-3.5 h-3.5 text-indigo-600" />
                      주요 진행 장소 *
                    </Label>
                    <div className="flex flex-wrap gap-1">
                      {LOCATION_QUICK_TAGS.slice(0, 4).map(tag => (
                        <button
                          key={tag}
                          type="button"
                          onClick={() => setLocation(prev => prev ? `${prev}, ${tag}` : tag)}
                          className="px-1.5 py-0.5 text-[10px] bg-slate-100 hover:bg-slate-200 rounded text-slate-600 font-medium"
                        >
                          +{tag}
                        </button>
                      ))}
                    </div>
                  </div>
                  <Input 
                    placeholder="예: 학교 대운동장 및 메인 체육관"
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    className="h-9 text-xs rounded-xl"
                    required
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-bold text-slate-700">추진 목적 및 방침</Label>
                  <Textarea 
                    value={purpose}
                    onChange={(e) => setPurpose(e.target.value)}
                    rows={2}
                    placeholder="행사의 목적과 주요 운영 방침을 입력해주세요."
                    className="text-xs rounded-xl resize-none"
                  />
                </div>

                {/* 시간대별 타임테이블 */}
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2.5">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-indigo-600" />
                      시간대별 프로그램 및 타임테이블 ({schedules.length}개 일정)
                    </Label>
                    <Button 
                      type="button" 
                      variant="outline" 
                      size="sm" 
                      onClick={addScheduleItem}
                      className="h-6 px-2 text-[10px] font-semibold bg-white border-indigo-200 text-indigo-700 hover:bg-indigo-50"
                    >
                      <Plus className="w-3 h-3 mr-1" />
                      일정 추가
                    </Button>
                  </div>

                  <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                    {schedules.map((sc) => (
                      <div key={sc.id} className="flex items-center gap-1.5 p-2 bg-white rounded-lg border border-slate-200 shadow-2xs text-xs">
                        <Input 
                          placeholder="시간대"
                          value={sc.time}
                          onChange={(e) => updateScheduleItem(sc.id, 'time', e.target.value)}
                          className="h-7 text-[11px] w-28 shrink-0 font-medium"
                        />
                        <Input 
                          placeholder="프로그램 내용"
                          value={sc.program}
                          onChange={(e) => updateScheduleItem(sc.id, 'program', e.target.value)}
                          className="h-7 text-[11px] flex-1 font-semibold"
                        />
                        <Input 
                          placeholder="장소"
                          value={sc.location}
                          onChange={(e) => updateScheduleItem(sc.id, 'location', e.target.value)}
                          className="h-7 text-[11px] w-24 shrink-0 hidden sm:block"
                        />
                        <Button 
                          type="button" 
                          variant="ghost" 
                          size="sm" 
                          onClick={() => removeScheduleItem(sc.id)}
                          className="h-7 w-7 p-0 text-slate-400 hover:text-red-600 shrink-0"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>

                {/* 소요 예산 계획 */}
                <div className="p-3 bg-amber-50/60 border border-amber-200/80 rounded-xl space-y-2.5">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-bold text-amber-900 flex items-center gap-1.5">
                      <Coins className="w-3.5 h-3.5 text-amber-600" />
                      소요 예산 계획 (총 예산: 금 {totalBudget.toLocaleString()} VND)
                    </Label>
                    <Button 
                      type="button" 
                      variant="outline" 
                      size="sm" 
                      onClick={addBudgetItem}
                      className="h-6 px-2 text-[10px] font-semibold bg-white border-amber-300 text-amber-900 hover:bg-amber-100"
                    >
                      <Plus className="w-3 h-3 mr-1" />
                      예산 추가
                    </Button>
                  </div>

                  <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
                    {budgets.map((b) => (
                      <div key={b.id} className="flex items-center gap-1.5 p-2 bg-white rounded-lg border border-amber-200 shadow-2xs text-xs">
                        <Input 
                          placeholder="항목명"
                          value={b.item}
                          onChange={(e) => updateBudgetItem(b.id, 'item', e.target.value)}
                          className="h-7 text-[11px] flex-1 font-semibold"
                        />
                        <Input 
                          type="number"
                          placeholder="금액 (VND)"
                          value={b.amount}
                          onChange={(e) => updateBudgetItem(b.id, 'amount', Number(e.target.value) || 0)}
                          className="h-7 text-[11px] w-28 shrink-0 font-mono text-right"
                        />
                        <Input 
                          placeholder="비고 / 산출내역"
                          value={b.note}
                          onChange={(e) => updateBudgetItem(b.id, 'note', e.target.value)}
                          className="h-7 text-[11px] w-32 shrink-0 hidden sm:block"
                        />
                        <Button 
                          type="button" 
                          variant="ghost" 
                          size="sm" 
                          onClick={() => removeBudgetItem(b.id)}
                          className="h-7 w-7 p-0 text-slate-400 hover:text-red-600 shrink-0"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* ── 2. 업무 할당 대상 그룹 선택 ── */}
            <div className="space-y-2.5 pt-1">
              <Label className="text-xs font-bold text-slate-700">
                {taskCategory === 'event' ? '세부 계획/시나리오 작성 요청 대상 *' : '업무 할당 대상 그룹 *'}
              </Label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <button 
                  type="button"
                  onClick={() => setTargetType('dept')}
                  className={`flex items-center justify-center gap-1.5 py-2.5 px-2 rounded-xl border text-xs font-bold transition-all cursor-pointer select-none ${
                    targetType === 'dept' 
                      ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm ring-2 ring-indigo-200' 
                      : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100 hover:border-slate-300'
                  }`}
                >
                  <Building2 className="w-3.5 h-3.5 shrink-0" />
                  <span>소속 부서원</span>
                </button>

                <button 
                  type="button"
                  onClick={() => setTargetType('grade')}
                  className={`flex items-center justify-center gap-1.5 py-2.5 px-2 rounded-xl border text-xs font-bold transition-all cursor-pointer select-none ${
                    targetType === 'grade' 
                      ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm ring-2 ring-indigo-200' 
                      : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100 hover:border-slate-300'
                  }`}
                >
                  <GraduationCap className="w-3.5 h-3.5 shrink-0" />
                  <span>학년 교사</span>
                </button>

                <button 
                  type="button"
                  onClick={() => setTargetType('all')}
                  className={`flex items-center justify-center gap-1.5 py-2.5 px-2 rounded-xl border text-xs font-bold transition-all cursor-pointer select-none ${
                    targetType === 'all' 
                      ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm ring-2 ring-indigo-200' 
                      : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100 hover:border-slate-300'
                  }`}
                >
                  <Users className="w-3.5 h-3.5 shrink-0" />
                  <span>전체 교직원</span>
                </button>

                <button 
                  type="button"
                  onClick={() => setTargetType('custom')}
                  className={`flex items-center justify-center gap-1.5 py-2.5 px-2 rounded-xl border text-xs font-bold transition-all cursor-pointer select-none ${
                    targetType === 'custom' 
                      ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm ring-2 ring-indigo-200' 
                      : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100 hover:border-slate-300'
                  }`}
                >
                  <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                  <span>직접 선택</span>
                </button>
              </div>

              {/* Sub-selector A: 부서 복수 선택 */}
              {targetType === 'dept' && (
                <div className="p-3 bg-slate-50/90 border border-slate-200 rounded-xl space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-slate-600">대상 부서 다중 선택 ({selectedDepts.length}개 선택됨):</span>
                    <div className="flex gap-1.5">
                      <Button 
                        type="button" 
                        variant="outline" 
                        size="sm" 
                        onClick={selectAllDepts}
                        className="h-6 px-2 text-[10px] font-semibold bg-white"
                      >
                        전체 부서
                      </Button>
                      <Button 
                        type="button" 
                        variant="outline" 
                        size="sm" 
                        onClick={clearAllDepts}
                        className="h-6 px-2 text-[10px] font-semibold bg-white"
                      >
                        선택 해제
                      </Button>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {allDepartments.map((deptName) => {
                      const isSelected = selectedDepts.includes(deptName);
                      return (
                        <button
                          key={deptName}
                          type="button"
                          onClick={() => toggleDept(deptName)}
                          className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 border transition-all cursor-pointer ${
                            isSelected
                              ? 'bg-indigo-600 text-white border-indigo-600 shadow-2xs'
                              : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                          }`}
                        >
                          {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                          {deptName}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Sub-selector B: 학년 교사 복수 선택 */}
              {targetType === 'grade' && (
                <div className="p-3 bg-slate-50/90 border border-slate-200 rounded-xl space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-slate-600">대상 학년 다중 선택 ({selectedGrades.length}개 선택됨):</span>
                    <div className="flex flex-wrap gap-1">
                      <Button 
                        type="button" 
                        variant="outline" 
                        size="sm" 
                        onClick={() => setGradePreset('low')}
                        className="h-6 px-1.5 text-[10px] font-semibold bg-white"
                      >
                        1~2학년
                      </Button>
                      <Button 
                        type="button" 
                        variant="outline" 
                        size="sm" 
                        onClick={() => setGradePreset('mid')}
                        className="h-6 px-1.5 text-[10px] font-semibold bg-white"
                      >
                        3~4학년
                      </Button>
                      <Button 
                        type="button" 
                        variant="outline" 
                        size="sm" 
                        onClick={() => setGradePreset('high')}
                        className="h-6 px-1.5 text-[10px] font-semibold bg-white"
                      >
                        5~6학년
                      </Button>
                      <Button 
                        type="button" 
                        variant="outline" 
                        size="sm" 
                        onClick={() => setGradePreset('all')}
                        className="h-6 px-1.5 text-[10px] font-semibold bg-white"
                      >
                        전 학년
                      </Button>
                      <Button 
                        type="button" 
                        variant="outline" 
                        size="sm" 
                        onClick={() => setGradePreset('none')}
                        className="h-6 px-1.5 text-[10px] font-semibold bg-white"
                      >
                        해제
                      </Button>
                    </div>
                  </div>
                  <div className="grid grid-cols-3 sm:grid-cols-6 gap-1.5 pt-1">
                    {ALL_GRADES.map((g) => {
                      const isSelected = selectedGrades.includes(g);
                      return (
                        <button
                          key={g}
                          type="button"
                          onClick={() => toggleGrade(g)}
                          className={`py-2 px-1 rounded-xl text-xs font-bold flex flex-col items-center justify-center gap-0.5 border transition-all cursor-pointer ${
                            isSelected
                              ? 'bg-indigo-600 text-white border-indigo-600 shadow-2xs'
                              : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                          }`}
                        >
                          <div className="flex items-center gap-1">
                            {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                            <span>{g}</span>
                          </div>
                          <span className={`text-[10px] font-normal ${isSelected ? 'text-indigo-100' : 'text-slate-400'}`}>담임 및 부장</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Sub-selector C: 직접 선택 */}
              {targetType === 'custom' && (
                <div className="space-y-2 pt-1">
                  <div className="flex items-center gap-2">
                    <Input 
                      placeholder="교직원 이름 또는 소속 부서 검색..." 
                      value={customSearchQuery} 
                      onChange={(e) => setCustomSearchQuery(e.target.value)} 
                      className="h-8 text-xs rounded-lg flex-1"
                    />
                    <Button 
                      type="button" 
                      variant="outline" 
                      size="sm" 
                      onClick={selectAllCustom}
                      className="h-8 px-2 text-[11px] font-semibold shrink-0"
                    >
                      전체선택
                    </Button>
                    <Button 
                      type="button" 
                      variant="outline" 
                      size="sm" 
                      onClick={clearAllCustom}
                      className="h-8 px-2 text-[11px] font-semibold shrink-0"
                    >
                      선택해제
                    </Button>
                  </div>

                  <div className="border rounded-xl p-2 max-h-44 overflow-y-auto space-y-1 bg-white text-xs scrollbar-thin shadow-2xs">
                    {filteredCustomTeachers.map((t) => {
                      const isChecked = selectedCustomEmails.includes(t.email);
                      return (
                        <div 
                          key={t.email}
                          onClick={() => toggleCustomEmail(t.email)}
                          className="flex items-center justify-between p-1.5 rounded-lg hover:bg-indigo-50/60 cursor-pointer transition-colors"
                        >
                          <div className="flex items-center gap-2">
                            <input 
                              type="checkbox"
                              checked={isChecked}
                              readOnly
                              className="w-4 h-4 rounded text-indigo-600 pointer-events-none accent-indigo-600"
                            />
                            <span className="font-semibold text-slate-800">{t.name}</span>
                            <span className="text-[11px] text-slate-400">({t.dept || '교직원'})</span>
                          </div>
                        </div>
                      );
                    })}

                    {filteredCustomTeachers.length === 0 && (
                      <div className="text-center py-4 text-slate-400 text-xs">
                        {customSearchQuery ? '검색된 교직원이 없습니다.' : '등록된 교직원이 없습니다.'}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Recipient summary badge */}
              <div className="flex items-center gap-1.5 text-xs text-indigo-700 bg-indigo-50/80 p-2.5 rounded-xl font-medium">
                <Users className="w-4 h-4 text-indigo-600 shrink-0" />
                <span>
                  할당 대상: <strong>총 {targetRecipients.emails.length}명</strong>의 교직원이 업무를 부여받습니다.
                  {targetType === 'grade' && selectedGrades.length > 0 && (
                    <span className="ml-1.5 text-indigo-600 font-semibold">({selectedGrades.join(', ')})</span>
                  )}
                  {targetType === 'dept' && selectedDepts.length > 0 && (
                    <span className="ml-1.5 text-indigo-600 font-semibold">({selectedDepts.join(', ')})</span>
                  )}
                </span>
              </div>
            </div>

            {/* ── 3. 업무 해결 방식 (구글 시트 3종 스마트 프리셋) ── */}
            <div className="space-y-2.5 pt-1">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                  <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
                  업무 해결 방식 (협업 및 제출 양식 선택) *
                </Label>
              </div>

              {/* 5가지 해결 방식 카드 그리드 */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {/* 1. 파일 제출형 */}
                <button
                  type="button"
                  onClick={() => setTaskType('file_submission')}
                  className={`p-3 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                    taskType === 'file_submission'
                      ? 'bg-indigo-50/80 border-indigo-500 ring-2 ring-indigo-200'
                      : 'bg-white border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-sm">📁</span>
                    <span className="text-xs font-bold text-slate-800">문서 / 파일 개별 제출형</span>
                  </div>
                  <p className="text-[11px] text-slate-500 mt-1">
                    배포된 서식 파일(한글 hwp, 엑셀 xlsx 등)을 내려받아 작성하거나 개별 파일을 작성하여 업로드합니다.
                  </p>
                </button>

                {/* 2. 단순 확인형 */}
                <button
                  type="button"
                  onClick={() => setTaskType('acknowledgment')}
                  className={`p-3 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                    taskType === 'acknowledgment'
                      ? 'bg-indigo-50/80 border-indigo-500 ring-2 ring-indigo-200'
                      : 'bg-white border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-sm">✓</span>
                    <span className="text-xs font-bold text-slate-800">단순 확인 완료형</span>
                  </div>
                  <p className="text-[11px] text-slate-500 mt-1">
                    지침이나 공지사항 확인 후 [확인 완료] 원클릭 체크로 해결합니다.
                  </p>
                </button>

                {/* 3. 사용자 문서 링크형 (시트, 슬라이드, 설문지 등) */}
                <button
                  type="button"
                  onClick={() => setTaskType('sheets_custom')}
                  className={`p-3 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                    taskType === 'sheets_custom'
                      ? 'bg-emerald-50/80 border-emerald-500 ring-2 ring-emerald-200'
                      : 'bg-white border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                    <span className="text-xs font-bold text-slate-800">사용자 문서 링크형</span>
                  </div>
                  <p className="text-[11px] text-slate-500 mt-1">
                    Google Sheets, Docs, Slides 또는 설문지(Google Forms) URL을 연결하여 교원들이 협업하거나 응답합니다.
                  </p>
                </button>

                {/* 4. 표준 시트 양식 배포 */}
                <button
                  type="button"
                  onClick={() => setTaskType('sheets_template')}
                  className={`p-3 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                    taskType === 'sheets_template'
                      ? 'bg-emerald-50/80 border-emerald-500 ring-2 ring-emerald-200'
                      : 'bg-white border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <Table className="w-4 h-4 text-emerald-600" />
                    <span className="text-xs font-bold text-slate-800">표준 시트 양식 배포</span>
                  </div>
                  <p className="text-[11px] text-slate-500 mt-1">
                    행사 계획, 예산/물품 신청 등 시스템 표준 시트 양식을 중앙 드라이브에 자동 생성하여 배포합니다.
                  </p>
                </button>

                {/* 5. 기안문 붙임 문서 자동 생성형 */}
                <button
                  type="button"
                  onClick={() => setTaskType('html_draft')}
                  className={`p-3 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between sm:col-span-2 ${
                    taskType === 'html_draft'
                      ? 'bg-indigo-50/90 border-indigo-600 ring-2 ring-indigo-200'
                      : 'bg-white border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-amber-500" />
                      <span className="text-xs font-bold text-slate-900">기안문 붙임 문서 자동 생성형</span>
                    </div>
                    <span className="text-[10px] font-bold px-2 py-0.5 bg-indigo-100 text-indigo-700 rounded-full">원클릭 결재 상신</span>
                  </div>
                  <p className="text-[11px] text-slate-600 mt-1">
                    교원들의 입력 결과가 공문서 무테 표로 자동 취합되어, [기안문 상신] 클릭 시 본문 및 [붙임] 서식으로 100% 직행합니다.
                  </p>
                </button>
              </div>

              {/* ── 세부 옵션 A: 사용자 지정 Google Sheets / Docs / Slides / Forms URL 입력창 ── */}
              {taskType === 'sheets_custom' && (
                <div className="p-3.5 bg-emerald-50/80 border border-emerald-200 rounded-xl space-y-2">
                  <div className="flex items-center justify-between flex-wrap gap-1">
                    <Label className="text-xs font-bold text-emerald-900 flex items-center gap-1.5">
                      <Link2 className="w-3.5 h-3.5 text-emerald-600" />
                      Google 시트 / 문서 / 슬라이드 / 설문지(Forms) 웹 URL *
                    </Label>
                    <div className="flex items-center gap-2 text-[11px]">
                      <a 
                        href="https://forms.new" 
                        target="_blank" 
                        rel="noreferrer"
                        className="text-purple-700 hover:underline flex items-center gap-0.5 font-semibold"
                      >
                        새 설문지 <ExternalLink className="w-2.5 h-2.5" />
                      </a>
                      <span className="text-emerald-300">|</span>
                      <a 
                        href="https://sheets.new" 
                        target="_blank" 
                        rel="noreferrer"
                        className="text-emerald-700 hover:underline flex items-center gap-0.5 font-semibold"
                      >
                        새 시트 <ExternalLink className="w-2.5 h-2.5" />
                      </a>
                    </div>
                  </div>
                  <Input 
                    placeholder="https://docs.google.com/forms/..., spreadsheets/..., document/... 등"
                    value={customSheetUrl}
                    onChange={(e) => setCustomSheetUrl(e.target.value)}
                    className="h-9 text-xs rounded-xl bg-white border-emerald-300 font-mono"
                    required
                  />
                  <p className="text-[11px] text-emerald-700">
                    * 구글 스프레드시트, 구글 문서, 프레젠테이션, 또는 구글 설문지(Google Forms) 공유 링크를 등록하세요. (학교 계정: <strong>@kshcm.net</strong>)
                  </p>
                </div>
              )}

              {/* ── 세부 옵션 B: 표준 프리셋 템플릿 선택 및 컬럼 편집창 ── */}
              {taskType === 'sheets_template' && (
                <div className="p-4 bg-emerald-50/90 border border-emerald-200 rounded-xl space-y-3.5 shadow-2xs">
                  {/* 상단 템플릿 선택 및 저장 바 */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-emerald-200/80 pb-2.5">
                    <div className="flex-1 min-w-0">
                      <Label className="text-xs font-black text-emerald-950 flex items-center gap-1.5">
                        <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                        제공할 표준 프리셋 템플릿 선택 *
                      </Label>
                      <p className="text-[11px] text-emerald-800 mt-0.5">
                        선택한 템플릿의 컬럼명을 직접 바꾸거나, 필요한 항목을 추가/삭제하여 업무를 배포할 수 있습니다.
                      </p>
                    </div>
                    {/* 관리자: 현재 수정한 템플릿을 학교 표준 템플릿으로 영구 저장 */}
                    <Button
                      type="button"
                      size="sm"
                      onClick={handleSaveCurrentAsSchoolTemplate}
                      disabled={isSavingTemplate}
                      className="h-7 px-2.5 text-xs font-bold bg-emerald-700 hover:bg-emerald-800 text-white shadow-2xs shrink-0 flex items-center gap-1 cursor-pointer"
                      title="수정한 컬럼 구성을 학교 표준 템플릿으로 영구 저장합니다."
                    >
                      {isSavingTemplate ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <Save className="w-3 h-3 mr-1" />}
                      <span>학교 표준 템플릿으로 저장</span>
                    </Button>
                  </div>

                  {/* 템플릿 드롭다운 선택 */}
                  <div className="space-y-1">
                    <Select value={selectedTemplateId} onValueChange={setSelectedTemplateId}>
                      <SelectTrigger className="h-9 text-xs rounded-xl bg-white border-emerald-300 font-bold text-slate-800 shadow-2xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="max-h-60">
                        {systemTemplates.map(t => (
                          <SelectItem key={t.id} value={t.id} className="text-xs font-medium">
                            <div className="flex items-center gap-2">
                              <span>{t.name}</span>
                              {t.isCustom && (
                                <Badge variant="outline" className="text-[9px] bg-emerald-100 text-emerald-800 font-bold px-1 py-0 h-4">
                                  학교 맞춤형
                                </Badge>
                              )}
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {(() => {
                      const t = systemTemplates.find(tpl => tpl.id === selectedTemplateId);
                      return t?.desc ? <p className="text-[11px] text-emerald-700 px-1">{t.desc}</p> : null;
                    })()}
                  </div>

                  {/* 템플릿 컬럼 편집 섹션 (컬럼명 변경 / 추가 / 삭제 가능) */}
                  <div className="space-y-2 pt-1">
                    <div className="flex items-center justify-between flex-wrap gap-1">
                      <span className="text-[11px] font-bold text-emerald-950 flex items-center gap-1">
                        <span>선택된 템플릿 컬럼 구성 ({templateColumns.length}개 항목)</span>
                        <Badge variant="outline" className="text-[9px] bg-white text-emerald-700 border-emerald-200">
                          자유 편집 가능
                        </Badge>
                      </span>

                      <div className="flex items-center gap-1.5">
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          onClick={handleTemplateResetToOriginal}
                          className="h-6 px-1.5 text-xs text-emerald-800 hover:bg-emerald-100/70 flex items-center gap-1 cursor-pointer"
                          title="템플릿 초기 기본 컬럼으로 복원"
                        >
                          <RotateCcw className="w-3 h-3 text-emerald-600" />
                          <span>원본 복원</span>
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          onClick={handleTemplateClearColumns}
                          className="h-6 px-1.5 text-xs text-slate-500 hover:text-rose-600 hover:bg-rose-50 flex items-center gap-1 cursor-pointer"
                        >
                          <Trash2 className="w-3 h-3 text-slate-400" />
                          <span>내용 비우기</span>
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={handleTemplateAddColumn}
                          className="h-6 px-2 text-xs font-bold text-emerald-800 bg-white border-emerald-300 hover:bg-emerald-100 flex items-center gap-1 shadow-2xs cursor-pointer"
                        >
                          <Plus className="w-3 h-3" />
                          <span>항목 추가</span>
                        </Button>
                      </div>
                    </div>

                    {/* 컬럼 개별 입력 및 수정 리스트 */}
                    <div className="space-y-1.5 max-h-[220px] overflow-y-auto pr-1">
                      {templateColumns.map((col, index) => (
                        <div 
                          key={col.id} 
                          className="flex items-center gap-2 p-2 bg-white rounded-xl border border-emerald-200 shadow-2xs"
                        >
                          {/* 순서 뱃지 & 위/아래 이동 */}
                          <div className="flex items-center gap-1 shrink-0">
                            <span className="w-10 text-center py-0.5 text-[10px] font-bold bg-emerald-100 text-emerald-800 rounded-md">
                              열 {index + 1}
                            </span>
                            <div className="flex flex-col">
                              <button
                                type="button"
                                disabled={index === 0}
                                onClick={() => handleTemplateMoveColumn(index, 'up')}
                                className="text-slate-400 hover:text-emerald-700 disabled:opacity-20 p-0.5 cursor-pointer"
                                title="위로 이동"
                              >
                                <ArrowUp className="w-2.5 h-2.5" />
                              </button>
                              <button
                                type="button"
                                disabled={index === templateColumns.length - 1}
                                onClick={() => handleTemplateMoveColumn(index, 'down')}
                                className="text-slate-400 hover:text-emerald-700 disabled:opacity-20 p-0.5 cursor-pointer"
                                title="아래로 이동"
                              >
                                <ArrowDown className="w-2.5 h-2.5" />
                              </button>
                            </div>
                          </div>

                          {/* 컬럼 이름(항목명) 입력 및 수정칸 */}
                          <div className="flex-1 min-w-[150px]">
                            <Input
                              value={col.name}
                              onChange={(e) => handleTemplateUpdateColumn(col.id, e.target.value)}
                              placeholder={`열 ${index + 1} 이름 (예: 프로그램명, 장소 등)`}
                              className="h-8 text-xs font-bold bg-slate-50/50 border-emerald-300 focus:border-emerald-500"
                              required
                            />
                          </div>

                          {/* 삭제 버튼 */}
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => handleTemplateRemoveColumn(col.id)}
                            className="h-7 w-7 p-0 text-slate-400 hover:text-rose-600 hover:bg-rose-50 shrink-0 cursor-pointer"
                            title="컬럼 삭제"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      ))}
                    </div>

                    {/* 실시간 템플릿 컬럼 뱃지 미리보기 */}
                    <div className="pt-1 border-t border-emerald-200/60 flex items-center gap-1.5 flex-wrap">
                      <span className="text-[10.5px] font-bold text-emerald-900">배포될 컬럼 미리보기:</span>
                      {templateColumns.map((col, idx) => (
                        <span key={col.id || idx} className="px-2 py-0.5 text-[10px] bg-white border border-emerald-300 rounded-md text-emerald-900 font-bold shadow-2xs">
                          {col.name || `(열 ${idx + 1})`}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* ── 세부 옵션 C: 기안문 직행 HTML 표 컬럼 스마트 빌더 (개별 입력칸 지원) ── */}
              {taskType === 'html_draft' && (
                <div className="p-4 bg-indigo-50/90 border border-indigo-200 rounded-xl space-y-3.5 shadow-2xs">
                  {/* 상단 안내 & 템플릿 프리셋 선택 */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-indigo-200/80 pb-2.5">
                    <div>
                      <Label className="text-xs font-black text-indigo-950 flex items-center gap-1.5">
                        <Table className="w-4 h-4 text-indigo-600" />
                        취합 및 공문서 표 컬럼(항목) 개별 구성
                      </Label>
                      <p className="text-[11px] text-indigo-800 mt-0.5">
                        각 열의 이름과, 교사가 무엇을 적어야 하는지 입력 안내(예시)를 명확하게 지정할 수 있습니다.
                      </p>
                    </div>
                    {/* 프리셋 버튼 그룹 */}
                    <div className="flex items-center gap-1 flex-wrap">
                      <span className="text-[10px] text-indigo-700 font-bold whitespace-nowrap">추천 양식:</span>
                      {COLUMN_PRESETS.map(preset => (
                        <button
                          key={preset.id}
                          type="button"
                          onClick={() => handleApplyPreset(preset.id)}
                          className="px-2 py-0.5 text-[10.5px] bg-white hover:bg-indigo-100/80 text-indigo-800 border border-indigo-200 rounded-lg font-bold transition shadow-2xs cursor-pointer"
                        >
                          {preset.title}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* 개별 컬럼 입력 리스트 (어디다 어떤 정보를 적어야 하는지 명확한 입력칸 제공) */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold text-slate-700">
                        표 항목 목록 ({draftColumns.length}개 컬럼)
                      </span>
                      <div className="flex items-center gap-1.5">
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          onClick={handleClearColumns}
                          className="h-6 px-2 text-xs font-semibold text-slate-500 hover:text-rose-600 hover:bg-rose-50 flex items-center gap-1 cursor-pointer"
                        >
                          <Trash2 className="w-3 h-3 text-slate-400" />
                          <span>내용 비우기</span>
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={handleAddColumn}
                          className="h-6 px-2.5 text-xs font-bold text-indigo-700 bg-white border-indigo-300 hover:bg-indigo-100 flex items-center gap-1 shadow-2xs cursor-pointer"
                        >
                          <Plus className="w-3 h-3" />
                          <span>항목 추가</span>
                        </Button>
                      </div>
                    </div>

                    <div className="space-y-1.5 max-h-[260px] overflow-y-auto pr-1">
                      {draftColumns.map((col, index) => (
                        <div 
                          key={col.id} 
                          className="flex items-center gap-2 p-2 bg-white rounded-xl border border-indigo-200/90 shadow-2xs"
                        >
                          {/* 순서 및 뱃지 */}
                          <div className="flex items-center gap-1 shrink-0">
                            <span className="w-10 text-center py-0.5 text-[10px] font-bold bg-indigo-100 text-indigo-800 rounded-md">
                              열 {index + 1}
                            </span>
                            <div className="flex flex-col">
                              <button
                                type="button"
                                disabled={index === 0}
                                onClick={() => handleMoveColumn(index, 'up')}
                                className="text-slate-400 hover:text-indigo-600 disabled:opacity-20 p-0.5 cursor-pointer"
                                title="위로 이동"
                              >
                                <ArrowUp className="w-2.5 h-2.5" />
                              </button>
                              <button
                                type="button"
                                disabled={index === draftColumns.length - 1}
                                onClick={() => handleMoveColumn(index, 'down')}
                                className="text-slate-400 hover:text-indigo-600 disabled:opacity-20 p-0.5 cursor-pointer"
                                title="아래로 이동"
                              >
                                <ArrowDown className="w-2.5 h-2.5" />
                              </button>
                            </div>
                          </div>

                          {/* 컬럼 이름(항목명) 입력칸 */}
                          <div className="w-1/3 min-w-[120px]">
                            <Input
                              value={col.name}
                              onChange={(e) => handleUpdateColumn(col.id, 'name', e.target.value)}
                              placeholder="열 이름 (예: 프로그램명)"
                              className="h-8 text-xs font-bold bg-slate-50/50 border-slate-300"
                              required
                            />
                          </div>

                          {/* 어디다 어떤 정보 적어야 하는지 안내/예시 입력칸 */}
                          <div className="flex-1 min-w-[150px]">
                            <Input
                              value={col.guide}
                              onChange={(e) => handleUpdateColumn(col.id, 'guide', e.target.value)}
                              placeholder="어디에 어떤 내용 입력할지 예시 안내 (예: 볼풀공 던지기 / 릴레이)"
                              className="h-8 text-xs bg-slate-50/50 border-slate-300"
                            />
                          </div>

                          {/* 삭제 버튼 */}
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => handleRemoveColumn(col.id)}
                            className="h-7 w-7 p-0 text-slate-400 hover:text-rose-600 hover:bg-rose-50 shrink-0 cursor-pointer"
                            title="컬럼 삭제"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* 실시간 표 미리보기 (작성 교사가 보게 될 화면) */}
                  <div className="space-y-1.5 pt-1">
                    <div className="flex items-center justify-between">
                      <Label className="text-[11px] font-bold text-indigo-900 flex items-center gap-1">
                        <Sparkles className="w-3 h-3 text-indigo-600" />
                        실시간 표 렌더링 미리보기 (작성 교사가 보게 될 양식)
                      </Label>
                      <span className="text-[10px] text-slate-500">하단 연한 회색 글씨는 입력 예시 안내입니다.</span>
                    </div>
                    <div className="border border-indigo-200 rounded-xl overflow-x-auto bg-white shadow-2xs">
                      <table className="w-full text-xs text-left border-collapse">
                        <thead>
                          <tr className="bg-indigo-100/60 border-b border-indigo-200">
                            {draftColumns.map((col, idx) => (
                              <th key={col.id || idx} className="p-2 font-bold text-indigo-950 border-r border-indigo-200 last:border-r-0 whitespace-nowrap">
                                {col.name || `열 ${idx + 1}`}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          <tr className="bg-white">
                            {draftColumns.map((col, idx) => (
                              <td key={col.id || idx} className="p-2 text-slate-400 italic text-[11px] border-r border-indigo-100 last:border-r-0">
                                {col.guide || '내용 입력칸'}
                              </td>
                            ))}
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* ── 4. 마감 기한 및 세부 안내 ── */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-slate-700">제출 마감 일시 *</Label>
                <Input 
                  type="date"
                  value={deadline}
                  onChange={(e) => setDeadline(e.target.value)}
                  className="h-9 text-xs rounded-xl font-medium"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-slate-700">추가 안내 사항 (선택)</Label>
                <Input 
                  placeholder="예: 각 학년부장님께서 취합 후 최종 제출 바랍니다."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="h-9 text-xs rounded-xl"
                />
              </div>
            </div>

            {/* ── 5. 업무 참고자료 (이미지, PDF, 관련 공문 문서 등) ── */}
            <div className="space-y-2 pt-2 border-t border-slate-200/80">
              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                    <Paperclip className="w-3.5 h-3.5 text-indigo-600" />
                    업무 참고자료 등록 (선택)
                  </Label>
                  <p className="text-[11px] text-slate-500">
                    교원들이 업무 전 확인할 관련 공문, 안내 자료 또는 <strong>작성용 제출 서식 파일(한글 hwp, 엑셀 xlsx 등)</strong>을 등록하세요. 교원들은 이 서식을 내려받아 작성 후 제출할 수 있습니다.
                  </p>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => setDrivePickerOpen(true)}
                    className="h-7 px-2.5 text-xs font-bold text-indigo-700 bg-indigo-50/70 border-indigo-200 hover:bg-indigo-100 flex items-center gap-1 shadow-2xs cursor-pointer"
                  >
                    <HardDrive className="w-3.5 h-3.5 mr-0.5 text-indigo-600" />
                    <span>Google Drive 연결</span>
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => attachmentInputRef.current?.click()}
                    disabled={isUploadingAttachment}
                    className="h-7 px-2.5 text-xs font-bold text-slate-700 bg-white border-slate-300 hover:bg-slate-100 flex items-center gap-1 shadow-2xs cursor-pointer"
                  >
                    {isUploadingAttachment ? (
                      <Loader2 className="w-3 h-3 animate-spin mr-1" />
                    ) : (
                      <FileUp className="w-3 h-3 mr-1" />
                    )}
                    <span>파일 첨부</span>
                  </Button>
                </div>
                <input
                  type="file"
                  ref={attachmentInputRef}
                  onChange={handleAttachmentUpload}
                  multiple
                  accept="image/*,.pdf,.hwp,.hwpx,.doc,.docx,.xls,.xlsx,.ppt,.pptx"
                  className="hidden"
                />
              </div>

              {/* 첨부된 파일 목록 */}
              {attachments.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                  {attachments.map((att, idx) => {
                    const isImage = !att.isGoogleDrive && (att.type?.startsWith('image/') || /\.(png|jpe?g|webp|gif)$/i.test(att.name));
                    const isPdf = att.isGoogleDrive ? att.driveFileType === 'pdf' : (att.type === 'application/pdf' || /\.pdf$/i.test(att.name));
                    const driveInfo = att.isGoogleDrive ? getDriveTypeInfo(att.driveFileType) : null;

                    return (
                      <div
                        key={idx}
                        className="flex items-center gap-2.5 p-2 bg-white rounded-xl border border-indigo-100 shadow-2xs group"
                      >
                        {att.isGoogleDrive ? (
                          <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center shrink-0 border", driveInfo?.bgColor, driveInfo?.borderColor)}>
                            {att.driveFileType === 'sheet' && <FileSpreadsheet className="w-4 h-4 text-emerald-700" />}
                            {att.driveFileType === 'doc' && <FileText className="w-4 h-4 text-blue-700" />}
                            {att.driveFileType === 'slide' && <Presentation className="w-4 h-4 text-amber-700" />}
                            {att.driveFileType === 'folder' && <Folder className="w-4 h-4 text-indigo-700" />}
                            {att.driveFileType === 'pdf' && <span className="text-[9px] font-black text-rose-700">PDF</span>}
                            {(!att.driveFileType || att.driveFileType === 'file') && <HardDrive className="w-4 h-4 text-slate-700" />}
                          </div>
                        ) : isImage ? (
                          <div className="w-8 h-8 rounded-lg bg-slate-100 overflow-hidden shrink-0 border border-slate-200">
                            <img src={att.url} alt={att.name} className="w-full h-full object-cover" />
                          </div>
                        ) : isPdf ? (
                          <div className="w-8 h-8 rounded-lg bg-rose-50 border border-rose-200 flex items-center justify-center shrink-0 text-[10px] font-black text-rose-600">
                            PDF
                          </div>
                        ) : (
                          <div className="w-8 h-8 rounded-lg bg-indigo-50 border border-indigo-200 flex items-center justify-center shrink-0 text-indigo-600">
                            <FileText className="w-4 h-4" />
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            <p className="text-xs font-bold text-slate-800 truncate" title={att.name}>
                              {att.name}
                            </p>
                            {att.isGoogleDrive && (
                              <Badge className={cn("text-[9px] px-1 py-0 h-3.5 shrink-0", driveInfo?.badgeColor)}>
                                {driveInfo?.label}
                              </Badge>
                            )}
                          </div>
                          <p className="text-[10px] text-slate-400">
                            {att.isGoogleDrive ? 'Google Drive 클라우드 문서' : (att.size ? `${(att.size / 1024).toFixed(1)} KB` : '첨부 문서')}
                          </p>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <a
                            href={att.url}
                            target="_blank"
                            rel="noreferrer"
                            className="p-1 text-slate-400 hover:text-indigo-600 rounded-md hover:bg-slate-100"
                            title="새 창에서 열기"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                          </a>
                          <button
                            type="button"
                            onClick={() => handleRemoveAttachment(idx)}
                            className="p-1 text-slate-400 hover:text-rose-600 rounded-md hover:bg-rose-50 cursor-pointer"
                            title="삭제"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="flex flex-col sm:flex-row items-center gap-2 p-2.5 border border-dashed border-slate-300 rounded-xl bg-slate-50/50 text-xs text-slate-500">
                  <div 
                    onClick={() => attachmentInputRef.current?.click()}
                    className="flex-1 flex items-center justify-center gap-1.5 py-1.5 px-2 hover:text-indigo-600 hover:bg-indigo-50/50 rounded-lg cursor-pointer transition-colors w-full sm:w-auto"
                  >
                    <FileUp className="w-4 h-4 text-slate-400" />
                    <span>로컬 파일(이미지, PDF, 문서) 첨부</span>
                  </div>
                  <span className="hidden sm:inline text-slate-300">|</span>
                  <div
                    onClick={() => setDrivePickerOpen(true)}
                    className="flex-1 flex items-center justify-center gap-1.5 py-1.5 px-2 text-indigo-700 hover:bg-indigo-50/80 rounded-lg cursor-pointer transition-colors font-semibold w-full sm:w-auto"
                  >
                    <HardDrive className="w-4 h-4 text-indigo-600" />
                    <span>Google Drive 문서/스프레드시트 연결</span>
                  </div>
                </div>
              )}
            </div>
          </div>

          <DialogFooter className="p-3.5 sm:p-4 border-t bg-slate-50/90 shrink-0 flex items-center justify-between sm:justify-end gap-2">
            <Button 
              type="button" 
              variant="outline" 
              size="sm" 
              onClick={() => onOpenChange(false)}
              className="h-8 px-3.5 text-xs font-bold rounded-xl"
            >
              취소
            </Button>
            <Button 
              type="submit" 
              size="sm" 
              disabled={isSubmitting}
              className="h-8 px-4 text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl shadow-xs"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                  업무 생성 중...
                </>
              ) : (
                <>
                  <Plus className="w-3.5 h-3.5 mr-1.5" />
                  {taskCategory === 'event' ? '행사 계획 생성 및 업무 할당' : '업무 할당 및 요청 생성'}
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
      <GoogleDrivePickerModal
        open={drivePickerOpen}
        onOpenChange={setDrivePickerOpen}
        onSelect={handleSelectDriveAttachment}
      />
    </Dialog>
  );
}
