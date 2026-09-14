'use client';

import React, { useState, useMemo, useEffect } from 'react';
import {
  Calendar,
  Clock,
  Lock,
  CheckCircle2,
  AlertCircle,
  Trash2,
  Settings,
  User,
  RefreshCw,
  ChevronRight,
  ShieldAlert,
  Save,
  Phone,
  Check,
  FileSpreadsheet,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import type { MasterStudent } from '@/lib/types/masterStudent';
import type { BookingSlot, ConsultationConfig } from '@/lib/types/homeroomClass';
import {
  DEFAULT_CONSULTATION_CONFIG,
  onConsultationConfigUpdate,
  saveConsultationConfig,
  onConsultationSlotsUpdate,
  toggleConsultationSlotBlock,
  bookConsultationSlotTransaction,
  cancelConsultationSlot,
} from '@/lib/services/homeroomClassService';

interface ParentConsultationTabProps {
  classKey: string;
  classLabel: string;
  students: MasterStudent[];
  userEmail?: string;
  initialRole?: 'TEACHER' | 'PARENT';
}

export const ParentConsultationTab: React.FC<ParentConsultationTabProps> = ({
  classKey,
  classLabel,
  students,
  userEmail,
  initialRole = 'TEACHER',
}) => {
  const { toast } = useToast();

  // 1. 관리자(담임) 설정 상태
  const [config, setConfig] = useState<ConsultationConfig>(DEFAULT_CONSULTATION_CONFIG);
  const [isConfigSaving, setIsConfigSaving] = useState(false);

  // 모드 전환: 'TEACHER' (호스트 관리) | 'PARENT' (학부모 신청)
  const [activeRole, setActiveRole] = useState<'TEACHER' | 'PARENT'>(initialRole);

  // 학부모/대리 입력 폼 상태
  const [selectedStudentId, setSelectedStudentId] = useState<string>('');
  const [applicantName, setApplicantName] = useState('');
  const [applicantPhone, setApplicantPhone] = useState('');

  // 2. 예약 슬롯 상태 (Firestore 실시간 연동)
  const [slotsData, setSlotsData] = useState<Record<string, BookingSlot>>({});
  const [isSubmittingBooking, setIsSubmittingBooking] = useState(false);

  // 3. 내 예약 상태 (학부모 본인 확인용)
  const [myBookingId, setMyBookingId] = useState<string | null>(null);
  const [alertMessage, setAlertMessage] = useState<string | null>(null);

  // ─── Firestore 실시간 구독 ───
  useEffect(() => {
    if (!classKey) return;

    // 1) 상담 설정 구독
    const unsubConfig = onConsultationConfigUpdate(classKey, (newConfig) => {
      setConfig(newConfig);
    });

    // 2) 예약 슬롯 전체 구독
    const unsubSlots = onConsultationSlotsUpdate(classKey, (slots) => {
      setSlotsData(slots);
    });

    return () => {
      unsubConfig();
      unsubSlots();
    };
  }, [classKey]);

  // 학부모 모드 시 학생 선택 시 이름/연락처 자동 채우기
  const handleSelectStudentForParent = (stId: string) => {
    setSelectedStudentId(stId);
    const target = students.find((s) => (s.studentId || s.id || s.studentEmail) === stId);
    if (target) {
      setApplicantName(target.name);
      setApplicantPhone(target.contact || '');
    }
  };

  // 학생별 기존 예약 확인
  useEffect(() => {
    if (applicantName.trim()) {
      const found = Object.values(slotsData).find(
        (slot) => slot.status === 'BOOKED' && slot.bookedBy?.studentName === applicantName.trim()
      );
      setMyBookingId(found ? found.id : null);
    } else {
      setMyBookingId(null);
    }
  }, [applicantName, slotsData]);

  // 시간 파싱 헬퍼 함수
  const parseTimeToMinutes = (timeStr: string) => {
    if (!timeStr || !timeStr.includes(':')) return 0;
    const [h, m] = timeStr.split(':').map(Number);
    return h * 60 + m;
  };

  const formatMinutesToTime = (minutes: number) => {
    const h = Math.floor(minutes / 60).toString().padStart(2, '0');
    const m = (minutes % 60).toString().padStart(2, '0');
    return `${h}:${m}`;
  };

  // 날짜 범위 배열 계산 (주말 제외)
  const dateColumns = useMemo(() => {
    if (!config.startDate || !config.endDate) return [];
    const dates: { dateStr: string; label: string; isExcluded: boolean }[] = [];
    const start = new Date(config.startDate);
    const end = new Date(config.endDate);
    const dayNames = ['일', '월', '화', '수', '목', '금', '토'];

    let curr = new Date(start);
    while (curr <= end) {
      const dayOfWeek = curr.getDay();
      if (dayOfWeek !== 0 && dayOfWeek !== 6) {
        // 월~금만 포함
        const y = curr.getFullYear();
        const m = String(curr.getMonth() + 1).padStart(2, '0');
        const d = String(curr.getDate()).padStart(2, '0');
        const dateStr = `${y}-${m}-${d}`;
        dates.push({
          dateStr,
          label: `${curr.getMonth() + 1}.${curr.getDate()}(${dayNames[dayOfWeek]})`,
          isExcluded: config.excludedDates?.includes(dateStr) || false,
        });
      }
      curr.setDate(curr.getDate() + 1);
    }
    return dates;
  }, [config.startDate, config.endDate, config.excludedDates]);

  // 시간 슬롯 행(Row) 계산
  const timeSlotRows = useMemo(() => {
    const rows: { timeRange: string; startMin: number }[] = [];
    const startMin = parseTimeToMinutes(config.dailyStartTime || '13:40');
    const endMin = parseTimeToMinutes(config.dailyEndTime || '16:20');
    const duration = config.slotDuration || 20;

    let current = startMin;
    while (current + duration <= endMin) {
      const next = current + duration;
      rows.push({
        timeRange: `${formatMinutesToTime(current)} ~ ${formatMinutesToTime(next)}`,
        startMin: current,
      });
      current = next;
    }
    return rows;
  }, [config.dailyStartTime, config.dailyEndTime, config.slotDuration]);

  // 슬롯 키 생성: dateStr__timeRange (Firestore 안전 ID)
  const getSlotKey = (dateStr: string, timeRange: string) =>
    `${dateStr}__${timeRange.replace(/\s+/g, '')}`;

  // 슬롯 상태 조회
  const getSlot = (dateStr: string, timeRange: string): BookingSlot => {
    const key = getSlotKey(dateStr, timeRange);
    if (config.excludedDates?.includes(dateStr)) {
      return { id: key, date: dateStr, timeRange, status: 'BLOCKED' };
    }
    return slotsData[key] || { id: key, date: dateStr, timeRange, status: 'AVAILABLE' };
  };

  // --- [교사 기능] 개별 슬롯 블록 토글 ---
  const handleTeacherToggleSlot = async (dateStr: string, timeRange: string) => {
    const key = getSlotKey(dateStr, timeRange);
    const current = getSlot(dateStr, timeRange);

    if (current.status === 'BOOKED') {
      if (
        !confirm(
          `[${current.bookedBy?.studentName}] 학생의 예약이 있습니다. 예약을 취소하고 해당 시간을 잠그시겠습니까?`
        )
      )
        return;
    }

    try {
      await toggleConsultationSlotBlock(
        classKey,
        key,
        dateStr,
        timeRange,
        current.status,
        userEmail
      );
      toast({
        title: current.status === 'BLOCKED' ? '신청 가능 처리' : '상담 불가(차단) 처리',
        description: `${dateStr} (${timeRange}) 상태가 변경되었습니다.`,
      });
    } catch (err) {
      console.error(err);
      toast({ title: '처리 실패', description: '슬롯 상태 변경 중 오류가 발생했습니다.', variant: 'destructive' });
    }
  };

  // --- [교사 기능] 특정 일자 전체 제외 토글 ---
  const handleToggleExcludeDate = async (dateStr: string) => {
    const exists = config.excludedDates?.includes(dateStr);
    const nextExcluded = exists
      ? config.excludedDates.filter((d) => d !== dateStr)
      : [...(config.excludedDates || []), dateStr];

    const nextConfig = {
      ...config,
      excludedDates: nextExcluded,
    };
    setConfig(nextConfig);

    try {
      await saveConsultationConfig(classKey, nextConfig, userEmail);
      toast({
        title: exists ? '요일 차단 해제' : '요일 전체 차단 완료',
        description: `${dateStr} 상담 일정이 ${exists ? '재개' : '차단'}되었습니다.`,
      });
    } catch (err) {
      console.error(err);
      toast({ title: '설정 저장 실패', variant: 'destructive' });
    }
  };

  // --- [교사 기능] 학부모 상담 접수 시작 / 종료 즉시 토글 및 저장 ---
  const handleToggleOpenStatus = async (nextStatus: boolean) => {
    const nextConfig = {
      ...config,
      isOpen: nextStatus,
    };
    setConfig(nextConfig);
    setIsConfigSaving(true);
    try {
      await saveConsultationConfig(classKey, nextConfig, userEmail);
      toast({
        title: nextStatus ? '상담 신청 접수 시작됨 (ON)' : '상담 신청 접수 종료됨 (OFF)',
        description: nextStatus
          ? '학부모 포털에 상담 주간 알림 및 신청 모달이 활성화됩니다.'
          : '학부모 포털의 상담 주간 알림이 숨겨지고 신규 신청이 마감됩니다.',
      });
    } catch (err) {
      console.error(err);
      toast({ title: '상태 변경 실패', description: '상담 접수 상태 변경 중 오류가 발생했습니다.', variant: 'destructive' });
    } finally {
      setIsConfigSaving(false);
    }
  };

  // --- [교사 기능] 설정 저장 ---
  const handleSaveConfig = async () => {
    setIsConfigSaving(true);
    try {
      await saveConsultationConfig(classKey, config, userEmail);
      toast({ title: '설정 저장 완료', description: '상담 주간 기간 및 시간 기준이 저장되었습니다.' });
    } catch (err) {
      console.error(err);
      toast({ title: '설정 저장 실패', description: '설정 저장 중 오류가 발생했습니다.', variant: 'destructive' });
    } finally {
      setIsConfigSaving(false);
    }
  };

  // --- [학부모/교사 대리 기능] 실시간 선착순 신청 (runTransaction) ---
  const handleParentBook = async (dateStr: string, timeRange: string) => {
    if (activeRole === 'PARENT' && !config.isOpen) {
      setAlertMessage('현재 학부모 상담 신청 접수가 마감(종료)되었습니다. 담임 선생님께서 접수를 시작(ON)하신 후 신청해 주세요.');
      return;
    }

    if (!applicantName.trim()) {
      setAlertMessage('학생 이름을 먼저 입력하거나 목록에서 학생을 선택해 주세요.');
      return;
    }

    if (myBookingId) {
      setAlertMessage('이미 신청된 상담 일정이 있습니다. 변경하려면 기존 예약을 먼저 취소해 주세요.');
      return;
    }

    const key = getSlotKey(dateStr, timeRange);
    const current = getSlot(dateStr, timeRange);

    if (current.status === 'BOOKED' || current.status === 'BLOCKED') {
      setAlertMessage('이미 예약되었거나 마감된 시간대입니다. 다른 시간을 선택해 주세요.');
      return;
    }

    setIsSubmittingBooking(true);
    try {
      await bookConsultationSlotTransaction(classKey, key, dateStr, timeRange, {
        studentName: applicantName.trim(),
        studentId: selectedStudentId,
        parentPhone: applicantPhone.trim(),
        bookedByEmail: userEmail,
      });

      setAlertMessage(null);
      toast({
        title: '상담 신청 완료',
        description: `${dateStr} (${timeRange}) ${applicantName.trim()} 학생의 상담이 확정되었습니다.`,
      });
    } catch (err: any) {
      console.error(err);
      if (err.message === 'ALREADY_BOOKED') {
        setAlertMessage('방금 다른 학부모님께서 먼저 신청을 완료한 시간대입니다. 다른 시간을 선택해 주세요.');
      } else if (err.message === 'SLOT_BLOCKED') {
        setAlertMessage('현재 해당 시간대는 상담 불가로 마감되었습니다.');
      } else {
        setAlertMessage('신청 중 오류가 발생했습니다. 다시 시도해 주세요.');
      }
    } finally {
      setIsSubmittingBooking(false);
    }
  };

  // --- [학부모 기능] 예약 취소 ---
  const handleParentCancel = async () => {
    if (!myBookingId) return;
    if (!confirm('신청된 상담 일정을 취소하시겠습니까? 취소 후 다른 시간대로 다시 신청할 수 있습니다.')) return;

    try {
      await cancelConsultationSlot(classKey, myBookingId);
      setMyBookingId(null);
      toast({ title: '예약 취소 완료', description: '상담 예약이 취소되었습니다. 새로운 시간대를 선택하실 수 있습니다.' });
    } catch (err) {
      console.error(err);
      toast({ title: '취소 실패', description: '예약 취소 중 오류가 발생했습니다.', variant: 'destructive' });
    }
  };

  const myCurrentSlot = myBookingId ? slotsData[myBookingId] : null;

  // 전체 예약 통계
  const bookedSlots = useMemo(() => {
    return Object.values(slotsData).filter((s) => s.status === 'BOOKED');
  }, [slotsData]);

  return (
    <div className="w-full space-y-6">
      {/* ─── 상단 헤더 & 모드 전환 바 ─── */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center bg-white p-5 rounded-2xl border border-slate-200 shadow-xs gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="bg-indigo-50 text-indigo-700 border-indigo-200 font-bold text-xs">
              {classLabel}
            </Badge>
            <h1 className="text-xl font-black text-slate-800 tracking-tight">학부모 상담 주간 신청 및 시간표</h1>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            원하는 시간대를 선택하여 실시간 선착순으로 접수합니다. (이중 예약 방지 동시성 제어 적용)
          </p>
        </div>

        {/* 뷰 모드 토글 (교사 관리 모드 / 학부모 신청 뷰) */}
        <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200 text-xs font-bold shrink-0">
          <button
            type="button"
            onClick={() => setActiveRole('TEACHER')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
              activeRole === 'TEACHER'
                ? 'bg-white text-indigo-900 shadow-xs font-black'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Settings className="w-3.5 h-3.5 text-indigo-600" />
            <span>교사 관리 모드</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveRole('PARENT')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
              activeRole === 'PARENT'
                ? 'bg-white text-emerald-900 shadow-xs font-black'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <User className="w-3.5 h-3.5 text-emerald-600" />
            <span>학부모 신청 모드</span>
          </button>
        </div>
      </div>

      {/* 에러 및 경고 배너 */}
      {alertMessage && (
        <div className="flex items-center justify-between p-4 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-xs font-semibold shadow-xs">
          <div className="flex items-center gap-2">
            <ShieldAlert className="w-5 h-5 text-rose-600 shrink-0" />
            <span>{alertMessage}</span>
          </div>
          <button
            type="button"
            onClick={() => setAlertMessage(null)}
            className="text-xs font-bold underline ml-4 hover:text-rose-950 cursor-pointer"
          >
            닫기
          </button>
        </div>
      )}

      {/* ─── [교사 관리 모드 패널] ─── */}
      {activeRole === 'TEACHER' && (
        <Card className="rounded-2xl border-slate-200 shadow-xs">
          <CardHeader className="pb-3 border-b border-slate-100">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Settings className="w-4 h-4 text-indigo-600" />
                <CardTitle className="text-sm font-bold text-slate-800">
                  상담 주간 일정 및 슬롯 기준 설정
                </CardTitle>
              </div>
              <div className="flex items-center gap-2 sm:gap-3">
                {/* 학부모 상담 시작 / 종료 원터치 제어 버튼 */}
                <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 px-3 py-1 rounded-xl shadow-2xs">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-bold text-slate-600">상담 접수:</span>
                    <Badge
                      variant="outline"
                      className={`text-[11px] font-black px-2 py-0.5 ${
                        config.isOpen
                          ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                          : 'bg-slate-100 text-slate-500 border-slate-300'
                      }`}
                    >
                      {config.isOpen ? '접수 진행 중 (ON)' : '접수 마감/종료 (OFF)'}
                    </Badge>
                  </div>
                  {config.isOpen ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={isConfigSaving}
                      onClick={() => handleToggleOpenStatus(false)}
                      className="h-7 px-2.5 text-xs font-bold border-rose-200 bg-rose-50 hover:bg-rose-100 text-rose-700 cursor-pointer shadow-2xs"
                      title="학부모 신청 접수를 종료(OFF)합니다"
                    >
                      상담 접수 종료
                    </Button>
                  ) : (
                    <Button
                      type="button"
                      size="sm"
                      disabled={isConfigSaving}
                      onClick={() => handleToggleOpenStatus(true)}
                      className="h-7 px-2.5 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer shadow-2xs"
                      title="학부모 신청 접수를 시작(ON)합니다"
                    >
                      상담 접수 시작
                    </Button>
                  )}
                </div>

                <Button
                  size="sm"
                  disabled={isConfigSaving}
                  onClick={handleSaveConfig}
                  className="h-8 text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white gap-1.5 cursor-pointer shadow-xs"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>기준 설정 저장</span>
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-4 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
              {/* 상담 기간 */}
              <div>
                <Label className="text-slate-600 font-bold mb-1.5 block">상담 기간 (시작 ~ 종료)</Label>
                <div className="flex items-center gap-1.5">
                  <Input
                    type="date"
                    value={config.startDate}
                    onChange={(e) => setConfig((prev) => ({ ...prev, startDate: e.target.value }))}
                    className="h-9 text-xs"
                  />
                  <span className="text-slate-400">~</span>
                  <Input
                    type="date"
                    value={config.endDate}
                    onChange={(e) => setConfig((prev) => ({ ...prev, endDate: e.target.value }))}
                    className="h-9 text-xs"
                  />
                </div>
              </div>

              {/* 일일 운영 시간 */}
              <div>
                <Label className="text-slate-600 font-bold mb-1.5 block">상담 시간대 (시작 ~ 종료)</Label>
                <div className="flex items-center gap-1.5">
                  <Input
                    type="time"
                    value={config.dailyStartTime}
                    onChange={(e) => setConfig((prev) => ({ ...prev, dailyStartTime: e.target.value }))}
                    className="h-9 text-xs"
                  />
                  <span className="text-slate-400">~</span>
                  <Input
                    type="time"
                    value={config.dailyEndTime}
                    onChange={(e) => setConfig((prev) => ({ ...prev, dailyEndTime: e.target.value }))}
                    className="h-9 text-xs"
                  />
                </div>
              </div>

              {/* 상담 단위 시간 */}
              <div>
                <Label className="text-slate-600 font-bold mb-1.5 block">1인당 상담 시간</Label>
                <select
                  value={config.slotDuration}
                  onChange={(e) => setConfig((prev) => ({ ...prev, slotDuration: Number(e.target.value) }))}
                  className="w-full h-9 px-3 border border-slate-200 rounded-lg text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-indigo-500 bg-white"
                >
                  <option value={15}>15분 단위</option>
                  <option value={20}>20분 단위 (기본 양식)</option>
                  <option value={30}>30분 단위</option>
                  <option value={40}>40분 단위</option>
                </select>
              </div>

              {/* 현재 신청 현황 통계 요약 */}
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 flex flex-col justify-center">
                <div className="text-[11px] text-slate-500 font-medium">현재 예약 현황</div>
                <div className="text-lg font-black text-indigo-900 mt-0.5">
                  총 {bookedSlots.length}명 신청 완료
                </div>
              </div>
            </div>

            <div className="p-3 bg-amber-50/70 border border-amber-200 rounded-xl text-amber-900 text-xs leading-relaxed flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
              <span>
                <strong>담임 팁:</strong> 아래 표에서 셀을 클릭하면 즉시 <strong>'신청 불가(잠금)'</strong>로 전환됩니다. 이미 예약된 학생이 있는 경우 경고 후 취소 및 잠금 처리할 수 있습니다.
              </span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ─── [학부모 모드 안내 및 내 신청 배너] ─── */}
      {activeRole === 'PARENT' && (
        <div className="space-y-4">
          {/* 신청자 인적사항 입력/선택 바 */}
          <Card className="rounded-2xl border-slate-200 shadow-xs">
            <CardContent className="p-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
              <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
                <span className="text-xs font-bold text-slate-700 shrink-0">신청자 선택/입력:</span>

                {/* 학급 학생 드롭다운 선택 */}
                {students.length > 0 && (
                  <select
                    value={selectedStudentId}
                    onChange={(e) => handleSelectStudentForParent(e.target.value)}
                    disabled={!!myBookingId}
                    className="text-xs h-9 px-3 border border-slate-300 rounded-lg focus:ring-1 focus:ring-indigo-500 bg-white disabled:bg-slate-100 font-medium"
                  >
                    <option value="">우리 반 학생 선택 (빠른 입력)</option>
                    {students.map((st) => {
                      const valKey = st.studentId || st.id || st.studentEmail;
                      return (
                        <option key={valKey} value={valKey}>
                          {st.studentNum ? `${st.studentNum}번 ` : ''}
                          {st.name}
                        </option>
                      );
                    })}
                  </select>
                )}

                <Input
                  type="text"
                  placeholder="학생 이름 (예: 홍길동)"
                  value={applicantName}
                  onChange={(e) => setApplicantName(e.target.value)}
                  disabled={!!myBookingId}
                  className="text-xs h-9 w-36 bg-white disabled:bg-slate-100"
                />
                <Input
                  type="tel"
                  placeholder="보호자 연락처 (선택)"
                  value={applicantPhone}
                  onChange={(e) => setApplicantPhone(e.target.value)}
                  disabled={!!myBookingId}
                  className="text-xs h-9 w-44 bg-white disabled:bg-slate-100"
                />
              </div>

              <div className="text-xs text-slate-500">
                💡 희망하는 <span className="font-bold text-indigo-600">빈 시간대 셀을 클릭</span>하면 즉시 접수됩니다.
              </div>
            </CardContent>
          </Card>

          {/* 상담 접수 마감/종료 안내 배너 */}
          {!config.isOpen && (
            <div className="p-4 bg-slate-100 border border-slate-300 rounded-2xl flex items-center gap-3 text-slate-800 shadow-xs">
              <Lock className="w-5 h-5 text-slate-500 shrink-0" />
              <div>
                <div className="text-xs font-bold text-slate-800">현재 학부모 상담 신청 접수가 마감(종료)되었습니다.</div>
                <div className="text-[11px] text-slate-500 mt-0.5">담임 선생님께서 접수를 시작(ON)하시면 빈 시간대를 선택하여 신청할 수 있습니다.</div>
              </div>
            </div>
          )}

          {/* 내 예약 완료 배너 */}
          {myCurrentSlot && (
            <div className="bg-emerald-50 border border-emerald-300 p-4 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-emerald-950 shadow-xs">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-emerald-100 text-emerald-700">
                  <CheckCircle2 className="w-5 h-5" />
                </div>
                <div>
                  <div className="text-xs font-bold text-emerald-700">상담 신청 완료 (확정)</div>
                  <div className="text-sm font-black mt-0.5">
                    {myCurrentSlot.date} ({myCurrentSlot.timeRange}) — 학생: {myCurrentSlot.bookedBy?.studentName}
                  </div>
                </div>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleParentCancel}
                className="text-xs font-bold bg-white hover:bg-rose-50 border-rose-200 text-rose-600 gap-1 cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>예약 취소 후 변경하기</span>
              </Button>
            </div>
          )}
        </div>
      )}

      {/* ─── 상담 현황 시간표 그리드 (엑셀 양식 완벽 재현) ─── */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-center border-collapse min-w-[700px]">
            <thead>
              <tr className="bg-slate-100/90 border-b border-slate-200 text-xs font-bold text-slate-700">
                <th className="p-3 w-48 border-r border-slate-200 bg-slate-100 whitespace-nowrap">
                  희망 상담 시간 ({config.slotDuration}분)
                </th>
                {dateColumns.map((col) => (
                  <th key={col.dateStr} className="p-3 border-r border-slate-200 last:border-r-0">
                    <div className="flex flex-col items-center justify-center gap-1.5">
                      <span className={col.isExcluded ? 'line-through text-slate-400 font-semibold' : 'text-slate-800 font-black'}>
                        {col.label}
                      </span>
                      {activeRole === 'TEACHER' && (
                        <button
                          type="button"
                          onClick={() => handleToggleExcludeDate(col.dateStr)}
                          className={`text-[10px] px-2 py-0.5 rounded-md border font-bold transition-all cursor-pointer ${
                            col.isExcluded
                              ? 'bg-rose-100 text-rose-700 border-rose-300 hover:bg-rose-200'
                              : 'bg-white text-slate-600 border-slate-300 hover:bg-slate-100'
                          }`}
                        >
                          {col.isExcluded ? '제외 해제' : '하루 차단'}
                        </button>
                      )}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="text-xs divide-y divide-slate-200">
              {timeSlotRows.map((row) => (
                <tr key={row.timeRange} className="hover:bg-slate-50/60 transition-colors">
                  {/* 시간 라벨 컬럼 */}
                  <td className="p-3 font-bold bg-slate-50/90 border-r border-slate-200 text-slate-700 whitespace-nowrap">
                    {row.timeRange}
                  </td>

                  {/* 날짜별 슬롯 셀 */}
                  {dateColumns.map((col) => {
                    const slot = getSlot(col.dateStr, row.timeRange);
                    const isMySlot = myBookingId === slot.id;

                    let cellContent = null;
                    let cellClass = 'p-2.5 border-r border-slate-200 last:border-r-0 transition-all ';

                    if (slot.status === 'BLOCKED' || col.isExcluded) {
                      cellClass += 'bg-slate-100 text-slate-400 cursor-not-allowed';
                      cellContent = (
                        <div className="flex items-center justify-center gap-1 text-[11px] text-slate-400 font-medium">
                          <Lock className="w-3 h-3" />
                          <span>불가</span>
                        </div>
                      );
                    } else if (slot.status === 'BOOKED') {
                      if (isMySlot) {
                        cellClass += 'bg-emerald-100 border-2 border-emerald-500 text-emerald-950 font-black';
                        cellContent = (
                          <div className="flex items-center justify-center gap-1">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-700" />
                            <span>{slot.bookedBy?.studentName} (내 신청)</span>
                          </div>
                        );
                      } else {
                        cellClass += 'bg-slate-200/80 text-slate-700 font-bold';
                        cellContent = (
                          <div className="flex items-center justify-center gap-1">
                            <Lock className="w-3 h-3 text-slate-500" />
                            <span>{activeRole === 'TEACHER' ? slot.bookedBy?.studentName : '마감'}</span>
                          </div>
                        );
                      }
                    } else {
                      cellClass += 'bg-white hover:bg-indigo-50/60 cursor-pointer text-slate-400';
                      cellContent = (
                        <span className="text-[11px] text-slate-400 hover:text-indigo-600 font-medium">
                          {activeRole === 'TEACHER' ? '+ 차단' : '신청 가능'}
                        </span>
                      );
                    }

                    return (
                      <td
                        key={col.dateStr}
                        className={cellClass}
                        onClick={() => {
                          if (activeRole === 'TEACHER') {
                            if (!col.isExcluded) handleTeacherToggleSlot(col.dateStr, row.timeRange);
                          } else {
                            if (slot.status === 'AVAILABLE' && !col.isExcluded) {
                              handleParentBook(col.dateStr, row.timeRange);
                            } else if (slot.status === 'BOOKED' && !isMySlot) {
                              setAlertMessage('이미 다른 학부모님께서 신청 완료한 시간대입니다.');
                            }
                          }
                        }}
                      >
                        {cellContent}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* 하단 범례 */}
        <div className="p-3.5 bg-slate-50 border-t border-slate-200 flex flex-wrap items-center justify-end gap-4 text-xs font-semibold text-slate-600">
          <div className="flex items-center gap-1.5">
            <div className="w-3.5 h-3.5 bg-white border border-slate-300 rounded-md"></div>
            <span>신청 가능</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3.5 h-3.5 bg-emerald-100 border border-emerald-500 rounded-md"></div>
            <span>내 예약</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3.5 h-3.5 bg-slate-200 border border-slate-300 rounded-md"></div>
            <span>예약 마감</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3.5 h-3.5 bg-slate-100 border border-slate-200 rounded-md"></div>
            <span>상담 불가/제외</span>
          </div>
        </div>
      </div>
    </div>
  );
};
