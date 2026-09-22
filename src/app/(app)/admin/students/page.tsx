'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { MainLayout } from '@/components/layout/main-layout';
import {
  onMasterStudentsUpdate, createMasterStudent, updateMasterStudent,
  deleteMasterStudent, batchImportMasterStudents, batchPromoteStudents, isStudentEmail,
  extractEnglishNameFromEmail,
  onDeletedMasterStudentsUpdate, restoreMasterStudent, permanentlyDeleteMasterStudent,
  purgeMasterStudent
} from '@/lib/services/masterStudentService';
import type { DeletedMasterStudent } from '@/lib/services/masterStudentService';
import type { MasterStudent, NewMasterStudent } from '@/lib/types/masterStudent';
import { onDestinationsUpdate } from '@/lib/kisbus';
import type { Destination } from '@/lib/kisbus/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useToast } from '@/hooks/use-toast';
import {
  Users, Download, Search,
  UserCheck, Mail, Phone, MapPin, CreditCard, ShieldCheck, Trash2, Edit3, FileText, CheckCircle2, ArrowUpRight, CheckSquare, Square, Filter, Camera, Image as ImageIcon, RotateCcw
} from 'lucide-react';
import { cn } from '@/lib/kisbus/utils';
import { resizeStudentPhoto } from '@/lib/imageResize';
import { BatchPhotoModal } from './batch-photo-modal';
import { PromoteStudentsDialog, type GradeClassTreeItem } from './PromoteStudentsDialog';
import { AddStudentDialog } from './AddStudentDialog';
import { ExcelBulkUploadDialog } from './ExcelBulkUploadDialog';
import { EditStudentDialog } from './EditStudentDialog';
import { StudentDetailDialog } from './StudentDetailDialog';
import { DownloadStudentListDialog } from './DownloadStudentListDialog';
import { ExcelPreviewDialog, type ExcelPreviewRow } from './ExcelPreviewDialog';
import { TrashDialog } from './TrashDialog';

