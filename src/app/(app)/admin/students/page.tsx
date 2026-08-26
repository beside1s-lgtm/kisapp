'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { MainLayout } from '@/components/layout/main-layout';
import { 
  onMasterStudentsUpdate, createMasterStudent, updateMasterStudent, 
  deleteMasterStudent, batchImportMasterStudents, batchPromoteStudents, isStudentEmail
} from '@/lib/services/masterStudentService';
import type { MasterStudent, NewMasterStudent } from '@/lib/types/masterStudent';
import { onDestinationsUpdate } from '@/lib/kisbus';
import type { Destination } from '@/lib/kisbus/types';
import { Combobox } from '@/components/ui/combobox';
import { Checkbox } from '@/components/ui/checkbox';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { 
  Users, GraduationCap, Bus, Calendar, Plus, Upload, Download, Search, 
  UserCheck, Mail, Phone, MapPin, CreditCard, ShieldCheck, Trash2, Edit3, FileText, CheckCircle2, ArrowUpRight, Sparkles, CheckSquare, Square, Filter 
} from 'lucide-react';
import { cn } from '@/lib/kisbus/utils';

export default function AdminMasterStudentsPage() {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const promoteFileInputRef = useRef<HTMLInputElement>(null);

  const [students, setStudents] = useState<MasterStudent[]>([]);
  const [destinations, setDestinations] = useState<Destination[]>([]);
  const [loading, setLoading] = useState(true);

  // 필터 및 검색
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedGrade, setSelectedGrade] = useState<string>('all');

  // 모달 상태
  const [selectedStudent, setSelectedStudent] = useState<MasterStudent | null>(null);
  const [isDetailDialogOpen, setIsDetailDialogOpen] = useState(false);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isPromoteDialogOpen, setIsPromoteDialogOpen] = useState(false);
  const [isDownloadDialogOpen, setIsDownloadDialogOpen] = useState(false);

  // 명단 다운로드 시 선택된 학년/반 목록 (Set or array of "grade-classNum")
  const [selectedClassesForDownload, setSelectedClassesForDownload] = useState<string[]>([]);

  // 진급 서식 다운로드 시 선택된 학년/반 필터
  const [promoteTemplateGrade, setPromoteTemplateGrade] = useState<string>('all');
  const [promoteTemplateClass, setPromoteTemplateClass] = useState<string>('all');

  // 수정 중인 학생 객체 state
  const [editStudentForm, setEditStudentForm] = useState<Partial<MasterStudent>>({});

  // 4-in-1 상세 모달 내 선택된 학학년도 (아카이브 조회를 위한 연도 선택 state)
  const [selectedAcademicYear, setSelectedAcademicYear] = useState<number>(new Date().getFullYear());

  // 신규 등록 폼
  const [newStudent, setNewStudent] = useState<Partial<NewMasterStudent>>({
    name: '',
    studentEmail: '',
    grade: '1',
    classNum: '1',
    studentNum: '1',
    gender: 'Male',
    contact: '',
    parentEmail: '',
    address: '',
    kisbusNo: ''
  });

  // Firestore 실시간 구독
  useEffect(() => {
    const unsubMaster = onMasterStudentsUpdate((data) => {
      setStudents(data);
      setLoading(false);
    });
    const unsubDest = onDestinationsUpdate((dList) => {
      const sorted = [...(dList || [])].sort((a, b) => (a.name || '').localeCompare(b.name || '', 'ko'));
      setDestinations(sorted);
    });
    return () => {
      unsubMaster();
      unsubDest();
    };
  }, []);

  const destinationOptions = useMemo(() => {
    return destinations.map(d => ({
      value: d.name,
      label: d.name
    }));
  }, [destinations]);

  // 필터링된 학생 목록
  const filteredStudents = useMemo(() => {
    return students.filter(s => {
      if (selectedGrade !== 'all' && String(s.grade) !== String(selectedGrade)) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.trim().toLowerCase();
        const nameMatch = (s.name || '').toLowerCase().includes(q);
        const emailMatch = (s.studentEmail || '').toLowerCase().includes(q);
        const gradeClassMatch = `${s.grade}학년 ${s.classNum}반`.includes(q);
        if (!nameMatch && !emailMatch && !gradeClassMatch) return false;
      }
      return true;
    }).sort((a, b) => {
      const gA = parseInt(a.grade) || 0;
      const gB = parseInt(b.grade) || 0;
      if (gA !== gB) return gA - gB;
      const cA = parseInt(a.classNum) || 0;
      const cB = parseInt(b.classNum) || 0;
      if (cA !== cB) return cA - cB;
      return (a.name || '').localeCompare(b.name || '', 'ko');
    });
  }, [students, selectedGrade, searchQuery]);

  // 통계
  const stats = useMemo(() => {
    const total = students.length;
    const afterschoolCount = students.filter(s => s.afterschoolSummary?.enrolledCourseIds && s.afterschoolSummary.enrolledCourseIds.length > 0).length;
    const busCount = students.filter(s => s.busSummary?.assignedBusId || s.busSummary?.morningDestinationId).length;
    return { total, afterschoolCount, busCount };
  }, [students]);

  // 단일 학생 신규 등록
  const handleCreateStudent = async () => {
    if (!newStudent.name || !newStudent.studentEmail) {
      toast({ title: '입력 오류', description: '학생 이름과 계정 이메일을 입력해 주세요.', variant: 'destructive' });
      return;
    }
    const cleanEmail = newStudent.studentEmail.trim();
    if (!isStudentEmail(cleanEmail)) {
      toast({ 
        title: '계정 규칙 오류', 
        description: '학생 계정 이메일은 [입학년도 4자리+영문이름@kshcm.net] 형식을 따라야 합니다. (예: 2023kangdongyun@kshcm.net)', 
        variant: 'destructive' 
      });
      return;
    }

    try {
      await createMasterStudent({
        name: newStudent.name!,
        studentEmail: cleanEmail,
        grade: newStudent.grade || '1',
        classNum: newStudent.classNum || '1',
        studentNum: newStudent.studentNum || '1',
        gender: newStudent.gender || 'Male',
        contact: newStudent.contact || '',
        parentEmail: newStudent.parentEmail || '',
        address: newStudent.address || '',
        kisbusNo: newStudent.kisbusNo || ''
      });
      setIsAddDialogOpen(false);
      setNewStudent({
        name: '', studentEmail: '', grade: '1', classNum: '1', studentNum: '1',
        gender: 'Male', contact: '', parentEmail: '', address: '', kisbusNo: ''
      });
      toast({ title: '등록 완료', description: '통합 학생 마스터 계정이 성공적으로 등록되었습니다.' });
    } catch (err) {
      console.error(err);
      toast({ title: '오류', description: '학생 계정 생성 중 오류가 발생했습니다.', variant: 'destructive' });
    }
  };

  // 학생 정보 수정 저장
  const handleStartEditStudent = (student: MasterStudent) => {
    setEditStudentForm({ ...student });
    setIsEditDialogOpen(true);
  };

  const handleSaveEditStudent = async () => {
    if (!editStudentForm.studentId || !editStudentForm.name) return;
    try {
      await updateMasterStudent(editStudentForm.studentId, {
        name: editStudentForm.name,
        grade: String(editStudentForm.grade || '1'),
        classNum: String(editStudentForm.classNum || '1'),
        studentNum: String(editStudentForm.studentNum || ''),
        gender: editStudentForm.gender || 'Male',
        contact: editStudentForm.contact || '',
        address: editStudentForm.address || '',
        kisbusNo: editStudentForm.kisbusNo || ''
      });
      setIsEditDialogOpen(false);
      if (selectedStudent?.studentId === editStudentForm.studentId) {
        setSelectedStudent(prev => prev ? ({ ...prev, ...editStudentForm } as MasterStudent) : null);
      }
      toast({ title: '수정 완료', description: '학생 정보가 성공적으로 업데이트되었습니다.' });
    } catch (err) {
      console.error(err);
      toast({ title: '오류', description: '학생 정보 수정 중 오류가 발생했습니다.', variant: 'destructive' });
    }
  };

  // 학생 삭제
  const handleDeleteStudent = async (studentId: string) => {
    if (!confirm('정말 이 학생의 마스터 계정을 삭제하시겠습니까? 삭제 시 데이터 연동이 해제됩니다.')) return;
    try {
      await deleteMasterStudent(studentId);
      setIsDetailDialogOpen(false);
      setIsEditDialogOpen(false);
      setSelectedStudent(null);
      toast({ title: '삭제 완료', description: '학생 계정이 성공적으로 삭제되었습니다.' });
    } catch (err) {
      toast({ title: '오류', description: '삭제 실패', variant: 'destructive' });
    }
  };

  // 전교생 1학년씩 일괄 자동 진급 처리
  const handleAutoPromoteAll = async () => {
    if (students.length === 0) {
      toast({ title: '진급 처리 대상 없음', description: '등록된 학생이 없습니다.' });
      return;
    }
    if (!confirm(`현재 등록된 ${students.length}명의 학생을 새 학년으로 1학년씩 자동 진급 처리하시겠습니까?\n\n- 1학년 ➔ 2학년\n- 2학년 ➔ 3학년\n- 3학년 ➔ 4학년\n- 4학년 ➔ 5학년\n- 5학년 ➔ 6학년\n- 6학년 ➔ 졸업`)) return;

    try {
      const advancements = students.map(s => {
        const curG = parseInt(s.grade) || 1;
        const nextG = curG >= 6 ? '졸업' : String(curG + 1);
        return {
          studentEmail: s.studentEmail,
          newGrade: nextG,
          newClassNum: s.classNum || '1',
          newStudentNum: s.studentNum || '1'
        };
      });

      const count = await batchPromoteStudents(advancements);
      setIsPromoteDialogOpen(false);
      toast({ title: '진급 처리 완료', description: `총 ${count}명의 학생 학년이 성공적으로 업데이트되었습니다.` });
    } catch (err) {
      console.error(err);
      toast({ title: '진급 오류', description: '진급 처리 중 오류가 발생했습니다.', variant: 'destructive' });
    }
  };

  // 학년별 반 목록 및 학생 수 집계 트리
  const gradeClassTree = useMemo(() => {
    const grades = ['1', '2', '3', '4', '5', '6', '졸업'];
    const result: {
      grade: string;
      classes: { classNum: string; count: number; key: string }[];
      totalCount: number;
    }[] = [];

    grades.forEach(g => {
      const studentsInGrade = students.filter(s => String(s.grade) === g);
      if (studentsInGrade.length === 0 && g === '졸업') return;
      
      const classMap = new Map<string, number>();
      studentsInGrade.forEach(s => {
        const c = String(s.classNum || '1');
        classMap.set(c, (classMap.get(c) || 0) + 1);
      });

      const sortedClasses = Array.from(classMap.entries())
        .sort((a, b) => (parseInt(a[0]) || 0) - (parseInt(b[0]) || 0))
        .map(([classNum, count]) => ({
          classNum,
          count,
          key: `${g}-${classNum}`
        }));

      // 학생이 없더라도 1~6학년이면 기본 1~4반 표시
      if (sortedClasses.length === 0 && g !== '졸업') {
        ['1', '2', '3', '4'].forEach(c => {
          sortedClasses.push({ classNum: c, count: 0, key: `${g}-${c}` });
        });
      }

      result.push({
        grade: g,
        classes: sortedClasses,
        totalCount: studentsInGrade.length
      });
    });

    return result;
  }, [students]);

  // 전체 선택/해제 핸들러
  const handleSelectAllClassesForDownload = () => {
    const allKeys: string[] = [];
    gradeClassTree.forEach(g => {
      g.classes.forEach(c => allKeys.push(c.key));
    });
    setSelectedClassesForDownload(allKeys);
  };

  const handleDeselectAllClassesForDownload = () => {
    setSelectedClassesForDownload([]);
  };

  // 특정 학년 전체 토글
  const handleToggleGradeForDownload = (grade: string) => {
    const gradeItem = gradeClassTree.find(g => g.grade === grade);
    if (!gradeItem) return;
    const gradeKeys = gradeItem.classes.map(c => c.key);
    const allSelected = gradeKeys.every(k => selectedClassesForDownload.includes(k));
    
    if (allSelected) {
      setSelectedClassesForDownload(prev => prev.filter(k => !gradeKeys.includes(k)));
    } else {
      setSelectedClassesForDownload(prev => Array.from(new Set([...prev, ...gradeKeys])));
    }
  };

  // 단일 반 토글
  const handleToggleClassForDownload = (key: string) => {
    setSelectedClassesForDownload(prev => 
      prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]
    );
  };

  // 명단 다운로드 모달 열기 (초기값: 전체 선택)
  const handleOpenDownloadDialog = () => {
    const allKeys: string[] = [];
    gradeClassTree.forEach(g => {
      g.classes.forEach(c => allKeys.push(c.key));
    });
    setSelectedClassesForDownload(allKeys);
    setIsDownloadDialogOpen(true);
  };

  // 선택된 학년/반 학생 엑셀 명단 다운로드
  const handleDownloadFilteredExcel = () => {
    const targetStudents = students.filter(s => {
      const key = `${s.grade}-${s.classNum || '1'}`;
      return selectedClassesForDownload.includes(key);
    });

    if (targetStudents.length === 0) {
      toast({ title: '다운로드 오류', description: '선택된 학년/반에 해당하는 학생이 없습니다.', variant: 'destructive' });
      return;
    }

    import('xlsx').then(XLSX => {
      const headers = ["학생계정이메일", "학생이름", "학년", "반", "번호", "성별", "보호자연락처", "등하교목적지", "승차권번호"];
      const wsData = [
        headers,
        ...targetStudents.map(s => [
          s.studentEmail, s.name, s.grade, s.classNum, s.studentNum || '',
          s.gender === 'Male' ? '남' : '여', s.contact, s.address || '', s.kisbusNo || ''
        ])
      ];

      const ws = XLSX.utils.aoa_to_sheet(wsData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "학생명단");
      XLSX.writeFile(wb, `통합학생명단_${new Date().toISOString().split('T')[0]}.xlsx`);
      setIsDownloadDialogOpen(false);
      toast({ title: '명단 다운로드 완료', description: `총 ${targetStudents.length}명의 학생 명단이 다운로드되었습니다.` });
    });
  };

  // 진급 엑셀 양식 다운로드 (선택된 학년/반 기반 템플릿)
  const handleDownloadPromoteTemplate = (targetGrade?: string, targetClass?: string) => {
    const gFilter = targetGrade !== undefined ? targetGrade : promoteTemplateGrade;
    const cFilter = targetClass !== undefined ? targetClass : promoteTemplateClass;

    const filtered = students.filter(s => {
      if (gFilter !== 'all' && String(s.grade) !== String(gFilter)) return false;
      if (cFilter !== 'all' && String(s.classNum) !== String(cFilter)) return false;
      return true;
    }).sort((a, b) => {
      const gA = parseInt(a.grade) || 0;
      const gB = parseInt(b.grade) || 0;
      if (gA !== gB) return gA - gB;
      const cA = parseInt(a.classNum) || 0;
      const cB = parseInt(b.classNum) || 0;
      if (cA !== cB) return cA - cB;
      const nA = parseInt(a.studentNum || '0') || 0;
      const nB = parseInt(b.studentNum || '0') || 0;
      return nA - nB;
    });

    import('xlsx').then(XLSX => {
      const headers = ["학생계정이메일", "학생이름", "기존학년", "기존반", "기존번호", "신규학년", "신규반", "신규번호"];
      
      let rows: any[][] = [];
      if (filtered.length > 0) {
        rows = filtered.map(s => {
          const currentG = parseInt(s.grade || '1', 10);
          const nextG = !isNaN(currentG) && currentG < 6 ? String(currentG + 1) : (currentG >= 6 ? '졸업' : '1');
          return [
            s.studentEmail,
            s.name,
            s.grade,
            s.classNum,
            s.studentNum || '',
            nextG,
            '', // 신규반 (담임 교사가 직접 입력)
            ''  // 신규번호 (담임 교사가 직접 입력)
          ];
        });
      } else {
        rows = [
          ["2023kangdongyun@kshcm.net", "강동윤", "4", "4", "2", "5", "4", "2"]
        ];
      }

      const wsData = [headers, ...rows];
      const ws = XLSX.utils.aoa_to_sheet(wsData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "학생진급양식");
      
      const gradeStr = gFilter === 'all' ? '전체학년' : `${gFilter}학년`;
      const classStr = cFilter === 'all' ? '전체반' : `${cFilter}반`;
      XLSX.writeFile(wb, `학생진급서식_${gradeStr}_${classStr}_${new Date().toISOString().split('T')[0]}.xlsx`);
      toast({ title: '진급 양식 다운로드', description: `${gradeStr} ${classStr} (${rows.length}명) 진급 서식이 다운로드되었습니다.` });
    });
  };

  // 진급 엑셀 파일 업로드 처리
  const handlePromoteFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const XLSX = await import('xlsx');
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsName = wb.SheetNames[0];
        const ws = wb.Sheets[wsName];
        const data: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1 });

        if (!data || data.length < 2) {
          toast({ title: '업로드 오류', description: '엑셀 파일 내용이 비어있습니다.', variant: 'destructive' });
          return;
        }

        const advancements: { studentEmail: string; newGrade: string; newClassNum: string; newStudentNum: string }[] = [];
        for (let i = 1; i < data.length; i++) {
          const row = data[i];
          if (!row || row.length === 0 || !row[0]) continue;

          const email = String(row[0]).trim();
          if (!email || email === '학생계정이메일') continue;

          let newGrade = '1';
          let newClassNum = '1';
          let newStudentNum = '1';

          if (row.length >= 8) {
            // 8열 양식: [0]:이메일, [1]:이름, [2]:기존학년, [3]:기존반, [4]:기존번호, [5]:신규학년, [6]:신규반, [7]:신규번호
            newGrade = String(row[5] ?? row[1] ?? '1').trim();
            newClassNum = String(row[6] ?? row[2] ?? '1').trim();
            newStudentNum = String(row[7] ?? row[3] ?? '1').trim();
          } else {
            // 4열 양식: [0]:이메일, [1]:신규학년, [2]:신규반, [3]:신규번호
            newGrade = String(row[1] ?? '1').trim();
            newClassNum = String(row[2] ?? '1').trim();
            newStudentNum = String(row[3] ?? '1').trim();
          }

          advancements.push({
            studentEmail: email,
            newGrade,
            newClassNum,
            newStudentNum
          });
        }

        if (advancements.length > 0) {
          const count = await batchPromoteStudents(advancements);
          setIsPromoteDialogOpen(false);
          toast({ title: '진급 파일 적용 성공', description: `총 ${count}명의 학생 학년/반/번호 정보가 업로드된 엑셀 데이터로 성공적으로 일괄 업데이트되었습니다.` });
        } else {
          toast({ title: '업로드 알림', description: '처리 가능한 유효한 진급 데이터가 없습니다.', variant: 'destructive' });
        }
      } catch (err) {
        console.error(err);
        toast({ title: '오류', description: '진급 엑셀 파싱 중 오류가 발생했습니다.', variant: 'destructive' });
      }
    };
    reader.readAsBinaryString(file);
    if (promoteFileInputRef.current) promoteFileInputRef.current.value = "";
  };

  // 엑셀 명단 다운로드
  const handleDownloadExcel = () => {
    if (students.length === 0) return;
    import('xlsx').then(XLSX => {
      const headers = ["학생계정이메일", "학생이름", "학년", "반", "번호", "성별", "보호자연락처", "주소", "승차권번호"];
      const wsData = [
        headers,
        ...students.map(s => [
          s.studentEmail, s.name, s.grade, s.classNum, s.studentNum || '',
          s.gender === 'Male' ? '남' : '여', s.contact, s.address || '', s.kisbusNo || ''
        ])
      ];
      const ws = XLSX.utils.aoa_to_sheet(wsData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "학생마스터명단");
      XLSX.writeFile(wb, `통합학생마스터명단_${new Date().toISOString().split('T')[0]}.xlsx`);
    });
  };

  // 엑셀 일괄 생성 업로드
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const XLSX = await import('xlsx');
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsName = wb.SheetNames[0];
        const ws = wb.Sheets[wsName];
        const data: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1 });

        const newStudentsList: NewMasterStudent[] = [];
        for (let i = 1; i < data.length; i++) {
          const row = data[i];
          if (!row || row.length === 0 || !row[0]) continue;
          const email = String(row[0]).trim();
          const name = String(row[1] || '').trim();
          if (!email || !name) continue;

          newStudentsList.push({
            studentEmail: email,
            name: name,
            grade: String(row[2] || '1'),
            classNum: String(row[3] || '1'),
            studentNum: String(row[4] || '1'),
            gender: row[5] === '여' ? 'Female' : 'Male',
            contact: String(row[6] || ''),
            address: String(row[7] || ''),
            kisbusNo: String(row[8] || '')
          });
        }

        if (newStudentsList.length > 0) {
          const count = await batchImportMasterStudents(newStudentsList);
          toast({ title: '업로드 성공', description: `${count}명의 학생 계정이 마스터 DB에 일괄 생성되었습니다.` });
        }
      } catch (err) {
        console.error(err);
        toast({ title: '오류', description: '엑셀 파싱 중 오류가 발생했습니다.', variant: 'destructive' });
      }
    };
    reader.readAsBinaryString(file);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  return (
    <MainLayout>
      <div className="space-y-6">
        {/* 1. 상단 통계 & 헤더 대시보드 */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-gradient-to-r from-indigo-900 via-indigo-800 to-slate-900 text-white p-6 rounded-3xl shadow-lg border border-indigo-700/50">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Badge className="bg-indigo-500/30 text-indigo-200 border-indigo-400/40 text-xs px-2.5 py-0.5 font-bold whitespace-nowrap">
                Single Source of Truth
              </Badge>
              <span className="text-xs text-indigo-200 whitespace-nowrap">통합 학생 마스터 계정 관리소</span>
            </div>
            <h1 className="text-2xl font-black tracking-tight whitespace-nowrap">통합 학생 마스터 계정 대시보드</h1>
            <p className="text-xs text-indigo-200/90 max-w-xl leading-relaxed">
              학생 계정 이메일(예: 2023kangdongyun@kshcm.net) 하나로 학부모와 학생이 공통 이용하며, 정보 수정/진급 처리/방과후/스쿨버스/출결/체험학습을 통합 관리합니다.
            </p>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <div className="bg-white/10 backdrop-blur-md rounded-2xl p-3 border border-white/10 text-center min-w-[90px]">
              <p className="text-[10px] text-indigo-200 font-bold whitespace-nowrap">전교생 등록 계정</p>
              <p className="text-xl font-black text-white">{stats.total}명</p>
            </div>
            <div className="bg-white/10 backdrop-blur-md rounded-2xl p-3 border border-white/10 text-center min-w-[90px]">
              <p className="text-[10px] text-indigo-200 font-bold whitespace-nowrap">방과후 수강중</p>
              <p className="text-xl font-black text-emerald-300">{stats.afterschoolCount}명</p>
            </div>
            <div className="bg-white/10 backdrop-blur-md rounded-2xl p-3 border border-white/10 text-center min-w-[90px]">
              <p className="text-[10px] text-indigo-200 font-bold whitespace-nowrap">스쿨버스 이용중</p>
              <p className="text-xl font-black text-sky-300">{stats.busCount}명</p>
            </div>
          </div>
        </div>

        {/* 2. 학생 명단 컨트롤 툴바 & 관리 기능 */}
        <Card className="rounded-2xl shadow-xs border-slate-200/80">
          <CardHeader className="pb-3 border-b border-slate-100">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <CardTitle className="text-lg font-bold text-slate-800 whitespace-nowrap flex items-center gap-2">
                  <Users className="h-5 w-5 text-indigo-600" /> 통합 학생 계정 명단 ({filteredStudents.length}명)
                </CardTitle>
                <CardDescription className="text-xs text-slate-500 mt-0.5">
                  학생 정보 수정, 계정 추가/삭제, 진급 처리(학년/반 변경)를 직접 관리합니다.
                </CardDescription>
              </div>

              {/* 관리 액션 버튼 그룹 (한 줄 정렬) */}
              <div className="flex items-center gap-2 flex-wrap shrink-0">
                {/* 1. 🎓 진급 처리 모달 */}
                <Dialog open={isPromoteDialogOpen} onOpenChange={setIsPromoteDialogOpen}>
                  <DialogTrigger asChild>
                    <Button size="sm" className="h-8 text-xs px-2.5 font-bold whitespace-nowrap bg-purple-600 hover:bg-purple-700 text-white shadow-xs">
                      <GraduationCap className="mr-1.5 h-3.5 w-3.5" /> 진급 처리
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-lg">
                    <DialogHeader>
                      <DialogTitle className="text-lg font-bold flex items-center gap-2">
                        <GraduationCap className="h-5 w-5 text-purple-600" /> 새 학년 진급 일괄 처리
                      </DialogTitle>
                      <DialogDescription className="text-xs">
                        새 학년도 개학 시 전교생의 학년/반 정보를 일괄 업로드하거나 1학년씩 일괄 진급합니다.
                      </DialogDescription>
                    </DialogHeader>

                    <Tabs defaultValue="excel" className="w-full py-2">
                      <TabsList className="grid grid-cols-2 w-full">
                        <TabsTrigger value="excel" className="text-xs font-bold">진급 엑셀 파일 업로드</TabsTrigger>
                        <TabsTrigger value="auto" className="text-xs font-bold">전교생 자동 +1학년 진급</TabsTrigger>
                      </TabsList>

                      <TabsContent value="excel" className="space-y-3 pt-3">
                        <div className="p-3.5 bg-purple-50 border border-purple-200 rounded-xl text-xs space-y-3">
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-purple-950 flex items-center gap-1.5">
                              <GraduationCap className="w-4 h-4 text-purple-700" />
                              <span>진급 서식 양식 다운로드 (이전 학년 담임용)</span>
                            </span>
                          </div>
                          
                          <p className="text-purple-800 text-[11px] leading-relaxed">
                            이전 학년 담임 교사가 직접 진급할 학생의 새 학년/반을 작성할 수 있도록, <strong>원하는 학년과 반을 선택하여 서식을 다운로드</strong>하세요.
                          </p>

                          {/* 학년 및 반 선택 필터 바 */}
                          <div className="grid grid-cols-2 gap-2 bg-white p-2.5 rounded-lg border border-purple-200">
                            <div className="space-y-1">
                              <Label className="text-[11px] font-bold text-purple-900">학년 선택</Label>
                              <Select value={promoteTemplateGrade} onValueChange={(val) => {
                                setPromoteTemplateGrade(val);
                                setPromoteTemplateClass('all');
                              }}>
                                <SelectTrigger className="h-8 text-xs bg-purple-50/50">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="all">전체 학년</SelectItem>
                                  <SelectItem value="1">1학년</SelectItem>
                                  <SelectItem value="2">2학년</SelectItem>
                                  <SelectItem value="3">3학년</SelectItem>
                                  <SelectItem value="4">4학년</SelectItem>
                                  <SelectItem value="5">5학년</SelectItem>
                                  <SelectItem value="6">6학년</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                            <div className="space-y-1">
                              <Label className="text-[11px] font-bold text-purple-900">반 선택</Label>
                              <Select value={promoteTemplateClass} onValueChange={setPromoteTemplateClass}>
                                <SelectTrigger className="h-8 text-xs bg-purple-50/50">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="all">전체 반</SelectItem>
                                  {promoteTemplateGrade !== 'all' ? (
                                    (gradeClassTree.find(g => g.grade === promoteTemplateGrade)?.classes || []).map(c => (
                                      <SelectItem key={c.classNum} value={c.classNum}>{c.classNum}반 ({c.count}명)</SelectItem>
                                    ))
                                  ) : (
                                    ['1', '2', '3', '4', '5', '6', '7', '8'].map(c => (
                                      <SelectItem key={c} value={c}>{c}반</SelectItem>
                                    ))
                                  )}
                                </SelectContent>
                              </Select>
                            </div>
                          </div>

                          <Button 
                            type="button" 
                            size="sm" 
                            onClick={() => handleDownloadPromoteTemplate()}
                            className="w-full h-8 text-xs font-bold bg-purple-700 hover:bg-purple-800 text-white shadow-xs"
                          >
                            <Download className="w-3.5 h-3.5 mr-1 text-white shrink-0" />
                            {promoteTemplateGrade === 'all' ? '전체 학년' : `${promoteTemplateGrade}학년`} {promoteTemplateClass === 'all' ? '전체 반' : `${promoteTemplateClass}반`} 진급 서식 (.xlsx) 다운로드
                          </Button>
                        </div>

                        <div className="space-y-1 pt-1">
                          <Label className="text-xs font-bold text-slate-700">작성 완료된 진급 서식 엑셀 파일 업로드</Label>
                          <Input type="file" ref={promoteFileInputRef} onChange={handlePromoteFileUpload} accept=".xlsx, .xls" className="text-xs h-9 cursor-pointer" />
                        </div>
                      </TabsContent>

                      <TabsContent value="auto" className="space-y-3 pt-3">
                        <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs space-y-1">
                          <p className="font-bold text-amber-900">자동 진급 규칙</p>
                          <p className="text-amber-800">
                            1학년 ➔ 2학년, 2학년 ➔ 3학년, 3학년 ➔ 4학년, 4학년 ➔ 5학년, 5학년 ➔ 6학년, 6학년 ➔ 졸업으로 전교생 학년이 +1 업데이트됩니다.
                          </p>
                        </div>
                        <Button onClick={handleAutoPromoteAll} className="w-full bg-purple-600 hover:bg-purple-700 text-white font-bold">
                          <Sparkles className="mr-1.5 h-4 w-4" /> 전교생 1학년씩 자동 진급 실행
                        </Button>
                      </TabsContent>
                    </Tabs>
                  </DialogContent>
                </Dialog>

                {/* 2. 개별 계정 추가 */}
                <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
                  <DialogTrigger asChild>
                    <Button size="sm" className="h-8 text-xs px-2.5 font-bold whitespace-nowrap bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs">
                      <Plus className="mr-1.5 h-3.5 w-3.5" /> 개별 계정 추가
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-md">
                    <DialogHeader>
                      <DialogTitle className="text-lg font-bold">새 학생 마스터 계정 등록</DialogTitle>
                      <DialogDescription className="text-xs">
                        학생 이메일 계정(2023kangdongyun@kshcm.net) 기반으로 등록합니다.
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-3 py-2 text-sm">
                      <div className="space-y-1">
                        <Label className="text-xs font-bold">학생 이메일 계정 (학부모 겸용)</Label>
                        <Input 
                          placeholder="예: 2023kangdongyun@kshcm.net" 
                          value={newStudent.studentEmail} 
                          onChange={e => setNewStudent({...newStudent, studentEmail: e.target.value})} 
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs font-bold">학생 이름</Label>
                        <Input 
                          placeholder="예: 강동윤" 
                          value={newStudent.name} 
                          onChange={e => setNewStudent({...newStudent, name: e.target.value})} 
                        />
                      </div>
                      <div className="grid grid-cols-3 gap-2">
                        <div>
                          <Label className="text-xs">학년</Label>
                          <Input value={newStudent.grade} onChange={e => setNewStudent({...newStudent, grade: e.target.value})} />
                        </div>
                        <div>
                          <Label className="text-xs">반</Label>
                          <Input value={newStudent.classNum} onChange={e => setNewStudent({...newStudent, classNum: e.target.value})} />
                        </div>
                        <div>
                          <Label className="text-xs">번호</Label>
                          <Input value={newStudent.studentNum || ''} onChange={e => setNewStudent({...newStudent, studentNum: e.target.value})} />
                        </div>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">보호자 연락처</Label>
                        <Input placeholder="010-0000-0000" value={newStudent.contact} onChange={e => setNewStudent({...newStudent, contact: e.target.value})} />
                      </div>
                      <div className="space-y-1">
                        <div className="flex items-center justify-between">
                          <Label className="text-xs text-slate-700 font-bold">등하교 목적지 (스쿨버스 정류장)</Label>
                          <span className="text-[10px] text-indigo-600 font-medium">📍 정류장 검색 선택</span>
                        </div>
                        <Combobox 
                          options={destinationOptions}
                          value={newStudent.address || null}
                          onSelect={(val) => setNewStudent({ ...newStudent, address: val || '' })}
                          placeholder="스쿨버스 정류장/목적지 검색 (예: Hung Vuong KFC, Sky 1,2...)"
                        />
                      </div>
                    </div>
                    <DialogFooter>
                      <Button onClick={handleCreateStudent} className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold">등록하기</Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>

                {/* 3. 엑셀 일괄 등록 */}
                <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()} className="h-8 text-xs px-2.5 font-bold whitespace-nowrap">
                  <Upload className="mr-1.5 h-3.5 w-3.5" /> 엑셀 일괄 등록
                </Button>
                {/* 4. 명단 다운로드 */}
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={handleOpenDownloadDialog} 
                  className="h-8 text-xs px-2.5 font-bold whitespace-nowrap text-indigo-700 border-indigo-200 hover:bg-indigo-50"
                >
                  <Download className="mr-1.5 h-3.5 w-3.5" /> 명단 다운로드
                </Button>
                <input type="file" ref={fileInputRef} onChange={handleFileUpload} accept=".xlsx, .xls" className="hidden" />
              </div>
            </div>

            {/* 필터 및 검색 바 */}
            <div className="flex flex-col sm:flex-row items-center gap-3 pt-3">
              <div className="relative flex-1 w-full">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
                <Input
                  placeholder="학생 이름, 이메일(2023kangdongyun...), 학년 반으로 검색..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="pl-9 h-9 text-xs"
                />
              </div>
              <div className="flex items-center gap-2 shrink-0 w-full sm:w-auto">
                <span className="text-xs font-bold text-slate-600 whitespace-nowrap">학년 필터:</span>
                <Select value={selectedGrade} onValueChange={setSelectedGrade}>
                  <SelectTrigger className="h-9 w-[110px] text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">전체 학년</SelectItem>
                    <SelectItem value="1">1학년</SelectItem>
                    <SelectItem value="2">2학년</SelectItem>
                    <SelectItem value="3">3학년</SelectItem>
                    <SelectItem value="4">4학년</SelectItem>
                    <SelectItem value="5">5학년</SelectItem>
                    <SelectItem value="6">6학년</SelectItem>
                    <SelectItem value="졸업">졸업생</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardHeader>

          {/* 3. 학생 마스터 테이블 */}
          <CardContent className="pt-4">
            <div className="rounded-xl border border-slate-200 overflow-x-auto shadow-2xs">
              <Table>
                <TableHeader className="bg-slate-50">
                  <TableRow>
                    <TableHead className="w-[110px] whitespace-nowrap font-bold text-slate-700">학년/반/번호</TableHead>
                    <TableHead className="whitespace-nowrap font-bold text-slate-700">학생 이름</TableHead>
                    <TableHead className="whitespace-nowrap font-bold text-slate-700">학생 계정 이메일 (학부모 겸용)</TableHead>
                    <TableHead className="whitespace-nowrap font-bold text-slate-700">보호자 연락처</TableHead>
                    <TableHead className="whitespace-nowrap font-bold text-slate-700">방과후 수강 현황</TableHead>
                    <TableHead className="whitespace-nowrap font-bold text-slate-700">스쿨버스 노선</TableHead>
                    <TableHead className="text-right whitespace-nowrap font-bold text-slate-700">관리/작업</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredStudents.length > 0 ? (
                    filteredStudents.map(student => (
                      <TableRow key={student.studentId} className="hover:bg-slate-50/80 transition-colors">
                        <TableCell className="whitespace-nowrap font-medium text-slate-700">
                          {student.grade}학년 {student.classNum}반 {student.studentNum ? `${student.studentNum}번` : ''}
                        </TableCell>
                        <TableCell className="whitespace-nowrap">
                          <button 
                            className="font-bold text-indigo-700 hover:text-indigo-900 hover:underline flex items-center gap-1.5 text-sm"
                            onClick={() => {
                              setSelectedStudent(student);
                              setIsDetailDialogOpen(true);
                            }}
                          >
                            {student.name}
                            <Badge variant="outline" className="text-[10px] bg-indigo-50 border-indigo-200 text-indigo-700 font-normal">
                              통합 프로필
                            </Badge>
                          </button>
                        </TableCell>
                        <TableCell className="whitespace-nowrap font-mono text-xs text-slate-600">
                          {student.studentEmail}
                        </TableCell>
                        <TableCell className="whitespace-nowrap text-xs text-slate-600">
                          {student.contact || '-'}
                        </TableCell>
                        <TableCell className="whitespace-nowrap">
                          {student.afterschoolSummary?.enrolledCourseTitles && student.afterschoolSummary.enrolledCourseTitles.length > 0 ? (
                            <Badge variant="secondary" className="bg-emerald-50 text-emerald-700 border border-emerald-200 text-[11px] whitespace-nowrap font-bold">
                              {student.afterschoolSummary.enrolledCourseTitles.length}개 강좌 수강 중
                            </Badge>
                          ) : (
                            <span className="text-xs text-slate-400 italic whitespace-nowrap">미수강</span>
                          )}
                        </TableCell>
                        <TableCell className="whitespace-nowrap">
                          {student.busSummary?.assignedBusName ? (
                            <Badge variant="outline" className="bg-sky-50 text-sky-700 border-sky-200 text-[11px] whitespace-nowrap font-bold">
                              {student.busSummary.assignedBusName}
                            </Badge>
                          ) : (
                            <span className="text-xs text-slate-400 italic whitespace-nowrap">자가 귀가</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right whitespace-nowrap">
                          <Button 
                            variant="outline" 
                            size="sm" 
                            className="h-7 text-xs px-2 text-indigo-700 hover:bg-indigo-50 border-indigo-200 mr-1"
                            onClick={() => handleStartEditStudent(student)}
                          >
                            <Edit3 className="h-3.5 w-3.5 mr-1" /> 정보 수정
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            className="h-7 text-xs px-2 text-rose-600 hover:bg-rose-50"
                            onClick={() => handleDeleteStudent(student.studentId)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={7} className="h-32 text-center text-slate-500 whitespace-nowrap">
                        등록된 실제 학생 계정이 없습니다. <b>[개별 계정 추가]</b> 또는 <b>[엑셀 일괄 등록]</b>을 이용해 학생 계정(2023kangdongyun@kshcm.net)을 생성해 주세요.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        {/* 4. 학생 정보 수정 모달 */}
        <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
          <DialogContent className="sm:max-w-[480px] w-[95vw] max-h-[90vh] overflow-y-auto p-5 sm:p-6 rounded-2xl">
            <DialogHeader className="pb-1">
              <DialogTitle className="text-base font-bold flex items-center gap-2">
                <Edit3 className="h-4 w-4 text-indigo-600 shrink-0" /> 학생 마스터 정보 수정
              </DialogTitle>
              <DialogDescription className="text-xs text-slate-500">
                {editStudentForm.studentEmail} 학생의 계정 인적사항을 수정합니다.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-2.5 py-1 text-xs">
              <div className="space-y-1">
                <Label className="text-xs font-bold text-slate-700">학생 이메일 계정</Label>
                <Input value={editStudentForm.studentEmail || ''} disabled className="h-8 bg-slate-100 font-mono text-xs text-slate-600" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs font-bold text-slate-700">학생 이름</Label>
                <Input 
                  value={editStudentForm.name || ''} 
                  onChange={e => setEditStudentForm({...editStudentForm, name: e.target.value})} 
                  className="h-8 text-xs"
                />
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div className="space-y-1">
                  <Label className="text-xs text-slate-600">학년</Label>
                  <Input value={editStudentForm.grade || ''} onChange={e => setEditStudentForm({...editStudentForm, grade: e.target.value})} className="h-8 text-xs" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-slate-600">반</Label>
                  <Input value={editStudentForm.classNum || ''} onChange={e => setEditStudentForm({...editStudentForm, classNum: e.target.value})} className="h-8 text-xs" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-slate-600">번호</Label>
                  <Input value={editStudentForm.studentNum || ''} onChange={e => setEditStudentForm({...editStudentForm, studentNum: e.target.value})} className="h-8 text-xs" />
                </div>
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-slate-600">보호자 연락처</Label>
                <Input value={editStudentForm.contact || ''} onChange={e => setEditStudentForm({...editStudentForm, contact: e.target.value})} className="h-8 text-xs" />
              </div>
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <Label className="text-xs text-slate-700 font-bold">등하교 목적지 (스쿨버스 정류장)</Label>
                  <span className="text-[10px] text-indigo-600 font-medium">📍 정류장 검색 선택</span>
                </div>
                <Combobox 
                  options={destinationOptions}
                  value={editStudentForm.address || null}
                  onSelect={(val) => setEditStudentForm({ ...editStudentForm, address: val || '' })}
                  placeholder="스쿨버스 정류장/목적지 검색 (예: Hung Vuong KFC, Sky 1,2...)"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs font-bold text-slate-600 flex items-center justify-between">
                  <span>배정된 스쿨버스</span>
                  <Badge variant="outline" className="text-[10px] bg-slate-100 text-slate-600 font-normal">수정 불가 (조회 전용)</Badge>
                </Label>
                <Input value={editStudentForm.kisbusNo || editStudentForm.busSummary?.assignedBusName || '미배정 (자가 귀가)'} disabled className="h-8 bg-slate-100 font-mono text-xs text-slate-600 cursor-not-allowed" />
              </div>
            </div>
            <DialogFooter className="pt-2">
              <Button onClick={handleSaveEditStudent} className="w-full h-9 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-xs">수정 내용 저장</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* 5. 학생 1인 4-in-1 통합 프로필 상세 모달 (학학년도 아카이브 누적 조회 지원) */}
        {selectedStudent && (() => {
          const currentYearNum = new Date().getFullYear();
          const historyList = selectedStudent.academicHistory || [];
          const selectedHist = historyList.find(h => h.academicYear === selectedAcademicYear);

          const displayGradeStr = selectedHist ? selectedHist.grade : selectedStudent.grade;
          const displayClassStr = selectedHist ? selectedHist.classNum : selectedStudent.classNum;
          const displayNumStr = selectedHist ? selectedHist.studentNum : selectedStudent.studentNum;
          const isArchivedYear = selectedAcademicYear !== currentYearNum;

          return (
            <Dialog open={isDetailDialogOpen} onOpenChange={setIsDetailDialogOpen}>
              <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto p-5 sm:p-6 rounded-2xl">
                <DialogHeader className="pb-2 border-b border-slate-200">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="p-3 bg-indigo-100 text-indigo-700 rounded-2xl shrink-0">
                        <UserCheck className="h-6 w-6" />
                      </div>
                      <div>
                        <DialogTitle className="text-xl font-bold text-slate-900 flex items-center gap-2 flex-wrap">
                          <span>{selectedStudent.name} 학생 통합 마스터 프로필</span>
                          <Badge className="bg-indigo-600 text-white text-xs font-bold">
                            {displayGradeStr}학년 {displayClassStr}반 {displayNumStr ? `${displayNumStr}번` : ''}
                          </Badge>
                        </DialogTitle>
                        <DialogDescription className="text-xs text-slate-500 font-mono mt-0.5">
                          계정 ID: {selectedStudent.studentEmail}
                        </DialogDescription>
                      </div>
                    </div>
                    <Button variant="outline" size="sm" onClick={() => handleStartEditStudent(selectedStudent)} className="h-8 text-xs font-bold border-indigo-200 text-indigo-700 hover:bg-indigo-50 shrink-0">
                      <Edit3 className="mr-1 h-3.5 w-3.5" /> 정보 수정
                    </Button>
                  </div>

                  {/* ★★★ [학학년도 선택 셀렉터 바 - 누적 이력 아카이브 뷰어] ★★★ */}
                  <div className="bg-gradient-to-r from-indigo-900 to-slate-900 text-white p-3 rounded-xl mt-3 space-y-1.5 shadow-sm">
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-extrabold text-indigo-200 whitespace-nowrap">📅 조회 학학년도 선택:</span>
                        <Select value={String(selectedAcademicYear)} onValueChange={(val) => setSelectedAcademicYear(parseInt(val, 10))}>
                          <SelectTrigger className="h-8 text-xs bg-white text-slate-900 font-bold border-0 w-60 shadow-xs focus:ring-2 focus:ring-amber-400">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent className="bg-white">
                            <SelectItem value={String(currentYearNum)} className="text-xs font-bold text-indigo-950">
                              {currentYearNum}학년도 ({selectedStudent.grade}학년 - 현재 학학년도)
                            </SelectItem>
                            {historyList.map(h => (
                              <SelectItem key={h.academicYear} value={String(h.academicYear)} className="text-xs font-semibold text-slate-800">
                                {h.academicYear}학년도 ({h.grade}학년 {h.classNum}반 - 아카이브 기록)
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      {isArchivedYear ? (
                        <Badge className="bg-amber-400 text-amber-950 font-black text-xs px-2.5 py-0.5 shadow-xs">
                          {selectedAcademicYear}학년도 과거 아카이브 데이터 세트 조회 중
                        </Badge>
                      ) : (
                        <Badge className="bg-indigo-700/80 text-indigo-100 font-bold text-[11px] px-2 py-0.5">
                          {currentYearNum}학년도 현재 학적 기준
                        </Badge>
                      )}
                    </div>
                    <p className="text-[11px] text-indigo-200/90 font-medium">
                      💡 <strong>과거 학년도 기록 조회 방법</strong>: 상단 드롭다운에서 원하는 학학년도를 선택하면, 해당 학년도 당시의 <strong>[출결 서류], [교외체험학습 승인서], [방과후 수강이력], [스쿨버스 지정 노선]</strong>이 그대로 전환되어 조회됩니다.
                    </p>
                  </div>
                </DialogHeader>

                {/* 5개 탭 메인 메뉴 */}
                <Tabs defaultValue="profile" className="w-full mt-3">
                  <TabsList className="grid grid-cols-5 w-full bg-slate-100 p-1 rounded-xl">
                    <TabsTrigger value="profile" className="text-xs font-bold whitespace-nowrap">기본 인적사항</TabsTrigger>
                    <TabsTrigger value="afterschool" className="text-xs font-bold whitespace-nowrap">방과후 & 청구</TabsTrigger>
                    <TabsTrigger value="bus" className="text-xs font-bold whitespace-nowrap">스쿨버스 노선</TabsTrigger>
                    <TabsTrigger value="attendance" className="text-xs font-bold whitespace-nowrap">출결 & 체험학습</TabsTrigger>
                    <TabsTrigger value="history" className="text-xs font-bold whitespace-nowrap text-purple-700">과거 학적 이력 ({historyList.length})</TabsTrigger>
                  </TabsList>

                  {/* Tab 1: 기본 인적사항 */}
                  <TabsContent value="profile" className="space-y-3 pt-3">
                    <div className="grid grid-cols-2 gap-3 text-xs">
                      <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                        <span className="text-slate-500 block mb-1">학생 이메일 계정 (학부모 겸용 고유 ID)</span>
                        <span className="font-mono font-bold text-slate-800 text-sm">{selectedStudent.studentEmail}</span>
                      </div>
                      <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                        <span className="text-slate-500 block mb-1">보호자 연락처</span>
                        <span className="font-bold text-slate-800 text-sm">{selectedStudent.contact || '미등록'}</span>
                      </div>
                      <div className="p-3 rounded-xl bg-indigo-50/70 border border-indigo-200">
                        <span className="text-indigo-700 block mb-1 font-semibold">현재 선택된 학학년도 학적</span>
                        <span className="font-bold text-indigo-950 text-sm">
                          {selectedAcademicYear}학년도 ({displayGradeStr}학년 {displayClassStr}반 {displayNumStr ? `${displayNumStr}번` : ''})
                          {isArchivedYear && <span className="ml-1.5 text-xs text-amber-700 font-bold">(아카이브 기록)</span>}
                        </span>
                      </div>
                      <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                        <span className="text-slate-500 block mb-1">성별 / 승차권 카드 번호</span>
                        <span className="font-bold text-slate-800">
                          {selectedStudent.gender === 'Male' ? '남성' : '여성'} {selectedStudent.kisbusNo ? `(카드: ${selectedStudent.kisbusNo})` : ''}
                        </span>
                      </div>
                    </div>
                    <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs">
                      <span className="text-slate-500 block mb-1">등하교 목적지</span>
                      <span className="font-medium text-slate-800">{selectedStudent.address || '등록된 목적지 정보가 없습니다.'}</span>
                    </div>
                  </TabsContent>

                {/* Tab 2: 방과후 수강 & 청구 현황 */}
                <TabsContent value="afterschool" className="space-y-3 pt-4">
                  <div className="p-4 rounded-xl bg-emerald-50/80 border border-emerald-200 text-xs space-y-2">
                    <h5 className="font-bold text-emerald-900 flex items-center gap-1.5 text-sm">
                      <GraduationCap className="h-4 w-4" /> 방과후 수강 및 납부 요약
                    </h5>
                    <div className="flex justify-between items-center pt-1 border-t border-emerald-200/60">
                      <span className="text-slate-600">수강 중인 강좌 수:</span>
                      <span className="font-bold text-emerald-800">{selectedStudent.afterschoolSummary?.enrolledCourseIds?.length || 0}개 강좌</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-slate-600">총 청구 수강료:</span>
                      <span className="font-black text-emerald-900 text-sm">
                        {(selectedStudent.afterschoolSummary?.totalTuition || 0).toLocaleString()}원
                      </span>
                    </div>
                  </div>
                </TabsContent>

                {/* Tab 3: 스쿨버스 노선 & 목적지 */}
                <TabsContent value="bus" className="space-y-3 pt-4">
                  <div className="p-4 rounded-xl bg-sky-50/80 border border-sky-200 text-xs space-y-2">
                    <h5 className="font-bold text-sky-900 flex items-center gap-1.5 text-sm">
                      <Bus className="h-4 w-4" /> 등하교 버스 노선 및 목적지 정보
                    </h5>
                    <div className="grid grid-cols-2 gap-2 pt-1">
                      <div className="bg-white/80 p-2.5 rounded-lg border border-sky-100">
                        <span className="text-slate-500 block">배정된 스쿨버스</span>
                        <span className="font-bold text-sky-900">{selectedStudent.busSummary?.assignedBusName || '자가 귀가'}</span>
                      </div>
                      <div className="bg-white/80 p-2.5 rounded-lg border border-sky-100">
                        <span className="text-slate-500 block">좌석 번호</span>
                        <span className="font-bold text-sky-900">{selectedStudent.busSummary?.assignedSeatNumber ? `${selectedStudent.busSummary.assignedSeatNumber}번` : '미배정'}</span>
                      </div>
                      <div className="col-span-2 bg-white/80 p-2.5 rounded-lg border border-sky-100">
                        <span className="text-slate-500 block">등/하교 목적지 정류장 (거주지 연동)</span>
                        <span className="font-bold text-sky-900">{selectedStudent.address || selectedStudent.busSummary?.morningDestinationId || '미등록'}</span>
                      </div>
                    </div>
                  </div>
                </TabsContent>

                {/* Tab 4: 출결 & 체험학습 */}
                <TabsContent value="attendance" className="space-y-3 pt-4">
                  <div className="p-4 rounded-xl bg-amber-50/80 border border-amber-200 text-xs space-y-2">
                    <h5 className="font-bold text-amber-900 flex items-center gap-1.5 text-sm">
                      <Calendar className="h-4 w-4" /> 출결 및 체험학습 서류 요약
                    </h5>
                    <p className="text-slate-600">
                      누적 결석/지각 기록 및 체험학습 승인 서류가 이 계정과 통합 동기화되어 관리됩니다.
                    </p>
                  </div>
                </TabsContent>
              </Tabs>
            </DialogContent>
          </Dialog>
          );
        })()}

        {/* 6. 엑셀 명단 다운로드 학년/반 선택 팝업 모달 */}
        <Dialog open={isDownloadDialogOpen} onOpenChange={setIsDownloadDialogOpen}>
          <DialogContent className="sm:max-w-xl w-[95vw] max-h-[90vh] overflow-y-auto p-5 sm:p-6 rounded-2xl">
            <DialogHeader className="pb-2 border-b border-slate-200">
              <div className="flex items-center justify-between">
                <DialogTitle className="text-lg font-bold flex items-center gap-2 text-slate-900">
                  <Download className="h-5 w-5 text-indigo-600" />
                  <span>학생 명단 엑셀 다운로드 (학년/반 선택)</span>
                </DialogTitle>
              </div>
              <DialogDescription className="text-xs text-slate-500">
                다운로드할 학년과 반을 체크박스로 선택해주세요.
              </DialogDescription>
            </DialogHeader>

            {/* 빠른 선택 바 */}
            <div className="flex items-center justify-between bg-slate-50 p-2.5 rounded-xl border border-slate-200 text-xs">
              <span className="font-bold text-slate-700">
                선택된 대상: <strong className="text-indigo-600">{
                  students.filter(s => selectedClassesForDownload.includes(`${s.grade}-${s.classNum || '1'}`)).length
                }명</strong> / 전체 {students.length}명
              </span>
              <div className="flex items-center gap-1.5">
                <Button 
                  type="button" 
                  variant="outline" 
                  size="sm" 
                  onClick={handleSelectAllClassesForDownload} 
                  className="h-7 text-xs font-semibold px-2"
                >
                  전체 선택
                </Button>
                <Button 
                  type="button" 
                  variant="outline" 
                  size="sm" 
                  onClick={handleDeselectAllClassesForDownload} 
                  className="h-7 text-xs font-semibold px-2 text-slate-500"
                >
                  전체 해제
                </Button>
              </div>
            </div>

            {/* 학년별 반 선택 체크박스 그리드 */}
            <div className="space-y-3 py-1">
              {gradeClassTree.map((gItem) => {
                const gradeKeys = gItem.classes.map(c => c.key);
                const allSelected = gradeKeys.length > 0 && gradeKeys.every(k => selectedClassesForDownload.includes(k));
                const someSelected = gradeKeys.some(k => selectedClassesForDownload.includes(k));

                return (
                  <div key={gItem.grade} className="p-3 bg-white border border-slate-200 rounded-xl space-y-2">
                    <div className="flex items-center justify-between border-b border-slate-100 pb-1.5">
                      <div className="flex items-center space-x-2">
                        <Checkbox 
                          id={`grade-all-${gItem.grade}`}
                          checked={allSelected ? true : (someSelected ? 'indeterminate' : false)}
                          onCheckedChange={() => handleToggleGradeForDownload(gItem.grade)}
                          className="h-4 w-4 text-indigo-600 rounded"
                        />
                        <Label htmlFor={`grade-all-${gItem.grade}`} className="text-xs font-bold text-slate-800 cursor-pointer flex items-center gap-1.5">
                          <span>{gItem.grade === '졸업' ? '졸업생' : `${gItem.grade}학년 전체`}</span>
                          <span className="text-[11px] font-normal text-slate-500">({gItem.totalCount}명)</span>
                        </Label>
                      </div>
                      <button 
                        type="button" 
                        onClick={() => handleToggleGradeForDownload(gItem.grade)}
                        className="text-[11px] text-indigo-600 hover:text-indigo-800 font-medium"
                      >
                        {allSelected ? '학년 해제' : '학년 선택'}
                      </button>
                    </div>

                    <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 pt-1">
                      {gItem.classes.map((c) => {
                        const isChecked = selectedClassesForDownload.includes(c.key);
                        return (
                          <div 
                            key={c.key} 
                            onClick={() => handleToggleClassForDownload(c.key)}
                            className={cn(
                              "flex items-center space-x-2 p-2 rounded-lg border text-xs cursor-pointer transition select-none",
                              isChecked 
                                ? "bg-indigo-50 border-indigo-300 text-indigo-900 font-bold" 
                                : "bg-slate-50/60 border-slate-200 text-slate-600 hover:bg-slate-100"
                            )}
                          >
                            <Checkbox 
                              id={c.key}
                              checked={isChecked}
                              onCheckedChange={() => handleToggleClassForDownload(c.key)}
                              className="h-3.5 w-3.5"
                            />
                            <span className="truncate">{c.classNum}반 ({c.count}명)</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>

            <DialogFooter className="pt-2 flex items-center justify-between sm:justify-end gap-2 border-t border-slate-100">
              <Button variant="outline" size="sm" onClick={() => setIsDownloadDialogOpen(false)} className="text-xs font-bold">
                취소
              </Button>
              <Button 
                onClick={handleDownloadFilteredExcel} 
                className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs gap-1.5 shadow-xs"
              >
                <Download className="h-4 w-4" />
                <span>선택된 학생 ({
                  students.filter(s => selectedClassesForDownload.includes(`${s.grade}-${s.classNum || '1'}`)).length
                }명) 엑셀 다운로드</span>
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </MainLayout>
  );
}
