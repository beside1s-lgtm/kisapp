'use client';

import React, { useState, useMemo } from 'react';
import { Activity, Search, UserCheck } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { format, differenceInCalendarDays, parseISO } from 'date-fns';
import type { Student } from '@/lib/pe/types';
import { saveDiseaseRecord } from '@/lib/services/healthService';
import { COMMON_DISEASES, STAFF_DEPARTMENTS, StaffDepartment } from './types';

interface DiseaseAddDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  students: Student[];
  schoolLevel: 'elementary' | 'secondary' | 'staff';
  onSaved: () => void;
}

export function DiseaseAddDialog({
  open,
  onOpenChange,
  students,
  schoolLevel,
  onSaved,
}: DiseaseAddDialogProps) {
  const { toast } = useToast();
  const now = new Date();
  const isStaff = schoolLevel === 'staff';

  const [studentSearchInput, setStudentSearchInput] = useState('');
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  
  // 교직원 전용 입력 상태
  const [staffName, setStaffName] = useState('');
  const [staffDepartment, setStaffDepartment] = useState<StaffDepartment>('유초등');
  const [staffPosition, setStaffPosition] = useState('');
  const [staffGender, setStaffGender] = useState<'남' | '여'>('여');

  const [formTeacherName, setFormTeacherName] = useState('');
  const [formCategory, setFormCategory] = useState('감염병');
  const [formDiseaseName, setFormDiseaseName] = useState('독감(인플루엔자)');
  const [formCustomDiseaseName, setFormCustomDiseaseName] = useState('');
  const [formStartDate, setFormStartDate] = useState(format(now, 'yyyy-MM-dd'));
  const [formEndDate, setFormEndDate] = useState(format(now, 'yyyy-MM-dd'));
  const [formTotalDays, setFormTotalDays] = useState(1);
  const [formStatus, setFormStatus] = useState<'isolated' | 'recovered' | 'observing'>('isolated');
  const [formCertificateSubmitted, setFormCertificateSubmitted] = useState(true);
  const [formSymptoms, setFormSymptoms] = useState('');
  const [formNotes, setFormNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // 학교급에 해당하는 학생 필터링
  const levelStudents = useMemo(() => {
    return students.filter(s => {
      const gNum = parseInt(String(s.grade || '1'), 10) || 1;
      return schoolLevel === 'elementary' ? gNum <= 6 : gNum >= 7;
    });
  }, [students, schoolLevel]);

  // 학생 실시간 검색 매칭 (이름, 학반)
  const matchedStudents = useMemo(() => {
    if (!studentSearchInput.trim()) return [];
    const q = studentSearchInput.trim().toLowerCase();
    return levelStudents
      .filter(s => {
        const matchName = s.name.toLowerCase().includes(q);
        const matchGc = `${s.grade}-${s.classNum}`.includes(q);
        return matchName || matchGc;
      })
      .slice(0, 8);
  }, [studentSearchInput, levelStudents]);

  const handleSelectStudent = (s: Student) => {
    setSelectedStudent(s);
    setStudentSearchInput('');
    if (s.teacherName) {
      setFormTeacherName(s.teacherName);
    }
  };

  const handleStartDateChange = (val: string) => {
    setFormStartDate(val);
    if (val && formEndDate && val > formEndDate) {
      setFormEndDate(val);
      setFormTotalDays(1);
    } else if (val && formEndDate) {
      const days = differenceInCalendarDays(parseISO(formEndDate), parseISO(val)) + 1;
      setFormTotalDays(Math.max(1, days));
    }
  };

  const handleEndDateChange = (val: string) => {
    setFormEndDate(val);
    if (formStartDate && val) {
      const days = differenceInCalendarDays(parseISO(val), parseISO(formStartDate)) + 1;
      setFormTotalDays(Math.max(1, days));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isStaff) {
      if (!staffName.trim()) {
        toast({ title: '교직원 성명을 입력해주세요.', variant: 'destructive' });
        return;
      }
    } else {
      if (!selectedStudent) {
        toast({ title: '학생을 선택해주세요.', variant: 'destructive' });
        return;
      }
    }
    const finalDiseaseName = formDiseaseName === '기타' 
      ? (formCustomDiseaseName.trim() || '기타 질환') 
      : formDiseaseName;

    setIsSubmitting(true);
    try {
      if (isStaff) {
        await saveDiseaseRecord({
          studentId: `staff_${Date.now()}`,
          studentName: staffName.trim(),
          grade: staffDepartment.trim() || '교직원',
          classNum: '1',
          studentNum: '',
          gender: staffGender,
          schoolLevel: 'staff',
          targetType: 'staff',
          staffDepartment: staffDepartment.trim() || '교직원',
          staffPosition: staffPosition.trim() || '교사',
          homeroomTeacherName: staffPosition.trim() || '교사',
          diseaseCategory: formCategory,
          diseaseName: finalDiseaseName,
          diagnosedAt: formStartDate,
          isolationStartDate: formStartDate,
          isolationEndDate: formEndDate,
          totalDays: Number(formTotalDays) || 1,
          status: formStatus,
          medicalCertificateSubmitted: formCertificateSubmitted,
          symptoms: formSymptoms.trim(),
          notes: formNotes.trim(),
          source: 'health_manual',
        });

        toast({
          title: '교직원 질병 등록 완료',
          description: `${staffName.trim()} (${finalDiseaseName}) 기록이 저장되었습니다.`
        });
      } else {
        const gNum = parseInt(String(selectedStudent!.grade), 10) || 1;
        await saveDiseaseRecord({
          studentId: selectedStudent!.id,
          studentName: selectedStudent!.name,
          grade: String(selectedStudent!.grade),
          classNum: String(selectedStudent!.classNum),
          studentNum: String(selectedStudent!.studentNum || ''),
          gender: selectedStudent!.gender,
          schoolLevel: gNum <= 6 ? 'elementary' : 'secondary',
          homeroomTeacherName: formTeacherName.trim() || '담임교사',
          diseaseCategory: formCategory,
          diseaseName: finalDiseaseName,
          diagnosedAt: formStartDate,
          isolationStartDate: formStartDate,
          isolationEndDate: formEndDate,
          totalDays: Number(formTotalDays) || 1,
          status: formStatus,
          medicalCertificateSubmitted: formCertificateSubmitted,
          symptoms: formSymptoms.trim(),
          notes: formNotes.trim(),
          source: 'health_manual',
        });

        toast({
          title: '감염병/질병 등록 완료',
          description: `${selectedStudent!.name} (${finalDiseaseName}) 기록이 저장되었습니다.`
        });
      }

      onOpenChange(false);
      onSaved();
    } catch (err: any) {
      console.error(err);
      toast({ title: '저장 실패', description: err.message, variant: 'destructive' });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base font-bold">
            <Activity className="w-5 h-5 text-rose-600" />
            {isStaff ? '교직원 감염병 및 질병 발생 등록' : '감염병 및 결석 질병 발생 등록'}
          </DialogTitle>
          <DialogDescription className="text-xs">
            {isStaff 
              ? '질병이 발생한 교직원의 소속 부서, 직책, 병명 및 격리/병가 정보를 입력합니다.' 
              : schoolLevel === 'elementary' ? '초등학교 (1~6학년)' : '중·고등학교 (7~12학년)' + ' 유증상 학생의 병명 및 결석 정보를 입력합니다.'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          {/* 대상 선택: 교직원 입력 vs 학생 검색 */}
          {isStaff ? (
            <div className="space-y-3 p-3 bg-purple-50/50 border border-purple-200/70 rounded-xl">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs font-bold text-slate-800">
                    교직원 성명 <span className="text-rose-500">*</span>
                  </Label>
                  <Input
                    placeholder="예: 홍길동"
                    value={staffName}
                    onChange={e => setStaffName(e.target.value)}
                    className="h-8 text-xs bg-white"
                    autoFocus
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs font-semibold text-slate-800">성별</Label>
                  <Select value={staffGender} onValueChange={(v: '남' | '여') => setStaffGender(v)}>
                    <SelectTrigger className="h-8 text-xs bg-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="여">여성</SelectItem>
                      <SelectItem value="남">남성</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs font-semibold text-slate-800">
                    소속 부서 <span className="text-rose-500">*</span>
                  </Label>
                  <Select value={staffDepartment} onValueChange={(val: StaffDepartment) => setStaffDepartment(val)}>
                    <SelectTrigger className="h-8 text-xs bg-white font-bold">
                      <SelectValue placeholder="소속 부서 선택" />
                    </SelectTrigger>
                    <SelectContent>
                      {STAFF_DEPARTMENTS.map(dept => (
                        <SelectItem key={dept} value={dept} className="text-xs font-semibold">
                          {dept}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs font-semibold text-slate-800">직책/직급</Label>
                  <Input
                    placeholder="예: 교사, 부장, 주무관"
                    value={staffPosition}
                    onChange={e => setStaffPosition(e.target.value)}
                    className="h-8 text-xs bg-white"
                  />
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-slate-800">
                대상 학생 선택 <span className="text-rose-500">*</span>
              </Label>
              
              {selectedStudent ? (
                <div className="flex items-center justify-between p-2.5 bg-emerald-50 border border-emerald-200 rounded-lg">
                  <div className="flex items-center gap-2">
                    <UserCheck className="w-4 h-4 text-emerald-600" />
                    <span className="text-xs font-black text-emerald-950">
                      {selectedStudent.name}
                    </span>
                    <Badge variant="outline" className="text-[10px] bg-white border-emerald-300 text-emerald-700">
                      {selectedStudent.grade}학년 {selectedStudent.classNum}반 {selectedStudent.studentNum ? `${selectedStudent.studentNum}번` : ''}
                    </Badge>
                    <span className="text-[10px] text-emerald-600 font-semibold">
                      ({selectedStudent.gender || '성별미상'})
                    </span>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setSelectedStudent(null)}
                    className="h-6 px-2 text-[10px] text-emerald-800 hover:bg-emerald-100"
                  >
                    변경
                  </Button>
                </div>
              ) : (
                <div className="space-y-1.5">
                  <div className="relative">
                    <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400" />
                    <Input
                      placeholder="학생 이름 또는 학반(예: 3-2) 검색..."
                      value={studentSearchInput}
                      onChange={e => setStudentSearchInput(e.target.value)}
                      className="pl-8 h-8 text-xs"
                      autoFocus
                    />
                  </div>
                  {matchedStudents.length > 0 && (
                    <div className="max-h-36 overflow-y-auto border border-slate-200 rounded-lg p-1 bg-white shadow-sm divide-y divide-slate-100">
                      {matchedStudents.map(s => (
                        <button
                          key={s.id}
                          type="button"
                          onClick={() => handleSelectStudent(s)}
                          className="w-full text-left px-2.5 py-1.5 hover:bg-slate-50 rounded flex items-center justify-between transition-colors"
                        >
                          <span className="text-xs font-bold text-slate-900">{s.name}</span>
                          <div className="flex items-center gap-1.5">
                            <span className="text-[11px] text-slate-500">{s.grade}학년 {s.classNum}반</span>
                            <span className="text-[10px] text-slate-400">{s.studentNum ? `${s.studentNum}번` : ''}</span>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* 담임 교사명(학생일 때만) & 질병 분류 */}
          <div className={isStaff ? 'space-y-1' : 'grid grid-cols-2 gap-3'}>
            {!isStaff && (
              <div className="space-y-1">
                <Label className="text-xs font-semibold">담임 교사명</Label>
                <Input
                  placeholder="예: 김선생"
                  value={formTeacherName}
                  onChange={e => setFormTeacherName(e.target.value)}
                  className="h-8 text-xs"
                />
              </div>
            )}
            <div className="space-y-1">
              <Label className="text-xs font-semibold">감염병/질병 분류</Label>
              <Select value={formCategory} onValueChange={setFormCategory}>
                <SelectTrigger className="h-8 text-xs font-semibold">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="감염병">
                    <span className="font-bold text-rose-700">감염병 (격리/{isStaff ? '출근' : '등교'}중지 대상)</span>
                  </SelectItem>
                  <SelectItem value="단순질병">
                    <span className="font-bold text-sky-700">단순질병 (중이염, 감기, 발열 등)</span>
                  </SelectItem>
                  <SelectItem value="식중독">
                    <span className="font-bold text-amber-800">식중독 (급성 장염, 식중독 등)</span>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* 병명 선택 및 직접 입력 */}
          <div className="space-y-1">
            <Label className="text-xs font-semibold">병명 (질병명)</Label>
            <Select value={formDiseaseName} onValueChange={setFormDiseaseName}>
              <SelectTrigger className="h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {COMMON_DISEASES.map(d => (
                  <SelectItem key={d.name} value={d.name}>{d.name} ({d.category})</SelectItem>
                ))}
                <SelectItem value="기타">직접 입력...</SelectItem>
              </SelectContent>
            </Select>
            {formDiseaseName === '기타' && (
              <Input
                placeholder="정확한 병명을 입력하세요"
                value={formCustomDiseaseName}
                onChange={e => setFormCustomDiseaseName(e.target.value)}
                className="h-8 text-xs mt-1"
                autoFocus
              />
            )}
          </div>

          {/* 결석/격리 기간 & 총 일수 */}
          <div className="grid grid-cols-3 gap-2">
            <div className="space-y-1">
              <Label className="text-xs font-semibold">시작(진단)일</Label>
              <Input
                type="date"
                value={formStartDate}
                onChange={e => handleStartDateChange(e.target.value)}
                className="h-8 text-xs"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs font-semibold">종료(예정)일</Label>
              <Input
                type="date"
                min={formStartDate}
                value={formEndDate}
                onChange={e => handleEndDateChange(e.target.value)}
                className="h-8 text-xs"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs font-semibold">{isStaff ? '병가 일수' : '결석 일수'}</Label>
              <Input
                type="number"
                min={1}
                value={formTotalDays}
                onChange={e => setFormTotalDays(parseInt(e.target.value, 10) || 1)}
                className="h-8 text-xs text-center font-bold"
              />
            </div>
          </div>

          {/* 격리 상태 & 의사소견서 제출 여부 */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs font-semibold">현재 상태</Label>
              <Select value={formStatus} onValueChange={(v: any) => setFormStatus(v)}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="isolated">
                    {isStaff ? '출근중지 (격리/치료 중)' : '등교중지 (격리/치료 중)'}
                  </SelectItem>
                  <SelectItem value="recovered">
                    {isStaff ? '완치 (출근 완료)' : '완치 (등교재개 완료)'}
                  </SelectItem>
                  <SelectItem value="observing">증상 관찰중</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs font-semibold">진료확인서/소견서</Label>
              <Select
                value={formCertificateSubmitted ? 'yes' : 'no'}
                onValueChange={v => setFormCertificateSubmitted(v === 'yes')}
              >
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="yes">제출 완료 ({isStaff ? '병가 증빙' : '출석인정 증빙'})</SelectItem>
                  <SelectItem value="no">미제출 (확인 필요)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* 증상 요약 */}
          <div className="space-y-1">
            <Label className="text-xs font-semibold">주요 증상 요약</Label>
            <Input
              placeholder="예: 38.5도 고열, 손발 수포, 인후통 등"
              value={formSymptoms}
              onChange={e => setFormSymptoms(e.target.value)}
              className="h-8 text-xs"
            />
          </div>

          {/* 비고 */}
          <div className="space-y-1">
            <Label className="text-xs font-semibold">비고 / 담임 확인 내용</Label>
            <Textarea
              placeholder="유선 통화 확인 내용, 출석인정 처리 사항 등"
              value={formNotes}
              onChange={e => setFormNotes(e.target.value)}
              rows={2}
              className="text-xs resize-none"
            />
          </div>

          <DialogFooter className="pt-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(false)}
              className="h-8 text-xs"
            >
              취소
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={isSubmitting || (isStaff ? !staffName.trim() : !selectedStudent)}
              className={`h-8 text-xs font-bold text-white ${
                isStaff ? 'bg-purple-600 hover:bg-purple-700' : 'bg-rose-600 hover:bg-rose-700'
              }`}
            >
              {isSubmitting ? '저장 중...' : '등록 완료'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
