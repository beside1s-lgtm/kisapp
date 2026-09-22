'use client';

import type { Dispatch, SetStateAction } from 'react';
import { useMemo } from 'react';
import {
  Briefcase,
  Building2,
  Download,
  FileUp,
  FolderKanban,
  GraduationCap,
  Info,
  Loader2,
  PlusCircle,
  RotateCcw,
  Save,
  ShieldCheck,
  Tag,
  Trash2,
  UserCheck,
  X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
  SelectGroup,
  SelectLabel,
  SelectSeparator,
} from '@/components/ui/select';
import { TabsContent } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import { syncAllUsersToOrgStructure } from '@/lib/services/userService';
import { SearchableUserSelect, DEFAULT_ROLE_PERMISSIONS } from '../settings-modal';
import type { OrgStructure, UserProfile, CustomDutyRole, DutyRolePermission } from '@/lib/types';

export type OrgSubTab = 'leadership' | 'duties' | 'grades' | 'departments';

interface DuplicatePendingRow {
  grade: string;
  class: string;
  isHead: boolean;
  candidates: UserProfile[];
}

interface NewHomeroomState {
  grade: string;
  class: string;
  email: string;
  isGradeHead: boolean;
  roleType: 'homeroom' | 'subject';
}

/**
 * "조직도 설정" 탭 (학교 리더십 / 업무 담당 설정 / 학년별 담임 및 교과 / 부서 관리).
 *
 * settings-modal.tsx의 TabsContent(value="org") 블록을 그대로 옮긴 것으로,
 * org 상태와 저장/추가/삭제 로직은 전부 부모(SettingsModal)에 남아 있고
 * 이 컴포넌트는 순수하게 마크업만 담당한다 (동작 변경 없음). 프롭 이름을
 * 원래 지역 변수/핸들러 이름과 동일하게 맞춰, JSX 본문은 원본과 동일하다.
 */
export interface OrgSettingsTabProps {
  org: OrgStructure;
  setOrg: Dispatch<SetStateAction<OrgStructure>>;
  orgSubTab: OrgSubTab;
  setOrgSubTab: (tab: OrgSubTab) => void;

  users: UserProfile[];
  facultyUsers: UserProfile[];
  toast: (opts: { title?: string; description?: string; variant?: 'destructive' }) => void;

  updateAndSaveOrg: (updater: (prev: OrgStructure) => OrgStructure, successMessage?: string) => void;
  handleOrgSave: () => void;
  isSaving: boolean;

  // 학년별 담임/교과
  selectedGradeView: string;
  setSelectedGradeView: (value: string) => void;
  newHomeroom: NewHomeroomState;
  setNewHomeroom: (updater: NewHomeroomState | ((prev: NewHomeroomState) => NewHomeroomState)) => void;
  newSubjectCategoryName: string;
  setNewSubjectCategoryName: (value: string) => void;
  handleHomeroomFileSelect: (e: React.ChangeEvent<HTMLInputElement>) => void;
  handleHomeroomUpload: () => void;
  handleDownloadHomeroomTemplate: () => void;
  selectedHomeroomFile: File | null;
  isUploading: boolean;
  duplicatePendingRows: DuplicatePendingRow[];
  setDuplicatePendingRows: (rows: DuplicatePendingRow[]) => void;
  duplicateResolvedEmails: { [key: string]: string };
  setDuplicateResolvedEmails: (updater: { [key: string]: string } | ((prev: { [key: string]: string }) => { [key: string]: string })) => void;
  handleResolveDuplicates: () => void;

  // 업무 담당 설정
  newCustomDutyRoleName: string;
  setNewCustomDutyRoleName: (value: string) => void;
  newCustomDutyDept: string;
  setNewCustomDutyDept: (value: string) => void;
  openPermissionModal: (roleKey: string, roleName: string, permissions?: DutyRolePermission) => void;

  // 부서 관리
  selectedDeptId: string;
  setSelectedDeptId: (value: string) => void;
  newDeptName: string;
  setNewDeptName: (value: string) => void;
  addDepartment: () => void;
  deleteDepartment: (id: string) => void;
  updateDeptHead: (deptId: string, email: string) => void;
  addDeptMember: (deptId: string, email: string) => void;
  removeDeptMember: (deptId: string, email: string) => void;
  assignDutyToMember: (dutyKeyOrId: string, email: string, deptName?: string) => void;
  createAndAssignCustomDuty: (roleName: string, deptName: string, email?: string) => void;
  removeDutyFromMember: (dutyKeyOrId: string, email: string) => void;
  handleDeptFileSelect: (e: React.ChangeEvent<HTMLInputElement>) => void;
  handleDeptUpload: () => void;
  handleDownloadDeptTemplate: () => void;
  selectedDeptFile: File | null;
}

