'use client';

import { bulkRegisterUsers, bulkRegisterStudents, getUsersDirectory, saveUserProfile, deleteUser, invalidateUsersCache } from '@/lib/services/userService';
import { getDocConfig, saveDocConfig, getOrgStructure, saveOrgStructure, getDelegationRules, saveDelegationRules, DEFAULT_DELEGATION_RULES } from '@/lib/services/settingsService';
import { getAuditLogs } from '@/lib/services/documentService';
import { DocConfig, UserProfile, OrgStructure, DelegationRule, AcademicCalendarConfig, AcademicEvent, AcademicSemesterPeriod, FieldTripBlackoutPeriod, DEFAULT_FIELD_TRIP_BLACKOUT_PERIODS } from '@/lib/types';
import { compressImage, generateAcademicIcsFile } from '@/lib/utils';
import { ChangeEvent, useEffect, useMemo, useRef, useState, useTransition } from 'react';
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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Button } from './ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Loader2, Image as ImageIcon, Users, Settings as SettingsIcon, FileUp, Download, PlusCircle, Save, XCircle, Trash2, Network, FileText, Pencil, Calendar, Globe, Sparkles, RotateCcw } from 'lucide-react';
import NextImage from 'next/image';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { ScrollArea } from './ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Switch } from './ui/switch';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import * as xlsx from 'xlsx';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { useAuth } from '@/hooks/use-auth';

const ROLES = ['교사', '교감', '교장', '행정실장', '주무관', '담당'];

function getUserDepartmentOrClass(email: string, orgStructure: OrgStructure): string {
  if (!email) return '미배정';
  const emailLower = email.toLowerCase();
  const roles: string[] = [];

  if (orgStructure.principal?.toLowerCase() === emailLower) roles.push('교장');
  if (orgStructure.vicePrincipal?.toLowerCase() === emailLower) roles.push('교감');
  
  if (orgStructure.systemManagers?.map(m => m.toLowerCase()).includes(emailLower)) {
    roles.push('시스템 설정 담당');
  }
  if (orgStructure.afterschoolManagers?.map(m => m.toLowerCase()).includes(emailLower)) {
    roles.push('방과후학교 담당');
  }
  if (orgStructure.busManagers?.map(m => m.toLowerCase()).includes(emailLower)) {
    roles.push('스쿨버스 담당');
  }

  if (orgStructure.healthTeachers?.map(m => m.toLowerCase()).includes(emailLower)) {
    roles.push('보건교사');
  }
  if (orgStructure.specialTeachers?.map(m => m.toLowerCase()).includes(emailLower)) {
    roles.push('특수교사');
  }
  if (orgStructure.librarianTeachers?.map(m => m.toLowerCase()).includes(emailLower)) {
    roles.push('사서교사');
  }
  if (orgStructure.subjectTeacherGroups) {
    for (const group of orgStructure.subjectTeacherGroups) {
      if (group.teacherEmails?.map(m => m.toLowerCase()).includes(emailLower)) {
        roles.push(`${group.categoryName} 교과전담`);
      }
    }
  }

  if (orgStructure.gradeHeads) {
    for (const [grade, headEmail] of Object.entries(orgStructure.gradeHeads)) {
      if (headEmail?.toLowerCase() === emailLower) {
        roles.push(`${grade}학년 부장`);
      }
    }
  }

  if (orgStructure.gradeSubjects) {
    for (const [grade, emails] of Object.entries(orgStructure.gradeSubjects)) {
      if (emails?.some(m => m?.toLowerCase() === emailLower)) {
        roles.push(`${grade}학년 교과`);
      }
    }
  }

  if (orgStructure.homerooms) {
    for (const [gradeClass, teacherEmail] of Object.entries(orgStructure.homerooms)) {
      if (teacherEmail?.toLowerCase() === emailLower) {
        roles.push(`${gradeClass} 담임`);
      }
    }
  }

  if (orgStructure.departments) {
    for (const dept of orgStructure.departments) {
      if (dept.headEmail?.toLowerCase() === emailLower) {
        roles.push(`${dept.name} (부장)`);
      }
      if (dept.memberEmails?.some(m => m?.toLowerCase() === emailLower)) {
        roles.push(`${dept.name} (부원)`);
      }
    }
  }

  return roles.length > 0 ? roles.join(', ') : '미배정';
}

