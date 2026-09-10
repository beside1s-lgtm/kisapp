'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { useRouter } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { 
  Users2, 
  CalendarOff, 
  Backpack, 
  CheckCircle2, 
  Loader2, 
  Send, 
  AlertCircle, 
  Calendar as CalendarIcon, 
  User, 
  Phone, 
  FileText,
  AlertTriangle,
  ArrowRight,
  Edit3,
  Camera,
  Users,
  Search,
  Check,
  X,
  Clock,
  LogOut,
  ChevronDown
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { getDocConfig, onOrgStructureUpdate } from '@/lib/services/settingsService';
import { checkHomeroomAccessPermission } from '@/lib/services/permissionService';
import { onMasterStudentsUpdate, updateMasterStudent, extractEnglishNameFromEmail } from '@/lib/services/masterStudentService';
import { getStudentFieldTripDays, getStudentAbsenceDays, createDocument, approveDocument } from '@/lib/services/documentService';
import { getApproversByGradeClass } from '@/lib/services/userService';
import { getWorkingDaysCount, cn } from '@/lib/utils';
import { resizeStudentPhoto } from '@/lib/imageResize';
import { BatchPhotoModal } from '@/app/(app)/admin/students/batch-photo-modal';
import { MainLayout } from '@/components/layout/main-layout';
import {
  onHomeroomAttendanceUpdate,
  getApprovedAbsenceStudentsForDate,
  saveHomeroomAttendanceAndSync,
  type HomeroomAttendanceRecord,
  type HomeroomAttendanceStatus,
} from '@/lib/services/homeroomAttendanceSync';
import type { MasterStudent } from '@/lib/types/masterStudent';
import type { OrgStructure, DocConfig } from '@/lib/types';
import { onRoutesUpdate } from '@/lib/kisbus/routes';
import { onBusesUpdate } from '@/lib/kisbus/buses';
import { unassignStudentFromAllRoutes } from '@/lib/kisbus/assignments';
import type { Route, Bus, DayOfWeek } from '@/lib/kisbus/types';

// ─── 학급 키 정렬 및 라벨 포맷 헬퍼 ──────────────────────────────────────────

/**
 * 학급 키에서 정렬용 학년 순위(gradeRank)와 반 번호(classNum) 추출
 * - 유치원/K: gradeRank = 0 (초등 1학년 앞)
 * - 1~6학년: gradeRank = 1 ~ 6
 * - 7~12학년(중고등): gradeRank = 7 ~ 12
 * - 기타: gradeRank = 999
 */
function parseGradeAndClass(classKey: string): { gradeRank: number; gradeName: string; classNum: number } {
  const parts = classKey.split(/[-_\s]/).filter(Boolean);
  const rawGrade = parts[0] || '';
  const rawClass = parts[1] || '';

  let gradeRank = 999;
  let gradeName = rawGrade;

  // 1. 유치원 계열 (유치원, 유치원국화반, K 등)
  if (rawGrade.includes('유치') || rawGrade.toUpperCase() === 'K') {
    gradeRank = 0;
    gradeName = rawGrade;
  } else {
    // 2. 숫자 학년 추출 (예: '1', '1학년', '초등1')
    const match = rawGrade.match(/\d+/);
    if (match) {
      gradeRank = parseInt(match[0], 10);
      gradeName = `${gradeRank}학년`;
    }
  }

  // 반 번호 추출 (숫자 우선)
  const classMatch = rawClass.match(/\d+/);
  const classNum = classMatch ? parseInt(classMatch[0], 10) : (parseInt(rawClass, 10) || 0);

  return {
    gradeRank,
    gradeName,
    classNum,
  };
}

/**
 * 학급 키 오름차순 정렬 함수
 * 유치원(0) -> 1학년 -> 2학년 ... -> 6학년 -> 중등 순서
 * 동일 학년 내에서는 반 번호(1반 -> 2반 -> 3반 ...) 오름차순
 */
function compareClassKeys(a: string, b: string): number {
  const pa = parseGradeAndClass(a);
  const pb = parseGradeAndClass(b);

  // 1. 학년 순위 오름차순 (0: 유치원, 1~6: 초등 1~6학년)
  if (pa.gradeRank !== pb.gradeRank) {
    return pa.gradeRank - pb.gradeRank;
  }

  // 2. 학년명이 다른 경우 (예: 유치원 장미반 vs 유치원 국화반) 가나다순
  if (pa.gradeName !== pb.gradeName) {
    return pa.gradeName.localeCompare(pb.gradeName, 'ko');
  }

  // 3. 반 번호 오름차순
  if (pa.classNum !== pb.classNum) {
    return pa.classNum - pb.classNum;
  }

  return a.localeCompare(b, 'ko');
}

/**
 * 학급 키를 드롭다운 및 헤더에 표기하기 위한 라벨 포맷터
 * - '1-1' -> '1학년 1반'
 * - '유치원국화반-2' -> '유치원국화반 2반'
 * - '유치원-1' -> '유치원 1반'
 */
function formatClassLabel(classKey: string): string {
  if (!classKey) return '';
  const parts = classKey.split(/[-_\s]/).filter(Boolean);
  const g = parts[0] || '';
  const c = parts[1] || '';

  // 유치원 계열인 경우 '학년'을 붙이지 않고 자연스럽게 표시
  if (g.includes('유치') || g.toUpperCase() === 'K') {
    return c ? `${g} ${c.replace(/반$/, '')}반` : `${g}반`;
  }

  // 숫자 학년인 경우
  const gNum = g.replace(/[^0-9]/g, '');
  const cNum = c.replace(/[^0-9]/g, '');
  if (gNum && cNum) {
    return `${gNum}학년 ${cNum}반`;
  }
  if (gNum) {
    return `${gNum}학년 ${c.replace(/반$/, '')}반`;
  }
  return classKey.replace('-', '학년 ') + (classKey.endsWith('반') ? '' : '반');
}