export function OrgSettingsTab({
  org,
  setOrg,
  orgSubTab,
  setOrgSubTab,
  users,
  facultyUsers,
  toast,
  updateAndSaveOrg,
  handleOrgSave,
  isSaving,
  selectedGradeView,
  setSelectedGradeView,
  newHomeroom,
  setNewHomeroom,
  newSubjectCategoryName,
  setNewSubjectCategoryName,
  handleHomeroomFileSelect,
  handleHomeroomUpload,
  handleDownloadHomeroomTemplate,
  selectedHomeroomFile,
  isUploading,
  duplicatePendingRows,
  setDuplicatePendingRows,
  duplicateResolvedEmails,
  setDuplicateResolvedEmails,
  handleResolveDuplicates,
  newCustomDutyRoleName,
  setNewCustomDutyRoleName,
  newCustomDutyDept,
  setNewCustomDutyDept,
  openPermissionModal,
  selectedDeptId,
  setSelectedDeptId,
  newDeptName,
  setNewDeptName,
  addDepartment,
  deleteDepartment,
  updateDeptHead,
  addDeptMember,
  removeDeptMember,
  assignDutyToMember,
  createAndAssignCustomDuty,
  removeDutyFromMember,
  handleDeptFileSelect,
  handleDeptUpload,
  handleDownloadDeptTemplate,
  selectedDeptFile,
}: OrgSettingsTabProps) {
  const activeDept = useMemo(() => {
    if (!org.departments || org.departments.length === 0) return null;
    return org.departments.find(d => d.id === selectedDeptId) || org.departments[0];
  }, [org.departments, selectedDeptId]);

  return (
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
            {/* 학교 리더십 (교장, 교감, 행정실장, 교무부장) */}
            <div className="space-y-3 bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
              <div className="flex items-center justify-between border-b pb-2">
                <div className="flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-indigo-600" />
                  <h4 className="font-bold text-base text-slate-900">학교 리더십 (학교장 / 교감 / 행정실장 / 교무부장)</h4>
                </div>
                <span className="text-xs text-slate-400">최종 결재선 및 학교 총괄 관리자</span>
              </div>

              <div className="bg-amber-50/80 border border-amber-200/80 rounded-xl p-2.5 text-xs text-amber-900 flex items-start gap-2 shadow-2xs">
                <Info className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <strong>수기 결재 및 공문서 결재선 안내:</strong> 학교장(교장), 행정실장 등 전산 시스템 계정이 없는 직책은 아래 <strong>문서 표출 성명</strong>을 직접 입력해 두시면, 공문서 기안 및 인쇄 시 결재란에 해당 성명이 정상적으로 자동 표출됩니다.
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 pt-1">
                {/* 1. 학교장 (교장) */}
                <div className="space-y-2 p-3 rounded-xl bg-slate-50/80 border border-slate-200">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-bold text-slate-800 flex items-center gap-1">
                      <Building2 className="w-3.5 h-3.5 text-indigo-600" />
                      학교장 (교장)
                    </Label>
                    <span className="text-[10px] text-slate-400 font-medium">최종 결재</span>
                  </div>
                  <div className="space-y-1">
                    <span className="text-[11px] text-slate-500 font-medium">교직원 계정 선택</span>
                    <SearchableUserSelect
                      users={facultyUsers}
                      value={org.principal}
                      onSelect={(val) => {
                        const selected = facultyUsers.find(u => u.email.toLowerCase() === val.toLowerCase());
                        updateAndSaveOrg(p => ({
                          ...p,
                          principal: val,
                          principalName: selected?.name || p.principalName || ''
                        }), '학교장(교장) 설정이 저장되었습니다.');
                      }}
                      placeholder="선택 안됨"
                      allowUnassign={true}
                      unassignLabel="선택 안됨 (해제)"
                      triggerClassName="h-8 text-xs bg-white"
                      panelWidthClass="w-64"
                    />
                  </div>
                  <div className="space-y-1">
                    <span className="text-[11px] text-slate-600 font-semibold">문서 표출 성명 (직접 입력)</span>
                    <Input
                      placeholder="학교장 성명 입력 (예: 홍길동)"
                      value={org.principalName || ''}
                      onChange={(e) => {
                        const val = e.target.value;
                        setOrg(p => ({ ...p, principalName: val }));
                      }}
                      onBlur={(e) => {
                        updateAndSaveOrg(p => ({ ...p, principalName: e.target.value.trim() }), '학교장 성명이 저장되었습니다.');
                      }}
                      className="h-8 text-xs bg-white border-slate-300 focus-visible:border-indigo-400"
                    />
                  </div>
                </div>

                {/* 2. 교감 */}
                <div className="space-y-2 p-3 rounded-xl bg-slate-50/80 border border-slate-200">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-bold text-slate-800">교감</Label>
                    <span className="text-[10px] text-slate-400 font-medium">전결 / 중간</span>
                  </div>
                  <div className="space-y-1">
                    <span className="text-[11px] text-slate-500 font-medium">교직원 계정 선택</span>
                    <SearchableUserSelect
                      users={facultyUsers}
                      value={org.vicePrincipal}
                      onSelect={(val) => {
                        const selected = facultyUsers.find(u => u.email.toLowerCase() === val.toLowerCase());
                        updateAndSaveOrg(p => ({
                          ...p,
                          vicePrincipal: val,
                          vicePrincipalName: selected?.name || p.vicePrincipalName || ''
                        }), '교감 설정이 저장되었습니다.');
                      }}
                      placeholder="선택 안됨"
                      allowUnassign={true}
                      unassignLabel="선택 안됨 (해제)"
                      triggerClassName="h-8 text-xs bg-white"
                      panelWidthClass="w-64"
                    />
                  </div>
                  <div className="space-y-1">
                    <span className="text-[11px] text-slate-600 font-semibold">문서 표출 성명 (선택)</span>
                    <Input
                      placeholder="교감 성명 직접 입력"
                      value={org.vicePrincipalName || ''}
                      onChange={(e) => {
                        const val = e.target.value;
                        setOrg(p => ({ ...p, vicePrincipalName: val }));
                      }}
                      onBlur={(e) => {
                        updateAndSaveOrg(p => ({ ...p, vicePrincipalName: e.target.value.trim() }), '교감 성명이 저장되었습니다.');
                      }}
                      className="h-8 text-xs bg-white border-slate-300 focus-visible:border-indigo-400"
                    />
                  </div>
                </div>

                {/* 3. 행정실장 */}
                <div className="space-y-2 p-3 rounded-xl bg-amber-50/50 border border-amber-200/80">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-bold text-amber-950 flex items-center gap-1">
                      <Building2 className="w-3.5 h-3.5 text-amber-600" />
                      행정실장
                    </Label>
                    <span className="text-[10px] text-amber-700 font-semibold">수기 결재 / 협조</span>
                  </div>
                  <div className="space-y-1">
                    <span className="text-[11px] text-slate-500 font-medium">교직원 계정 선택</span>
                    <SearchableUserSelect
                      users={facultyUsers}
                      value={org.administrativeHead}
                      onSelect={(val) => {
                        const selected = facultyUsers.find(u => u.email.toLowerCase() === val.toLowerCase());
                        updateAndSaveOrg(p => ({
                          ...p,
                          administrativeHead: val,
                          administrativeHeadName: selected?.name || p.administrativeHeadName || ''
                        }), '행정실장 설정이 저장되었습니다.');
                      }}
                      placeholder="선택 안됨"
                      allowUnassign={true}
                      unassignLabel="선택 안됨 (해제)"
                      triggerClassName="h-8 text-xs bg-white"
                      panelWidthClass="w-64"
                    />
                  </div>
                  <div className="space-y-1">
                    <span className="text-[11px] text-amber-950 font-semibold">문서 표출 성명 (직접 입력)</span>
                    <Input
                      placeholder="행정실장 성명 입력 (예: 김행정)"
                      value={org.administrativeHeadName || ''}
                      onChange={(e) => {
                        const val = e.target.value;
                        setOrg(p => ({ ...p, administrativeHeadName: val }));
                      }}
                      onBlur={(e) => {
                        updateAndSaveOrg(p => ({ ...p, administrativeHeadName: e.target.value.trim() }), '행정실장 성명이 저장되었습니다.');
                      }}
                      className="h-8 text-xs bg-white border-amber-300 focus-visible:border-amber-500"
                    />
                  </div>
                </div>

                {/* 4. 교무부장 */}
                <div className="space-y-2 p-3 rounded-xl bg-indigo-50/40 border border-indigo-200/80">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-bold text-indigo-950">교무부장</Label>
                    <span className="text-[10px] text-indigo-700 font-semibold">중간 결재</span>
                  </div>
                  <div className="space-y-1">
                    <span className="text-[11px] text-slate-500 font-medium">교직원 계정 선택</span>
                    <SearchableUserSelect
                      users={facultyUsers}
                      value={org.academicHead}
                      onSelect={(val) => {
                        const selected = facultyUsers.find(u => u.email.toLowerCase() === val.toLowerCase());
                        updateAndSaveOrg(p => ({
                          ...p,
                          academicHead: val,
                          academicHeadName: selected?.name || p.academicHeadName || ''
                        }), '교무부장 설정이 저장되었습니다.');
                      }}
                      placeholder="선택 안됨"
                      allowUnassign={true}
                      unassignLabel="선택 안됨 (해제)"
                      triggerClassName="h-8 text-xs bg-white border-indigo-200"
                      panelWidthClass="w-64"
                    />
                  </div>
                  <div className="space-y-1">
                    <span className="text-[11px] text-indigo-950 font-semibold">문서 표출 성명 (선택)</span>
                    <Input
                      placeholder="교무부장 성명 직접 입력"
                      value={org.academicHeadName || ''}
                      onChange={(e) => {
                        const val = e.target.value;
                        setOrg(p => ({ ...p, academicHeadName: val }));
                      }}
                      onBlur={(e) => {
                        updateAndSaveOrg(p => ({ ...p, academicHeadName: e.target.value.trim() }), '교무부장 성명이 저장되었습니다.');
                      }}
                      className="h-8 text-xs bg-white border-indigo-300 focus-visible:border-indigo-500"
                    />
                  </div>
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
                if (org.volunteerManager && org.volunteerManager.toLowerCase() === emailLower) matchedDuties.push('봉사활동');

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
                { id: 'volunteer', name: '봉사활동', deptName: org.dutyRoleDepts?.['volunteer'] },
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
  );
}
