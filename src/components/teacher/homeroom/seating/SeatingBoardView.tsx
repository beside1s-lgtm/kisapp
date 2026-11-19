'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Pin, Star, Plus } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { motion } from 'framer-motion';
import type { DeskSlot, SeatingConfig, SeatingViewOptions } from '@/lib/types/seating';
import { DEFAULT_VIEW_OPTIONS, getPraiseTier } from '@/lib/types/seating';
import type { MasterStudent } from '@/lib/types/masterStudent';
import { isFemaleStudent, isMaleStudent } from '@/lib/services/seatingService';
import { TEAM_COLOR_PALETTES, type ClassTeamData, type TeamColorTheme } from '@/lib/types/teams';
import { getCustomAvatar } from '@/lib/types/avatars';
import { StudentDetailModal } from './StudentDetailModal';

interface SeatingBoardViewProps {
  slots: DeskSlot[];
  config: SeatingConfig;
  revealedCount?: number; // '한 명씩 보기' 모드에서 현재까지 노출된 슬롯 수
  movingSourceSlot: DeskSlot | null; // 현재 자리 이동 중인 원본 좌석
  viewOptions?: SeatingViewOptions;
  studentsMap?: Map<string, MasterStudent>;
  teams?: ClassTeamData[];
  isFullscreen?: boolean;
  classKey?: string;
  classLabel?: string;
  highlightedSlotIds?: Set<string>; // 룰렛 뽑기 또는 하이라이트 애니메이션 슬롯들
  onSlotClick: (slot: DeskSlot) => void;
  onStartMove: (slot: DeskSlot) => void;
  onCancelMove: () => void;
  onMoveOrSwap: (sourceSlotId: string, targetSlotId: string) => void;
  onQuickPraise?: (slotId: string, delta: number) => void;
  onPraiseChange?: (slotId: string, delta: number) => void;
}

