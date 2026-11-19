'use client';

import React, { useState, useEffect } from 'react';
import {
  Settings,
  User,
  Star,
  BookOpen,
  MessageSquare,
  Sparkles,
  Smile,
  CheckCircle2,
  Clock,
  Trash2,
  Plus,
  Minus,
  ArrowLeft,
  RotateCcw,
  Check,
  Send,
  Calendar,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import type { DeskSlot } from '@/lib/types/seating';
import { getPraiseTier } from '@/lib/types/seating';
import type { MasterStudent } from '@/lib/types/masterStudent';
import { isFemaleStudent, isMaleStudent } from '@/lib/services/seatingService';
import type { TeamColorTheme } from '@/lib/types/teams';
import {
  AVATAR_PRESETS,
  getCustomAvatar,
  saveCustomAvatar,
  type CustomAvatarData,
} from '@/lib/types/avatars';
import {
  onHomeworksUpdate,
  onHomeworkChecksUpdate,
  setHomeworkCheck,
  onBehaviorsUpdate,
  addBehaviorRecord,
  deleteBehaviorRecord,
} from '@/lib/services/homeroomClassService';
import type {
  HomeroomHomework,
  HomeroomHomeworkCheck,
  HomeroomBehaviorRecord,
} from '@/lib/types/homeroomClass';

interface StudentDetailModalProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  targetSlot: DeskSlot | null;
  student: MasterStudent | null;
  classKey: string;
  classLabel?: string;
  isFullscreen?: boolean;
  onPraiseChange?: (slotId: string, delta: number) => void;
  studentTeamInfo?: {
    teamName: string;
    theme: TeamColorTheme;
    isLeader?: boolean;
  };
}

const PRAISE_QUICK_REASONS = [
  '적극적인 발표',
  '바른 경청 태도',
  '친구 배려·협동',
  '모둠 활동 솔선수범',
  '과제·청소 완벽',
  '친절과 배려',
];

