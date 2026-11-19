'use client';

import React, { useState, useEffect } from 'react';
import { UserProfile, OrgStructure } from '@/lib/types';
import {
  FixtureHandoverDocument,
  FixtureItem,
  FixtureRoomType,
  FixtureTemplate
} from '@/lib/types/fixtureHandover';
import {
  getFixtureScopeKey,
  getFixtureTemplate,
  buildInitialFixtureItems,
  saveFixtureDocument,
  submitFixtureDocument,
  openFixturePrintWindow,
  resolveVicePrincipalNameFromOrg
} from '@/lib/services/fixtureHandoverService';
import { CURRENT_SCHOOL_YEAR } from '@/lib/services/handoverService';
import { getUsersDirectory, isFacultyMember } from '@/lib/services/userService';
import { getSchoolFacilities } from '@/lib/services/safetyService';
import type { SchoolFacility } from '@/lib/safety/types';
import { FixtureItemTable } from './FixtureItemTable';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import {
  School,
  Building2,
  Save,
  Send,
  Printer,
  ChevronLeft,
  Loader2,
  Sparkles,
  HelpCircle,
  RotateCcw,
  UserCheck,
  UserX,
  Search
} from 'lucide-react';

interface FixtureHandoverEditorProps {
  initialDoc?: FixtureHandoverDocument | null;
  currentUserProfile: UserProfile;
  org: OrgStructure | null;
  isLocked?: boolean;
  onSaved: (docId: string) => void;
  onCancel?: () => void;
}

const SPECIAL_ROOM_SUGGESTIONS = [
  '제1과학실',
  '제2과학실',
  '체육관',
  '제1음악실',
  '제2음악실',
  '영어전담실',
  'AI정보실',
  '컴퓨터실',
  '미술실',
  '보건실',
  '도서실'
];