export const SeatingBoardView: React.FC<SeatingBoardViewProps> = ({
  slots,
  config,
  revealedCount,
  movingSourceSlot,
  viewOptions = DEFAULT_VIEW_OPTIONS,
  studentsMap = new Map(),
  teams = [],
  isFullscreen = false,
  classKey,
  classLabel,
  highlightedSlotIds,
  onSlotClick,
  onStartMove,
  onCancelMove,
  onMoveOrSwap,
  onQuickPraise,
  onPraiseChange,
}) => {
  // 우클릭 학생 상세 & 관리 모달 상태
  const [detailSlot, setDetailSlot] = useState<DeskSlot | null>(null);

  // 학급 전용 아바타 변경 시 실시간 리렌더링 트리거
  const [avatarTick, setAvatarTick] = useState(0);
  useEffect(() => {
    const handleAvatarUpdate = () => {
      setAvatarTick((prev) => prev + 1);
    };
    window.addEventListener('kis_avatar_updated', handleAvatarUpdate);
    return () => {
      window.removeEventListener('kis_avatar_updated', handleAvatarUpdate);
    };
  }, []);

  // 팀별 학생 매핑 맵 (팀 설정 시 같은 팀끼리 같은 책상 색상 적용)
  const studentTeamMap = React.useMemo(() => {
    const map = new Map<string, { teamName: string; theme: TeamColorTheme }>();
    if (!teams || teams.length === 0) return map;
    teams.forEach((t) => {
      const theme =
        TEAM_COLOR_PALETTES.find((p) => p.id === t.themeId) ||
        TEAM_COLOR_PALETTES[(t.id - 1) % TEAM_COLOR_PALETTES.length];
      (t.memberStudentIds || []).forEach((mId) => {
        if (mId) map.set(mId, { teamName: t.name, theme });
      });
    });
    return map;
  }, [teams]);

  // 학생 이름 기반 매핑 Map (ID 불일치 또는 미저장 슬롯의 통합학생정보 fallback)
  const studentsByNameMap = React.useMemo(() => {
    const map = new Map<string, MasterStudent>();
    studentsMap.forEach((s) => {
      if (s.name) map.set(s.name, s);
    });
    return map;
  }, [studentsMap]);

  // 드래그 앤 드롭 상태
  const [draggingSlotId, setDraggingSlotId] = useState<string | null>(null);
  const [dragOverSlotId, setDragOverSlotId] = useState<string | null>(null);

  // 칭찬 별 배지 클릭 말풍선 팝업 (Popover) 상태
  const [praisePopoverSlotId, setPraisePopoverSlotId] = useState<string | null>(null);

  // 컨테이너 너비 실시간 측정 (ResizeObserver)
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState<number>(() =>
    typeof window !== 'undefined' ? window.innerWidth : 1200
  );

  useEffect(() => {
    if (!containerRef.current) return;
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        if (entry.contentRect.width > 0) {
          setContainerWidth(entry.contentRect.width);
        }
      }
    });
    ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, []);

  // 화면 크기 및 분단 수에 따라 책상 카드 폭이 좁아졌을 때 사진을 자동 감춤 처리하여 겹침 및 이름 잘림(...)을 100% 원천 차단!
  // 대형 사진(74~82px) + 이름(4~5글자 75px) + 성별(20px) + 여백/패딩(20px) = 최소 185px 이상 확보되어야 이름이 절대 ...으로 잘리지 않고 여유롭게 수납됨.
  const canFitPhoto = React.useMemo(() => {
    if (config?.layoutType === 'ROW') {
      const divisionCount = config?.rowConfig?.divisionCount ?? 3;
      const totalCols = divisionCount * 2;
      const totalSpacing = (divisionCount - 1) * 14 + divisionCount * 24;
      const widthPerDesk = (containerWidth - totalSpacing) / totalCols;
      return widthPerDesk >= 185;
    }
    if (config?.layoutType === 'GROUP') {
      return containerWidth >= 900;
    }
    if (config?.layoutType === 'FREE') {
      const cols = config?.freeConfig?.gridCols ?? 6;
      return (containerWidth / cols) >= 185;
    }
    return true;
  }, [config?.layoutType, config?.rowConfig, config?.freeConfig, containerWidth]);

  const shouldShowPhoto = viewOptions.showPhoto && canFitPhoto;

  // 개별 슬롯 렌더러
  const renderDeskCard = (slot: DeskSlot, displayIndex: number) => {
    // 전체화면 모드에서는 화면 높이에 맞춰 100% 꽉 채우는 유동 높이 적용
    // 일반 모드에서는 어떤 디스플레이 크기에서든 양 옆 잘림 없이 100% 쏙 들어가도록 유동 너비 적용!
    // 화면 크기에 맞춘 반응형 카드 규격:
    // canFitPhoto = false (화면이 좁을 때)에는 사진을 감추고 카드 폭과 높이를 컴팩트하게 줄여 겹침과 이름 잘림을 원천 차단!
    // canFitPhoto = true (화면이 충분히 넓을 때)에는 빨간 동그라미 규격의 대형 사진(74~82px)과 함께 시원한 크기 적용!
    const cardSizeClass = isFullscreen
      ? shouldShowPhoto
        ? 'w-full max-w-[260px] h-full flex-1 min-w-0 min-h-[70px] lg:min-h-[88px] max-h-[130px]'
        : 'w-full max-w-[190px] h-full flex-1 min-w-0 min-h-[52px] max-h-[90px]'
      : shouldShowPhoto
      ? 'w-full flex-1 min-w-0 max-w-[260px] h-[84px] sm:h-[92px] lg:h-[98px]'
      : 'w-full flex-1 min-w-0 max-w-[170px] h-[52px] sm:h-[58px] lg:h-[62px]';

    if (!slot.isActive) {
      return (
        <div
          key={slot.id}
          className={`${cardSizeClass} invisible pointer-events-none`}
        />
      );
    }

    const isRevealed = revealedCount === undefined || displayIndex < revealedCount;
    const isCurrentMovingSource = movingSourceSlot?.id === slot.id;
    const isDragging = draggingSlotId === slot.id;
    const isDragOver = dragOverSlotId === slot.id;
    const isHighlighted = highlightedSlotIds?.has(slot.id);

    // 학생 정보 조회 (studentsMap 우선, fallback으로 이름 매칭)
    const student =
      (slot.studentId ? studentsMap.get(slot.studentId) : null) ||
      (slot.studentName ? studentsByNameMap.get(slot.studentName) : null);
    const photoUrl = student?.photoUrl || slot.studentPhotoUrl;

    // 통합학생정보(student.gender)를 최우선 단일진실공급원(SSOT)으로 성별 판정
    const currentGender = student?.gender || slot.studentGender;
    const isFemale = student
      ? isFemaleStudent(student)
      : (currentGender === 'Female' || currentGender === '여' || currentGender === '여자' || currentGender === 'F');
    const isMale = !isFemale;

    // 학급 관리 전용 커스텀 아바타 조회 (마스터 사진 보존)
    const customAvatar = classKey && slot.studentId ? getCustomAvatar(classKey, slot.studentId) : null;
    const praisePoints = slot.praisePoints || 0;
    const praiseTier = getPraiseTier(praisePoints, classKey);

    // 칭찬 별 배지 (클릭 시 말풍선 Popover 오픈)
    const renderPraiseBadge = (isCompact: boolean = false) => {
      if (!viewOptions.showPraise || !slot.studentId || !isRevealed) return null;

      return (
        <Popover
          open={praisePopoverSlotId === slot.id}
          onOpenChange={(open) => setPraisePopoverSlotId(open ? slot.id : null)}
        >
          <PopoverTrigger asChild>
            <button
              type="button"
              title={`칭찬 점수: ${praisePoints}점 (${praiseTier.name}) - 클릭하여 점수 추가`}
              onClick={(e) => {
                e.stopPropagation();
              }}
              className={`inline-flex items-center gap-0.5 px-1.5 py-0.2 sm:py-0.5 rounded-full ${
                isCompact ? 'text-[8px] sm:text-[9px]' : 'text-[8px] sm:text-[9px] lg:text-[10px]'
              } font-black border transition-all shrink-0 shadow-2xs hover:scale-105 active:scale-95 cursor-pointer ${praiseTier.badgeClass}`}
            >
              <span className="text-[9px] sm:text-[10px] leading-none select-none">{praiseTier.icon}</span>
              <span>{praisePoints}</span>
            </button>
          </PopoverTrigger>
          <PopoverContent
            side="top"
            align="end"
            sideOffset={6}
            onClick={(e) => e.stopPropagation()}
            className="w-auto p-2 bg-white/95 backdrop-blur-md border border-amber-200 shadow-xl rounded-xl z-50 flex flex-col gap-1.5"
          >
            <div className="flex items-center justify-between gap-3 border-b border-amber-100 pb-1">
              <span className="text-[11px] font-bold text-slate-700 flex items-center gap-1">
                <span>{praiseTier.icon}</span>
                <span>{slot.studentName} 칭찬 점수</span>
              </span>
              <span className="text-[10px] font-bold text-amber-600 bg-amber-50 px-1.5 py-0.2 rounded-full border border-amber-200">
                {praiseTier.name} ★ {praisePoints}점
              </span>
            </div>
            <div className="flex items-center gap-1">
              {[
                { pts: 1, label: '+1', color: 'bg-amber-400 hover:bg-amber-500 text-slate-900 border border-amber-500' },
                { pts: 2, label: '+2', color: 'bg-blue-500 hover:bg-blue-600 text-white' },
                { pts: 3, label: '+3', color: 'bg-emerald-500 hover:bg-emerald-600 text-white' },
                { pts: 5, label: '+5', color: 'bg-rose-500 hover:bg-rose-600 text-white' },
                { pts: -1, label: '-1', color: 'bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300' },
              ].map((btn) => (
                <button
                  key={btn.pts}
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (onQuickPraise) {
                      onQuickPraise(slot.id, btn.pts);
                    } else if (onPraiseChange) {
                      onPraiseChange(slot.id, btn.pts);
                    }
                    setPraisePopoverSlotId(null);
                  }}
                  className={`px-2 py-1 rounded-md text-[11px] font-bold shadow-xs transition-transform active:scale-90 ${btn.color}`}
                >
                  {btn.label}
                </button>
              ))}
            </div>
          </PopoverContent>
        </Popover>
      );
    };

    // 클릭 핸들러
    const handleClick = () => {
      if (movingSourceSlot) {
        if (movingSourceSlot.id === slot.id) {
          // 자기 자신을 다시 누르면 이동 취소
          onCancelMove();
        } else {
          // 다른 자리를 누르면 자리 이동 또는 맞바꿈 실행!
          onMoveOrSwap(movingSourceSlot.id, slot.id);
        }
      } else {
        onSlotClick(slot);
      }
    };

    // 팀 나누기 연동: 학생이 속한 팀이 있으면 같은 팀끼리 같은 색상 적용
    const studentTeamInfo = slot.studentId
      ? studentTeamMap.get(slot.studentId) || (slot.studentNum ? studentTeamMap.get(String(slot.studentNum)) : undefined)
      : undefined;

    return (
      <motion.div
        key={slot.id}
        role="button"
        tabIndex={0}
        whileHover={{ scale: 1.03, y: -2 }}
        whileTap={{ scale: 0.96, y: 1 }}
        transition={{ type: 'spring', stiffness: 500, damping: 20 }}
        draggable={Boolean(slot.studentId && !movingSourceSlot)}
        onDragStart={(e: any) => {
          if (!slot.studentId) return;
          e.dataTransfer.setData('text/plain', slot.id);
          e.dataTransfer.effectAllowed = 'move';
          setDraggingSlotId(slot.id);
        }}
        onDragEnd={() => {
          setDraggingSlotId(null);
          setDragOverSlotId(null);
        }}
        onDragOver={(e: any) => {
          e.preventDefault();
          e.dataTransfer.dropEffect = 'move';
          if (dragOverSlotId !== slot.id) {
            setDragOverSlotId(slot.id);
          }
        }}
        onDragLeave={() => {
          if (dragOverSlotId === slot.id) {
            setDragOverSlotId(null);
          }
        }}
        onDrop={(e: any) => {
          e.preventDefault();
          const sourceId = e.dataTransfer.getData('text/plain') || draggingSlotId;
          if (sourceId && sourceId !== slot.id) {
            onMoveOrSwap(sourceId, slot.id);
          }
          setDraggingSlotId(null);
          setDragOverSlotId(null);
        }}
        onClick={handleClick}
        onContextMenu={(e) => {
          if (slot.studentId || slot.studentName) {
            e.preventDefault();
            e.stopPropagation();
            setDetailSlot(slot);
          }
        }}
        onDoubleClick={(e) => {
          if (slot.studentId || slot.studentName) {
            e.preventDefault();
            e.stopPropagation();
            setDetailSlot(slot);
          }
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            handleClick();
          }
        }}
        className={`relative group ${cardSizeClass} rounded-xl sm:rounded-2xl lg:rounded-3xl border-2 transition-all px-1.5 py-1 sm:px-2 sm:py-1.5 flex items-center select-none cursor-pointer border-b-[3px] sm:border-b-4 ${
          isHighlighted
            ? 'ring-4 ring-amber-400 ring-offset-2 scale-105 bg-amber-100 border-[#C49832] border-b-[#8E6D21] shadow-xl z-30 animate-pulse'
            : isDragOver
            ? 'ring-4 ring-[#2471B2] ring-offset-2 scale-105 bg-blue-100 border-[#2471B2] border-b-[#1A5384] shadow-lg z-20'
            : isDragging
            ? 'opacity-40 scale-95 border-dashed border-[#2471B2] bg-blue-50/50'
            : isCurrentMovingSource
            ? 'ring-4 ring-[#C49832] ring-offset-2 scale-105 bg-amber-100 border-[#C49832] border-b-[#8E6D21] shadow-md animate-pulse z-20'
            : movingSourceSlot
            ? 'hover:ring-2 hover:ring-amber-400 bg-amber-50/90 border-amber-300 border-b-amber-400'
            : slot.isFixed
            ? 'border-[#C49832] bg-amber-50/90 border-b-[#8E6D21] shadow-xs'
            : slot.studentId
            ? studentTeamInfo
              ? `${studentTeamInfo.theme.border} ${studentTeamInfo.theme.bg} shadow-xs`
              : `${praiseTier.cardBorderClass} ${praiseTier.cardBgClass} shadow-xs`
            : 'border-dashed border-slate-300 bg-white/80 hover:bg-slate-100/90 hover:border-slate-400'
        }`}
      >
        {!isRevealed ? (
          /* 미공개 상태: 물음표 */
          <div className="flex-1 flex items-center justify-center animate-pulse">
            <span className="w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-slate-200 text-slate-500 font-black text-sm sm:text-base flex items-center justify-center">
              ?
            </span>
          </div>
        ) : !slot.studentName ? (
          /* 빈 자리 상태: + 자리지정 */
          <div className="flex-1 flex items-center justify-center text-center">
            <span className="text-[10px] sm:text-[11px] lg:text-xs text-slate-400 font-medium group-hover:text-slate-600 truncate">
              {movingSourceSlot ? '이동' : '+ 자리지정'}
            </span>
          </div>
        ) : !shouldShowPhoto ? (
          /* 사진 숨김 모드 (작은 화면): 상하 2단 Flex 구조로 겹침 100% 원천 차단 */
          <div className="w-full h-full flex flex-col justify-between py-1 px-1 sm:px-1.5 select-none">
            {/* 상단 1단: 우측 정렬된 [번호] [★ 별 배지(Popover)] [팀 배지] [고정 핀] */}
            <div className="w-full flex items-center justify-end gap-1 shrink-0 text-slate-500 leading-none">
              {slot.studentNum && (
                <span className="text-[9px] sm:text-[10px] font-mono font-bold shrink-0">
                  {slot.studentNum}번
                </span>
              )}
              {renderPraiseBadge(true)}
              {studentTeamInfo && slot.studentId && isRevealed && (
                <span
                  className={`text-[7px] sm:text-[8px] font-black px-1.5 py-0.2 rounded-full ${studentTeamInfo.theme.badge} text-white shrink-0 shadow-2xs truncate max-w-[42px] sm:max-w-[50px]`}
                  title={`${studentTeamInfo.teamName} 소속`}
                >
                  {studentTeamInfo.teamName.replace(/^[0-9]+모둠\s*/, '').replace(/[()]/g, '') || studentTeamInfo.teamName}
                </span>
              )}
              {slot.isFixed && (
                <span
                  title="사전 고정 좌석"
                  className="flex items-center text-[7px] text-orange-600 font-bold bg-orange-100/90 rounded px-1 py-0.2 gap-0.5 shrink-0"
                >
                  <Pin className="w-2 h-2 fill-orange-500 text-orange-600" />
                </span>
              )}
            </div>

            {/* 하단 2단: 중앙 정렬된 학생 성명 + 성별 배지 (겹침 0%) */}
            <div className="w-full flex items-center justify-center gap-1 min-w-0 pb-0.5">
              <span className={`font-black text-slate-900 tracking-tight whitespace-nowrap break-keep select-none ${
                (slot.studentName?.length || 0) >= 5
                  ? 'text-[clamp(11px,1.15vw,13px)]'
                  : (slot.studentName?.length || 0) >= 4
                  ? 'text-[clamp(12px,1.25vw,14px)]'
                  : 'text-[clamp(13px,1.4vw,16px)]'
              }`}>
                {slot.studentName}
              </span>
              {viewOptions.showGenderBadge && (student?.gender || slot.studentGender) && (
                <span
                  className={`text-[8px] sm:text-[9px] font-bold px-1 py-0.2 rounded-xs shrink-0 select-none ${
                    isFemale
                      ? 'bg-rose-100 text-rose-700 border border-rose-200'
                      : 'bg-blue-100 text-blue-700 border border-blue-200'
                  }`}
                >
                  {isFemale ? '여' : '남'}
                </span>
              )}
            </div>
          </div>
        ) : (
          /* 사진 표시 모드 (넓은 화면): 좌측 대형 사진 (빨간 원 크기) + 우측 상단 메타 정보 (우측 끝 밀착) + 중앙 학생 성명 */
          <div className="w-full h-full flex items-center min-w-0 relative">
            {/* 좌측 대형 사진: 화면이 충분히 넓을 때 (canFitPhoto=true) 빨간 동그라미 규격(68~82px)으로 확대 */}
            <div className="shrink-0 flex items-center justify-center pl-0.5">
              {customAvatar ? (
                <div
                  className={`w-[66px] h-[66px] sm:w-[74px] sm:h-[74px] lg:w-[80px] lg:h-[80px] rounded-full flex items-center justify-center text-3xl sm:text-4xl lg:text-5xl border-2 sm:border-[2.5px] shadow-sm select-none ${customAvatar.bgClass || 'bg-amber-100'} ${customAvatar.borderClass || 'border-amber-300'}`}
                  title={`학급 아바타: ${customAvatar.name || ''}`}
                >
                  <span className="select-none filter drop-shadow-xs">{customAvatar.emoji || '🦁'}</span>
                </div>
              ) : photoUrl ? (
                <img
                  src={photoUrl}
                  alt={slot.studentName}
                  className="w-[66px] h-[66px] sm:w-[74px] sm:h-[74px] lg:w-[80px] lg:h-[80px] rounded-full object-cover border-2 sm:border-[2.5px] border-amber-300 shadow-sm select-none"
                />
              ) : (
                <div
                  className={`w-[66px] h-[66px] sm:w-[74px] sm:h-[74px] lg:w-[80px] lg:h-[80px] rounded-full flex items-center justify-center font-black text-sm sm:text-base lg:text-lg border-2 sm:border-[2.5px] shadow-sm select-none ${
                    isFemale
                      ? 'bg-rose-100 text-rose-700 border-rose-200'
                      : 'bg-blue-100 text-blue-700 border border-blue-200'
                  }`}
                >
                  {slot.studentName.slice(-2)}
                </div>
              )}
            </div>

            {/* 우측 상단 메타 정보: 번호 + 별 배지(Popover) + 팀 배지 + 고정 핀 (우측 끝 밀착!) */}
            <div className="absolute top-1 sm:top-1.5 right-1 sm:right-2 flex items-center gap-1 z-10 select-none">
              {slot.studentNum && (
                <span className="text-[10px] sm:text-[11px] lg:text-xs font-mono text-slate-500 font-bold shrink-0">
                  {slot.studentNum}번
                </span>
              )}
              {renderPraiseBadge(false)}
              {studentTeamInfo && slot.studentId && isRevealed && (
                <span
                  className={`text-[7px] sm:text-[8px] font-black px-1.5 py-0.2 rounded-full ${studentTeamInfo.theme.badge} text-white shrink-0 shadow-2xs truncate max-w-[45px] sm:max-w-[58px]`}
                  title={`${studentTeamInfo.teamName} 소속`}
                >
                  {studentTeamInfo.teamName.replace(/^[0-9]+모둠\s*/, '').replace(/[()]/g, '') || studentTeamInfo.teamName}
                </span>
              )}
              {slot.isFixed && (
                <span
                  title="사전 고정 좌석"
                  className="flex items-center text-[8px] text-orange-600 font-bold bg-orange-100/90 rounded px-1 py-0.2 gap-0.5"
                >
                  <Pin className="w-2.5 h-2.5 fill-orange-500 text-orange-600" />
                </span>
              )}
            </div>

            {/* 중앙: 학생 성명 + 성별 배지 ("이름을 가운데 놓고") */}
            <div className="flex-1 min-w-0 flex items-center justify-center gap-1 sm:gap-1.5 select-none pl-2 pr-1 pt-3 sm:pt-4">
              <span className={`font-black text-slate-900 tracking-tight whitespace-nowrap break-keep select-none ${
                (slot.studentName?.length || 0) >= 5
                  ? 'text-[clamp(12px,1.2vw,15px)]'
                  : (slot.studentName?.length || 0) >= 4
                  ? 'text-[clamp(13px,1.35vw,17px)]'
                  : 'text-[clamp(14px,1.5vw,19px)]'
              }`}>
                {slot.studentName}
              </span>
              {viewOptions.showGenderBadge && (student?.gender || slot.studentGender) && (
                <span
                  className={`text-[8px] sm:text-[9px] lg:text-[10px] font-bold px-1 sm:px-1.5 py-0.2 rounded-xs shrink-0 select-none ${
                    isFemale
                      ? 'bg-rose-100 text-rose-700 border border-rose-200'
                      : 'bg-blue-100 text-blue-700 border border-blue-200'
                  }`}
                >
                  {isFemale ? '여' : '남'}
                </span>
              )}
            </div>
          </div>
        )}
      </motion.div>
    );
  };

  // ─── 1. 분단형 렌더링 (어떤 디스플레이 크기에서든 양 옆 잘림 없이 100% 유동 너비 분할) ───
  const renderRowLayout = () => {
    const divisionCount = config?.rowConfig?.divisionCount ?? 3;

    return (
      <div className={`w-full flex justify-center gap-1.5 sm:gap-2.5 lg:gap-3.5 overflow-hidden ${
        isFullscreen ? 'h-full flex-1 min-h-0 items-stretch py-0.5' : 'py-0.5 sm:py-1'
      }`}>
        {[...Array(divisionCount)].map((_, divIdx) => {
          const divNum = divIdx + 1;
          const divSlots = slots.filter((s) => s.groupId === divNum);
          const rowsInDiv = Array.from(new Set(divSlots.map((s) => s.row))).sort(
            (a, b) => a - b
          );

          return (
            <div
              key={divNum}
              className={`flex-1 min-w-0 max-w-[460px] flex flex-col items-center ${
                isFullscreen ? 'h-full' : ''
              }`}
            >
              <Badge
                className="bg-[#2471B2] text-white font-black text-[10px] sm:text-[11px] lg:text-xs px-2 sm:px-2.5 py-0.5 rounded-full border-b border-[#1A5384] shadow-xs select-none whitespace-nowrap shrink-0 mb-1"
              >
                {divNum}분단
              </Badge>
              <div
                className={`w-full rounded-xl sm:rounded-2xl bg-slate-50/80 border-2 border-slate-200/80 shadow-inner ${
                  isFullscreen
                    ? 'flex-1 min-h-0 flex flex-col justify-between p-1 sm:p-1.5 gap-1'
                    : 'flex flex-col gap-1 p-1 sm:p-1.5 lg:p-2'
                }`}
              >
                {rowsInDiv.map((r) => {
                  const rowSlots = divSlots
                    .filter((s) => s.row === r)
                    .sort((a, b) => a.col - b.col);
                  return (
                    <div
                      key={r}
                      className={`w-full flex items-center justify-center gap-1 sm:gap-1.5 ${
                        isFullscreen ? 'flex-1 min-h-0' : ''
                      }`}
                    >
                      {rowSlots.map((slot) => {
                        const originalIdx = slots.findIndex((s) => s.id === slot.id);
                        return renderDeskCard(slot, originalIdx);
                      })}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  // ─── 2. 모둠형 렌더링 (그리드 반응형 & 유동 축소) ───
  const renderGroupLayout = () => {
    const groupIds = Array.from(
      new Set(slots.filter((s) => s.groupId !== undefined).map((s) => s.groupId as number))
    ).sort((a, b) => a - b);

    return (
      <div className={`w-full grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-1.5 sm:gap-2.5 lg:gap-3.5 justify-items-center ${
        isFullscreen ? 'h-full flex-1 min-h-0 overflow-hidden py-0.5' : 'py-1'
      }`}>
        {groupIds.map((gId) => {
          const groupSlots = slots.filter((s) => s.groupId === gId);
          return (
            <div
              key={gId}
              className={`flex flex-col items-center rounded-xl sm:rounded-2xl bg-slate-50/80 border-2 border-slate-200/80 shadow-inner w-full min-w-0 max-w-[460px] ${
                isFullscreen
                  ? 'h-full flex-1 min-h-0 justify-between p-1 sm:p-1.5'
                  : 'gap-1 p-1.5 sm:p-2 lg:p-2.5'
              }`}
            >
              <Badge
                className="bg-[#C49832] text-white font-black text-[10px] sm:text-[11px] lg:text-xs px-2 sm:px-2.5 py-0.5 rounded-full border-b border-[#8E6D21] shadow-xs select-none whitespace-nowrap shrink-0 mb-1"
              >
                {gId}모둠
              </Badge>
              <div className={`grid grid-cols-2 gap-1 w-full min-w-0 ${isFullscreen ? 'flex-1 min-h-0' : ''}`}>
                {groupSlots.map((slot) => {
                  const originalIdx = slots.findIndex((s) => s.id === slot.id);
                  return renderDeskCard(slot, originalIdx);
                })}
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  // ─── 3. 자유형 렌더링 ───
  const renderFreeLayout = () => {
    const gridRows = config?.freeConfig?.gridRows ?? 5;
    const gridCols = config?.freeConfig?.gridCols ?? 6;
    return (
      <div className={`flex justify-center overflow-x-auto no-scrollbar w-full ${isFullscreen ? 'h-full flex-1 min-h-0' : 'py-1'}`}>
        <div
          className={`grid gap-1 rounded-xl sm:rounded-2xl bg-slate-50/80 border-2 border-slate-200/80 shadow-inner ${
            isFullscreen ? 'w-full h-full flex-1 min-h-0 p-1.5 sm:p-2' : 'p-1.5 sm:p-2'
          }`}
          style={{
            gridTemplateColumns: `repeat(${gridCols}, minmax(0, 1fr))`,
          }}
        >
          {slots.map((slot, idx) => renderDeskCard(slot, idx))}
        </div>
      </div>
    );
  };

  return (
    <div
      ref={containerRef}
      className={`w-full overflow-hidden ${
        isFullscreen
          ? 'h-full flex-1 min-h-0 flex flex-col items-center justify-between gap-1'
          : 'flex flex-col items-center gap-1.5 sm:gap-2'
      }`}
    >
      {/* ─── 상단 칠판(교탁) 영역 (학교 공식 블루 #2471B2 테마 듀오링고 스타일) ─── */}
      <div className="shrink-0 w-full max-w-2xl bg-[#2471B2] text-white rounded-xl sm:rounded-2xl py-1 sm:py-1.5 px-4 sm:px-6 shadow-sm border-b-[3px] border-[#1A5384] flex items-center justify-between text-xs sm:text-sm font-black tracking-widest select-none whitespace-nowrap break-keep">
        <span className="text-[9px] sm:text-[10px] text-blue-200 font-bold">[ 앞 ]</span>
        <span className="text-xs sm:text-sm lg:text-base font-black text-white tracking-widest">칠 판</span>
        <span className="text-[9px] sm:text-[10px] text-blue-200 font-bold">[ 교탁 ]</span>
      </div>

      {/* ─── 대형 유형별 좌석 그리드 (전체 너비 100% 수용 및 양 옆 잘림 방지) ─── */}
      <div className={`w-full overflow-hidden flex justify-center ${isFullscreen ? 'flex-1 min-h-0 items-stretch' : ''}`}>
        {config.layoutType === 'ROW' && renderRowLayout()}
        {config.layoutType === 'GROUP' && renderGroupLayout()}
        {config.layoutType === 'FREE' && renderFreeLayout()}
      </div>

      {/* ─── 우클릭 학생 상세 정보 및 수업·학급 관리 모달 ─── */}
      <StudentDetailModal
        isOpen={Boolean(detailSlot)}
        onOpenChange={(open) => !open && setDetailSlot(null)}
        targetSlot={detailSlot ? slots.find((s) => s.id === detailSlot.id) || detailSlot : null}
        student={
          (detailSlot?.studentId ? studentsMap.get(detailSlot.studentId) : null) ||
          (detailSlot?.studentName ? studentsByNameMap.get(detailSlot.studentName) : null) ||
          null
        }
        classKey={classKey || ''}
        classLabel={classLabel}
        isFullscreen={isFullscreen}
        onPraiseChange={onPraiseChange || onQuickPraise}
        studentTeamInfo={
          detailSlot?.studentId
            ? studentTeamMap.get(detailSlot.studentId) ||
              (detailSlot.studentNum ? studentTeamMap.get(String(detailSlot.studentNum)) : undefined)
            : undefined
        }
      />
    </div>
  );
};