export const StudentDetailModal: React.FC<StudentDetailModalProps> = ({
  isOpen,
  onOpenChange,
  targetSlot,
  student,
  classKey,
  classLabel,
  isFullscreen,
  onPraiseChange,
  studentTeamInfo,
}) => {
  const { toast } = useToast();

  // 뷰 모드: 'CARD' (학생 프로필 카드) | 'MANAGE' (수업·학생 관리 톱니바퀴 모드)
  const [viewMode, setViewMode] = useState<'CARD' | 'MANAGE'>('CARD');
  // 관리 모드 내부 서브 탭: 'AVATAR' | 'HOMEWORK' | 'PRAISE' | 'CONSULT'
  const [manageTab, setManageTab] = useState<'AVATAR' | 'HOMEWORK' | 'PRAISE' | 'CONSULT'>('AVATAR');

  // 커스텀 아바타 상태
  const [customAvatar, setCustomAvatar] = useState<CustomAvatarData | null>(null);

  // 숙제 및 체크 데이터
  const [homeworks, setHomeworks] = useState<HomeroomHomework[]>([]);
  const [hwChecks, setHwChecks] = useState<HomeroomHomeworkCheck[]>([]);

  // 상담 및 관찰 기록 데이터
  const [behaviors, setBehaviors] = useState<HomeroomBehaviorRecord[]>([]);
  const [newConsultContent, setNewConsultContent] = useState('');
  const [newConsultDate, setNewConsultDate] = useState(
    () => new Date().toISOString().split('T')[0]
  );
  const [isSubmittingConsult, setIsSubmittingConsult] = useState(false);

  // 모달이 열리거나 타깃 학생이 바뀔 때 초기화
  useEffect(() => {
    if (!isOpen || !targetSlot?.studentId) return;

    setViewMode('CARD');
    const saved = getCustomAvatar(classKey, targetSlot.studentId);
    setCustomAvatar(saved);

    // 숙제 목록 구독
    const unsubHw = onHomeworksUpdate(classKey, (list) => {
      setHomeworks(list);
    });

    // 숙제 체크 구독
    const unsubChecks = onHomeworkChecksUpdate(classKey, (checks) => {
      setHwChecks(checks);
    });

    // 상담 및 행동 기록 구독
    const unsubBehaviors = onBehaviorsUpdate(classKey, (records) => {
      // 해당 학생의 기록만 필터링
      const studentRecords = records.filter(
        (r) => r.studentId === targetSlot.studentId
      );
      setBehaviors(studentRecords);
    });

    return () => {
      unsubHw();
      unsubChecks();
      unsubBehaviors();
    };
  }, [isOpen, targetSlot?.studentId, classKey]);

  if (!targetSlot || !targetSlot.studentId) return null;

  const studentId = targetSlot.studentId;
  const studentName = student?.name || targetSlot.studentName || '이름 없음';
  const studentNum = student?.studentNum || targetSlot.studentNum || '';

  // 통합학생정보(student.gender)를 최우선 단일진실공급원(SSOT)으로 성별 판정
  const currentGender = student?.gender || targetSlot.studentGender;
  const isFemale = student
    ? isFemaleStudent(student)
    : (currentGender === 'Female' || currentGender === '여' || currentGender === '여자' || currentGender === 'F');
  const isMale = !isFemale;

  const defaultPhotoUrl = student?.photoUrl || targetSlot.studentPhotoUrl;
  const praisePoints = targetSlot.praisePoints || 0;
  const praiseTier = getPraiseTier(praisePoints, classKey);

  // ─── 1. 아바타 선택 및 저장 핸들러 ───
  const handleSelectAvatarPreset = (preset: typeof AVATAR_PRESETS[0]) => {
    const avatarData: CustomAvatarData = {
      type: 'preset',
      value: preset.id,
      emoji: preset.emoji,
      name: preset.name,
      bgClass: preset.bgClass,
      borderClass: preset.borderClass,
      updatedAt: new Date().toISOString(),
    };
    saveCustomAvatar(classKey, studentId, avatarData);
    setCustomAvatar(avatarData);
    toast({
      title: '학급 전용 아바타 적용 완료',
      description: `[${studentName}] 학생의 아바타가 '${preset.name}'(으)로 변경되었습니다. 마스터 통합 사진은 안전하게 보존됩니다.`,
    });
  };

  const handleResetToDefaultPhoto = () => {
    saveCustomAvatar(classKey, studentId, null);
    setCustomAvatar(null);
    toast({
      title: '기본 사진 복원 완료',
      description: `[${studentName}] 학생의 아바타가 기본 학교 사진으로 복원되었습니다.`,
    });
  };

  // ─── 2. 숙제 토글 핸들러 ───
  const handleToggleHomework = async (hwId: string, currentStatus: boolean) => {
    try {
      await setHomeworkCheck(
        classKey,
        hwId,
        studentId,
        studentName,
        !currentStatus
      );
      toast({
        title: !currentStatus ? '과제 제출 완료' : '과제 미제출로 변경',
        description: `[${studentName}] 학생의 과제 제출 상태가 업데이트되었습니다.`,
      });
    } catch (e) {
      console.error(e);
      toast({
        title: '오류 발생',
        description: '과제 상태 변경에 실패했습니다.',
        variant: 'destructive',
      });
    }
  };

  // ─── 3. 칭찬 증감 핸들러 ───
  const handlePraiseChange = (delta: number, reason?: string) => {
    if (onPraiseChange) {
      onPraiseChange(targetSlot.id, delta);
      toast({
        title: delta > 0 ? `⭐️ 칭찬 +${delta}점 부여!` : `칭찬 ${delta}점 차감`,
        description: reason
          ? `사유: ${reason}`
          : `[${studentName}] 학생의 칭찬 점수가 변경되었습니다.`,
      });
    }
  };

  // ─── 4. 상담/관찰 기록 추가 핸들러 ───
  const handleAddConsultation = async () => {
    if (!newConsultContent.trim()) {
      toast({
        title: '내용을 입력해주세요',
        description: '관찰 또는 상담 내용을 작성해주세요.',
        variant: 'destructive',
      });
      return;
    }

    setIsSubmittingConsult(true);
    try {
      await addBehaviorRecord(
        classKey,
        studentId,
        studentName,
        studentNum,
        newConsultContent.trim(),
        newConsultDate
      );
      setNewConsultContent('');
      toast({
        title: '상담·관찰 기록 저장 완료',
        description: '새로운 관찰 일지가 등록되었습니다.',
      });
    } catch (e) {
      console.error(e);
      toast({
        title: '저장 실패',
        description: '상담 기록 저장 중 오류가 발생했습니다.',
        variant: 'destructive',
      });
    } finally {
      setIsSubmittingConsult(false);
    }
  };

  const handleDeleteConsultation = async (recordId: string) => {
    try {
      await deleteBehaviorRecord(classKey, recordId);
      toast({
        title: '기록 삭제 완료',
        description: '상담/관찰 기록이 삭제되었습니다.',
      });
    } catch (e) {
      console.error(e);
      toast({
        title: '삭제 실패',
        description: '기록 삭제 중 오류가 발생했습니다.',
        variant: 'destructive',
      });
    }
  };

  // 학생별 숙제 제출 통계
  const studentChecks = hwChecks.filter((c) => c.studentId === studentId);
  const checkedHwIds = new Set(studentChecks.filter((c) => c.checked).map((c) => c.hwId));
  const completedHwCount = homeworks.filter((h) => checkedHwIds.has(h.id)).length;
  const hwCompletionRate = homeworks.length > 0 ? Math.round((completedHwCount / homeworks.length) * 100) : 0;

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent
        container={typeof document !== 'undefined' ? (document.fullscreenElement as HTMLElement) || undefined : undefined}
        className="sm:max-w-2xl p-0 overflow-hidden rounded-3xl border-2 border-slate-200 shadow-2xl bg-white max-h-[92vh] flex flex-col z-[99999]"
      >
        <DialogTitle className="sr-only">
          {classLabel ? `${classLabel} ${studentName} 학생 상세 정보` : `${studentName} 학생 상세 정보`}
        </DialogTitle>
        <DialogDescription className="sr-only">
          {studentName} 학생의 학급 프로필, 과제 제출 현황, 칭찬 점수 및 행동 상담 기록을 확인하고 관리합니다.
        </DialogDescription>
        {/* ─── 상단 헤더 바 ─── */}
        <div className="flex items-center justify-between px-6 py-4 bg-slate-900 text-white select-none shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            {viewMode === 'MANAGE' ? (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setViewMode('CARD')}
                className="h-8 px-2 text-white hover:bg-white/20 -ml-2 gap-1 rounded-xl"
              >
                <ArrowLeft className="w-4 h-4" />
                <span className="text-xs font-bold">학생 카드로 돌아가기</span>
              </Button>
            ) : (
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-pulse" />
                <span className="text-sm font-black tracking-tight">
                  {classLabel ? `${classLabel} 학생 정보 카드` : '학생 상세 카드'}
                </span>
              </div>
            )}
          </div>

          <div className="flex items-center gap-2 pr-8">
            {viewMode === 'CARD' ? (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setViewMode('MANAGE')}
                className="h-8 px-3 rounded-xl bg-white/10 hover:bg-white/25 border-white/30 text-white font-bold text-xs gap-1.5 shadow-xs transition-all"
              >
                <Settings className="w-4 h-4 text-amber-300" />
                <span>수업·학생 관리</span>
              </Button>
            ) : (
              <Badge className="bg-amber-400 text-slate-900 font-black text-xs px-2.5 py-0.5 rounded-full">
                관리 모드
              </Badge>
            )}
          </div>
        </div>

        {/* ─── 본문 영역 (CARD vs MANAGE) ─── */}
        {viewMode === 'CARD' ? (
          /* ========================================================
             1. 학생 프로필 카드 (화면 가운데 크게, 이름과 사진이 잘 보임)
             ======================================================== */
          <div className="flex-1 overflow-y-auto p-6 sm:p-8 flex flex-col items-center justify-between bg-gradient-to-b from-slate-50/60 to-white">
            <div className="w-full flex flex-col items-center">
              {/* 대형 프로필 사진 또는 커스텀 아바타 */}
              <div className="relative mb-4 group">
                {customAvatar ? (
                  <div
                    className={`w-32 h-32 sm:w-36 sm:h-36 rounded-3xl flex flex-col items-center justify-center border-4 shadow-xl transition-transform transform group-hover:scale-105 ${customAvatar.bgClass || 'bg-amber-100'} ${customAvatar.borderClass || 'border-amber-300'}`}
                  >
                    <span className="text-6xl sm:text-7xl select-none filter drop-shadow">
                      {customAvatar.emoji || '🦁'}
                    </span>
                    <span className="text-[11px] font-black mt-1 px-2 py-0.5 rounded-full bg-white/80 text-slate-800 shadow-2xs">
                      {customAvatar.name || '학급 아바타'}
                    </span>
                  </div>
                ) : defaultPhotoUrl ? (
                  <img
                    src={defaultPhotoUrl}
                    alt={studentName}
                    className="w-32 h-32 sm:w-36 sm:h-36 rounded-3xl object-cover border-4 border-amber-300 shadow-xl transition-transform transform group-hover:scale-105"
                  />
                ) : (
                  <div
                    className={`w-32 h-32 sm:w-36 sm:h-36 rounded-3xl flex items-center justify-center font-black text-3xl sm:text-4xl border-4 shadow-xl text-white ${
                      isFemale ? 'bg-[#B01E23] border-rose-300' : 'bg-[#2471B2] border-blue-300'
                    }`}
                  >
                    {studentName.slice(-2)}
                  </div>
                )}

                {/* 학급 전용 아바타 적용 중 배지 */}
                {customAvatar && (
                  <span className="absolute -top-2 -right-2 px-2 py-0.5 rounded-full bg-violet-600 text-white font-black text-[10px] shadow-md border-2 border-white">
                    학급 아바타
                  </span>
                )}
              </div>

              {/* 학생 번호, 성명, 성별 배지 */}
              <div className="flex items-center gap-2.5 mb-1.5 flex-wrap justify-center">
                {studentNum && (
                  <Badge variant="outline" className="text-sm font-mono font-bold text-slate-500 bg-white px-2.5 py-0.5">
                    {studentNum}번
                  </Badge>
                )}
                <h2 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
                  {studentName}
                </h2>
                <Badge
                  className={`text-xs font-black px-2 py-0.5 rounded-md ${
                    isFemale
                      ? 'bg-rose-100 text-[#B01E23] border border-rose-200'
                      : 'bg-blue-100 text-[#2471B2] border border-blue-200'
                  }`}
                >
                  {isFemale ? '여학생' : '남학생'}
                </Badge>
              </div>

              {/* 소속 팀/모둠 정보 배지 */}
              {studentTeamInfo && (
                <div className="mt-1 mb-3">
                  <span
                    className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black shadow-xs ${studentTeamInfo.theme.badge} text-white`}
                  >
                    {studentTeamInfo.isLeader && <span>👑</span>}
                    <span>{studentTeamInfo.teamName}</span>
                    {studentTeamInfo.isLeader && <span>(팀장)</span>}
                  </span>
                </div>
              )}

              {/* 좌석 정보 (분단 / 모둠) */}
              <p className="text-xs font-bold text-slate-400 mb-5">
                {targetSlot.groupId ? `${targetSlot.groupId}분단/모둠` : '지정 좌석'} · {targetSlot.row + 1}행 {targetSlot.col + 1}열
              </p>

              {/* ─── 칭찬 온도계 & 포인트 요약 카드 ─── */}
              <div className={`w-full max-w-md p-4 rounded-2xl border-2 transition-all shadow-xs ${praiseTier.cardBgClass} ${praiseTier.cardBorderClass} mb-4`}>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xl">{praiseTier.icon}</span>
                    <span className="font-black text-slate-800 text-sm">{praiseTier.name}</span>
                    <span className="text-xs text-slate-500 font-medium">({praiseTier.badgeClass.includes('green') ? '식물 성장 중' : '성장 로드맵'})</span>
                  </div>
                  <div className="flex items-center gap-1 font-mono font-black text-base text-amber-600 bg-white px-2.5 py-0.5 rounded-full border border-amber-200 shadow-2xs">
                    <Star className="w-4 h-4 fill-amber-400 text-amber-500" />
                    <span>{praisePoints}점</span>
                  </div>
                </div>

                {/* 칭찬 게이지 진행바 */}
                <div className="w-full bg-white/80 rounded-full h-3 p-0.5 border border-slate-200 overflow-hidden mb-2">
                  <div
                    className="h-full bg-gradient-to-r from-amber-400 to-amber-500 rounded-full transition-all duration-500"
                    style={{ width: `${Math.min(100, Math.max(5, (praisePoints % 20) * 5))}%` }}
                  />
                </div>

                {/* 칭찬 퀵 버튼 (+1, +2) */}
                <div className="flex items-center justify-between pt-1 border-t border-slate-200/60">
                  <span className="text-[11px] text-slate-500 font-medium">칭찬 바로 주기:</span>
                  <div className="flex items-center gap-1.5">
                    <Button
                      size="sm"
                      onClick={() => handlePraiseChange(1, '성실한 태도')}
                      className="h-7 px-2.5 bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs rounded-lg gap-1 shadow-xs"
                    >
                      <Plus className="w-3.5 h-3.5" /> 1점
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => handlePraiseChange(2, '훌륭한 참여')}
                      className="h-7 px-2.5 bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs rounded-lg gap-1 shadow-xs"
                    >
                      <Plus className="w-3.5 h-3.5" /> 2점
                    </Button>
                  </div>
                </div>
              </div>

              {/* ─── 요약 통계 2단 (과제 제출률 / 상담 기록) ─── */}
              <div className="w-full max-w-md grid grid-cols-2 gap-3 mb-2">
                <div
                  onClick={() => {
                    setViewMode('MANAGE');
                    setManageTab('HOMEWORK');
                  }}
                  className="p-3 bg-white rounded-2xl border border-slate-200 shadow-xs hover:border-[#2471B2] hover:bg-blue-50/30 cursor-pointer transition-all flex flex-col justify-between"
                >
                  <div className="flex items-center justify-between text-xs font-bold text-slate-500">
                    <span className="flex items-center gap-1">
                      <BookOpen className="w-3.5 h-3.5 text-blue-600" />
                      과제 제출
                    </span>
                    <span className="text-blue-600 font-bold">{hwCompletionRate}%</span>
                  </div>
                  <div className="mt-2 flex items-baseline gap-1">
                    <span className="text-lg font-black text-slate-900">{completedHwCount}</span>
                    <span className="text-xs text-slate-400">/ {homeworks.length}건 완료</span>
                  </div>
                </div>

                <div
                  onClick={() => {
                    setViewMode('MANAGE');
                    setManageTab('CONSULT');
                  }}
                  className="p-3 bg-white rounded-2xl border border-slate-200 shadow-xs hover:border-emerald-500 hover:bg-emerald-50/30 cursor-pointer transition-all flex flex-col justify-between"
                >
                  <div className="flex items-center justify-between text-xs font-bold text-slate-500">
                    <span className="flex items-center gap-1">
                      <MessageSquare className="w-3.5 h-3.5 text-emerald-600" />
                      상담·관찰
                    </span>
                    <span className="text-emerald-600 font-bold">{behaviors.length}건</span>
                  </div>
                  <div className="mt-2 text-xs text-slate-600 line-clamp-1 font-medium">
                    {behaviors.length > 0 ? behaviors[0].content : '작성된 기록 없음'}
                  </div>
                </div>
              </div>
            </div>

            {/* 카드 하단 바로가기 버튼 */}
            <div className="w-full max-w-md pt-4 border-t border-slate-100 flex items-center justify-between gap-2 mt-4">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setViewMode('MANAGE');
                  setManageTab('AVATAR');
                }}
                className="flex-1 h-9 rounded-xl font-bold text-xs gap-1.5 border-slate-200 hover:bg-slate-100"
              >
                <Smile className="w-4 h-4 text-violet-500" />
                아바타 변경
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setViewMode('MANAGE');
                  setManageTab('PRAISE');
                }}
                className="flex-1 h-9 rounded-xl font-bold text-xs gap-1.5 border-slate-200 hover:bg-slate-100"
              >
                <Sparkles className="w-4 h-4 text-amber-500" />
                칭찬 관리
              </Button>
              <Button
                size="sm"
                onClick={() => setViewMode('MANAGE')}
                className="flex-1 h-9 rounded-xl font-bold text-xs gap-1.5 bg-slate-900 hover:bg-slate-800 text-white shadow-xs"
              >
                <Settings className="w-4 h-4 text-amber-300" />
                전체 관리
              </Button>
            </div>
          </div>
        ) : (
          /* ========================================================
             2. 수업·학생 관리 (톱니바퀴 모드): 4대 핵심 탭
             ======================================================== */
          <div className="flex-1 overflow-hidden flex flex-col bg-slate-50/50">
            {/* 학생 요약 서브 헤더 */}
            <div className="flex items-center justify-between px-6 py-2.5 bg-white border-b border-slate-200 shrink-0">
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs font-bold text-slate-400">
                  {studentNum ? `${studentNum}번` : ''}
                </span>
                <span className="font-black text-slate-900 text-base">{studentName}</span>
                <span
                  className={`text-[10px] font-bold px-1.5 py-0.2 rounded ${
                    isMale ? 'bg-blue-100 text-[#2471B2]' : 'bg-rose-100 text-[#B01E23]'
                  }`}
                >
                  {isMale ? '남' : '여'}
                </span>
              </div>

              {/* 4대 관리 서브 탭 바 */}
              <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl">
                <button
                  type="button"
                  onClick={() => setManageTab('AVATAR')}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1 ${
                    manageTab === 'AVATAR'
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-500 hover:text-slate-900'
                  }`}
                >
                  <Smile className="w-3.5 h-3.5 text-violet-500" />
                  아바타
                </button>
                <button
                  type="button"
                  onClick={() => setManageTab('HOMEWORK')}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1 ${
                    manageTab === 'HOMEWORK'
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-500 hover:text-slate-900'
                  }`}
                >
                  <BookOpen className="w-3.5 h-3.5 text-blue-500" />
                  과제 ({completedHwCount}/{homeworks.length})
                </button>
                <button
                  type="button"
                  onClick={() => setManageTab('PRAISE')}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1 ${
                    manageTab === 'PRAISE'
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-500 hover:text-slate-900'
                  }`}
                >
                  <Star className="w-3.5 h-3.5 text-amber-500" />
                  칭찬 ({praisePoints}점)
                </button>
                <button
                  type="button"
                  onClick={() => setManageTab('CONSULT')}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1 ${
                    manageTab === 'CONSULT'
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-500 hover:text-slate-900'
                  }`}
                >
                  <MessageSquare className="w-3.5 h-3.5 text-emerald-500" />
                  상담·관찰 ({behaviors.length})
                </button>
              </div>
            </div>

            {/* 탭 본문 스크롤 영역 */}
            <div className="flex-1 overflow-y-auto p-6">
              {/* ────────────────────────────────────────────────────────
                  탭 1: 아바타 관리 (통합 계정 사진 보존, 학급 관리 전용)
                  ──────────────────────────────────────────────────────── */}
              {manageTab === 'AVATAR' && (
                <div className="space-y-5">
                  <div className="p-4 bg-violet-50/70 border border-violet-200 rounded-2xl flex items-start gap-3">
                    <div className="p-2 bg-violet-100 rounded-xl text-violet-700 shrink-0 mt-0.5">
                      <Smile className="w-5 h-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="text-xs font-black text-violet-900 mb-0.5">
                        학급 전용 학생 캐릭터 아바타 등록
                      </h4>
                      <p className="text-[11px] text-violet-700 leading-relaxed break-keep">
                        학교 마스터 통합 계정의 원본 사진은 그대로 안전하게 보존되며, 담임 학급 관리와 자리배치도, 수업 도구에서만 귀여운 캐릭터 아바타로 표시됩니다.
                      </p>
                    </div>
                  </div>

                  {/* 현재 적용 상태 및 복원 버튼 */}
                  <div className="flex items-center justify-between p-4 bg-white rounded-2xl border border-slate-200 shadow-xs">
                    <div className="flex items-center gap-3">
                      <div className="relative">
                        {customAvatar ? (
                          <div
                            className={`w-14 h-14 rounded-2xl flex items-center justify-center text-3xl border-2 shadow-xs ${customAvatar.bgClass || 'bg-amber-100'} ${customAvatar.borderClass || 'border-amber-300'}`}
                          >
                            {customAvatar.emoji || '🦁'}
                          </div>
                        ) : defaultPhotoUrl ? (
                          <img
                            src={defaultPhotoUrl}
                            alt={studentName}
                            className="w-14 h-14 rounded-2xl object-cover border-2 border-slate-200 shadow-xs"
                          />
                        ) : (
                          <div
                            className={`w-14 h-14 rounded-2xl flex items-center justify-center font-black text-sm text-white ${
                              isMale ? 'bg-[#2471B2]' : 'bg-[#B01E23]'
                            }`}
                          >
                            {studentName.slice(-2)}
                          </div>
                        )}
                      </div>
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-bold text-slate-500">현재 적용 상태:</span>
                          <span className="text-xs font-black text-slate-900">
                            {customAvatar ? customAvatar.name : '기본 학교 사진'}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-400 mt-0.5">
                          {customAvatar
                            ? '학급 전용 아바타가 화면에 표시되고 있습니다.'
                            : '마스터 계정에 등록된 사진이 표시되고 있습니다.'}
                        </p>
                      </div>
                    </div>

                    {customAvatar && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleResetToDefaultPhoto}
                        className="h-8 px-3 rounded-xl text-xs font-bold text-rose-600 border-rose-200 hover:bg-rose-50 gap-1"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        기본 사진으로 복원
                      </Button>
                    )}
                  </div>

                  {/* 프리셋 아바타 그리드 (16종) */}
                  <div>
                    <h5 className="text-xs font-black text-slate-700 mb-2.5 flex items-center gap-1">
                      <span>캐릭터 아바타 선택</span>
                      <span className="text-slate-400 font-normal">({AVATAR_PRESETS.length}종)</span>
                    </h5>
                    <div className="grid grid-cols-4 sm:grid-cols-8 gap-2.5">
                      {AVATAR_PRESETS.map((preset) => {
                        const isSelected = customAvatar?.value === preset.id;
                        return (
                          <button
                            key={preset.id}
                            type="button"
                            onClick={() => handleSelectAvatarPreset(preset)}
                            className={`p-2.5 rounded-2xl border-2 flex flex-col items-center justify-center transition-all select-none cursor-pointer ${
                              isSelected
                                ? 'ring-2 ring-violet-500 ring-offset-2 border-violet-500 bg-violet-50/70 scale-105 shadow-md'
                                : `${preset.bgClass} ${preset.borderClass} hover:scale-105 hover:shadow-xs`
                            }`}
                          >
                            <span className="text-3xl mb-1 filter drop-shadow-xs">{preset.emoji}</span>
                            <span className="text-[10px] font-black text-slate-800 truncate w-full text-center">
                              {preset.name.split(' ')[1] || preset.name}
                            </span>
                            {isSelected && (
                              <span className="w-2 h-2 rounded-full bg-violet-600 mt-1" />
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}

              {/* ────────────────────────────────────────────────────────
                  탭 2: 과제 제출 상황 관리 (토글 및 제출 현황)
                  ──────────────────────────────────────────────────────── */}
              {manageTab === 'HOMEWORK' && (
                <div className="space-y-4">
                  {/* 진행률 카드 */}
                  <div className="p-4 bg-blue-50/60 border border-blue-200 rounded-2xl flex items-center justify-between">
                    <div>
                      <h4 className="text-xs font-black text-blue-900 mb-0.5">
                        과제 제출 현황 (총 {completedHwCount} / {homeworks.length}건 제출)
                      </h4>
                      <p className="text-[11px] text-blue-700">
                        클릭하여 해당 과제의 제출 완료/미제출 상태를 즉시 변경할 수 있습니다.
                      </p>
                    </div>
                    <div className="text-right">
                      <span className="text-2xl font-black text-blue-600 font-mono">
                        {hwCompletionRate}%
                      </span>
                      <div className="text-[10px] font-bold text-slate-400">제출 달성률</div>
                    </div>
                  </div>

                  {/* 과제 목록 */}
                  {homeworks.length === 0 ? (
                    <div className="text-center py-12 text-slate-400 text-xs">
                      등록된 학급 과제가 없습니다.
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {homeworks.map((hw) => {
                        const check = hwChecks.find(
                          (c) => c.hwId === hw.id && c.studentId === studentId
                        );
                        const isChecked = Boolean(check?.checked);

                        return (
                          <div
                            key={hw.id}
                            className={`p-3.5 rounded-2xl border transition-all flex items-center justify-between ${
                              isChecked
                                ? 'bg-white border-blue-200 shadow-2xs'
                                : 'bg-slate-50 border-slate-200'
                            }`}
                          >
                            <div className="flex items-center gap-3 min-w-0">
                              <button
                                type="button"
                                onClick={() => handleToggleHomework(hw.id, isChecked)}
                                className={`w-8 h-8 rounded-xl flex items-center justify-center transition-all shrink-0 ${
                                  isChecked
                                    ? 'bg-blue-600 text-white shadow-xs'
                                    : 'bg-white border-2 border-slate-300 text-slate-300 hover:border-blue-400'
                                }`}
                              >
                                <Check className={`w-4 h-4 ${isChecked ? 'stroke-[3]' : ''}`} />
                              </button>
                              <div className="min-w-0">
                                <h5 className={`text-xs font-black truncate ${
                                  isChecked ? 'text-slate-900' : 'text-slate-600'
                                }`}>
                                  {hw.title}
                                </h5>
                                <div className="flex items-center gap-2 mt-0.5 text-[10px] text-slate-400">
                                  <span>{hw.dateWithDay || hw.date}</span>
                                  {hw.isTeacherConfirmed && (
                                    <Badge variant="outline" className="text-[9px] px-1 py-0 h-4 text-emerald-600 border-emerald-300">
                                      선생님 확인완료
                                    </Badge>
                                  )}
                                </div>
                              </div>
                            </div>

                            <Button
                              size="sm"
                              variant={isChecked ? 'default' : 'outline'}
                              onClick={() => handleToggleHomework(hw.id, isChecked)}
                              className={`h-7 px-2.5 rounded-lg text-xs font-bold ${
                                isChecked
                                  ? 'bg-blue-600 hover:bg-blue-700 text-white'
                                  : 'border-slate-300 text-slate-600 hover:bg-slate-100'
                              }`}
                            >
                              {isChecked ? '제출 완료' : '미제출'}
                            </Button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* ────────────────────────────────────────────────────────
                  탭 3: 칭찬 현황 및 점수 부여/차감
                  ──────────────────────────────────────────────────────── */}
              {manageTab === 'PRAISE' && (
                <div className="space-y-5">
                  {/* 누적 칭찬 카드 */}
                  <div className={`p-4 rounded-2xl border-2 flex items-center justify-between ${praiseTier.cardBgClass} ${praiseTier.cardBorderClass}`}>
                    <div className="flex items-center gap-3">
                      <span className="text-3xl">{praiseTier.icon}</span>
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="text-base font-black text-slate-900">{praiseTier.name} 단계</span>
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${praiseTier.badgeClass}`}>
                            {praisePoints}점
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-500 mt-0.5">
                          다음 단계까지 {Math.max(0, 10 - (praisePoints % 10))}점 남았습니다.
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handlePraiseChange(-1, '칭찬 점수 조정')}
                        disabled={praisePoints <= 0}
                        className="h-8 px-2.5 rounded-xl border-slate-300 text-slate-600 hover:bg-slate-100 font-bold text-xs gap-1"
                      >
                        <Minus className="w-3.5 h-3.5" /> 1점
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => handlePraiseChange(1, '성실한 수업 태도')}
                        className="h-8 px-3 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs gap-1 shadow-xs"
                      >
                        <Plus className="w-3.5 h-3.5" /> 1점
                      </Button>
                    </div>
                  </div>

                  {/* 칭찬 사유 선택 퀵 버튼 (원클릭 가산) */}
                  <div>
                    <h5 className="text-xs font-black text-slate-700 mb-2 flex items-center gap-1">
                      <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                      칭찬 사유 선택 시 1점 즉시 부여:
                    </h5>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                      {PRAISE_QUICK_REASONS.map((reason) => (
                        <button
                          key={reason}
                          type="button"
                          onClick={() => handlePraiseChange(1, reason)}
                          className="p-3 bg-white rounded-xl border border-slate-200 hover:border-amber-400 hover:bg-amber-50/40 text-left transition-all shadow-2xs group flex items-center justify-between"
                        >
                          <span className="text-xs font-bold text-slate-800 group-hover:text-amber-800">
                            {reason}
                          </span>
                          <span className="text-[10px] font-black text-amber-600 bg-amber-100 px-1.5 py-0.2 rounded-md">
                            +1
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* 추가 가산 (+2점, +5점) */}
                  <div className="pt-2 border-t border-slate-200 flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-500">특별 칭찬 보너스:</span>
                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        onClick={() => handlePraiseChange(2, '모범 행동 특별 칭찬')}
                        className="h-8 px-3 bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs rounded-xl gap-1 shadow-xs"
                      >
                        <Plus className="w-3.5 h-3.5" /> 2점 특별 칭찬
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => handlePraiseChange(5, '대단한 성취·선행')}
                        className="h-8 px-3 bg-orange-600 hover:bg-orange-700 text-white font-bold text-xs rounded-xl gap-1 shadow-xs"
                      >
                        <Plus className="w-3.5 h-3.5" /> 5점 대박 칭찬
                      </Button>
                    </div>
                  </div>
                </div>
              )}

              {/* ────────────────────────────────────────────────────────
                  탭 4: 상담 및 관찰 일지 기록
                  ──────────────────────────────────────────────────────── */}
              {manageTab === 'CONSULT' && (
                <div className="space-y-4">
                  {/* 새 상담/관찰 기록 작성 폼 */}
                  <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-xs space-y-3">
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-black text-slate-900 flex items-center gap-1.5">
                        <MessageSquare className="w-3.5 h-3.5 text-emerald-600" />
                        새로운 상담·관찰 일지 작성
                      </h4>
                      <div className="flex items-center gap-1.5">
                        <Calendar className="w-3.5 h-3.5 text-slate-400" />
                        <Input
                          type="date"
                          value={newConsultDate}
                          onChange={(e) => setNewConsultDate(e.target.value)}
                          className="h-7 text-xs font-mono w-32 px-2 rounded-lg"
                        />
                      </div>
                    </div>

                    <Textarea
                      placeholder="수업 태도, 교우 관계, 행동 특성 또는 학부모 상담 통화 내용을 기록하세요."
                      value={newConsultContent}
                      onChange={(e) => setNewConsultContent(e.target.value)}
                      rows={3}
                      className="text-xs rounded-xl resize-none"
                    />

                    <div className="flex justify-end">
                      <Button
                        size="sm"
                        onClick={handleAddConsultation}
                        disabled={isSubmittingConsult || !newConsultContent.trim()}
                        className="h-8 px-3.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs gap-1.5 shadow-xs"
                      >
                        <Send className="w-3.5 h-3.5" />
                        {isSubmittingConsult ? '저장 중...' : '기록 저장'}
                      </Button>
                    </div>
                  </div>

                  {/* 이전 상담/관찰 기록 타임라인 리스트 */}
                  <div>
                    <h5 className="text-xs font-black text-slate-700 mb-2">
                      누적 상담·관찰 기록 ({behaviors.length}건)
                    </h5>

                    {behaviors.length === 0 ? (
                      <div className="text-center py-8 text-slate-400 text-xs bg-white rounded-2xl border border-slate-100">
                        작성된 상담 및 관찰 기록이 없습니다.
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {behaviors.map((item) => (
                          <div
                            key={item.id}
                            className="p-3.5 bg-white rounded-2xl border border-slate-200 shadow-2xs hover:border-slate-300 transition-all flex items-start justify-between gap-3"
                          >
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                <Badge variant="outline" className="text-[10px] font-mono font-bold text-slate-500 bg-slate-50">
                                  {item.date}
                                </Badge>
                                {item.createdBy && (
                                  <span className="text-[10px] text-slate-400">
                                    {item.createdBy}
                                  </span>
                                )}
                              </div>
                              <p className="text-xs text-slate-800 leading-relaxed whitespace-pre-wrap font-medium">
                                {item.content}
                              </p>
                            </div>

                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDeleteConsultation(item.id)}
                              className="h-7 w-7 p-0 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg shrink-0"
                              title="기록 삭제"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