export default function AdminMasterStudentsPage() {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const promoteFileInputRef = useRef<HTMLInputElement>(null);
  const editPhotoInputRef = useRef<HTMLInputElement>(null);
  const addPhotoInputRef = useRef<HTMLInputElement>(null);

  const [students, setStudents] = useState<MasterStudent[]>([]);
  const [destinations, setDestinations] = useState<Destination[]>([]);
  const [loading, setLoading] = useState(true);

  // 필터 및 검색 (엔터 키 입력 시에만 실행되도록 분리)
  const [searchInput, setSearchInput] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedGrade, setSelectedGrade] = useState<string>('none');
  const [selectedClass, setSelectedClass] = useState<string>('all');
  const [selectedTypeFilter, setSelectedTypeFilter] = useState<'all' | 'afterschool' | 'bus'>('all');

  const handleExecuteSearch = () => {
    setSearchQuery(searchInput.trim());
  };

  const handleResetSearch = () => {
    setSearchInput('');
    setSearchQuery('');
  };

  // 모달 상태
  const [selectedStudent, setSelectedStudent] = useState<MasterStudent | null>(null);
  const [isDetailDialogOpen, setIsDetailDialogOpen] = useState(false);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isPromoteDialogOpen, setIsPromoteDialogOpen] = useState(false);
  const [isDownloadDialogOpen, setIsDownloadDialogOpen] = useState(false);
  const [isBatchPhotoOpen, setIsBatchPhotoOpen] = useState(false);
  const [isExcelPreviewOpen, setIsExcelPreviewOpen] = useState(false);
  const [isExcelPreviewLoading, setIsExcelPreviewLoading] = useState(false);
  const [isTrashDialogOpen, setIsTrashDialogOpen] = useState(false);
  const [deletedStudents, setDeletedStudents] = useState<DeletedMasterStudent[]>([]);

  // 엑셀 미리보기 행 데이터
  const [excelPreviewRows, setExcelPreviewRows] = useState<ExcelPreviewRow[]>([]);


  // 명단 다운로드 시 선택된 학년/반 목록 (Set or array of "grade-classNum")
  const [selectedClassesForDownload, setSelectedClassesForDownload] = useState<string[]>([]);

  // 진급 서식 다운로드 시 선택된 학년/반 필터
  const [promoteTemplateGrade, setPromoteTemplateGrade] = useState<string>('all');
  const [promoteTemplateClass, setPromoteTemplateClass] = useState<string>('all');

  // 수정 중인 학생 객체 state
  const [editStudentForm, setEditStudentForm] = useState<Partial<MasterStudent>>({});

  // 4-in-1 상세 모달 내 선택된 학학년도 (아카이브 조회를 위한 연도 선택 state)
  const [selectedAcademicYear, setSelectedAcademicYear] = useState<number>(new Date().getFullYear());

  // 형제·자매 연결 검색 state
  const [siblingSearchQuery, setSiblingSearchQuery] = useState('');

  // 현재 선택된 학생의 연결된 형제·자매 목록
  const currentSiblings = useMemo(() => {
    if (!selectedStudent || !selectedStudent.siblingGroupId) return [];
    return students.filter(s => 
      s.siblingGroupId === selectedStudent.siblingGroupId && 
      (s.studentId !== selectedStudent.studentId && s.id !== selectedStudent.id)
    );
  }, [selectedStudent, students]);

  // 형제·자매 연결 후보 학생 검색 결과
  const siblingCandidates = useMemo(() => {
    if (!siblingSearchQuery.trim() || !selectedStudent) return [];
    const q = siblingSearchQuery.toLowerCase().trim();
    return students.filter(s => {
      if (s.studentId === selectedStudent.studentId || s.id === selectedStudent.id) return false;
      if (selectedStudent.siblingGroupId && s.siblingGroupId === selectedStudent.siblingGroupId) return false;
      const name = (s.name || '').toLowerCase();
      const email = (s.studentEmail || '').toLowerCase();
      return name.includes(q) || email.includes(q);
    }).slice(0, 5);
  }, [siblingSearchQuery, students, selectedStudent]);

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

  // Firestore 실시간 구독 (선택된 그룹/학년에 맞춰 온디맨드로 구독하여 로딩 속도 극대화)
  useEffect(() => {
    const unsubDest = onDestinationsUpdate((dList) => {
      const sorted = [...(dList || [])].sort((a, b) => (a.name || '').localeCompare(b.name || '', 'ko'));
      setDestinations(sorted);
    });

    if (selectedGrade === 'none' || !selectedGrade) {
      setStudents([]);
      setLoading(false);
      return () => {
        unsubDest();
      };
    }

    setLoading(true);
    const unsubMaster = onMasterStudentsUpdate((data) => {
      setStudents(data);
      setLoading(false);
    }, { grade: selectedGrade });

    return () => {
      unsubMaster();
      unsubDest();
    };
  }, [selectedGrade]);

  // 삭제된 학생(휴지통) 실시간 구독
  useEffect(() => {
    const unsubTrash = onDeletedMasterStudentsUpdate((list) => {
      setDeletedStudents(list);
    });
    return () => unsubTrash();
  }, []);

  const destinationOptions = useMemo(() => {
    return destinations.map(d => ({
      value: d.name,
      label: d.name
    }));
  }, [destinations]);

  // 선택된 학년 기준 사용 가능한 반 목록
  const availableClasses = useMemo(() => {
    const set = new Set<string>();
    students.forEach(s => {
      if (selectedGrade === 'all' || String(s.grade) === String(selectedGrade)) {
        if (s.classNum) set.add(String(s.classNum));
      }
    });
    return Array.from(set).sort((a, b) => (parseInt(a) || 0) - (parseInt(b) || 0));
  }, [students, selectedGrade]);

  // 필터링된 학생 목록
  const filteredStudents = useMemo(() => {
    return students.filter(s => {
      if (selectedGrade !== 'all' && String(s.grade) !== String(selectedGrade)) return false;
      if (selectedClass !== 'all' && String(s.classNum) !== String(selectedClass)) return false;

      // 수강/탑승 유형 필터링
      if (selectedTypeFilter === 'afterschool') {
        const hasAfterschool = (s.afterschoolSummary?.enrolledCourses && s.afterschoolSummary.enrolledCourses.length > 0) ||
                               (s.afterschoolSummary?.enrolledCourseIds && s.afterschoolSummary.enrolledCourseIds.length > 0);
        if (!hasAfterschool) return false;
      } else if (selectedTypeFilter === 'bus') {
        const hasBus = !!(
          s.busSummary?.regularBusName || 
          s.busSummary?.assignedBusName || 
          (s.busSummary?.afterSchoolBuses && s.busSummary.afterSchoolBuses.length > 0) ||
          s.busSummary?.morningDestinationId ||
          s.busSummary?.afternoonDestinationId
        );
        if (!hasBus) return false;
      }

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
      const nA = parseInt(a.studentNum || '0') || 0;
      const nB = parseInt(b.studentNum || '0') || 0;
      if (nA !== nB) return nA - nB;
      return (a.name || '').localeCompare(b.name || '', 'ko');
    });
  }, [students, selectedGrade, selectedClass, selectedTypeFilter, searchQuery]);

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
      const defaultEnName = newStudent.nameEn || extractEnglishNameFromEmail(cleanEmail);
      await createMasterStudent({
        name: newStudent.name!,
        nameEn: defaultEnName,
        studentEmail: cleanEmail,
        grade: String(newStudent.grade || '1'),
        classNum: String(newStudent.classNum || '1'),
        studentNum: String(newStudent.studentNum || '1'),
        gender: newStudent.gender || 'Male',
        contact: newStudent.contact || '',
        parentEmail: newStudent.parentEmail || '',
        address: newStudent.address || '',
        kisbusNo: newStudent.kisbusNo || '',
        photoUrl: newStudent.photoUrl || ''
      });
      setIsAddDialogOpen(false);
      setNewStudent({
        name: '',
        nameEn: '',
        studentEmail: '', 
        grade: '1', 
        classNum: '1', 
        studentNum: '1',
        gender: 'Male', 
        contact: '', 
        parentEmail: '', 
        address: '', 
        kisbusNo: '',
        photoUrl: ''
      });
      toast({ title: '등록 완료', description: '통합 학생 마스터 계정이 성공적으로 등록되었습니다.' });
    } catch (err) {
      console.error(err);
      toast({ title: '오류', description: '학생 계정 생성 중 오류가 발생했습니다.', variant: 'destructive' });
    }
  };

  // 학생 정보 수정 시 사진 업로드 및 2cm 최적화 리사이징 핸들러
  const handleEditPhotoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const resizedDataUrl = await resizeStudentPhoto(file);
      setEditStudentForm(prev => ({ ...prev, photoUrl: resizedDataUrl }));
      toast({
        title: '사진 최적화 완료',
        description: '학생 사진이 가로세로 2cm 최적 해상도(160x160)로 변환되었습니다.'
      });
    } catch (err: any) {
      toast({
        title: '사진 처리 실패',
        description: err.message || '사진을 처리할 수 없습니다.',
        variant: 'destructive'
      });
    } finally {
      if (editPhotoInputRef.current) editPhotoInputRef.current.value = '';
    }
  };

  // 신규 학생 등록 시 사진 업로드 핸들러
  const handleAddPhotoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const resizedDataUrl = await resizeStudentPhoto(file);
      setNewStudent(prev => ({ ...prev, photoUrl: resizedDataUrl }));
      toast({
        title: '사진 최적화 완료',
        description: '학생 사진이 가로세로 2cm 최적 해상도(160x160)로 변환되었습니다.'
      });
    } catch (err: any) {
      toast({
        title: '사진 처리 실패',
        description: err.message || '사진을 처리할 수 없습니다.',
        variant: 'destructive'
      });
    } finally {
      if (addPhotoInputRef.current) addPhotoInputRef.current.value = '';
    }
  };

  // 학생 정보 수정 저장
  const handleStartEditStudent = (student: MasterStudent) => {
    const defaultEnName = student.nameEn || extractEnglishNameFromEmail(student.studentEmail || '');
    setEditStudentForm({
      ...student,
      nameEn: defaultEnName,
    });
    setIsEditDialogOpen(true);
  };

  const handleSaveEditStudent = async () => {
    if (!editStudentForm.studentId || !editStudentForm.name) return;
    try {
      await updateMasterStudent(editStudentForm.studentId, {
        name: editStudentForm.name,
        nameEn: editStudentForm.nameEn || '',
        studentEmail: editStudentForm.studentEmail || '',
        grade: String(editStudentForm.grade || '1'),
        classNum: String(editStudentForm.classNum || '1'),
        studentNum: String(editStudentForm.studentNum || ''),
        gender: editStudentForm.gender || 'Male',
        contact: editStudentForm.contact || '',
        address: editStudentForm.address || '',
        kisbusNo: editStudentForm.kisbusNo || '',
        photoUrl: editStudentForm.photoUrl || ''
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

  // 학생 삭제 (안전 모드: 휴지통 보관 + 스쿨버스/방과후 데이터 100% 안전 보존)
  const handleDeleteStudent = async (student: MasterStudent | string) => {
    const sId = typeof student === 'string' ? student : (student.studentId || student.id || '');
    const sEmail = typeof student === 'string' ? undefined : student.studentEmail;
    const sName = typeof student === 'string' ? undefined : student.name;
    const sGrade = typeof student === 'string' ? undefined : student.grade;
    const sClass = typeof student === 'string' ? undefined : student.classNum;

    const confirmMsg = sName
      ? `[${sName}] 학생(${sEmail || sId})의 계정을 삭제하시겠습니까?\n\n- 스쿨버스 배정 및 방과후 수강 이력은 안전하게 보존됩니다.\n- 실수로 삭제한 경우 상단 [휴지통]에서 언제든지 클릭 한 번으로 복구할 수 있습니다.`
      : '이 학생의 계정을 삭제하시겠습니까?\n스쿨버스 및 방과후 데이터는 보존되며, 상단 [휴지통]에서 언제든지 복구할 수 있습니다.';

    if (!confirm(confirmMsg)) return;

    try {
      await deleteMasterStudent(sId, { studentEmail: sEmail, name: sName, grade: sGrade, classNum: sClass });
      setIsDetailDialogOpen(false);
      setIsEditDialogOpen(false);
      setSelectedStudent(null);
      toast({ 
        title: '휴지통 이동 완료', 
        description: `${sName ? `[${sName}] ` : ''}학생 계정이 휴지통으로 이동되었습니다. 상단 [휴지통]에서 언제든 복구할 수 있습니다.` 
      });
    } catch (err) {
      console.error('Delete student error:', err);
      toast({ title: '오류', description: '학생 계정 삭제 중 오류가 발생했습니다.', variant: 'destructive' });
    }
  };

  // 삭제된 학생 즉시 복구 (Restore)
  const handleRestoreStudent = async (backupDocId: string, studentName: string) => {
    try {
      await restoreMasterStudent(backupDocId);
      toast({
        title: '복구 완료',
        description: `[${studentName}] 학생의 계정과 스쿨버스/방과후 연동이 성공적으로 복구되었습니다.`
      });
    } catch (err) {
      console.error('Restore student error:', err);
      toast({ title: '오류', description: '학생 복구 중 오류가 발생했습니다.', variant: 'destructive' });
    }
  };

  // 휴지통에서 영구 삭제 (Permanent Delete)
  const handlePermanentDeleteStudent = async (backupDocId: string, studentName: string) => {
    if (!confirm(`정말 [${studentName}] 학생의 백업 데이터를 휴지통에서 완전히 삭제하시겠습니까?\n\n영구 삭제 시 복구할 수 없습니다.`)) return;
    try {
      await permanentlyDeleteMasterStudent(backupDocId);
      toast({ title: '영구 삭제 완료', description: '휴지통에서 완전히 삭제되었습니다.' });
    } catch (err) {
      console.error('Permanent delete error:', err);
      toast({ title: '오류', description: '영구 삭제 실패', variant: 'destructive' });
    }
  };

  // 전학 / 자퇴 학생 전용 완전 영구 삭제 (버스 좌석 반환, 방과후 취소, 계정 영구 파기)
  const handlePurgeStudent = async (student: MasterStudent | DeletedMasterStudent | string, name?: string) => {
    const sId = typeof student === 'string' ? student : (student.studentId || (student as any).id || '');
    const sEmail = typeof student === 'string' ? undefined : student.studentEmail;
    const sName = name || (typeof student === 'string' ? undefined : student.name);
    const sGrade = typeof student === 'string' ? undefined : student.grade;
    const sClass = typeof student === 'string' ? undefined : student.classNum;

    const confirmMsg = `[전학/자퇴 완전 삭제 경고]\n\n정말 [${sName || sId}] 학생의 모든 정보를 완전히 삭제하시겠습니까?\n\n- 학생 계정 및 마스터 DB 영구 파기\n- 배정된 스쿨버스 좌석 즉시 해제 (다른 학생을 위해 빈자리로 반환)\n- 신청된 방과후 수업 전수 취소 및 수강생 명단 제외\n- 휴지통 백업까지 영구 삭제 (복구 불가)\n\n※ 전학/자퇴생이 확실한 경우에만 [확인]을 눌러주세요.`;

    if (!confirm(confirmMsg)) return;

    try {
      const result = await purgeMasterStudent(sId, { studentEmail: sEmail, name: sName, grade: sGrade, classNum: sClass });
      setIsDetailDialogOpen(false);
      setIsEditDialogOpen(false);
      setSelectedStudent(null);
      toast({
        title: '전학 완전 삭제 완료',
        description: `[${sName || '학생'}]의 모든 정보가 영구 파기되었습니다. (버스 좌석 ${result.busSeatsReleased}석 반환, 방과후 ${result.enrollmentsRemoved}건 취소)`
      });
    } catch (err) {
      console.error('Purge student error:', err);
      toast({ title: '오류', description: '전학 영구 삭제 중 오류가 발생했습니다.', variant: 'destructive' });
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

  // 엑셀 일괄 등록 양식 다운로드
  const handleDownloadStudentTemplate = async () => {
    const XLSX = await import('xlsx');
    const headers = [
      '학년', '반', '번호', '이름', '영문이름(선택)', '성별', '계정(이메일)', '학부모 연락처(선택)'
    ];
    const sampleRows = [
      ['1', '1', '1', '홍길동', 'GilDong Hong', '남', '2023hongbildong@kshcm.net', '010-1234-5678'],
      ['1', '1', '2', '김영희', 'YoungHee Kim', '여', '2023kimyounghee@kshcm.net', ''],
      ['2', '3', '5', '이순신', 'SunSin Lee', '남', '2022leesunsin@kshcm.net', '010-9876-5432'],
    ];
    const wsData = [headers, ...sampleRows];
    const ws = XLSX.utils.aoa_to_sheet(wsData);

    // 열 너비 설정
    ws['!cols'] = [
      { wch: 6 }, { wch: 6 }, { wch: 6 }, { wch: 12 }, { wch: 20 },
      { wch: 6 }, { wch: 30 }, { wch: 20 }
    ];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, '학생일괄등록_양식');
    XLSX.writeFile(wb, '학생계정_일괄등록_양식.xlsx');
    toast({ title: '양식 다운로드 완료', description: '학생 일괄 등록 양식이 다운로드되었습니다. 작성 후 업로드하세요.' });
  };

  // 엑셀 일괄 등록 업로드 - 헤더명 기반 유연 파싱 + 방과후/버스 연동 미리보기
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        setIsExcelPreviewLoading(true);
        const XLSX = await import('xlsx');
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsName = wb.SheetNames[0];
        const ws = wb.Sheets[wsName];
        // header: 1 → 첫 행을 헤더로 사용
        const jsonRows: Record<string, any>[] = XLSX.utils.sheet_to_json(ws, { defval: '' });

        if (jsonRows.length === 0) {
          toast({ title: '빈 파일', description: '엑셀 파일에 데이터가 없습니다.', variant: 'destructive' });
          setIsExcelPreviewLoading(false);
          return;
        }

        // 헤더명 유연 매핑 (띄어쓰기·괄호·한글 등 무관)
        const normalize = (k: string) => k.replace(/[\s()\[\]선택필수]/g, '').toLowerCase();
        const findCol = (row: Record<string, any>, ...candidates: string[]): string => {
          const keys = Object.keys(row);
          for (const cand of candidates) {
            const normCand = normalize(cand);
            const matched = keys.find(k => normalize(k) === normCand);
            if (matched !== undefined && row[matched] !== undefined && row[matched] !== '') {
              return String(row[matched]).trim();
            }
          }
          return '';
        };

        // 방과후 및 버스 데이터를 Firestore에서 조회
        const { getDocs, collection, where, query } = await import('firebase/firestore');
        const { getDb } = await import('@/lib/firebase');
        const { getKisbusDb } = await import('@/lib/kisbus/firebase');

        let afterschoolEnrollments: any[] = [];
        let busStudents: any[] = [];

        try {
          const [enrollSnap, busSnap] = await Promise.all([
            getDocs(collection(getDb(), 'afterschool_enrollments')),
            getDocs(collection(getKisbusDb(), 'students')),
          ]);
          afterschoolEnrollments = enrollSnap.docs.map(d => ({ id: d.id, ...(d.data() as any) }));
          busStudents = busSnap.docs.map(d => ({ id: d.id, ...(d.data() as any) }));
        } catch (dbErr) {
          console.warn('방과후/버스 조회 오류 (연동 생략):', dbErr);
        }

        // 인덱스맵 생성 (학년_반_이름 복합키)
        const afterschoolByKey = new Map<string, any[]>();
        afterschoolEnrollments.forEach(e => {
          if (e.status === 'CANCELLED') return;
          const g = String(e.grade || '');
          const c = String(e.classNum || e.class || '');
          const n = String(e.name || e.studentName || '');
          if (g && c && n) {
            const key = `${g}_${c}_${n}`;
            if (!afterschoolByKey.has(key)) afterschoolByKey.set(key, []);
            afterschoolByKey.get(key)!.push(e);
          }
        });

        const busByKey = new Map<string, any>();
        busStudents.forEach(bs => {
          const g = String(bs.grade || '');
          const c = String(bs.class || bs.classNum || '');
          const n = String(bs.nameKo || bs.name || '');
          if (g && c && n) busByKey.set(`${g}_${c}_${n}`, bs);
        });

        // 파싱
        const previewRows: typeof excelPreviewRows = [];
        for (const row of jsonRows) {
          const gradeRaw = findCol(row, '학년', 'grade', 'year');
          const classRaw = findCol(row, '반', '학반', 'class', 'classnum');
          const numRaw = findCol(row, '번호', '번', '출석번호', 'number', 'no', 'studentnum');
          const name = findCol(row, '이름', '학생이름', '성명', '학생명', 'name', 'studentname');
          const nameEn = findCol(row, '영문이름', '영문', '영어이름', 'nameen', 'englishname');
          const genderRaw = findCol(row, '성별', 'gender');
          const email = findCol(row, '계정', '이메일', '학생계정', '계정이메일', 'email', 'studentemail', '계정(이메일)');
          const contact = findCol(row, '학부모연락처', '학부모전화', '연락처', '전화번호', 'parentphone', 'contact', 'phone');

          if (!name) continue; // 이름이 없는 행은 무시

          const grade = gradeRaw.replace(/\D/g, '');
          const classNum = classRaw.replace(/\D/g, '');
          const studentNum = numRaw.replace(/\D/g, '') || '';
          const gender: 'Male' | 'Female' = (genderRaw === '여' || genderRaw.toLowerCase() === 'female' || genderRaw === 'F') ? 'Female' : 'Male';

          // 유효성 검사: 학년/반 누락 및 이메일 형식 모두 체크 (grade/classNum 없으면 기본값 '1' fallback 금지)
          let error: string | undefined;
          if (!grade || !classNum) {
            error = `학년(${grade || '?'}) 또는 반(${classNum || '?'}) 정보를 파싱할 수 없습니다. 열 이름을 확인하세요.`;
          } else if (email && !isStudentEmail(email)) {
            error = '계정 이메일 형식이 올바르지 않습니다. (예: 2023kangdongyun@kshcm.net)';
          }

          // 방과후/버스 연동 조회: 이메일 우선 → 학년_반_이름 복합키 순서 (동명이인 오매칭 방지)
          const lookupKey = grade && classNum ? `${grade}_${classNum}_${name}` : '';

          // 방과후 enrollment: 이메일 우선 조회
          let enrollments: any[] = [];
          if (email) {
            const byEmail = afterschoolEnrollments.filter(
              (e: any) => e.status !== 'CANCELLED' &&
                (e.studentEmail || (e as any).email || '').toLowerCase().trim() === email.toLowerCase().trim()
            );
            enrollments = byEmail;
          }
          if (enrollments.length === 0 && lookupKey) {
            enrollments = afterschoolByKey.get(lookupKey) || [];
          }
          const afterschoolStatus = enrollments.length > 0
            ? enrollments.map((e: any) => e.courseTitle || e.title || '강좌').join(', ')
            : '없음';

          // 버스 연동: 이메일 우선 조회
          let busStudent: any = null;
          if (email) {
            busStudent = busStudents.find(
              (bs: any) => (bs.studentEmail || '').toLowerCase().trim() === email.toLowerCase().trim()
            ) || null;
          }
          if (!busStudent && lookupKey) {
            busStudent = busByKey.get(lookupKey) || null;
          }
          let busStatus = '없음';
          if (busStudent) {
            const routeNames: string[] = [];
            if (busStudent.morningBus) routeNames.push(`등교: ${busStudent.morningBus}`);
            if (busStudent.afternoonBus) routeNames.push(`하교: ${busStudent.afternoonBus}`);
            if (busStudent.kisbusNo && busStudent.kisbusNo !== '미신청') routeNames.push(busStudent.kisbusNo);
            busStatus = routeNames.length > 0 ? routeNames.join(' / ') : '데이터 있음';
          }

          previewRows.push({
            grade: grade || '?', classNum: classNum || '?', studentNum, name, nameEn, gender, studentEmail: email, contact,
            afterschoolStatus, busStatus, error
          });
        }

        if (previewRows.length === 0) {
          toast({ title: '파싱 결과 없음', description: '등록 가능한 행이 없습니다. 양식 형식을 확인하세요.', variant: 'destructive' });
          setIsExcelPreviewLoading(false);
          return;
        }

        setExcelPreviewRows(previewRows);
        setIsExcelPreviewOpen(true);
      } catch (err) {
        console.error(err);
        toast({ title: '오류', description: '엑셀 파싱 중 오류가 발생했습니다.', variant: 'destructive' });
      } finally {
        setIsExcelPreviewLoading(false);
      }
    };
    reader.readAsBinaryString(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // 미리보기 확인 후 최종 일괄 등록 실행
  const handleConfirmExcelImport = async () => {
    // error 필드 있는 행(학년/반 누락, 이메일 오류 등)과 이메일 없는 행 모두 제외
    const validRows = excelPreviewRows.filter(r => !r.error && r.studentEmail && isStudentEmail(r.studentEmail));
    const skipRows = excelPreviewRows.filter(r => r.error || !r.studentEmail || !isStudentEmail(r.studentEmail));

    if (validRows.length === 0) {
      toast({ title: '등록 불가', description: '유효한 이메일·학년·반이 있는 행이 없습니다. 미리보기의 오류 항목을 확인하세요.', variant: 'destructive' });
      return;
    }

    try {
      const studentsList: NewMasterStudent[] = validRows.map(r => ({
        studentEmail: r.studentEmail,
        name: r.name,
        nameEn: r.nameEn || '',
        grade: r.grade,
        classNum: r.classNum,
        studentNum: r.studentNum,
        gender: r.gender,
        contact: r.contact,
        address: '',
        kisbusNo: '',
      }));

      const count = await batchImportMasterStudents(studentsList);
      setIsExcelPreviewOpen(false);
      setExcelPreviewRows([]);
      const skipMsg = skipRows.length > 0 ? ` (이메일/학년/반 오류 ${skipRows.length}명 제외)` : '';
      toast({ title: '일괄 등록 완료', description: `${count}명의 학생 계정이 마스터 DB에 등록되었습니다.${skipMsg}` });
    } catch (err) {
      console.error(err);
      toast({ title: '등록 오류', description: '일괄 등록 중 오류가 발생했습니다.', variant: 'destructive' });
    }
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
              <p className="text-[10px] text-indigo-200 font-bold whitespace-nowrap">
                {selectedGrade === 'none' ? '조회 학생수' : selectedGrade === 'all' ? '전교생 등록 계정' : `${selectedGrade}학년 등록 계정`}
              </p>
              <p className="text-xl font-black text-white">{selectedGrade === 'none' ? '-' : `${stats.total}명`}</p>
            </div>
            <div className="bg-white/10 backdrop-blur-md rounded-2xl p-3 border border-white/10 text-center min-w-[90px]">
              <p className="text-[10px] text-indigo-200 font-bold whitespace-nowrap">방과후 수강중</p>
              <p className="text-xl font-black text-emerald-300">{selectedGrade === 'none' ? '-' : `${stats.afterschoolCount}명`}</p>
            </div>
            <div className="bg-white/10 backdrop-blur-md rounded-2xl p-3 border border-white/10 text-center min-w-[90px]">
              <p className="text-[10px] text-indigo-200 font-bold whitespace-nowrap">스쿨버스 이용중</p>
              <p className="text-xl font-black text-sky-300">{selectedGrade === 'none' ? '-' : `${stats.busCount}명`}</p>
            </div>
          </div>
        </div>

        {/* 2. 학생 명단 컨트롤 툴바 & 관리 기능 */}
        <Card className="rounded-2xl shadow-xs border-slate-200/80">
          <CardHeader className="pb-3 border-b border-slate-100">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <CardTitle className="text-lg font-bold text-slate-800 whitespace-nowrap flex items-center gap-2">
                  <Users className="h-5 w-5 text-indigo-600" />
                  {selectedGrade === 'none' 
                    ? '통합 학생 계정 명단 (조회할 학년을 선택하세요)' 
                    : `통합 학생 계정 명단 (${selectedGrade === 'all' ? '전교생' : `${selectedGrade}학년`} ${filteredStudents.length}명)`}
                </CardTitle>
                <CardDescription className="text-xs text-slate-500 mt-0.5">
                  학생 정보 수정, 계정 추가/삭제, 진급 처리(학년/반 변경)를 직접 관리합니다.
                </CardDescription>
              </div>

              {/* 관리 액션 버튼 그룹 (한 줄 정렬) */}
              <div className="flex items-center gap-2 flex-wrap shrink-0">
                {/* 1. 🎓 진급 처리 모달 */}
                <PromoteStudentsDialog
                  open={isPromoteDialogOpen}
                  onOpenChange={setIsPromoteDialogOpen}
                  gradeClassTree={gradeClassTree}
                  promoteTemplateGrade={promoteTemplateGrade}
                  setPromoteTemplateGrade={setPromoteTemplateGrade}
                  promoteTemplateClass={promoteTemplateClass}
                  setPromoteTemplateClass={setPromoteTemplateClass}
                  promoteFileInputRef={promoteFileInputRef}
                  onDownloadTemplate={() => handleDownloadPromoteTemplate()}
                  onFileUpload={handlePromoteFileUpload}
                  onAutoPromoteAll={handleAutoPromoteAll}
                />

                {/* 2. 개별 계정 추가 */}
                <AddStudentDialog
                  open={isAddDialogOpen}
                  onOpenChange={setIsAddDialogOpen}
                  newStudent={newStudent}
                  setNewStudent={setNewStudent}
                  addPhotoInputRef={addPhotoInputRef}
                  onPhotoChange={handleAddPhotoChange}
                  destinationOptions={destinationOptions}
                  onCreateStudent={handleCreateStudent}
                />

                {/* 2-2. 학생 사진 스마트 일괄 등록 */}
                <Button
                  size="sm"
                  onClick={() => setIsBatchPhotoOpen(true)}
                  className="h-8 text-xs px-2.5 font-bold whitespace-nowrap bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs cursor-pointer"
                >
                  <Camera className="mr-1.5 h-3.5 w-3.5" /> 사진 일괄 등록
                </Button>

                {/* 3. 엑셀 일괄 등록 - 양식 다운로드 + 업로드 Dialog */}
                <ExcelBulkUploadDialog
                  isLoading={isExcelPreviewLoading}
                  fileInputRef={fileInputRef}
                  onDownloadTemplate={handleDownloadStudentTemplate}
                  onFileUpload={handleFileUpload}
                />
                {/* 4. 명단 다운로드 */}
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={handleOpenDownloadDialog} 
                  className="h-8 text-xs px-2.5 font-bold whitespace-nowrap text-indigo-700 border-indigo-200 hover:bg-indigo-50"
                >
                  <Download className="mr-1.5 h-3.5 w-3.5" /> 명단 다운로드
                </Button>
                {/* 5. 휴지통 / 삭제된 학생 복구 */}
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => setIsTrashDialogOpen(true)}
                  className={cn(
                    "h-8 text-xs px-2.5 font-bold whitespace-nowrap border-slate-300 text-slate-700 hover:bg-slate-100",
                    deletedStudents.length > 0 && "border-rose-300 text-rose-700 bg-rose-50/50 hover:bg-rose-100/60"
                  )}
                >
                  <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
                  <span>휴지통</span>
                  {deletedStudents.length > 0 && (
                    <Badge className="ml-1.5 px-1.5 py-0 h-4 text-[10px] bg-rose-500 text-white rounded-full">
                      {deletedStudents.length}
                    </Badge>
                  )}
                </Button>
              </div>
            </div>


            {/* 필터 및 검색 바 (엔터 키 또는 검색 버튼 클릭 시에만 필터링) */}
            <div className="flex flex-col sm:flex-row items-center gap-2.5 pt-3">
              <div className="relative flex-1 w-full flex items-center gap-1.5">
                <div className="relative flex-1">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
                  <Input
                    placeholder="학생 이름, 이메일, 학년 반 검색 후 [Enter] 또는 [검색] 버튼 클릭..."
                    value={searchInput}
                    onChange={e => setSearchInput(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleExecuteSearch();
                      }
                    }}
                    className="pl-9 pr-8 h-9 text-xs"
                  />
                  {searchInput && (
                    <button
                      type="button"
                      onClick={handleResetSearch}
                      className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600 text-xs font-bold"
                      title="검색어 지우기"
                    >
                      ✕
                    </button>
                  )}
                </div>
                <Button 
                  type="button" 
                  size="sm" 
                  onClick={handleExecuteSearch} 
                  className="h-9 px-3 text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white shrink-0 shadow-xs"
                >
                  <Search className="w-3.5 h-3.5 mr-1" /> 검색
                </Button>
              </div>
              <div className="flex items-center gap-2 shrink-0 w-full sm:w-auto flex-wrap">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-bold text-slate-600 whitespace-nowrap">학년:</span>
                  <Select value={selectedGrade} onValueChange={(val) => {
                    setSelectedGrade(val);
                    setSelectedClass('all');
                  }}>
                    <SelectTrigger className="h-9 w-[120px] text-xs font-semibold">
                      <SelectValue placeholder="학년 선택" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none" className="text-slate-400 font-medium">학년 선택 안 함</SelectItem>
                      <SelectItem value="1">1학년</SelectItem>
                      <SelectItem value="2">2학년</SelectItem>
                      <SelectItem value="3">3학년</SelectItem>
                      <SelectItem value="4">4학년</SelectItem>
                      <SelectItem value="5">5학년</SelectItem>
                      <SelectItem value="6">6학년</SelectItem>
                      <SelectItem value="졸업">졸업생</SelectItem>
                      <SelectItem value="all">전체 학년 (전교생)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-bold text-slate-600 whitespace-nowrap">반:</span>
                  <Select value={selectedClass} onValueChange={setSelectedClass}>
                    <SelectTrigger className="h-9 w-[95px] text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">전체 반</SelectItem>
                      {availableClasses.map(c => (
                        <SelectItem key={c} value={c}>{c}반</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-bold text-slate-600 whitespace-nowrap">유형:</span>
                  <Select value={selectedTypeFilter} onValueChange={(v: any) => setSelectedTypeFilter(v)}>
                    <SelectTrigger className="h-9 w-[110px] text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">전체 학생</SelectItem>
                      <SelectItem value="afterschool">방과후 수강생</SelectItem>
                      <SelectItem value="bus">스쿨버스 이용</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
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
                  {loading ? (
                    <TableRow>
                      <TableCell colSpan={7} className="h-44 text-center text-slate-500">
                        <div className="flex flex-col items-center justify-center gap-2">
                          <div className="animate-spin rounded-full h-7 w-7 border-b-2 border-indigo-600"></div>
                          <p className="text-xs font-semibold text-slate-600">
                            {selectedGrade === 'all' ? '전체 학생 명단을 불러오는 중입니다...' : `${selectedGrade}학년 학생 명단을 불러오는 중입니다...`}
                          </p>
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : selectedGrade === 'none' ? (
                    <TableRow>
                      <TableCell colSpan={7} className="h-56 text-center text-slate-500">
                        <div className="max-w-md mx-auto py-6 space-y-3">
                          <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-indigo-50 border border-indigo-200 text-indigo-600 mb-1">
                            <Users className="w-6 h-6" />
                          </div>
                          <div className="space-y-1">
                            <h3 className="text-sm font-bold text-slate-800">조회할 학년을 상단에서 선택해 주세요</h3>
                            <p className="text-xs text-slate-500 leading-relaxed">
                              데이터 로딩 시간 단축을 위해 선택한 학년의 학생 명단만 실시간으로 불러옵니다. 아래 버튼을 눌러 바로 조회할 수도 있습니다.
                            </p>
                          </div>
                          <div className="flex flex-wrap items-center justify-center gap-2 pt-2">
                            {['1', '2', '3', '4', '5', '6', '졸업', 'all'].map(g => (
                              <Button
                                key={g}
                                variant="outline"
                                size="sm"
                                className="h-8 text-xs font-bold border-indigo-200 text-indigo-700 hover:bg-indigo-50 cursor-pointer"
                                onClick={() => {
                                  setSelectedGrade(g);
                                  setSelectedClass('all');
                                }}
                              >
                                {g === 'all' ? '전체 학년' : g === '졸업' ? '졸업생' : `${g}학년`}
                              </Button>
                            ))}
                          </div>
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : filteredStudents.length > 0 ? (
                    filteredStudents.map(student => (
                      <TableRow key={student.studentId} className="hover:bg-slate-50/80 transition-colors">
                        <TableCell className="whitespace-nowrap font-medium text-slate-700">
                          {student.grade}학년 {student.classNum}반 {student.studentNum ? `${student.studentNum}번` : ''}
                        </TableCell>
                        <TableCell className="whitespace-nowrap">
                          <button 
                            className="font-bold text-indigo-700 hover:text-indigo-900 flex items-center gap-2.5 text-sm text-left group"
                            onClick={() => {
                              setSelectedStudent(student);
                              setIsDetailDialogOpen(true);
                            }}
                          >
                            <Avatar className="w-9 h-9 rounded-xl border border-slate-200 shrink-0 shadow-2xs bg-white">
                              {student.photoUrl ? (
                                <AvatarImage src={student.photoUrl} alt={student.name} className="object-cover rounded-xl" />
                              ) : (
                                <AvatarFallback className="bg-indigo-50 text-indigo-700 font-extrabold text-xs rounded-xl">
                                  {student.name.slice(0, 2)}
                                </AvatarFallback>
                              )}
                            </Avatar>
                            <div className="flex flex-col items-start leading-tight">
                              <span className="font-extrabold text-slate-900 group-hover:underline">{student.name}</span>
                              <Badge variant="outline" className="text-[9.5px] bg-indigo-50 border-indigo-200 text-indigo-700 font-normal px-1 py-0 mt-0.5">
                                통합 프로필
                              </Badge>
                            </div>
                          </button>
                        </TableCell>
                        <TableCell className="whitespace-nowrap font-mono text-xs text-slate-600">
                          {student.studentEmail}
                        </TableCell>
                        <TableCell className="whitespace-nowrap text-xs text-slate-600">
                          {student.contact || '-'}
                        </TableCell>
                        <TableCell className="whitespace-normal min-w-[160px] max-w-[240px]">
                          {student.afterschoolSummary?.enrolledCourses && student.afterschoolSummary.enrolledCourses.length > 0 ? (
                            <div className="flex flex-col gap-1 py-1">
                              {student.afterschoolSummary.enrolledCourses.map((c, idx) => (
                                <Badge key={idx} variant="secondary" className="bg-emerald-50 text-emerald-800 border border-emerald-200 text-[11px] font-semibold py-0.5 px-2 w-fit">
                                  <span className="font-bold text-emerald-950 mr-1">[{c.days.join(',')}]</span>
                                  <span>{(c.title || '').slice(0, 5)}{(c.title || '').length > 5 ? '..' : ''}</span>
                                </Badge>
                              ))}
                            </div>
                          ) : student.afterschoolSummary?.enrolledCourseTitles && student.afterschoolSummary.enrolledCourseTitles.length > 0 ? (
                            <div className="flex flex-col gap-1">
                              {student.afterschoolSummary.enrolledCourseTitles.map((t, idx) => (
                                <Badge key={idx} variant="secondary" className="bg-emerald-50 text-emerald-700 border border-emerald-200 text-[11px] w-fit">
                                  {(t || '').slice(0, 5)}{(t || '').length > 5 ? '..' : ''}
                                </Badge>
                              ))}
                            </div>
                          ) : (
                            <span className="text-xs text-slate-400 italic whitespace-nowrap">미수강</span>
                          )}
                        </TableCell>
                        <TableCell className="whitespace-normal min-w-[140px] max-w-[220px]">
                          {(() => {
                            const bSum = student.busSummary;
                            const afterschoolBuses = bSum?.afterSchoolBuses || [];
                            const hasRegularBus = !!bSum?.regularBusName;
                            const hasAfterschoolBuses = afterschoolBuses.length > 0;
                            const hasEnrolledCourses = (student.afterschoolSummary?.enrolledCourses?.length ?? 0) > 0;

                            if (!hasRegularBus && !hasAfterschoolBuses && !bSum?.assignedBusName) {
                              return <span className="text-xs text-slate-400 italic whitespace-nowrap">자가 귀가</span>;
                            }

                            return (
                              <div className="flex flex-col gap-1 py-1">
                                {hasRegularBus && (
                                  <Badge variant="outline" className="bg-sky-50 text-sky-800 border-sky-200 text-[11px] font-semibold py-0.5 px-2 w-fit">
                                    <span className="font-bold text-sky-950 mr-1">
                                      {hasEnrolledCourses && bSum?.regularBusDays && bSum.regularBusDays.length > 0
                                        ? `[${bSum.regularBusDays.join(',')}]`
                                        : `[정규]`}
                                    </span>
                                    <span>{bSum.regularBusName}</span>
                                  </Badge>
                                )}

                                {afterschoolBuses.map((asb, idx) => (
                                  <Badge key={idx} variant="outline" className="bg-amber-50 text-amber-900 border-amber-200 text-[11px] font-semibold py-0.5 px-2 w-fit">
                                    <span className="font-bold text-amber-950 mr-1">[{asb.day}]</span>
                                    <span>{asb.busName}</span>
                                  </Badge>
                                ))}
                                {!hasRegularBus && !hasAfterschoolBuses && bSum?.assignedBusName && (
                                  <Badge variant="outline" className="bg-sky-50 text-sky-700 border-sky-200 text-[11px] font-bold w-fit">
                                    {bSum.assignedBusName}
                                  </Badge>
                                )}
                              </div>
                            );
                          })()}
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
                            onClick={() => handleDeleteStudent(student)}
                            title="학생 계정 완전 삭제"
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

        {/* 4. 학생 정보 수정 모달 (너비 120% 확대: 680px) */}
        <EditStudentDialog
          open={isEditDialogOpen}
          onOpenChange={setIsEditDialogOpen}
          editStudentForm={editStudentForm}
          setEditStudentForm={setEditStudentForm}
          editPhotoInputRef={editPhotoInputRef}
          onPhotoChange={handleEditPhotoChange}
          destinationOptions={destinationOptions}
          students={students}
          onSave={handleSaveEditStudent}
          onDeleteStudent={handleDeleteStudent}
          onPurgeStudent={handlePurgeStudent}
        />

        {/* 5. 학생 1인 4-in-1 통합 프로필 상세 모달 (학학년도 아카이브 누적 조회 지원) */}
        {selectedStudent && (
          <StudentDetailDialog
            open={isDetailDialogOpen}
            onOpenChange={setIsDetailDialogOpen}
            selectedStudent={selectedStudent}
            selectedAcademicYear={selectedAcademicYear}
            setSelectedAcademicYear={setSelectedAcademicYear}
            currentSiblings={currentSiblings}
            siblingCandidates={siblingCandidates}
            siblingSearchQuery={siblingSearchQuery}
            setSiblingSearchQuery={setSiblingSearchQuery}
            onEditStudent={handleStartEditStudent}
            onDeleteStudent={handleDeleteStudent}
            onPurgeStudent={handlePurgeStudent}
          />
        )}

        {/* 6. 엑셀 명단 다운로드 학년/반 선택 팝업 모달 */}
        <DownloadStudentListDialog
          open={isDownloadDialogOpen}
          onOpenChange={setIsDownloadDialogOpen}
          students={students}
          gradeClassTree={gradeClassTree}
          selectedClassesForDownload={selectedClassesForDownload}
          onSelectAll={handleSelectAllClassesForDownload}
          onDeselectAll={handleDeselectAllClassesForDownload}
          onToggleGrade={handleToggleGradeForDownload}
          onToggleClass={handleToggleClassForDownload}
          onDownload={handleDownloadFilteredExcel}
        />

        {/* 7. 학생 사진 스마트 일괄 등록 모달 */}
        <BatchPhotoModal
          isOpen={isBatchPhotoOpen}
          onClose={() => setIsBatchPhotoOpen(false)}
          students={students}
        />
      </div>

      {/* 8. 엑셀 일괄 등록 미리보기 모달 */}
      <ExcelPreviewDialog
        open={isExcelPreviewOpen}
        onOpenChange={setIsExcelPreviewOpen}
        rows={excelPreviewRows}
        onCancel={() => { setIsExcelPreviewOpen(false); setExcelPreviewRows([]); }}
        onConfirmImport={handleConfirmExcelImport}
      />

      {/* 7. 휴지통 / 삭제된 학생 복구 모달 */}
      <TrashDialog
        open={isTrashDialogOpen}
        onOpenChange={setIsTrashDialogOpen}
        deletedStudents={deletedStudents}
        onRestore={handleRestoreStudent}
        onPurge={handlePurgeStudent}
      />
    </MainLayout>
  );
}
