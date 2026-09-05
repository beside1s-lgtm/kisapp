'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Settings, Plus, Trash2, Users, Sparkles, MapPin } from 'lucide-react';
import { saveUserProfile } from '@/lib/services/userService';
import type { UserProfile } from '@/lib/types';
import { getStudents, getDestinations } from '@/lib/kisbus';
import { Destination } from '@/lib/kisbus/types';
import { Combobox } from '@/components/ui/combobox';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogTrigger,
} from '@/components/ui/dialog';

interface LinkedStudent {
  id: string;
  nameKo: string;
  nameEn: string;
  grade: string;
  studentClass: string;
  studentNumber?: string;
  gender?: 'Male' | 'Female';
}

export function ParentSettingsDialog() {
  const { user, profile, fetchProfile, updateProfile } = useAuth();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const [studentName, setStudentName] = useState('');
  const [studentNameEn, setStudentNameEn] = useState('');
  const [studentGrade, setStudentGrade] = useState('');
  const [studentClass, setStudentClass] = useState('');
  const [studentNumber, setStudentNumber] = useState('');
  const [parentName, setParentName] = useState('');
  const [parentRelation, setParentRelation] = useState('부');
  const [phone, setPhone] = useState('');
  const [linkedStudents, setLinkedStudents] = useState<LinkedStudent[]>([]);

  // 거주지 정류장 상태
  const [destinations, setDestinations] = useState<Destination[]>([]);
  const [residenceDestinationId, setResidenceDestinationId] = useState<string | null>(null);
  const [useCustomResidence, setUseCustomResidence] = useState(false);
  const [customResidenceDestination, setCustomResidenceDestination] = useState('');

  useEffect(() => {
    if (open) {
      getDestinations().then(data => {
        data.sort((a, b) => a.name.localeCompare(b.name, 'ko'));
        setDestinations(data);
      }).catch(err => console.error("Error loading destinations:", err));

      if (profile) {
        setStudentName(profile.studentName || '');
        setStudentNameEn(profile.studentNameEn || '');
        setStudentGrade(profile.studentGrade || '');
        setStudentClass(profile.studentClass || '');
        setStudentNumber(profile.studentNumber || '');
        setParentName(profile.parentName || '');
        setParentRelation((profile as any)?.parentRelation || '부');
        setPhone(profile.parentPhone || '');
        setLinkedStudents(profile.linkedStudents || []);
        setResidenceDestinationId(profile.residenceDestinationId || null);
        setCustomResidenceDestination(profile.customResidenceDestination || '');
        if (profile.customResidenceDestination) setUseCustomResidence(true);
      }
    }
  }, [open, profile]);

  const destinationOptions = destinations.map(d => ({ value: d.id, label: d.name }));

  const handleAddLinkedStudent = () => {
    setLinkedStudents([
      ...linkedStudents,
      {
        id: `sib_${Date.now()}_${Math.random().toString(36).substring(2, 5)}`,
        nameKo: '',
        nameEn: '',
        grade: '1',
        studentClass: '1',
        studentNumber: '',
        gender: 'Male'
      }
    ]);
  };

  const handleAutoDetectSiblings = async () => {
    try {
      const students = await getStudents();
      const cleanPhone = phone.replace(/\D/g, '');
      if (!cleanPhone || cleanPhone.length < 5) {
        toast({ variant: 'destructive', title: '안내', description: '학부모 연락처를 먼저 입력해주세요.' });
        return;
      }

      const matches = students.filter(s => {
        const sPhone = (s.contact || '').replace(/\D/g, '');
        return sPhone.length > 5 && sPhone === cleanPhone && s.nameKo !== studentName;
      });

      if (matches.length === 0) {
        toast({ title: '탐지 결과', description: '연락처로 등록된 추가 자녀 정보가 없습니다. 수동 추가 버튼을 이용해주세요.' });
        return;
      }

      let addedCount = 0;
      const nextList = [...linkedStudents];
      matches.forEach(m => {
        const exists = nextList.some(item => item.nameKo === m.nameKo || item.nameKo === m.name);
        if (!exists) {
          nextList.push({
            id: m.id || `sib_${Date.now()}`,
            nameKo: m.nameKo || m.name,
            nameEn: m.nameEn || m.name,
            grade: m.grade || '1',
            studentClass: m.class || '1',
            gender: (m.gender as 'Male' | 'Female') || 'Male'
          });
          addedCount++;
        }
      });

      setLinkedStudents(nextList);
      toast({ title: '형제/자매 탐지 완료', description: `${addedCount}명의 자녀 정보가 연동 목록에 새로 추가되었습니다.` });
    } catch (err) {
      console.error('Auto detect error:', err);
    }
  };

  const handleRemoveLinkedStudent = (id: string) => {
    setLinkedStudents(linkedStudents.filter(s => s.id !== id));
  };

  const updateLinkedStudent = (index: number, field: keyof LinkedStudent, value: any) => {
    const updated = [...linkedStudents];
    updated[index] = { ...updated[index], [field]: value };
    setLinkedStudents(updated);
  };

  const handleSave = async () => {
    const targetEmail = user?.email || profile?.email || 'parent_test@kshcm.net';
    const targetUid = user?.uid || profile?.uid || 'test_parent_uid';

    if (!parentName.trim()) {
      toast({ variant: 'destructive', title: '입력 오류', description: '학부모 성명을 입력해주세요.' });
      return;
    }
    
    setIsSaving(true);
    try {
      const payloadData: Partial<UserProfile> = {
        studentName: studentName.trim(),
        studentNameEn: studentNameEn.trim(),
        studentGrade,
        studentClass,
        studentNumber,
        parentName: parentName.trim(),
        parentRelation: parentRelation.trim(),
        parentPhone: phone,
        residenceDestinationId: useCustomResidence ? null as any : residenceDestinationId || undefined,
        customResidenceDestination: useCustomResidence ? customResidenceDestination.trim() : undefined,
        linkedStudents: linkedStudents.map(s => ({
          ...s,
          nameKo: s.nameKo.trim(),
          nameEn: s.nameEn.trim()
        }))
      };

      const res = await saveUserProfile(targetUid, targetEmail, payloadData);

      if (res.success) {
        toast({ title: '설정 저장', description: '학부모 정보 및 기본 거주지 정류장이 성공적으로 저장되었습니다.' });
        if (updateProfile) {
          updateProfile({ ...payloadData, ...(res.profile || {}) });
        }
        setOpen(false);
      } else {
        throw new Error(res.error);
      }
    } catch (error: any) {
      console.error('Settings save failed:', error);
      toast({ variant: 'destructive', title: '저장 실패', description: error.message || '정보 업데이트 중 오류가 발생했습니다.' });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-foreground">
          <Settings className="h-5 w-5" />
          <span className="sr-only">설정</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[680px] md:max-w-[750px] w-[95vw] max-w-[95vw] max-h-[90vh] overflow-y-auto overflow-x-hidden p-3.5 sm:p-6 rounded-2xl">
        <DialogHeader className="pb-2 border-b border-slate-100">
          <DialogTitle className="flex items-center gap-2 text-base font-bold text-slate-900">
            <Users className="w-5 h-5 text-indigo-600 shrink-0" />
            <span>학부모 정보 & 자녀 형제/자매 설정</span>
          </DialogTitle>
          <DialogDescription className="text-xs text-slate-500 mt-1">
            신청서 작성 시 자동으로 입력될 자녀 정보, 기본 거주지 정류장 및 형제/자매 연동 정보를 관리할 수 있습니다.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 w-full max-w-full gap-3 sm:gap-4 py-2 sm:py-3 text-xs overflow-x-hidden min-w-0">
          {/* 학생 기본 인적사항 (한글 + 영문) */}
          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-3 w-full max-w-full min-w-0">
            <h4 className="font-bold text-slate-800 text-xs flex items-center justify-between">
              <span>주 대표 자녀 기본 정보</span>
              <span className="text-[11px] bg-indigo-100 text-indigo-800 px-2 py-0.5 rounded">기본 선택 자녀</span>
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 sm:gap-3">
              <div className="space-y-1">
                <Label htmlFor="sName" className="text-[11px] font-bold text-slate-600">학생 한글 이름</Label>
                <Input id="sName" value={studentName} onChange={(e) => setStudentName(e.target.value)} placeholder="예: 강동윤" className="text-xs h-9 bg-white font-bold" />
              </div>
              <div className="space-y-1">
                <Label htmlFor="sNameEn" className="text-[11px] font-bold text-slate-600">학생 영문 이름</Label>
                <Input id="sNameEn" value={studentNameEn} onChange={(e) => setStudentNameEn(e.target.value)} placeholder="예: Kang Dongyoon" className="text-xs h-9 bg-white" />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2 min-w-0">
              <div className="space-y-1 min-w-0">
                <Label htmlFor="sGrade" className="text-[11px] font-bold text-slate-600">학년</Label>
                <Input id="sGrade" inputMode="numeric" value={studentGrade} onChange={(e) => setStudentGrade(e.target.value.replace(/[^0-9]/g, ''))} placeholder="4" className="text-xs h-9 bg-white text-center font-bold px-1 w-full [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" />
              </div>
              <div className="space-y-1 min-w-0">
                <Label htmlFor="sClass" className="text-[11px] font-bold text-slate-600">반</Label>
                <Input id="sClass" inputMode="numeric" value={studentClass} onChange={(e) => setStudentClass(e.target.value.replace(/[^0-9]/g, ''))} placeholder="4" className="text-xs h-9 bg-white text-center font-bold px-1 w-full [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" />
              </div>
              <div className="space-y-1 min-w-0">
                <Label htmlFor="sNum" className="text-[11px] font-bold text-slate-600">번호</Label>
                <Input id="sNum" inputMode="numeric" value={studentNumber} onChange={(e) => setStudentNumber(e.target.value.replace(/[^0-9]/g, ''))} placeholder="2" className="text-xs h-9 bg-white text-center px-1 w-full [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" />
              </div>
            </div>
          </div>

          {/* 학부모 기본 정보 (성명 + 관계 + 연락처) */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 sm:gap-3 p-3 bg-slate-50/50 rounded-xl border border-slate-200 w-full max-w-full min-w-0">
            <div className="space-y-1">
              <Label htmlFor="pName" className="text-[11px] font-bold text-slate-600">학부모 성명 <span className="text-destructive">*</span></Label>
              <Input id="pName" value={parentName} onChange={(e) => setParentName(e.target.value)} placeholder="예: 서고운" className="text-xs h-9 bg-white" />
            </div>
            <div className="space-y-1">
              <Label htmlFor="pRelation" className="text-[11px] font-bold text-slate-600">자녀와의 관계 <span className="text-destructive">*</span></Label>
              <Select value={parentRelation} onValueChange={setParentRelation}>
                <SelectTrigger id="pRelation" className="text-xs h-9 bg-white">
                  <SelectValue placeholder="관계 선택" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="부">부 (아버지)</SelectItem>
                  <SelectItem value="모">모 (어머니)</SelectItem>
                  <SelectItem value="조부">조부 (할아버지)</SelectItem>
                  <SelectItem value="조모">조모 (할머니)</SelectItem>
                  <SelectItem value="기타">기타 (보호자)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="pPhone" className="text-[11px] font-bold text-slate-600">학부모 연락처</Label>
              <Input id="pPhone" type="tel" value={phone} onChange={(e) => setPhone(e.target.value.replace(/[^0-9-]/g, ''))} placeholder="0773365357" className="text-xs h-9 bg-white font-mono" />
            </div>
          </div>

          {/* 기본 거주지 / 스쿨버스 정류장 선택 */}
          <div className="p-3 bg-amber-50/60 border border-amber-200 rounded-xl space-y-2 w-full max-w-full min-w-0">
            <Label className="font-bold text-amber-900 text-xs flex items-center gap-1.5">
              <MapPin className="w-4 h-4 text-amber-600 shrink-0" />
              <span>기본 거주지 / 스쿨버스 정류장</span>
            </Label>
            <p className="text-[11px] text-amber-800">
              미리 거주지를 설정해두면 방과후학교 및 스쿨버스 신청서 작성 시 주소/목적지가 자동 선택됩니다.
            </p>
            <Combobox 
              options={destinationOptions}
              value={residenceDestinationId}
              onSelect={setResidenceDestinationId}
              placeholder="거주 아파트 / 공식 정류장 선택 (예: 푸미흥 1차, 스카이 가든 3차...)"
              disabled={useCustomResidence}
            />
            <div className="flex items-center space-x-2 pt-1">
              <Checkbox 
                id="useCustomResidence" 
                checked={useCustomResidence} 
                onCheckedChange={(checked) => setUseCustomResidence(checked as boolean)} 
              />
              <label htmlFor="useCustomResidence" className="text-[11px] font-semibold text-slate-700 cursor-pointer">
                목록에 거주 아파트가 없는 경우 직접 신규 입력
              </label>
            </div>
            {useCustomResidence && (
              <Input 
                value={customResidenceDestination} 
                onChange={e => setCustomResidenceDestination(e.target.value)} 
                placeholder="예: 7군 신규 아파트 2차 정문 앞" 
                className="bg-white text-xs h-8 mt-1"
              />
            )}
          </div>

          {/* 형제/자매 (동일 가구 자녀) 연동 관리 */}
          <div className="p-3.5 bg-indigo-50/60 border border-indigo-200 rounded-xl space-y-3 w-full max-w-full min-w-0">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <Label className="font-bold text-indigo-900 text-xs flex items-center gap-1.5 min-w-0">
                <Users className="w-4 h-4 text-indigo-600 shrink-0" />
                <span>형제/자매 연동 관리 ({linkedStudents.length}명)</span>
              </Label>
              <div className="grid grid-cols-2 sm:flex sm:items-center gap-1.5 w-full sm:w-auto">
                <Button 
                  type="button" 
                  variant="outline" 
                  size="sm" 
                  onClick={handleAutoDetectSiblings}
                  className="h-7 text-[11px] font-bold bg-white text-indigo-700 hover:bg-indigo-100 border-indigo-200 px-1.5 sm:px-2.5 rounded-lg flex items-center justify-center min-w-0"
                >
                  <Sparkles className="w-3 h-3 mr-1 text-indigo-600 shrink-0" />
                  <span className="truncate">자녀 자동 탐지</span>
                </Button>
                <Button 
                  type="button" 
                  variant="outline" 
                  size="sm" 
                  onClick={handleAddLinkedStudent}
                  className="h-7 text-[11px] font-bold bg-indigo-600 hover:bg-indigo-700 text-white px-1.5 sm:px-2.5 rounded-lg flex items-center justify-center min-w-0"
                >
                  <Plus className="w-3 h-3 mr-1 shrink-0" />
                  <span className="truncate">형제 추가</span>
                </Button>
              </div>
            </div>

            <p className="text-[11px] text-slate-500">
              미리 형제/자매를 연동해두면 방과후학교, 스쿨버스 탑승 신청 시 자동으로 동시 신청 및 할인 선택이 적용됩니다.
            </p>

            {linkedStudents.length > 0 ? (
              <div className="space-y-2.5 pt-1">
                {linkedStudents.map((sib, index) => (
                  <div key={sib.id} className="relative p-3 bg-white border border-indigo-200 rounded-xl space-y-2 shadow-2xs">
                    <button 
                      type="button"
                      onClick={() => handleRemoveLinkedStudent(sib.id)}
                      className="absolute top-2.5 right-2.5 p-1 text-slate-400 hover:text-red-600 rounded-md hover:bg-red-50"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                    <span className="text-[11px] font-bold text-indigo-800 block">형제/자매 자녀 #{index + 1}</span>

                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-1">
                        <Label className="text-[10px] font-bold text-slate-500">한글 성명</Label>
                        <Input value={sib.nameKo} onChange={e => updateLinkedStudent(index, 'nameKo', e.target.value)} placeholder="홍길순" className="text-xs h-8" />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-[10px] font-bold text-slate-500">영문 성명</Label>
                        <Input value={sib.nameEn} onChange={e => updateLinkedStudent(index, 'nameEn', e.target.value)} placeholder="Hong Gilsoon" className="text-xs h-8" />
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-2">
                      <div className="space-y-1">
                        <Label className="text-[10px] font-bold text-slate-500">학년</Label>
                        <Input value={sib.grade} onChange={e => updateLinkedStudent(index, 'grade', e.target.value)} placeholder="2" className="text-xs h-8 text-center font-bold" />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-[10px] font-bold text-slate-500">반</Label>
                        <Input value={sib.studentClass} onChange={e => updateLinkedStudent(index, 'studentClass', e.target.value)} placeholder="1" className="text-xs h-8 text-center font-bold" />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-[10px] font-bold text-slate-500">성별</Label>
                        <Select value={sib.gender || 'Male'} onValueChange={(v) => updateLinkedStudent(index, 'gender', v)}>
                          <SelectTrigger className="text-xs h-8">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Male">남</SelectItem>
                            <SelectItem value="Female">여</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-[11px] text-slate-400 italic text-center p-3 bg-white rounded-lg border border-dashed border-indigo-200">
                연동된 형제/자매가 없습니다. 상단의 자녀 자동 탐지나 형제 추가 버튼을 눌러보세요.
              </p>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" size="sm" onClick={() => setOpen(false)} className="text-xs">취소</Button>
          <Button size="sm" onClick={handleSave} disabled={isSaving} className="text-xs bg-indigo-600 hover:bg-indigo-700 text-white font-bold">
            {isSaving && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
            정보 저장하기
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
