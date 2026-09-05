'use client';

import { bulkRegisterUsers, bulkRegisterStudents, getUsersDirectory, saveUserProfile, deleteUser, invalidateUsersCache, normalizeGrade, resolveDepartment, syncAllUsersToOrgStructure, isFacultyMember, resetParentPin } from '@/lib/services/userService';
import { getDocConfig, saveDocConfig, getOrgStructure, saveOrgStructure, getDelegationRules, saveDelegationRules, DEFAULT_DELEGATION_RULES, getGoogleDriveConfig, saveGoogleDriveConfig, DEFAULT_GOOGLE_DRIVE_CONFIG } from '@/lib/services/settingsService';
import { getAuditLogs } from '@/lib/services/documentService';
import { DocConfig, UserProfile, OrgStructure, DelegationRule, AcademicCalendarConfig, AcademicEvent, AcademicSemesterPeriod, FieldTripBlackoutPeriod, DEFAULT_FIELD_TRIP_BLACKOUT_PERIODS, CustomDutyRole, DutyRolePermission, DutyRoleAttendanceScope, ClassPeriodSchedule, DEFAULT_PERIOD_SCHEDULES, GoogleDriveConfig } from '@/lib/types';
import { cn, compressImage, generateAcademicIcsFile } from '@/lib/utils';
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
import { 
  Loader2, 
  Image as ImageIcon, 
  Users, 
  Settings as SettingsIcon, 
  FileUp, 
  Download, 
  PlusCircle, 
  Save, 
  XCircle, 
  Trash2, 
  Network, 
  FileText, 
  Pencil, 
  Calendar, 
  Globe, 
  Sparkles, 
  RotateCcw,
  KeyRound,
  ChevronDown,
  ChevronUp,
  Briefcase,
  GraduationCap,
  Building2,
  UserCheck,
  FolderKanban,
  Tag,
  ChevronsUpDown,
  Search,
  Check,
  ShieldCheck,
  X,
  Clock,
  HardDrive,
  Folder,
  ExternalLink
} from 'lucide-react';
import NextImage from 'next/image';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { ScrollArea } from './ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue, SelectGroup, SelectLabel, SelectSeparator } from './ui/select';
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from './ui/command';
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
  if (orgStructure.peTeachers?.map(m => m.toLowerCase()).includes(emailLower)) {
    roles.push('학교 체육 담당');
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

  if (orgStructure.customDutyRoles) {
    for (const duty of orgStructure.customDutyRoles) {
      if (duty.teacherEmails?.map(m => m.toLowerCase()).includes(emailLower)) {
        roles.push(duty.roleName);
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

export interface DelegationCategoryStandard {
  mainType: string;
  subTypes: {
    name: string;
    detailTypes: string[];
  }[];
}

export const DEFAULT_DELEGATION_STANDARDS: DelegationCategoryStandard[] = [
  {
    mainType: '학부모 출결',
    subTypes: [
      { name: '결석계', detailTypes: ['일반/질병/인정', '기타결석'] },
      { name: '체험학습신청서', detailTypes: ['교외체험학습'] },
    ]
  },
  {
    mainType: '일반 공문',
    subTypes: [
      { name: '연간계획공문', detailTypes: ['연간 운영계획'] },
      { name: '세부계획공문', detailTypes: ['세부 실행계획'] },
      { name: '일반기안공문', detailTypes: ['일반 업무기안'] },
    ]
  },
  {
    mainType: '교원 복무',
    subTypes: [
      { name: '휴가', detailTypes: ['연가', '조퇴', '병가', '특별휴가', '지각'] },
      { name: '출장', detailTypes: ['관내', '관외', '국외'] },
    ]
  },
  {
    mainType: '방과후학교 / 특기적성',
    subTypes: [
      { name: '방과후학교 운영계획', detailTypes: ['학기별 운영계획'] },
    ]
  },
  {
    mainType: '스쿨버스 운영',
    subTypes: [
      { name: '스쿨버스 운영계획', detailTypes: ['노선 및 운영계획'] },
    ]
  }
];

export const AVAILABLE_FEATURE_PERMISSIONS = [
  { id: 'pe_admin', label: '학교 체육/PAPS 관리', desc: 'PAPS 측정 및 기록 입력, 성장 분석, 대회/리그 관리, AI 문제 출제' },
  { id: 'health_admin', label: '학생 건강/보건실 관리', desc: '학생 건강기록부 작성/관리, 법정 서식 및 예방접종/검진 관리' },
  { id: 'afterschool_admin', label: '방과후학교 총괄 관리', desc: '강좌 개설/폐강, 강사/수강생 관리, 출석부 총괄, 수강료 정산' },
  { id: 'bus_admin', label: '스쿨버스 운영 관리', desc: '노선 및 호차 관리, 학생 탑승 배정, 탑승료 청구' },
  { id: 'student_admin', label: '학생출결 및 학적 총괄 관리', desc: '전교생 마스터 DB 및 결석계/체험학습 전체 조회/출력 권한' },
  { id: 'duty_admin', label: '교원 복무/근태 관리', desc: '교원 휴가/출장 복무 승인 대장, 초과근무, 보결 관리' },
  { id: 'system_admin', label: '시스템 설정 관리', desc: '학사일정, 조직도, 전결규정, 사용자 관리 모달 접근' },
];

export const AVAILABLE_DOCUMENT_PERMISSIONS = [
  { id: 'doc_absence', label: '결석계 문서함', desc: '결석 신고서 및 증빙 확인, 결석계 대장 일괄 인쇄' },
  { id: 'doc_fieldtrip', label: '체험학습 문서함', desc: '교외체험학습 신청서 및 결과보고서 완비 검증, 일괄 인쇄' },
  { id: 'doc_registry', label: '문서등록대장', desc: '학교 내 생산/결재 완료된 전체 전자결재 공문서 열람' },
  { id: 'doc_approval', label: '전자결재 결재 권한', desc: '미결재함, 진행문서함 등 결재선 상의 문서 승인/전결' },
  { id: 'doc_audit', label: '보안 감사 로그 열람', desc: '문서 열람, 승인, 반려, 삭제 등의 전체 보안 감사 기록 조회' },
];

export const DEFAULT_ROLE_PERMISSIONS: Record<string, DutyRolePermission> = {
  pe: {
    features: ['pe_admin'],
    documents: []
  },
  afterschool: {
    features: ['afterschool_admin'],
    documents: ['doc_registry']
  },
  bus: {
    features: ['bus_admin'],
    documents: ['doc_registry']
  },
  system: {
    features: ['system_admin'],
    documents: ['doc_registry', 'doc_audit']
  },
  health: {
    features: ['health_admin'],
    documents: ['doc_absence'],
    attendanceScope: { type: 'all' }
  },
  special: {
    features: [],
    documents: ['doc_absence', 'doc_fieldtrip'],
    attendanceScope: { type: 'all' }
  },
  librarian: {
    features: [],
    documents: []
  },
};

interface DutyRolePermissionModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  roleName: string;
  permissions?: DutyRolePermission;
  onSave: (newPerms: DutyRolePermission) => void;
}

function DutyRolePermissionModal({
  open,
  onOpenChange,
  roleName,
  permissions,
  onSave,
}: DutyRolePermissionModalProps) {
  const [selectedFeatures, setSelectedFeatures] = useState<string[]>([]);
  const [selectedDocs, setSelectedDocs] = useState<string[]>([]);
  const [scopeType, setScopeType] = useState<DutyRoleAttendanceScope['type']>('all');
  const [selectedGrades, setSelectedGrades] = useState<number[]>([1, 2, 3, 4, 5, 6]);

  useEffect(() => {
    if (open) {
      setSelectedFeatures(permissions?.features || []);
      setSelectedDocs(permissions?.documents || []);
      setScopeType(permissions?.attendanceScope?.type || 'all');
      setSelectedGrades(permissions?.attendanceScope?.grades || [1, 2, 3, 4, 5, 6]);
    }
  }, [open, permissions]);

  const toggleFeature = (id: string) => {
    setSelectedFeatures(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const toggleDoc = (id: string) => {
    setSelectedDocs(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const toggleGrade = (grade: number) => {
    setSelectedGrades(prev =>
      prev.includes(grade) ? prev.filter(g => g !== grade) : [...prev, grade].sort()
    );
  };

  const hasAttendanceDocs = selectedDocs.includes('doc_absence') || selectedDocs.includes('doc_fieldtrip');

  const handleSave = () => {
    onSave({
      features: selectedFeatures,
      documents: selectedDocs,
      attendanceScope: hasAttendanceDocs ? {
        type: scopeType,
        grades: scopeType === 'specific_grades' ? selectedGrades : undefined
      } : undefined,
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent 
        className="max-w-lg p-5"
        onPointerDownOutside={(e) => e.preventDefault()}
      >
        <DialogHeader className="pb-3 border-b space-y-1">
          <DialogTitle className="text-base font-bold text-slate-900 flex items-center justify-between">
            <span>{roleName} 권한 설정</span>
            <span className="text-xs font-normal text-slate-500">
              기능 {selectedFeatures.length}개 / 문서 {selectedDocs.length}개 선택됨
            </span>
          </DialogTitle>
          <DialogDescription className="text-xs text-slate-500">
            해당 업무를 담당하는 교직원에게 부여할 업무 기능과 문서 접근 범위를 지정합니다.
          </DialogDescription>
        </DialogHeader>

        <div className="py-3 space-y-4 max-h-[60vh] overflow-y-auto pr-1">
          {/* 업무 기능 접근 권한 */}
          <div className="space-y-2">
            <h4 className="text-xs font-extrabold text-indigo-950 flex items-center gap-1.5">
              <span>업무 기능 접근 권한</span>
            </h4>
            <div className="grid grid-cols-1 gap-1.5">
              {AVAILABLE_FEATURE_PERMISSIONS.map(f => {
                const checked = selectedFeatures.includes(f.id);
                return (
                  <label
                    key={f.id}
                    onClick={() => toggleFeature(f.id)}
                    className={cn(
                      "flex items-start gap-2.5 p-2 rounded-lg border text-xs cursor-pointer transition-colors",
                      checked ? "bg-indigo-50/70 border-indigo-300" : "bg-white border-slate-200 hover:bg-slate-50"
                    )}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => {}}
                      className="mt-0.5 h-3.5 w-3.5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                    />
                    <div className="space-y-0.5 flex-1">
                      <div className="font-bold text-slate-800">{f.label}</div>
                      <div className="text-[11px] text-slate-500">{f.desc}</div>
                    </div>
                  </label>
                );
              })}
            </div>
          </div>

          {/* 문서 접근 권한 */}
          <div className="space-y-2 pt-2 border-t">
            <h4 className="text-xs font-extrabold text-indigo-950 flex items-center gap-1.5">
              <span>문서 접근 권한</span>
            </h4>
            <div className="grid grid-cols-1 gap-1.5">
              {AVAILABLE_DOCUMENT_PERMISSIONS.map(d => {
                const checked = selectedDocs.includes(d.id);
                return (
                  <label
                    key={d.id}
                    onClick={() => toggleDoc(d.id)}
                    className={cn(
                      "flex items-start gap-2.5 p-2 rounded-lg border text-xs cursor-pointer transition-colors",
                      checked ? "bg-purple-50/70 border-purple-300" : "bg-white border-slate-200 hover:bg-slate-50"
                    )}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => {}}
                      className="mt-0.5 h-3.5 w-3.5 rounded border-slate-300 text-purple-600 focus:ring-purple-500"
                    />
                    <div className="space-y-0.5 flex-1">
                      <div className="font-bold text-slate-800">{d.label}</div>
                      <div className="text-[11px] text-slate-500">{d.desc}</div>
                    </div>
                  </label>
                );
              })}
            </div>

            {/* 결석계/체험학습 선택 시 학년/학급별 문서 접근 범위(Scope) 설정 패널 */}
            {hasAttendanceDocs && (
              <div className="mt-3 p-3 rounded-xl border border-violet-200 bg-violet-50/50 space-y-2.5">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-bold text-violet-900 flex items-center gap-1.5">
                    <ShieldCheck className="w-3.5 h-3.5 text-violet-600" />
                    결석계 / 체험학습 문서 접근 대상 범위
                  </Label>
                  <span className="text-[10px] text-violet-600 font-semibold">
                    {scopeType === 'all' && '전교생 전체'}
                    {scopeType === 'assigned_grade' && '담당 학년 전체'}
                    {scopeType === 'assigned_class' && '담당 학급만'}
                    {scopeType === 'specific_grades' && `${selectedGrades.join(', ')}학년`}
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                  {[
                    { type: 'all' as const, label: '전교생 전체 (1~6학년)', desc: '학생출결담당자, 총괄 관리자' },
                    { type: 'assigned_grade' as const, label: '담당 학년 전체', desc: '학년부장 및 학년 담당 교원' },
                    { type: 'assigned_class' as const, label: '담당 학급만', desc: '담임교사 본인 학급' },
                    { type: 'specific_grades' as const, label: '특정 학년 직접 지정', desc: '복수 지정 학년만 열람' },
                  ].map(opt => (
                    <label
                      key={opt.type}
                      onClick={() => setScopeType(opt.type)}
                      className={cn(
                        "flex items-start gap-2 p-2 rounded-lg border text-xs cursor-pointer transition-all",
                        scopeType === opt.type
                          ? "bg-white border-violet-500 shadow-2xs text-violet-950 font-bold"
                          : "bg-white/80 border-slate-200 text-slate-700 hover:bg-white"
                      )}
                    >
                      <input
                        type="radio"
                        name="attendanceScopeType"
                        checked={scopeType === opt.type}
                        onChange={() => setScopeType(opt.type)}
                        className="mt-0.5 text-violet-600 focus:ring-violet-500"
                      />
                      <div className="space-y-0.5 min-w-0">
                        <div className="text-xs">{opt.label}</div>
                        <div className="text-[10px] text-slate-400 font-normal">{opt.desc}</div>
                      </div>
                    </label>
                  ))}
                </div>

                {/* 특정 학년 직접 선택 시 1~6학년 토글 버튼 */}
                {scopeType === 'specific_grades' && (
                  <div className="pt-2 border-t border-violet-100 flex items-center gap-2 flex-wrap">
                    <span className="text-[11px] font-bold text-violet-800 shrink-0">대상 학년 선택:</span>
                    {[1, 2, 3, 4, 5, 6].map(grade => {
                      const isSelected = selectedGrades.includes(grade);
                      return (
                        <button
                          key={grade}
                          type="button"
                          onClick={() => toggleGrade(grade)}
                          className={cn(
                            "px-2.5 py-1 rounded-md text-xs font-bold border transition-colors",
                            isSelected
                              ? "bg-violet-600 border-violet-600 text-white shadow-2xs"
                              : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                          )}
                        >
                          {grade}학년
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-3 border-t">
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)} className="h-8 text-xs px-3">
            취소
          </Button>
          <Button size="sm" onClick={handleSave} className="h-8 text-xs px-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold">
            권한 저장
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

interface SearchableUserSelectProps {
  users: { name: string; email: string }[];
  value?: string;
  onSelect: (email: string) => void;
  placeholder?: string;
  triggerClassName?: string;
  panelWidthClass?: string;
  clearOnSelect?: boolean;
  allowUnassign?: boolean;
  unassignLabel?: string;
  align?: 'start' | 'end';
}

function SearchableUserSelect({
  users,
  value,
  onSelect,
  placeholder = '교직원 선택...',
  triggerClassName = 'h-8 text-xs bg-white',
  panelWidthClass = 'w-56',
  clearOnSelect = false,
  allowUnassign = false,
  unassignLabel = '선택 안됨',
  align = 'start'
}: SearchableUserSelectProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
        setSearch('');
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  const filtered = useMemo(() => {
    if (!search.trim()) return users;
    const q = search.trim().toLowerCase();
    return users.filter(u =>
      (u.name && u.name.toLowerCase().includes(q)) ||
      (u.email && u.email.toLowerCase().includes(q))
    );
  }, [users, search]);

  const selectedUser = users.find(u => u.email?.toLowerCase() === value?.toLowerCase());

  return (
    <div ref={containerRef} className="relative inline-block w-full">
      <Button
        type="button"
        variant="outline"
        onClick={() => setOpen(prev => !prev)}
        className={cn("w-full justify-between font-normal border-slate-300 hover:bg-slate-50 shadow-2xs", triggerClassName)}
      >
        <span className="truncate">
          {clearOnSelect
            ? placeholder
            : (selectedUser ? `${selectedUser.name} (${selectedUser.email})` : (value || placeholder))}
        </span>
        <ChevronsUpDown className="ml-1 h-3.5 w-3.5 shrink-0 opacity-50" />
      </Button>

      {open && (
        <div 
          className={cn(
            "absolute top-full mt-1 p-2 z-[9999] bg-white shadow-2xl border border-slate-200 rounded-xl space-y-1.5 animate-in fade-in-0 zoom-in-95",
            panelWidthClass,
            align === 'end' ? 'right-0' : 'left-0'
          )}
        >
          <div className="relative flex items-center">
            <Search className="absolute left-2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
            <Input
              autoFocus
              placeholder="이름/이메일 검색..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-8 pl-7 pr-6 text-xs bg-slate-50 border-slate-200 focus-visible:bg-white"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                className="absolute right-2 text-xs text-slate-400 hover:text-slate-600 font-bold"
              >
                ×
              </button>
            )}
          </div>

          <div className="max-h-52 overflow-y-auto divide-y divide-slate-100 pr-0.5">
            {allowUnassign && (
              <button
                type="button"
                onClick={() => {
                  onSelect('');
                  setOpen(false);
                  setSearch('');
                }}
                className="w-full text-left py-1.5 px-2 text-xs rounded-md text-slate-500 hover:bg-slate-100 font-medium"
              >
                {unassignLabel}
              </button>
            )}

            {filtered.length === 0 ? (
              <div className="text-xs py-4 text-center text-slate-400">
                '{search}' 검색 결과 없음
              </div>
            ) : (
              filtered.map(u => {
                const isSelected = value?.toLowerCase() === u.email?.toLowerCase();
                return (
                  <button
                    key={u.email}
                    type="button"
                    onClick={() => {
                      onSelect(u.email);
                      setOpen(false);
                      setSearch('');
                    }}
                    className={`w-full text-left py-1.5 px-2 text-xs rounded-md transition-colors flex items-center justify-between hover:bg-indigo-50 ${
                      isSelected ? 'bg-indigo-50/80 font-bold text-indigo-900' : 'text-slate-800'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 truncate">
                      <span className="font-semibold">{u.name}</span>
                      <span className="text-[10px] text-slate-400 truncate max-w-[100px]">{u.email}</span>
                    </div>
                    {isSelected && (
                      <Check className="h-3.5 w-3.5 text-indigo-600 shrink-0 ml-1" />
                    )}
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
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
    periodSchedules: DEFAULT_PERIOD_SCHEDULES,
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
  const [newEventEndDate, setNewEventEndDate] = useState('');
  const [newEventTitle, setNewEventTitle] = useState('');
  const [newEventType, setNewEventType] = useState<'HOLIDAY' | 'PUBLIC_HOLIDAY' | 'SCHOOL_EVENT'>('HOLIDAY');
  const [isNewEventParentPrivate, setIsNewEventParentPrivate] = useState(false);

  // 수업 시간대(교시별 시간표) 관리 상태 및 핸들러
  const [isPeriodModalOpen, setIsPeriodModalOpen] = useState(false);
  const [newPeriodName, setNewPeriodName] = useState('');
  const [newPeriodStart, setNewPeriodStart] = useState('08:30');
  const [newPeriodEnd, setNewPeriodEnd] = useState('09:10');

  const handleAddPeriodSchedule = () => {
    if (!newPeriodName.trim() || !newPeriodStart || !newPeriodEnd) {
      toast({ variant: 'destructive', title: '입력 오류', description: '교시명, 시작시간, 종료시간을 모두 입력해주세요.' });
      return;
    }
    const newPeriod: ClassPeriodSchedule = {
      id: `p-${Date.now()}`,
      name: newPeriodName.trim(),
      startTime: newPeriodStart,
      endTime: newPeriodEnd,
      type: newPeriodName.includes('점심') ? 'lunch' : newPeriodName.includes('방과후') ? 'afterschool' : 'class'
    };
    setAcademicCal(prev => ({
      ...prev,
      periodSchedules: [...(prev.periodSchedules || DEFAULT_PERIOD_SCHEDULES), newPeriod]
    }));
    setNewPeriodName('');
    toast({ title: '수업 시간대 추가 완료', description: `${newPeriod.name} (${newPeriod.startTime}~${newPeriod.endTime})가 등록되었습니다.` });
  };

  const handleUpdatePeriodSchedule = (id: string, field: keyof ClassPeriodSchedule, val: any) => {
    setAcademicCal(prev => ({
      ...prev,
      periodSchedules: (prev.periodSchedules || DEFAULT_PERIOD_SCHEDULES).map(p =>
        p.id === id ? { ...p, [field]: val } : p
      )
    }));
  };

  const handleDeletePeriodSchedule = (id: string) => {
    setAcademicCal(prev => ({
      ...prev,
      periodSchedules: (prev.periodSchedules || DEFAULT_PERIOD_SCHEDULES).filter(p => p.id !== id)
    }));
  };

  const handleResetDefaultPeriodSchedules = () => {
    if (!confirm('기본 초등 표준 일과 시간표(1~6교시, 점심, 방과후)로 복원하시겠습니까?')) return;
    setAcademicCal(prev => ({
      ...prev,
      periodSchedules: DEFAULT_PERIOD_SCHEDULES
    }));
    toast({ title: '기본 시간표 복원 완료', description: '표준 초등학교 일과 시간표로 초기화되었습니다.' });
  };

  const handleAddAcademicEvent = () => {
    if (!newEventDate || !newEventTitle.trim()) {
      toast({ variant: 'destructive', title: '입력 오류', description: '시작일과 행사명을 입력해주세요.' });
      return;
    }
    const isSchoolDay = newEventType === 'SCHOOL_EVENT';
    const finalEndDate = newEventEndDate && newEventEndDate >= newEventDate ? newEventEndDate : undefined;
    const newEv: AcademicEvent = {
      id: Date.now().toString(),
      date: newEventDate,
      endDate: finalEndDate,
      title: newEventTitle.trim(),
      type: newEventType,
      isSchoolDay,
      isParentPrivate: isNewEventParentPrivate
    };
    setAcademicCal(prev => ({
      ...prev,
      events: [...prev.events.filter(e => e.id !== newEv.id && !(e.date === newEventDate && e.title === newEventTitle.trim())), newEv].sort((a, b) => (a.date || '').localeCompare(b.date || ''))
    }));
    const dateDesc = finalEndDate && finalEndDate !== newEventDate ? `${newEventDate} ~ ${finalEndDate}` : newEventDate;
    setNewEventDate('');
    setNewEventEndDate('');
    setNewEventTitle('');
    setIsNewEventParentPrivate(false);
    toast({ title: '학사 일정 추가', description: `${dateDesc} (${newEventTitle.trim()})가 추가되었습니다.` });
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

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [selectedHomeroomFile, setSelectedHomeroomFile] = useState<File | null>(null);
  const [selectedDeptFile, setSelectedDeptFile] = useState<File | null>(null);
  const [activeMainTab, setActiveMainTab] = useState<string>('general');
  const [org, setOrg] = useState<OrgStructure>({ principal: '', vicePrincipal: '', academicHead: '', gradeHeads: {}, homerooms: {}, gradeSubjects: {}, departments: [], afterschoolManager: '', busManager: '', afterschoolManagers: [], busManagers: [], systemManagers: [], peTeachers: [], healthTeachers: [], specialTeachers: [], librarianTeachers: [], subjectTeacherGroups: [], customDutyRoles: [], dutyRoleDepts: {} });
  const [orgSubTab, setOrgSubTab] = useState<'leadership' | 'duties' | 'grades' | 'departments'>('leadership');
  const [isDutyRolesOpen, setIsDutyRolesOpen] = useState(true);
  const [isSubjectGroupOpen, setIsSubjectGroupOpen] = useState(false);
  const [newCustomDutyRoleName, setNewCustomDutyRoleName] = useState('');
  const [newCustomDutyDept, setNewCustomDutyDept] = useState('unassigned');
  const [selectedDeptId, setSelectedDeptId] = useState<string>('');
  const [selectedGradeView, setSelectedGradeView] = useState<string>('all');
  const [newDeptTaskNames, setNewDeptTaskNames] = useState<{ [deptId: string]: string }>({});

  // 교직원 전용 목록 (학생/학부모 계정 원천 분리 이원화) — org 선언 이후
  const deptMemberSet = useMemo(() => {
    const set = new Set<string>();
    (org.departments || []).forEach(d => {
      (d.memberEmails || []).forEach(em => set.add(em.toLowerCase().trim()));
      if (d.headEmail) set.add(d.headEmail.toLowerCase().trim());
    });
    return set;
  }, [org.departments]);

  const facultyUsers = useMemo(() => {
    return users.filter(u => isFacultyMember(u, deptMemberSet));
  }, [users, deptMemberSet]);

  const activeDept = useMemo(() => {
    if (!org.departments || org.departments.length === 0) return null;
    return org.departments.find(d => d.id === selectedDeptId) || org.departments[0];
  }, [org.departments, selectedDeptId]);
  const [newHomeroom, setNewHomeroom] = useState({ grade: '1', class: '1', email: '', isGradeHead: false, roleType: 'homeroom' as 'homeroom' | 'subject' });
  const [teacherComboboxOpen, setTeacherComboboxOpen] = useState(false);
  const [teacherSearchQuery, setTeacherSearchQuery] = useState('');
  const [teacherTabQuery, setTeacherTabQuery] = useState(''); // 교직원 탭 검색

  const filteredTeachers = useMemo(() => {
    if (!teacherSearchQuery.trim()) return facultyUsers;
    const q = teacherSearchQuery.trim().toLowerCase();
    return facultyUsers.filter(u =>
      (u.name && u.name.toLowerCase().includes(q)) ||
      (u.email && u.email.toLowerCase().includes(q))
    );
  }, [facultyUsers, teacherSearchQuery]);

  const teacherComboboxRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!teacherComboboxOpen) return;
    const handleClickOutside = (event: MouseEvent) => {
      if (teacherComboboxRef.current && !teacherComboboxRef.current.contains(event.target as Node)) {
        setTeacherComboboxOpen(false);
        setTeacherSearchQuery('');
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [teacherComboboxOpen]);

  const [newSubjectCategoryName, setNewSubjectCategoryName] = useState('');
  const [newDeptName, setNewDeptName] = useState('');
  // 동명이인 처리용: { grade, class, isHead, candidates: UserProfile[] }
  const [duplicatePendingRows, setDuplicatePendingRows] = useState<{ grade: string; class: string; isHead: boolean; candidates: UserProfile[] }[]>([]);
  const [duplicateResolvedEmails, setDuplicateResolvedEmails] = useState<{ [key: string]: string }>({});
  
  // Google Drive 중앙 저장소 설정
  const [googleDriveConfig, setGoogleDriveConfig] = useState<GoogleDriveConfig>(DEFAULT_GOOGLE_DRIVE_CONFIG);
  const [isSavingGoogleDrive, setIsSavingGoogleDrive] = useState(false);
  const [isSyncingFolders, setIsSyncingFolders] = useState(false);

  useEffect(() => {
    getGoogleDriveConfig().then(cfg => {
      if (cfg) setGoogleDriveConfig(cfg);
    });
  }, []);

  const handleSaveGoogleDrive = async () => {
    setIsSavingGoogleDrive(true);
    try {
      const res = await saveGoogleDriveConfig(googleDriveConfig, profile?.email || '관리자');
      if (res.success) {
        toast({ title: 'Google Drive 중앙 저장소 설정 저장 완료', description: '학교 Google Drive 중앙 저장소 정보가 업데이트되었습니다.' });
      } else {
        toast({ variant: 'destructive', title: '저장 실패', description: res.error });
      }
    } catch (e: any) {
      toast({ variant: 'destructive', title: '오류 발생', description: e.message });
    } finally {
      setIsSavingGoogleDrive(false);
    }
  };

  const handleSyncFolders = async () => {
    if (!googleDriveConfig.rootFolderId) {
      toast({ variant: 'destructive', title: '루트 폴더 ID 필요', description: '먼저 중앙 루트 폴더 링크 또는 ID를 입력해주세요.' });
      return;
    }

    setIsSyncingFolders(true);
    try {
      const res = await fetch('/api/drive/sync-folders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rootFolderId: googleDriveConfig.rootFolderId })
      });
      const data = await res.json();
      if (data.success && data.subFolders) {
        const nextCfg = { ...googleDriveConfig, subFolders: data.subFolders };
        setGoogleDriveConfig(nextCfg);
        await saveGoogleDriveConfig(nextCfg, profile?.email || '관리자');
        toast({
          title: '하위 폴더 4종 동기화 완료',
          description: '결재완료, 업무작업, 결석계, 체험학습 전용 폴더가 성공적으로 연동되었습니다.'
        });
      } else {
        toast({ variant: 'destructive', title: '동기화 실패', description: data.error });
      }
    } catch (err: any) {
      toast({ variant: 'destructive', title: '동기화 오류', description: err.message });
    } finally {
      setIsSyncingFolders(false);
    }
  };

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
  const [newUser, setNewUser] = useState({ email: '', name: '', role: '교사', dept: '', grade: '' });
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

  // 학부모 PIN 리셋 상태
  const [resetPinTarget, setResetPinTarget] = useState<UserProfile | null>(null);
  const [isResettingPin, setIsResettingPin] = useState(false);

  const handleConfirmResetPin = async () => {
    if (!resetPinTarget?.email) return;
    setIsResettingPin(true);
    try {
      const res = await resetParentPin(resetPinTarget.email);
      if (res.success) {
        setUsers(prev => prev.map(u => u.email === resetPinTarget.email ? { ...u, hashedPin: undefined } : u));
        toast({
          title: 'PIN 초기화 완료',
          description: `${resetPinTarget.studentName || resetPinTarget.name} 학생(학부모)의 PIN 번호가 초기화되었습니다. 학부모 로그인 시 핀 번호 최초 등록 화면이 표시됩니다.`
        });
        setResetPinTarget(null);
      } else {
        toast({ variant: 'destructive', title: 'PIN 초기화 실패', description: res.error });
      }
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'PIN 초기화 실패', description: err.message });
    } finally {
      setIsResettingPin(false);
    }
  };

  const fetchOrgStructure = async () => {
    try {
      const data = await getOrgStructure();
      if (data) {
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
          peTeachers: data.peTeachers || [],
          healthTeachers: data.healthTeachers || [],
          specialTeachers: data.specialTeachers || [],
          librarianTeachers: data.librarianTeachers || [],
          subjectTeacherGroups: data.subjectTeacherGroups || [],
          customDutyRoles: data.customDutyRoles || [],
          dutyRoleDepts: data.dutyRoleDepts || {},
          dutyRolePermissions: data.dutyRolePermissions || {}
        });
      }
    } catch (e) {
      console.error("fetchOrgStructure error:", e);
    }
  };

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
      fetchOrgStructure();
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

  // 업무 권한 설정 모달 제어 상태
  const [permissionModalState, setPermissionModalState] = useState<{
    open: boolean;
    roleKey: string;
    roleName: string;
    permissions?: DutyRolePermission;
  }>({
    open: false,
    roleKey: '',
    roleName: '',
  });

  const openPermissionModal = (roleKey: string, roleName: string, permissions?: DutyRolePermission) => {
    setPermissionModalState({
      open: true,
      roleKey,
      roleName,
      permissions: permissions || org.dutyRolePermissions?.[roleKey] || DEFAULT_ROLE_PERMISSIONS[roleKey] || { features: [], documents: [] },
    });
  };

  const handleSaveRolePermission = (roleKey: string, newPerms: DutyRolePermission) => {
    updateAndSaveOrg(prev => {
      const isCustom = (prev.customDutyRoles || []).some(r => r.id === roleKey);
      if (isCustom) {
        return {
          ...prev,
          customDutyRoles: (prev.customDutyRoles || []).map(r =>
            r.id === roleKey ? { ...r, permissions: newPerms } : r
          )
        };
      }
      return {
        ...prev,
        dutyRolePermissions: {
          ...(prev.dutyRolePermissions || {}),
          [roleKey]: newPerms
        }
      };
    }, '권한 설정이 저장되었습니다.');
  };

  // 부서 내 특정 교원에게 소관 업무 지정 (실시간 저장)
  const assignDutyToMember = (dutyKeyOrId: string, email: string, deptName?: string) => {
    updateAndSaveOrg(prev => {
      let next = { ...prev };
      if (deptName && ['afterschool', 'bus', 'system', 'pe', 'health', 'special', 'librarian'].includes(dutyKeyOrId)) {
        next.dutyRoleDepts = { ...(next.dutyRoleDepts || {}), [dutyKeyOrId]: deptName };
      }
      if (dutyKeyOrId === 'afterschool') {
        const cur = next.afterschoolManagers || [];
        if (!cur.includes(email)) next.afterschoolManagers = [...cur, email];
      } else if (dutyKeyOrId === 'bus') {
        const cur = next.busManagers || [];
        if (!cur.includes(email)) next.busManagers = [...cur, email];
      } else if (dutyKeyOrId === 'system') {
        const cur = next.systemManagers || [];
        if (!cur.includes(email)) next.systemManagers = [...cur, email];
      } else if (dutyKeyOrId === 'pe') {
        const cur = next.peTeachers || [];
        if (!cur.includes(email)) next.peTeachers = [...cur, email];
      } else if (dutyKeyOrId === 'health') {
        const cur = next.healthTeachers || [];
        if (!cur.includes(email)) next.healthTeachers = [...cur, email];
      } else if (dutyKeyOrId === 'special') {
        const cur = next.specialTeachers || [];
        if (!cur.includes(email)) next.specialTeachers = [...cur, email];
      } else if (dutyKeyOrId === 'librarian') {
        const cur = next.librarianTeachers || [];
        if (!cur.includes(email)) next.librarianTeachers = [...cur, email];
      } else {
        next.customDutyRoles = (next.customDutyRoles || []).map(r => {
          if (r.id === dutyKeyOrId || r.roleName === dutyKeyOrId) {
            const cur = r.teacherEmails || [];
            return {
              ...r,
              deptName: deptName || r.deptName,
              teacherEmails: cur.includes(email) ? cur : [...cur, email]
            };
          }
          return r;
        });
      }
      return next;
    }, '담당 업무 배정이 저장되었습니다.');
  };

  // 부서 내에서 새 담당 업무를 즉시 생성하고 교원에게 배정 (실시간 저장)
  const createAndAssignCustomDuty = (roleName: string, deptName: string, email?: string) => {
    if (!roleName.trim()) return;
    const newId = `duty_${Date.now()}`;
    const newRole: CustomDutyRole = {
      id: newId,
      roleName: roleName.trim(),
      deptName: deptName,
      teacherEmails: email ? [email] : [],
      permissions: { features: [], documents: [] }
    };
    updateAndSaveOrg(prev => ({
      ...prev,
      customDutyRoles: [...(prev.customDutyRoles || []), newRole]
    }), `"${newRole.roleName}" 업무가 등록 및 저장되었습니다.`);
  };

  // 부서 내 특정 교원의 소관 업무 해제 (실시간 저장)
  const removeDutyFromMember = (dutyKeyOrId: string, email: string) => {
    updateAndSaveOrg(prev => {
      let next = { ...prev };
      if (dutyKeyOrId === 'afterschool' || dutyKeyOrId === '방과후학교' || dutyKeyOrId === '방과후학교 담당') {
        next.afterschoolManagers = (next.afterschoolManagers || []).filter(e => e !== email);
      } else if (dutyKeyOrId === 'bus' || dutyKeyOrId === '스쿨버스' || dutyKeyOrId === '스쿨버스 담당') {
        next.busManagers = (next.busManagers || []).filter(e => e !== email);
      } else if (dutyKeyOrId === 'system' || dutyKeyOrId === '시스템설정' || dutyKeyOrId === '시스템 설정 담당') {
        next.systemManagers = (next.systemManagers || []).filter(e => e !== email);
      } else if (dutyKeyOrId === 'pe' || dutyKeyOrId === '체육교사' || dutyKeyOrId === '학교체육' || dutyKeyOrId === '학교 체육') {
        next.peTeachers = (next.peTeachers || []).filter(e => e !== email);
      } else if (dutyKeyOrId === 'health' || dutyKeyOrId === '보건교사') {
        next.healthTeachers = (next.healthTeachers || []).filter(e => e !== email);
      } else if (dutyKeyOrId === 'special' || dutyKeyOrId === '특수교사') {
        next.specialTeachers = (next.specialTeachers || []).filter(e => e !== email);
      } else if (dutyKeyOrId === 'librarian' || dutyKeyOrId === '사서교사') {
        next.librarianTeachers = (next.librarianTeachers || []).filter(e => e !== email);
      } else {
        next.customDutyRoles = (next.customDutyRoles || []).map(r => {
          if (r.id === dutyKeyOrId || r.roleName === dutyKeyOrId) {
            return { ...r, teacherEmails: (r.teacherEmails || []).filter(e => e !== email) };
          }
          return r;
        });
      }
      return next;
    }, '담당 업무 배정이 해제되었습니다.');
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
      const rawEmail = (newUser.email || '').trim().toLowerCase();
      if (!rawEmail || !newUser.name.trim() || !newUser.role) {
          toast({ variant: 'destructive', title: '입력 오류', description: '이메일, 이름, 직책을 모두 입력해야 합니다.' });
          return;
      }
      const finalEmail = rawEmail.includes('@') ? rawEmail : `${rawEmail}@kshcm.net`;
      const normGrade = normalizeGrade(newUser.grade);
      const gradeStr = normGrade ? normGrade.gradeName : (newUser.grade || '');
      const deptStr = resolveDepartment(newUser.dept, org.departments || []);

      const payload = {
        ...newUser,
        email: finalEmail,
        name: newUser.name.trim(),
        grade: gradeStr,
        dept: deptStr,
        isFaculty: true,
        isStaff: true,
        isManualFaculty: true,
        registrationSource: 'manual_faculty' as const,
      };

      const result = await saveUserProfile('', finalEmail, payload as any);
      if (result.success) {
          // 조직도 동기화
          if (deptStr || normGrade) {
            let updatedOrg = { ...org };
            if (deptStr) {
              let targetDept = updatedOrg.departments?.find(d => d.name === deptStr);
              if (!targetDept) {
                targetDept = {
                  id: Date.now().toString(),
                  name: deptStr,
                  headEmail: null,
                  memberEmails: [],
                };
                updatedOrg.departments = [...(updatedOrg.departments || []), targetDept];
              }
              if (!targetDept.memberEmails.includes(finalEmail)) {
                targetDept.memberEmails = [...targetDept.memberEmails, finalEmail];
              }
              if (newUser.role.includes('부장') && !newUser.role.includes('학년')) {
                targetDept.headEmail = finalEmail;
              }
            }
            if (normGrade) {
              const gNum = normGrade.gradeNumber;
              if (newUser.role.includes('부장') || newUser.role.includes('학년부장')) {
                updatedOrg.gradeHeads = { ...(updatedOrg.gradeHeads || {}), [gNum]: finalEmail, [`${gNum}학년`]: finalEmail };
              } else {
                const currentSubs = updatedOrg.gradeSubjects?.[gNum] || [];
                if (!currentSubs.includes(finalEmail)) {
                  updatedOrg.gradeSubjects = { ...(updatedOrg.gradeSubjects || {}), [gNum]: [...currentSubs, finalEmail] };
                }
              }
            }
            await saveOrgStructure(updatedOrg);
            setOrg(updatedOrg);
          }

          toast({ title: '교직원 추가 완료', description: '사용자 정보 및 조직도에 반영되었습니다.' });
          await fetchUsers(true); // 강제 새로고침으로 목록 즉시 반영
          setIsAddingNewUser(false);
          setNewUser({ email: '', name: '', role: '교사', dept: '', grade: '' });
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
                if ((result as any).updatedOrg) {
                  setOrg((result as any).updatedOrg);
                } else {
                  fetchOrgStructure();
                }
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
      { '이메일': 'teacher1@kshcm.net', '이름': '홍길동', '직책': '교사', '학년': '3학년', '반': '1', '부서': '교무기획부' },
      { '이메일': 'teacher2@kshcm.net', '이름': '김철수', '직책': '부장', '학년': '1학년', '반': '2', '부서': '수업연구부' },
      { '이메일': 'teacher3@kshcm.net', '이름': '이영희', '직책': '교사', '학년': '6학년', '반': '', '부서': '예체능방과후부' },
      { '이메일': 'teacher4@kshcm.net', '이름': '박전담', '직책': '교사', '학년': '', '반': '', '부서': '영어교육부' },
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

  // 표준 분류 기준과 기존 등록된 전결규정의 분류 항목 통합
  const delegationStandards = useMemo(() => {
    const list: DelegationCategoryStandard[] = JSON.parse(JSON.stringify(DEFAULT_DELEGATION_STANDARDS));
    
    (delegationRules || []).forEach(r => {
      if (!r.mainType) return;
      let m = list.find(x => x.mainType === r.mainType);
      if (!m) {
        m = { mainType: r.mainType, subTypes: [] };
        list.push(m);
      }
      if (r.subType) {
        let s = m.subTypes.find(x => x.name === r.subType);
        if (!s) {
          s = { name: r.subType, detailTypes: [] };
          m.subTypes.push(s);
        }
        if (r.detailType && !s.detailTypes.includes(r.detailType)) {
          s.detailTypes.push(r.detailType);
        }
      }
    });

    return list;
  }, [delegationRules]);

  const handleDelegationUpdate = (index: number, field: keyof DelegationRule, value: string) => {
    updateAndSaveDelegation(prev => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      return next;
    });
  };

  const handleMainTypeChange = (index: number, newMain: string) => {
    updateAndSaveDelegation(prev => {
      const next = [...prev];
      const targetStandard = delegationStandards.find(x => x.mainType === newMain);
      const firstSub = targetStandard?.subTypes[0];
      const firstDetail = firstSub?.detailTypes[0] || '';

      next[index] = {
        ...next[index],
        mainType: newMain,
        subType: firstSub?.name || '',
        detailType: firstDetail,
      };
      return next;
    });
  };

  const handleSubTypeChange = (index: number, newSub: string) => {
    updateAndSaveDelegation(prev => {
      const next = [...prev];
      const curMain = next[index]?.mainType;
      const targetStandard = delegationStandards.find(x => x.mainType === curMain);
      const subObj = targetStandard?.subTypes.find(x => x.name === newSub);
      const firstDetail = subObj?.detailTypes[0] || '';

      next[index] = {
        ...next[index],
        subType: newSub,
        detailType: firstDetail,
      };
      return next;
    });
  };

  const addDelegationRule = () => {
    const firstMain = delegationStandards[0]?.mainType || '학부모 출결';
    const firstSub = delegationStandards[0]?.subTypes[0]?.name || '결석계';
    const firstDetail = delegationStandards[0]?.subTypes[0]?.detailTypes[0] || '일반/질병/인정';

    updateAndSaveDelegation(prev => [
      ...prev, 
      { id: Date.now().toString(), mainType: firstMain, subType: firstSub, detailType: firstDetail, intermediateApprover: 'NONE', finalApprover: 'GRADE_HEAD' }
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
      <DialogContent 
        className="w-[95vw] max-w-[95vw] h-[92vh] flex flex-col p-0 gap-0 overflow-hidden"
        onPointerDownOutside={(e) => e.preventDefault()}
      >
        <DialogHeader className="shrink-0 px-6 py-2.5 border-b flex flex-row items-baseline gap-3 space-y-0">
          <DialogTitle className="text-base font-bold text-slate-900 shrink-0">시스템 설정</DialogTitle>
          <DialogDescription className="text-xs text-slate-500 truncate mt-0">
            문서 템플릿, 번호 체계, 학사 일정, 전결규정 및 사용자 권한을 관리합니다.
          </DialogDescription>
        </DialogHeader>
        
        <Tabs value={activeMainTab} onValueChange={setActiveMainTab} className="flex-1 flex flex-col min-h-0 overflow-hidden">
          <TabsList className="grid w-full grid-cols-6 shrink-0 rounded-none border-b bg-muted/30 h-11 text-xs md:text-sm">
            <TabsTrigger value="general" onClick={() => setActiveMainTab('general')} className="rounded-none data-[state=active]:border-b-2 data-[state=active]:border-primary"><SettingsIcon className="mr-2 h-4 w-4 hidden md:block"/>일반</TabsTrigger>
            <TabsTrigger value="academicCalendar" onClick={() => setActiveMainTab('academicCalendar')} className="rounded-none data-[state=active]:border-b-2 data-[state=active]:border-primary font-medium"><Calendar className="mr-2 h-4 w-4 hidden md:block"/>학사 일정 관리</TabsTrigger>
            <TabsTrigger value="org" onClick={() => { setActiveMainTab('org'); fetchOrgStructure(); }} className="rounded-none data-[state=active]:border-b-2 data-[state=active]:border-primary"><Network className="mr-2 h-4 w-4 hidden md:block"/>조직도</TabsTrigger>
            <TabsTrigger value="delegation" onClick={() => setActiveMainTab('delegation')} className="rounded-none data-[state=active]:border-b-2 data-[state=active]:border-primary"><FileText className="mr-2 h-4 w-4 hidden md:block"/>전결규정</TabsTrigger>
            <TabsTrigger value="users" onClick={() => setActiveMainTab('users')} className="rounded-none data-[state=active]:border-b-2 data-[state=active]:border-primary"><Users className="mr-2 h-4 w-4 hidden md:block"/>사용자</TabsTrigger>
            <TabsTrigger value="audit" onClick={() => setActiveMainTab('audit')} className="rounded-none data-[state=active]:border-b-2 data-[state=active]:border-primary"><FileText className="mr-2 h-4 w-4 hidden md:block"/>감사 로그</TabsTrigger>
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

                {/* 대면 결재 기능 활성화 스위치 */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 bg-amber-50/80 rounded-xl border border-amber-200 shadow-2xs">
                  <div className="space-y-0.5">
                    <Label htmlFor="enableFaceToFaceApproval" className="font-bold text-amber-900 text-sm flex items-center gap-2 cursor-pointer">
                      <Users className="w-4 h-4 text-amber-600 shrink-0" />
                      대면 결재 기능 활성화
                    </Label>
                    <p className="text-xs text-amber-700">
                      켜짐 시 기안 화면에 문서 번호 직접 입력란과 [대면 결재] 버튼이 표시되며, 아래의 다음 문서 번호 자동 채번이 비활성화됩니다. 대면 결재된 문서는 문서등록대장 하단 대면결재문서대장에 별도 보관됩니다.
                    </p>
                  </div>
                  <Switch
                    id="enableFaceToFaceApproval"
                    checked={config.enableFaceToFaceApproval === true}
                    onCheckedChange={(checked) => setConfig((prev) => ({ ...prev, enableFaceToFaceApproval: checked }))}
                  />
                </div>

                {/* 연간 누계 자동 계산 기능 스위치 */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 bg-emerald-50/80 rounded-xl border border-emerald-200 shadow-2xs">
                  <div className="space-y-0.5">
                    <Label htmlFor="enableCumulativeStats" className="font-bold text-emerald-950 text-sm flex items-center gap-2 cursor-pointer">
                      <GraduationCap className="w-4 h-4 text-emerald-700 shrink-0" />
                      연간 누계 자동 계산 기능
                    </Label>
                    <p className="text-xs text-emerald-800">
                      학부모 서비스의 체험학습 신청서 및 결석계에서 연간 누적 사용 일수를 자동으로 계산하여 표시합니다. 종이 신청서와 병용 시 누계 혼선을 방지하려면 이 기능을 끌 수 있습니다. 끄면 학부모 대시보드 현황판과 신청서 서식의 누계 영역이 숨겨집니다.
                    </p>
                  </div>
                  <Switch
                    id="enableCumulativeStats"
                    checked={config.enableCumulativeStats !== false}
                    onCheckedChange={(checked) => setConfig((prev) => ({ ...prev, enableCumulativeStats: checked }))}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="nextNumber" className={`font-semibold ${config.enableFaceToFaceApproval ? 'text-slate-400' : 'text-slate-800'}`}>
                    다음 문서 번호
                    {config.enableFaceToFaceApproval && (
                      <span className="ml-2 text-xs font-normal text-amber-600">(대면 결재 기능 켜짐 시 자동 채번 비활성화)</span>
                    )}
                  </Label>
                  <Input
                    id="nextNumber"
                    name="nextNumber"
                    type="number"
                    value={config.nextNumber || 1}
                    onChange={handleChange}
                    disabled={config.enableFaceToFaceApproval === true}
                    className={`w-full sm:w-60 ${config.enableFaceToFaceApproval ? 'opacity-50 cursor-not-allowed bg-slate-100' : ''}`}
                  />
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

                {/* 🌐 Google Drive 중앙 저장소 연동 설정 카드 */}
                <div className="space-y-4 pt-5 border-t border-slate-200">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 bg-indigo-50/70 rounded-2xl border border-indigo-200 shadow-2xs">
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2">
                        <HardDrive className="w-5 h-5 text-indigo-600 shrink-0" />
                        <h4 className="font-bold text-indigo-950 text-sm">
                          학교 Google Drive 중앙 저장소 연동
                        </h4>
                        <Badge variant="outline" className={cn(
                          "text-[10px] font-bold px-1.5 py-0 h-4",
                          googleDriveConfig.enabled ? "bg-emerald-100 text-emerald-800 border-emerald-300" : "bg-slate-100 text-slate-500 border-slate-300"
                        )}>
                          {googleDriveConfig.enabled ? '연동 활성화됨' : '미연동'}
                        </Badge>
                      </div>
                      <p className="text-xs text-indigo-800">
                        학교 Google Workspace 공용 드라이브(Shared Drive) 또는 메인 공유 폴더를 KISAPP의 중앙 아카이브 저장소로 지정합니다.
                      </p>
                    </div>
                    <Switch
                      id="enableGoogleDrive"
                      checked={googleDriveConfig.enabled}
                      onCheckedChange={(checked) => setGoogleDriveConfig(prev => ({ ...prev, enabled: checked }))}
                    />
                  </div>

                  {googleDriveConfig.enabled && (
                    <div className="p-4 bg-white rounded-2xl border border-indigo-200/90 shadow-2xs space-y-4 text-xs">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                          <Label className="font-bold text-slate-800 flex items-center gap-1.5">
                            <Folder className="w-3.5 h-3.5 text-indigo-600" />
                            중앙 저장소 공유 드라이브 명칭
                          </Label>
                          <Input
                            placeholder="예: KIS_학교행정_중앙저장소"
                            value={googleDriveConfig.sharedDriveName || ''}
                            onChange={(e) => setGoogleDriveConfig(prev => ({ ...prev, sharedDriveName: e.target.value }))}
                            className="h-9 text-xs font-semibold"
                          />
                        </div>

                        <div className="space-y-1.5">
                          <Label className="font-bold text-slate-800">중앙 루트 폴더 ID (자동 추출 지원)</Label>
                          <Input
                            placeholder="예: 1A2b3C4d5E... 또는 아래 링크 입력 시 자동 추출"
                            value={googleDriveConfig.rootFolderId || ''}
                            onChange={(e) => setGoogleDriveConfig(prev => ({ ...prev, rootFolderId: e.target.value.trim() }))}
                            className="h-9 text-xs font-mono"
                          />
                        </div>
                      </div>

                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between">
                          <Label className="font-bold text-slate-800 flex items-center gap-1.5">
                            <span>Google Drive 중앙 폴더 웹 링크 (URL) *</span>
                          </Label>
                          {googleDriveConfig.rootFolderUrl && (
                            <a
                              href={googleDriveConfig.rootFolderUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="text-[11px] text-indigo-600 hover:underline flex items-center gap-1 font-bold"
                            >
                              <span>드라이브 접속 확인</span>
                              <ExternalLink className="w-3 h-3" />
                            </a>
                          )}
                        </div>
                        <Input
                          placeholder="https://drive.google.com/drive/folders/1A2b3C... 또는 공유 드라이브 URL"
                          value={googleDriveConfig.rootFolderUrl || ''}
                          onChange={(e) => {
                            const val = e.target.value;
                            const folderMatch = val.match(/\/folders\/([a-zA-Z0-9-_]+)/i);
                            setGoogleDriveConfig(prev => ({
                              ...prev,
                              rootFolderUrl: val,
                              rootFolderId: folderMatch ? folderMatch[1] : prev.rootFolderId
                            }));
                          }}
                          className="h-9 text-xs font-medium"
                        />
                        <p className="text-[11px] text-slate-500">
                          * 구글 드라이브에서 해당 폴더의 공유 대상을 <strong>'호치민시한국국제학교(@kshcm.net)'</strong>로 설정한 뒤 링크를 입력해주세요.
                        </p>
                      </div>

                      {/* 🔑 서비스 계정 공유 안내 박스 */}
                      <div className="p-3 bg-amber-50/70 border border-amber-200 rounded-xl space-y-1.5">
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-amber-950 text-xs flex items-center gap-1.5">
                            <ShieldCheck className="w-3.5 h-3.5 text-amber-600" />
                            시스템 자동 생성용 Google 서비스 계정 (필수 공유)
                          </span>
                          <button
                            type="button"
                            onClick={() => {
                              navigator.clipboard.writeText('firebase-adminsdk-fbsvc@studio-9153973571-7837c.iam.gserviceaccount.com');
                              toast({ title: '이메일 복사 완료', description: '서비스 계정 이메일이 클립보드에 복사되었습니다.' });
                            }}
                            className="px-2 py-0.5 text-[10.5px] bg-white border border-amber-300 text-amber-800 font-bold rounded hover:bg-amber-100 cursor-pointer"
                          >
                            이메일 복사
                          </button>
                        </div>
                        <p className="text-[11px] text-amber-800 leading-tight">
                          구글 드라이브 중앙 폴더의 [공유] 메뉴에서 아래 서비스 계정을 <strong>'편집자(Editor)'</strong>로 한 번만 추가해주시면, 시스템이 하위 폴더 자동 분류 및 업무 제목 Google Sheets 파일을 자동으로 생성할 수 있습니다:
                        </p>
                        <p className="text-[10.5px] font-mono text-amber-900 bg-white/80 p-1.5 rounded border border-amber-200 select-all">
                          firebase-adminsdk-fbsvc@studio-9153973571-7837c.iam.gserviceaccount.com
                        </p>
                      </div>

                      {/* 📂 표준 하위 폴더 4종 자동 동기화 섹션 */}
                      <div className="space-y-2.5 pt-2 border-t border-slate-100">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                          <div>
                            <h5 className="font-bold text-slate-800 text-xs flex items-center gap-1.5">
                              <Folder className="w-3.5 h-3.5 text-indigo-600" />
                              중앙 저장소 표준 하위 폴더 4종 분류 체계
                            </h5>
                            <p className="text-[10.5px] text-slate-500">
                              결재완료문서, 업무작업문서, 결석계, 체험학습 전용 폴더가 중앙 루트 폴더 내에 자동 구성됩니다.
                            </p>
                          </div>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={handleSyncFolders}
                            disabled={isSyncingFolders || !googleDriveConfig.rootFolderId}
                            className="h-7 px-2.5 text-xs font-bold text-indigo-700 bg-indigo-50 border-indigo-200 hover:bg-indigo-100 shrink-0 cursor-pointer shadow-2xs"
                          >
                            {isSyncingFolders ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <RotateCcw className="w-3 h-3 mr-1" />}
                            표준 하위 폴더 4종 동기화
                          </Button>
                        </div>

                        {/* 하위 폴더 상태 카드 그리드 */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                          {[
                            { name: '01_결재완료문서', desc: '승인 완료된 공문서 아카이브', id: googleDriveConfig.subFolders?.approvalDoneId, url: googleDriveConfig.subFolders?.approvalDoneUrl },
                            { name: '02_업무작업문서(시트_첨부파일)', desc: '업무용 Google 시트 자동 생성 저장소', id: googleDriveConfig.subFolders?.taskWorkId, url: googleDriveConfig.subFolders?.taskWorkUrl },
                            { name: '03_결석계(완료)', desc: '전결 완료된 결석계 서류 보관', id: googleDriveConfig.subFolders?.absenceDoneId, url: googleDriveConfig.subFolders?.absenceDoneUrl },
                            { name: '04_체험학습신청서(완료)', desc: '전결 완료된 체험학습 서류 보관', id: googleDriveConfig.subFolders?.fieldTripDoneId, url: googleDriveConfig.subFolders?.fieldTripDoneUrl },
                          ].map((f, i) => (
                            <div key={i} className="p-2.5 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between text-xs">
                              <div className="min-w-0 pr-2">
                                <p className="font-bold text-slate-800 flex items-center gap-1.5 truncate">
                                  <Folder className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                                  <span className="truncate">{f.name}</span>
                                </p>
                                <p className="text-[10px] text-slate-400 truncate">{f.desc}</p>
                              </div>
                              {f.url ? (
                                <a
                                  href={f.url}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="px-2 py-0.5 text-[10.5px] bg-white border border-slate-300 text-indigo-600 hover:text-indigo-800 font-bold rounded flex items-center gap-1 shrink-0 shadow-2xs"
                                >
                                  <span>열기</span>
                                  <ExternalLink className="w-2.5 h-2.5" />
                                </a>
                              ) : (
                                <Badge variant="secondary" className="text-[9.5px] px-1.5 py-0 text-slate-400 font-medium shrink-0">
                                  미생성
                                </Badge>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="flex justify-end pt-2 border-t border-slate-100">
                        <Button
                          type="button"
                          size="sm"
                          onClick={handleSaveGoogleDrive}
                          disabled={isSavingGoogleDrive}
                          className="h-8 px-4 text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl shadow-2xs cursor-pointer"
                        >
                          {isSavingGoogleDrive ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <Save className="w-3 h-3 mr-1" />}
                          Google Drive 저장소 설정 저장
                        </Button>
                      </div>
                    </div>
                  )}
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
                      학교 전체 표준 학기 기간, 연간 총 수업일수, 표준 수업 시간대, 휴업일/공휴일/학교행사를 통합 설정합니다.
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

                {/* 1. 연간 총 수업일수 & 표준 일과 수업 시간대 설정 (2열 그리드) */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* 좌측: 연간 총 수업일수 */}
                  <div className="space-y-2 bg-white p-4 rounded-xl border border-slate-200 shadow-2xs flex flex-col justify-between">
                    <div className="space-y-1.5">
                      <Label htmlFor="annualSchoolDays" className="font-bold text-slate-800 text-xs sm:text-sm block">
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
                    </div>
                    <p className="text-[11px] text-slate-500 pt-1">
                      학부모 체험학습 허용 한도(10%) 및 출석인정 수업일수(2/3 수료 기준)의 원천 계산 기준입니다.
                    </p>
                  </div>

                  {/* 우측: 표준 일과 수업 시간대 설정 */}
                  <div className="space-y-2.5 bg-white p-4 rounded-xl border border-slate-200 shadow-2xs flex flex-col justify-between">
                    <div className="flex items-center justify-between gap-2">
                      <Label className="font-bold text-slate-800 text-xs sm:text-sm flex items-center gap-1.5">
                        <Clock className="w-4 h-4 text-indigo-600" />
                        수업 시간대 설정 (교시별 시간표)
                      </Label>
                      <Badge variant="outline" className="text-[10px] bg-indigo-50 text-indigo-700 border-indigo-200 font-bold shrink-0">
                        배정표·방과후 프리셋 연동
                      </Badge>
                    </div>

                    {/* 교시 목록 요약 칩 */}
                    <div className="flex flex-wrap gap-1.5 py-0.5 max-h-[85px] overflow-y-auto">
                      {(academicCal.periodSchedules || DEFAULT_PERIOD_SCHEDULES).map((p) => (
                        <span key={p.id} className="inline-flex items-center text-[10px] font-bold px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 border border-slate-200">
                          {p.name}: <span className="font-mono ml-1 text-indigo-600">{p.startTime}~{p.endTime}</span>
                        </span>
                      ))}
                    </div>

                    <div className="flex items-center justify-between pt-1 border-t border-slate-100">
                      <p className="text-[11px] text-slate-500 truncate">
                        체육대회 배정표, 방과후 등 전 기능 기준 프리셋
                      </p>
                      <Button
                        type="button"
                        size="sm"
                        onClick={() => setIsPeriodModalOpen(true)}
                        className="h-7 text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white shrink-0 ml-2"
                      >
                        <Pencil className="w-3 h-3 mr-1" />
                        시간대 편집
                      </Button>
                    </div>
                  </div>
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
                    <div className="p-3 bg-indigo-50/60 rounded-xl border border-indigo-200 space-y-2">
                      <span className="font-bold text-indigo-900 text-xs block">🏫 2026학년도 2학기</span>
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
                    <div className="p-3 bg-cyan-50/60 rounded-xl border border-cyan-200 space-y-2">
                      <span className="font-bold text-cyan-900 text-xs block">❄️ 2027학년도 겨울방학</span>
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
                      <div className="sm:col-span-4 flex items-center gap-1">
                        <Input 
                          type="date" 
                          value={newEventDate} 
                          onChange={e => setNewEventDate(e.target.value)} 
                          className="text-[11px] h-8 bg-white flex-1" 
                          title="시작일"
                        />
                        <span className="text-xs text-slate-400 font-bold shrink-0">~</span>
                        <Input 
                          type="date" 
                          value={newEventEndDate} 
                          min={newEventDate}
                          onChange={e => setNewEventEndDate(e.target.value)} 
                          className="text-[11px] h-8 bg-white flex-1" 
                          title="종료일 (기간 일정인 경우 입력, 당일 일정이면 비워둠)"
                        />
                      </div>
                      <div className="sm:col-span-3">
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
                            <span className="font-bold text-slate-800">
                              {ev.endDate && ev.endDate !== ev.date ? `${ev.date} ~ ${ev.endDate}` : ev.date}
                            </span>
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
                      <div className="p-4 text-center text-slate-400 text-xs">
                        등록된 휴업일/공휴일/행사가 없습니다.
                      </div>
                    )}
                  </div>
                </div>

                {/* 4. 🚫 체험학습 불인정(신청 불가 기간) 관리 (학사 일정 관리 탭 맨 아래로 이동) */}
                <div className="space-y-3 bg-white p-4 rounded-xl border border-red-200 shadow-2xs">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div>
                      <h4 className="font-bold text-slate-800 text-xs sm:text-sm flex items-center gap-2">
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
                  <div className="p-3 bg-red-50/40 rounded-xl border border-red-200 space-y-2">
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
                  <div className="border border-slate-200 rounded-xl overflow-hidden shadow-2xs max-h-[160px] overflow-y-auto">
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
              <Button onClick={handleSaveAcademicCalendar} disabled={isSaving} className="bg-indigo-600 hover:bg-indigo-700 font-bold">
                {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                학사 일정 설정 저장
              </Button>
            </div>
          </TabsContent>

          <TabsContent value="org" className="flex-1 min-h-0 mt-0 data-[state=active]:flex flex-col">
            {/* 상단 3개 하위 서브탭 네비게이션 */}
            <div className="shrink-0 px-6 pt-3.5 pb-2.5 border-b bg-slate-50/70">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 p-1 bg-slate-200/80 rounded-xl border border-slate-300/60">
                  <button
                    type="button"
                    onClick={() => setOrgSubTab('leadership')}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                      orgSubTab === 'leadership'
                        ? 'bg-white text-indigo-700 shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <Building2 className="w-3.5 h-3.5" />
                    학교 리더십
                  </button>
                  <button
                    type="button"
                    onClick={() => setOrgSubTab('duties')}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                      orgSubTab === 'duties'
                        ? 'bg-white text-indigo-700 shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <Briefcase className="w-3.5 h-3.5" />
                    업무 담당 설정
                  </button>
                  <button
                    type="button"
                    onClick={() => setOrgSubTab('grades')}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                      orgSubTab === 'grades'
                        ? 'bg-white text-indigo-700 shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <GraduationCap className="w-3.5 h-3.5" />
                    학년별 담임 및 교과
                  </button>
                  <button
                    type="button"
                    onClick={() => setOrgSubTab('departments')}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                      orgSubTab === 'departments'
                        ? 'bg-white text-indigo-700 shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <FolderKanban className="w-3.5 h-3.5" />
                    부서 관리
                  </button>
                </div>

                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-8 text-xs font-bold text-indigo-700 bg-white hover:bg-indigo-50 border-indigo-200 shrink-0"
                  onClick={async () => {
                    toast({ title: '조직도 동기화 진행 중...', description: '교직원 정보와 조직도를 맞추고 있습니다.' });
                    const syncRes = await syncAllUsersToOrgStructure();
                    if (syncRes.success && syncRes.updatedOrg) {
                      setOrg(syncRes.updatedOrg);
                      toast({ title: '동기화 완료', description: syncRes.message || '교원 소속이 조직도에 성공적으로 반영되었습니다.' });
                    } else {
                      toast({ variant: 'destructive', title: '동기화 실패', description: syncRes.message });
                    }
                  }}
                >
                  <RotateCcw className="w-3.5 h-3.5 mr-1 text-indigo-600" />
                  교원 소속 ↔ 조직도 자동 동기화
                </Button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-3">
              {/* ========================================================================= */}
              {/* 1. 하위 탭: 학교 리더십                                                   */}
              {/* ========================================================================= */}
              {orgSubTab === 'leadership' && (
                <div className="space-y-4">
                  {/* 학교 리더십 (교장, 교감, 교무부장) */}
                  <div className="space-y-3 bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
                    <div className="flex items-center justify-between border-b pb-2">
                      <div className="flex items-center gap-2">
                        <Building2 className="w-4 h-4 text-indigo-600" />
                        <h4 className="font-bold text-base text-slate-900">학교 리더십 (학교장 / 교감 / 교무부장)</h4>
                      </div>
                      <span className="text-xs text-slate-400">최종 결재선 및 학교 총괄 관리자</span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-1">
                      <div className="space-y-1.5">
                        <Label className="text-xs font-bold text-slate-700">학교장 (교장)</Label>
                        <SearchableUserSelect
                          users={facultyUsers}
                          value={org.principal}
                          onSelect={(val) => updateAndSaveOrg(p => ({ ...p, principal: val }), '학교장(교장) 설정이 저장되었습니다.')}
                          placeholder="선택 안됨"
                          allowUnassign={true}
                          unassignLabel="선택 안됨 (해제)"
                          triggerClassName="h-9 text-xs"
                          panelWidthClass="w-64"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs font-bold text-slate-700">교감</Label>
                        <SearchableUserSelect
                          users={facultyUsers}
                          value={org.vicePrincipal}
                          onSelect={(val) => updateAndSaveOrg(p => ({ ...p, vicePrincipal: val }), '교감 설정이 저장되었습니다.')}
                          placeholder="선택 안됨"
                          allowUnassign={true}
                          unassignLabel="선택 안됨 (해제)"
                          triggerClassName="h-9 text-xs"
                          panelWidthClass="w-64"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs font-bold text-indigo-700">교무부장</Label>
                        <SearchableUserSelect
                          users={facultyUsers}
                          value={org.academicHead}
                          onSelect={(val) => updateAndSaveOrg(p => ({ ...p, academicHead: val }), '교무부장 설정이 저장되었습니다.')}
                          placeholder="선택 안됨"
                          allowUnassign={true}
                          unassignLabel="선택 안됨 (해제)"
                          triggerClassName="h-9 text-xs border-indigo-200 bg-indigo-50/40"
                          panelWidthClass="w-64"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* ========================================================================= */}
              {/* 2. 하위 탭: 업무 담당 설정                                                */}
              {/* ========================================================================= */}
              {orgSubTab === 'duties' && (
                <div className="space-y-4">
                  {/* 새 업무 담당 직책 추가 바 (소속 부서 선택 연동) */}
                  <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-2 p-3 bg-indigo-50/50 rounded-xl border border-indigo-100">
                          <div className="space-y-0.5">
                            <span className="text-xs font-bold text-indigo-950 flex items-center gap-1">
                              <PlusCircle className="w-3.5 h-3.5 text-indigo-600" />
                              새 업무 담당 직책 추가
                            </span>
                            <p className="text-[11px] text-indigo-700">학교 내 업무/직책을 직접 생성하고, 어느 부서의 소관 업무인지 연결합니다.</p>
                          </div>
                          <div className="flex flex-wrap items-center gap-1.5 w-full lg:w-auto">
                            <Input 
                              placeholder="직책명 (예: 영재교육, 정보보안)" 
                              value={newCustomDutyRoleName} 
                              onChange={e => setNewCustomDutyRoleName(e.target.value)}
                              onKeyDown={e => {
                                if (e.key === 'Enter') {
                                  e.preventDefault();
                                  if (!newCustomDutyRoleName.trim()) return;
                                  const newRole: CustomDutyRole = { 
                                    id: Date.now().toString(), 
                                    roleName: newCustomDutyRoleName.trim(), 
                                    deptName: newCustomDutyDept !== 'unassigned' ? newCustomDutyDept : undefined,
                                    teacherEmails: [] 
                                  };
                                  updateAndSaveOrg(p => ({ ...p, customDutyRoles: [...(p.customDutyRoles || []), newRole] }), `"${newRole.roleName}" 직책이 추가되었습니다.`);
                                  setNewCustomDutyRoleName('');
                                }
                              }}
                              className="h-8 text-xs bg-white border-indigo-200 w-40 sm:w-48"
                            />

                            {/* 소속 부서 선택 드롭다운 */}
                            <Select value={newCustomDutyDept} onValueChange={setNewCustomDutyDept}>
                              <SelectTrigger className="h-8 text-xs bg-white border-indigo-200 w-36">
                                <SelectValue placeholder="소속 부서 선택" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="unassigned" className="text-xs font-semibold text-slate-500">소속 부서 없음 (직속)</SelectItem>
                                {(org.departments || []).map(d => (
                                  <SelectItem key={d.id} value={d.name} className="text-xs font-medium">
                                    {d.name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>

                            <Button 
                              type="button" 
                              size="sm" 
                              onClick={() => {
                                if (!newCustomDutyRoleName.trim()) {
                                  toast({ variant: 'destructive', title: '직책명 입력', description: '추가할 직책명을 입력하세요.' });
                                  return;
                                }
                                const newRole: CustomDutyRole = { 
                                  id: Date.now().toString(), 
                                  roleName: newCustomDutyRoleName.trim(), 
                                  deptName: newCustomDutyDept !== 'unassigned' ? newCustomDutyDept : undefined,
                                  teacherEmails: [] 
                                };
                                updateAndSaveOrg(p => ({ ...p, customDutyRoles: [...(p.customDutyRoles || []), newRole] }), `"${newRole.roleName}" 직책이 추가되었습니다.`);
                                setNewCustomDutyRoleName('');
                              }}
                              className="h-8 text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white shrink-0"
                            >
                              <PlusCircle className="w-3.5 h-3.5 mr-1" />
                              직책 추가
                            </Button>
                          </div>
                        </div>

                        {/* 기본 7종 업무 직책 카드 그리드 (소속 부서 지정 + 권한 설정) */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                          {[
                            {
                              key: 'pe',
                              title: '학교 체육 / 체육교사',
                              colorClass: 'text-indigo-700',
                              borderClass: 'border-indigo-200',
                              bgClass: 'bg-indigo-50/40',
                              badgeClass: 'bg-indigo-100 text-indigo-800',
                            },
                            {
                              key: 'health',
                              title: '보건교사 / 학생 건강',
                              colorClass: 'text-emerald-800',
                              borderClass: 'border-emerald-200',
                              bgClass: 'bg-emerald-50/40',
                              badgeClass: 'bg-emerald-100 text-emerald-800',
                            },
                            {
                              key: 'afterschool',
                              title: '방과후학교 담당자',
                              colorClass: 'text-violet-700',
                              borderClass: 'border-violet-200',
                              bgClass: 'bg-violet-50/40',
                              badgeClass: 'bg-violet-100 text-violet-800',
                            },
                            {
                              key: 'bus',
                              title: '스쿨버스 담당자',
                              colorClass: 'text-amber-700',
                              borderClass: 'border-amber-200',
                              bgClass: 'bg-amber-50/40',
                              badgeClass: 'bg-amber-100 text-amber-800',
                            },
                            {
                              key: 'system',
                              title: '시스템 설정 담당자',
                              colorClass: 'text-sky-700',
                              borderClass: 'border-sky-200',
                              bgClass: 'bg-sky-50/40',
                              badgeClass: 'bg-sky-100 text-sky-800',
                            },
                            {
                              key: 'special',
                              title: '특수교사 / 도움반',
                              colorClass: 'text-teal-800',
                              borderClass: 'border-teal-200',
                              bgClass: 'bg-teal-50/40',
                              badgeClass: 'bg-teal-100 text-teal-800',
                            },
                            {
                              key: 'librarian',
                              title: '사서교사',
                              colorClass: 'text-slate-800',
                              borderClass: 'border-slate-200',
                              bgClass: 'bg-slate-50/40',
                              badgeClass: 'bg-slate-100 text-slate-800',
                            },
                          ].map(item => {
                            const assignedDept = org.dutyRoleDepts?.[item.key];
                            const rolePerms = org.dutyRolePermissions?.[item.key] || DEFAULT_ROLE_PERMISSIONS[item.key] || { features: [], documents: [] };
                            const featureCount = (rolePerms.features || []).length;
                            const docCount = (rolePerms.documents || []).length;

                            return (
                              <div key={item.key} className={cn("space-y-2.5 border p-3 rounded-xl flex flex-col justify-between shadow-2xs", item.bgClass)}>
                                <div className="space-y-2">
                                  {/* 헤더: 직책명 + 소속 부서 드롭다운 */}
                                  <div className="flex items-center justify-between gap-1">
                                    <Label className={cn("font-bold text-xs", item.colorClass)}>{item.title}</Label>
                                    <Select 
                                      value={assignedDept || 'unassigned'} 
                                      onValueChange={(val) => {
                                        updateAndSaveOrg(p => {
                                          const nextDepts = { ...(p.dutyRoleDepts || {}) };
                                          if (val === 'unassigned') {
                                            delete nextDepts[item.key];
                                          } else {
                                            nextDepts[item.key] = val;
                                          }
                                          return { ...p, dutyRoleDepts: nextDepts };
                                        }, `${item.title}의 소속 부서가 설정되었습니다.`);
                                      }}
                                    >
                                      <SelectTrigger className={cn("h-6 text-[10px] w-28 bg-white font-medium", item.borderClass)}>
                                        <SelectValue placeholder="소속 부서" />
                                      </SelectTrigger>
                                      <SelectContent>
                                        <SelectItem value="unassigned" className="text-[11px]">소속 부서 없음</SelectItem>
                                        {(org.departments || []).map(d => (
                                          <SelectItem key={d.id} value={d.name} className="text-[11px] font-medium">{d.name}</SelectItem>
                                        ))}
                                      </SelectContent>
                                    </Select>
                                  </div>

                                  {/* 소속 부서 안내 및 권한 상태 */}
                                  <div className="p-2 border rounded-lg bg-white/95 space-y-1.5 min-h-[54px] shadow-2xs">
                                    <div className="flex items-center justify-between text-[11px]">
                                      <span className="text-slate-500 font-medium">배속 부서:</span>
                                      <span className={cn("font-bold", assignedDept && assignedDept !== 'unassigned' ? "text-indigo-700" : "text-slate-400")}>
                                        {assignedDept && assignedDept !== 'unassigned' ? assignedDept : '소속 부서 없음 (직속)'}
                                      </span>
                                    </div>

                                    {/* 권한 요약 */}
                                    <div className="flex items-center justify-between text-[11px] pt-1 border-t border-slate-100">
                                      <span className="text-slate-500 font-medium">부여 권한:</span>
                                      <span className="text-indigo-600 font-bold text-[10px]">
                                        기능 {featureCount}개 · 문서 {docCount}개
                                      </span>
                                    </div>
                                  </div>
                                </div>

                                {/* 권한 설정 버튼 */}
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  onClick={() => openPermissionModal(item.key, item.title, rolePerms)}
                                  className="h-7 text-xs font-bold w-full bg-white hover:bg-slate-50 border-slate-200 text-slate-700"
                                >
                                  <ShieldCheck className="w-3.5 h-3.5 mr-1 text-indigo-600" />
                                  권한 설정
                                </Button>
                              </div>
                            );
                          })}
                        </div>

                        {/* 추가된 커스텀 업무 직책 카드 목록 */}
                        {(org.customDutyRoles || []).length > 0 && (
                          <div className="space-y-2 pt-2 border-t">
                            <Label className="text-xs font-bold text-slate-700">추가된 업무 담당 직책 ({(org.customDutyRoles || []).length}개)</Label>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                              {(org.customDutyRoles || []).map(role => {
                                const rolePerms = role.permissions || { features: [], documents: [] };
                                const featureCount = (rolePerms.features || []).length;
                                const docCount = (rolePerms.documents || []).length;

                                return (
                                  <div key={role.id} className="space-y-2.5 border border-indigo-200 p-3 rounded-xl bg-indigo-50/30 flex flex-col justify-between shadow-2xs">
                                    <div className="space-y-2">
                                      <div className="flex items-center justify-between gap-1">
                                        <Label className="font-bold text-xs text-indigo-900 flex items-center gap-1 truncate">
                                          <Tag className="w-3 h-3 text-indigo-600 shrink-0" />
                                          <span className="truncate">{role.roleName}</span>
                                        </Label>
                                        
                                        <div className="flex items-center gap-1 shrink-0">
                                          <Select 
                                            value={role.deptName || 'unassigned'} 
                                            onValueChange={(val) => {
                                              updateAndSaveOrg(p => ({
                                                ...p,
                                                customDutyRoles: (p.customDutyRoles || []).map(r => 
                                                  r.id === role.id ? { ...r, deptName: val !== 'unassigned' ? val : undefined } : r
                                                )
                                              }), `"${role.roleName}" 직책의 소속 부서가 설정되었습니다.`);
                                            }}
                                          >
                                            <SelectTrigger className="h-6 text-[10px] w-28 bg-white border-indigo-200 font-medium">
                                              <SelectValue placeholder="소속 부서" />
                                            </SelectTrigger>
                                            <SelectContent>
                                              <SelectItem value="unassigned" className="text-[11px]">소속 부서 없음</SelectItem>
                                              {(org.departments || []).map(d => (
                                                <SelectItem key={d.id} value={d.name} className="text-[11px] font-medium">{d.name}</SelectItem>
                                              ))}
                                            </SelectContent>
                                          </Select>

                                          <button
                                            type="button"
                                            onClick={() => {
                                              if (confirm(`"${role.roleName}" 직책을 삭제하시겠습니까?`)) {
                                                updateAndSaveOrg(p => ({ ...p, customDutyRoles: (p.customDutyRoles || []).filter(r => r.id !== role.id) }), `"${role.roleName}" 직책이 삭제되었습니다.`);
                                              }
                                            }}
                                            className="text-slate-400 hover:text-rose-600 text-xs font-bold p-0.5 ml-0.5"
                                            title="직책 삭제"
                                          >
                                            ×
                                          </button>
                                        </div>
                                      </div>

                                      <div className="p-2 border rounded-lg bg-white/95 space-y-1.5 min-h-[54px] shadow-2xs">
                                        <div className="flex items-center justify-between text-[11px]">
                                          <span className="text-slate-500 font-medium">배속 부서:</span>
                                          <span className={cn("font-bold", role.deptName ? "text-indigo-700" : "text-slate-400")}>
                                            {role.deptName || '소속 부서 없음 (직속)'}
                                          </span>
                                        </div>

                                        <div className="flex items-center justify-between text-[11px] pt-1 border-t border-slate-100">
                                          <span className="text-slate-500 font-medium">부여 권한:</span>
                                          <span className="text-indigo-600 font-bold text-[10px]">
                                            기능 {featureCount}개 · 문서 {docCount}개
                                          </span>
                                        </div>
                                      </div>
                                    </div>

                                    <Button
                                      type="button"
                                      variant="outline"
                                      size="sm"
                                      onClick={() => openPermissionModal(role.id, role.roleName, rolePerms)}
                                      className="h-7 text-xs font-bold w-full bg-white hover:bg-slate-50 border-slate-200 text-slate-700"
                                    >
                                      <ShieldCheck className="w-3.5 h-3.5 mr-1 text-indigo-600" />
                                      권한 설정
                                    </Button>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}
                      </div>
                  )}

              {/* ========================================================================= */}
              {/* 2. 하위 탭: 학년별 담임 및 교과                                            */}
              {/* ========================================================================= */}
              {orgSubTab === 'grades' && (
                <div className="space-y-5">
                  {/* 상단 통합 제어 바: 학년 조회 (좌측) + 담임/교과 추가/배정 (우측) */}
                  <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-3 bg-indigo-50/60 p-3 rounded-xl border border-indigo-100">
                    {/* 1. 학년 조회 (좌측) */}
                    <div className="flex items-center gap-2 shrink-0">
                      <GraduationCap className="w-4 h-4 text-indigo-700 shrink-0" />
                      <Label className="text-xs font-bold text-indigo-950 whitespace-nowrap">학년 조회:</Label>
                      <Select value={selectedGradeView} onValueChange={setSelectedGradeView}>
                        <SelectTrigger className="w-28 sm:w-32 h-8 text-xs font-bold bg-white border-indigo-200">
                          <SelectValue placeholder="학년 선택" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all" className="text-xs font-bold">전체 학년</SelectItem>
                          <SelectItem value="유치원" className="text-xs font-medium">유치원</SelectItem>
                          {[1, 2, 3, 4, 5, 6].map(g => (
                            <SelectItem key={g} value={String(g)} className="text-xs font-medium">{g}학년</SelectItem>
                          ))}
                          <SelectItem value="중등" className="text-xs font-medium">중등</SelectItem>
                        </SelectContent>
                      </Select>
                      <Badge variant="outline" className="text-[11px] font-bold text-indigo-700 bg-white border-indigo-200 shrink-0">
                        {selectedGradeView === 'all' ? '전체' : `${selectedGradeView}${selectedGradeView.endsWith('학년') || selectedGradeView === '유치원' || selectedGradeView === '중등' ? '' : '학년'}`} 담임/교과
                      </Badge>
                    </div>

                    {/* 구분선 (데스크탑 이상) */}
                    <div className="hidden xl:block h-6 w-px bg-indigo-200/80" />

                    {/* 2. 추가 / 배정 기능 (우측) */}
                    <div className="flex flex-wrap items-center gap-2">
                      {/* 학년 선택 */}
                      <div className="flex items-center gap-1">
                        <Select value={newHomeroom.grade} onValueChange={val => setNewHomeroom({ ...newHomeroom, grade: val })}>
                          <SelectTrigger className="w-20 h-8 bg-white text-xs font-medium"><SelectValue placeholder="학년" /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="유치원" className="text-xs">유치원</SelectItem>
                            {[1, 2, 3, 4, 5, 6].map(g => (
                              <SelectItem key={g} value={String(g)} className="text-xs">{g}학년</SelectItem>
                            ))}
                            <SelectItem value="중등" className="text-xs">중등</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      {/* 구분: 담임 / 교과 토글 */}
                      <div className="flex bg-slate-200/80 p-0.5 rounded-lg border border-slate-300/60 h-8 items-center">
                        <button
                          type="button"
                          onClick={() => setNewHomeroom(prev => ({ ...prev, roleType: 'homeroom' }))}
                          className={`px-2.5 py-1 text-xs font-bold rounded-md transition-all ${
                            newHomeroom.roleType !== 'subject'
                              ? 'bg-white text-indigo-700 shadow-xs'
                              : 'text-slate-600 hover:text-slate-900'
                          }`}
                        >
                          담임
                        </button>
                        <button
                          type="button"
                          onClick={() => setNewHomeroom(prev => ({ ...prev, roleType: 'subject' }))}
                          className={`px-2.5 py-1 text-xs font-bold rounded-md transition-all ${
                            newHomeroom.roleType === 'subject'
                              ? 'bg-sky-600 text-white shadow-xs'
                              : 'text-slate-600 hover:text-slate-900'
                          }`}
                        >
                          교과
                        </button>
                      </div>

                      {/* 담임일 때만 반 입력 및 학년부장 스위치 */}
                      {newHomeroom.roleType !== 'subject' ? (
                        <>
                          <Input 
                            type="number" 
                            min="1" 
                            max="20" 
                            placeholder="반" 
                            value={newHomeroom.class} 
                            onChange={e => setNewHomeroom({ ...newHomeroom, class: e.target.value })} 
                            className="w-14 h-8 bg-white text-center font-bold text-xs" 
                          />
                          <Label className="text-xs flex items-center gap-1 cursor-pointer select-none px-1">
                            <Switch 
                              className="scale-75 origin-left"
                              checked={newHomeroom.isGradeHead}
                              onCheckedChange={(checked) => setNewHomeroom({ ...newHomeroom, isGradeHead: checked })}
                            />
                            <span className="text-[11px] font-semibold text-slate-700">부장</span>
                          </Label>
                        </>
                      ) : (
                        <span className="text-xs font-semibold text-sky-700 bg-sky-100/70 border border-sky-200 px-2 py-1 rounded-md">
                          {newHomeroom.grade}학년 교과
                        </span>
                      )}

                      {/* 담당 교사 검색 콤보박스 */}
                      <div className="w-32 sm:w-36 shrink-0">
                        <SearchableUserSelect
                          users={facultyUsers}
                          value={newHomeroom.email}
                          onSelect={(email) => setNewHomeroom(prev => ({ ...prev, email }))}
                          placeholder="교사 선택"
                          triggerClassName="w-32 sm:w-36 h-8 text-xs px-2 font-normal border-slate-300 hover:bg-slate-50 shadow-2xs"
                          panelWidthClass="w-56"
                        />
                      </div>

                      {/* 추가 / 배정 버튼 */}
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
                      }} className="h-8 px-3 font-bold bg-indigo-600 hover:bg-indigo-700 text-white text-xs shrink-0">
                        추가 / 배정
                      </Button>
                    </div>
                  </div>

                  {/* 교과전담교사 등록 및 담당 지정 (자잘한 설명 없이 한 줄 컴팩트 바) */}
                  <div className="bg-purple-50/50 border border-purple-200/80 rounded-xl p-2.5 sm:p-3 space-y-2">
                    <div className="flex flex-wrap items-center justify-between gap-2.5">
                      <div className="flex items-center gap-2 shrink-0">
                        <UserCheck className="w-4 h-4 text-purple-600" />
                        <span className="font-bold text-xs text-purple-950">교과전담교사 등록 및 담당 지정</span>
                        <Badge variant="outline" className="text-[10px] font-bold text-purple-700 bg-purple-100/80 border-purple-300">
                          과목 {(org.subjectTeacherGroups || []).length}개
                        </Badge>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        <Input 
                          placeholder="새 과목 명칭 (예: 체육전담, 영어전담)" 
                          value={newSubjectCategoryName} 
                          onChange={e => setNewSubjectCategoryName(e.target.value)}
                          className="w-48 sm:w-56 h-8 text-xs bg-white border-purple-200"
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
                            toast({ title: '과목 등록 완료', description: `"${newGrp.categoryName}" 과목이 추가되었습니다.` });
                          }}
                          className="h-8 px-3 text-xs font-bold bg-purple-600 hover:bg-purple-700 text-white shrink-0"
                        >
                          <PlusCircle className="w-3.5 h-3.5 mr-1" />
                          과목 추가
                        </Button>
                      </div>
                    </div>

                    {/* 등록된 교과전담 과목 및 담당 교사 인라인 태그 목록 */}
                    {(org.subjectTeacherGroups || []).length > 0 ? (
                      <div className="flex flex-wrap gap-2 pt-1.5 border-t border-purple-200/50">
                        {(org.subjectTeacherGroups || []).map(group => (
                          <div key={group.id} className="flex items-center gap-1.5 bg-white border border-purple-200 rounded-lg px-2.5 py-1 shadow-2xs">
                            <span className="font-bold text-xs text-purple-900 shrink-0">{group.categoryName}</span>
                            <div className="flex items-center gap-1 flex-wrap">
                              {group.teacherEmails.length === 0 ? (
                                <span className="text-[10px] text-slate-400">교사 미배정</span>
                              ) : (
                                group.teacherEmails.map(email => {
                                  const u = users.find(x => x.email === email);
                                  return (
                                    <span key={email} className="inline-flex items-center gap-0.5 bg-purple-100 text-purple-800 text-[10px] font-semibold px-1.5 py-0.5 rounded">
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
                                        className="text-purple-600 hover:text-purple-900 font-bold ml-0.5"
                                      >
                                        ×
                                      </button>
                                    </span>
                                  );
                                })
                              )}
                            </div>

                            <div className="w-24 shrink-0">
                              <SearchableUserSelect
                                users={facultyUsers}
                                placeholder="+ 교사 지정"
                                clearOnSelect={true}
                                triggerClassName="h-6 w-24 text-[10px] bg-slate-50 border-purple-200"
                                panelWidthClass="w-56"
                                align="end"
                                onSelect={(val) => {
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
                              />
                            </div>

                            <button
                              type="button"
                              onClick={() => {
                                setOrg(p => ({
                                  ...p,
                                  subjectTeacherGroups: (p.subjectTeacherGroups || []).filter(g => g.id !== group.id)
                                }));
                              }}
                              className="text-slate-400 hover:text-rose-600 text-[11px] font-bold ml-1"
                              title="과목 삭제"
                            >
                              ×
                            </button>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-[11px] text-purple-700/60 pt-0.5">
                        등록된 교과전담 과목이 없습니다. 우측에서 과목을 입력하여 추가하세요.
                      </div>
                    )}
                  </div>

                  {/* 배정된 담임 및 교과 교사 카드 그리드 (선택된 학년 필터링 - 가로폭 축소 및 다열 배치) */}
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-2">
                    {(() => {
                      const matchGrade = (itemGrade: string, viewGrade: string) => {
                        if (viewGrade === 'all') return true;
                        const n1 = String(itemGrade).replace(/\D/g, '');
                        const n2 = String(viewGrade).replace(/\D/g, '');
                        if (n1 && n2) return n1 === n2;
                        return String(itemGrade).trim() === String(viewGrade).trim();
                      };

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

                      // 3. Combined & Filtered by selectedGradeView
                      const filteredItems = [...homeroomItems, ...subjectItems].filter(item => {
                        return matchGrade(item.gradeStr, selectedGradeView);
                      }).sort((a, b) => {
                        if (a.grade !== b.grade) return a.grade - b.grade;
                        return a.classNum - b.classNum;
                      });

                      if (filteredItems.length === 0) {
                        return (
                          <div className="col-span-full py-8 text-center text-xs text-muted-foreground bg-slate-50 rounded-xl border border-dashed border-slate-300">
                            {selectedGradeView === 'all' 
                              ? '배정된 학년 담임 및 교과 교사가 없습니다. 위에서 추가하거나 엑셀로 일괄 등록하세요.'
                              : `${selectedGradeView}에 배정된 담임 및 교과 교사가 없습니다. 위에서 교사를 추가하세요.`}
                          </div>
                        );
                      }

                      return filteredItems.map((item) => {
                        const user = users.find(u => u.email?.toLowerCase().trim() === item.email?.toLowerCase().trim());
                        const cleanGradeNum = item.gradeStr.replace(/\D/g, '') || item.gradeStr;
                        const isGradeHead = (org.gradeHeads[item.gradeStr] === item.email) || (org.gradeHeads[cleanGradeNum] === item.email) || (org.gradeHeads[`${cleanGradeNum}학년`] === item.email);

                        if (item.type === 'subject') {
                          return (
                            <div key={item.key} className="flex flex-col bg-sky-50/50 border border-sky-200/80 p-2 sm:p-2.5 rounded-xl shadow-2xs space-y-2 justify-between">
                              <div className="flex justify-between items-start gap-1">
                                <div className="flex flex-col overflow-hidden min-w-0">
                                  <div className="flex items-center gap-1">
                                    <span className="font-bold text-xs text-sky-950 truncate">{item.gradeStr} 교과</span>
                                    <Badge variant="outline" className="text-[9px] px-1 py-0 bg-sky-100 text-sky-700 border-sky-300 font-bold shrink-0">교과</Badge>
                                  </div>
                                  <span className="text-xs text-slate-700 font-medium truncate mt-0.5">{user ? user.name : item.email}</span>
                                </div>
                                <Button variant="ghost" size="icon" className="h-5 w-5 text-destructive shrink-0 hover:bg-red-50 hover:text-red-600 rounded p-0" onClick={() => {
                                  updateAndSaveOrg(prev => {
                                    const prevList = prev.gradeSubjects?.[item.gradeStr] || [];
                                    const updatedList = prevList.filter(e => e.toLowerCase() !== item.email.toLowerCase());
                                    const newGradeSubjects = { ...(prev.gradeSubjects || {}), [item.gradeStr]: updatedList };
                                    return { ...prev, gradeSubjects: newGradeSubjects };
                                  }, `${item.gradeStr}학년 교과 배정이 삭제되었습니다.`);
                                }}>
                                  <Trash2 className="h-3 w-3" />
                                </Button>
                              </div>
                              <div className="flex items-center justify-between border-t border-sky-200/50 pt-1.5 mt-0.5">
                                <span className="text-[10px] text-sky-700 font-medium truncate">{item.gradeStr}학년 교과</span>
                              </div>
                            </div>
                          );
                        }

                        return (
                          <div key={item.key} className="flex flex-col bg-white border border-slate-200 p-2 sm:p-2.5 rounded-xl shadow-2xs space-y-2 justify-between hover:border-indigo-200 transition-colors">
                            <div className="flex justify-between items-start gap-1">
                              <div className="flex flex-col overflow-hidden min-w-0">
                                <div className="flex items-center gap-1">
                                  <span className="font-bold text-xs text-slate-900 truncate">{item.gradeStr}학년 {item.classStr}반</span>
                                  {isGradeHead && (
                                    <Badge className="text-[9px] px-1 py-0 bg-indigo-600 text-white font-bold shrink-0">부장</Badge>
                                  )}
                                </div>
                                <span className="text-xs text-slate-700 font-medium truncate mt-0.5">{user ? user.name : item.email}</span>
                              </div>
                              <Button variant="ghost" size="icon" className="h-5 w-5 text-destructive shrink-0 hover:bg-red-50 hover:text-red-600 rounded p-0" onClick={() => {
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
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            </div>
                            <div className="flex items-center justify-between border-t border-slate-100 pt-1.5 mt-0.5">
                              <Label className="text-[11px] flex items-center gap-1 cursor-pointer select-none">
                                <Switch 
                                  className="scale-75 origin-left"
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
                                <span className={`text-[10px] font-bold transition-colors ${isGradeHead ? 'text-indigo-600' : 'text-muted-foreground'}`}>부장</span>
                              </Label>
                            </div>
                          </div>
                        );
                      });
                    })()}
                  </div>

                  {/* 담임 및 교과 배정 일괄 등록 카드 */}
                  <Card className="border shadow-2xs bg-slate-50/50 mt-4 rounded-xl">
                    <CardHeader className="p-4 pb-2">
                      <CardTitle className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                        <FileUp className="w-3.5 h-3.5 text-indigo-600" />
                        담임 및 학년 교과 엑셀 일괄 등록
                      </CardTitle>
                      <CardDescription className="text-[11px]">
                        엑셀 파일(.xlsx)로 여러 반의 담임 및 학년 교과(반 컬럼에 '교과' 입력) 교사를 한 번에 업로드합니다.
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="p-4 pt-0 flex flex-col sm:flex-row items-center gap-2">
                      <Input type="file" accept=".xlsx, .xls" onChange={handleHomeroomFileSelect} className="h-8 flex-grow text-xs bg-white rounded-lg"/>
                      <div className="flex gap-1.5 w-full sm:w-auto shrink-0">
                        <Button onClick={handleDownloadHomeroomTemplate} variant="outline" size="sm" className="h-8 text-xs font-semibold rounded-lg">
                          <Download className="mr-1.5 h-3.5 w-3.5"/>
                          양식
                        </Button>
                        <Button onClick={handleHomeroomUpload} disabled={isUploading || !selectedHomeroomFile} size="sm" className="h-8 text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg">
                          {isUploading ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin"/> : <FileUp className="mr-1.5 h-3.5 w-3.5"/>}
                          업로드
                        </Button>
                      </div>
                    </CardContent>
                  </Card>

                  {/* 동명이인 발생 시 선택 UI */}
                  {duplicatePendingRows.length > 0 && (
                    <div className="space-y-3 p-4 bg-amber-50 border border-amber-200 rounded-xl">
                      <div className="flex items-center justify-between">
                        <h5 className="font-bold text-amber-800 text-xs">⚠️ 동명이인 발생 — 교사 선택 필요</h5>
                        <span className="text-xs text-amber-600 font-bold">{duplicatePendingRows.length}건</span>
                      </div>
                      <p className="text-[11px] text-amber-700">아래 반에 배정하려는 이름의 교사가 여러 명입니다. 정확한 교사를 직접 선택해 주세요.</p>
                      <div className="space-y-2">
                        {duplicatePendingRows.map(row => {
                          const key = `${row.grade}-${row.class}`;
                          return (
                            <div key={key} className="flex items-center gap-3 bg-white rounded-lg border border-amber-200 px-3 py-2">
                              <span className="text-xs font-bold text-gray-900 shrink-0 w-20">{row.grade}학년 {row.class}반</span>
                              <Select
                                value={duplicateResolvedEmails[key] || ''}
                                onValueChange={(val) => setDuplicateResolvedEmails(prev => ({ ...prev, [key]: val }))}
                              >
                                <SelectTrigger className="h-8 flex-1 text-xs">
                                  <SelectValue placeholder="교사를 선택해 주세요" />
                                </SelectTrigger>
                                <SelectContent>
                                  {row.candidates.map(c => (
                                    <SelectItem key={c.email} value={c.email} className="text-xs">
                                      {c.name} ({c.email}) — {c.role}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              {row.isHead && (
                                <span className="text-[10px] font-bold text-indigo-700 bg-indigo-50 border border-indigo-200 px-1.5 py-0.5 rounded shrink-0">학년부장</span>
                              )}
                            </div>
                          );
                        })}
                      </div>
                      <div className="flex gap-2 justify-end pt-1">
                        <Button variant="outline" size="sm" onClick={() => { setDuplicatePendingRows([]); setDuplicateResolvedEmails({}); }} className="h-7 text-xs">
                          취소
                        </Button>
                        <Button size="sm" onClick={handleResolveDuplicates} className="h-7 text-xs font-bold bg-amber-600 hover:bg-amber-700 text-white">
                          선택 완료 ({Object.keys(duplicateResolvedEmails).length}/{duplicatePendingRows.length}건)
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* ========================================================================= */}
              {/* 3. 하위 탭: 부서 관리 (부서 선택 탭 + 집중형 와이드 관리 카드)               */}
              {/* ========================================================================= */}
              {orgSubTab === 'departments' && (
                <div className="space-y-2.5">
                  {/* 상단 제어 바: 부서 드롭다운 선택 + 새 부서 추가 폼 */}
                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2 bg-indigo-50/60 p-2 px-3 rounded-xl border border-indigo-100 shadow-2xs">
                    {/* 좌측: 부서 선택 드롭다운 */}
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <FolderKanban className="w-4 h-4 text-indigo-700 shrink-0" />
                      <Label className="text-xs font-bold text-indigo-950 whitespace-nowrap shrink-0">부서 선택:</Label>
                      
                      {(org.departments || []).length === 0 ? (
                        <span className="text-xs text-slate-400 font-medium">등록된 부서가 없습니다. 우측에서 부서를 추가하세요.</span>
                      ) : (
                        <Select 
                          value={activeDept?.id || ''} 
                          onValueChange={(val) => setSelectedDeptId(val)}
                        >
                          <SelectTrigger className="w-48 sm:w-56 h-8 text-xs font-bold bg-white border-indigo-200 text-slate-900 shadow-2xs">
                            <SelectValue placeholder="부서 선택" />
                          </SelectTrigger>
                          <SelectContent className="max-h-72">
                            {(org.departments || []).map(dept => (
                              <SelectItem key={dept.id} value={dept.id} className="text-xs font-semibold">
                                <div className="flex items-center justify-between gap-3 w-full">
                                  <span>{dept.name}</span>
                                  <span className="text-[10px] text-slate-400 font-normal">
                                    (부원 {dept.memberEmails.length}명)
                                  </span>
                                </div>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}

                      {activeDept && (
                        <Badge variant="outline" className="hidden sm:inline-flex text-[10px] font-bold bg-white text-indigo-700 border-indigo-200 px-2 py-0.5 shadow-2xs shrink-0">
                          전체 {(org.departments || []).length}개 부서 중 선택됨
                        </Badge>
                      )}
                    </div>

                    {/* 우측: 새 부서 추가 인라인 폼 */}
                    <div className="flex items-center gap-1.5 shrink-0 pt-1 sm:pt-0 sm:border-l sm:border-indigo-100 sm:pl-3">
                      <Input 
                        placeholder="새 부서명 (예: 교무기획부)" 
                        value={newDeptName} 
                        onChange={e => setNewDeptName(e.target.value)} 
                        onKeyDown={e => e.key === 'Enter' && addDepartment()}
                        className="h-8 text-xs w-full sm:w-40 bg-white border-indigo-200"
                      />
                      <Button onClick={addDepartment} size="sm" className="h-8 text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white shrink-0 px-2.5 shadow-2xs">
                        <PlusCircle className="w-3.5 h-3.5 mr-1" />
                        부서 추가
                      </Button>
                    </div>
                  </div>

                  {/* 선택된 부서 단일 와이드 관리 카드 */}
                  {(() => {
                    if (!activeDept) {
                      return (
                        <div className="p-6 text-center bg-slate-50 border border-dashed rounded-xl space-y-1">
                          <FolderKanban className="w-6 h-6 mx-auto text-slate-300" />
                          <p className="text-xs font-bold text-slate-600">등록된 부서가 없습니다.</p>
                          <p className="text-[11px] text-slate-400">상단에서 부서명을 입력하여 부서를 생성해 주세요.</p>
                        </div>
                      );
                    }

                    const dept = activeDept;

                    // 교원의 담당 업무 목록을 계산하는 헬퍼 함수
                    const getStaffDutyRoles = (email: string): string[] => {
                      if (!email) return [];
                      const emailLower = email.toLowerCase();
                      const matchedDuties: string[] = [];

                      if (org.peTeachers?.some(m => m.toLowerCase() === emailLower)) matchedDuties.push('학교체육');
                      if (org.afterschoolManagers?.some(m => m.toLowerCase() === emailLower)) matchedDuties.push('방과후학교');
                      if (org.busManagers?.some(m => m.toLowerCase() === emailLower)) matchedDuties.push('스쿨버스');
                      if (org.systemManagers?.some(m => m.toLowerCase() === emailLower)) matchedDuties.push('시스템설정');
                      if (org.healthTeachers?.some(m => m.toLowerCase() === emailLower)) matchedDuties.push('보건교사');
                      if (org.specialTeachers?.some(m => m.toLowerCase() === emailLower)) matchedDuties.push('특수교사');
                      if (org.librarianTeachers?.some(m => m.toLowerCase() === emailLower)) matchedDuties.push('사서교사');

                      (org.customDutyRoles || []).forEach(duty => {
                        if (duty.teacherEmails?.some(m => m.toLowerCase() === emailLower)) {
                          matchedDuties.push(duty.roleName);
                        }
                      });

                      return matchedDuties;
                    };

                    // 1. 학교 전체의 업무 직책 목록 (기본 7종 + 커스텀 직책)
                    const allSystemDuties: { id: string; name: string; deptName?: string }[] = [
                      { id: 'pe', name: '학교체육', deptName: org.dutyRoleDepts?.['pe'] },
                      { id: 'health', name: '보건교사', deptName: org.dutyRoleDepts?.['health'] },
                      { id: 'afterschool', name: '방과후학교', deptName: org.dutyRoleDepts?.['afterschool'] },
                      { id: 'bus', name: '스쿨버스', deptName: org.dutyRoleDepts?.['bus'] },
                      { id: 'system', name: '시스템설정', deptName: org.dutyRoleDepts?.['system'] },
                      { id: 'special', name: '특수교사', deptName: org.dutyRoleDepts?.['special'] },
                      { id: 'librarian', name: '사서교사', deptName: org.dutyRoleDepts?.['librarian'] },
                      ...(org.customDutyRoles || []).map(duty => ({
                        id: duty.id,
                        name: duty.roleName,
                        deptName: duty.deptName
                      }))
                    ];

                    // 2. 해당 부서 소관으로 연결된 업무 직책 목록
                    const deptDuties = allSystemDuties.filter(d => d.deptName === dept.name);
                    const otherDuties = allSystemDuties.filter(d => d.deptName !== dept.name);

                    const headDutyList = dept.headEmail ? getStaffDutyRoles(dept.headEmail) : [];

                    return (
                      <Card className="border border-slate-200 shadow-2xs rounded-xl overflow-hidden bg-white">
                        {/* 컴팩트 단일 헤더 바: 부서명 + 소관업무 요약 + 소관업무 배속 드롭다운 + 삭제 버튼 */}
                        <div className="px-3 py-1.5 bg-slate-50 border-b flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2 flex-wrap min-w-0">
                            <FolderKanban className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                            <span className="text-xs font-bold text-slate-900">{dept.name}</span>
                            <Badge variant="outline" className="text-[10px] px-1.5 py-0 bg-white text-indigo-700 border-indigo-200 font-bold">
                              소속 부원 {dept.memberEmails.length}명
                            </Badge>

                            {/* 소관 업무 배지 목록 */}
                            {deptDuties.length > 0 ? (
                              <div className="flex items-center gap-1 ml-1 flex-wrap">
                                <span className="text-[10px] text-slate-400 font-semibold">소관:</span>
                                {deptDuties.map(duty => (
                                  <Badge key={duty.id} variant="outline" className="text-[9px] font-bold bg-indigo-50 text-indigo-700 border-indigo-200 px-1.5 py-0">
                                    {duty.name}
                                  </Badge>
                                ))}
                              </div>
                            ) : (
                              <span className="text-[10px] text-slate-400 font-medium ml-1">소관 업무 미배속</span>
                            )}
                          </div>

                          <div className="flex items-center gap-1.5 shrink-0">
                            {/* 부서 소관 업무 추가/가져오기 드롭다운 */}
                            <Select onValueChange={(val) => {
                              if (val === '__CREATE_DEPT_DUTY__') {
                                const customName = window.prompt('이 부서에 새로 등록할 소관 업무명을 입력해 주세요:');
                                if (customName?.trim()) {
                                  createAndAssignCustomDuty(customName.trim(), dept.name);
                                }
                              } else {
                                if (['afterschool', 'bus', 'system', 'health', 'special', 'librarian'].includes(val)) {
                                  setOrg(prev => ({
                                    ...prev,
                                    dutyRoleDepts: { ...(prev.dutyRoleDepts || {}), [val]: dept.name }
                                  }));
                                } else {
                                  setOrg(prev => ({
                                    ...prev,
                                    customDutyRoles: (prev.customDutyRoles || []).map(r => r.id === val ? { ...r, deptName: dept.name } : r)
                                  }));
                                }
                              }
                            }}>
                              <SelectTrigger className="h-6 px-2 text-[10px] bg-white hover:bg-slate-100 border-slate-200 text-slate-700 font-bold">
                                <SelectValue placeholder="+ 소관 업무 추가" />
                              </SelectTrigger>
                              <SelectContent>
                                {otherDuties.length > 0 && (
                                  <SelectGroup>
                                    <SelectLabel className="text-[10px] text-slate-500 font-bold">학교 업무 직책 가져오기</SelectLabel>
                                    {otherDuties.map(d => (
                                      <SelectItem key={d.id} value={d.id} className="text-xs">
                                        {d.name} {d.deptName ? `(${d.deptName})` : '(미배속)'}
                                      </SelectItem>
                                    ))}
                                  </SelectGroup>
                                )}
                                <SelectSeparator />
                                <SelectItem value="__CREATE_DEPT_DUTY__" className="text-xs font-bold text-indigo-600">
                                  + 새 소관 업무 직접 등록...
                                </SelectItem>
                              </SelectContent>
                            </Select>

                            <Button 
                              variant="ghost" 
                              size="sm" 
                              className="h-6 text-[11px] text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded px-1.5" 
                              onClick={() => deleteDepartment(dept.id)} 
                              title="부서 삭제"
                            >
                              <Trash2 className="h-3 w-3 mr-1" />
                              삭제
                            </Button>
                          </div>
                        </div>

                        <CardContent className="p-2.5 space-y-2">
                          {/* 2단 그리드: 좌측 부장 교사 관리 / 우측 소속 부원 관리 (가로 병렬 배치) */}
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5">
                            {/* 1. 좌측 (1열): 부장 교사 관리 카드 */}
                            <div className="border border-slate-200 rounded-lg p-2.5 bg-slate-50/50 space-y-2 flex flex-col justify-between">
                              <div className="space-y-1.5">
                                <div className="flex items-center justify-between gap-1.5">
                                  <Label className="text-xs font-bold text-slate-800 shrink-0 whitespace-nowrap">
                                    부장 교사
                                  </Label>

                                  {/* 부장 교사 업무 배정 드롭다운 (항상 표시) */}
                                  {dept.headEmail && (
                                    <Select onValueChange={(val) => {
                                      if (val === '__CREATE_HEAD_DUTY__') {
                                        const customName = window.prompt('부장 교사에게 새로 부여할 담당 업무명을 입력해 주세요:');
                                        if (customName?.trim()) {
                                          createAndAssignCustomDuty(customName.trim(), dept.name, dept.headEmail!);
                                        }
                                      } else {
                                        assignDutyToMember(val, dept.headEmail!, dept.name);
                                      }
                                    }}>
                                      <SelectTrigger className="h-5 w-28 px-1.5 text-[10px] bg-indigo-50 hover:bg-indigo-100 border-indigo-200 rounded-md text-indigo-700 font-bold shrink-0">
                                        <SelectValue placeholder="+ 업무 배정" />
                                      </SelectTrigger>
                                      <SelectContent className="max-h-60">
                                        {deptDuties.length > 0 && (
                                          <SelectGroup>
                                            <SelectLabel className="text-[10px] text-indigo-900 font-bold">부서 소관 업무</SelectLabel>
                                            {deptDuties.filter(d => !headDutyList.includes(d.name)).map(d => (
                                              <SelectItem key={d.id} value={d.id} className="text-xs font-semibold">
                                                {d.name}
                                              </SelectItem>
                                            ))}
                                          </SelectGroup>
                                        )}
                                        {otherDuties.filter(d => !headDutyList.includes(d.name)).length > 0 && (
                                          <SelectGroup>
                                            <SelectLabel className="text-[10px] text-slate-500 font-bold">학교 전체 업무</SelectLabel>
                                            {otherDuties.filter(d => !headDutyList.includes(d.name)).map(d => (
                                              <SelectItem key={d.id} value={d.id} className="text-xs">
                                                {d.name} {d.deptName ? `(${d.deptName})` : ''}
                                              </SelectItem>
                                            ))}
                                          </SelectGroup>
                                        )}
                                        <SelectSeparator />
                                        <SelectItem value="__CREATE_HEAD_DUTY__" className="text-xs font-bold text-indigo-600">
                                          + 새 업무 직접 입력...
                                        </SelectItem>
                                      </SelectContent>
                                    </Select>
                                  )}
                                </div>

                                <SearchableUserSelect
                                  users={facultyUsers}
                                  value={dept.headEmail || ''}
                                  onSelect={(val) => updateDeptHead(dept.id, val)}
                                  placeholder="부장 교사 선택"
                                  allowUnassign={true}
                                  unassignLabel="선택 안됨 (해제)"
                                  triggerClassName="h-7 text-xs bg-white font-medium border-slate-200 w-full"
                                  panelWidthClass="w-64"
                                />

                                {/* 부장 교사의 담당 업무 배지 목록 */}
                                {headDutyList.length > 0 && (
                                  <div className="flex flex-wrap gap-1 pt-0.5">
                                    {headDutyList.map(duty => (
                                      <span key={duty} className="inline-flex items-center gap-1 bg-indigo-100 text-indigo-800 border border-indigo-200 text-[10px] font-bold px-1.5 py-0.2 rounded-full">
                                        {duty}
                                        <button
                                          type="button"
                                          onClick={() => removeDutyFromMember(duty, dept.headEmail!)}
                                          className="text-indigo-500 hover:text-indigo-800 font-bold ml-0.5"
                                          title="업무 해제"
                                        >
                                          ×
                                        </button>
                                      </span>
                                    ))}
                                  </div>
                                )}
                              </div>
                            </div>

                            {/* 2. 우측 (2열): 소속 부원 배정 및 소관 업무 지정 카드 */}
                            <div className="md:col-span-2 border border-slate-200 rounded-lg p-2.5 bg-white space-y-2 flex flex-col justify-between">
                              <div className="space-y-1.5">
                                <div className="flex items-center justify-between gap-2">
                                  <Label className="text-xs font-bold text-slate-800 shrink-0">
                                    소속 부원 배정 ({dept.memberEmails.length}명)
                                  </Label>
                                  <div className="w-48 sm:w-56">
                                    <SearchableUserSelect
                                      users={facultyUsers}
                                      placeholder="부원 추가 선택..."
                                      clearOnSelect={true}
                                      triggerClassName="h-7 text-xs bg-slate-50 border-slate-200"
                                      panelWidthClass="w-56"
                                      onSelect={(val) => addDeptMember(dept.id, val)}
                                    />
                                  </div>
                                </div>

                                {/* 소속 부원 카드 목록 (2열 그리드) */}
                                {dept.memberEmails.length === 0 ? (
                                  <div className="p-4 text-center bg-slate-50 rounded-lg border border-dashed text-slate-400 text-xs">
                                    소속된 부원이 없습니다. 우측 상단에서 부원을 추가해 주세요.
                                  </div>
                                ) : (
                                  <div className="grid grid-cols-1 md:grid-cols-2 gap-1.5 max-h-[340px] overflow-y-auto pr-0.5">
                                    {dept.memberEmails.map(email => {
                                      const cleanEmail = String(email || '').toLowerCase().trim();
                                      const u = users.find(user => user.email?.toLowerCase().trim() === cleanEmail);
                                      const staffDuties = getStaffDutyRoles(cleanEmail);

                                      return (
                                        <div key={email} className="flex items-center justify-between gap-1.5 bg-slate-50 hover:bg-slate-100/80 border border-slate-200 p-1.5 px-2 rounded-md transition-colors">
                                          <div className="space-y-0.5 min-w-0 flex-1">
                                            <div className="flex items-center gap-1.5">
                                              <span className="font-bold text-xs text-slate-900 truncate">{u ? u.name : email}</span>
                                              <span className="text-[10px] text-slate-400 truncate">{u ? u.role : ''}</span>
                                            </div>
                                            
                                            {/* 담당 업무 배지 */}
                                            <div className="flex items-center gap-1 flex-wrap">
                                              {staffDuties.length > 0 ? (
                                                staffDuties.map(duty => (
                                                  <span key={duty} className="inline-flex items-center gap-1 bg-white text-indigo-700 border border-indigo-200 text-[9px] font-bold px-1.5 py-0 rounded shadow-2xs">
                                                    {duty}
                                                    <button
                                                      type="button"
                                                      onClick={() => removeDutyFromMember(duty, email)}
                                                      className="text-indigo-500 hover:text-indigo-800 font-bold ml-0.5"
                                                      title="업무 해제"
                                                    >
                                                      ×
                                                    </button>
                                                  </span>
                                                ))
                                              ) : (
                                                <span className="text-[10px] text-slate-400 font-normal">업무 미지정</span>
                                              )}
                                            </div>
                                          </div>

                                          <div className="flex items-center gap-1 shrink-0">
                                            {/* 소관 업무 배정 드롭다운 (항상 선명하게 노출) */}
                                            <Select onValueChange={(val) => {
                                              if (val === '__CREATE_MEMBER_DUTY__') {
                                                const customName = window.prompt(`${u ? u.name : email} 교사에게 새로 부여할 담당 업무명을 입력해 주세요 (예: 방과후 강사 관리, 출결 관리):`);
                                                if (customName?.trim()) {
                                                  createAndAssignCustomDuty(customName.trim(), dept.name, email);
                                                }
                                              } else {
                                                assignDutyToMember(val, email, dept.name);
                                              }
                                            }}>
                                              <SelectTrigger className="h-5.5 w-22 px-1 text-[9px] bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border-indigo-200 rounded font-bold">
                                                <SelectValue placeholder="+ 업무 배정" />
                                              </SelectTrigger>
                                              <SelectContent className="max-h-60">
                                                {deptDuties.length > 0 && (
                                                  <SelectGroup>
                                                    <SelectLabel className="text-[10px] text-indigo-900 font-bold">부서 소관 업무</SelectLabel>
                                                    {deptDuties.filter(d => !staffDuties.includes(d.name)).map(d => (
                                                      <SelectItem key={d.id} value={d.id} className="text-xs font-semibold">
                                                        {d.name}
                                                      </SelectItem>
                                                    ))}
                                                  </SelectGroup>
                                                )}
                                                {otherDuties.filter(d => !staffDuties.includes(d.name)).length > 0 && (
                                                  <SelectGroup>
                                                    <SelectLabel className="text-[10px] text-slate-500 font-bold">학교 전체 업무 직책</SelectLabel>
                                                    {otherDuties.filter(d => !staffDuties.includes(d.name)).map(d => (
                                                      <SelectItem key={d.id} value={d.id} className="text-xs">
                                                        {d.name} {d.deptName ? `(${d.deptName})` : ''}
                                                      </SelectItem>
                                                    ))}
                                                  </SelectGroup>
                                                )}
                                                <SelectSeparator />
                                                <SelectItem value="__CREATE_MEMBER_DUTY__" className="text-xs font-bold text-indigo-600">
                                                  + 새 업무 직접 입력...
                                                </SelectItem>
                                              </SelectContent>
                                            </Select>

                                            <button 
                                              onClick={() => removeDeptMember(dept.id, email)} 
                                              className="text-slate-400 hover:text-rose-600 font-bold p-0.5 rounded hover:bg-white" 
                                              title="부원 제외"
                                            >
                                              <X className="w-3.5 h-3.5" />
                                            </button>
                                          </div>
                                        </div>
                                      );
                                    })}
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })()}

                  {/* 부서 일괄 등록 엑셀 카드 */}
                  <Card className="border shadow-2xs bg-slate-50/50 rounded-xl">
                    <CardHeader className="p-4 pb-2">
                      <CardTitle className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                        <FileUp className="w-3.5 h-3.5 text-indigo-600" />
                        부서 엑셀 일괄 등록
                      </CardTitle>
                      <CardDescription className="text-[11px]">
                        엑셀 파일로 부서 목록과 부장/부원을 일괄 등록합니다. (부서명 / 이름 / 직책)
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="p-4 pt-0 flex flex-col sm:flex-row items-center gap-2">
                      <Input type="file" accept=".xlsx, .xls" onChange={handleDeptFileSelect} className="h-8 flex-grow text-xs bg-white rounded-lg"/>
                      <div className="flex gap-1.5 w-full sm:w-auto shrink-0">
                        <Button onClick={handleDownloadDeptTemplate} variant="outline" size="sm" className="h-8 text-xs font-semibold rounded-lg">
                          <Download className="mr-1.5 h-3.5 w-3.5"/>
                          양식
                        </Button>
                        <Button onClick={handleDeptUpload} disabled={isUploading || !selectedDeptFile} size="sm" className="h-8 text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg">
                          {isUploading ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin"/> : <FileUp className="mr-1.5 h-3.5 w-3.5"/>}
                          업로드
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              )}
            </div>

            <div className="shrink-0 px-6 py-3.5 border-t flex justify-end bg-slate-50/70">
              <Button onClick={handleOrgSave} disabled={isSaving} className="h-9 px-4 text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl shadow-xs">
                {isSaving ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Save className="mr-1.5 h-4 w-4" />}
                조직도 저장
              </Button>
            </div>
          </TabsContent>

          <TabsContent value="delegation" className="flex-1 min-h-0 mt-0 data-[state=active]:flex flex-col">
            <div className="flex-1 min-h-0 px-6 py-3 flex flex-col gap-2.5">
              {/* 위임전결규정 엑셀 일괄 등록 - 컴팩트 슬림 바 */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-2 px-3 bg-slate-50 border rounded-lg shrink-0">
                <div className="flex items-center gap-1.5 shrink-0">
                  <FileText className="w-4 h-4 text-indigo-600 shrink-0" />
                  <span className="text-xs font-bold text-slate-800">위임전결규정 엑셀 일괄 등록</span>
                </div>
                <div className="flex items-center gap-1.5 flex-1 max-w-xl">
                  <Input type="file" accept=".xlsx, .xls" onChange={handleDelegationFileSelect} className="h-7 text-xs bg-white flex-grow"/>
                  <Button onClick={handleDownloadDelegationTemplate} variant="outline" size="sm" className="h-7 text-xs shrink-0 px-2.5">
                    <Download className="mr-1.5 h-3.5 w-3.5"/>
                    양식 다운로드
                  </Button>
                  <Button onClick={handleDelegationUpload} disabled={isUploading || !selectedDelegationFile} size="sm" className="h-7 text-xs shrink-0 px-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-medium">
                    {isUploading ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin"/> : <FileUp className="mr-1.5 h-3.5 w-3.5"/>}
                    엑셀 업로드
                  </Button>
                </div>
              </div>

              {/* 전결규정 목록 헤더 툴바 */}
              <div className="flex justify-between items-center px-0.5 shrink-0">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-bold text-slate-800">전결규정 목록 ({delegationRules.length})</h3>
                  <Badge variant="outline" className="text-[10px] text-muted-foreground py-0">변경 시 실시간 자동 저장</Badge>
                </div>
                <div className="flex items-center gap-1.5">
                  <Button variant="outline" size="sm" onClick={handleResetDefaultDelegation} className="h-7 text-xs px-2.5">
                    <RotateCcw className="mr-1.5 h-3 w-3" />
                    기본 규정 초기화 (8종)
                  </Button>
                  <Button variant="outline" size="sm" onClick={addDelegationRule} className="h-7 text-xs px-2.5 bg-primary/5 hover:bg-primary/10 text-primary border-primary/20">
                    <PlusCircle className="mr-1.5 h-3 w-3" />
                    새 규정 추가
                  </Button>
                </div>
              </div>

              {/* 전결규정 목록 테이블 (남은 모달 전체 영역 확보) */}
              <div className="border rounded-md flex-1 min-h-0 overflow-auto bg-white shadow-2xs">
                <Table className="min-w-[860px]">
                  <TableHeader className="sticky top-0 bg-slate-50 z-10 shadow-2xs">
                    <TableRow>
                      <TableHead className="w-[100px] py-2 text-xs">대분류</TableHead>
                      <TableHead className="w-[150px] py-2 text-xs">문서명(중분류)</TableHead>
                      <TableHead className="w-[130px] py-2 text-xs">소분류/조건</TableHead>
                      <TableHead className="w-[135px] py-2 text-xs">중간 결재자</TableHead>
                      <TableHead className="w-[150px] py-2 text-xs">최종 결재권자 (전결)</TableHead>
                      <TableHead className="min-w-[160px] py-2 text-xs">결재선 미리보기</TableHead>
                      <TableHead className="w-[45px] py-2 text-right text-xs">삭제</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {delegationRules.map((rule, index) => (
                      <TableRow key={rule.id || index} className="hover:bg-slate-50/70">
                        {/* 1. 대분류 드롭다운 */}
                        <TableCell className="py-1.5 px-2">
                          <Select 
                            value={rule.mainType || ''} 
                            onValueChange={(val) => handleMainTypeChange(index, val)}
                          >
                            <SelectTrigger className="h-7 text-xs bg-white px-2 font-semibold text-slate-800 border-slate-200">
                              <SelectValue placeholder="대분류 선택" />
                            </SelectTrigger>
                            <SelectContent>
                              {delegationStandards.map(std => (
                                <SelectItem key={std.mainType} value={std.mainType} className="text-xs font-medium">
                                  {std.mainType}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </TableCell>

                        {/* 2. 문서명(중분류) 드롭다운 (선택된 대분류 기반 필터링) */}
                        <TableCell className="py-1.5 px-2">
                          {(() => {
                            const curStandard = delegationStandards.find(x => x.mainType === rule.mainType) || 
                                                delegationStandards.find(x => x.subTypes.some(s => s.name === rule.subType));
                            const subOptions = curStandard?.subTypes || [];

                            return (
                              <Select 
                                value={rule.subType || ''} 
                                onValueChange={(val) => handleSubTypeChange(index, val)}
                                disabled={subOptions.length === 0}
                              >
                                <SelectTrigger className="h-7 text-xs bg-white px-2 font-bold text-slate-800 border-slate-200">
                                  <SelectValue placeholder="문서명 선택" />
                                </SelectTrigger>
                                <SelectContent>
                                  {subOptions.map(sub => (
                                    <SelectItem key={sub.name} value={sub.name} className="text-xs font-bold">
                                      {sub.name}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            );
                          })()}
                        </TableCell>

                        {/* 3. 소분류/조건 드롭다운 (선택된 문서명 기반 세부조건 연동) */}
                        <TableCell className="py-1.5 px-2">
                          {(() => {
                            const curStandard = delegationStandards.find(x => x.mainType === rule.mainType) || 
                                                delegationStandards.find(x => x.subTypes.some(s => s.name === rule.subType));
                            const curSub = curStandard?.subTypes.find(x => x.name === rule.subType);
                            const detailOptions = curSub?.detailTypes || (rule.detailType ? [rule.detailType] : []);

                            return (
                              <Select 
                                value={rule.detailType || ''} 
                                onValueChange={(val) => handleDelegationUpdate(index, 'detailType', val)}
                                disabled={detailOptions.length === 0}
                              >
                                <SelectTrigger className="h-7 text-xs bg-white px-2 text-slate-700 border-slate-200">
                                  <SelectValue placeholder="조건 선택" />
                                </SelectTrigger>
                                <SelectContent>
                                  {detailOptions.map(d => (
                                    <SelectItem key={d} value={d} className="text-xs font-medium">
                                      {d}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            );
                          })()}
                        </TableCell>
                        <TableCell className="py-1.5 px-2">
                          <Select value={rule.intermediateApprover || 'NONE'} onValueChange={(val) => handleDelegationUpdate(index, 'intermediateApprover', val)}>
                            <SelectTrigger className="h-7 text-xs bg-white px-2"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="NONE">없음 (바로 최종결재)</SelectItem>
                              <SelectItem value="GRADE_HEAD">학년부장</SelectItem>
                              <SelectItem value="ACADEMIC_HEAD">교무부장</SelectItem>
                              <SelectItem value="DEPT_HEAD">담당부장</SelectItem>
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell className="py-1.5 px-2">
                          <Select value={rule.finalApprover} onValueChange={(val) => handleDelegationUpdate(index, 'finalApprover', val)}>
                            <SelectTrigger className="h-7 text-xs bg-white px-2 font-semibold text-primary"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="GRADE_HEAD">학년부장 (전결)</SelectItem>
                              <SelectItem value="ACADEMIC_HEAD">교무부장 (전결)</SelectItem>
                              <SelectItem value="DEPT_HEAD">담당부장 (전결)</SelectItem>
                              <SelectItem value="VP">교감 (전결)</SelectItem>
                              <SelectItem value="PRINCIPAL">교장 (결재)</SelectItem>
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell className="py-1.5 px-2">
                          <Badge variant="secondary" className="font-sans text-[11px] bg-slate-100 text-slate-700 border border-slate-200 py-0.5 px-2 whitespace-nowrap">
                            {renderApprovalLinePreview(rule)}
                          </Badge>
                        </TableCell>
                        <TableCell className="py-1.5 px-2 text-right">
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive/90" onClick={() => deleteDelegationRule(index)}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>

            <div className="shrink-0 px-6 py-2.5 border-t flex justify-end bg-slate-50/70">
              <Button onClick={handleDelegationSave} disabled={isSaving} className="h-8 px-4 text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg">
                {isSaving ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Save className="mr-1.5 h-3.5 w-3.5" />}
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
                      <div className="bg-slate-50 border border-slate-200 p-3 rounded-xl text-xs space-y-2">
                        <div className="font-bold text-slate-800 flex flex-wrap items-center gap-1.5">
                          <span className="text-indigo-600 font-semibold">[필수 입력 항목]</span>
                          <span className="bg-indigo-100 text-indigo-800 px-2 py-0.5 rounded font-mono text-[11px]">
                            이메일, 이름, 직책, 학년, 부서
                          </span>
                        </div>
                        <div className="text-slate-600 text-[11px] leading-relaxed space-y-1">
                          <p>• <b>학년 자동 인식</b>: '3학년', '3학년부', '3' 등으로 입력 시 해당 학년 조직도에 자동 편성됩니다.</p>
                          <p>• <b>부서 자동 매칭</b>: '교무', '교무기획' 등으로 입력 시 '교무기획부' 등 실제 부서로 자동 연결 및 부원으로 등록됩니다.</p>
                          <p>• <b>단독 소속</b>: 전담교사 등 학년 소속이 없는 경우 '학년' 칸을 비워두시면 부서에만 편성됩니다.</p>
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
                {(() => {
                  const teacherCount = users.filter(u => isFacultyMember(u, deptMemberSet)).length;
                  const studentCount = users.filter(u => !isFacultyMember(u, deptMemberSet)).length;

                  return (
                    <div className="flex justify-between items-center px-1 shrink-0 mb-2">
                        <TabsList className="grid grid-cols-2 w-[340px]">
                          <TabsTrigger value="teachers">교직원 ({teacherCount})</TabsTrigger>
                          <TabsTrigger value="students">학생 계정 ({studentCount})</TabsTrigger>
                        </TabsList>
                        <div className="flex items-center gap-2">
                          {userSubTab === 'students' && (
                            <div className="flex items-center gap-2 px-2.5 py-1 bg-slate-50 border rounded-md shadow-2xs">
                              <Label htmlFor="require-parent-pin-toggle" className="text-xs font-semibold text-slate-700 cursor-pointer whitespace-nowrap select-none">
                                학부모 PIN 인증 사용
                              </Label>
                              <Switch
                                id="require-parent-pin-toggle"
                                checked={config.requireParentPin !== false}
                                onCheckedChange={async (checked) => {
                                  setConfig(prev => ({ ...prev, requireParentPin: checked }));
                                  const res = await saveDocConfig({ requireParentPin: checked });
                                  if (res.success) {
                                    toast({
                                      title: checked ? 'PIN 인증 활성화' : 'PIN 인증 비활성화 (생략 모드)',
                                      description: checked
                                        ? '학부모 최초 로그인 시 PIN 등록 및 신청서 제출 시 PIN 입력 인증이 적용됩니다.'
                                        : '학부모 PIN 번호 입력 과정이 모두 생략됩니다. 신청서 제출 시 확인 메시지가 표시됩니다.'
                                    });
                                  } else {
                                    toast({ variant: 'destructive', title: '설정 저장 실패', description: res.error });
                                  }
                                }}
                              />
                            </div>
                          )}
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
                  );
                })()}

                <TabsContent value="teachers" className="flex-1 min-h-0 data-[state=active]:flex flex-col border rounded-md overflow-hidden">
                  {/* 교직원 검색 입력 */}
                  <div className="p-2 border-b bg-background sticky top-0 z-20">
                    <Input
                      placeholder="이름, 이메일, 부서로 검색..."
                      value={teacherTabQuery}
                      onChange={(e) => setTeacherTabQuery(e.target.value)}
                      className="h-8 text-sm"
                    />
                  </div>
                  <div className="overflow-y-auto flex-1">
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
                                <div className="flex gap-1.5">
                                  <Input 
                                      placeholder="학년 (예: 3학년)" 
                                      value={newUser.grade || ''} 
                                      onChange={(e) => setNewUser(p => ({ ...p, grade: e.target.value }))}
                                      className="h-8 w-24 text-xs"
                                  />
                                  <Input 
                                      placeholder="부서 (예: 교무기획부)" 
                                      value={newUser.dept || ''} 
                                      onChange={(e) => setNewUser(p => ({ ...p, dept: e.target.value }))}
                                      className="h-8 flex-1 text-xs"
                                  />
                                </div>
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
                      {(() => {
                         return users.filter(user => {
                           if (!isFacultyMember(user, deptMemberSet)) return false;
                           if (!teacherTabQuery.trim()) return true;
                           const q = teacherTabQuery.trim().toLowerCase();
                           return (user.name || '').toLowerCase().includes(q) ||
                             (user.email || '').toLowerCase().includes(q) ||
                             (user.dept || '').toLowerCase().includes(q) ||
                             (user.role || '').toLowerCase().includes(q);
                         }).map(user => (
                           <TableRow key={user.email}>
                             <TableCell>
                             <div className="flex items-center gap-1.5 flex-wrap">
                               <span className="font-medium">{user.name}</span>
                               {user.isManualFaculty || user.registrationSource === 'manual_faculty' ? (
                                 <Badge variant="secondary" className="bg-purple-100 text-purple-800 border-purple-300 text-[10px] px-1.5 py-0 font-bold">
                                   교직원 (수동등록)
                                 </Badge>
                               ) : (
                                 <Badge variant="secondary" className="bg-indigo-50 text-indigo-700 border-indigo-200 text-[10px] px-1.5 py-0 font-bold">
                                   교직원
                                 </Badge>
                               )}
                             </div>
                             <div className="text-xs text-muted-foreground">{user.email}</div>
                             </TableCell>
                          <TableCell className="text-xs">
                            <div className="flex flex-wrap items-center gap-1.5 max-w-[260px]">
                              {user.grade && (
                                <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 text-[11px] font-semibold px-2 py-0.5">
                                  {user.grade}
                                </Badge>
                              )}
                              {user.dept && (
                                <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 text-[11px] font-semibold px-2 py-0.5">
                                  {user.dept}
                                </Badge>
                              )}
                              {!user.grade && !user.dept && (
                                <span className="text-slate-500 font-medium">
                                  {getUserDepartmentOrClass(user.email, org) || '-'}
                                </span>
                              )}
                            </div>
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
                      {(() => {
                        return <TableCell className="text-right">
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive/90" onClick={() => confirmDeleteUser(user)}>
                              <Trash2 className="h-4 w-4" />
                          </Button>
                        </TableCell>;
                      })()}
                      </TableRow>
                      ));
                      })()}
                      </TableBody>
                      </Table>
                       </div>
                </TabsContent>

                <TabsContent value="students" className="flex-1 min-h-0 data-[state=active]:flex flex-col border rounded-md mt-0">
                  {/* ── 학생 탭 필터 바 ── */}
                  {(() => {
                    const allStudents = users.filter(u => !isFacultyMember(u, deptMemberSet));
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
                                    <TableCell className="text-center text-xs">
                                      {user.hashedPin ? (
                                        <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 text-[11px] font-semibold px-1.5 py-0.5">
                                          설정완료
                                        </Badge>
                                      ) : (
                                        <Badge variant="outline" className="bg-slate-50 text-slate-500 border-slate-200 text-[11px] font-medium px-1.5 py-0.5">
                                          미설정
                                        </Badge>
                                      )}
                                    </TableCell>
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
                                      {user.hashedPin ? (
                                        <div className="flex items-center justify-center gap-1">
                                          <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 text-[11px] font-semibold px-1.5 py-0.5">
                                            설정완료
                                          </Badge>
                                          <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-6 w-6 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded"
                                            title="학부모 PIN 번호 초기화"
                                            onClick={() => setResetPinTarget(user)}
                                          >
                                            <RotateCcw className="h-3 w-3" />
                                          </Button>
                                        </div>
                                      ) : (
                                        <Badge variant="outline" className="bg-slate-50 text-slate-500 border-slate-200 text-[11px] font-medium px-1.5 py-0.5">
                                          미설정
                                        </Badge>
                                      )}
                                    </TableCell>
                                    <TableCell className="text-right">
                                      <div className="flex justify-end gap-1">
                                        {user.hashedPin && (
                                          <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-8 w-8 text-amber-600 hover:text-amber-700 hover:bg-amber-50"
                                            title="학부모 PIN 번호 초기화"
                                            onClick={() => setResetPinTarget(user)}
                                          >
                                            <KeyRound className="h-4 w-4" />
                                          </Button>
                                        )}
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

        {/* 업무 역할별 기능 및 문서 접근 권한 설정 모달 */}
        <DutyRolePermissionModal
          open={permissionModalState.open}
          onOpenChange={(open) => setPermissionModalState(prev => ({ ...prev, open }))}
          roleName={permissionModalState.roleName}
          permissions={permissionModalState.permissions}
          onSave={(newPerms) => handleSaveRolePermission(permissionModalState.roleKey, newPerms)}
        />

        {/* 표준 일과 수업 시간대(교시별 시간표) 설정 모달 */}
        <Dialog open={isPeriodModalOpen} onOpenChange={setIsPeriodModalOpen}>
          <DialogContent className="max-w-xl max-h-[85vh] overflow-y-auto p-5 sm:p-6 rounded-2xl">
            <DialogHeader className="border-b pb-3">
              <div className="flex items-center justify-between">
                <DialogTitle className="text-base sm:text-lg font-black text-slate-900 flex items-center gap-2">
                  <Clock className="w-5 h-5 text-indigo-600" />
                  표준 일과 수업 시간대 설정
                </DialogTitle>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleResetDefaultPeriodSchedules}
                  className="h-7 text-xs font-bold text-slate-600 border-slate-300 hover:bg-slate-100"
                >
                  <RotateCcw className="w-3 h-3 mr-1" />
                  기본 9개 시간표 복원
                </Button>
              </div>
              <DialogDescription className="text-xs text-slate-500">
                1교시~6교시, 점심시간, 방과후 등 교내 표준 일과 시간표를 설정합니다. 체육행사, 방과후수업 등 모든 배정표 프리셋으로 연동됩니다.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-2 text-xs">
              {/* 새 교시 추가 폼 */}
              <div className="p-3 bg-indigo-50/60 rounded-xl border border-indigo-200 space-y-2">
                <span className="font-bold text-indigo-950 text-xs flex items-center gap-1.5">
                  <PlusCircle className="w-4 h-4 text-indigo-600" />
                  새 교시 / 시간대 추가
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-end">
                  <div className="sm:col-span-5">
                    <Label className="text-[10px] text-slate-600 font-semibold mb-1 block">교시 / 활동 명칭</Label>
                    <Input
                      placeholder="예: 1교시, 점심시간, 방과후 1차시"
                      value={newPeriodName}
                      onChange={e => setNewPeriodName(e.target.value)}
                      className="h-8 text-xs bg-white font-bold"
                    />
                  </div>
                  <div className="sm:col-span-3">
                    <Label className="text-[10px] text-slate-600 font-semibold mb-1 block">시작 시간</Label>
                    <Input
                      type="time"
                      value={newPeriodStart}
                      onChange={e => setNewPeriodStart(e.target.value)}
                      className="h-8 text-xs bg-white font-mono"
                    />
                  </div>
                  <div className="sm:col-span-3">
                    <Label className="text-[10px] text-slate-600 font-semibold mb-1 block">종료 시간</Label>
                    <Input
                      type="time"
                      value={newPeriodEnd}
                      onChange={e => setNewPeriodEnd(e.target.value)}
                      className="h-8 text-xs bg-white font-mono"
                    />
                  </div>
                  <div className="sm:col-span-1">
                    <Button
                      type="button"
                      size="sm"
                      onClick={handleAddPeriodSchedule}
                      className="h-8 w-full text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white"
                    >
                      추가
                    </Button>
                  </div>
                </div>
              </div>

              {/* 등록된 교시 시간표 목록 */}
              <div className="border border-slate-200 rounded-xl overflow-hidden shadow-2xs divide-y divide-slate-100 bg-white">
                {(academicCal.periodSchedules || DEFAULT_PERIOD_SCHEDULES).map((period, idx) => (
                  <div key={period.id} className="p-2.5 flex items-center justify-between gap-2 hover:bg-slate-50/50 text-xs">
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <Badge variant="outline" className="text-[10px] font-mono px-1.5 py-0 bg-slate-50 text-slate-600 shrink-0">
                        #{idx + 1}
                      </Badge>
                      <Input
                        value={period.name}
                        onChange={e => handleUpdatePeriodSchedule(period.id, 'name', e.target.value)}
                        className="h-7 text-xs font-bold w-36 bg-white shrink-0"
                        placeholder="교시명"
                      />
                      <div className="flex items-center gap-1">
                        <Input
                          type="time"
                          value={period.startTime}
                          onChange={e => handleUpdatePeriodSchedule(period.id, 'startTime', e.target.value)}
                          className="h-7 text-xs font-mono w-24 bg-white"
                        />
                        <span className="text-slate-400 font-bold text-xs">~</span>
                        <Input
                          type="time"
                          value={period.endTime}
                          onChange={e => handleUpdatePeriodSchedule(period.id, 'endTime', e.target.value)}
                          className="h-7 text-xs font-mono w-24 bg-white"
                        />
                      </div>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDeletePeriodSchedule(period.id)}
                      className="h-7 w-7 p-0 text-slate-400 hover:text-rose-600 hover:bg-rose-50 shrink-0"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>

            <DialogFooter className="border-t pt-3 flex items-center justify-end">
              <Button
                type="button"
                size="sm"
                onClick={() => setIsPeriodModalOpen(false)}
                className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs"
              >
                완료 (설정 적용)
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* 학부모 PIN 번호 초기화 확인 모달 */}
        <AlertDialog open={!!resetPinTarget} onOpenChange={(open) => !open && setResetPinTarget(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle className="flex items-center gap-2">
                <KeyRound className="h-5 w-5 text-amber-600" />
                학부모 PIN 번호 초기화
              </AlertDialogTitle>
              <AlertDialogDescription className="space-y-2 text-xs text-slate-600">
                <span className="block font-bold text-slate-900 text-sm">
                  {resetPinTarget?.studentName || resetPinTarget?.name} 학생 (학부모: {resetPinTarget?.parentName || '학부모'})
                </span>
                <span>
                  해당 학생 계정의 등록된 PIN 번호를 초기화하시겠습니까?
                  초기화하면 학부모가 다음에 로그인할 때 핀 번호 최초 등록 화면이 다시 나타납니다.
                </span>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={isResettingPin}>취소</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleConfirmResetPin}
                disabled={isResettingPin}
                className="bg-amber-600 hover:bg-amber-700 text-white font-bold"
              >
                {isResettingPin && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
                초기화 실행
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </DialogContent>
    </Dialog>
  );
}