export default function TeacherHomeroomApplyPage() {
  const { user, profile } = useAuth();
  const router = useRouter();
  const { toast } = useToast();

  const [orgStructure, setOrgStructure] = useState<Partial<OrgStructure> | null>(null);
  const [allStudents, setAllStudents] = useState<MasterStudent[]>([]);
  const [docConfig, setDocConfig] = useState<Partial<DocConfig> | null>(null);
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // 스쿨버스 요일별 하교 노선 실시간 구독 상태
  const [afternoonRoutes, setAfternoonRoutes] = useState<Route[]>([]);
  const [kisbuses, setKisbuses] = useState<Bus[]>([]);

  // 하교 버스 해제 확인 팝업 상태
  const [busUnassignTarget, setBusUnassignTarget] = useState<{
    studentId: string;
    studentName: string;
    dayOfWeek: DayOfWeek;
    dayLabel: string;
    routeId: string;
    busNo: string;
  } | null>(null);
  const [isBusUnassigning, setIsBusUnassigning] = useState(false);

  // 문서 유형 (체험학습 신청서 vs 결석계)
  const [docCategory, setDocCategory] = useState<'field-trip' | 'absence'>('field-trip');

  // 상단 메인 탭: 'student-info' (학생 정보 확인, 기본 우선 선택) | 'proxy' (출결/체험학습 대리 작성)
  const [activeMainTab, setActiveMainTab] = useState<'student-info' | 'proxy'>('student-info');
  const [isBatchPhotoOpen, setIsBatchPhotoOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editStudentForm, setEditStudentForm] = useState<Partial<MasterStudent>>({});
  const editPhotoInputRef = useRef<HTMLInputElement>(null);

  const handleStartEditStudent = (student: MasterStudent) => {
    const defaultEnName = student.nameEn || extractEnglishNameFromEmail(student.studentEmail || '');
    setEditStudentForm({
      ...student,
      studentId: student.studentId || student.id,
      name: student.nameKo || student.name || '',
      nameEn: defaultEnName,
      studentEmail: student.studentEmail || '',
      grade: String(student.grade || '1'),
      classNum: String(student.classNum || '1'),
      studentNum: String(student.studentNum || ''),
      gender: student.gender || 'Male',
      contact: student.contact || '',
      address: student.address || '',
      photoUrl: student.photoUrl || ''
    });
    setIsEditDialogOpen(true);
  };

  const handleEditPhotoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const resizedBase64 = await resizeStudentPhoto(file);
      setEditStudentForm(prev => ({ ...prev, photoUrl: resizedBase64 }));
      toast({ title: '사진 규격 최적화 완료', description: '가로세로 2cm 규격으로 자동 압축되었습니다.' });
    } catch (err) {
      console.error(err);
      toast({ title: '사진 변환 오류', description: '사진 변환 중 오류가 발생했습니다.', variant: 'destructive' });
    }
  };

  const handleSaveEditStudent = async () => {
    if (!editStudentForm.studentId) return;
    try {
      await updateMasterStudent(editStudentForm.studentId, {
        name: editStudentForm.name,
        nameEn: editStudentForm.nameEn || '',
        grade: String(editStudentForm.grade || '1'),
        classNum: String(editStudentForm.classNum || '1'),
        studentNum: String(editStudentForm.studentNum || ''),
        gender: editStudentForm.gender,
        contact: editStudentForm.contact,
        address: editStudentForm.address,
        photoUrl: editStudentForm.photoUrl
      });
      setIsEditDialogOpen(false);
      toast({ title: '학생 정보 수정 완료', description: '학생 정보가 성공적으로 반영되었습니다.' });
    } catch (err) {
      console.error(err);
      toast({ title: '수정 실패', description: '학생 정보 수정 중 오류가 발생했습니다.', variant: 'destructive' });
    }
  };

  // 선택된 학급 키 (예: "4-4")
  const [selectedClassKey, setSelectedClassKey] = useState<string>('');
  // 선택된 학생 ID
  const [selectedStudentId, setSelectedStudentId] = useState<string>('');

  // 신청일자/접수일자 (기본 오늘, 과거 일자 소급 수정 가능)
  const [applyDate, setApplyDate] = useState<string>(format(new Date(), 'yyyy-MM-dd'));

  // 공통 학생 정보
  const [studentName, setStudentName] = useState('');
  const [gradeClassNumber, setGradeClassNumber] = useState('');
  const [parentPhone, setParentPhone] = useState('');
  const [parentName, setParentName] = useState('');

  // 1. 체험학습 신청서 폼 상태
  const [ftStartDate, setFtStartDate] = useState('');
  const [ftEndDate, setFtEndDate] = useState('');
  const [ftTotalDays, setFtTotalDays] = useState<number>(1);
  const [ftType, setFtType] = useState('가족동반여행');
  const [ftDestination, setFtDestination] = useState('');
  const [ftCompanionName, setFtCompanionName] = useState('');
  const [ftCompanionRelation, setFtCompanionRelation] = useState('부모');
  const [ftPurpose, setFtPurpose] = useState('');
  const [ftDetailedPlan, setFtDetailedPlan] = useState('');

  // 2. 결석계 폼 상태
  const [absStartDate, setAbsStartDate] = useState('');
  const [absEndDate, setAbsEndDate] = useState('');
  const [absTotalDays, setAbsTotalDays] = useState<number>(1);
  const [absType, setAbsType] = useState<'병결' | '미인정' | '기타' | '출석인정'>('병결');
  const [absReason, setAbsReason] = useState('');
  const [teacherConfirmMethod, setTeacherConfirmMethod] = useState<'전화/문자' | '학부모 내교' | '가정방문' | '기타'>('전화/문자');

  // 누적 통계
  const [accumulatedFtDays, setAccumulatedFtDays] = useState<number>(0);
  const [accumulatedAbsDays, setAccumulatedAbsDays] = useState<number>(0);

  // 학사일정 (공휴일 자동 제외)
  const academicCalConfig = docConfig?.academicCalendar;
  const semesterEvents = academicCalConfig?.events || [];

  // 연간 누계 자동 계산 기능 활성화 여부
  const enableCumulative = docConfig?.enableCumulativeStats !== false;

  // 데이터 로드 및 실시간 구독 (1.2초 안전 타이머로 무한 로딩 방어)
  useEffect(() => {
    let isMounted = true;

    // 안전 타이머: 네트워크 지연 시에도 1.2초 후 로딩 해제
    const safetyTimer = setTimeout(() => {
      if (isMounted) setLoading(false);
    }, 1200);

    getDocConfig()
      .then(cfg => { if (isMounted) setDocConfig(cfg); })
      .catch(err => console.error('[Homeroom] getDocConfig error:', err));

    const unsubOrg = onOrgStructureUpdate(org => {
      if (isMounted) setOrgStructure(org);
    });

    const unsubStudents = onMasterStudentsUpdate(students => {
      if (isMounted) {
        setAllStudents(students || []);
        setLoading(false);
      }
    });

    const unsubRoutes = onRoutesUpdate(routes => {
      if (isMounted) {
        setAfternoonRoutes(routes.filter(r => r.type === 'Afternoon'));
      }
    });

    const unsubBuses = onBusesUpdate(buses => {
      if (isMounted) setKisbuses(buses);
    });

    return () => {
      isMounted = false;
      clearTimeout(safetyTimer);
      unsubOrg();
      unsubStudents();
      unsubRoutes();
      unsubBuses();
    };
  }, []);

  // 현재 로그인한 교사가 담당하는 반 목록 계산
  const myHomeroomKeys = useMemo(() => {
    if (!user?.email || !orgStructure?.homerooms) return [];
    const normalizedEmail = user.email.trim().toLowerCase();
    const keys: string[] = [];

    Object.entries(orgStructure.homerooms).forEach(([classKey, teacherEmail]) => {
      if (teacherEmail && teacherEmail.trim().toLowerCase() === normalizedEmail) {
        keys.push(classKey);
      }
    });

    return keys.sort(compareClassKeys);
  }, [user?.email, orgStructure]);

  // 권한 판별: 학급 담임, 학생출결 담당자, 시스템 설정 담당자
  const homeroomPermissions = useMemo(() => {
    return checkHomeroomAccessPermission(user?.email, profile, orgStructure);
  }, [user?.email, profile, orgStructure]);

  // 전교 학급 접근 권한 여부: 학생출결 담당자 또는 시스템 설정 담당자만 모든 학년/학급 접근 가능
  const canAccessAllClasses = homeroomPermissions.canAccessAllClasses;

  // 선택 가능한 반 목록:
  // - 학생출결 담당자 및 시스템 설정 담당자: 전교 모든 학급 선택 가능
  // - 학급 담임 교사: 본인의 담당 학급(myHomeroomKeys)만 엄격 격리 선택 가능
  const availableClassKeys = useMemo(() => {
    if (canAccessAllClasses) {
      const set = new Set<string>();
      if (orgStructure?.homerooms) {
        Object.keys(orgStructure.homerooms).forEach(k => set.add(k));
      }
      allStudents.forEach(s => {
        if (s.grade && s.classNum) set.add(`${s.grade}-${s.classNum}`);
      });
      return Array.from(set).sort(compareClassKeys);
    }
    return myHomeroomKeys.sort(compareClassKeys);
  }, [canAccessAllClasses, myHomeroomKeys, orgStructure, allStudents]);

  // 기본 반 자동 지정
  useEffect(() => {
    if (!selectedClassKey && availableClassKeys.length > 0) {
      setSelectedClassKey(availableClassKeys[0]);
    }
  }, [availableClassKeys, selectedClassKey]);

  // 선택된 반에 속한 학생 목록 (유치원 및 초등 학년 모두 안전 매칭)
  const classStudents = useMemo(() => {
    if (!selectedClassKey) return [];
    const parts = selectedClassKey.split(/[-_\s]/).filter(Boolean);
    const targetGrade = parts[0] || '';
    const targetClass = parts[1] || '';

    const targetGNum = parseInt(targetGrade.replace(/[^0-9]/g, ''), 10);
    const targetCNum = parseInt(targetClass.replace(/[^0-9]/g, ''), 10);

    return allStudents.filter(s => {
      if (s.status === 'graduated' || s.status === 'transferred') return false;
      const sGrade = String(s.grade || '').trim();
      const sClass = String(s.classNum || '').trim();

      // 1. 문자열 완전 일치 (예: 유치원국화반-2)
      if (sGrade === targetGrade && sClass === targetClass) return true;

      // 2. 숫자 학년/반 일치 (예: 1-1, 5-3)
      const sGNum = parseInt(sGrade.replace(/[^0-9]/g, ''), 10);
      const sCNum = parseInt(sClass.replace(/[^0-9]/g, ''), 10);
      if (!isNaN(targetGNum) && !isNaN(sGNum) && targetGNum === sGNum && !isNaN(targetCNum) && !isNaN(sCNum) && targetCNum === sCNum) {
        const isTargetKind = targetGrade.includes('유치') || targetGrade.toUpperCase() === 'K';
        const isSKind = sGrade.includes('유치') || sGrade.toUpperCase() === 'K';
        if (isTargetKind !== isSKind) return false;
        return true;
      }

      return false;
    }).sort((a, b) => (Number(a.studentNum) || 0) - (Number(b.studentNum) || 0));
  }, [selectedClassKey, allStudents]);

  // ─── 학생별 요일별 하교 버스 맵 ────────────────────────────────────────────
  // key: studentId, value: { dayOfWeek: { busNo, routeId } }
  const studentAfternoonBusMap = useMemo(() => {
    const DAY_ORDER: DayOfWeek[] = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
    const busMap = new Map<string, string>(); // busId -> busNo
    kisbuses.forEach(b => { if (b.name) busMap.set(b.id, b.name); });

    const result = new Map<string, Record<DayOfWeek, { busNo: string; routeId: string } | null>>();
    const studentIds = new Set<string>(
      classStudents.map(s => (s.studentId || s.id || '') as string).filter(Boolean)
    );

    studentIds.forEach(sid => {
      const dayRecord: Record<DayOfWeek, { busNo: string; routeId: string } | null> = {
        Monday: null, Tuesday: null, Wednesday: null, Thursday: null, Friday: null, Saturday: null,
      };
      DAY_ORDER.forEach(day => {
        const route = afternoonRoutes.find(r =>
          r.dayOfWeek === day &&
          r.seating.some(seat => seat.studentId === sid)
        );
        if (route) {
          const busNo = busMap.get(route.busId) || route.busId;
          dayRecord[day] = { busNo, routeId: route.id };
        }
      });
      result.set(sid as string, dayRecord);
    });

    return result;
  }, [afternoonRoutes, kisbuses, classStudents]);

  // ─── 오늘 출석부 연동 상태 ──────────────────────────────────────────────────
  const [attendanceDate, setAttendanceDate] = useState<string>(() => format(new Date(), 'yyyy-MM-dd'));
  const [homeroomAttendanceRecords, setHomeroomAttendanceRecords] = useState<HomeroomAttendanceRecord[]>([]);
  const [approvedAbsenceMap, setApprovedAbsenceMap] = useState<Map<string, { status: 'ABSENT'; reason: string; source: 'auto_field_trip' | 'auto_absence' }>>(new Map());
  const [studentSearchQuery, setStudentSearchQuery] = useState('');
  const [highlightedStudentId, setHighlightedStudentId] = useState<string | null>(null);

  // 검색어에 따른 학생 필터링
  const searchFilteredStudents = useMemo(() => {
    if (!studentSearchQuery.trim()) return [];
    const q = studentSearchQuery.trim().toLowerCase();
    return classStudents.filter((s) => {
      const name = (s.nameKo || s.name || '').toLowerCase();
      const num = String(s.studentNum || '');
      const email = (s.studentEmail || '').toLowerCase();
      return name.includes(q) || num === q || email.includes(q);
    });
  }, [classStudents, studentSearchQuery]);

  // 날짜 변경 감지 및 실시간 일일 출석 구독
  useEffect(() => {
    if (!selectedClassKey) return;
    const unsub = onHomeroomAttendanceUpdate(attendanceDate, selectedClassKey, (records) => {
      setHomeroomAttendanceRecords(records || []);
    });
    return () => unsub();
  }, [attendanceDate, selectedClassKey]);

  // 날짜 또는 학급 변경 시 승인된 결석/체험학습 결재 문서 자동 조회 및 반영
  useEffect(() => {
    if (!selectedClassKey) return;
    let isCurrent = true;
    getApprovedAbsenceStudentsForDate(attendanceDate, selectedClassKey).then((map) => {
      if (isCurrent) {
        setApprovedAbsenceMap(map);
      }
    });
    return () => {
      isCurrent = false;
    };
  }, [attendanceDate, selectedClassKey]);

  // 학생별 최종 출결 상태 및 사유 산출 맵
  const effectiveAttendanceMap = useMemo(() => {
    const map = new Map<string, { status: HomeroomAttendanceStatus; reason?: string; source: string }>();

    // 1단계: 승인된 결석/체험학습 문서가 있는 경우 자동 '결석'
    classStudents.forEach((student) => {
      const sId = student.studentId || student.id || '';
      if (!sId) return;
      const sName = (student.nameKo || student.name || '').trim();
      const approved = approvedAbsenceMap.get(sName);
      if (approved) {
        map.set(sId, {
          status: 'ABSENT',
          reason: approved.reason,
          source: approved.source,
        });
      }
    });

    // 2단계: 담임 교사가 수동으로 변경한 레코드가 있다면 우선 적용
    homeroomAttendanceRecords.forEach((r) => {
      if (r.studentId) {
        map.set(r.studentId, {
          status: r.status,
          reason: r.reason,
          source: r.source,
        });
      }
    });

    return map;
  }, [classStudents, approvedAbsenceMap, homeroomAttendanceRecords]);

  // 출결 상태 변경 및 스쿨버스/방과후 자동 동기화 핸들러
  const handleAttendanceChange = async (student: MasterStudent, newStatus: HomeroomAttendanceStatus) => {
    const sId = student.studentId || student.id || '';
    if (!sId) return;
    const sName = (student.nameKo || student.name || '').trim();

    try {
      const res = await saveHomeroomAttendanceAndSync({
        date: attendanceDate,
        studentId: sId,
        studentName: sName,
        gradeClass: selectedClassKey,
        status: newStatus,
        source: 'manual',
        updatedBy: user?.email || '',
      });

      if (res.success) {
        toast({
          title: '출결 반영 완료',
          description: `${sName} 학생: [${newStatus === 'ATTEND' ? '출석' : newStatus === 'ABSENT' ? '결석' : newStatus === 'EARLY_LEAVE' ? '조퇴' : '개별하교'}] (스쿨버스/방과후 자동 동기화)`,
        });
      } else {
        toast({
          variant: 'destructive',
          title: '출결 반영 실패',
          description: res.error || '저장 중 오류가 발생했습니다.',
        });
      }
    } catch (err) {
      console.error('Attendance change error:', err);
    }
  };

  // 학생 검색 및 해당 행으로 자동 스크롤 이동
  const handleSearchSelectStudent = (targetStudentId: string) => {
    setHighlightedStudentId(targetStudentId);
    setStudentSearchQuery('');

    setTimeout(() => {
      const rowElem = document.getElementById(`student-row-${targetStudentId}`);
      if (rowElem) {
        rowElem.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }, 100);

    // 3초 후 강조 해제
    setTimeout(() => {
      setHighlightedStudentId((prev) => (prev === targetStudentId ? null : prev));
    }, 3000);
  };

  // 학생 선택 시 자동 입력 처리
  const handleSelectStudent = (studentId: string) => {
    setSelectedStudentId(studentId);
    const s = classStudents.find(item => item.id === studentId);
    if (s) {
      setStudentName(s.name || '');
      const gcn = `${s.grade}-${s.classNum}-${s.studentNum || 1}`;
      setGradeClassNumber(gcn);
      setParentPhone(s.emergencyContact || s.contact || '');
      setParentName(s.parentName || `${s.name} 학부모`);
      setFtCompanionName(s.parentName || `${s.name} 보호자`);

      // 누적 일수 로드
      const currentYearStr = new Date().getFullYear().toString();
      getStudentFieldTripDays(s.name, gcn, currentYearStr).then(days => setAccumulatedFtDays(days));
      getStudentAbsenceDays(s.name, gcn, currentYearStr).then(days => setAccumulatedAbsDays(days));
    }
  };

  // 체험학습 총 일수 자동 계산 (공휴일/휴업일 제외)
  useEffect(() => {
    if (ftStartDate && ftEndDate) {
      const days = getWorkingDaysCount(ftStartDate, ftEndDate, semesterEvents);
      setFtTotalDays(Math.max(days, 1));
    }
  }, [ftStartDate, ftEndDate, semesterEvents]);

  // 결석계 총 일수 자동 계산 (공휴일/휴업일 제외)
  useEffect(() => {
    if (absStartDate && absEndDate) {
      const days = getWorkingDaysCount(absStartDate, absEndDate, semesterEvents);
      setAbsTotalDays(Math.max(days, 1));
    }
  }, [absStartDate, absEndDate, semesterEvents]);

  // 제출 및 바로 결재 처리
  const handleSubmitAndApprove = async () => {
    if (!user || !profile) {
      toast({ variant: 'destructive', title: '로그인 필요', description: '교직원 로그인이 필요합니다.' });
      return;
    }

    if (!selectedStudentId || !studentName) {
      toast({ variant: 'destructive', title: '학생 선택 필요', description: '대리 작성할 학생을 선택해 주세요.' });
      return;
    }

    if (docCategory === 'field-trip') {
      if (!ftStartDate || !ftEndDate) {
        toast({ variant: 'destructive', title: '기간 입력 필요', description: '체험학습 시작일과 종료일을 입력해 주세요.' });
        return;
      }
      if (!ftDestination.trim()) {
        toast({ variant: 'destructive', title: '목적지 입력 필요', description: '방문 장소를 입력해 주세요.' });
        return;
      }
    } else {
      if (!absStartDate || !absEndDate) {
        toast({ variant: 'destructive', title: '기간 입력 필요', description: '결석 시작일과 종료일을 입력해 주세요.' });
        return;
      }
      if (!absReason.trim()) {
        toast({ variant: 'destructive', title: '사유 입력 필요', description: '결석 사유를 입력해 주세요.' });
        return;
      }
    }

    if (!profile.signature) {
      toast({ 
        variant: 'destructive', 
        title: '서명 필요', 
        description: '교사 서명이 등록되어 있지 않습니다. 프로필에서 서명을 먼저 등록해 주세요.' 
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const [gStr, cStr] = selectedClassKey.split('-');
      // 학급별 결재선 획득 (담임, 부장, 교감, 교장)
      const approvers = await getApproversByGradeClass(gStr, cStr);
      
      const isFieldTrip = docCategory === 'field-trip';
      const docTitle = isFieldTrip 
        ? `[대리작성] 교외체험학습 신청서 (${studentName}, ${gradeClassNumber})`
        : `[대리작성] 결석계 (${studentName}, ${gradeClassNumber})`;

      const parentFormData: any = isFieldTrip ? {
        type: 'field-trip',
        studentName,
        gradeClassNumber,
        phone: parentPhone,
        tripPeriod: {
          startDate: ftStartDate,
          endDate: ftEndDate,
          totalDays: ftTotalDays
        },
        cumulativeDays: accumulatedFtDays,
        tripType: ftType,
        destination: ftDestination,
        companionName: ftCompanionName,
        companionRelation: ftCompanionRelation,
        purpose: ftPurpose || '가족 체험학습 및 문화 탐방',
        detailedPlan: ftDetailedPlan || '일자별 현지 문화 체험 및 학습 활동',
        applyDate: applyDate, // 소급/수정 지정된 신청일자
        isProxyByTeacher: true,
        proxyTeacherName: profile.name,
        proxyTeacherEmail: profile.email
      } : {
        type: 'absence',
        studentName,
        gradeClassNumber,
        absencePeriod: {
          startDate: absStartDate,
          endDate: absEndDate,
          totalDays: absTotalDays
        },
        absenceType: absType,
        absenceReason: absReason,
        teacherConfirmMethod,
        teacherConfirmDate: applyDate,
        applyDate: applyDate, // 소급/수정 지정된 신청일자
        isProxyByTeacher: true,
        proxyTeacherName: profile.name,
        proxyTeacherEmail: profile.email
      };

      // 1. 기안문서 생성 (담임 교사가 작성)
      const createRes = await createDocument({
        title: docTitle,
        content: `<p>담임 교사(${profile.name})가 학생(${studentName})을 대리하여 작성한 신청서입니다.</p>`,
        docType: 'parent',
        category: 'general',
        approvers: approvers,
        attachments: [],
        parentFormData,
        publishStatus: '비공개'
      }, user.uid, profile);

      if (!createRes.success || !createRes.docId) {
        throw new Error(createRes.error || '문서 생성에 실패했습니다.');
      }

      const docId = createRes.docId;

      // 2. 담임 본인 결재 즉시 완료 처리
      const updateData: any = {
        applyDate: applyDate
      };
      if (!isFieldTrip) {
        updateData.absenceType = absType;
        updateData.teacherConfirmMethod = teacherConfirmMethod;
        updateData.teacherConfirmDate = applyDate;
      }

      const approveRes = await approveDocument(docId, profile, updateData, applyDate);
      if (!approveRes.success) {
        throw new Error(approveRes.error || '담임 서명 처리에 실패했습니다.');
      }

      toast({
        title: '작성 및 결재 완료!',
        description: `${studentName} 학생의 신청서가 성공적으로 작성되었으며, 담임 서명이 완료되어 다음 결재자에게 상신되었습니다.`
      });

      // 문서 상세 보기로 이동
      router.push(`/documents/${docId}`);
    } catch (err: any) {
      console.error('대리 작성 오류:', err);
      toast({
        variant: 'destructive',
        title: '대리 작성 실패',
        description: err.message || '처리 중 오류가 발생했습니다.'
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return (
      <MainLayout title="담임 업무 관리소">
        <div className="flex h-[50vh] items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </MainLayout>
    );
  }

  // 학급 담임, 학생출결 담당자, 시스템 설정 담당자가 아닌 경우 접근 차단 안내
  if (availableClassKeys.length === 0 && !homeroomPermissions.canAccess) {
    return (
      <MainLayout title="담임 업무 관리소">
        <div className="max-w-xl mx-auto my-12 p-6 bg-amber-50 border border-amber-200 rounded-2xl text-center space-y-3">
          <AlertCircle className="w-10 h-10 text-amber-600 mx-auto" />
          <h2 className="text-lg font-bold text-amber-900">담임 및 출결 관리 권한이 없습니다</h2>
          <p className="text-xs text-amber-700 leading-relaxed">
            현재 로그인하신 계정({user?.email})은 학급 담임, 학생출결 담당자, 또는 시스템 설정 담당자로 등록되어 있지 않습니다.
            조직도 설정을 확인하시거나 관리자에게 문의해 주세요.
          </p>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout title="담임 교사 업무 관리소" contentClassName="p-4 md:p-6 font-body">
      <div className="w-full space-y-6">
      {/* 헤더 */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b pb-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-2 bg-primary/10 text-primary rounded-xl">
              <Users2 className="w-6 h-6" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground font-headline">
              담임 교사 업무 관리소
            </h1>
            {canAccessAllClasses && (
              <Badge variant="secondary" className="bg-amber-100 text-amber-900 border-amber-200 text-xs font-bold px-2 py-0.5">
                {homeroomPermissions.isSystemManager ? '시스템 설정 담당 (전교 권한)' : '학생출결 담당 (전교 권한)'}
              </Badge>
            )}
            {!canAccessAllClasses && homeroomPermissions.isHomeroomTeacher && (
              <Badge variant="outline" className="bg-slate-50 text-slate-700 border-slate-200 text-xs font-semibold px-2 py-0.5">
                학급 담임
              </Badge>
            )}
          </div>
          <p className="text-xs sm:text-sm text-muted-foreground mt-1">
            {canAccessAllClasses 
              ? '전교 모든 학급의 학생 정보 확인, 출결 관리 및 결석/체험학습 대리 작성을 총괄합니다.'
              : '담당 학급 학생들의 계정 정보를 확인하고 사진을 관리하며, 출결 및 체험학습 신청을 대리 작성합니다.'}
          </p>
        </div>
      </div>

      {/* 상단 탭 네비게이션 */}
      <Tabs value={activeMainTab} onValueChange={(val: any) => setActiveMainTab(val)} className="w-full space-y-6">
        <TabsList className="grid grid-cols-2 w-full max-w-md bg-slate-100 p-1 rounded-xl">
          <TabsTrigger value="student-info" className="text-xs font-bold py-2">
            학생 정보 확인 ({classStudents.length}명)
          </TabsTrigger>
          <TabsTrigger value="proxy" className="text-xs font-bold py-2">
            출결/체험학습 대리 작성
          </TabsTrigger>
        </TabsList>

        {/* 탭 1: 출결/체험학습 대리 작성 */}
        <TabsContent value="proxy" className="space-y-6">
          {/* 1. 학급 및 학생 선택 카드 */}
          <Card className="border-border/80 shadow-xs">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-bold flex items-center gap-2">
            <User className="w-4 h-4 text-primary" />
            <span>1. 대상 학생 선택</span>
          </CardTitle>
          <CardDescription className="text-xs">
            담당 학급을 선택하고 문서를 작성할 학생을 선택해 주세요.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* 학급 선택 */}
            <div className="space-y-1.5">
              <Label className="text-xs font-bold">담당 학급</Label>
              <Select value={selectedClassKey} onValueChange={(val) => { setSelectedClassKey(val); setSelectedStudentId(''); }}>
                <SelectTrigger className="h-10 text-xs font-semibold bg-white">
                  <SelectValue placeholder="학급 선택" />
                </SelectTrigger>
                <SelectContent>
                  {availableClassKeys.map(key => (
                    <SelectItem key={key} value={key} className="text-xs font-medium">
                      {formatClassLabel(key)} {myHomeroomKeys.includes(key) ? '(내 학급)' : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* 학생 선택 */}
            <div className="space-y-1.5">
              <Label className="text-xs font-bold">학생 선택</Label>
              <Select value={selectedStudentId} onValueChange={handleSelectStudent}>
                <SelectTrigger className="h-10 text-xs font-semibold bg-white">
                  <SelectValue placeholder={classStudents.length === 0 ? "학급 학생 없음" : "학생을 선택하세요"} />
                </SelectTrigger>
                <SelectContent className="max-h-56">
                  {classStudents.map(st => {
                    const valKey = st.studentId || st.id || st.studentEmail;
                    return (
                      <SelectItem key={valKey} value={valKey} className="text-xs">
                        {st.studentNum ? `${st.studentNum}번 ` : ''}{st.name}
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* 선택 학생 상세 요약 */}
          {selectedStudentId && (
            <div className="p-3 bg-indigo-50/70 border border-indigo-200 rounded-xl flex flex-wrap items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-2">
                <Badge className="bg-indigo-600 text-white font-bold text-[11px] px-2 py-0.5">
                  선택됨
                </Badge>
                <span className="font-bold text-indigo-950 text-sm">{studentName}</span>
                <span className="text-indigo-800">({gradeClassNumber})</span>
                {parentPhone && <span className="text-slate-600 text-xs">· 연락처: {parentPhone}</span>}
              </div>

              {enableCumulative && (
                <div className="flex items-center gap-3 text-xs font-semibold text-slate-700">
                  <span>체험학습 누적: <strong className="text-indigo-700 font-bold">{accumulatedFtDays}일</strong></span>
                  <span>결석 누적: <strong className="text-rose-600 font-bold">{accumulatedAbsDays}일</strong></span>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* 2. 결재일자/신청일자 지정 카드 */}
      <Card className="border-border/80 shadow-xs">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-bold flex items-center gap-2">
            <CalendarIcon className="w-4 h-4 text-primary" />
            <span>2. 결재일자 및 신청일자 지정</span>
          </CardTitle>
          <CardDescription className="text-xs">
            종이 신청서 접수일이나 사전 전화 통보일 등 원하시는 일자로 소급하여 결재일자를 지정할 수 있습니다.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="max-w-xs space-y-1.5">
            <Label className="text-xs font-bold text-slate-800">결재일 (신청서 제출일자)</Label>
            <Input 
              type="date" 
              value={applyDate} 
              onChange={(e) => setApplyDate(e.target.value)}
              className="h-10 text-xs font-semibold bg-white"
            />
            <span className="text-[11px] text-muted-foreground block">
              * 지정된 날짜가 신청서 하단 제출일과 담임 승인일자로 기록됩니다.
            </span>
          </div>
        </CardContent>
      </Card>

      {/* 3. 문서 서식 작성 카드 (탭) */}
      <Card className="border-border/80 shadow-xs">
        <CardHeader className="pb-2">
          <Tabs value={docCategory} onValueChange={(val) => setDocCategory(val as any)} className="w-full">
            <TabsList className="grid grid-cols-2 w-full bg-slate-100 p-1 rounded-xl">
              <TabsTrigger value="field-trip" className="text-xs font-bold py-2 gap-2 data-[state=active]:bg-white data-[state=active]:text-primary data-[state=active]:shadow-xs">
                <Backpack className="w-4 h-4" />
                <span>교외체험학습 신청서</span>
              </TabsTrigger>
              <TabsTrigger value="absence" className="text-xs font-bold py-2 gap-2 data-[state=active]:bg-white data-[state=active]:text-primary data-[state=active]:shadow-xs">
                <CalendarOff className="w-4 h-4" />
                <span>결석계</span>
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </CardHeader>

        <CardContent className="pt-4 space-y-4">
          {/* 3-A. 체험학습 신청서 폼 */}
          {docCategory === 'field-trip' && (
            <div className="space-y-4 animate-in fade-in">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold">시작일 <span className="text-red-500">*</span></Label>
                  <Input type="date" value={ftStartDate} onChange={(e) => setFtStartDate(e.target.value)} className="text-xs bg-white" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold">종료일 <span className="text-red-500">*</span></Label>
                  <Input type="date" value={ftEndDate} onChange={(e) => setFtEndDate(e.target.value)} className="text-xs bg-white" />
                </div>
              </div>

              <div className="p-3 bg-slate-50 border rounded-xl flex items-center justify-between text-xs">
                <span className="font-semibold text-slate-700">신청 수업일수 (공휴일/주말 자동 제외)</span>
                <span className="font-bold text-indigo-700 text-sm">{ftTotalDays} 일간</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold">학습 형태</Label>
                  <Select value={ftType} onValueChange={setFtType}>
                    <SelectTrigger className="text-xs bg-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="가족동반여행" className="text-xs">가족동반여행</SelectItem>
                      <SelectItem value="친인척 방문" className="text-xs">친인척 방문</SelectItem>
                      <SelectItem value="답사·견학 활동" className="text-xs">답사·견학 활동</SelectItem>
                      <SelectItem value="체험활동" className="text-xs">체험활동</SelectItem>
                      <SelectItem value="기타" className="text-xs">기타</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-bold">방문 장소 (국가/도시) <span className="text-red-500">*</span></Label>
                  <Input 
                    placeholder="예: 베트남 다낭, 한국 서울" 
                    value={ftDestination} 
                    onChange={(e) => setFtDestination(e.target.value)} 
                    className="text-xs bg-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold">동행 보호자</Label>
                  <Input 
                    placeholder="보호자 성명" 
                    value={ftCompanionName} 
                    onChange={(e) => setFtCompanionName(e.target.value)} 
                    className="text-xs bg-white"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold">학생과의 관계</Label>
                  <Input 
                    placeholder="예: 부, 모" 
                    value={ftCompanionRelation} 
                    onChange={(e) => setFtCompanionRelation(e.target.value)} 
                    className="text-xs bg-white"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-bold">체험학습 목적</Label>
                <Input 
                  placeholder="예: 현지 문화 탐방 및 가족 유대 강화" 
                  value={ftPurpose} 
                  onChange={(e) => setFtPurpose(e.target.value)} 
                  className="text-xs bg-white"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-bold">구체적 계획</Label>
                <Textarea 
                  placeholder="예: 1일차 유적지 탐방, 2일차 자연 생태 체험 등" 
                  value={ftDetailedPlan} 
                  onChange={(e) => setFtDetailedPlan(e.target.value)} 
                  rows={3}
                  className="text-xs bg-white resize-none"
                />
              </div>
            </div>
          )}

          {/* 3-B. 결석계 폼 */}
          {docCategory === 'absence' && (
            <div className="space-y-4 animate-in fade-in">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold">결석 시작일 <span className="text-red-500">*</span></Label>
                  <Input type="date" value={absStartDate} onChange={(e) => setAbsStartDate(e.target.value)} className="text-xs bg-white" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold">결석 종료일 <span className="text-red-500">*</span></Label>
                  <Input type="date" value={absEndDate} onChange={(e) => setAbsEndDate(e.target.value)} className="text-xs bg-white" />
                </div>
              </div>

              <div className="p-3 bg-slate-50 border rounded-xl flex items-center justify-between text-xs">
                <span className="font-semibold text-slate-700">결석 수업일수 (공휴일/주말 자동 제외)</span>
                <span className="font-bold text-rose-600 text-sm">{absTotalDays} 일간</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold">결석 종류</Label>
                  <Select value={absType} onValueChange={(val) => setAbsType(val as any)}>
                    <SelectTrigger className="text-xs bg-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="병결" className="text-xs">병결</SelectItem>
                      <SelectItem value="미인정" className="text-xs">미인정</SelectItem>
                      <SelectItem value="기타" className="text-xs">기타</SelectItem>
                      <SelectItem value="출석인정" className="text-xs">출석인정</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-bold">담임 확인 방법</Label>
                  <Select value={teacherConfirmMethod} onValueChange={(val) => setTeacherConfirmMethod(val as any)}>
                    <SelectTrigger className="text-xs bg-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="전화/문자" className="text-xs">전화/문자</SelectItem>
                      <SelectItem value="학부모 내교" className="text-xs">학부모 내교</SelectItem>
                      <SelectItem value="가정방문" className="text-xs">가정방문</SelectItem>
                      <SelectItem value="기타" className="text-xs">기타</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-bold">결석 사유 <span className="text-red-500">*</span></Label>
                <Textarea 
                  placeholder="예: 감기 몸살 및 발열로 인한 가료 요양" 
                  value={absReason} 
                  onChange={(e) => setAbsReason(e.target.value)} 
                  rows={3}
                  className="text-xs bg-white resize-none"
                />
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 제출 액션 버튼 */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
        <p className="text-xs text-muted-foreground">
          * '작성 및 담임 결재 완료'를 누르면 문서가 생성되고 담임 서명이 즉시 완료되어 다음 결재자에게 상신됩니다.
        </p>
        <Button 
          size="lg" 
          onClick={handleSubmitAndApprove} 
          disabled={isSubmitting || !selectedStudentId}
          className="w-full sm:w-auto font-bold px-6 h-11 gap-2 bg-primary shadow-md hover:shadow-lg transition-all"
        >
          {isSubmitting ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              처리 중...
            </>
          ) : (
            <>
              <CheckCircle2 className="w-4 h-4" />
              작성 및 담임 결재 완료
              <ArrowRight className="w-4 h-4" />
            </>
          )}
        </Button>
      </div>
        </TabsContent>

        {/* 탭 2: 학생 정보 확인 (학급 학생 전용 뷰 및 일일 출석부) */}
        <TabsContent value="student-info" className="space-y-4">
          <Card className="rounded-2xl border-slate-200/80 shadow-xs">
            <CardHeader className="pb-3 border-b border-slate-100">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                <div>
                  <CardTitle className="text-base font-bold text-slate-800 flex items-center gap-2">
                    <Users className="w-4 h-4 text-indigo-600" />
                    <span>{selectedClassKey ? `${formatClassLabel(selectedClassKey)}` : ''} 학생 계정 및 오늘 출석부 ({classStudents.length}명)</span>
                  </CardTitle>
                  <CardDescription className="text-xs text-slate-500">
                    학생 출결 상태(출석·결석·조퇴·개별하교)를 체크하면 스쿨버스 및 방과후 출석부로 실시간 단독 연동됩니다.
                  </CardDescription>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  {/* 날짜 선택 (출석 기준일) */}
                  <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-lg px-2 py-1">
                    <CalendarIcon className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                    <Input
                      type="date"
                      value={attendanceDate}
                      onChange={(e) => setAttendanceDate(e.target.value)}
                      className="h-7 w-[125px] text-xs font-bold border-none bg-transparent p-0 shadow-none focus-visible:ring-0"
                    />
                  </div>

                  {/* 학급 선택 */}
                  {availableClassKeys.length > 1 && (
                    <div className="flex items-center gap-1">
                      <Select value={selectedClassKey} onValueChange={setSelectedClassKey}>
                        <SelectTrigger className="h-8 text-xs min-w-[110px] w-auto font-semibold bg-white">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="max-h-64">
                          {availableClassKeys.map(k => (
                            <SelectItem key={k} value={k} className="text-xs font-medium">
                              {formatClassLabel(k)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  {/* 사진 일괄 등록 */}
                  <Button 
                    type="button"
                    size="sm" 
                    onClick={() => setIsBatchPhotoOpen(true)}
                    className="h-8 text-xs px-2.5 font-bold whitespace-nowrap bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs cursor-pointer"
                  >
                    <Camera className="w-3.5 h-3.5 mr-1" /> 사진 일괄 등록
                  </Button>
                </div>
              </div>

              {/* 반 내부 학생 검색창 */}
              <div className="relative pt-2">
                <div className="relative max-w-sm">
                  <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-slate-400" />
                  <Input
                    type="search"
                    placeholder="우리 반 학생 검색 (이름, 번호)..."
                    value={studentSearchQuery}
                    onChange={(e) => setStudentSearchQuery(e.target.value)}
                    className="h-8 pl-8 text-xs bg-slate-50/70 border-slate-200 rounded-lg focus-visible:bg-white"
                  />
                </div>
                {/* 검색 결과 드롭다운 */}
                {searchFilteredStudents.length > 0 && (
                  <div className="absolute z-30 left-0 top-full mt-1 w-72 bg-white border border-slate-200 rounded-xl shadow-xl overflow-hidden py-1 max-h-56 overflow-y-auto overscroll-contain">
                    {searchFilteredStudents.map((st) => {
                      const stId = st.studentId || st.id || '';
                      if (!stId) return null;
                      return (
                        <div
                          key={stId}
                          onClick={() => handleSearchSelectStudent(stId)}
                          className="px-3 py-2 text-xs hover:bg-indigo-50 cursor-pointer flex items-center justify-between border-b border-slate-50 last:border-none"
                        >
                          <span className="font-bold text-slate-800">
                            {st.studentNum ? `${st.studentNum}번 ` : ''}{st.name}
                          </span>
                          <span className="text-[11px] text-indigo-600 font-medium">위치로 이동</span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </CardHeader>
            <CardContent className="pt-3">
              {/* 테이블 컨테이너 (고정 헤더 & 명단 영역 독립 스크롤) */}
              <div className="rounded-xl border border-slate-200 shadow-2xs max-h-[calc(100vh-320px)] overflow-y-auto overscroll-contain relative">
                <Table>
                  <TableHeader className="bg-slate-100 sticky top-0 z-20 shadow-xs">
                    <TableRow>
                      <TableHead className="w-[60px] whitespace-nowrap font-bold text-slate-700">번호</TableHead>
                      <TableHead className="whitespace-nowrap font-bold text-slate-700">학생 이름</TableHead>
                      <TableHead className="whitespace-nowrap font-bold text-slate-700 min-w-[130px]">오늘 출결</TableHead>
                      <TableHead className="whitespace-nowrap font-bold text-slate-700">학생 계정 이메일</TableHead>
                      <TableHead className="whitespace-nowrap font-bold text-slate-700">보호자 연락처</TableHead>
                      <TableHead className="whitespace-nowrap font-bold text-slate-700">방과후 수강 현황</TableHead>
                      <TableHead className="whitespace-nowrap font-bold text-slate-700">스쿨버스 노선</TableHead>
                      <TableHead className="text-right whitespace-nowrap font-bold text-slate-700">관리</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {classStudents.length > 0 ? (
                      classStudents.map(student => {
                        const sId = student.studentId || student.id || '';
                        const att = effectiveAttendanceMap.get(sId);
                        const currentStatus = att?.status || 'ATTEND';
                        const isAuto = att?.source === 'auto_field_trip' || att?.source === 'auto_absence';
                        const isHighlighted = highlightedStudentId === sId;

                        return (
                          <TableRow
                            key={sId}
                            id={`student-row-${sId}`}
                            className={cn(
                              "transition-all duration-300",
                              isHighlighted ? "bg-amber-100/80 ring-2 ring-amber-400 ring-inset" : "hover:bg-slate-50/80"
                            )}
                          >
                            <TableCell className="whitespace-nowrap font-medium text-slate-700">
                              {student.studentNum ? `${student.studentNum}번` : '-'}
                            </TableCell>
                            <TableCell className="whitespace-nowrap">
                              <div className="flex items-center gap-2.5">
                                <Avatar className="w-9 h-9 rounded-xl border border-slate-200 shrink-0 shadow-2xs bg-white">
                                  {student.photoUrl ? (
                                    <AvatarImage src={student.photoUrl} alt={student.name} className="object-cover rounded-xl" />
                                  ) : (
                                    <AvatarFallback className="bg-indigo-50 text-indigo-700 font-extrabold text-xs rounded-xl">
                                      {(student.name || '학생').slice(0, 2)}
                                    </AvatarFallback>
                                  )}
                                </Avatar>
                                <div className="flex flex-col items-start leading-tight">
                                  <span className="font-extrabold text-slate-900">{student.name}</span>
                                  <span className="text-[10px] text-slate-400 font-normal">
                                    {student.gender === 'Female' ? '여' : '남'}
                                  </span>
                                </div>
                              </div>
                            </TableCell>

                            {/* 오늘 출결 선택 드롭다운 칼럼 */}
                            <TableCell className="whitespace-nowrap">
                              <div className="flex items-center gap-1.5">
                                <Select
                                  value={currentStatus}
                                  onValueChange={(val: HomeroomAttendanceStatus) => handleAttendanceChange(student, val)}
                                >
                                  <SelectTrigger
                                    className={cn(
                                      "h-7 px-2 text-xs font-bold rounded-lg border cursor-pointer min-w-[75px]",
                                      currentStatus === 'ATTEND' && "bg-emerald-50 text-emerald-700 border-emerald-300",
                                      currentStatus === 'ABSENT' && "bg-rose-50 text-rose-700 border-rose-300",
                                      currentStatus === 'EARLY_LEAVE' && "bg-amber-50 text-amber-700 border-amber-300",
                                      currentStatus === 'INDIVIDUAL_DISMISSAL' && "bg-purple-50 text-purple-700 border-purple-300"
                                    )}
                                  >
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="ATTEND" className="text-xs font-bold text-emerald-700">
                                      출석
                                    </SelectItem>
                                    <SelectItem value="ABSENT" className="text-xs font-bold text-rose-700">
                                      결석
                                    </SelectItem>
                                    <SelectItem value="EARLY_LEAVE" className="text-xs font-bold text-amber-700">
                                      조퇴
                                    </SelectItem>
                                    <SelectItem value="INDIVIDUAL_DISMISSAL" className="text-xs font-bold text-purple-700">
                                      개별하교
                                    </SelectItem>
                                  </SelectContent>
                                </Select>

                                {isAuto && (
                                  <Badge
                                    variant="outline"
                                    title={att?.reason || '결재 승인 문서'}
                                    className="bg-rose-100 text-rose-800 border-rose-200 text-[10px] px-1 py-0 font-bold shrink-0"
                                  >
                                    {att?.source === 'auto_field_trip' ? '체험학습' : '결석계'}
                                  </Badge>
                                )}
                              </div>
                            </TableCell>

                            <TableCell className="whitespace-nowrap font-mono text-xs text-slate-600">
                              {student.studentEmail}
                            </TableCell>
                            <TableCell className="whitespace-nowrap text-xs text-slate-600">
                              {student.contact || '-'}
                            </TableCell>
                            <TableCell className="whitespace-normal min-w-[140px] max-w-[220px]">
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
                            <TableCell className="whitespace-normal min-w-[150px] max-w-[220px]">
                              {(() => {
                                const bSum = student.busSummary;
                                const sid = (student.studentId || student.id || '') as string;
                                const afternoonByDay = studentAfternoonBusMap.get(sid);
                                const afterschoolBuses = bSum?.afterSchoolBuses || [];
                                const hasAfternoonBus = afternoonByDay
                                  ? Object.values(afternoonByDay).some(v => v !== null)
                                  : false;
                                const hasMorningBus = !!bSum?.regularBusName;
                                const hasAfterschoolBuses = afterschoolBuses.length > 0;

                                const DAY_LABELS: Record<string, string> = {
                                  Monday: '월', Tuesday: '화', Wednesday: '수', Thursday: '목', Friday: '금',
                                };
                                const DAY_ORDER: DayOfWeek[] = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];

                                if (!hasMorningBus && !hasAfternoonBus && !hasAfterschoolBuses && !bSum?.assignedBusName) {
                                  return <span className="text-xs text-slate-400 italic whitespace-nowrap">자가 귀가</span>;
                                }

                                return (
                                  <div className="flex flex-col gap-1 py-1">
                                    {/* 등교 버스 (정규) */}
                                    {hasMorningBus && (
                                      <Badge variant="outline" className="bg-sky-50 text-sky-800 border-sky-200 text-[11px] font-semibold py-0.5 px-2 w-fit">
                                        <span className="font-bold text-sky-950 mr-1">[등교]</span>
                                        <span>{bSum!.regularBusName}</span>
                                      </Badge>
                                    )}
                                    {/* 하교 버스 - 요일별 항상 표시, 클릭 시 해제 팝업 */}
                                    {afternoonByDay && DAY_ORDER.map(day => {
                                      const info = afternoonByDay[day];
                                      if (!info) return null;
                                      const dayLabel = DAY_LABELS[day] || day;
                                      return (
                                        <Badge
                                          key={day}
                                          variant="outline"
                                          className="bg-blue-50 text-blue-800 border-blue-200 text-[11px] font-semibold py-0.5 px-2 w-fit cursor-pointer hover:bg-red-50 hover:border-red-300 hover:text-red-700 transition-colors"
                                          title={`${dayLabel}요일 하교 버스 해제/유지 선택`}
                                          onClick={() => setBusUnassignTarget({
                                            studentId: sid,
                                            studentName: student.nameKo || student.name || '',
                                            dayOfWeek: day,
                                            dayLabel,
                                            routeId: info.routeId,
                                            busNo: info.busNo,
                                          })}
                                        >
                                          <span className="font-bold text-blue-950 mr-1">[하교 {dayLabel}]</span>
                                          <span>{info.busNo}</span>
                                        </Badge>
                                      );
                                    })}
                                    {/* 방과후 버스 */}
                                    {afterschoolBuses.map((asb, idx) => (
                                      <Badge key={idx} variant="outline" className="bg-amber-50 text-amber-900 border-amber-200 text-[11px] font-semibold py-0.5 px-2 w-fit">
                                        <span className="font-bold text-amber-950 mr-1">[방과후 {asb.day}]</span>
                                        <span>{asb.busName}</span>
                                      </Badge>
                                    ))}
                                    {/* 기타 assignedBus (위에 아무것도 없을 때) */}
                                    {!hasMorningBus && !hasAfternoonBus && !hasAfterschoolBuses && bSum?.assignedBusName && (
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
                                type="button"
                                variant="outline" 
                                size="sm" 
                                className="h-7 text-xs px-2.5 text-indigo-700 hover:bg-indigo-50 border-indigo-200 cursor-pointer font-medium"
                                onClick={() => handleStartEditStudent(student)}
                              >
                                <Edit3 className="h-3.5 w-3.5 mr-1" /> 정보 수정
                              </Button>
                            </TableCell>
                          </TableRow>
                        );
                      })
                    ) : (
                      <TableRow>
                        <TableCell colSpan={8} className="h-28 text-center text-slate-500 whitespace-nowrap">
                          담당 학급에 등록된 학생이 없습니다.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* 사진 일괄 등록 모달 */}
      <BatchPhotoModal 
        isOpen={isBatchPhotoOpen}
        onClose={() => setIsBatchPhotoOpen(false)}
        students={allStudents}
      />

      {/* 개별 학생 정보 및 사진 수정 모달 */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="sm:max-w-[560px] w-[95vw] max-h-[88vh] overflow-y-auto p-6 rounded-2xl">
          <DialogHeader className="pb-1">
            <DialogTitle className="text-base font-bold flex items-center gap-2">
              <Edit3 className="h-4 w-4 text-indigo-600 shrink-0" /> 학급 학생 정보 및 사진 수정
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              {editStudentForm.studentEmail} 학생의 프로필 사진 및 기본 정보를 수정합니다.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2 text-xs">
            {/* 사진 등록 섹션 (가로세로 2cm 규격) */}
            <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-2.5">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <span className="font-bold text-slate-800 text-xs">학생 프로필 사진 (가로세로 2cm 규격)</span>
                <Badge variant="outline" className="text-[10px] bg-indigo-50 border-indigo-200 text-indigo-700 font-medium px-2 py-0.5">
                  PC 최적 160x160 자동 압축
                </Badge>
              </div>
              <div className="flex items-center gap-4">
                <Avatar className="rounded-2xl border-2 border-indigo-200 shadow-2xs shrink-0 bg-white" style={{ width: '2cm', height: '2cm' }}>
                  {editStudentForm.photoUrl ? (
                    <AvatarImage src={editStudentForm.photoUrl} alt={editStudentForm.name || '학생'} className="object-cover rounded-2xl" />
                  ) : (
                    <AvatarFallback className="bg-indigo-50 text-indigo-700 font-bold text-xs rounded-2xl">
                      사진 없음
                    </AvatarFallback>
                  )}
                </Avatar>
                <div className="space-y-2 flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <input
                      type="file"
                      ref={editPhotoInputRef}
                      onChange={handleEditPhotoChange}
                      accept="image/*"
                      className="hidden"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => editPhotoInputRef.current?.click()}
                      className="h-8 text-xs px-3 bg-white border-indigo-200 text-indigo-700 hover:bg-indigo-50 font-bold cursor-pointer shadow-2xs"
                    >
                      <Camera className="w-3.5 h-3.5 mr-1" />
                      사진 업로드
                    </Button>
                    {editStudentForm.photoUrl && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => setEditStudentForm(prev => ({ ...prev, photoUrl: '' }))}
                        className="h-8 text-xs px-2.5 text-rose-600 hover:bg-rose-50 cursor-pointer"
                      >
                        사진 삭제
                      </Button>
                    )}
                  </div>
                  <p className="text-[11px] text-slate-500 leading-tight">
                    사진을 선택하면 증명사진용 2cm 정사각형으로 자동 압축되어 즉시 적용됩니다.
                  </p>
                </div>
              </div>
            </div>

            {/* 인적사항 입력 필드 */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs font-bold text-slate-700">학생 이름</Label>
                <Input
                  value={editStudentForm.name || ''}
                  onChange={(e) => setEditStudentForm(prev => ({ ...prev, name: e.target.value }))}
                  className="h-8 text-xs bg-white"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs font-bold text-slate-700">학생 영문 이름</Label>
                <Input
                  value={editStudentForm.nameEn || ''}
                  onChange={(e) => setEditStudentForm(prev => ({ ...prev, nameEn: e.target.value }))}
                  placeholder="예: Kwon Garim"
                  className="h-8 text-xs bg-white font-medium"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs font-bold text-slate-700">출석 번호</Label>
                <Input
                  value={editStudentForm.studentNum || ''}
                  onChange={(e) => setEditStudentForm(prev => ({ ...prev, studentNum: e.target.value }))}
                  placeholder="예: 5"
                  className="h-8 text-xs bg-white"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs font-bold text-slate-700">성별</Label>
                <Select
                  value={editStudentForm.gender || 'Male'}
                  onValueChange={(val: any) => setEditStudentForm(prev => ({ ...prev, gender: val }))}
                >
                  <SelectTrigger className="h-8 text-xs bg-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Male">남학생</SelectItem>
                    <SelectItem value="Female">여학생</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1 col-span-2 sm:col-span-1">
                <Label className="text-xs font-bold text-slate-700">보호자 연락처</Label>
                <Input
                  value={editStudentForm.contact || ''}
                  onChange={(e) => setEditStudentForm(prev => ({ ...prev, contact: e.target.value }))}
                  placeholder="010-0000-0000"
                  className="h-8 text-xs bg-white"
                />
              </div>
            </div>

            <div className="space-y-1">
              <Label className="text-xs font-bold text-slate-700">거주지 주소 / 스쿨버스 정류장</Label>
              <Input
                value={editStudentForm.address || ''}
                onChange={(e) => setEditStudentForm(prev => ({ ...prev, address: e.target.value }))}
                placeholder="예: 현대아파트 앞"
                className="h-8 text-xs bg-white"
              />
            </div>
          </div>

          <DialogFooter className="pt-2 border-t flex items-center justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIsEditDialogOpen(false)}
              className="h-8 text-xs font-medium"
            >
              취소
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={handleSaveEditStudent}
              className="h-8 text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white"
            >
              저장 완료
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 하교 버스 해제 확인 Dialog */}
      <Dialog open={!!busUnassignTarget} onOpenChange={(open) => { if (!open) setBusUnassignTarget(null); }}>
        <DialogContent className="sm:max-w-[420px] w-[95vw] rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-base font-bold flex items-center gap-2">
              <LogOut className="h-4 w-4 text-red-500 shrink-0" />
              하교 버스 탑승 해제
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500 pt-1">
              {busUnassignTarget && (
                <>
                  <span className="font-semibold text-slate-700">{busUnassignTarget.studentName}</span> 학생을{' '}
                  <span className="font-semibold text-blue-700">{busUnassignTarget.dayLabel}요일 하교</span> 버스(
                  <span className="font-semibold">{busUnassignTarget.busNo}</span>)에서 미배정 처리합니다.
                  <br />
                  해제 후 스쿨버스 관리자/교사 페이지에 실시간 반영됩니다.
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="pt-2 border-t flex items-center justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setBusUnassignTarget(null)}
              className="h-8 text-xs font-medium"
              disabled={isBusUnassigning}
            >
              유지
            </Button>
            <Button
              type="button"
              size="sm"
              variant="destructive"
              disabled={isBusUnassigning}
              className="h-8 text-xs font-bold"
              onClick={async () => {
                if (!busUnassignTarget) return;
                setIsBusUnassigning(true);
                try {
                  await unassignStudentFromAllRoutes(
                    busUnassignTarget.studentId,
                    ['Afternoon'],
                    busUnassignTarget.dayOfWeek
                  );
                  toast({
                    title: '버스 탑승 해제 완료',
                    description: `${busUnassignTarget.studentName} - ${busUnassignTarget.dayLabel}요일 하교 버스(${busUnassignTarget.busNo}) 미배정 처리되었습니다.`,
                  });
                  setBusUnassignTarget(null);
                } catch (err) {
                  console.error('[BusUnassign]', err);
                  toast({
                    title: '해제 실패',
                    description: '버스 탑승 해제 중 오류가 발생했습니다.',
                    variant: 'destructive',
                  });
                } finally {
                  setIsBusUnassigning(false);
                }
              }}
            >
              {isBusUnassigning ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : null}
              해제
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  </MainLayout>
);
}