export function FixtureHandoverEditor({
  initialDoc,
  currentUserProfile,
  org,
  isLocked = false,
  onSaved,
  onCancel
}: FixtureHandoverEditorProps) {
  const { toast } = useToast();

  const userEmail = currentUserProfile.email || '';
  const userName = currentUserProfile.name || '';

  // 1. 초기 담임 여부 및 교과 전담 판별
  const findTeacherHomeroom = (): { grade: string; classNum: string } | null => {
    if (!org?.homerooms) return null;
    const emailLower = userEmail.toLowerCase();
    for (const [gc, em] of Object.entries(org.homerooms)) {
      if (em && em.toLowerCase() === emailLower) {
        const parts = gc.split('-');
        if (parts.length >= 2) {
          return { grade: parts[0], classNum: parts[1] };
        }
      }
    }
    return null;
  };

  const homeroomInfo = findTeacherHomeroom();

  // 상태값
  const [type, setType] = useState<FixtureRoomType>(
    initialDoc?.type || (homeroomInfo ? 'CLASSROOM' : 'SPECIAL_ROOM')
  );
  const [grade, setGrade] = useState<string>(
    initialDoc?.grade || homeroomInfo?.grade || ''
  );
  const [classNum, setClassNum] = useState<string>(
    initialDoc?.classNum || homeroomInfo?.classNum || ''
  );
  const [roomName, setRoomName] = useState<string>(
    initialDoc?.roomName || (!homeroomInfo ? '제1과학실' : '')
  );

  const [year, setYear] = useState<number>(initialDoc?.year || CURRENT_SCHOOL_YEAR);
  const [targetNextYear, setTargetNextYear] = useState<number>(
    initialDoc?.targetNextYear || CURRENT_SCHOOL_YEAR + 1
  );
  const [handoverDate, setHandoverDate] = useState<string>(
    initialDoc?.handoverDate || new Date().toISOString().split('T')[0]
  );

  const [items, setItems] = useState<FixtureItem[]>(
    initialDoc?.items || buildInitialFixtureItems()
  );
  const [windowsPassword, setWindowsPassword] = useState<string>(
    initialDoc?.windowsPassword || '없음'
  );

  // 차년도 학급/시설 정보 및 담당 매핑 (시스템 설정 [시설 및 학급] 연동)
  const [matchedFacility, setMatchedFacility] = useState<SchoolFacility | null>(null);
  const [nextYearGrade, setNextYearGrade] = useState<string>(initialDoc?.nextYearGrade || '');
  const [nextYearClassNum, setNextYearClassNum] = useState<string>(initialDoc?.nextYearClassNum || '');
  const [nextYearRoomName, setNextYearRoomName] = useState<string>(initialDoc?.nextYearRoomName || '');

  // 전체 등록 시설 목록 및 특별실 검색/선택 상태 (사용자 임의 입력 방지용)
  const [allFacilities, setAllFacilities] = useState<SchoolFacility[]>([]);
  const [facilitySearchQuery, setFacilitySearchQuery] = useState<string>('');
  const [isFacilitySearchOpen, setIsFacilitySearchOpen] = useState<boolean>(false);

  const [successorName, setSuccessorName] = useState<string>(initialDoc?.successorName || '');
  const [successorEmail, setSuccessorEmail] = useState<string>(initialDoc?.successorEmail || '');
  const [allFaculty, setAllFaculty] = useState<UserProfile[]>([]);
  const resolvedOrgVpName = resolveVicePrincipalNameFromOrg(org);
  const [vicePrincipalName, setVicePrincipalName] = useState<string>(
    (initialDoc?.vicePrincipalName && initialDoc.vicePrincipalName !== '정영찬' ? initialDoc.vicePrincipalName : '') ||
      resolvedOrgVpName
  );

  const [isSaving, setIsSaving] = useState(false);
  const [isLoadingTemplate, setIsLoadingTemplate] = useState(false);

  // 전체 교원 목록 조회 (초경량 자동완성 검색용: 학생 및 학부모 100% 완전 배제)
  useEffect(() => {
    getUsersDirectory()
      .then((users) => {
        const facultyOnly = (users || []).filter((u) => {
          if (!u || !u.email) return false;

          const emailLower = u.email.toLowerCase().trim();
          const roleLower = (u.role || '').toLowerCase().trim();

          // 1. 학생/학부모 명시적 롤 및 이메일 패턴 즉시 배제
          if (
            roleLower === 'student' ||
            roleLower === '학생' ||
            roleLower === 'parent' ||
            roleLower === '학부모' ||
            roleLower === 'none' ||
            emailLower.includes('student') ||
            emailLower.includes('parent') ||
            /^\d{2,8}[a-zA-Z0-9._-]*@kshcm\.net$/i.test(emailLower) ||
            Boolean(u.studentNumber) ||
            Boolean(u.hashedPin)
          ) {
            return false;
          }

          // 2. KIS 표준 교직원 판별 함수 (명시적 플래그, 부서 소속, 교직원 직책 등)
          if (!isFacultyMember(u)) {
            return false;
          }

          return true;
        });

        // 가나다순 정렬
        facultyOnly.sort((a, b) => (a.name || '').localeCompare(b.name || '', 'ko'));
        setAllFaculty(facultyOnly);
      })
      .catch((err) => console.error('[FixtureHandoverEditor] fetch faculty error:', err));
  }, []);

  // 차년도 후임 인수자 자동 바인딩 헬퍼 (시스템 설정 [시설 및 학급] 매핑 데이터 ➔ 인계서 인수자 연동)
  const applySuccessorFromFacility = (fac: SchoolFacility | null, force = false) => {
    if (!fac) return;
    const nextName = (fac.nextYearTeacherName || '').trim();
    let nextEmail = (fac.nextYearTeacherEmail || '').trim();

    if (!nextName && !nextEmail) return;

    // 이미 다른 인수자가 수동 입력되어 있고 강제 갱신이 아닌 경우 보존
    if (!force && successorName && successorName !== nextName) return;

    // 이메일이 누락된 경우 전체 교직원 디렉터리에서 성명 대조로 이메일 자동 보강
    if (!nextEmail && nextName && allFaculty.length > 0) {
      const found = allFaculty.find((u) => (u.name || '').trim() === nextName);
      if (found?.email) {
        nextEmail = found.email.trim();
      }
    }

    if (nextName) setSuccessorName(nextName);
    if (nextEmail) setSuccessorEmail(nextEmail);
  };

  // 신규 작성 시 해당 학급/특별실의 기존 저장 템플릿 자동 조회
  const loadRoomTemplate = async (
    targetType: FixtureRoomType,
    targetGrade: string,
    targetClass: string,
    targetRoom: string
  ) => {
    const scopeKey = getFixtureScopeKey(targetType, targetGrade, targetClass, targetRoom);
    setIsLoadingTemplate(true);
    try {
      const tpl = await getFixtureTemplate(scopeKey);
      if (tpl && tpl.items && tpl.items.length > 0) {
        setItems(buildInitialFixtureItems(tpl));
        if (tpl.windowsPassword) setWindowsPassword(tpl.windowsPassword);
        toast({
          title: '기존 서식 불러오기 완료',
          description: `"${targetType === 'CLASSROOM' ? `${targetGrade}학년 ${targetClass}반` : targetRoom}"에 저장되어 있던 비품 목록(${tpl.items.length}개)을 불러왔습니다.`
        });
      } else {
        setItems(buildInitialFixtureItems());
        setWindowsPassword('없음');
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoadingTemplate(false);
    }
  };

  // 시스템 설정 [시설 및 학급] 자동 연동: 담당 시설 및 차년도 매핑/인수자 자동 바인딩
  useEffect(() => {
    let isMounted = true;
    getSchoolFacilities()
      .then((facilities) => {
        if (!isMounted || !facilities || facilities.length === 0) return;
        setAllFacilities(facilities);

        // 이메일 또는 이름으로 로그인 교원의 담당 시설 매칭 (강지욱 교사 -> 체육관(5학년) 100% 매칭)
        const myFac = facilities.find((f) => {
          const em = (f.assignedTeacherEmail || f.teacherEmail || '').trim().toLowerCase();
          const nm = (f.assignedTeacherName || f.teacherName || '').trim();
          return (userEmail && em === userEmail.toLowerCase()) || (userName && nm === userName);
        });

        if (myFac) {
          setMatchedFacility(myFac);
          if (!initialDoc) {
            if (myFac.category === 'classroom') {
              setType('CLASSROOM');
              const g = myFac.grade ? String(myFac.grade) : '';
              const c = myFac.classNum ? String(myFac.classNum) : '';
              setGrade(g);
              setClassNum(c);
              if (myFac.nextYearGrade) setNextYearGrade(String(myFac.nextYearGrade));
              if (myFac.nextYearClassNum) setNextYearClassNum(String(myFac.nextYearClassNum));
              if (g && c) {
                loadRoomTemplate('CLASSROOM', g, c, '');
              }
            } else {
              setType('SPECIAL_ROOM');
              const r = myFac.fullName || myFac.name || '';
              setRoomName(r);
              const nextR = myFac.nextYearName || r;
              setNextYearRoomName(nextR);
              if (r) {
                loadRoomTemplate('SPECIAL_ROOM', '', '', r);
              }
            }

            // 차년도 후임 인수자 자동 바인딩 (시스템 설정에 등록된 차년도 담당자)
            applySuccessorFromFacility(myFac, true);
          } else if (!successorName || initialDoc.status === 'DRAFT') {
            // 기존 문서가 임시저장 상태이거나 인수자 미지정 상태일 때 차년도 등록 담당자 자동 보강
            applySuccessorFromFacility(myFac, false);
          }
        } else if (!initialDoc) {
          // 시설 미등록 교원의 경우 fallback: 기존 homeroomInfo 또는 기본값 로드
          if (type === 'CLASSROOM' && grade && classNum) {
            loadRoomTemplate('CLASSROOM', grade, classNum, '');
          } else if (type === 'SPECIAL_ROOM' && roomName) {
            loadRoomTemplate('SPECIAL_ROOM', '', '', roomName);
          }
        }
      })
      .catch((err) => {
        console.error('[FixtureHandoverEditor] fetch facilities error:', err);
        if (!initialDoc) {
          if (type === 'CLASSROOM' && grade && classNum) {
            loadRoomTemplate('CLASSROOM', grade, classNum, '');
          } else if (type === 'SPECIAL_ROOM' && roomName) {
            loadRoomTemplate('SPECIAL_ROOM', '', '', roomName);
          }
        }
      });
    return () => {
      isMounted = false;
    };
  }, [userEmail, userName, initialDoc]);

  // 사용자가 특별실 검색 드롭다운 또는 칩에서 시설물을 선택했을 때 처리 (임의 입력 원천 차단)
  const handleSelectFacility = (fac: SchoolFacility) => {
    setMatchedFacility(fac);
    setIsFacilitySearchOpen(false);
    setFacilitySearchQuery('');

    if (fac.category === 'classroom') {
      setType('CLASSROOM');
      const g = fac.grade ? String(fac.grade) : '';
      const c = fac.classNum ? String(fac.classNum) : '';
      setGrade(g);
      setClassNum(c);
      if (fac.nextYearGrade) setNextYearGrade(String(fac.nextYearGrade));
      if (fac.nextYearClassNum) setNextYearClassNum(String(fac.nextYearClassNum));
      if (g && c) {
        loadRoomTemplate('CLASSROOM', g, c, '');
      }
    } else {
      setType('SPECIAL_ROOM');
      const r = fac.fullName || fac.name || '';
      setRoomName(r);
      const nextR = fac.nextYearName || r;
      setNextYearRoomName(nextR);
      if (r) {
        loadRoomTemplate('SPECIAL_ROOM', '', '', r);
      }
    }

    // 차년도 후임 인수자 자동 바인딩 (시설에 지정된 차년도 담당 교사)
    applySuccessorFromFacility(fac, true);

    toast({
      title: '시설물 연결 완료',
      description: `"${fac.fullName || fac.name}" 시설이 선택되었습니다.`
    });
  };

  // 등록된 정식 특별실 목록 및 검색 필터링
  const registeredSpecialFacilities = React.useMemo(() => {
    return allFacilities.filter((f) => f.category !== 'classroom');
  }, [allFacilities]);

  const filteredFacilities = React.useMemo(() => {
    const q = facilitySearchQuery.trim().toLowerCase();
    if (!q) return registeredSpecialFacilities;
    return allFacilities.filter((f) => {
      const name = (f.name || '').toLowerCase();
      const fullName = (f.fullName || '').toLowerCase();
      const loc = (f.location || '').toLowerCase();
      const teacher = (f.assignedTeacherName || f.teacherName || '').toLowerCase();
      return name.includes(q) || fullName.includes(q) || loc.includes(q) || teacher.includes(q);
    });
  }, [allFacilities, registeredSpecialFacilities, facilitySearchQuery]);

  const handleTypeChange = (newType: FixtureRoomType) => {
    setType(newType);
    if (newType === 'CLASSROOM') {
      const g = grade || homeroomInfo?.grade || '1';
      const c = classNum || homeroomInfo?.classNum || '1';
      setGrade(g);
      setClassNum(c);
      const classFac = allFacilities.find(
        (f) => f.category === 'classroom' && String(f.grade) === g && String(f.classNum) === c
      );
      if (classFac) {
        setMatchedFacility(classFac);
        applySuccessorFromFacility(classFac, false);
      }
      if (!initialDoc) loadRoomTemplate('CLASSROOM', g, c, '');
    } else {
      const r = roomName || matchedFacility?.name || '';
      setRoomName(r);
      const specFac = allFacilities.find(
        (f) => f.category !== 'classroom' && (f.fullName === r || f.name === r)
      );
      if (specFac) {
        setMatchedFacility(specFac);
        applySuccessorFromFacility(specFac, false);
      }
      if (!initialDoc && r) loadRoomTemplate('SPECIAL_ROOM', '', '', r);
    }
  };

  const handleSave = async (isSubmit: boolean = false) => {
    if (isLocked) {
      alert('2026학년도 학년 말 인수인계가 최종 마감(잠금)되어 저장 및 제출이 불가합니다.');
      return;
    }
    console.log('[handleSave clicked]', { isSubmit, type, grade, classNum, roomName, userEmail, userName, itemsLength: items.length });
    if (type === 'CLASSROOM' && (!grade || !classNum)) {
      toast({ variant: 'destructive', title: '입력 확인', description: '학년과 반을 입력해주세요.' });
      return;
    }
    if (type === 'SPECIAL_ROOM' && !roomName.trim()) {
      toast({ variant: 'destructive', title: '입력 확인', description: '특별실 명칭을 입력해주세요.' });
      return;
    }
    if (items.length === 0) {
      toast({ variant: 'destructive', title: '품목 확인', description: '최소 1개 이상의 비품 품목이 필요합니다.' });
      return;
    }

    setIsSaving(true);
    try {
      console.log('[handleSave] calling saveFixtureDocument...');
      const isSuccessorBound = Boolean(successorEmail?.trim());
      const nextStatus = isSubmit
        ? (isSuccessorBound ? 'SUBMITTED_WAITING_SUCCESSOR' : 'SUBMITTED_WAITING_ACADEMIC_HEAD')
        : (initialDoc?.status || 'DRAFT');

      const resolvedAuthorSig = currentUserProfile?.signature || initialDoc?.authorSignature || undefined;

      const docId = await saveFixtureDocument({
        id: initialDoc?.id,
        year,
        targetNextYear,
        type,
        grade: type === 'CLASSROOM' ? grade : undefined,
        classNum: type === 'CLASSROOM' ? classNum : undefined,
        roomName: type === 'SPECIAL_ROOM' ? roomName.trim() : undefined,
        nextYearGrade: type === 'CLASSROOM' ? (nextYearGrade || grade) : undefined,
        nextYearClassNum: type === 'CLASSROOM' ? (nextYearClassNum || classNum) : undefined,
        nextYearRoomName: type === 'SPECIAL_ROOM' ? (nextYearRoomName || roomName.trim()) : undefined,
        items,
        windowsPassword: windowsPassword.trim() || '없음',
        handoverDate,
        authorEmail: userEmail,
        authorName: userName,
        authorRole: '교사',
        authorSignature: resolvedAuthorSig,
        successorEmail: successorEmail.trim(),
        successorName: successorName.trim(),
        vicePrincipalName: (vicePrincipalName.trim() && vicePrincipalName.trim() !== '정영찬') ? vicePrincipalName.trim() : resolvedOrgVpName,
        status: nextStatus
      });
      console.log('[handleSave] saved docId:', docId);

      toast({
        title: isSubmit ? '제출 완료' : '저장 완료',
        description: isSubmit
          ? isSuccessorBound
            ? `비품 인계서가 후임 인수자(${successorName} 교사)에게 안전하게 전달되었습니다. 인수자 수신 확인 후 교무부장 확인 대기로 이동합니다.`
            : '비품 인계서가 교무부장 확인 대기열로 제출되었습니다. (인수자 미정)'
          : '비품 인계서가 저장되었으며, 수정한 품목 내역이 향후 기본 서식에 자동 반영되었습니다.'
      });

      onSaved(docId);
    } catch (err: any) {
      toast({
        variant: 'destructive',
        title: '저장 실패',
        description: err?.message || '저장 중 오류가 발생했습니다.'
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handlePrintPreview = () => {
    const previewAuthorSig = currentUserProfile?.signature || initialDoc?.authorSignature || undefined;
    const previewDoc: FixtureHandoverDocument = {
      id: initialDoc?.id || 'preview',
      year,
      targetNextYear,
      type,
      grade: type === 'CLASSROOM' ? grade : '',
      classNum: type === 'CLASSROOM' ? classNum : '',
      roomName: type === 'SPECIAL_ROOM' ? roomName.trim() : '',
      nextYearGrade: type === 'CLASSROOM' ? (nextYearGrade || grade) : '',
      nextYearClassNum: type === 'CLASSROOM' ? (nextYearClassNum || classNum) : '',
      nextYearRoomName: type === 'SPECIAL_ROOM' ? (nextYearRoomName || roomName.trim()) : '',
      items,
      windowsPassword: windowsPassword.trim() || '없음',
      handoverDate,
      authorEmail: userEmail,
      authorName: userName,
      authorRole: '교사',
      authorSignature: previewAuthorSig,
      successorName: successorName.trim(),
      successorEmail: successorEmail.trim(),
      successorRole: '교사',
      successorSignature: initialDoc?.successorSignature || '',
      vicePrincipalName: (vicePrincipalName.trim() && vicePrincipalName.trim() !== '정영찬') ? vicePrincipalName.trim() : resolvedOrgVpName,
      vicePrincipalRole: '교감',
      vicePrincipalSignature: initialDoc?.vicePrincipalSignature || '',
      status: initialDoc?.status || 'DRAFT',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    openFixturePrintWindow(previewDoc, vicePrincipalName, previewAuthorSig);
  };

  return (
    <div className="space-y-6">
      {/* 상단 네비게이션 및 액션 바 */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
        <div className="flex items-center gap-2">
          {onCancel && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onCancel}
              className="h-8 text-xs font-bold gap-1 text-slate-700 hover:bg-slate-100"
            >
              <ChevronLeft className="w-4 h-4" />
              <span>목록으로</span>
            </Button>
          )}
          <div>
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <span>{type === 'CLASSROOM' ? '학급 비품 인계, 인수서 작성' : '특별실 비품 인계서 작성'}</span>
              <Badge variant="outline" className="text-[11px] font-semibold bg-indigo-50 text-indigo-700 border-indigo-200">
                {type === 'CLASSROOM' ? '학급 담임 모드' : '교과/특별실 모드'}
              </Badge>
            </h2>
            <p className="text-xs text-slate-500">
              {type === 'CLASSROOM'
                ? '학년과 반을 입력하면 해당 학급의 비품 목록이 로드됩니다.'
                : '특별실 명칭을 입력하거나 추천 목록에서 선택하세요.'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handlePrintPreview}
            className="h-8 text-xs font-bold gap-1.5 text-slate-700 border-slate-300 hover:bg-slate-50"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>A4 인쇄 미리보기</span>
          </Button>

          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={isSaving || isLocked}
            onClick={() => handleSave(false)}
            className="h-8 text-xs font-bold gap-1.5 text-[#2471B2] border-[#2471B2]/30 bg-blue-50/50 hover:bg-blue-50"
          >
            {isSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
            <span>임시저장</span>
          </Button>

          <Button
            type="button"
            size="sm"
            disabled={isSaving || isLocked}
            onClick={() => handleSave(true)}
            className="h-8 text-xs font-bold gap-1.5 bg-[#2471B2] hover:bg-[#1f5e94] text-white shadow-2xs"
          >
            {isSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
            <span>{successorEmail ? '제출 (후임 인수자 전달)' : '제출 (교무부장 확인 대기)'}</span>
          </Button>
        </div>
      </div>

      {/* 시스템 설정 [시설 및 학급] 자동 연동 안내 배너 */}
      {matchedFacility && (
        <div className="bg-gradient-to-r from-emerald-50 via-teal-50/40 to-white border border-emerald-200/90 rounded-xl p-3.5 px-4.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 shadow-2xs">
          <div className="flex items-center gap-2.5 text-xs text-emerald-950">
            <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0 border border-emerald-200">
              <Building2 className="w-4.5 h-4.5" />
            </div>
            <div>
              <div className="flex items-center gap-1.5 font-bold">
                <span>시스템 설정 [시설 및 학급] 조직도 자동 연동</span>
                <Badge variant="outline" className="bg-emerald-100 text-emerald-800 border-emerald-300 text-[10px] font-bold py-0 h-4">
                  실시간 연동
                </Badge>
              </div>
              <p className="text-[11px] text-emerald-800 mt-0.5">
                현재 담당: <span className="font-bold underline decoration-emerald-400">{matchedFacility.fullName || matchedFacility.name}</span>
                {matchedFacility.nextYearTeacherName ? (
                  <>
                    <span className="mx-1.5 text-emerald-500">➔</span>
                    <span>차년도({targetNextYear}) 후임 인수자: </span>
                    <span className="font-bold text-emerald-900 bg-emerald-100 px-1 py-0.5 rounded">
                      {matchedFacility.nextYearTeacherName} 교사
                    </span>
                    <span>가 자동으로 연결되었습니다.</span>
                  </>
                ) : (
                  <span className="text-emerald-600 ml-1.5">(차년도 인수자 미지정 상태)</span>
                )}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {matchedFacility.nextYearTeacherName && successorName !== matchedFacility.nextYearTeacherName && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => applySuccessorFromFacility(matchedFacility, true)}
                className="h-7 text-xs font-bold text-emerald-800 bg-white border-emerald-300 hover:bg-emerald-100 shadow-2xs"
              >
                차년도 인수자({matchedFacility.nextYearTeacherName}) 적용
              </Button>
            )}
            <div className="text-[11px] text-emerald-700 font-semibold shrink-0">
              {type === 'CLASSROOM' ? '학급 비품 서식 적용' : '특별실 비품 서식 적용'}
            </div>
          </div>
        </div>
      )}

      {/* 작성 모드 및 기본 정보 설정 카드 */}
      <Card className="border-slate-200 shadow-2xs">
        <CardHeader className="py-3.5 px-5 bg-slate-50/70 border-b border-slate-200">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-800">1. 서식 종류 및 대상 교실 선택</span>
              <span className="text-[11px] text-slate-500">※ 학년 반 담임은 학급 비품, 교과 교사는 특별실 비품을 선택합니다.</span>
            </div>

            {/* 학급 vs 특별실 토글 버튼 */}
            <div className="flex items-center bg-slate-200/70 p-0.5 rounded-lg">
              <button
                type="button"
                onClick={() => handleTypeChange('CLASSROOM')}
                className={`px-3 py-1 text-xs font-bold rounded-md transition-all flex items-center gap-1.5 ${
                  type === 'CLASSROOM'
                    ? 'bg-white text-indigo-700 shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <School className="w-3.5 h-3.5" />
                <span>학급 비품</span>
              </button>
              <button
                type="button"
                onClick={() => handleTypeChange('SPECIAL_ROOM')}
                className={`px-3 py-1 text-xs font-bold rounded-md transition-all flex items-center gap-1.5 ${
                  type === 'SPECIAL_ROOM'
                    ? 'bg-white text-indigo-700 shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Building2 className="w-3.5 h-3.5" />
                <span>특별실 비품</span>
              </button>
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-5 space-y-4">
          {type === 'CLASSROOM' ? (
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 items-end bg-indigo-50/40 p-4 rounded-xl border border-indigo-100">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">인계 학년·반 ({year}년)</label>
                <div className="flex items-center gap-1">
                  <Input
                    value={grade}
                    onChange={(e) => {
                      const newG = e.target.value.replace(/[^0-9]/g, '');
                      setGrade(newG);
                      if (newG && classNum) {
                        const classFac = allFacilities.find(
                          (f) => f.category === 'classroom' && String(f.grade) === newG && String(f.classNum) === classNum
                        );
                        if (classFac) {
                          setMatchedFacility(classFac);
                          applySuccessorFromFacility(classFac, false);
                        }
                      }
                    }}
                    placeholder="예: 3"
                    className="h-9 text-xs font-bold w-16"
                  />
                  <span className="text-xs font-bold text-slate-600 shrink-0">학년</span>
                  <Input
                    value={classNum}
                    onChange={(e) => {
                      const newC = e.target.value.replace(/[^0-9]/g, '');
                      setClassNum(newC);
                      if (grade && newC) {
                        const classFac = allFacilities.find(
                          (f) => f.category === 'classroom' && String(f.grade) === grade && String(f.classNum) === newC
                        );
                        if (classFac) {
                          setMatchedFacility(classFac);
                          applySuccessorFromFacility(classFac, false);
                        }
                      }
                    }}
                    placeholder="예: 1"
                    className="h-9 text-xs font-bold w-16 ml-1"
                  />
                  <span className="text-xs font-bold text-slate-600 shrink-0">반</span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1">
                  <span>차년도 학년·반 ({targetNextYear}년)</span>
                  <Badge variant="outline" className="text-[10px] py-0 h-4 bg-indigo-100 text-indigo-800 border-indigo-200">
                    차년도
                  </Badge>
                </label>
                <div className="flex items-center gap-1">
                  <Input
                    value={nextYearGrade || grade}
                    onChange={(e) => setNextYearGrade(e.target.value.replace(/[^0-9]/g, ''))}
                    placeholder={grade || '예: 3'}
                    className="h-9 text-xs font-bold w-16 bg-white"
                  />
                  <span className="text-xs font-bold text-slate-600 shrink-0">학년</span>
                  <Input
                    value={nextYearClassNum || classNum}
                    onChange={(e) => setNextYearClassNum(e.target.value.replace(/[^0-9]/g, ''))}
                    placeholder={classNum || '예: 1'}
                    className="h-9 text-xs font-bold w-16 ml-1 bg-white"
                  />
                  <span className="text-xs font-bold text-slate-600 shrink-0">반</span>
                </div>
              </div>

              <div className="sm:col-span-2 flex flex-col gap-1.5">
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={isLoadingTemplate || !grade || !classNum}
                    onClick={() => loadRoomTemplate('CLASSROOM', grade, classNum, '')}
                    className="h-9 text-xs font-bold gap-1 text-indigo-700 bg-white border-indigo-200 hover:bg-indigo-50"
                  >
                    {isLoadingTemplate ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <RotateCcw className="w-3.5 h-3.5" />
                    )}
                    <span>해당 학급 기존 서식 불러오기</span>
                  </Button>
                </div>
                <span className="text-[11px] text-slate-500">
                  {matchedFacility
                    ? `[시설 및 학급] ${matchedFacility.fullName || matchedFacility.name} 배정 연결됨`
                    : homeroomInfo && `${homeroomInfo.grade}학년 ${homeroomInfo.classNum}반 담임 자동 연결됨`}
                </span>
              </div>
            </div>
          ) : (
            <div className="space-y-4 bg-amber-50/40 p-4 sm:p-5 rounded-xl border border-amber-200/80">
              {/* 시설물 검색 선택 바 (임의 타이핑에 따른 시설명 오염 원천 방지) */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-800">
                  특별실(시설물) 검색 및 선택 <span className="text-rose-500">*</span>
                  <span className="text-[11px] font-normal text-slate-500 ml-2">
                    (시스템 설정 [시설 및 학급]에 등록된 정식 시설물 중에서 검색하여 선택합니다)
                  </span>
                </label>

                <div className="relative">
                  <div className="flex items-center gap-2">
                    <div className="relative flex-1">
                      <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                      <Input
                        value={facilitySearchQuery}
                        onChange={(e) => {
                          setFacilitySearchQuery(e.target.value);
                          setIsFacilitySearchOpen(true);
                        }}
                        onFocus={() => setIsFacilitySearchOpen(true)}
                        placeholder="시설물명 검색 (예: 체육관, 과학실, 음악실, 컴퓨터실, 보건실, 도서관 등)"
                        className="h-9 text-xs pl-9 font-semibold bg-white border-amber-300 focus:border-amber-500"
                      />
                    </div>
                    {facilitySearchQuery && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setFacilitySearchQuery('');
                          setIsFacilitySearchOpen(false);
                        }}
                        className="h-9 px-2 text-xs text-slate-500"
                      >
                        초기화
                      </Button>
                    )}
                  </div>

                  {/* 검색 결과 드롭다운 */}
                  {isFacilitySearchOpen && (
                    <div className="absolute top-full left-0 right-0 mt-1 max-h-60 overflow-y-auto bg-white border border-slate-300 rounded-xl shadow-lg z-50 p-1 divide-y divide-slate-100">
                      {filteredFacilities.length > 0 ? (
                        filteredFacilities.map((fac) => (
                          <button
                            key={fac.id}
                            type="button"
                            onClick={() => handleSelectFacility(fac)}
                            className="w-full text-left p-2.5 hover:bg-amber-50/80 rounded-lg transition-colors flex items-center justify-between gap-2"
                          >
                            <div className="flex items-center gap-2">
                              <Badge variant="outline" className={`text-[10px] ${fac.category === 'special' ? 'bg-amber-50 text-amber-800 border-amber-200' : 'bg-slate-50 text-slate-700 border-slate-200'}`}>
                                {fac.category === 'special' ? '특별실' : fac.category === 'classroom' ? '일반학급' : '공용/행정'}
                              </Badge>
                              <span className="text-xs font-bold text-slate-900">{fac.fullName || fac.name}</span>
                              <span className="text-[11px] text-slate-500">({fac.location})</span>
                            </div>
                            <div className="text-[11px] text-slate-500 shrink-0">
                              담당: <span className="font-semibold text-slate-700">{fac.assignedTeacherName || fac.teacherName || '미지정'}</span>
                            </div>
                          </button>
                        ))
                      ) : (
                        <div className="p-3 text-center text-xs text-slate-400">
                          검색 결과가 없습니다.
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* 현재 선택된 시설물 확정 정보 & 차년도 시설명 카드 */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-end bg-white/90 p-3.5 rounded-lg border border-amber-200">
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 mb-1">
                    선택된 특별실 명칭 ({year}년)
                  </label>
                  <div className="h-9 px-3 flex items-center rounded-md border border-slate-300 bg-slate-50 text-xs font-bold text-slate-900">
                    <Building2 className="w-3.5 h-3.5 text-amber-600 mr-1.5 shrink-0" />
                    <span className="truncate">{roomName || '특별실을 선택하세요'}</span>
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-600 mb-1 flex items-center gap-1">
                    <span>차년도 시설명 ({targetNextYear}년)</span>
                    <Badge variant="outline" className="text-[9px] py-0 h-3.5 bg-amber-100 text-amber-900 border-amber-300">
                      차년도
                    </Badge>
                  </label>
                  <Input
                    value={nextYearRoomName || roomName}
                    onChange={(e) => setNextYearRoomName(e.target.value)}
                    placeholder={roomName || '예: 제1과학실'}
                    className="h-9 text-xs font-bold bg-white"
                  />
                </div>

                <div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={isLoadingTemplate || !roomName.trim()}
                    onClick={() => loadRoomTemplate('SPECIAL_ROOM', '', '', roomName.trim())}
                    className="h-9 w-full text-xs font-bold gap-1 text-amber-800 bg-white border-amber-300 hover:bg-amber-50"
                  >
                    {isLoadingTemplate ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <RotateCcw className="w-3.5 h-3.5" />
                    )}
                    <span>해당 실 기존 서식 불러오기</span>
                  </Button>
                </div>
              </div>

              {/* 등록된 정식 특별실 빠른 선택 칩 */}
              <div className="space-y-1.5">
                <span className="text-[11px] font-bold text-slate-600 block">
                  등록된 정식 특별실 바로 선택:
                </span>
                <div className="flex items-center gap-1.5 flex-wrap">
                  {registeredSpecialFacilities.slice(0, 15).map((fac) => {
                    const label = fac.fullName || fac.name;
                    const isSelected = roomName === label;
                    return (
                      <button
                        key={fac.id}
                        type="button"
                        onClick={() => handleSelectFacility(fac)}
                        className={`text-[11px] px-2.5 py-1 rounded-full font-medium transition-all border ${
                          isSelected
                            ? 'bg-amber-600 text-white border-amber-600 font-bold shadow-2xs'
                            : 'bg-white text-slate-700 border-slate-200 hover:bg-amber-50 hover:border-amber-300'
                        }`}
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* 작성 연도, 일자, 인수자, 입회자 설정 */}
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 pt-2 border-t border-slate-100">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">인계 학년도</label>
              <Input
                type="number"
                value={year}
                onChange={(e) => setYear(parseInt(e.target.value, 10) || CURRENT_SCHOOL_YEAR)}
                className="h-8 text-xs font-semibold"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">인수 학년도</label>
              <Input
                type="number"
                value={targetNextYear}
                onChange={(e) => setTargetNextYear(parseInt(e.target.value, 10) || CURRENT_SCHOOL_YEAR + 1)}
                className="h-8 text-xs font-semibold"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">인계 일자</label>
              <Input
                type="date"
                value={handoverDate}
                onChange={(e) => setHandoverDate(e.target.value)}
                className="h-8 text-xs font-semibold"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center justify-between">
                <span>후임 인수자 (교원 검색)</span>
                {successorEmail && (
                  <button
                    type="button"
                    onClick={() => {
                      setSuccessorEmail('');
                      setSuccessorName('');
                    }}
                    className="text-[10px] text-rose-600 hover:underline flex items-center gap-0.5"
                  >
                    <UserX className="w-3 h-3" />
                    <span>해제</span>
                  </button>
                )}
              </label>
              <Input
                list="faculty-fixture-successor-datalist"
                value={
                  successorEmail
                    ? `${successorName || successorEmail} (${successorEmail})`
                    : successorName
                }
                onChange={(e) => {
                  const val = e.target.value;
                  const match = val.match(/\(([^)]+)\)/);
                  if (match) {
                    const email = match[1].trim().toLowerCase();
                    const matchedUser = allFaculty.find(
                      (f) => f.email?.toLowerCase() === email
                    );
                    setSuccessorEmail(email);
                    setSuccessorName(matchedUser?.name || val.replace(/\s*\([^)]+\)/, '').trim());
                  } else {
                    const matchedUser = allFaculty.find(
                      (f) =>
                        f.name?.trim().toLowerCase() === val.trim().toLowerCase() ||
                        f.email?.trim().toLowerCase() === val.trim().toLowerCase()
                    );
                    if (matchedUser) {
                      setSuccessorEmail(matchedUser.email);
                      setSuccessorName(matchedUser.name);
                    } else {
                      setSuccessorName(val);
                      setSuccessorEmail('');
                    }
                  }
                }}
                placeholder="인수자 교원 성명 검색 (미정 시 공란)"
                className="h-8 text-xs font-semibold bg-white border-slate-300"
              />
              {successorEmail ? (
                <div className="mt-1 flex items-center gap-1 text-[11px] text-[#2471B2] font-bold">
                  <UserCheck className="w-3.5 h-3.5" />
                  <span>인수 교원 연결됨: {successorName}</span>
                </div>
              ) : (
                <span className="text-[10px] text-slate-400 mt-0.5 block">
                  ※ 교원 성명을 입력하면 자동완성 목록이 표시됩니다.
                </span>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 2. 비품 품목 편집 표 (테이블 컴포넌트) */}
      <Card className="border-slate-200 shadow-2xs">
        <CardHeader className="py-3.5 px-5 bg-slate-50/70 border-b border-slate-200">
          <CardTitle className="text-xs font-bold text-slate-800">
            2. 비품 목록 및 윈도우 비밀번호 관리
          </CardTitle>
        </CardHeader>
        <CardContent className="p-5">
          <FixtureItemTable
            items={items}
            onChange={setItems}
            windowsPassword={windowsPassword}
            onWindowsPasswordChange={setWindowsPassword}
          />
        </CardContent>
      </Card>

      {/* 하단 결재 서명 안내 및 액션 */}
      <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-600">
        <div className="flex items-center gap-2">
          <span className="font-bold text-slate-800">서명란 바인딩:</span>
          <span>인계자: {userName} (교사)</span>
          <span className="text-slate-300">|</span>
          <span>인수자: {successorName || '차년도 인수자'} (교사)</span>
          <span className="text-slate-300">|</span>
          <span>입회자: {vicePrincipalName} (교감)</span>
        </div>

        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handlePrintPreview}
            className="h-8 text-xs font-bold gap-1 text-slate-700 border-slate-300 hover:bg-slate-50"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>A4 인쇄 미리보기</span>
          </Button>
          <Button
            type="button"
            size="sm"
            disabled={isSaving || isLocked}
            onClick={() => handleSave(true)}
            className="h-8 text-xs font-bold gap-1 bg-[#2471B2] hover:bg-[#1f5e94] text-white"
          >
            <Send className="w-3.5 h-3.5" />
            <span>{successorEmail ? '제출 (후임 인수자 전달)' : '제출 (교무부장 확인 대기)'}</span>
          </Button>
        </div>
      </div>

      {/* 초경량 네이티브 교원 자동완성 datalist (순수 교직원만 표출) */}
      <datalist id="faculty-fixture-successor-datalist">
        {allFaculty.map((f) => (
          <option
            key={f.email}
            value={`${f.name} (${f.email})`}
            label={`${f.name} [${f.role || '교사'}${f.dept ? ` / ${f.dept}` : ''}]`}
          />
        ))}
      </datalist>
    </div>
  );
}
