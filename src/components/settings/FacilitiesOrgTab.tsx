'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Building2,
  Plus,
  Trash2,
  Edit3,
  RotateCcw,
  Search,
  CheckCircle2,
  UserCheck,
  ArrowRight,
  Save,
  School,
  Sparkles,
  Layers,
  HelpCircle,
  Loader2,
} from 'lucide-react';
import type { SchoolFacility, SchoolFacilityCategory } from '@/lib/safety/types';
import {
  getSchoolFacilities,
  saveSchoolFacility,
  saveSchoolFacilitiesBatch,
  deleteSchoolFacility,
  resetDefaultSchoolFacilities,
  invalidateSchoolFacilitiesCache,
} from '@/lib/services/safetyService';
import { getUsersDirectory, isFacultyMember } from '@/lib/services/userService';
import type { UserProfile } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { CURRENT_SCHOOL_YEAR } from '@/lib/services/handoverService';

export function FacilitiesOrgTab() {
  const { toast } = useToast();
  const currentYear = CURRENT_SCHOOL_YEAR; // 2026
  const nextYear = currentYear + 1; // 2027

  const [facilities, setFacilities] = useState<SchoolFacility[]>([]);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  // 검색 및 필터
  const [searchTerm, setSearchTerm] = useState('');
  const [gradeFilter, setGradeFilter] = useState<string>('all');

  // 차년도 학급 및 시설 매핑 모드 토글 (요구사항 5번)
  const [showNextYear, setShowNextYear] = useState<boolean>(false);

  // 개별 신규 추가/수정 모달 다이얼로그 상태
  const [editingFacility, setEditingFacility] = useState<Partial<SchoolFacility> | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);

  // 1. 데이터 로드 (시설 목록 및 순수 교직원 명단)
  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [facList, allUsers] = await Promise.all([
        getSchoolFacilities(true),
        getUsersDirectory(),
      ]);

      setFacilities(facList);

      // 학생 및 학부모 100% 완전 배제한 순수 교직원만 선별
      const staffOnly = (allUsers || []).filter((u) => {
        if (!u || !u.email) return false;
        const emailLower = u.email.toLowerCase().trim();
        const roleLower = (u.role || '').toLowerCase().trim();

        if (
          roleLower.includes('학생') ||
          roleLower.includes('student') ||
          roleLower.includes('학부모') ||
          roleLower.includes('parent') ||
          roleLower === 'none' ||
          emailLower.includes('student') ||
          emailLower.includes('parent') ||
          /^\d{2,8}[a-zA-Z0-9._-]*@/i.test(emailLower) ||
          Boolean(u.studentNumber) ||
          Boolean(u.hashedPin)
        ) {
          return false;
        }

        return isFacultyMember(u);
      });

      staffOnly.sort((a, b) => (a.name || '').localeCompare(b.name || '', 'ko'));
      setUsers(staffOnly);
    } catch (e) {
      console.error('[FacilitiesOrgTab] loadData error:', e);
      toast({
        title: '데이터 로드 실패',
        description: '학교 시설 목록을 불러오는 중 오류가 발생했습니다.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // 2. 검색 및 학년 필터링된 시설 목록
  const filteredFacilities = useMemo(() => {
    return facilities.filter((fac) => {
      const q = searchTerm.trim().toLowerCase();
      const matchSearch =
        !q ||
        fac.name.toLowerCase().includes(q) ||
        fac.fullName.toLowerCase().includes(q) ||
        (fac.assignedTeacherName && fac.assignedTeacherName.toLowerCase().includes(q)) ||
        (fac.nextYearName && fac.nextYearName.toLowerCase().includes(q)) ||
        (fac.nextYearTeacherName && fac.nextYearTeacherName.toLowerCase().includes(q)) ||
        fac.location.toLowerCase().includes(q);

      if (!matchSearch) return false;
      if (gradeFilter === 'all') return true;
      if (gradeFilter === 'special') return fac.category === 'special';
      if (gradeFilter === 'common') return fac.category === 'common' || fac.category === 'admin';
      return String(fac.grade) === gradeFilter;
    });
  }, [facilities, searchTerm, gradeFilter]);

  // 3. 인라인 변경 핸들러 (당해년도 담당 교사 즉시 변경)
  const handleAssignTeacherInline = (facilityId: string, teacherEmail: string) => {
    const selectedUser = users.find((u) => u.email.toLowerCase() === teacherEmail.toLowerCase());
    setFacilities((prev) =>
      prev.map((f) => {
        if (f.id !== facilityId) return f;
        return {
          ...f,
          assignedTeacherEmail: selectedUser?.email || '',
          assignedTeacherName: selectedUser?.name || '',
          assignedTeacherRole: selectedUser?.role || '교사',
        };
      })
    );
  };

  // 4. 인라인 변경 핸들러 (차년도 시설명 즉시 변경)
  const handleNextYearNameChange = (facilityId: string, nextName: string) => {
    setFacilities((prev) =>
      prev.map((f) => {
        if (f.id !== facilityId) return f;
        return {
          ...f,
          nextYearName: nextName,
          nextYearFullName: nextName,
          targetYear: currentYear,
          nextYear: nextYear,
        };
      })
    );
  };

  // 5. 인라인 변경 핸들러 (차년도 담당 교사 즉시 변경)
  const handleNextYearTeacherChange = (facilityId: string, teacherEmail: string) => {
    const selectedUser = users.find((u) => u.email.toLowerCase() === teacherEmail.toLowerCase());
    setFacilities((prev) =>
      prev.map((f) => {
        if (f.id !== facilityId) return f;
        return {
          ...f,
          nextYearTeacherEmail: selectedUser?.email || '',
          nextYearTeacherName: selectedUser?.name || '',
          targetYear: currentYear,
          nextYear: nextYear,
        };
      })
    );
  };

  // 6. 전체 목록 일괄 저장 (당해년도 + 차년도 매핑 동시 저장)
  const handleSaveAllBatch = async () => {
    setIsSaving(true);
    try {
      const res = await saveSchoolFacilitiesBatch(facilities);
      invalidateSchoolFacilitiesCache();
      if (res.success) {
        toast({
          title: '시설 및 학급 정보 저장 완료',
          description: `전체 ${res.count}개 시설·학급 및 ${nextYear}학년도 차년도 매핑이 안전하게 저장되었습니다.`,
        });
      } else {
        throw new Error(res.error || '저장 실패');
      }
    } catch (e: any) {
      toast({
        title: '저장 실패',
        description: e.message || '저장 중 오류가 발생했습니다.',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  // 7. 개별 신규 추가 다이얼로그 오픈
  const handleOpenNew = () => {
    const nextOrder = (facilities.length + 1) * 10;
    setEditingFacility({
      name: '',
      fullName: '',
      category: 'classroom',
      grade: 1,
      classNum: 1,
      location: '본관 1층',
      assignedTeacherName: '',
      assignedTeacherEmail: '',
      targetYear: currentYear,
      nextYear: nextYear,
      nextYearName: '',
      nextYearTeacherName: '',
      nextYearTeacherEmail: '',
      order: nextOrder,
      isActive: true,
    });
    setIsFormOpen(true);
  };

  // 8. 개별 수정 다이얼로그 오픈
  const handleEditModal = (fac: SchoolFacility) => {
    setEditingFacility({ ...fac });
    setIsFormOpen(true);
  };

  // 9. 개별 삭제
  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`정말로 "${name}" 시설/학급을 삭제하시겠습니까?`)) return;
    try {
      await deleteSchoolFacility(id);
      setFacilities((prev) => prev.filter((f) => f.id !== id));
      toast({
        title: '삭제 완료',
        description: `"${name}" 시설/학급이 삭제되었습니다.`,
      });
    } catch (e: any) {
      toast({
        title: '삭제 실패',
        description: e.message || '삭제 중 오류가 발생했습니다.',
        variant: 'destructive',
      });
    }
  };

  // 10. 기본 시설 목록 복원
  const handleResetDefaults = async () => {
    if (
      !confirm(
        '학교 공식 기본 시설(1~6학년 전 학급 및 특별실 44개소) 목록으로 복원하시겠습니까? 기존 수정 내용이 덮어쓰여집니다.'
      )
    ) {
      return;
    }
    setIsLoading(true);
    try {
      const resetList = await resetDefaultSchoolFacilities();
      setFacilities(resetList);
      toast({
        title: '기본 시설 복원 완료',
        description: `기본 ${resetList.length}개 학교 시설 및 담당 교사 목록이 복원되었습니다.`,
      });
    } catch (e) {
      toast({
        title: '복원 실패',
        description: '복원 중 오류가 발생했습니다.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  // 11. 개별 저장 처리
  const handleSaveIndividualModal = async () => {
    if (!editingFacility) return;
    if (!editingFacility.name?.trim()) {
      alert('시설(학급)명을 입력해주세요.');
      return;
    }

    const id =
      editingFacility.id ||
      (editingFacility.category === 'classroom'
        ? `fac_${editingFacility.grade}_${editingFacility.classNum}`
        : `fac_special_${Date.now()}`);

    const fullName =
      editingFacility.fullName ||
      (editingFacility.category === 'classroom'
        ? `${editingFacility.grade}학년 ${editingFacility.classNum}반`
        : editingFacility.name || '');

    const dataToSave: SchoolFacility = {
      id,
      name: editingFacility.name || '',
      fullName,
      category: (editingFacility.category as SchoolFacilityCategory) || 'classroom',
      grade: editingFacility.grade ? Number(editingFacility.grade) : undefined,
      classNum: editingFacility.classNum ? Number(editingFacility.classNum) : undefined,
      location: editingFacility.location || '본관',
      assignedTeacherName: editingFacility.assignedTeacherName || '',
      assignedTeacherEmail: editingFacility.assignedTeacherEmail || '',
      assignedTeacherRole: editingFacility.assignedTeacherRole || '교사',
      order: editingFacility.order || 999,
      isActive: editingFacility.isActive ?? true,
      createdAt: editingFacility.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      targetYear: currentYear,
      nextYear: nextYear,
      nextYearName: editingFacility.nextYearName || '',
      nextYearFullName: editingFacility.nextYearName || '',
      nextYearTeacherName: editingFacility.nextYearTeacherName || '',
      nextYearTeacherEmail: editingFacility.nextYearTeacherEmail || '',
    };

    setIsSaving(true);
    try {
      const res = await saveSchoolFacility(dataToSave);
      if (res.success && res.facility) {
        setFacilities((prev) => {
          const idx = prev.findIndex((f) => f.id === id);
          if (idx >= 0) {
            const next = [...prev];
            next[idx] = res.facility!;
            return next;
          }
          return [...prev, res.facility!].sort((a, b) => a.order - b.order);
        });
        setIsFormOpen(false);
        setEditingFacility(null);
        toast({
          title: '저장 완료',
          description: `"${fullName}" 시설/학급 정보가 저장되었습니다.`,
        });
      }
    } catch (e: any) {
      toast({
        title: '저장 실패',
        description: e.message || '저장 중 오류가 발생했습니다.',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* 1. 상단 컨트롤 바 */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 p-3.5 bg-slate-50/80 rounded-xl border border-slate-200">
        <div>
          <div className="flex items-center gap-2">
            <School className="w-5 h-5 text-[#2471B2]" />
            <h3 className="font-bold text-slate-900 text-sm">
              학교 시설 및 학급 관리 ({facilities.length}개소 등록됨)
            </h3>
            <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 text-xs font-semibold">
              {currentYear}학년도 기준
            </Badge>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            학교 내 모든 일반 학급과 특별실을 등록하고 담당 교사를 지정합니다. 학생 안전지도 점검표, 사용자 목록,
            비품 인수인계서에 100% 자동 연동됩니다.
          </p>
        </div>

        {/* 차년도 매핑 스위치 및 일괄 저장 버튼 */}
        <div className="flex flex-wrap items-center gap-2">
          {/* 차년도 학급 및 시설 체크 스위치 (요구사항 5번) */}
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-indigo-50/80 border border-indigo-200 shadow-2xs">
            <Switch
              id="switch-next-year-mapping"
              checked={showNextYear}
              onCheckedChange={setShowNextYear}
            />
            <Label
              htmlFor="switch-next-year-mapping"
              className="text-xs font-bold text-indigo-950 cursor-pointer flex items-center gap-1"
            >
              <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
              <span>차년도({nextYear}년) 학급 및 시설 매핑</span>
            </Label>
          </div>

          <Button
            type="button"
            size="sm"
            onClick={handleOpenNew}
            className="h-8 text-xs font-bold gap-1 bg-white hover:bg-slate-100 text-slate-800 border border-slate-300"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>시설 추가</span>
          </Button>

          <Button
            type="button"
            size="sm"
            onClick={handleResetDefaults}
            variant="ghost"
            className="h-8 text-xs text-slate-500 hover:text-slate-800 gap-1"
            title="기본 시설 목록(44개소)으로 초기화"
          >
            <RotateCcw className="w-3 h-3" />
            <span>기본 복원</span>
          </Button>

          <Button
            type="button"
            size="sm"
            disabled={isSaving}
            onClick={handleSaveAllBatch}
            className="h-8 text-xs font-bold gap-1.5 bg-[#2471B2] hover:bg-[#1f5e94] text-white shadow-2xs"
          >
            {isSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
            <span>{showNextYear ? `${nextYear}년 매핑 일괄 저장` : '시설·학급 일괄 저장'}</span>
          </Button>
        </div>
      </div>

      {/* 2. 차년도 매핑 안내 배너 (활성화 시) */}
      {showNextYear && (
        <div className="p-3 rounded-xl bg-gradient-to-r from-indigo-50 to-purple-50 border border-indigo-200 text-xs text-indigo-900 flex items-start gap-2.5">
          <Sparkles className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
          <div className="flex-1 space-y-1">
            <div className="font-bold">
              ★ {currentYear}학년도 시설/학급 ➔ {nextYear}학년도 차년도 학급 및 인수 교사 연결 모드
            </div>
            <div className="text-slate-600 leading-relaxed">
              각 행의 오른쪽 칸에 <b>{nextYear}학년도 시설명</b>과 <b>차년도 담당 교사(비품 인수자)</b>를 바로
              입력하세요. 비품 인수인계서를 작성할 때 해당 교사의 교실과 후임 인수자가 100% 자동 바인딩됩니다.
            </div>
          </div>
        </div>
      )}

      {/* 3. 검색 및 필터 툴바 */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-2.5">
        <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto">
          {[
            { id: 'all', label: '전체' },
            { id: '1', label: '1학년' },
            { id: '2', label: '2학년' },
            { id: '3', label: '3학년' },
            { id: '4', label: '4학년' },
            { id: '5', label: '5학년' },
            { id: '6', label: '6학년' },
            { id: 'special', label: '특별실' },
            { id: 'common', label: '공용/행정' },
          ].map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => setGradeFilter(f.id)}
              className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-all ${
                gradeFilter === f.id
                  ? 'bg-slate-900 text-white shadow-2xs'
                  : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        <div className="relative w-full sm:w-64">
          <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <Input
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="시설명, 교사명, 위치 검색..."
            className="h-8 pl-8 text-xs bg-white border-slate-300"
          />
        </div>
      </div>

      {/* 4. 시설 및 학급 목록 테이블 */}
      <div className="border border-slate-200 rounded-xl overflow-hidden bg-white shadow-2xs">
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-slate-100/80 text-slate-700 font-bold border-b border-slate-200 uppercase tracking-tight">
              <tr>
                <th className="py-2.5 px-3 w-12 text-center">순번</th>
                <th className="py-2.5 px-3 w-20 text-center">구분</th>
                <th className="py-2.5 px-3 font-semibold text-slate-900">
                  {currentYear}년 시설(학급)명
                </th>
                <th className="py-2.5 px-3 w-48 text-slate-900 font-semibold">
                  {currentYear}년 담당 교사
                </th>
                {showNextYear && (
                  <>
                    <th className="py-2.5 px-1 w-8 text-center text-indigo-500 font-bold">
                      ➔
                    </th>
                    <th className="py-2.5 px-3 font-semibold text-indigo-950 bg-indigo-50/50">
                      {nextYear}년 차년도 시설명
                    </th>
                    <th className="py-2.5 px-3 w-48 font-semibold text-indigo-950 bg-indigo-50/50">
                      {nextYear}년 담당 교사 (인수자)
                    </th>
                  </>
                )}
                <th className="py-2.5 px-3 w-28 text-slate-600">위치</th>
                <th className="py-2.5 px-3 w-20 text-center">관리</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isLoading ? (
                <tr>
                  <td colSpan={showNextYear ? 8 : 6} className="py-12 text-center text-slate-400">
                    <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-[#2471B2]" />
                    시설 및 학급 데이터를 불러오는 중입니다...
                  </td>
                </tr>
              ) : filteredFacilities.length === 0 ? (
                <tr>
                  <td colSpan={showNextYear ? 8 : 6} className="py-12 text-center text-slate-400">
                    검색 조건에 일치하는 시설 또는 학급이 없습니다.
                  </td>
                </tr>
              ) : (
                filteredFacilities.map((fac, idx) => {
                  const isClass = fac.category === 'classroom';
                  return (
                    <tr
                      key={fac.id}
                      className="hover:bg-slate-50/70 transition-colors group"
                    >
                      {/* 순번 */}
                      <td className="py-2 px-3 text-center text-slate-400 font-mono text-[11px]">
                        {idx + 1}
                      </td>

                      {/* 구분 배지 */}
                      <td className="py-2 px-3 text-center">
                        {isClass ? (
                          <Badge
                            variant="outline"
                            className="bg-blue-50 text-blue-700 border-blue-200 text-[10px] px-1.5 py-0 font-bold"
                          >
                            {fac.grade}학년
                          </Badge>
                        ) : fac.category === 'special' ? (
                          <Badge
                            variant="outline"
                            className="bg-amber-50 text-amber-700 border-amber-200 text-[10px] px-1.5 py-0 font-bold"
                          >
                            특별실
                          </Badge>
                        ) : (
                          <Badge
                            variant="outline"
                            className="bg-slate-100 text-slate-700 border-slate-300 text-[10px] px-1.5 py-0 font-bold"
                          >
                            공용/행정
                          </Badge>
                        )}
                      </td>

                      {/* 2026년 시설(학급)명 */}
                      <td className="py-2 px-3 font-bold text-slate-900">
                        <div className="flex items-center gap-1.5">
                          <span>{fac.fullName || fac.name}</span>
                          {!fac.isActive && (
                            <Badge variant="secondary" className="text-[9px] px-1 py-0 bg-slate-200">
                              비활성
                            </Badge>
                          )}
                        </div>
                      </td>

                      {/* 2026년 담당 교사 (인라인 Select) */}
                      <td className="py-2 px-3">
                        <Select
                          value={fac.assignedTeacherEmail || 'UNASSIGNED'}
                          onValueChange={(val) =>
                            handleAssignTeacherInline(fac.id, val === 'UNASSIGNED' ? '' : val)
                          }
                        >
                          <SelectTrigger className="h-7 text-xs bg-white border-slate-200">
                            <SelectValue placeholder="담당 교사 선택">
                              {fac.assignedTeacherName ? (
                                <span className="font-semibold text-slate-800">
                                  {fac.assignedTeacherName}
                                </span>
                              ) : (
                                <span className="text-slate-400">선택 안됨</span>
                              )}
                            </SelectValue>
                          </SelectTrigger>
                          <SelectContent className="max-h-64">
                            <SelectItem value="UNASSIGNED" className="text-slate-400">
                              선택 안됨 (해제)
                            </SelectItem>
                            {users.map((u) => (
                              <SelectItem key={u.email} value={u.email}>
                                {u.name} ({u.role || '교사'}{u.dept ? ` / ${u.dept}` : ''})
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </td>

                      {/* 차년도 ➔ 매핑 (활성화 시 노출) */}
                      {showNextYear && (
                        <>
                          <td className="py-2 px-1 text-center text-indigo-400 font-bold">
                            ➔
                          </td>

                          {/* 2027년 차년도 시설명 입력창 */}
                          <td className="py-2 px-3 bg-indigo-50/30">
                            <Input
                              value={fac.nextYearName ?? fac.name}
                              onChange={(e) => handleNextYearNameChange(fac.id, e.target.value)}
                              placeholder="차년도 시설명 (예: 2학년 1반)"
                              className="h-7 text-xs bg-white border-indigo-200 font-semibold focus-visible:ring-indigo-400"
                            />
                          </td>

                          {/* 2027년 차년도 담당 교사 (인수자 선택) */}
                          <td className="py-2 px-3 bg-indigo-50/30">
                            <Select
                              value={fac.nextYearTeacherEmail || 'UNASSIGNED'}
                              onValueChange={(val) =>
                                handleNextYearTeacherChange(fac.id, val === 'UNASSIGNED' ? '' : val)
                              }
                            >
                              <SelectTrigger className="h-7 text-xs bg-white border-indigo-200 text-indigo-950 font-semibold">
                                <SelectValue placeholder="차년도 인수 교사">
                                  {fac.nextYearTeacherName ? (
                                    <span className="font-bold text-indigo-800 flex items-center gap-1">
                                      <UserCheck className="w-3 h-3 text-indigo-600" />
                                      {fac.nextYearTeacherName}
                                    </span>
                                  ) : (
                                    <span className="text-slate-400 font-normal">미정 (공란)</span>
                                  )}
                                </SelectValue>
                              </SelectTrigger>
                              <SelectContent className="max-h-64">
                                <SelectItem value="UNASSIGNED" className="text-slate-400">
                                  미정 (공란)
                                </SelectItem>
                                {users.map((u) => (
                                  <SelectItem key={u.email} value={u.email}>
                                    {u.name} ({u.role || '교사'}{u.dept ? ` / ${u.dept}` : ''})
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </td>
                        </>
                      )}

                      {/* 위치 */}
                      <td className="py-2 px-3 text-slate-500 text-[11px]">
                        {fac.location || '-'}
                      </td>

                      {/* 관리 버튼 */}
                      <td className="py-2 px-3 text-center">
                        <div className="flex items-center justify-center gap-1 opacity-80 group-hover:opacity-100 transition-opacity">
                          <Button
                            type="button"
                            size="icon"
                            variant="ghost"
                            onClick={() => handleEditModal(fac)}
                            className="h-6 w-6 text-slate-500 hover:text-slate-900"
                            title="수정"
                          >
                            <Edit3 className="w-3 h-3" />
                          </Button>
                          <Button
                            type="button"
                            size="icon"
                            variant="ghost"
                            onClick={() => handleDelete(fac.id, fac.fullName || fac.name)}
                            className="h-6 w-6 text-rose-400 hover:text-rose-600 hover:bg-rose-50"
                            title="삭제"
                          >
                            <Trash2 className="w-3 h-3" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 5. 개별 시설 추가 및 수정 모달 다이얼로그 */}
      <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base font-bold text-slate-900">
              <Building2 className="w-5 h-5 text-[#2471B2]" />
              <span>
                {editingFacility?.id ? '학교 시설/학급 정보 수정' : '신규 시설/학급 등록'}
              </span>
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              교실 또는 시설 정보와 담당 교사, 차년도 매핑 정보를 설정합니다.
            </DialogDescription>
          </DialogHeader>

          {editingFacility && (
            <div className="space-y-3.5 py-2">
              {/* 구분 선택 */}
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-slate-700">시설 구분 *</Label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: 'classroom', label: '일반 학급' },
                    { id: 'special', label: '특별실' },
                    { id: 'common', label: '공용/행정' },
                  ].map((cat) => (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() =>
                        setEditingFacility((p) => ({
                          ...p,
                          category: cat.id as SchoolFacilityCategory,
                        }))
                      }
                      className={`py-1.5 text-xs font-bold rounded-lg border transition-all ${
                        editingFacility.category === cat.id
                          ? 'bg-[#2471B2] text-white border-[#2471B2]'
                          : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      {cat.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* 일반학급일 때 학년/반 입력 */}
              {editingFacility.category === 'classroom' && (
                <div className="grid grid-cols-2 gap-3 p-2.5 bg-blue-50/50 rounded-xl border border-blue-200">
                  <div className="space-y-1">
                    <Label className="text-xs font-semibold text-blue-950">학년 *</Label>
                    <Select
                      value={String(editingFacility.grade || 1)}
                      onValueChange={(val) =>
                        setEditingFacility((p) => ({
                          ...p,
                          grade: Number(val),
                          name: `${p?.classNum || 1}반`,
                          fullName: `${val}학년 ${p?.classNum || 1}반`,
                        }))
                      }
                    >
                      <SelectTrigger className="h-8 text-xs bg-white">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {[1, 2, 3, 4, 5, 6].map((g) => (
                          <SelectItem key={g} value={String(g)}>
                            {g}학년
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1">
                    <Label className="text-xs font-semibold text-blue-950">반 *</Label>
                    <Select
                      value={String(editingFacility.classNum || 1)}
                      onValueChange={(val) =>
                        setEditingFacility((p) => ({
                          ...p,
                          classNum: Number(val),
                          name: `${val}반`,
                          fullName: `${p?.grade || 1}학년 ${val}반`,
                        }))
                      }
                    >
                      <SelectTrigger className="h-8 text-xs bg-white">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {[1, 2, 3, 4, 5, 6, 7, 8].map((c) => (
                          <SelectItem key={c} value={String(c)}>
                            {c}반
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              )}

              {/* 시설명 (특별실/공용실일 때) */}
              {editingFacility.category !== 'classroom' && (
                <div className="space-y-1">
                  <Label className="text-xs font-semibold text-slate-700">시설(특별실) 명칭 *</Label>
                  <Input
                    value={editingFacility.name || ''}
                    onChange={(e) =>
                      setEditingFacility((p) => ({
                        ...p,
                        name: e.target.value,
                        fullName: e.target.value,
                      }))
                    }
                    placeholder="예: 제1과학실, 컴퓨터실, 소체육실, 도서실"
                    className="h-8 text-xs bg-white border-slate-300"
                  />
                </div>
              )}

              {/* 위치 및 순서 */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs font-semibold text-slate-700">위치 (층/건물)</Label>
                  <Input
                    value={editingFacility.location || ''}
                    onChange={(e) => setEditingFacility((p) => ({ ...p, location: e.target.value }))}
                    placeholder="예: 본관 1층, 신관 3층"
                    className="h-8 text-xs bg-white border-slate-300"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs font-semibold text-slate-700">표시 순서</Label>
                  <Input
                    type="number"
                    value={editingFacility.order || 100}
                    onChange={(e) =>
                      setEditingFacility((p) => ({ ...p, order: Number(e.target.value) }))
                    }
                    className="h-8 text-xs bg-white border-slate-300"
                  />
                </div>
              </div>

              {/* 2026년 당해년도 담당 교사 */}
              <div className="space-y-1">
                <Label className="text-xs font-semibold text-slate-700">
                  {currentYear}학년도 담당 교사
                </Label>
                <Select
                  value={editingFacility.assignedTeacherEmail || 'UNASSIGNED'}
                  onValueChange={(val) => {
                    const u = users.find((x) => x.email.toLowerCase() === val.toLowerCase());
                    setEditingFacility((p) => ({
                      ...p,
                      assignedTeacherEmail: u?.email || '',
                      assignedTeacherName: u?.name || '',
                      assignedTeacherRole: u?.role || '교사',
                    }));
                  }}
                >
                  <SelectTrigger className="h-8 text-xs bg-white border-slate-300">
                    <SelectValue placeholder="담당 교사 선택">
                      {editingFacility.assignedTeacherName ? (
                        <span className="font-bold text-slate-900">
                          {editingFacility.assignedTeacherName}
                        </span>
                      ) : (
                        <span className="text-slate-400">선택 안됨</span>
                      )}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent className="max-h-56">
                    <SelectItem value="UNASSIGNED">선택 안됨 (해제)</SelectItem>
                    {users.map((u) => (
                      <SelectItem key={u.email} value={u.email}>
                        {u.name} ({u.role || '교사'}{u.dept ? ` / ${u.dept}` : ''})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* 차년도 매핑 섹션 */}
              <div className="p-3 rounded-xl bg-indigo-50/70 border border-indigo-200 space-y-2.5">
                <div className="font-bold text-xs text-indigo-950 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
                  <span>{nextYear}학년도 차년도 학급/시설 및 인수자 매핑</span>
                </div>
                <div className="grid grid-cols-2 gap-2.5">
                  <div className="space-y-1">
                    <Label className="text-[11px] font-semibold text-indigo-900">
                      {nextYear}년 시설(학급)명
                    </Label>
                    <Input
                      value={editingFacility.nextYearName || ''}
                      onChange={(e) =>
                        setEditingFacility((p) => ({ ...p, nextYearName: e.target.value }))
                      }
                      placeholder={editingFacility.fullName || '차년도 명칭'}
                      className="h-7 text-xs bg-white border-indigo-200"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[11px] font-semibold text-indigo-900">
                      {nextYear}년 담당 교사 (인수자)
                    </Label>
                    <Select
                      value={editingFacility.nextYearTeacherEmail || 'UNASSIGNED'}
                      onValueChange={(val) => {
                        const u = users.find((x) => x.email.toLowerCase() === val.toLowerCase());
                        setEditingFacility((p) => ({
                          ...p,
                          nextYearTeacherEmail: u?.email || '',
                          nextYearTeacherName: u?.name || '',
                        }));
                      }}
                    >
                      <SelectTrigger className="h-7 text-xs bg-white border-indigo-200 text-indigo-950">
                        <SelectValue placeholder="인수자 선택">
                          {editingFacility.nextYearTeacherName ? (
                            <span className="font-bold">{editingFacility.nextYearTeacherName}</span>
                          ) : (
                            <span className="text-slate-400">미정</span>
                          )}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent className="max-h-52">
                        <SelectItem value="UNASSIGNED">미정 (공란)</SelectItem>
                        {users.map((u) => (
                          <SelectItem key={u.email} value={u.email}>
                            {u.name} ({u.role || '교사'})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
            </div>
          )}

          <DialogFooter className="gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIsFormOpen(false)}
              className="h-8 text-xs"
            >
              취소
            </Button>
            <Button
              type="button"
              size="sm"
              disabled={isSaving}
              onClick={handleSaveIndividualModal}
              className="h-8 text-xs font-bold bg-[#2471B2] hover:bg-[#1f5e94] text-white"
            >
              {isSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" /> : null}
              저장하기
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
