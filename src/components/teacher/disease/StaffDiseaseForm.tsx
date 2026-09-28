'use client';

import React, { useState, useRef } from 'react';
import { 
  Activity, 
  Send, 
  Camera, 
  X, 
  AlertCircle, 
  CheckCircle2, 
  ShieldAlert, 
  Building2, 
  User 
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { format, differenceInCalendarDays, parseISO } from 'date-fns';
import { saveDiseaseRecord } from '@/lib/services/healthService';
import { STAFF_DEPARTMENTS, StaffDepartment } from '@/components/health/disease-surveillance/types';

interface StaffDiseaseFormProps {
  userEmail: string;
  defaultName: string;
  defaultDepartment: string;
  defaultPosition: string;
  onSubmitted: () => void;
}

const normalizeStaffDepartment = (dept?: string): StaffDepartment => {
  if (!dept) return '유초등';
  if (dept.includes('유') || dept.includes('초')) return '유초등';
  if (dept.includes('중') || dept.includes('고')) return '중등';
  if (dept.includes('행정') || dept.includes('실')) return '행정실';
  return '유초등';
};

const COMMON_STAFF_DISEASES = [
  { name: '독감(인플루엔자)', category: '감염병' },
  { name: '코로나19', category: '감염병' },
  { name: '급성 장염', category: '식중독' },
  { name: '식중독', category: '식중독' },
  { name: '인후통/편도염', category: '단순질병' },
  { name: '감기/몸살(고열)', category: '단순질병' },
  { name: '복통/위장염', category: '단순질병' },
  { name: '중이염', category: '단순질병' },
  { name: '유행성결막염', category: '감염병' },
  { name: '외상/염좌', category: '단순질병' },
];

export function StaffDiseaseForm({
  userEmail,
  defaultName,
  defaultDepartment,
  defaultPosition,
  onSubmitted,
}: StaffDiseaseFormProps) {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const now = new Date();

  // 폼 상태
  const [name, setName] = useState(defaultName || '');
  const [department, setDepartment] = useState<StaffDepartment>(normalizeStaffDepartment(defaultDepartment));
  const [position, setPosition] = useState(defaultPosition || '교사');
  const [gender, setGender] = useState<'남' | '여'>('여');

  const [category, setCategory] = useState<string>('감염병');
  const [diseaseName, setDiseaseName] = useState<string>('독감(인플루엔자)');
  const [customDiseaseName, setCustomDiseaseName] = useState<string>('');

  const [startDate, setStartDate] = useState(format(now, 'yyyy-MM-dd'));
  const [endDate, setEndDate] = useState(format(now, 'yyyy-MM-dd'));
  const [totalDays, setTotalDays] = useState(1);
  const [status, setStatus] = useState<'isolated' | 'recovered' | 'observing'>('isolated');

  const [symptoms, setSymptoms] = useState('');
  const [notes, setNotes] = useState('');
  const [photoBase64, setPhotoBase64] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // 날짜 계산 핸들러
  const handleStartDateChange = (val: string) => {
    setStartDate(val);
    if (val && endDate && val > endDate) {
      setEndDate(val);
      setTotalDays(1);
    } else if (val && endDate) {
      const days = differenceInCalendarDays(parseISO(endDate), parseISO(val)) + 1;
      setTotalDays(Math.max(1, days));
    }
  };

  const handleEndDateChange = (val: string) => {
    setEndDate(val);
    if (startDate && val) {
      const days = differenceInCalendarDays(parseISO(val), parseISO(startDate)) + 1;
      setTotalDays(Math.max(1, days));
    }
  };

  // 소견서/진료확인서 사진 첨부 (Base64 변환)
  const handlePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      toast({
        title: '파일 크기 초과',
        description: '사진 용량은 최대 5MB까지 첨부 가능합니다.',
        variant: 'destructive',
      });
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      setPhotoBase64(reader.result as string);
      toast({ title: '소견서/진단서 사진 첨부 완료' });
    };
    reader.readAsDataURL(file);
  };

  const handleRemovePhoto = () => {
    setPhotoBase64('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // 제출 핸들러
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast({ title: '교직원 성명을 입력해주세요.', variant: 'destructive' });
      return;
    }

    const finalDisease = diseaseName === '기타' ? customDiseaseName.trim() || '기타 질환' : diseaseName;

    setIsSubmitting(true);
    try {
      await saveDiseaseRecord({
        studentId: `staff_${Date.now()}`,
        studentName: name.trim(),
        grade: department.trim() || '교직원',
        classNum: '1',
        studentNum: '',
        gender: gender,
        schoolLevel: 'staff',
        targetType: 'staff',
        staffDepartment: department.trim(),
        staffPosition: position.trim(),
        staffEmail: userEmail,
        homeroomTeacherName: position.trim() || '교직원',
        diseaseCategory: category,
        diseaseName: finalDisease,
        diagnosedAt: startDate,
        isolationStartDate: startDate,
        isolationEndDate: endDate,
        totalDays: Number(totalDays) || 1,
        status: status,
        medicalCertificateSubmitted: Boolean(photoBase64),
        medicalCertificateUrl: photoBase64 || undefined,
        symptoms: symptoms.trim(),
        notes: notes.trim(),
        source: 'staff_self',
      });

      toast({
        title: '건강/질병 신고 접수 완료',
        description: '보건실 감염병 및 질병현황 대장에 등록되었습니다.',
      });

      // 폼 초기화
      setCustomDiseaseName('');
      setSymptoms('');
      setNotes('');
      setPhotoBase64('');
      onSubmitted();
    } catch (err: any) {
      console.error(err);
      toast({
        title: '신고 등록 실패',
        description: err.message,
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Card className="border-border/60 shadow-xs">
      <CardHeader className="pb-3 border-b border-border/40 bg-purple-50/30">
        <div className="flex items-center gap-2">
          <Activity className="w-5 h-5 text-purple-600" />
          <CardTitle className="text-base font-bold text-foreground">
            교직원 건강/질병 신고서 작성
          </CardTitle>
          <Badge variant="outline" className="bg-white border-purple-300 text-purple-700 font-bold text-[10px]">
            보건실 자동 연동
          </Badge>
        </div>
        <CardDescription className="text-xs">
          감염병(독감, 코로나 등) 또는 치료가 필요한 질병이 발생한 경우 직접 신고하여 보건실 대장에 등록하고 병가/출근중지 현황을 공유합니다.
        </CardDescription>
      </CardHeader>

      <form onSubmit={handleSubmit}>
        <CardContent className="space-y-4 pt-4 text-xs">
          {/* 1. 신청 교직원 기본 정보 (자동 바인딩 & 수정 가능) */}
          <div className="p-3 bg-muted/20 border border-border/60 rounded-xl space-y-3">
            <div className="flex items-center gap-2 text-xs font-bold text-slate-800">
              <User className="w-4 h-4 text-purple-600" />
              신고자(교직원) 인적 정보
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-4 gap-2.5">
              <div className="space-y-1">
                <Label className="text-[11px] font-semibold text-slate-700">
                  교직원 성명 <span className="text-rose-500">*</span>
                </Label>
                <Input
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="예: 김선생"
                  className="h-8 text-xs bg-white"
                  required
                />
              </div>

              <div className="space-y-1">
                <Label className="text-[11px] font-semibold text-slate-700">
                  소속 부서 <span className="text-rose-500">*</span>
                </Label>
                <Select value={department} onValueChange={(val: StaffDepartment) => setDepartment(val)}>
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
                <Label className="text-[11px] font-semibold text-slate-700">직책/직급</Label>
                <Input
                  value={position}
                  onChange={e => setPosition(e.target.value)}
                  placeholder="예: 교사, 부장, 주무관"
                  className="h-8 text-xs bg-white"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-[11px] font-semibold text-slate-700">성별</Label>
                <Select value={gender} onValueChange={(v: '남' | '여') => setGender(v)}>
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
          </div>

          {/* 2. 질병 형태 및 구체적 병명 선택 */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-bold text-slate-800">
                질병 분류 및 병명 선택 <span className="text-rose-500">*</span>
              </Label>
              <div className="flex items-center gap-1">
                {['감염병', '단순질병', '식중독'].map(cat => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => {
                      setCategory(cat);
                      const matched = COMMON_STAFF_DISEASES.find(d => d.category === cat);
                      if (matched) setDiseaseName(matched.name);
                    }}
                    className={`px-2 py-0.5 rounded text-[11px] font-bold transition-all ${
                      category === cat
                        ? cat === '감염병'
                          ? 'bg-rose-600 text-white shadow-2xs'
                          : cat === '식중독'
                          ? 'bg-amber-600 text-white shadow-2xs'
                          : 'bg-sky-600 text-white shadow-2xs'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>

            {/* 빠른 선택 칩 */}
            <div className="flex flex-wrap gap-1.5 p-2 bg-slate-50 border border-slate-200 rounded-lg">
              {COMMON_STAFF_DISEASES.filter(d => d.category === category).map(d => (
                <button
                  key={d.name}
                  type="button"
                  onClick={() => setDiseaseName(d.name)}
                  className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-all ${
                    diseaseName === d.name
                      ? 'bg-purple-600 text-white shadow-2xs'
                      : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  {d.name}
                </button>
              ))}
              <button
                type="button"
                onClick={() => setDiseaseName('기타')}
                className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-all ${
                  diseaseName === '기타'
                    ? 'bg-purple-600 text-white shadow-2xs'
                    : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-100'
                }`}
              >
                직접 입력...
              </button>
            </div>

            {diseaseName === '기타' && (
              <Input
                placeholder="정확한 질병명을 직접 입력해주세요 (예: 급성 기관지염, 인플루엔자 A형 등)"
                value={customDiseaseName}
                onChange={e => setCustomDiseaseName(e.target.value)}
                className="h-8 text-xs"
                autoFocus
              />
            )}
          </div>

          {/* 3. 병가(격리) 기간 & 일수 & 현재 상태 */}
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
            <div className="space-y-1">
              <Label className="text-[11px] font-semibold text-slate-700">시작(진단)일</Label>
              <Input
                type="date"
                value={startDate}
                onChange={e => handleStartDateChange(e.target.value)}
                className="h-8 text-xs"
                required
              />
            </div>

            <div className="space-y-1">
              <Label className="text-[11px] font-semibold text-slate-700">종료(예정)일</Label>
              <Input
                type="date"
                min={startDate}
                value={endDate}
                onChange={e => handleEndDateChange(e.target.value)}
                className="h-8 text-xs"
                required
              />
            </div>

            <div className="space-y-1">
              <Label className="text-[11px] font-semibold text-slate-700">병가 일수</Label>
              <Input
                type="number"
                min={1}
                value={totalDays}
                onChange={e => setTotalDays(parseInt(e.target.value, 10) || 1)}
                className="h-8 text-xs text-center font-bold"
              />
            </div>

            <div className="space-y-1">
              <Label className="text-[11px] font-semibold text-slate-700">현재 상태</Label>
              <Select value={status} onValueChange={(v: any) => setStatus(v)}>
                <SelectTrigger className="h-8 text-xs font-semibold">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="isolated">
                    <span className="font-bold text-rose-600">출근중지 (격리/치료 중)</span>
                  </SelectItem>
                  <SelectItem value="recovered">
                    <span className="font-bold text-emerald-600">완치 (출근 완료)</span>
                  </SelectItem>
                  <SelectItem value="observing">
                    <span className="font-bold text-amber-600">증상 관찰중</span>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* 4. 증상 요약 & 비고 */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-[11px] font-semibold text-slate-700">주요 증상 요약</Label>
              <Input
                placeholder="예: 38.3도 발열, 심한 기침, 오한 등"
                value={symptoms}
                onChange={e => setSymptoms(e.target.value)}
                className="h-8 text-xs"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-[11px] font-semibold text-slate-700">기타 요청/비고</Label>
              <Input
                placeholder="예: 결강 보강 완료, 비대면 재택 처리 등"
                value={notes}
                onChange={e => setNotes(e.target.value)}
                className="h-8 text-xs"
              />
            </div>
          </div>

          {/* 5. 의사소견서 / 진단서 사진 첨부 */}
          <div className="space-y-1.5 p-3 bg-slate-50 border border-slate-200 rounded-xl">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                <Camera className="w-4 h-4 text-indigo-600" />
                의사소견서 또는 진단서 사진 첨부 (선택)
              </Label>
              <span className="text-[11px] text-slate-500">
                병원 진료 확인서 사진을 첨부하면 보건실에서 즉시 확인 가능합니다.
              </span>
            </div>

            <input
              type="file"
              ref={fileInputRef}
              accept="image/*"
              className="hidden"
              onChange={handlePhotoSelect}
            />

            {photoBase64 ? (
              <div className="relative inline-block border-2 border-indigo-300 rounded-lg overflow-hidden mt-1 max-w-xs">
                <img
                  src={photoBase64}
                  alt="소견서 사진 미리보기"
                  className="max-h-40 w-auto object-contain bg-slate-900/5"
                />
                <button
                  type="button"
                  onClick={handleRemovePhoto}
                  className="absolute top-1 right-1 p-1 bg-rose-600 text-white rounded-full hover:bg-rose-700 shadow-sm"
                  title="사진 삭제"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
                className="h-8 text-xs text-indigo-700 border-indigo-200 bg-white hover:bg-indigo-50"
              >
                <Camera className="w-3.5 h-3.5 mr-1" />
                사진 찍기 / 소견서 이미지 파일 첨부
              </Button>
            )}
          </div>
        </CardContent>

        <CardFooter className="pt-2 pb-4 flex justify-end gap-2 border-t border-border/40 bg-muted/5">
          <Button
            type="submit"
            disabled={isSubmitting}
            className="h-9 px-5 text-xs font-bold bg-purple-600 hover:bg-purple-700 text-white shadow-xs"
          >
            <Send className="w-3.5 h-3.5 mr-1.5" />
            {isSubmitting ? '신고서 접수 중...' : '건강/질병 신고서 제출'}
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}