export function SettingsModal() {
  const { profile } = useAuth();
  const { toast } = useToast();
  const [isOpen, setIsOpen] = useState(false);
  const [isSaving, startSaving] = useTransition();
  const [isUploading, startUploading] = useTransition();
  const [config, setConfig] = useState<DocConfig>({});
  const [headerPreview, setHeaderPreview] = useState<string>('');

  const DEFAULT_ACADEMIC_CALENDAR: AcademicCalendarConfig = {
    year: 2026,
    annualSchoolDays: 190,
    semesters: {
      sem1: { id: 'sem1', name: '2026학년도 1학기', startDate: '2026-03-02', endDate: '2026-07-17', type: 'regular' },
      vacationSummer: { id: 'vacationSummer', name: '2026학년도 여름방학', startDate: '2026-07-18', endDate: '2026-08-23', type: 'vacation' },
      sem2: { id: 'sem2', name: '2026학년도 2학기', startDate: '2026-08-24', endDate: '2026-12-31', type: 'regular' },
      vacationWinter: { id: 'vacationWinter', name: '2027학년도 겨울방학', startDate: '2027-01-01', endDate: '2027-02-28', type: 'vacation' }
    },
    events: [
      { id: '1', date: '2026-03-01', title: '삼일절', type: 'PUBLIC_HOLIDAY', isSchoolDay: false },
      { id: '2', date: '2026-05-01', title: '근로자의 날 / 재량휴업일', type: 'HOLIDAY', isSchoolDay: false },
      { id: '3', date: '2026-05-05', title: '어린이날', type: 'PUBLIC_HOLIDAY', isSchoolDay: false },
      { id: '4', date: '2026-09-02', title: '독립기념일 (베트남)', type: 'PUBLIC_HOLIDAY', isSchoolDay: false },
      { id: '5', date: '2026-09-25', title: '추석', type: 'PUBLIC_HOLIDAY', isSchoolDay: false },
      { id: '6', date: '2026-10-09', title: '한글날', type: 'PUBLIC_HOLIDAY', isSchoolDay: false },
      { id: '7', date: '2026-10-16', title: '학교 창립기념 행사의 날', type: 'SCHOOL_EVENT', isSchoolDay: true }
    ]
  };

  const [academicCal, setAcademicCal] = useState<AcademicCalendarConfig>(DEFAULT_ACADEMIC_CALENDAR);
  const [newEventDate, setNewEventDate] = useState('');
  const [newEventTitle, setNewEventTitle] = useState('');
  const [newEventType, setNewEventType] = useState<'HOLIDAY' | 'PUBLIC_HOLIDAY' | 'SCHOOL_EVENT'>('HOLIDAY');
  const [isNewEventParentPrivate, setIsNewEventParentPrivate] = useState(false);

  const handleAddAcademicEvent = () => {
    if (!newEventDate || !newEventTitle.trim()) {
      toast({ variant: 'destructive', title: '입력 오류', description: '날짜와 행사명을 입력해주세요.' });
      return;
    }
    const isSchoolDay = newEventType === 'SCHOOL_EVENT';
    const newEv: AcademicEvent = {
      id: Date.now().toString(),
      date: newEventDate,
      title: newEventTitle.trim(),
      type: newEventType,
      isSchoolDay,
      isParentPrivate: isNewEventParentPrivate
    };
    setAcademicCal(prev => ({
      ...prev,
      events: [...prev.events.filter(e => e.date !== newEventDate), newEv].sort((a, b) => (a.date || '').localeCompare(b.date || ''))
    }));
    setNewEventDate('');
    setNewEventTitle('');
    setIsNewEventParentPrivate(false);
    toast({ title: '학사 일정 추가', description: `${newEventDate} (${newEventTitle.trim()})가 추가되었습니다.` });
  };

  const handleBroadcastCalendarSync = async () => {
    try {
      const nextVer = (academicCal.publishedVersion || 0) + 1;
      const updatedCal: AcademicCalendarConfig = {
        ...academicCal,
        publishedVersion: nextVer,
        lastPublishedAt: new Date().toISOString()
      };
      setAcademicCal(updatedCal);
      const finalConfig = {
        ...config,
        annualSchoolDays: updatedCal.annualSchoolDays,
        academicCalendar: updatedCal
      };
      await saveDocConfig(finalConfig);
      toast({
        title: '전체 사용자 공유 알림 발송 완료',
        description: `(v${nextVer}) 전체 교직원 및 학부모 계정 접속 시 최신 학사 일정 캘린더 공유 팝업 알림이 전송됩니다.`
      });
    } catch (err: any) {
      toast({ variant: 'destructive', title: '발송 오류', description: err.message });
    }
  };

  const handleDeleteAcademicEvent = (eventId: string) => {
    setAcademicCal(prev => ({
      ...prev,
      events: prev.events.filter(e => e.id !== eventId)
    }));
  };

  const handleExportIcsFile = () => {
    try {
      const icsContent = generateAcademicIcsFile(academicCal);
      const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `KSHCM_academic_calendar_${academicCal.year || 2026}.ics`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      toast({ title: '캘린더 파일 내보내기 완료', description: 'Google Calendar/Outlook/스마트폰에 등록 가능한 .ics 파일이 다운로드되었습니다.' });
    } catch (err: any) {
      toast({ variant: 'destructive', title: '내보내기 실패', description: err.message });
    }
  };

  // 체험학습 불인정(신청 불가) 기간 관리 state 및 핸들러
  const [newBlackoutStart, setNewBlackoutStart] = useState('');
  const [newBlackoutEnd, setNewBlackoutEnd] = useState('');
  const [newBlackoutReason, setNewBlackoutReason] = useState('');

  const handleAddBlackoutPeriod = () => {
    if (!newBlackoutStart || !newBlackoutEnd || !newBlackoutReason.trim()) {
      toast({ variant: 'destructive', title: '입력 오류', description: '시작일, 종료일, 사유를 모두 입력해주세요.' });
      return;
    }
    const currentList = config.fieldTripBlackoutPeriods || DEFAULT_FIELD_TRIP_BLACKOUT_PERIODS;
    const newPeriod: FieldTripBlackoutPeriod = {
      id: Date.now().toString(),
      startDate: newBlackoutStart,
      endDate: newBlackoutEnd,
      reason: newBlackoutReason.trim()
    };
    setConfig(prev => ({
      ...prev,
      fieldTripBlackoutPeriods: [...currentList, newPeriod].sort((a, b) => a.startDate.localeCompare(b.startDate))
    }));
    setNewBlackoutStart('');
    setNewBlackoutEnd('');
    setNewBlackoutReason('');
    toast({ title: '불인정 기간 추가됨', description: `${newBlackoutStart} ~ ${newBlackoutEnd} (${newBlackoutReason.trim()})가 목록에 추가되었습니다. 하단 [일반 설정 저장]을 눌러 적용하세요.` });
  };

  const handleDeleteBlackoutPeriod = (id: string) => {
    const currentList = config.fieldTripBlackoutPeriods || DEFAULT_FIELD_TRIP_BLACKOUT_PERIODS;
    setConfig(prev => ({
      ...prev,
      fieldTripBlackoutPeriods: currentList.filter(p => p.id !== id)
    }));
  };

  const handleResetDefaultBlackoutPeriods = () => {
    setConfig(prev => ({
      ...prev,
      fieldTripBlackoutPeriods: [...DEFAULT_FIELD_TRIP_BLACKOUT_PERIODS]
    }));
    toast({ title: '기본값 복원됨', description: '학교 규정 기본 8개 불인정 기간으로 초기화되었습니다.' });
  };
  const [users, setUsers] = useState<UserProfile[]>([]);

  // 교직원 전용 목록 (학생/학부모 계정 원천 분리 이원화)
  const facultyUsers = useMemo(() => {
    return users.filter(u => {
      if (u.email === 'beside1s@kshcm.net') return true;
      if (u.studentName || u.studentGrade || u.role === '학부모' || u.role === 'student' || u.role === 'parent') return false;
      if (/^\d{4}[a-zA-Z]+@kshcm\.net$/i.test(u.email)) return false;
      return true;
    });
  }, [users]);

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [selectedHomeroomFile, setSelectedHomeroomFile] = useState<File | null>(null);
  const [selectedDeptFile, setSelectedDeptFile] = useState<File | null>(null);
  const [org, setOrg] = useState<OrgStructure>({ principal: '', vicePrincipal: '', academicHead: '', gradeHeads: {}, homerooms: {}, gradeSubjects: {}, departments: [], afterschoolManager: '', busManager: '', afterschoolManagers: [], busManagers: [], systemManagers: [], healthTeachers: [], specialTeachers: [], librarianTeachers: [], subjectTeacherGroups: [] });
  const [newHomeroom, setNewHomeroom] = useState({ grade: '1', class: '1', email: '', isGradeHead: false, roleType: 'homeroom' as 'homeroom' | 'subject' });
  const [newSubjectCategoryName, setNewSubjectCategoryName] = useState('');
  const [newDeptName, setNewDeptName] = useState('');
  // 동명이인 처리용: { grade, class, isHead, candidates: UserProfile[] }
  const [duplicatePendingRows, setDuplicatePendingRows] = useState<{ grade: string; class: string; isHead: boolean; candidates: UserProfile[] }[]>([]);
  const [duplicateResolvedEmails, setDuplicateResolvedEmails] = useState<{ [key: string]: string }>({});
  
  const [delegationRules, setDelegationRules] = useState<DelegationRule[]>([]);
  const [selectedDelegationFile, setSelectedDelegationFile] = useState<File | null>(null);

  const [isAddingNewUser, setIsAddingNewUser] = useState(false);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [loadingLogs, setLoadingLogs] = useState(false);
  const [loadingMoreLogs, setLoadingMoreLogs] = useState(false);
  const [lastVisibleLog, setLastVisibleLog] = useState<any>(null);
  const [hasMoreLogs, setHasMoreLogs] = useState(false);
  const [logDateFrom, setLogDateFrom] = useState('');
  const [logDateTo, setLogDateTo] = useState('');

  const fetchAuditLogs = async (reset: boolean = true) => {
    if (reset) {
      setLoadingLogs(true);
      const result = await getAuditLogs(50, undefined, logDateFrom || undefined, logDateTo || undefined);
      setAuditLogs(result.logs);
      setLastVisibleLog(result.lastVisible);
      setHasMoreLogs(result.hasMore);
      setLoadingLogs(false);
    } else {
      if (!lastVisibleLog || loadingMoreLogs) return;
      setLoadingMoreLogs(true);
      const result = await getAuditLogs(50, lastVisibleLog, logDateFrom || undefined, logDateTo || undefined);
      setAuditLogs(prev => [...prev, ...result.logs]);
      setLastVisibleLog(result.lastVisible);
      setHasMoreLogs(result.hasMore);
      setLoadingMoreLogs(false);
    }
  };

  const handleExportAuditLogs = async () => {
    try {
      toast({ title: '감사 로그 추출 중...', description: '최대 1만 건의 감사 데이터를 엑셀 파일로 다운로드합니다.' });
      const result = await getAuditLogs(10000, undefined, logDateFrom || undefined, logDateTo || undefined);
      if (result.logs.length === 0) {
        toast({ variant: 'destructive', title: '추출 실패', description: '해당 기간의 감사 로그가 없습니다.' });
        return;
      }
      
      const exportData = result.logs.map(log => ({
        '작업시간': log.timestamp ? log.timestamp.replace('T', ' ').substring(0, 19) : '-',
        '구분': log.action === 'create' ? '문서상신' :
               log.action === 'approve' ? '결재승인' :
               log.action === 'reject' ? '결재반려' :
               log.action === 'recall' ? '기안회수' :
               log.action === 'delete' ? '기안삭제' : log.action,
        '행위자 이름': log.actorName,
        '행위자 이메일': log.actorEmail,
        '행위자 직책': log.actorRole,
        '문서번호': log.docNo,
        '문서 제목': log.title,
        '상세내용/코멘트': log.comment || '-'
      }));
      
      const worksheet = xlsx.utils.json_to_sheet(exportData);
      const workbook = xlsx.utils.book_new();
      xlsx.utils.book_append_sheet(workbook, worksheet, '감사 로그 이력');
      
      const filename = `audit_logs_${logDateFrom || 'all'}_to_${logDateTo || 'all'}.xlsx`;
      xlsx.writeFile(workbook, filename);
      toast({ title: '추출 완료', description: '감사 로그 엑셀 파일이 다운로드되었습니다.' });
    } catch (err: any) {
      toast({ variant: 'destructive', title: '추출 오류', description: err.message });
    }
  };
  const [newUser, setNewUser] = useState({ email: '', name: '', role: '교사', dept: '' });
  const [newStudent, setNewStudent] = useState({ grade: '', class: '', number: '', studentName: '', parentName: '', email: '', phone: '' });
  const [userToDelete, setUserToDelete] = useState<UserProfile | null>(null);
  // 학생/학부모 인라인 편집 state
  const [editingStudent, setEditingStudent] = useState<UserProfile | null>(null);
  const [editStudentForm, setEditStudentForm] = useState({ grade: '', class: '', number: '', studentName: '', parentName: '', phone: '' });
  // 일괄 등록 다이얼로그 state
  const [isBulkUploadOpen, setIsBulkUploadOpen] = useState(false);

  const fetchUsers = async (forceRefresh = false) => {
    if (forceRefresh) invalidateUsersCache();
    const data = await getUsersDirectory(forceRefresh);
    // 이메일 기준으로 중복 제거 (Map 사용)
    const uniqueUsers = Array.from(new Map(data.map(user => [user.email || user.uid, user])).values());
    setUsers(uniqueUsers.sort((a, b) => (a.name || a.parentName || a.email || '').localeCompare(b.name || b.parentName || b.email || '', 'ko')));
  };

  // 학생 탭 필터/검색/페이지네이션 상태
  const [studentSearchText, setStudentSearchText] = useState('');
  const [studentFilterGrade, setStudentFilterGrade] = useState('all');
  const [studentFilterClass, setStudentFilterClass] = useState('all');
  const [studentPage, setStudentPage] = useState(1);
  const STUDENTS_PER_PAGE = 50;

  useEffect(() => {
    if (isOpen) {
      getDocConfig().then(data => {
        setConfig(data);
        setHeaderPreview(data.headerImage || '');
        if (data.academicCalendar) {
          setAcademicCal(data.academicCalendar);
        } else if (data.annualSchoolDays) {
          setAcademicCal(prev => ({ ...prev, annualSchoolDays: data.annualSchoolDays || 190 }));
        }
      });
      getOrgStructure().then(data => {
        setOrg({
          principal: data.principal || '',
          vicePrincipal: data.vicePrincipal || '',
          academicHead: data.academicHead || '',
          gradeHeads: data.gradeHeads || {},
          homerooms: data.homerooms || {},
          gradeSubjects: data.gradeSubjects || {},
          departments: data.departments || [],
          afterschoolManager: data.afterschoolManager || '',
          busManager: data.busManager || '',
          afterschoolManagers: data.afterschoolManagers || [],
          busManagers: data.busManagers || [],
          systemManagers: data.systemManagers || [],
          healthTeachers: data.healthTeachers || [],
          specialTeachers: data.specialTeachers || [],
          librarianTeachers: data.librarianTeachers || [],
          subjectTeacherGroups: data.subjectTeacherGroups || []
        });
      });
      getDelegationRules().then(data => {
        setDelegationRules(data || []);
      });
      fetchUsers();
      fetchAuditLogs();
    }
  }, [isOpen]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setConfig(prev => ({ 
      ...prev, 
      [name]: (name === 'nextNumber' || name === 'afterschoolFeePerSession' || name === 'annualSchoolDays') ? (parseInt(value) || 0) : value 
    }));
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
      let finalConfig = { 
        ...config,
        annualSchoolDays: academicCal.annualSchoolDays,
        academicCalendar: academicCal
      };
      if (headerPreview && headerPreview !== config.headerImage) {
        finalConfig.headerImage = await compressImage(headerPreview, 600);
      }

      const result = await saveDocConfig(finalConfig);
      if (result.success) {
        toast({ title: '일반 설정이 저장되었습니다.' });
        setIsOpen(false);
      } else {
        toast({ variant: 'destructive', title: '저장 실패', description: result.error });
      }
    });
  };

  const handleSaveAcademicCalendar = () => {
    startSaving(async () => {
      let finalConfig = { 
        ...config,
        annualSchoolDays: academicCal.annualSchoolDays,
        academicCalendar: academicCal
      };

      const result = await saveDocConfig(finalConfig);
      if (result.success) {
        toast({ title: '학사 일정 및 학기 설정이 저장되었습니다.' });
      } else {
        toast({ variant: 'destructive', title: '저장 실패', description: result.error });
      }
    });
  };

  const handleOrgSave = () => {
    startSaving(async () => {
      const result = await saveOrgStructure(org);
      if (result.success) {
        toast({ title: '조직도 저장됨' });
      } else {
        toast({ variant: 'destructive', title: '저장 실패', description: result.error });
      }
    });
  };

  const orgRef = useRef(org);
  useEffect(() => {
    orgRef.current = org;
  }, [org]);

  const updateAndSaveOrg = (updater: (prev: OrgStructure) => OrgStructure, successMessage?: string) => {
    const next = updater(orgRef.current);
    orgRef.current = next;
    setOrg(next);
    saveOrgStructure(next).then(res => {
      if (res.success && successMessage) {
        toast({ title: successMessage });
      } else if (!res.success) {
        toast({ variant: 'destructive', title: '저장 실패', description: res.error });
      }
    });
  };

  const addDepartment = () => {
    if (!newDeptName.trim()) return;
    const newDept = { id: Date.now().toString(), name: newDeptName.trim(), headEmail: null, memberEmails: [] };
    updateAndSaveOrg(prev => ({ ...prev, departments: [...(prev.departments || []), newDept] }), '부서가 추가 및 저장되었습니다.');
    setNewDeptName('');
  };

  const deleteDepartment = (id: string) => {
    updateAndSaveOrg(prev => ({ ...prev, departments: (prev.departments || []).filter(d => d.id !== id) }), '부서가 삭제 및 저장되었습니다.');
  };

  const updateDeptHead = (deptId: string, email: string) => {
    updateAndSaveOrg(prev => ({ ...prev, departments: (prev.departments || []).map(d => d.id === deptId ? { ...d, headEmail: email } : d) }), '부서장이 변경 및 저장되었습니다.');
  };

  const addDeptMember = (deptId: string, email: string) => {
    if (!email) return;
    updateAndSaveOrg(prev => ({
      ...prev,
      departments: (prev.departments || []).map(d => {
        if (d.id === deptId && !d.memberEmails.includes(email)) {
          return { ...d, memberEmails: [...d.memberEmails, email] };
        }
        return d;
      })
    }), '부서원이 추가 및 저장되었습니다.');
  };

  const removeDeptMember = (deptId: string, email: string) => {
    updateAndSaveOrg(prev => ({
      ...prev,
      departments: (prev.departments || []).map(d => d.id === deptId ? { ...d, memberEmails: d.memberEmails.filter(e => e !== email) } : d)
    }), '부서원이 삭제 및 저장되었습니다.');
  };
  
  const handleUserUpdate = async (uid: string, email: string, field: 'role' | 'isAdmin' | 'annualLeaveLimit', value: string | boolean | number) => {
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
          setNewUser({ email: '', name: '', role: '교사', dept: '' });
      } else {
          toast({ variant: 'destructive', title: '추가 실패', description: result.error });
      }
  };
  const handleAddNewStudent = async () => {
      if (!newStudent.email || !newStudent.studentName || !newStudent.parentName) {
          toast({ variant: 'destructive', title: '입력 오류', description: '이메일, 학생 이름, 학부모 이름을 모두 입력해야 합니다.' });
          return;
      }
      const payload = {
          email: newStudent.email,
          name: newStudent.parentName,
          parentName: newStudent.parentName,
          studentName: newStudent.studentName,
          studentGrade: newStudent.grade,
          studentClass: newStudent.class,
          studentNumber: newStudent.number,
          parentPhone: newStudent.phone,
          role: '학부모'
      };
      const result = await saveUserProfile('', newStudent.email, payload as any);
      if (result.success) {
          toast({ title: '학생/학부모 추가됨' });
          fetchUsers();
          setIsAddingNewUser(false);
          setNewStudent({ grade: '', class: '', number: '', studentName: '', parentName: '', email: '', phone: '' });
      } else {
          toast({ variant: 'destructive', title: '추가 실패', description: result.error });
      }
  };

  const handleStartEditStudent = (user: UserProfile) => {
    setEditingStudent(user);
    setEditStudentForm({
      grade: user.studentGrade || '',
      class: user.studentClass || '',
      number: user.studentNumber || '',
      studentName: user.studentName || '',
      parentName: user.parentName || user.name || '',
      phone: user.parentPhone || '',
    });
  };

  const handleSaveEditStudent = async () => {
    if (!editingStudent) return;
    const payload = {
      studentName: editStudentForm.studentName.trim(),
      studentGrade: editStudentForm.grade,
      studentClass: editStudentForm.class,
      studentNumber: editStudentForm.number,
      parentName: editStudentForm.parentName.trim(),
      parentPhone: editStudentForm.phone,
    };
    const result = await saveUserProfile(editingStudent.uid || '', editingStudent.email, payload as any);
    if (result.success) {
      toast({ title: '수정 완료', description: '학생/학부모 정보가 업데이트되었습니다.' });
      fetchUsers();
      setEditingStudent(null);
    } else {
      toast({ variant: 'destructive', title: '수정 실패', description: result.error });
    }
  };

  const [userSubTab, setUserSubTab] = useState<'teachers' | 'students'>('teachers');

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
            const result = userSubTab === 'students'
              ? await bulkRegisterStudents(fileData)
              : await bulkRegisterUsers(fileData);

            if (result.success) {
                toast({ title: userSubTab === 'students' ? '학생 계정 일괄 등록 성공' : '사용자 일괄 등록 성공', description: result.summary });
                fetchUsers();
                setSelectedFile(null);
                setIsBulkUploadOpen(false);
            } else {
                toast({ variant: 'destructive', title: '일괄 등록 실패', description: result.error, duration: 8000 });
            }
        };
        reader.onerror = (error) => {
            toast({ variant: 'destructive', title: '파일 읽기 오류', description: '파일을 읽는 중 문제가 발생했습니다.' });
        };
    });
  };

  const onFileSelect = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
        setSelectedFile(e.target.files[0]);
    }
  };
  
  // 학생 계정 일괄 등록 양식 다운로드
  const handleDownloadStudentTemplate = () => {
    const templateData = [
      {
        '학년': 4,
        '반': 4,
        '번호': 2,
        '학생이름': '강동윤',
        '학생 계정 이메일': '2026kdy@kshcm.net',
        '보호자 이름': '서고은',
        '보호자 연락처': '0773365357',
      },
      {
        '학년': 1,
        '반': 1,
        '번호': 1,
        '학생이름': '홍길동',
        '학생 계정 이메일': '2026hgd@kshcm.net',
        '보호자 이름': '',
        '보호자 연락처': '',
      },
      {
        '학년': 2,
        '반': 3,
        '번호': 12,
        '학생이름': '김철수',
        '학생 계정 이메일': '2026kcs@kshcm.net',
        '보호자 이름': '김부모',
        '보호자 연락처': '0901234567',
      },
    ];
    const worksheet = xlsx.utils.json_to_sheet(templateData);
    const workbook = xlsx.utils.book_new();
    xlsx.utils.book_append_sheet(workbook, worksheet, '학생계정목록');
    xlsx.writeFile(workbook, '학생_계정_일괄등록_양식.xlsx');
  };

  // 교직원 일괄 등록 양식 다운로드
  const handleDownloadTeacherTemplate = () => {
    const templateData = [
      { '이메일': 'teacher1@kshcm.net', '이름': '홍길동', '직책': '교사', '소속': '1학년부' },
      { '이메일': 'teacher2@kshcm.net', '이름': '김철수', '직책': '부장', '소속': '연구기획부' },
    ];
    const worksheet = xlsx.utils.json_to_sheet(templateData);
    const workbook = xlsx.utils.book_new();
    xlsx.utils.book_append_sheet(workbook, worksheet, '교직원목록');
    xlsx.writeFile(workbook, '교직원_일괄등록_양식.xlsx');
  };

  const handleDownloadTemplate = () => {
    if (userSubTab === 'students') {
      handleDownloadStudentTemplate();
    } else {
      handleDownloadTeacherTemplate();
    }
  };

  const handleHomeroomFileSelect = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
        setSelectedHomeroomFile(e.target.files[0]);
    }
  };

  const handleDownloadHomeroomTemplate = () => {
    const templateData = [
      { 학년: 1, 반: 1, 교사이름: '홍길동', 학년부장여부: 'N' },
      { 학년: 1, 반: 2, 교사이름: '김철수', 학년부장여부: 'Y' },
      { 학년: 5, 반: '교과', 교사이름: '이영희', 학년부장여부: 'N' },
    ];
    const worksheet = xlsx.utils.json_to_sheet(templateData);
    const workbook = xlsx.utils.book_new();
    xlsx.utils.book_append_sheet(workbook, worksheet, '담임 및 교과 배정');
    xlsx.writeFile(workbook, 'homeroom_template.xlsx');
  };

  const handleHomeroomUpload = () => {
    if (!selectedHomeroomFile) {
        toast({ variant: 'destructive', title: '파일 없음', description: '업로드할 엑셀 파일을 선택해주세요.' });
        return;
    }

    startUploading(async () => {
        const reader = new FileReader();
        reader.onload = async (e) => {
            try {
                const data = new Uint8Array(e.target?.result as ArrayBuffer);
                const workbook = xlsx.read(data, { type: 'array' });
                const firstSheetName = workbook.SheetNames[0];
                const worksheet = workbook.Sheets[firstSheetName];
                const json: any[] = xlsx.utils.sheet_to_json(worksheet);

                const newHomerooms: { [key: string]: string } = {};
                const newGradeHeads: { [key: string]: string } = { ...org.gradeHeads };
                const newGradeSubjects: { [grade: string]: string[] } = { ...(org.gradeSubjects || {}) };
                const duplicates: { grade: string; class: string; isHead: boolean; candidates: UserProfile[] }[] = [];

                json.forEach((row) => {
                    const grade = String(row['학년'] || '').trim();
                    const clazz = String(row['반'] || '').trim();
                    // 이름 기반 매칭: 이름, 교사이름, name 컬럼 지원
                    const teacherName = (row['교사이름'] || row['이름'] || row['name'] || '').trim();
                    // 레거시 이메일 컬럼도 여전히 지원 (이름이 없을 때 폴백)
                    const directEmail = (row['교사이메일'] || row['이메일'] || '').trim().toLowerCase();
                    const isHead = (row['학년부장여부'] || row['부장여부'] || '').trim().toUpperCase() === 'Y';

                    if (!grade || !clazz) return;
                    const isSubject = clazz === '교과' || clazz.includes('전담');

                    if (teacherName) {
                        // 이름으로 사용자 목록에서 매칭
                        const matched = users.filter(u => u.name === teacherName);
                        if (matched.length === 1) {
                            const matchedEmail = matched[0].email;
                            if (isSubject) {
                                const currentList = newGradeSubjects[grade] || [];
                                if (!currentList.includes(matchedEmail)) {
                                    newGradeSubjects[grade] = [...currentList, matchedEmail];
                                }
                            } else {
                                const key = `${grade}-${clazz}`;
                                newHomerooms[key] = matchedEmail;
                                if (isHead) newGradeHeads[grade] = matchedEmail;
                            }
                        } else if (matched.length > 1) {
                            // 동명이인 → 나중에 수동 선택 필요
                            duplicates.push({ grade, class: clazz, isHead, candidates: matched });
                        } else {
                            toast({ variant: 'destructive', title: `"${teacherName}" 교사를 찾을 수 없음`, description: `${grade}학년 ${clazz}에 배정된 "${teacherName}"(이)라는 이름의 교사를 찾을 수 없습니다. 사용자 목록을 확인해주세요.` });
                        }
                    } else if (directEmail) {
                        // 레거시: 이메일 직접 지정
                        if (isSubject) {
                            const currentList = newGradeSubjects[grade] || [];
                            if (!currentList.includes(directEmail)) {
                                newGradeSubjects[grade] = [...currentList, directEmail];
                            }
                        } else {
                            const key = `${grade}-${clazz}`;
                            newHomerooms[key] = directEmail;
                            if (isHead) newGradeHeads[grade] = directEmail;
                        }
                    }
                });

                updateAndSaveOrg(prev => ({
                    ...prev,
                    homerooms: { ...prev.homerooms, ...newHomerooms },
                    gradeHeads: newGradeHeads,
                    gradeSubjects: newGradeSubjects
                }), duplicates.length === 0 ? `담임 및 교과 배정 일괄 등록 완료` : undefined);

                if (duplicates.length > 0) {
                    setDuplicatePendingRows(duplicates);
                    setDuplicateResolvedEmails({});
                    toast({ title: `동명이인 ${duplicates.length}건 발생`, description: '아래 목록에서 해당 교사를 선택해 주세요.' });
                }
            } catch (err: any) {
                toast({ variant: 'destructive', title: '파일 파싱 오류', description: err.message });
            }
        };
        reader.onerror = () => {
            toast({ variant: 'destructive', title: '파일 읽기 오류', description: '파일을 읽는 중 문제가 발생했습니다.' });
        };
        reader.readAsArrayBuffer(selectedHomeroomFile);
    });
  };

  const handleResolveDuplicates = () => {
    const newHomerooms = { ...org.homerooms };
    const newGradeHeads = { ...org.gradeHeads };
    const newGradeSubjects = { ...(org.gradeSubjects || {}) };
    let resolvedCount = 0;
    let missingCount = 0;
    duplicatePendingRows.forEach(row => {
      const key = `${row.grade}-${row.class}`;
      const selectedEmail = duplicateResolvedEmails[key];
      if (selectedEmail) {
        if (row.class === '교과' || row.class.includes('전담')) {
          const list = newGradeSubjects[row.grade] || [];
          if (!list.includes(selectedEmail)) {
            newGradeSubjects[row.grade] = [...list, selectedEmail];
          }
        } else {
          newHomerooms[key] = selectedEmail;
          if (row.isHead) newGradeHeads[row.grade] = selectedEmail;
        }
        resolvedCount++;
      } else {
        missingCount++;
      }
    });
    if (missingCount > 0) {
      toast({ variant: 'destructive', title: '선택 누락', description: `${missingCount}건의 교사를 아직 선택하지 않았습니다.` });
      return;
    }
    updateAndSaveOrg(prev => ({ ...prev, homerooms: newHomerooms, gradeHeads: newGradeHeads, gradeSubjects: newGradeSubjects }), `동명이인 처리 완료 (${resolvedCount}건 저장 완료)`);
    setDuplicatePendingRows([]);
    setDuplicateResolvedEmails({});
  };

  // 부서 일괄 등록
  const handleDeptFileSelect = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) setSelectedDeptFile(e.target.files[0]);
  };

  const handleDownloadDeptTemplate = () => {
    const templateData = [
      { '부서명': '문예방과후부', '이름': '홍길동', '직책': '부장' },
      { '부서명': '문예방과후부', '이름': '김철수', '직책': '부원' },
      { '부서명': '문예방과후부', '이름': '이영희', '직책': '부원' },
      { '부서명': '체육방과후부', '이름': '이영철', '직책': '부장' },
      { '부서명': '체육방과후부', '이름': '최수진', '직책': '부원' },
    ];
    const worksheet = xlsx.utils.json_to_sheet(templateData);
    const workbook = xlsx.utils.book_new();
    xlsx.utils.book_append_sheet(workbook, worksheet, '부서 목록');
    xlsx.writeFile(workbook, 'department_template.xlsx');
  };

  const handleDeptUpload = () => {
    if (!selectedDeptFile) {
      toast({ variant: 'destructive', title: '파일 없음', description: '업로드할 엑셀 파일을 선택해주세요.' });
      return;
    }
    startUploading(async () => {
      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          const data = new Uint8Array(e.target?.result as ArrayBuffer);
          const workbook = xlsx.read(data, { type: 'array' });
          const worksheet = workbook.Sheets[workbook.SheetNames[0]];
          const json: any[] = xlsx.utils.sheet_to_json(worksheet);

          const resolveEmail = (name: string): string | null => {
            if (!name) return null;
            const matched = users.filter(u => u.name === name.trim());
            if (matched.length === 1) return matched[0].email;
            if (matched.length > 1) {
              toast({ variant: 'destructive', title: `"${name}" 동명이인`, description: `"${name}"(이)라는 이름의 사용자가 여러 명입니다. 직접 등록 방식으로 배정하세요.` });
            } else {
              toast({ variant: 'destructive', title: `"${name}" 사용자 없음`, description: `"${name}"(이)라는 이름의 사용자를 찾을 수 없습니다.` });
            }
            return null;
          };

          // 부서명 기준으로 행을 그룹핑 (순서 유지를 위해 Map 사용)
          const deptMap = new Map<string, { headEmail: string | null; memberEmails: string[] }>();
          json.forEach((row) => {
            const deptName = (row['부서명'] || '').trim();
            const name = (row['이름'] || row['name'] || '').trim();
            const role = (row['직책'] || row['역할'] || '').trim();
            if (!deptName || !name) return;

            if (!deptMap.has(deptName)) {
              deptMap.set(deptName, { headEmail: null, memberEmails: [] });
            }
            const entry = deptMap.get(deptName)!;
            const email = resolveEmail(name);
            if (!email) return;

            if (role === '부장') {
              entry.headEmail = email;
            } else {
              // '부원' 또는 그 외 직첩은 모두 부원으로 처리
              if (!entry.memberEmails.includes(email)) {
                entry.memberEmails.push(email);
              }
            }
          });

          const newDepts = Array.from(deptMap.entries()).map(([deptName, entry], i) => ({
            id: Date.now().toString() + i,
            name: deptName,
            headEmail: entry.headEmail,
            memberEmails: entry.memberEmails,
          }));

          setOrg(prev => ({ ...prev, departments: [...(prev.departments || []), ...newDepts] }));
          toast({ title: '부서 일괄 등록 성공', description: `${newDepts.length}개의 부서가 추가되었습니다.` });
        } catch (err: any) {
          toast({ variant: 'destructive', title: '파일 파싱 오류', description: err.message });
        }
      };
      reader.onerror = () => toast({ variant: 'destructive', title: '파일 읽기 오류' });
      reader.readAsArrayBuffer(selectedDeptFile);
    });
  };

  const handleDelegationFileSelect = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
        setSelectedDelegationFile(e.target.files[0]);
    }
  };

  const delegationRulesRef = useRef(delegationRules);
  useEffect(() => {
    delegationRulesRef.current = delegationRules;
  }, [delegationRules]);

  const updateAndSaveDelegation = (updater: (prev: DelegationRule[]) => DelegationRule[], successMsg?: string) => {
    const next = updater(delegationRulesRef.current);
    delegationRulesRef.current = next;
    setDelegationRules(next);
    saveDelegationRules(next).then(res => {
      if (res.success && successMsg) {
        toast({ title: successMsg });
      } else if (!res.success) {
        toast({ variant: 'destructive', title: '저장 실패', description: res.error });
      }
    });
  };

  const handleDownloadDelegationTemplate = () => {
    const templateData = DEFAULT_DELEGATION_RULES.map(r => ({
      '대분류': r.mainType,
      '중분류(문서명)': r.subType,
      '소분류(조건)': r.detailType,
      '중간결재자': r.intermediateApprover === 'GRADE_HEAD' ? '학년부장' :
                    r.intermediateApprover === 'ACADEMIC_HEAD' ? '교무부장' :
                    r.intermediateApprover === 'DEPT_HEAD' ? '담당부장' : '없음',
      '최종결재자': r.finalApprover === 'GRADE_HEAD' ? '학년부장' :
                    r.finalApprover === 'ACADEMIC_HEAD' ? '교무부장' :
                    r.finalApprover === 'DEPT_HEAD' ? '담당부장' :
                    r.finalApprover === 'VP' ? '교감' : '교장',
    }));
    const worksheet = xlsx.utils.json_to_sheet(templateData);
    const workbook = xlsx.utils.book_new();
    xlsx.utils.book_append_sheet(workbook, worksheet, '위임전결규정');
    xlsx.writeFile(workbook, '위임전결규정_표준양식.xlsx');
  };

  const handleDelegationUpload = () => {
    if (!selectedDelegationFile) {
        toast({ variant: 'destructive', title: '파일 없음', description: '업로드할 엑셀 파일을 선택해주세요.'});
        return;
    }

    startUploading(async () => {
        const reader = new FileReader();
        reader.onload = async (e) => {
            try {
                const data = new Uint8Array(e.target?.result as ArrayBuffer);
                const workbook = xlsx.read(data, { type: 'array' });
                const firstSheetName = workbook.SheetNames[0];
                const worksheet = workbook.Sheets[firstSheetName];
                const json: any[] = xlsx.utils.sheet_to_json(worksheet);

                const newRules: DelegationRule[] = json.map((row, index) => {
                    const rawInter = String(row['중간결재자'] || row['중간결재'] || '').trim();
                    let intermediateApprover: 'NONE' | 'GRADE_HEAD' | 'ACADEMIC_HEAD' | 'DEPT_HEAD' = 'NONE';
                    if (rawInter.includes('학년')) intermediateApprover = 'GRADE_HEAD';
                    else if (rawInter.includes('교무')) intermediateApprover = 'ACADEMIC_HEAD';
                    else if (rawInter.includes('부장') || rawInter.includes('담당')) intermediateApprover = 'DEPT_HEAD';
                    else if (['GRADE_HEAD', 'ACADEMIC_HEAD', 'DEPT_HEAD'].includes(rawInter)) intermediateApprover = rawInter as any;

                    const rawFinal = String(row['최종결재자'] || row['최종결재'] || '').trim();
                    let finalApprover: 'GRADE_HEAD' | 'ACADEMIC_HEAD' | 'DEPT_HEAD' | 'VP' | 'PRINCIPAL' = 'PRINCIPAL';
                    if (rawFinal.includes('학년')) finalApprover = 'GRADE_HEAD';
                    else if (rawFinal.includes('교무')) finalApprover = 'ACADEMIC_HEAD';
                    else if (rawFinal.includes('담당부장')) finalApprover = 'DEPT_HEAD';
                    else if (rawFinal.includes('교감') || rawFinal === 'VP') finalApprover = 'VP';
                    else if (rawFinal.includes('교장') || rawFinal === 'PRINCIPAL') finalApprover = 'PRINCIPAL';
                    else if (['GRADE_HEAD', 'ACADEMIC_HEAD', 'DEPT_HEAD', 'VP', 'PRINCIPAL'].includes(rawFinal)) finalApprover = rawFinal as any;

                    return {
                        id: Date.now().toString() + index,
                        mainType: row['대분류'] || '일반 공문',
                        subType: row['중분류(문서명)'] || row['중분류'] || '',
                        detailType: row['소분류(조건)'] || row['소분류'] || '',
                        intermediateApprover,
                        finalApprover,
                    };
                });

                const result = await saveDelegationRules(newRules);
                if (result.success) {
                    toast({ title: '전결규정 등록 성공', description: `${newRules.length}개의 규정이 등록 및 자동 저장되었습니다.` });
                    setDelegationRules(newRules);
                } else {
                    toast({ variant: 'destructive', title: '등록 실패', description: result.error });
                }
            } catch (err: any) {
                toast({ variant: 'destructive', title: '파일 파싱 오류', description: err.message });
            }
        };
        reader.onerror = () => {
            toast({ variant: 'destructive', title: '파일 읽기 오류', description: '파일을 읽는 중 문제가 발생했습니다.' });
        }
        reader.readAsArrayBuffer(selectedDelegationFile);
    });
  };

  const handleDelegationUpdate = (index: number, field: keyof DelegationRule, value: string) => {
    updateAndSaveDelegation(prev => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      return next;
    });
  };

  const addDelegationRule = () => {
    updateAndSaveDelegation(prev => [
      ...prev, 
      { id: Date.now().toString(), mainType: '학부모 출결', subType: '결석계', detailType: '', intermediateApprover: 'NONE', finalApprover: 'GRADE_HEAD' }
    ], '새 전결규정이 추가되었습니다.');
  };

  const deleteDelegationRule = (index: number) => {
    updateAndSaveDelegation(prev => prev.filter((_, i) => i !== index), '전결규정이 삭제되었습니다.');
  };

  const handleResetDefaultDelegation = () => {
    if (!window.confirm("기본 전결규정 8종(결석계, 체험학습, 연간계획, 세부계획, 복무 등)으로 초기화하시겠습니까?")) return;
    updateAndSaveDelegation(() => DEFAULT_DELEGATION_RULES, '기본 전결규정 8종이 성공적으로 복원 및 저장되었습니다.');
  };

  const renderApprovalLinePreview = (rule: DelegationRule) => {
    const isParent = rule.mainType?.includes('학부모') || rule.subType === '결석계' || rule.subType === '체험학습신청서';
    const firstRole = isParent ? '담임' : '기안자';
    
    const interMap: Record<string, string> = {
      GRADE_HEAD: '학년부장',
      ACADEMIC_HEAD: '교무부장',
      DEPT_HEAD: '담당부장',
      NONE: ''
    };
    const finalMap: Record<string, string> = {
      GRADE_HEAD: '학년부장(전결)',
      ACADEMIC_HEAD: '교무부장(전결)',
      DEPT_HEAD: '담당부장(전결)',
      VP: '교감(전결)',
      PRINCIPAL: '교장(결재)'
    };

    const steps = [firstRole];
    if (rule.intermediateApprover && rule.intermediateApprover !== 'NONE' && rule.intermediateApprover !== rule.finalApprover) {
      steps.push(interMap[rule.intermediateApprover] || rule.intermediateApprover);
    }
    if (rule.finalApprover === 'PRINCIPAL' && !isParent && !steps.includes('교감')) {
      steps.push('교감');
    }
    steps.push(finalMap[rule.finalApprover] || rule.finalApprover);

    return steps.join(' ➡️ ');
  };

  const handleDelegationSave = () => {
    startSaving(async () => {
      const result = await saveDelegationRules(delegationRules);
      if (result.success) {
        toast({ title: '전결규정 저장됨' });
      } else {
        toast({ variant: 'destructive', title: '저장 실패', description: result.error });
      }
    });
  };

  const confirmDeleteUser = (user: UserProfile) => {
    if (user.email === profile?.email) {
      toast({ variant: 'destructive', title: '삭제 불가', description: '자기 자신을 삭제할 수 없습니다.' });
      return;
    }
    setUserToDelete(user);
  };

  const executeDelete = async () => {
    if (!userToDelete) return;

    const result = await deleteUser(userToDelete.email);
    if (result.success) {
      toast({ title: '사용자 삭제됨', description: `${userToDelete.name} (${userToDelete.email}) 사용자가 삭제되었습니다.`});
      fetchUsers();
    } else {
      toast({ variant: 'destructive', title: '삭제 실패', description: result.error });
    }
    setUserToDelete(null);
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon">
          <SettingsIcon className="h-5 w-5 text-muted-foreground" />
        </Button>
      </DialogTrigger>
      <DialogContent className="w-[95vw] max-w-[95vw] h-[92vh] flex flex-col p-0 gap-0 overflow-hidden">
        <DialogHeader className="shrink-0 px-6 pt-6 pb-3 border-b">
          <DialogTitle>시스템 설정</DialogTitle>
          <DialogDescription>
            문서 템플릿, 번호 체계, 학사 일정, 사용자 권한을 관리합니다.
          </DialogDescription>
        </DialogHeader>
        
        <Tabs defaultValue="general" className="flex-1 flex flex-col min-h-0 overflow-hidden">
          <TabsList className="grid w-full grid-cols-6 shrink-0 rounded-none border-b bg-muted/30 h-11 text-xs md:text-sm">
            <TabsTrigger value="general" className="rounded-none data-[state=active]:border-b-2 data-[state=active]:border-primary"><SettingsIcon className="mr-2 h-4 w-4 hidden md:block"/>일반</TabsTrigger>
            <TabsTrigger value="academicCalendar" className="rounded-none data-[state=active]:border-b-2 data-[state=active]:border-primary font-medium"><Calendar className="mr-2 h-4 w-4 hidden md:block"/>학사 일정 관리</TabsTrigger>
            <TabsTrigger value="org" className="rounded-none data-[state=active]:border-b-2 data-[state=active]:border-primary"><Network className="mr-2 h-4 w-4 hidden md:block"/>조직도</TabsTrigger>
            <TabsTrigger value="delegation" className="rounded-none data-[state=active]:border-b-2 data-[state=active]:border-primary"><FileText className="mr-2 h-4 w-4 hidden md:block"/>전결규정</TabsTrigger>
            <TabsTrigger value="users" className="rounded-none data-[state=active]:border-b-2 data-[state=active]:border-primary"><Users className="mr-2 h-4 w-4 hidden md:block"/>사용자</TabsTrigger>
            <TabsTrigger value="audit" className="rounded-none data-[state=active]:border-b-2 data-[state=active]:border-primary"><FileText className="mr-2 h-4 w-4 hidden md:block"/>감사 로그</TabsTrigger>
          </TabsList>
          
          <TabsContent value="general" className="flex-1 min-h-0 mt-0 data-[state=active]:flex flex-col">
            <div className="flex-1 overflow-y-auto px-6 py-4">
              <div className="space-y-6 max-w-4xl">
                {/* 🤖 AI 초안 생성 기능 On/Off 스위치 */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 bg-slate-50/90 rounded-xl border border-slate-200 shadow-2xs">
                  <div className="space-y-0.5">
                    <Label htmlFor="enableAiDraft" className="font-bold text-slate-800 text-sm flex items-center gap-2 cursor-pointer">
                      <Sparkles className="w-4 h-4 text-indigo-600 shrink-0" />
                      기안문 작성 시 AI 초안 생성 (Sparkles) 사용
                    </Label>
                    <p className="text-xs text-slate-500">
                      켜짐 설정 시 교직원이 결재 기안문 작성 화면에서 AI 초안 자동 작성 버튼을 이용할 수 있으며, 끄면 버튼이 잠금(비활성화) 처리됩니다.
                    </p>
                  </div>
                  <Switch
                    id="enableAiDraft"
                    checked={config.enableAiDraft !== false}
                    onCheckedChange={(checked) => setConfig((prev) => ({ ...prev, enableAiDraft: checked }))}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="nextNumber" className="font-semibold text-slate-800">다음 문서 번호</Label>
                  <Input id="nextNumber" name="nextNumber" type="number" value={config.nextNumber || 1} onChange={handleChange} className="w-full sm:w-60" />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="slogan" className="font-semibold text-slate-800">상단 문구 (슬로건)</Label>
                  <Input id="slogan" name="slogan" value={config.slogan || ''} onChange={handleChange} placeholder="예: 글로네이컬(GloNaCal) 미래 인재를 키우는 행복한 학교" />
                </div>
                
                <div className="space-y-2">
                  <Label className="font-semibold text-slate-800">헤더 이미지</Label>
                  <div className="p-4 border-2 border-dashed rounded-lg text-center relative group bg-slate-50/50">
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
                  <h4 className="font-semibold text-slate-900">바닥글 정보</h4>
                  <div className="space-y-2">
                    <Label htmlFor="address">주소</Label>
                    <Input id="address" name="address" value={config.address || ''} onChange={handleChange} />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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

                {/* 🚫 체험학습 불인정(신청 불가) 기간 관리 카드 */}
                <div className="space-y-4 pt-4 border-t border-slate-200">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div>
                      <h4 className="font-bold text-slate-800 text-sm sm:text-base flex items-center gap-2">
                        <Calendar className="w-4 h-4 text-red-600 shrink-0" />
                        체험학습 불인정 기간(신청 불가 기간) 관리
                        <Badge variant="outline" className="text-[10px] bg-red-50 text-red-700 border-red-200 font-bold">
                          학부모 신청 자동 차단 & 서식 1 연동
                        </Badge>
                      </h4>
                      <p className="text-xs text-slate-500 mt-0.5">
                        개학식/방학 전후, 재량휴업일 등 체험학습이 불인정되는 기간을 설정합니다. 학부모가 이 기간에 신청 시 안내 및 차단됩니다.
                      </p>
                    </div>
                    <Button 
                      type="button" 
                      variant="outline" 
                      size="sm" 
                      onClick={handleResetDefaultBlackoutPeriods}
                      className="h-8 text-xs font-bold text-slate-700 border-slate-300 hover:bg-slate-100 shrink-0"
                    >
                      <RotateCcw className="w-3.5 h-3.5 mr-1" />
                      기본 8개 규정 복원
                    </Button>
                  </div>

                  {/* 새 기간 추가 폼 */}
                  <div className="p-3 bg-red-50/40 rounded-xl border border-red-200 space-y-3">
                    <span className="font-bold text-red-950 text-xs flex items-center gap-1.5">
                      <PlusCircle className="w-4 h-4 text-red-600" />
                      새 불인정 기간 추가
                    </span>
                    <div className="grid grid-cols-1 sm:grid-cols-7 gap-2 items-end">
                      <div className="sm:col-span-2">
                        <Label className="text-[10px] text-slate-600 font-semibold mb-1 block">시작일</Label>
                        <Input 
                          type="date" 
                          value={newBlackoutStart} 
                          onChange={e => setNewBlackoutStart(e.target.value)} 
                          className="h-8 text-xs bg-white"
                        />
                      </div>
                      <div className="sm:col-span-2">
                        <Label className="text-[10px] text-slate-600 font-semibold mb-1 block">종료일</Label>
                        <Input 
                          type="date" 
                          value={newBlackoutEnd} 
                          onChange={e => setNewBlackoutEnd(e.target.value)} 
                          className="h-8 text-xs bg-white"
                        />
                      </div>
                      <div className="sm:col-span-2">
                        <Label className="text-[10px] text-slate-600 font-semibold mb-1 block">불인정 사유 (예: 개학식 후 7일)</Label>
                        <Input 
                          type="text" 
                          placeholder="사유 입력" 
                          value={newBlackoutReason} 
                          onChange={e => setNewBlackoutReason(e.target.value)} 
                          className="h-8 text-xs bg-white"
                        />
                      </div>
                      <div className="sm:col-span-1">
                        <Button 
                          type="button" 
                          size="sm" 
                          onClick={handleAddBlackoutPeriod}
                          className="h-8 w-full text-xs font-bold bg-red-600 hover:bg-red-700 text-white"
                        >
                          추가
                        </Button>
                      </div>
                    </div>
                  </div>

                  {/* 등록된 불인정 기간 테이블 */}
                  <div className="border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
                    <Table>
                      <TableHeader className="bg-slate-50">
                        <TableRow>
                          <TableHead className="w-12 text-center text-xs font-bold">No</TableHead>
                          <TableHead className="text-xs font-bold w-48">불인정 기간</TableHead>
                          <TableHead className="text-xs font-bold">불인정 사유</TableHead>
                          <TableHead className="w-16 text-center text-xs font-bold">삭제</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {(config.fieldTripBlackoutPeriods || DEFAULT_FIELD_TRIP_BLACKOUT_PERIODS).map((period, idx) => (
                          <TableRow key={period.id || idx} className="hover:bg-slate-50/80">
                            <TableCell className="text-center font-mono text-xs text-slate-500">{idx + 1}</TableCell>
                            <TableCell className="font-mono text-xs font-bold text-red-700">
                              {period.startDate} ~ {period.endDate}
                            </TableCell>
                            <TableCell className="text-xs font-medium text-slate-800">
                              {period.reason}
                            </TableCell>
                            <TableCell className="text-center">
                              <Button 
                                type="button" 
                                variant="ghost" 
                                size="icon" 
                                onClick={() => handleDeleteBlackoutPeriod(period.id)}
                                className="h-7 w-7 text-red-500 hover:text-red-700 hover:bg-red-50"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              </div>
            </div>
            <div className="shrink-0 px-6 py-4 border-t flex justify-end bg-slate-50/50">
              <Button onClick={handleSave} disabled={isSaving}>
                {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                일반 설정 저장
              </Button>
            </div>
          </TabsContent>

          {/* 📅 학사 일정 관리 탭 */}
          <TabsContent value="academicCalendar" className="flex-1 min-h-0 mt-0 data-[state=active]:flex flex-col">
            <div className="flex-1 overflow-y-auto px-6 py-4">
              <div className="space-y-5 text-xs">
                {/* 헤더 안내 및 연동 버튼 */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 pb-3">
                  <div>
                    <h4 className="font-bold text-slate-900 text-sm sm:text-base flex items-center gap-2 flex-wrap">
                      <Calendar className="w-5 h-5 text-indigo-600 shrink-0" />
                      중앙 학사 일정 및 학기 통합 관리
                      <Badge variant="outline" className="text-[10px] sm:text-xs bg-indigo-50 text-indigo-700 border-indigo-200 font-semibold whitespace-nowrap">
                        🔗 버스·방과후·결석/체험학습 100% 연동
                      </Badge>
                    </h4>
                    <p className="text-slate-500 text-xs mt-0.5">
                      학교 전체 표준 학기 기간, 연간 총 수업일수, 휴업일/공휴일/학교행사를 통합 설정합니다.
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0 flex-wrap">
                    <Button
                      type="button"
                      size="sm"
                      onClick={handleBroadcastCalendarSync}
                      className="h-8 text-xs font-bold bg-amber-500 hover:bg-amber-600 text-white rounded-lg whitespace-nowrap shadow-xs"
                    >
                      전체 사용자 캘린더 공유 알림 발송
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        handleExportIcsFile();
                        window.open('https://calendar.google.com/calendar/r/settings/export', '_blank');
                        toast({ title: '구글 캘린더 연동 안내', description: '학사일정 .ics 파일이 다운로드되었습니다. 열린 구글 캘린더 설정창에서 [가져오기]를 누르고 파일만 넣어주시면 구글 캘린더에 1초 만에 전체 등록됩니다!' });
                      }}
                      className="h-8 text-xs font-bold bg-blue-50 hover:bg-blue-100 text-blue-900 border-blue-300 rounded-lg whitespace-nowrap"
                    >
                      <Globe className="w-3.5 h-3.5 mr-1 text-blue-600 shrink-0" />
                      구글 캘린더에 바로 연동
                    </Button>
                  </div>
                </div>

                {/* 1. 연간 총 수업일수 */}
                <div className="space-y-1.5 bg-white p-4 rounded-xl border border-slate-200">
                  <Label htmlFor="annualSchoolDays" className="font-bold text-slate-800 text-xs sm:text-sm">
                    연간 총 수업일수 (일)
                  </Label>
                  <Input 
                    id="annualSchoolDays" 
                    type="number" 
                    value={academicCal.annualSchoolDays || 190} 
                    onChange={e => setAcademicCal(prev => ({ ...prev, annualSchoolDays: parseInt(e.target.value) || 190 }))} 
                    className="text-xs font-bold w-full sm:w-48 bg-white"
                    placeholder="기본값: 190"
                  />
                  <p className="text-[11px] text-slate-500">
                    학부모 체험학습 허용 한도(10%) 및 출석인정 수업일수(2/3 수료 기준)의 원천 계산 기준입니다.
                  </p>
                </div>

                {/* 2. 학기 및 방학 운영 기간 4개 Grid */}
                <div className="space-y-2 bg-white p-4 rounded-xl border border-slate-200">
                  <Label className="font-bold text-slate-800 text-xs sm:text-sm block">
                    학기 및 방학 운영 기간 설정 (4개 교시)
                  </Label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                    {/* 1학기 */}
                    <div className="p-3 bg-indigo-50/60 rounded-xl border border-indigo-200 space-y-2">
                      <span className="font-bold text-indigo-900 text-xs block">🏫 2026학년도 1학기</span>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <span className="text-[10px] text-slate-500 font-semibold block">시작일</span>
                          <Input 
                            type="date" 
                            value={academicCal.semesters.sem1.startDate} 
                            onChange={e => setAcademicCal(prev => ({
                              ...prev,
                              semesters: { ...prev.semesters, sem1: { ...prev.semesters.sem1, startDate: e.target.value } }
                            }))}
                            className="text-[11px] h-8 bg-white"
                          />
                        </div>
                        <div>
                          <span className="text-[10px] text-slate-500 font-semibold block">종료일</span>
                          <Input 
                            type="date" 
                            value={academicCal.semesters.sem1.endDate} 
                            onChange={e => setAcademicCal(prev => ({
                              ...prev,
                              semesters: { ...prev.semesters, sem1: { ...prev.semesters.sem1, endDate: e.target.value } }
                            }))}
                            className="text-[11px] h-8 bg-white"
                          />
                        </div>
                      </div>
                    </div>

                    {/* 여름방학 */}
                    <div className="p-3 bg-amber-50/60 rounded-xl border border-amber-200 space-y-2">
                      <span className="font-bold text-amber-900 text-xs block">🏖️ 2026학년도 여름방학</span>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <span className="text-[10px] text-slate-500 font-semibold block">시작일</span>
                          <Input 
                            type="date" 
                            value={academicCal.semesters.vacationSummer.startDate} 
                            onChange={e => setAcademicCal(prev => ({
                              ...prev,
                              semesters: { ...prev.semesters, vacationSummer: { ...prev.semesters.vacationSummer, startDate: e.target.value } }
                            }))}
                            className="text-[11px] h-8 bg-white"
                          />
                        </div>
                        <div>
                          <span className="text-[10px] text-slate-500 font-semibold block">종료일</span>
                          <Input 
                            type="date" 
                            value={academicCal.semesters.vacationSummer.endDate} 
                            onChange={e => setAcademicCal(prev => ({
                              ...prev,
                              semesters: { ...prev.semesters, vacationSummer: { ...prev.semesters.vacationSummer, endDate: e.target.value } }
                            }))}
                            className="text-[11px] h-8 bg-white"
                          />
                        </div>
                      </div>
                    </div>

                    {/* 2학기 */}
                    <div className="p-3 bg-emerald-50/60 rounded-xl border border-emerald-200 space-y-2">
                      <span className="font-bold text-emerald-900 text-xs block">🏫 2026학년도 2학기</span>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <span className="text-[10px] text-slate-500 font-semibold block">시작일</span>
                          <Input 
                            type="date" 
                            value={academicCal.semesters.sem2.startDate} 
                            onChange={e => setAcademicCal(prev => ({
                              ...prev,
                              semesters: { ...prev.semesters, sem2: { ...prev.semesters.sem2, startDate: e.target.value } }
                            }))}
                            className="text-[11px] h-8 bg-white"
                          />
                        </div>
                        <div>
                          <span className="text-[10px] text-slate-500 font-semibold block">종료일</span>
                          <Input 
                            type="date" 
                            value={academicCal.semesters.sem2.endDate} 
                            onChange={e => setAcademicCal(prev => ({
                              ...prev,
                              semesters: { ...prev.semesters, sem2: { ...prev.semesters.sem2, endDate: e.target.value } }
                            }))}
                            className="text-[11px] h-8 bg-white"
                          />
                        </div>
                      </div>
                    </div>

                    {/* 겨울방학 */}
                    <div className="p-3 bg-sky-50/60 rounded-xl border border-sky-200 space-y-2">
                      <span className="font-bold text-sky-900 text-xs block">☃️ 2026학년도 겨울방학</span>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <span className="text-[10px] text-slate-500 font-semibold block">시작일</span>
                          <Input 
                            type="date" 
                            value={academicCal.semesters.vacationWinter.startDate} 
                            onChange={e => setAcademicCal(prev => ({
                              ...prev,
                              semesters: { ...prev.semesters, vacationWinter: { ...prev.semesters.vacationWinter, startDate: e.target.value } }
                            }))}
                            className="text-[11px] h-8 bg-white"
                          />
                        </div>
                        <div>
                          <span className="text-[10px] text-slate-500 font-semibold block">종료일</span>
                          <Input 
                            type="date" 
                            value={academicCal.semesters.vacationWinter.endDate} 
                            onChange={e => setAcademicCal(prev => ({
                              ...prev,
                              semesters: { ...prev.semesters, vacationWinter: { ...prev.semesters.vacationWinter, endDate: e.target.value } }
                            }))}
                            className="text-[11px] h-8 bg-white"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* 3. 휴업일 / 공휴일 / 학교행사 실시간 등록 */}
                <div className="space-y-3 bg-white p-4 rounded-xl border border-slate-200">
                  <div className="flex items-center justify-between flex-wrap gap-1">
                    <Label className="font-bold text-slate-800 text-xs sm:text-sm">
                      휴업일 / 공휴일 / 학교행사 관리 ({academicCal.events.length}건)
                    </Label>
                    <span className="text-[11px] text-slate-400">
                      휴업일·공휴일은 수업일수 제외, 학교행사는 수업일 포함
                    </span>
                  </div>

                  {/* 등록 폼 */}
                  <div className="space-y-2 bg-slate-50 p-3 rounded-xl border border-slate-200">
                    <div className="grid grid-cols-1 sm:grid-cols-12 gap-2">
                      <div className="sm:col-span-3">
                        <Input 
                          type="date" 
                          value={newEventDate} 
                          onChange={e => setNewEventDate(e.target.value)} 
                          className="text-[11px] h-8 bg-white" 
                        />
                      </div>
                      <div className="sm:col-span-4">
                        <Input 
                          type="text" 
                          placeholder="행사/휴업일 명칭..." 
                          value={newEventTitle} 
                          onChange={e => setNewEventTitle(e.target.value)} 
                          className="text-[11px] h-8 bg-white font-medium" 
                        />
                      </div>
                      <div className="sm:col-span-3">
                        <Select value={newEventType} onValueChange={(val: any) => setNewEventType(val)}>
                          <SelectTrigger className="h-8 text-[11px] bg-white">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="HOLIDAY" className="text-xs font-bold text-amber-700">재량휴업일 (수업일 X)</SelectItem>
                            <SelectItem value="PUBLIC_HOLIDAY" className="text-xs font-bold text-rose-700">법정공휴일 (수업일 X)</SelectItem>
                            <SelectItem value="SCHOOL_EVENT" className="text-xs font-bold text-indigo-700">학교 행사 (수업일 O)</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="sm:col-span-2">
                        <Button 
                          type="button" 
                          size="sm" 
                          onClick={handleAddAcademicEvent} 
                          className="w-full h-8 text-[11px] font-bold bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg whitespace-nowrap"
                        >
                          <PlusCircle className="w-3.5 h-3.5 mr-1 shrink-0" />
                          등록
                        </Button>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 pt-0.5 px-1">
                      <label className="flex items-center gap-1.5 cursor-pointer text-xs font-bold text-slate-700 select-none">
                        <input 
                          type="checkbox" 
                          checked={isNewEventParentPrivate} 
                          onChange={e => setIsNewEventParentPrivate(e.target.checked)} 
                          className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 h-3.5 w-3.5"
                        />
                        🔒 학부모 비공개 (교직원 전용 일정)
                      </label>
                      <span className="text-[10px] text-slate-400 font-normal">
                        (체크 시 학부모 접속 팝업 및 학부모 캘린더에서 가려집니다)
                      </span>
                    </div>
                  </div>

                  {/* 등록 목록 테이블 */}
                  <div className="max-h-[180px] overflow-y-auto border rounded-xl divide-y divide-slate-100 bg-white">
                    {academicCal.events.length > 0 ? (
                      academicCal.events.map(ev => (
                        <div key={ev.id} className="flex items-center justify-between px-3 py-2 text-xs">
                          <div className="flex items-center gap-2 font-mono flex-wrap">
                            <span className="font-bold text-slate-800">{ev.date}</span>
                            <span className="font-semibold text-slate-700">{ev.title}</span>
                            <Badge 
                              variant="outline" 
                              className={`text-[10px] font-semibold px-1.5 py-0 ${
                                ev.type === 'PUBLIC_HOLIDAY' 
                                  ? 'bg-rose-50 text-rose-700 border-rose-200' 
                                  : ev.type === 'HOLIDAY' 
                                    ? 'bg-amber-50 text-amber-800 border-amber-200' 
                                    : 'bg-indigo-50 text-indigo-700 border-indigo-200'
                              }`}
                            >
                              {ev.type === 'PUBLIC_HOLIDAY' ? '공휴일' : ev.type === 'HOLIDAY' ? '휴업일' : '학교행사 (수업일포함)'}
                            </Badge>
                            {ev.isParentPrivate && (
                              <Badge variant="outline" className="text-[10px] bg-purple-50 text-purple-700 border-purple-200 font-bold px-1.5 py-0">
                                🔒 학부모 비공개
                              </Badge>
                            )}
                          </div>
                          <button 
                            type="button" 
                            onClick={() => handleDeleteAcademicEvent(ev.id)} 
                            className="text-slate-400 hover:text-rose-600 p-1 transition"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))
                    ) : (
                      <div className="py-6 text-center text-slate-400 text-xs">
                        등록된 휴업일 / 학교 행사가 없습니다.
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
            <div className="shrink-0 px-6 py-4 border-t flex justify-end bg-slate-50/50">
              <Button onClick={handleSaveAcademicCalendar} disabled={isSaving} className="bg-indigo-600 hover:bg-indigo-700 font-bold">
                {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                학사 일정 설정 저장
              </Button>
            </div>
          </TabsContent>

          <TabsContent value="org" className="flex-1 min-h-0 mt-0 data-[state=active]:flex flex-col">
            <div className="flex-1 overflow-y-auto px-6 py-4">
              <div className="space-y-6">
                <div className="space-y-4">
                  <h4 className="font-semibold text-lg border-b pb-2">학교 리더십 및 업무 담당자</h4>
                  
                  {/* 교장/교감/교무부장은 3열 구성 */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 max-w-2xl">
                    <div className="space-y-2">
                      <Label>학교장 (교장)</Label>
                      <Select value={org.principal} onValueChange={(val) => updateAndSaveOrg(p => ({ ...p, principal: val }), '학교장(교장) 설정이 저장되었습니다.')}>
                        <SelectTrigger><SelectValue placeholder="선택 안됨" /></SelectTrigger>
                        <SelectContent>
                          {facultyUsers.map(u => <SelectItem key={u.email} value={u.email}>{u.name} ({u.email})</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>교감</Label>
                      <Select value={org.vicePrincipal} onValueChange={(val) => updateAndSaveOrg(p => ({ ...p, vicePrincipal: val }), '교감 설정이 저장되었습니다.')}>
                        <SelectTrigger><SelectValue placeholder="선택 안됨" /></SelectTrigger>
                        <SelectContent>
                          {facultyUsers.map(u => <SelectItem key={u.email} value={u.email}>{u.name} ({u.email})</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label className="font-bold text-indigo-700">교무부장</Label>
                      <Select value={org.academicHead} onValueChange={(val) => updateAndSaveOrg(p => ({ ...p, academicHead: val }), '교무부장 설정이 저장되었습니다.')}>
                        <SelectTrigger className="border-indigo-200 bg-indigo-50/40"><SelectValue placeholder="선택 안됨" /></SelectTrigger>
                        <SelectContent>
                          {facultyUsers.map(u => <SelectItem key={u.email} value={u.email}>{u.name} ({u.email})</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {/* 각 업무 담당자 복수 지정은 3열 구성 */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
                    {/* 방과후학교 담당자 */}
                    <div className="space-y-2 border p-3 rounded-lg bg-slate-50/50">
                      <Label className="font-bold text-violet-700">방과후학교 담당자 (복수)</Label>
                      <div className="flex flex-wrap gap-1 p-2 border rounded-md min-h-[50px] bg-white">
                        {(org.afterschoolManagers || []).length === 0 ? (
                          <span className="text-xs text-muted-foreground self-center">지정된 담당자 없음</span>
                        ) : (
                          (org.afterschoolManagers || []).map(email => {
                            const u = users.find(x => x.email === email);
                            return (
                              <span key={email} className="inline-flex items-center gap-1 bg-violet-100 text-violet-800 text-[11px] font-semibold px-2 py-0.5 rounded-full">
                                {u ? u.name : email}
                                <button 
                                  type="button" 
                                  onClick={() => updateAndSaveOrg(p => ({ ...p, afterschoolManagers: (p.afterschoolManagers || []).filter(x => x !== email) }), '방과후 담당자가 삭제되었습니다.')}
                                  className="text-violet-500 hover:text-violet-700 font-bold ml-1"
                                >
                                  ×
                                </button>
                              </span>
                            );
                          })
                        )}
                      </div>
                      <Select 
                        value="" 
                        onValueChange={(val) => {
                          if (val && !(org.afterschoolManagers || []).includes(val)) {
                            updateAndSaveOrg(p => ({ ...p, afterschoolManagers: [...(p.afterschoolManagers || []), val] }), '방과후 담당자가 추가되었습니다.');
                          }
                        }}
                      >
                        <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="교직원 선택..." /></SelectTrigger>
                        <SelectContent>
                          {facultyUsers.map(u => <SelectItem key={u.email} value={u.email}>{u.name} ({u.email})</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* 스쿨버스 담당자 */}
                    <div className="space-y-2 border p-3 rounded-lg bg-slate-50/50">
                      <Label className="font-bold text-amber-700">스쿨버스 담당자 (복수)</Label>
                      <div className="flex flex-wrap gap-1 p-2 border rounded-md min-h-[50px] bg-white">
                        {(org.busManagers || []).length === 0 ? (
                          <span className="text-xs text-muted-foreground self-center">지정된 담당자 없음</span>
                        ) : (
                          (org.busManagers || []).map(email => {
                            const u = users.find(x => x.email === email);
                            return (
                              <span key={email} className="inline-flex items-center gap-1 bg-amber-100 text-amber-800 text-[11px] font-semibold px-2 py-0.5 rounded-full">
                                {u ? u.name : email}
                                <button 
                                  type="button" 
                                  onClick={() => updateAndSaveOrg(p => ({ ...p, busManagers: (p.busManagers || []).filter(x => x !== email) }), '스쿨버스 담당자가 삭제되었습니다.')}
                                  className="text-amber-500 hover:text-amber-700 font-bold ml-1"
                                >
                                  ×
                                </button>
                              </span>
                            );
                          })
                        )}
                      </div>
                      <Select 
                        value="" 
                        onValueChange={(val) => {
                          if (val && !(org.busManagers || []).includes(val)) {
                            updateAndSaveOrg(p => ({ ...p, busManagers: [...(p.busManagers || []), val] }), '스쿨버스 담당자가 추가되었습니다.');
                          }
                        }}
                      >
                        <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="교직원 선택..." /></SelectTrigger>
                        <SelectContent>
                          {facultyUsers.map(u => <SelectItem key={u.email} value={u.email}>{u.name} ({u.email})</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* 시스템 설정 담당자 */}
                    <div className="space-y-2 border p-3 rounded-lg bg-slate-50/50">
                      <Label className="font-bold text-sky-700">시스템 설정 담당자 (복수)</Label>
                      <div className="flex flex-wrap gap-1 p-2 border rounded-md min-h-[50px] bg-white">
                        {(org.systemManagers || []).length === 0 ? (
                          <span className="text-xs text-muted-foreground self-center">지정된 담당자 없음</span>
                        ) : (
                          (org.systemManagers || []).map(email => {
                            const u = users.find(x => x.email === email);
                            return (
                              <span key={email} className="inline-flex items-center gap-1 bg-sky-100 text-sky-800 text-[11px] font-semibold px-2 py-0.5 rounded-full">
                                {u ? u.name : email}
                                <button 
                                  type="button" 
                                  onClick={() => updateAndSaveOrg(p => ({ ...p, systemManagers: (p.systemManagers || []).filter(x => x !== email) }), '시스템 설정 담당자가 삭제되었습니다.')}
                                  className="text-sky-500 hover:text-sky-700 font-bold ml-1"
                                >
                                  ×
                                </button>
                              </span>
                            );
                          })
                        )}
                      </div>
                      <Select 
                        value="" 
                        onValueChange={(val) => {
                          if (val && !(org.systemManagers || []).includes(val)) {
                            updateAndSaveOrg(p => ({ ...p, systemManagers: [...(p.systemManagers || []), val] }), '시스템 설정 담당자가 추가되었습니다.');
                          }
                        }}
                      >
                        <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="교직원 선택..." /></SelectTrigger>
                        <SelectContent>
                          {facultyUsers.map(u => <SelectItem key={u.email} value={u.email}>{u.name} ({u.email})</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {/* 보건교사, 특수교사, 사서교사 지정 카드 (3열 구성) */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
                    {/* 보건교사 */}
                    <div className="space-y-2 border p-3 rounded-lg bg-emerald-50/50">
                      <Label className="font-bold text-emerald-800">보건교사 (복수)</Label>
                      <div className="flex flex-wrap gap-1 p-2 border rounded-md min-h-[50px] bg-white">
                        {(org.healthTeachers || []).length === 0 ? (
                          <span className="text-xs text-muted-foreground self-center">지정된 교사 없음</span>
                        ) : (
                          (org.healthTeachers || []).map(email => {
                            const u = users.find(x => x.email === email);
                            return (
                              <span key={email} className="inline-flex items-center gap-1 bg-emerald-100 text-emerald-800 text-[11px] font-semibold px-2 py-0.5 rounded-full">
                                {u ? u.name : email}
                                <button 
                                  type="button" 
                                  onClick={() => updateAndSaveOrg(p => ({ ...p, healthTeachers: (p.healthTeachers || []).filter(x => x !== email) }), '보건교사가 삭제되었습니다.')}
                                  className="text-emerald-600 hover:text-emerald-800 font-bold ml-1"
                                >
                                  ×
                                </button>
                              </span>
                            );
                          })
                        )}
                      </div>
                      <Select 
                        value="" 
                        onValueChange={(val) => {
                          if (val && !(org.healthTeachers || []).includes(val)) {
                            updateAndSaveOrg(p => ({ ...p, healthTeachers: [...(p.healthTeachers || []), val] }), '보건교사가 추가되었습니다.');
                          }
                        }}
                      >
                        <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="교직원 선택..." /></SelectTrigger>
                        <SelectContent>
                          {facultyUsers.map(u => <SelectItem key={u.email} value={u.email}>{u.name} ({u.email})</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* 특수교사 (도움반) */}
                    <div className="space-y-2 border p-3 rounded-lg bg-teal-50/50">
                      <Label className="font-bold text-teal-800">특수교사 / 도움반 (복수)</Label>
                      <div className="flex flex-wrap gap-1 p-2 border rounded-md min-h-[50px] bg-white">
                        {(org.specialTeachers || []).length === 0 ? (
                          <span className="text-xs text-muted-foreground self-center">지정된 교사 없음</span>
                        ) : (
                          (org.specialTeachers || []).map(email => {
                            const u = users.find(x => x.email === email);
                            return (
                              <span key={email} className="inline-flex items-center gap-1 bg-teal-100 text-teal-800 text-[11px] font-semibold px-2 py-0.5 rounded-full">
                                {u ? u.name : email}
                                <button 
                                  type="button" 
                                  onClick={() => updateAndSaveOrg(p => ({ ...p, specialTeachers: (p.specialTeachers || []).filter(x => x !== email) }), '특수교사가 삭제되었습니다.')}
                                  className="text-teal-600 hover:text-teal-800 font-bold ml-1"
                                >
                                  ×
                                </button>
                              </span>
                            );
                          })
                        )}
                      </div>
                      <Select 
                        value="" 
                        onValueChange={(val) => {
                          if (val && !(org.specialTeachers || []).includes(val)) {
                            updateAndSaveOrg(p => ({ ...p, specialTeachers: [...(p.specialTeachers || []), val] }), '특수교사가 추가되었습니다.');
                          }
                        }}
                      >
                        <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="교직원 선택..." /></SelectTrigger>
                        <SelectContent>
                          {facultyUsers.map(u => <SelectItem key={u.email} value={u.email}>{u.name} ({u.email})</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* 사서교사 */}
                    <div className="space-y-2 border p-3 rounded-lg bg-indigo-50/50">
                      <Label className="font-bold text-indigo-800">사서교사 (복수)</Label>
                      <div className="flex flex-wrap gap-1 p-2 border rounded-md min-h-[50px] bg-white">
                        {(org.librarianTeachers || []).length === 0 ? (
                          <span className="text-xs text-muted-foreground self-center">지정된 교사 없음</span>
                        ) : (
                          (org.librarianTeachers || []).map(email => {
                            const u = users.find(x => x.email === email);
                            return (
                              <span key={email} className="inline-flex items-center gap-1 bg-indigo-100 text-indigo-800 text-[11px] font-semibold px-2 py-0.5 rounded-full">
                                {u ? u.name : email}
                                <button 
                                  type="button" 
                                  onClick={() => updateAndSaveOrg(p => ({ ...p, librarianTeachers: (p.librarianTeachers || []).filter(x => x !== email) }), '사서교사가 삭제되었습니다.')}
                                  className="text-indigo-600 hover:text-indigo-800 font-bold ml-1"
                                >
                                  ×
                                </button>
                              </span>
                            );
                          })
                        )}
                      </div>
                      <Select 
                        value="" 
                        onValueChange={(val) => {
                          if (val && !(org.librarianTeachers || []).includes(val)) {
                            updateAndSaveOrg(p => ({ ...p, librarianTeachers: [...(p.librarianTeachers || []), val] }), '사서교사가 추가되었습니다.');
                          }
                        }}
                      >
                        <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="교직원 선택..." /></SelectTrigger>
                        <SelectContent>
                          {facultyUsers.map(u => <SelectItem key={u.email} value={u.email}>{u.name} ({u.email})</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {/* 교과전담교사 등록 카드 (과목명 커스텀 등록 및 교원 지정) */}
                  <div className="space-y-3 border p-4 rounded-xl bg-purple-50/40 border-purple-200 mt-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <h5 className="font-bold text-sm text-purple-900">교과전담교사 등록 및 담당 지정</h5>
                        <p className="text-xs text-purple-700/80">체육전담, 영어전담 등 과목 명칭을 관리자가 직접 등록하고 담당 교원을 배정합니다.</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 max-w-md">
                      <Input 
                        placeholder="새 과목 명칭 입력 (예: 체육전담, 영어전담)" 
                        value={newSubjectCategoryName} 
                        onChange={e => setNewSubjectCategoryName(e.target.value)}
                        className="h-8 text-xs bg-white border-purple-200"
                      />
                      <Button 
                        type="button"
                        size="sm"
                        onClick={() => {
                          if (!newSubjectCategoryName.trim()) {
                            toast({ variant: 'destructive', title: '과목명 입력', description: '추가할 과목 명칭을 입력하세요.' });
                            return;
                          }
                          const newGrp = {
                            id: Date.now().toString(),
                            categoryName: newSubjectCategoryName.trim(),
                            teacherEmails: []
                          };
                          setOrg(p => ({ ...p, subjectTeacherGroups: [...(p.subjectTeacherGroups || []), newGrp] }));
                          setNewSubjectCategoryName('');
                          toast({ title: '과목 등록 완료', description: `"${newGrp.categoryName}" 카테고리가 추가되었습니다.` });
                        }}
                        className="h-8 text-xs font-bold bg-purple-600 hover:bg-purple-700 text-white shrink-0"
                      >
                        <PlusCircle className="w-3.5 h-3.5 mr-1" />
                        과목 추가
                      </Button>
                    </div>

                    {/* 등록된 교과전담 과목 및 담당 교사 태그 목록 */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 pt-1">
                      {(org.subjectTeacherGroups || []).length === 0 ? (
                        <div className="col-span-full py-4 text-center text-xs text-slate-400">
                          등록된 교과전담 과목이 없습니다. 위에서 과목 명칭을 입력하여 추가하세요.
                        </div>
                      ) : (
                        (org.subjectTeacherGroups || []).map(group => (
                          <div key={group.id} className="border border-purple-200 rounded-lg p-2.5 bg-white space-y-2">
                            <div className="flex items-center justify-between border-b pb-1.5">
                              <span className="font-bold text-xs text-purple-900">{group.categoryName}</span>
                              <button
                                type="button"
                                onClick={() => {
                                  setOrg(p => ({
                                    ...p,
                                    subjectTeacherGroups: (p.subjectTeacherGroups || []).filter(g => g.id !== group.id)
                                  }));
                                }}
                                className="text-slate-400 hover:text-rose-600 text-xs font-bold p-0.5"
                              >
                                삭제
                              </button>
                            </div>

                            <div className="flex flex-wrap gap-1 min-h-[36px] items-center p-1 border border-dashed rounded bg-slate-50">
                              {group.teacherEmails.length === 0 ? (
                                <span className="text-[11px] text-slate-400">담당 교사 없음</span>
                              ) : (
                                group.teacherEmails.map(email => {
                                  const u = users.find(x => x.email === email);
                                  return (
                                    <span key={email} className="inline-flex items-center gap-1 bg-purple-100 text-purple-800 text-[11px] font-semibold px-2 py-0.5 rounded-full">
                                      {u ? u.name : email}
                                      <button 
                                        type="button" 
                                        onClick={() => {
                                          setOrg(p => ({
                                            ...p,
                                            subjectTeacherGroups: (p.subjectTeacherGroups || []).map(g => 
                                              g.id === group.id 
                                                ? { ...g, teacherEmails: g.teacherEmails.filter(x => x !== email) }
                                                : g
                                            )
                                          }));
                                        }}
                                        className="text-purple-600 hover:text-purple-800 font-bold ml-0.5"
                                      >
                                        ×
                                      </button>
                                    </span>
                                  );
                                })
                              )}
                            </div>

                            <Select 
                              value="" 
                              onValueChange={(val) => {
                                if (val && !group.teacherEmails.includes(val)) {
                                  setOrg(p => ({
                                    ...p,
                                    subjectTeacherGroups: (p.subjectTeacherGroups || []).map(g => 
                                      g.id === group.id 
                                        ? { ...g, teacherEmails: [...g.teacherEmails, val] }
                                        : g
                                    )
                                  }));
                                }
                              }}
                            >
                              <SelectTrigger className="h-7 text-[11px]"><SelectValue placeholder="담당 교사 지정..." /></SelectTrigger>
                              <SelectContent>
                                {facultyUsers.map(u => <SelectItem key={u.email} value={u.email}>{u.name} ({u.email})</SelectItem>)}
                              </SelectContent>
                            </Select>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b pb-2 gap-2">
                    <h4 className="font-semibold text-lg text-gray-900">학년별 담임 및 교과(전담) 교사 배정</h4>
                    <span className="text-xs text-muted-foreground">각 학년의 학년부장, 학급 담임교사 및 학년 소속 교과 교사를 배정합니다.</span>
                  </div>
                  
                  {/* 담임 및 교과 배정 일괄 등록 카드 */}
                  <Card className="border shadow-sm bg-muted/20">
                      <CardHeader className="p-4 pb-2">
                          <CardTitle className="text-sm font-bold">담임 및 학년 교과 일괄 등록</CardTitle>
                          <CardDescription className="text-xs">
                              엑셀 파일(.xlsx)로 여러 반의 담임 및 학년 교과(반 컬럼에 '교과' 입력) 교사를 일괄 등록합니다.
                          </CardDescription>
                      </CardHeader>
                      <CardContent className="p-4 pt-0 flex flex-col sm:flex-row items-center gap-2">
                          <Input type="file" accept=".xlsx, .xls" onChange={handleHomeroomFileSelect} className="h-9 flex-grow text-xs bg-white"/>
                          <div className="flex gap-1.5 w-full sm:w-auto shrink-0">
                              <Button onClick={handleDownloadHomeroomTemplate} variant="outline" size="sm" className="h-9 text-xs">
                                  <Download className="mr-1.5 h-3.5 w-3.5"/>
                                  양식
                              </Button>
                              <Button onClick={handleHomeroomUpload} disabled={isUploading || !selectedHomeroomFile} size="sm" className="h-9 text-xs">
                                  {isUploading ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin"/> : <FileUp className="mr-1.5 h-3.5 w-3.5"/>}
                                  업로드
                              </Button>
                          </div>
                      </CardContent>
                  </Card>
                  
                  <div className="flex flex-col lg:flex-row gap-3 items-end bg-muted/30 p-4 rounded-lg border border-border/50 space-y-3 lg:space-y-0">
                    <div className="flex flex-wrap items-end gap-2.5 w-full lg:w-auto">
                      {/* 학년 선택 */}
                      <div className="space-y-1.5 w-24">
                        <Label className="text-xs font-bold text-slate-700">학년</Label>
                        <Select value={newHomeroom.grade} onValueChange={val => setNewHomeroom({ ...newHomeroom, grade: val })}>
                          <SelectTrigger className="h-9 bg-white font-medium"><SelectValue placeholder="학년" /></SelectTrigger>
                          <SelectContent>
                            {[1, 2, 3, 4, 5, 6].map(g => (
                              <SelectItem key={g} value={String(g)}>{g}학년</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      {/* 구분: 담임 / 교과 토글 버튼 */}
                      <div className="space-y-1.5">
                        <Label className="text-xs font-bold text-slate-700">구분</Label>
                        <div className="flex bg-slate-200/80 p-0.5 rounded-lg border border-slate-300/60 h-9">
                          <button
                            type="button"
                            onClick={() => setNewHomeroom(prev => ({ ...prev, roleType: 'homeroom' }))}
                            className={`px-3 py-1 text-xs font-bold rounded-md transition-all flex items-center justify-center gap-1 ${
                              newHomeroom.roleType !== 'subject'
                                ? 'bg-white text-primary shadow-sm'
                                : 'text-slate-600 hover:text-slate-900'
                            }`}
                          >
                            담임
                          </button>
                          <button
                            type="button"
                            onClick={() => setNewHomeroom(prev => ({ ...prev, roleType: 'subject' }))}
                            className={`px-3 py-1 text-xs font-bold rounded-md transition-all flex items-center justify-center gap-1 ${
                              newHomeroom.roleType === 'subject'
                                ? 'bg-sky-600 text-white shadow-sm'
                                : 'text-slate-600 hover:text-slate-900'
                            }`}
                          >
                            교과
                          </button>
                        </div>
                      </div>

                      {/* 담임일 때만 반 입력 및 학년부장 스위치 표시 */}
                      {newHomeroom.roleType !== 'subject' ? (
                        <>
                          <div className="space-y-1.5 w-20">
                            <Label className="text-xs font-bold text-slate-700">반</Label>
                            <Input 
                              type="number" 
                              min="1" 
                              max="20" 
                              placeholder="1" 
                              value={newHomeroom.class} 
                              onChange={e => setNewHomeroom({ ...newHomeroom, class: e.target.value })} 
                              className="h-9 bg-white text-center font-bold" 
                            />
                          </div>
                          <div className="space-y-1.5 flex items-center justify-center pb-2 px-1">
                            <Label className="text-xs flex items-center gap-1.5 cursor-pointer">
                              <Switch 
                                checked={newHomeroom.isGradeHead}
                                onCheckedChange={(checked) => setNewHomeroom({ ...newHomeroom, isGradeHead: checked })}
                              />
                              <span className="font-semibold text-xs text-slate-700">학년부장</span>
                            </Label>
                          </div>
                        </>
                      ) : (
                        <div className="flex items-center pb-2 px-2">
                          <span className="text-xs font-semibold text-sky-700 bg-sky-100/70 border border-sky-200 px-2.5 py-1 rounded-md">
                            {newHomeroom.grade}학년 교과 배정
                          </span>
                        </div>
                      )}
                    </div>
                    
                    <div className="space-y-1.5 flex-1 w-full">
                      <Label className="text-xs font-bold text-slate-700">담당 교사</Label>
                      <Select value={newHomeroom.email} onValueChange={(val) => setNewHomeroom({ ...newHomeroom, email: val })}>
                        <SelectTrigger className="h-9 bg-white"><SelectValue placeholder="교사 선택" /></SelectTrigger>
                        <SelectContent>
                          {facultyUsers.map(u => <SelectItem key={u.email} value={u.email}>{u.name} ({u.email})</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <Button onClick={() => {
                      if (!newHomeroom.email) return toast({ variant: 'destructive', description: '교사를 선택해주세요.'});
                      const grade = newHomeroom.grade;
                      if (newHomeroom.roleType === 'subject') {
                        updateAndSaveOrg(prev => {
                          const prevList = prev.gradeSubjects?.[grade] || [];
                          const updatedList = Array.from(new Set([...prevList, newHomeroom.email]));
                          const newGradeSubjects = { ...(prev.gradeSubjects || {}), [grade]: updatedList };
                          return { ...prev, gradeSubjects: newGradeSubjects };
                        }, `${grade}학년 교과 교사 배정이 즉시 저장되었습니다.`);
                        setNewHomeroom(prev => ({ ...prev, email: '', isGradeHead: false }));
                      } else {
                        const clazz = (newHomeroom.class || '1').trim();
                        if (!clazz) return toast({ variant: 'destructive', description: '반 번호를 입력해주세요.' });
                        const key = `${grade}-${clazz}`;
                        updateAndSaveOrg(prev => {
                          const newHomerooms = { ...prev.homerooms, [key]: newHomeroom.email };
                          const newGradeHeads = { ...prev.gradeHeads };
                          if (newHomeroom.isGradeHead) {
                            newGradeHeads[grade] = newHomeroom.email;
                          }
                          return { ...prev, homerooms: newHomerooms, gradeHeads: newGradeHeads };
                        }, `${grade}학년 ${clazz}반 담임 배정이 즉시 저장되었습니다.`);
                        setNewHomeroom(prev => ({ ...prev, email: '', isGradeHead: false }));
                      }
                    }} className="h-9 w-full lg:w-auto font-bold bg-primary hover:bg-primary/90 text-white">추가/변경</Button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 mt-4">
                    {(() => {
                      // 1. Homeroom items
                      const homeroomItems = Object.entries(org.homerooms || {}).map(([gradeClass, email]) => {
                        const [grade, clazz] = gradeClass.split('-');
                        return {
                          type: 'homeroom' as const,
                          grade: parseInt(grade, 10) || 0,
                          gradeStr: grade,
                          classNum: parseInt(clazz, 10) || 999,
                          classStr: clazz,
                          email,
                          key: `hr-${gradeClass}`
                        };
                      });

                      // 2. Grade Subject items
                      const subjectItems: any[] = [];
                      Object.entries(org.gradeSubjects || {}).forEach(([grade, emails]) => {
                        (emails || []).forEach((email, idx) => {
                          subjectItems.push({
                            type: 'subject' as const,
                            grade: parseInt(grade, 10) || 0,
                            gradeStr: grade,
                            classNum: 1000 + idx,
                            classStr: '교과',
                            email,
                            key: `subj-${grade}-${email}`
                          });
                        });
                      });

                      // 3. Combined & sorted by grade, then by classNum
                      const allGradeItems = [...homeroomItems, ...subjectItems].sort((a, b) => {
                        if (a.grade !== b.grade) return a.grade - b.grade;
                        return a.classNum - b.classNum;
                      });

                      if (allGradeItems.length === 0) {
                        return (
                          <div className="col-span-full py-8 text-center text-sm text-muted-foreground bg-muted/20 rounded-lg border border-dashed">
                            배정된 학년 담임 및 교과 교사가 없습니다. 위에서 추가하거나 엑셀로 일괄 등록하세요.
                          </div>
                        );
                      }

                      return allGradeItems.map((item) => {
                        const user = users.find(u => u.email?.toLowerCase() === item.email?.toLowerCase());
                        const isGradeHead = item.type === 'homeroom' && org.gradeHeads[item.gradeStr] === item.email;

                        if (item.type === 'subject') {
                          return (
                            <div key={item.key} className="flex flex-col bg-sky-50/40 border border-sky-200/80 p-3 rounded-lg shadow-sm space-y-3 justify-between">
                              <div className="flex justify-between items-start">
                                <div className="flex flex-col overflow-hidden">
                                  <div className="flex items-center gap-1.5">
                                    <span className="font-bold text-sm text-sky-950">{item.gradeStr}학년 교과</span>
                                    <Badge variant="outline" className="text-[10px] px-1.5 py-0 bg-sky-100/70 text-sky-700 border-sky-300">교과</Badge>
                                  </div>
                                  <span className="text-xs text-muted-foreground truncate">{user ? user.name : item.email}</span>
                                </div>
                                <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive shrink-0 hover:bg-red-50 hover:text-red-600 rounded" onClick={() => {
                                  updateAndSaveOrg(prev => {
                                    const prevList = prev.gradeSubjects?.[item.gradeStr] || [];
                                    const updatedList = prevList.filter(e => e.toLowerCase() !== item.email.toLowerCase());
                                    const newGradeSubjects = { ...(prev.gradeSubjects || {}), [item.gradeStr]: updatedList };
                                    return { ...prev, gradeSubjects: newGradeSubjects };
                                  }, `${item.gradeStr}학년 교과 배정이 삭제되었습니다.`);
                                }}>
                                  <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                              </div>
                              <div className="flex items-center justify-between border-t border-sky-200/50 pt-2 mt-1">
                                <span className="text-[11px] text-sky-700 font-medium">{item.gradeStr}학년 소속 교과 교사</span>
                              </div>
                            </div>
                          );
                        }

                        return (
                          <div key={item.key} className="flex flex-col bg-card border p-3 rounded-lg shadow-sm space-y-3 justify-between">
                            <div className="flex justify-between items-start">
                              <div className="flex flex-col overflow-hidden">
                                <span className="font-bold text-sm text-gray-900">{item.gradeStr}학년 {item.classStr}반</span>
                                <span className="text-xs text-muted-foreground truncate">{user ? user.name : item.email}</span>
                              </div>
                              <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive shrink-0 hover:bg-red-50 hover:text-red-600 rounded" onClick={() => {
                                updateAndSaveOrg(prev => {
                                  const newHomerooms = { ...prev.homerooms };
                                  delete newHomerooms[`${item.gradeStr}-${item.classStr}`];
                                  const newGradeHeads = { ...prev.gradeHeads };
                                  if (newGradeHeads[item.gradeStr] === item.email) {
                                    delete newGradeHeads[item.gradeStr];
                                  }
                                  return { ...prev, homerooms: newHomerooms, gradeHeads: newGradeHeads };
                                }, `${item.gradeStr}학년 ${item.classStr}반 담임 배정이 삭제되었습니다.`);
                              }}>
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                            <div className="flex items-center justify-between border-t pt-2 mt-1">
                              <Label className="text-xs flex items-center gap-1.5 cursor-pointer">
                                <Switch 
                                  checked={isGradeHead}
                                  onCheckedChange={(checked) => {
                                    updateAndSaveOrg(prev => {
                                      const newGradeHeads = { ...prev.gradeHeads };
                                      if (checked) {
                                        newGradeHeads[item.gradeStr] = item.email;
                                      } else if (newGradeHeads[item.gradeStr] === item.email) {
                                        delete newGradeHeads[item.gradeStr];
                                      }
                                      return { ...prev, gradeHeads: newGradeHeads };
                                    }, `${item.gradeStr}학년 학년부장 설정이 저장되었습니다.`);
                                  }}
                                />
                                <span className={`text-[11px] font-bold transition-colors ${isGradeHead ? 'text-primary' : 'text-muted-foreground'}`}>학년부장</span>
                              </Label>
                            </div>
                          </div>
                        );
                      });
                    })()}
                  </div>
                </div>

                {/* 동명이인 처리 UI */}
                {duplicatePendingRows.length > 0 && (
                  <div className="space-y-3 p-4 bg-amber-50 border border-amber-200 rounded-xl">
                    <div className="flex items-center justify-between">
                      <h5 className="font-bold text-amber-800 text-sm">⚠️ 동명이인 발생 — 교사 선택 필요</h5>
                      <span className="text-xs text-amber-600">{duplicatePendingRows.length}건</span>
                    </div>
                    <p className="text-xs text-amber-700">아래 반에 배정하려는 이름의 교사가 여러 명입니다. 정확한 교사를 직접 선택해 주세요.</p>
                    <div className="space-y-2">
                      {duplicatePendingRows.map(row => {
                        const key = `${row.grade}-${row.class}`;
                        return (
                          <div key={key} className="flex items-center gap-3 bg-white rounded-lg border border-amber-200 px-3 py-2">
                            <span className="text-sm font-bold text-gray-900 shrink-0 w-20">{row.grade}학년 {row.class}반</span>
                            <Select
                              value={duplicateResolvedEmails[key] || ''}
                              onValueChange={(val) => setDuplicateResolvedEmails(prev => ({ ...prev, [key]: val }))}
                            >
                              <SelectTrigger className="h-8 flex-1 text-xs">
                                <SelectValue placeholder="교사를 선택해 주세요" />
                              </SelectTrigger>
                              <SelectContent>
                                {row.candidates.map(c => (
                                  <SelectItem key={c.email} value={c.email}>
                                    {c.name} ({c.email}) — {c.role}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            {row.isHead && (
                              <span className="text-[10px] font-bold text-primary bg-primary/10 px-1.5 py-0.5 rounded shrink-0">학년부장</span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                    <div className="flex gap-2 justify-end pt-1">
                      <Button variant="outline" size="sm" onClick={() => { setDuplicatePendingRows([]); setDuplicateResolvedEmails({}); }}>
                        취소
                      </Button>
                      <Button size="sm" onClick={handleResolveDuplicates} className="bg-amber-600 hover:bg-amber-700 text-white">
                        선택 완료 ({Object.keys(duplicateResolvedEmails).length}/{duplicatePendingRows.length}건)
                      </Button>
                    </div>
                  </div>
                )}

                <div className="space-y-4">
                  <h4 className="font-semibold text-lg border-b pb-2">부서 관리</h4>
                  
                  {/* 부서 일괄 등록 카드 */}
                  <Card className="border shadow-sm bg-muted/20">
                    <CardHeader className="p-4 pb-2">
                      <CardTitle className="text-sm font-bold">부서 일괄 등록</CardTitle>
                      <CardDescription className="text-xs">
                        엑셀 파일로 부서를 일괄 등록합니다. 한 행에 한 명씩 (부서명 / 이름 / 직책) 입력하세요. 같은 부서명끼리 자동 그룹핑됩니다.
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="p-4 pt-0 flex flex-col sm:flex-row items-center gap-2">
                      <Input type="file" accept=".xlsx, .xls" onChange={handleDeptFileSelect} className="h-9 flex-grow text-xs bg-white"/>
                      <div className="flex gap-1.5 w-full sm:w-auto shrink-0">
                        <Button onClick={handleDownloadDeptTemplate} variant="outline" size="sm" className="h-9 text-xs">
                          <Download className="mr-1.5 h-3.5 w-3.5"/>
                          양식
                        </Button>
                        <Button onClick={handleDeptUpload} disabled={isUploading || !selectedDeptFile} size="sm" className="h-9 text-xs">
                          {isUploading ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin"/> : <FileUp className="mr-1.5 h-3.5 w-3.5"/>}
                          업로드
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                  
                  <div className="flex gap-2 items-center mb-4">
                    <Input 
                      placeholder="새 부서명 (예: 문예방과후부)" 
                      value={newDeptName} 
                      onChange={e => setNewDeptName(e.target.value)} 
                      onKeyDown={e => e.key === 'Enter' && addDepartment()}
                      className="max-w-[300px]"
                    />
                    <Button onClick={addDepartment} variant="secondary">부서 추가</Button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {(org.departments || []).map(dept => (
                      <Card key={dept.id} className="border shadow-sm">
                        <CardHeader className="p-4 pb-2 flex flex-row items-center justify-between">
                          <CardTitle className="text-base font-bold">{dept.name}</CardTitle>
                          <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive" onClick={() => deleteDepartment(dept.id)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </CardHeader>
                        <CardContent className="p-4 pt-0 space-y-4">
                          <div className="space-y-1">
                            <Label className="text-xs text-muted-foreground">부장 교사</Label>
                            <Select value={dept.headEmail || ''} onValueChange={(val) => updateDeptHead(dept.id, val)}>
                              <SelectTrigger className="h-8"><SelectValue placeholder="부장 선택" /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="unassigned">선택 안됨</SelectItem>
                                {facultyUsers.map(u => <SelectItem key={u.email} value={u.email}>{u.name} ({u.email})</SelectItem>)}
                              </SelectContent>
                            </Select>
                          </div>
                          
                          <div className="space-y-1">
                            <Label className="text-xs text-muted-foreground">부원 배정 (다중 추가 가능)</Label>
                            <div className="flex gap-2">
                              <Select onValueChange={(val) => addDeptMember(dept.id, val)} value="">
                                <SelectTrigger className="h-8 flex-1">
                                  <SelectValue placeholder="부원 추가..." />
                                </SelectTrigger>
                                <SelectContent>
                                  {facultyUsers.map(u => <SelectItem key={u.email} value={u.email}>{u.name} ({u.email})</SelectItem>)}
                                </SelectContent>
                              </Select>
                            </div>
                            {dept.memberEmails.length > 0 && (
                              <div className="flex flex-wrap gap-2 mt-2">
                                {dept.memberEmails.map(email => {
                                  const u = users.find(user => user.email === email);
                                  return (
                                    <div key={email} className="flex items-center gap-1 bg-secondary/50 text-secondary-foreground text-xs px-2 py-1 rounded-full">
                                      <span className="truncate max-w-[120px]">{u ? u.name : email}</span>
                                      <button onClick={() => removeDeptMember(dept.id, email)} className="text-muted-foreground hover:text-destructive">
                                        <XCircle className="h-3 w-3" />
                                      </button>
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>
              </div>
            </div>
            <div className="shrink-0 px-6 py-4 border-t flex justify-end">
              <Button onClick={handleOrgSave} disabled={isSaving}>
                {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                조직도 저장
              </Button>
            </div>
          </TabsContent>

          <TabsContent value="delegation" className="flex-1 min-h-0 mt-0 data-[state=active]:flex flex-col">
            <div className="flex-1 overflow-y-auto px-6 py-4 flex flex-col gap-4">
            <Card className="border-slate-200 shadow-2xs">
                <CardHeader className="pb-3">
                    <CardTitle className="text-lg flex items-center gap-2">
                      <FileText className="w-5 h-5 text-indigo-600" />
                      위임전결규정 일괄 등록 및 양식
                    </CardTitle>
                    <CardDescription>
                        결석계, 체험학습신청서, 연간계획공문, 세부계획공문, 복무 등의 학교별 전결규정을 등록 및 관리합니다.
                    </CardDescription>
                </CardHeader>
                <CardContent className="flex flex-col sm:flex-row items-center gap-4">
                    <Input type="file" accept=".xlsx, .xls" onChange={handleDelegationFileSelect} className="flex-grow"/>
                    <div className="flex gap-2 w-full sm:w-auto">
                        <Button onClick={handleDownloadDelegationTemplate} variant="outline" size="sm">
                            <Download className="mr-2 h-4 w-4"/>
                            표준 양식 다운로드
                        </Button>
                        <Button onClick={handleDelegationUpload} disabled={isUploading || !selectedDelegationFile} size="sm">
                            {isUploading ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <FileUp className="mr-2 h-4 w-4"/>}
                            엑셀 업로드
                        </Button>
                    </div>
                </CardContent>
            </Card>

            <div className="flex flex-wrap justify-between items-center px-1 gap-2">
                <div className="flex items-center gap-2">
                  <h3 className="text-lg font-semibold">전결규정 목록 ({delegationRules.length})</h3>
                  <Badge variant="outline" className="text-xs text-muted-foreground">변경 시 실시간 자동 저장</Badge>
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" onClick={handleResetDefaultDelegation}>
                      <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
                      기본 규정 초기화 (8종)
                  </Button>
                  <Button variant="outline" size="sm" onClick={addDelegationRule} className="bg-primary/5 hover:bg-primary/10 text-primary border-primary/20">
                      <PlusCircle className="mr-1.5 h-3.5 w-3.5" />
                      새 규정 추가
                  </Button>
                </div>
            </div>

            <div className="border rounded-md flex-1 overflow-y-auto">
              <Table>
                  <TableHeader className="sticky top-0 bg-slate-50 z-10">
                  <TableRow>
                      <TableHead className="w-[120px]">대분류</TableHead>
                      <TableHead className="w-[150px]">문서명(중분류)</TableHead>
                      <TableHead className="w-[130px]">소분류/조건</TableHead>
                      <TableHead className="w-[150px]">중간 결재자</TableHead>
                      <TableHead className="w-[160px]">최종 결재권자 (전결)</TableHead>
                      <TableHead className="min-w-[220px]">결재선 미리보기</TableHead>
                      <TableHead className="w-[60px] text-right">삭제</TableHead>
                  </TableRow>
                  </TableHeader>
                  <TableBody>
                  {delegationRules.map((rule, index) => (
                  <TableRow key={rule.id || index}>
                      <TableCell>
                        <Input value={rule.mainType} onChange={e => handleDelegationUpdate(index, 'mainType', e.target.value)} className="h-8 text-xs font-medium" placeholder="대분류" />
                      </TableCell>
                      <TableCell>
                        <Input value={rule.subType} onChange={e => handleDelegationUpdate(index, 'subType', e.target.value)} className="h-8 text-xs font-bold text-slate-800" placeholder="결석계, 연간계획 등" />
                      </TableCell>
                      <TableCell>
                        <Input value={rule.detailType} onChange={e => handleDelegationUpdate(index, 'detailType', e.target.value)} className="h-8 text-xs" placeholder="조건/세부구분" />
                      </TableCell>
                      <TableCell>
                        <Select value={rule.intermediateApprover || 'NONE'} onValueChange={(val) => handleDelegationUpdate(index, 'intermediateApprover', val)}>
                            <SelectTrigger className="h-8 text-xs bg-white"><SelectValue /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="NONE">없음 (바로 최종결재)</SelectItem>
                                <SelectItem value="GRADE_HEAD">학년부장</SelectItem>
                                <SelectItem value="ACADEMIC_HEAD">교무부장</SelectItem>
                                <SelectItem value="DEPT_HEAD">담당부장</SelectItem>
                            </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>
                        <Select value={rule.finalApprover} onValueChange={(val) => handleDelegationUpdate(index, 'finalApprover', val)}>
                            <SelectTrigger className="h-8 text-xs bg-white font-semibold text-primary"><SelectValue /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="GRADE_HEAD">학년부장 (전결)</SelectItem>
                                <SelectItem value="ACADEMIC_HEAD">교무부장 (전결)</SelectItem>
                                <SelectItem value="DEPT_HEAD">담당부장 (전결)</SelectItem>
                                <SelectItem value="VP">교감 (전결)</SelectItem>
                                <SelectItem value="PRINCIPAL">교장 (결재)</SelectItem>
                            </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary" className="font-sans text-[11px] bg-slate-100 text-slate-700 border border-slate-200 py-1 px-2">
                          {renderApprovalLinePreview(rule)}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive/90" onClick={() => deleteDelegationRule(index)}>
                              <Trash2 className="h-4 w-4" />
                          </Button>
                      </TableCell>
                  </TableRow>
                  ))}
                  </TableBody>
              </Table>
            </div>
            </div>
            <div className="shrink-0 px-6 py-4 border-t flex justify-end">
              <Button onClick={handleDelegationSave} disabled={isSaving}>
                {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                전결규정 저장
              </Button>
            </div>
          </TabsContent>

          <TabsContent value="users" className="flex-1 min-h-0 mt-0 data-[state=active]:flex flex-col">
            <div className="flex-1 min-h-0 px-6 py-4 flex flex-col gap-3">
              {/* 일괄 등록 팝업 다이얼로그 */}
              <Dialog open={isBulkUploadOpen} onOpenChange={setIsBulkUploadOpen}>
                <DialogContent className="sm:max-w-lg">
                  <DialogHeader>
                    <DialogTitle>{userSubTab === 'students' ? '학생 계정 일괄 등록' : '교직원 일괄 등록'}</DialogTitle>
                    <DialogDescription>
                      {userSubTab === 'students'
                        ? '엑셀 파일로 학생 계정을 추가하거나 업데이트합니다.'
                        : '엑셀 파일로 교직원 사용자를 추가하거나 업데이트합니다.'}
                    </DialogDescription>
                  </DialogHeader>

                  <div className="flex flex-col gap-4 py-2">
                    {userSubTab === 'students' ? (
                      <div className="bg-slate-50 border border-slate-200 p-3 rounded-xl text-xs space-y-1.5">
                        <div className="font-bold text-slate-800 flex items-center gap-1.5">
                          <span className="text-blue-600">📌 필수 입력 항목:</span>
                          <span className="bg-blue-100 text-blue-800 px-2 py-0.5 rounded font-mono text-[11px]">
                            학년, 반, 번호, 학생이름, 학생 계정 이메일
                          </span>
                        </div>
                        <div className="text-slate-500 text-[11px] leading-relaxed">
                          • <b>추후 입력 가능 (선택)</b>: 보호자 이름, 보호자 연락처
                          <br />
                          • 엑셀 양식을 다운로드하여 작성 후 업로드해주세요.
                        </div>
                      </div>
                    ) : (
                      <div className="bg-slate-50 border border-slate-200 p-3 rounded-xl text-xs space-y-1.5">
                        <div className="font-bold text-slate-800 flex items-center gap-1.5">
                          <span className="text-blue-600">📌 필수 입력 항목:</span>
                          <span className="bg-blue-100 text-blue-800 px-2 py-0.5 rounded font-mono text-[11px]">
                            이메일, 이름, 직책, 소속
                          </span>
                        </div>
                      </div>
                    )}

                    <Input type="file" accept=".xlsx, .xls" onChange={onFileSelect} />
                    <div className="flex gap-2 justify-end">
                      <Button onClick={handleDownloadTemplate} variant="outline" size="sm">
                        <Download className="mr-2 h-4 w-4"/>양식 다운로드
                      </Button>
                      <Button onClick={handleBulkUpload} disabled={isUploading || !selectedFile} size="sm">
                        {isUploading ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <FileUp className="mr-2 h-4 w-4"/>}
                        업로드
                      </Button>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>

              <Tabs value={userSubTab} onValueChange={(val) => setUserSubTab(val as 'teachers' | 'students')} className="flex-1 min-h-0 flex flex-col">
                <div className="flex justify-between items-center px-1 shrink-0 mb-2">
                    <TabsList className="grid grid-cols-2 w-[340px]">
                      <TabsTrigger value="teachers">교직원 ({users.filter(u => u.email === 'beside1s@kshcm.net' || (!u.studentName && u.role !== '학부모' && u.role !== 'student')).length})</TabsTrigger>
                      <TabsTrigger value="students">학생 계정 ({users.filter(u => u.email !== 'beside1s@kshcm.net' && (!!u.studentName || u.role === '학부모' || u.role === 'student' || /^\d{4}[a-zA-Z]+@kshcm\.net$/i.test(u.email))).length})</TabsTrigger>
                    </TabsList>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" onClick={() => setIsBulkUploadOpen(true)}>
                        <FileUp className="mr-2 h-4 w-4" />일괄 등록
                      </Button>
                      {!isAddingNewUser && (
                          <Button variant="outline" size="sm" onClick={() => setIsAddingNewUser(true)}>
                              <PlusCircle className="mr-2 h-4 w-4" />추가
                          </Button>
                      )}
                    </div>
                </div>

                <TabsContent value="teachers" className="flex-1 min-h-0 data-[state=active]:flex flex-col border rounded-md overflow-y-auto">
                  <Table>
                      <TableHeader className="sticky top-0 bg-background z-10">
                      <TableRow>
                          <TableHead className="w-[150px]">사용자</TableHead>
                          <TableHead>소속 (학년/부서)</TableHead>
                          <TableHead className="w-[140px]">직책</TableHead>
                          <TableHead className="w-[80px] text-center">연가(일)</TableHead>
                          <TableHead className="w-[85px]">관리자</TableHead>
                          <TableHead className="w-[60px] text-right">관리</TableHead>
                      </TableRow>
                      </TableHeader>
                      <TableBody>
                      {isAddingNewUser && (
                          <TableRow className="bg-muted/50">
                              <TableCell className="flex flex-col gap-2">
                              <Input 
                                  placeholder="이름" 
                                  value={newUser.name}
                                  onChange={(e) => setNewUser(p => ({ ...p, name: e.target.value }))}
                                  className="h-8"
                              />
                              <Input 
                                  placeholder="이메일" 
                                  value={newUser.email} 
                                  onChange={(e) => setNewUser(p => ({ ...p, email: e.target.value }))}
                                  className="h-8"
                              />
                              </TableCell>
                              <TableCell className="align-top pt-3">
                              <Input 
                                  placeholder="소속 (예: 1학년부)" 
                                  value={newUser.dept || ''} 
                                  onChange={(e) => setNewUser(p => ({ ...p, dept: e.target.value }))}
                                  className="h-8"
                              />
                              </TableCell>
                              <TableCell className="align-top pt-3">
                                  <Select value={newUser.role} onValueChange={(r) => setNewUser(p => ({ ...p, role: r }))}>
                                      <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                                      <SelectContent>{ROLES.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}</SelectContent>
                                  </Select>
                              </TableCell>
                              <TableCell className="align-top pt-3"></TableCell>
                              <TableCell></TableCell>
                              <TableCell className="text-right align-top pt-3">
                                  <div className="flex justify-end gap-1">
                                      <Button size="icon" variant="ghost" className="h-8 w-8" onClick={handleAddNewUser}><Save className="h-4 w-4 text-primary"/></Button>
                                      <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => setIsAddingNewUser(false)}><XCircle className="h-4 w-4 text-muted-foreground"/></Button>
                                  </div>
                              </TableCell>
                          </TableRow>
                      )}
                      {users.filter(user => user.email === 'beside1s@kshcm.net' || (!user.studentName && user.role !== '학부모' && user.role !== 'student')).map(user => (
                        <TableRow key={user.email}>
                          <TableCell>
                          <div className="font-medium">{user.name}</div>
                          <div className="text-xs text-muted-foreground">{user.email}</div>
                          </TableCell>
                          <TableCell className="text-sm font-semibold text-slate-600 max-w-[200px] truncate" title={user.dept || getUserDepartmentOrClass(user.email, org)}>
                            {user.dept || getUserDepartmentOrClass(user.email, org)}
                          </TableCell>
                          <TableCell>
                          <Select 
                              value={user.role} 
                              onValueChange={(newRole) => handleUserUpdate(user.uid, user.email, 'role', newRole)}
                              >
                              <SelectTrigger className="h-8">
                                  <SelectValue placeholder="직책" />
                              </SelectTrigger>
                              <SelectContent>
                                  {Array.from(new Set([...ROLES, ...(user.role ? [user.role] : [])])).map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                              </SelectContent>
                              </Select>
                          </TableCell>
                          <TableCell className="text-center">
                              <Input
                                  type="number"
                                  min={1}
                                  max={30}
                                  className="h-8 w-16 text-center mx-auto"
                                  value={user.annualLeaveLimit ?? 21}
                                  onChange={async (e) => {
                                      const val = parseInt(e.target.value);
                                      if (!isNaN(val) && val > 0) {
                                          await handleUserUpdate(user.uid, user.email, 'annualLeaveLimit', val);
                                      }
                                  }}
                              />
                          </TableCell>
                          <TableCell>
                              <Switch 
                                  id={`admin-${user.email}`} 
                                  checked={user.isAdmin}
                                  onCheckedChange={(checked) => handleUserUpdate(user.uid, user.email, 'isAdmin', checked)}
                                  disabled={user.email === 'beside1s@kshcm.net'} // 슈퍼 관리자 보호
                              />
                          </TableCell>
                          <TableCell className="text-right">
                              <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive/90" onClick={() => confirmDeleteUser(user)}>
                                  <Trash2 className="h-4 w-4" />
                              </Button>
                          </TableCell>
                      </TableRow>
                      ))}
                      </TableBody>
                  </Table>
                </TabsContent>

                <TabsContent value="students" className="flex-1 min-h-0 data-[state=active]:flex flex-col border rounded-md mt-0">
                  {/* ── 학생 탭 필터 바 ── */}
                  {(() => {
                    const allStudents = users.filter(u =>
                      u.email !== 'beside1s@kshcm.net' &&
                      (!!u.studentName || u.role === '학부모' || u.role === 'student' || /^\d{4}[a-zA-Z]+@kshcm\.net$/i.test(u.email))
                    );
                    // 학년 목록 자동 추출
                    const gradeOptions = Array.from(new Set(allStudents.map(u => u.studentGrade).filter(Boolean))).sort();
                    // 반 목록 (선택 학년 기반)
                    const classOptions = Array.from(new Set(
                      allStudents
                        .filter(u => studentFilterGrade === 'all' || String(u.studentGrade) === studentFilterGrade)
                        .map(u => u.studentClass).filter(Boolean)
                    )).sort((a, b) => Number(a) - Number(b));

                    // 필터 + 검색 적용
                    const filtered = allStudents.filter(u => {
                      const matchGrade = studentFilterGrade === 'all' || String(u.studentGrade) === studentFilterGrade;
                      const matchClass = studentFilterClass === 'all' || String(u.studentClass) === studentFilterClass;
                      const q = studentSearchText.trim().toLowerCase();
                      const matchSearch = !q || (u.studentName || '').toLowerCase().includes(q) || (u.parentName || '').toLowerCase().includes(q) || (u.email || '').toLowerCase().includes(q);
                      return matchGrade && matchClass && matchSearch;
                    }).sort((a, b) => {
                      if (a.studentGrade !== b.studentGrade) return Number(a.studentGrade || 0) - Number(b.studentGrade || 0);
                      if (a.studentClass !== b.studentClass) return Number(a.studentClass || 0) - Number(b.studentClass || 0);
                      return Number(a.studentNumber || 0) - Number(b.studentNumber || 0);
                    });

                    const totalPages = Math.max(1, Math.ceil(filtered.length / STUDENTS_PER_PAGE));
                    const safePage = Math.min(studentPage, totalPages);
                    const pageStudents = filtered.slice((safePage - 1) * STUDENTS_PER_PAGE, safePage * STUDENTS_PER_PAGE);

                    return (
                      <>
                        {/* 필터 바 */}
                        <div className="flex flex-wrap items-center gap-2 px-3 py-2 border-b bg-slate-50/80 shrink-0">
                          <select
                            value={studentFilterGrade}
                            onChange={e => { setStudentFilterGrade(e.target.value); setStudentFilterClass('all'); setStudentPage(1); }}
                            className="h-8 text-xs px-2 border rounded-md bg-white focus:outline-none focus:ring-1 focus:ring-primary"
                          >
                            <option value="all">전체 학년</option>
                            {gradeOptions.map(g => <option key={g} value={String(g)}>{g}학년</option>)}
                          </select>
                          <select
                            value={studentFilterClass}
                            onChange={e => { setStudentFilterClass(e.target.value); setStudentPage(1); }}
                            className="h-8 text-xs px-2 border rounded-md bg-white focus:outline-none focus:ring-1 focus:ring-primary"
                            disabled={studentFilterGrade === 'all'}
                          >
                            <option value="all">전체 반</option>
                            {classOptions.map(c => <option key={c} value={String(c)}>{c}반</option>)}
                          </select>
                          <input
                            type="text"
                            placeholder="학생 이름 / 이메일 검색..."
                            value={studentSearchText}
                            onChange={e => { setStudentSearchText(e.target.value); setStudentPage(1); }}
                            className="h-8 text-xs px-3 border rounded-md bg-white focus:outline-none focus:ring-1 focus:ring-primary flex-1 min-w-[160px]"
                          />
                          <span className="text-[11px] text-muted-foreground shrink-0">
                            {filtered.length}명
                          </span>
                          <button
                            type="button"
                            onClick={() => fetchUsers(true)}
                            className="h-8 px-2.5 text-xs border rounded-md bg-white hover:bg-slate-100 text-slate-600 shrink-0 flex items-center gap-1"
                            title="목록 강제 새로고침"
                          >
                            ↺ 새로고침
                          </button>
                        </div>

                        {/* 학생 목록 테이블 */}
                        <div className="flex-1 overflow-y-auto">
                          <Table>
                            <TableHeader className="sticky top-0 bg-background z-10">
                              <TableRow>
                                <TableHead className="w-[120px]">학년/반/번호</TableHead>
                                <TableHead>학생 이름</TableHead>
                                <TableHead>보호자 이름</TableHead>
                                <TableHead>학생 계정 이메일 (학부모 겸용)</TableHead>
                                <TableHead>보호자 연락처</TableHead>
                                <TableHead className="w-[100px] text-center">PIN 설정</TableHead>
                                <TableHead className="w-[70px] text-right">관리</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                            {isAddingNewUser && (
                                <TableRow className="bg-muted/50">
                                    <TableCell className="flex gap-1.5 align-top pt-3">
                                    <Input 
                                        placeholder="학년" 
                                        value={newStudent.grade}
                                        onChange={(e) => setNewStudent(p => ({ ...p, grade: e.target.value }))}
                                        className="h-8 w-12"
                                    />
                                    <Input 
                                        placeholder="반" 
                                        value={newStudent.class}
                                        onChange={(e) => setNewStudent(p => ({ ...p, class: e.target.value }))}
                                        className="h-8 w-12"
                                    />
                                    <Input 
                                        placeholder="번호" 
                                        value={newStudent.number}
                                        onChange={(e) => setNewStudent(p => ({ ...p, number: e.target.value }))}
                                        className="h-8 w-14"
                                    />
                                    </TableCell>
                                    <TableCell className="align-top pt-3">
                                    <Input 
                                        placeholder="학생 이름" 
                                        value={newStudent.studentName}
                                        onChange={(e) => setNewStudent(p => ({ ...p, studentName: e.target.value }))}
                                        className="h-8"
                                    />
                                    </TableCell>
                                    <TableCell className="align-top pt-3">
                                    <Input 
                                        placeholder="학부모 이름" 
                                        value={newStudent.parentName}
                                        onChange={(e) => setNewStudent(p => ({ ...p, parentName: e.target.value }))}
                                        className="h-8"
                                    />
                                    </TableCell>
                                    <TableCell className="align-top pt-3">
                                    <Input 
                                        placeholder="학부모 이메일" 
                                        value={newStudent.email}
                                        onChange={(e) => setNewStudent(p => ({ ...p, email: e.target.value }))}
                                        className="h-8"
                                    />
                                    </TableCell>
                                    <TableCell className="align-top pt-3">
                                    <Input 
                                        placeholder="학부모 연락처" 
                                        value={newStudent.phone}
                                        onChange={(e) => setNewStudent(p => ({ ...p, phone: e.target.value }))}
                                        className="h-8"
                                    />
                                    </TableCell>
                                    <TableCell className="align-top pt-3 text-center"></TableCell>
                                    <TableCell className="text-right align-top pt-3">
                                        <div className="flex justify-end gap-1">
                                            <Button size="icon" variant="ghost" className="h-8 w-8" onClick={handleAddNewStudent}><Save className="h-4 w-4 text-primary"/></Button>
                                            <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => setIsAddingNewUser(false)}><XCircle className="h-4 w-4 text-muted-foreground"/></Button>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            )}
                            {pageStudents.length === 0 && !isAddingNewUser ? (
                              <TableRow>
                                <TableCell colSpan={7} className="text-center py-10 text-muted-foreground text-sm">
                                  {studentSearchText || studentFilterGrade !== 'all' ? '검색 결과가 없습니다.' : '등록된 학생이 없습니다.'}
                                </TableCell>
                              </TableRow>
                            ) : pageStudents.map(user => (
                              <TableRow key={user.email} className={editingStudent?.email === user.email ? 'bg-blue-50' : ''}>
                                {editingStudent?.email === user.email ? (
                                  <>
                                    <TableCell className="p-1">
                                      <div className="flex gap-1">
                                        <Input placeholder="학년" value={editStudentForm.grade} onChange={(e) => setEditStudentForm(p => ({...p, grade: e.target.value}))} className="h-7 w-12 text-xs"/>
                                        <Input placeholder="반" value={editStudentForm.class} onChange={(e) => setEditStudentForm(p => ({...p, class: e.target.value}))} className="h-7 w-12 text-xs"/>
                                        <Input placeholder="번호" value={editStudentForm.number} onChange={(e) => setEditStudentForm(p => ({...p, number: e.target.value}))} className="h-7 w-12 text-xs"/>
                                      </div>
                                    </TableCell>
                                    <TableCell className="p-1"><Input placeholder="학생 이름" value={editStudentForm.studentName} onChange={(e) => setEditStudentForm(p => ({...p, studentName: e.target.value}))} className="h-7 text-xs"/></TableCell>
                                    <TableCell className="p-1"><Input placeholder="학부모 이름" value={editStudentForm.parentName} onChange={(e) => setEditStudentForm(p => ({...p, parentName: e.target.value}))} className="h-7 text-xs"/></TableCell>
                                    <TableCell className="p-1 text-xs text-slate-500">{user.email}</TableCell>
                                    <TableCell className="p-1"><Input placeholder="연락처" value={editStudentForm.phone} onChange={(e) => setEditStudentForm(p => ({...p, phone: e.target.value}))} className="h-7 text-xs"/></TableCell>
                                    <TableCell className="text-center text-xs">{user.hashedPin ? '✅ 설정됨' : '❌ 미설정'}</TableCell>
                                    <TableCell className="text-right p-1">
                                      <div className="flex justify-end gap-1">
                                        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={handleSaveEditStudent}><Save className="h-3.5 w-3.5 text-primary"/></Button>
                                        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setEditingStudent(null)}><XCircle className="h-3.5 w-3.5 text-muted-foreground"/></Button>
                                      </div>
                                    </TableCell>
                                  </>
                                ) : (
                                  <>
                                    <TableCell className="font-semibold text-slate-700">
                                      {user.studentGrade ? `${user.studentGrade}학년 ${user.studentClass}반 ${user.studentNumber ? `${user.studentNumber}번` : ''}` : '미배정'}
                                    </TableCell>
                                    <TableCell className="font-bold text-slate-900">{user.studentName || '-'}</TableCell>
                                    <TableCell className="font-medium text-slate-800">{user.parentName || user.name}</TableCell>
                                    <TableCell className="text-slate-600 text-xs">{user.email}</TableCell>
                                    <TableCell className="text-slate-600 text-xs">{user.parentPhone || '-'}</TableCell>
                                    <TableCell className="text-center text-xs">
                                      {user.hashedPin ? '✅ 설정됨' : '❌ 미설정'}
                                    </TableCell>
                                    <TableCell className="text-right">
                                      <div className="flex justify-end gap-1">
                                        <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-500 hover:text-slate-900" onClick={() => handleStartEditStudent(user)}>
                                          <Pencil className="h-4 w-4" />
                                        </Button>
                                        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive/90" onClick={() => confirmDeleteUser(user)}>
                                          <Trash2 className="h-4 w-4" />
                                        </Button>
                                      </div>
                                    </TableCell>
                                  </>
                                )}
                              </TableRow>
                            ))}
                            </TableBody>
                          </Table>
                        </div>

                        {/* 페이지네이션 */}
                        {totalPages > 1 && (
                          <div className="flex items-center justify-between px-4 py-2 border-t bg-slate-50/80 shrink-0">
                            <span className="text-xs text-muted-foreground">
                              {(safePage - 1) * STUDENTS_PER_PAGE + 1}–{Math.min(safePage * STUDENTS_PER_PAGE, filtered.length)} / {filtered.length}명
                            </span>
                            <div className="flex items-center gap-1">
                              <button
                                onClick={() => setStudentPage(p => Math.max(1, p - 1))}
                                disabled={safePage <= 1}
                                className="h-7 px-2.5 text-xs border rounded-md bg-white hover:bg-slate-100 disabled:opacity-40"
                              >
                                ‹ 이전
                              </button>
                              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                                const start = Math.max(1, Math.min(safePage - 2, totalPages - 4));
                                const page = start + i;
                                return (
                                  <button
                                    key={page}
                                    onClick={() => setStudentPage(page)}
                                    className={`h-7 w-7 text-xs border rounded-md ${page === safePage ? 'bg-primary text-white border-primary' : 'bg-white hover:bg-slate-100'}`}
                                  >
                                    {page}
                                  </button>
                                );
                              })}
                              <button
                                onClick={() => setStudentPage(p => Math.min(totalPages, p + 1))}
                                disabled={safePage >= totalPages}
                                className="h-7 px-2.5 text-xs border rounded-md bg-white hover:bg-slate-100 disabled:opacity-40"
                              >
                                다음 ›
                              </button>
                            </div>
                          </div>
                        )}
                      </>
                    );
                  })()}
                </TabsContent>
              </Tabs>
            </div>
          </TabsContent>

          <TabsContent value="audit" className="flex-1 min-h-0 mt-0 data-[state=active]:flex flex-col">
            <div className="flex-1 overflow-y-auto px-6 py-4 flex flex-col gap-4">
            <div className="flex justify-between items-center px-1">
              <div>
                <h3 className="text-lg font-semibold">시스템 감사 로그 (최근 100건)</h3>
                <p className="text-xs text-muted-foreground">누가, 언제, 어떤 문서에 대해 결재 관련 작업을 처리했는지 상세 이력을 조회합니다.</p>
              </div>
              <Button variant="outline" size="sm" onClick={() => fetchAuditLogs()} disabled={loadingLogs}>
                {loadingLogs ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Save className="h-4 w-4 mr-1" />}
                새로고침
              </Button>
            </div>

            <div className="border rounded-md flex-1 overflow-y-auto">
              <Table>
                <TableHeader className="sticky top-0 bg-background z-10">
                  <TableRow>
                    <TableHead className="w-[120px]">시간</TableHead>
                    <TableHead className="w-[80px]">액션</TableHead>
                    <TableHead>행위자</TableHead>
                    <TableHead className="w-[120px]">문서번호</TableHead>
                    <TableHead>문서 제목</TableHead>
                    <TableHead>상세/코멘트</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loadingLogs ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                        <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2" />
                        감사 로그를 로딩 중입니다...
                      </TableCell>
                    </TableRow>
                  ) : auditLogs.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                        기록된 감사 로그가 없습니다.
                      </TableCell>
                    </TableRow>
                  ) : (
                    auditLogs.map((log) => {
                      const getActionBadge = (act: string) => {
                        switch (act) {
                          case 'create': return <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-blue-100 text-blue-800">문서상신</span>;
                          case 'approve': return <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-100 text-emerald-800">결재승인</span>;
                          case 'reject': return <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-red-100 text-red-800">결재반려</span>;
                          case 'recall': return <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-100 text-amber-800">기안회수</span>;
                          case 'delete': return <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 text-slate-800">기안삭제</span>;
                          default: return <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-gray-100 text-gray-800">{act}</span>;
                        }
                      };

                      const formatDate = (isoStr: string) => {
                        if (!isoStr) return '-';
                        try {
                          const d = new Date(isoStr);
                          return `${d.getFullYear().toString().substring(2)}-${(d.getMonth() + 1).toString().padStart(2, '0')}-${d.getDate().toString().padStart(2, '0')} ${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
                        } catch {
                          return isoStr;
                        }
                      };

                      return (
                        <TableRow key={log.id} className="text-xs">
                          <TableCell className="font-mono text-muted-foreground">
                            {formatDate(log.timestamp)}
                          </TableCell>
                          <TableCell>{getActionBadge(log.action)}</TableCell>
                          <TableCell>
                            <div className="font-semibold">{log.actorName}</div>
                            <div className="text-[10px] text-muted-foreground">{log.actorEmail}</div>
                          </TableCell>
                          <TableCell className="font-mono">{log.docNo || '-'}</TableCell>
                          <TableCell className="max-w-[180px] truncate" title={log.title}>{log.title}</TableCell>
                          <TableCell className="max-w-[200px] truncate text-muted-foreground" title={log.comment}>{log.comment || '-'}</TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>

            {hasMoreLogs && !loadingLogs && (
              <div className="flex justify-center pt-2">
                <Button variant="outline" size="sm" onClick={() => fetchAuditLogs(false)} disabled={loadingMoreLogs} className="px-8 h-8 text-xs">
                  {loadingMoreLogs ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : null}
                  감사 로그 더 보기 (50건씩)
                </Button>
              </div>
            )}
            </div>
          </TabsContent>
        </Tabs>

        <AlertDialog open={!!userToDelete} onOpenChange={(open) => !open && setUserToDelete(null)}>
            <AlertDialogContent>
                <AlertDialogHeader>
                <AlertDialogTitle>정말로 삭제하시겠습니까?</AlertDialogTitle>
                <AlertDialogDescription>
                    <span className="font-bold text-foreground">{userToDelete?.name}</span> ({userToDelete?.email}) 사용자를 삭제합니다.<br/>
                    이 작업은 되돌릴 수 없습니다.
                </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                <AlertDialogCancel onClick={() => setUserToDelete(null)}>취소</AlertDialogCancel>
                <AlertDialogAction onClick={executeDelete} className="bg-destructive hover:bg-destructive/90">삭제</AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
      </DialogContent>
    </Dialog>
  );
}
