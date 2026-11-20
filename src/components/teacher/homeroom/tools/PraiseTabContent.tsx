'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
  Trophy,
  Sparkles,
  Plus,
  Minus,
  Star,
  RotateCcw,
  Heart,
  Crown,
  Award,
  Settings,
  Sliders,
  Check,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Badge } from '@/components/ui/badge';
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from '@/components/ui/popover';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import type { MasterStudent } from '@/lib/types/masterStudent';
import type { DeskSlot } from '@/lib/types/seating';
import { getPraiseTier, DEFAULT_SEATING_CONFIG } from '@/lib/types/seating';
import { PraiseGaugeBar } from '../seating/PraiseGaugeBar';
import { PraiseModal } from '../seating/PraiseModal';
import { PraisePromotionModal } from '../seating/promotion/PraisePromotionModal';
import { getSeatingPlans, saveSeatingPlan } from '@/lib/services/seatingService';
import type { PraiseWidgetViewMode, PraiseWidgetConfig } from '../seating/SeatingPraiseWidget';
import { DEFAULT_PRAISE_WIDGET_CONFIG } from '../seating/SeatingPraiseWidget';
import { SeatingDisplayToggles, useSeatingDisplayPrefs } from '../seating/SeatingDisplayToggles';
import { usePraisePoints, changePraisePoints, resetPraisePoints } from '@/lib/services/classPraiseStore';

export interface PraiseTabContentProps {
  classKey: string;
  classLabel: string;
  students: MasterStudent[];
  userEmail?: string;
  isFullscreen?: boolean;
}

export const PraiseTabContent: React.FC<PraiseTabContentProps> = ({
  classKey,
  classLabel,
  students,
  userEmail,
  isFullscreen = false,
}) => {
  const { toast } = useToast();
  // 자리 배치도의 칭찬 현황 바 / 책상 칭찬 등급 배지 표시
  const [seatingPrefs, setSeatingPrefs] = useSeatingDisplayPrefs(classKey);

  // 학생별 칭찬 점수 맵 (studentId -> praisePoints)
  // 학생별 칭찬 점수 — 자리 배치도와 같은 단일 저장소(서버 동기화)
  const studentPraiseMap = usePraisePoints(classKey);
  // 목표 점수 (기본 50점)
  const [targetGoal, setTargetGoal] = useState<number>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem(`kis_praise_target_goal_${classKey}`);
        if (saved) return Number(saved) || 50;
      } catch (e) {}
    }
    return 50;
  });

  // 자리배치도 칭찬 위젯 기본 설정 상태
  const [widgetConfig, setWidgetConfig] = useState<PraiseWidgetConfig>(() => {
    if (typeof window !== 'undefined' && classKey) {
      try {
        const saved = localStorage.getItem(`kis_praise_widget_config_${classKey}`);
        if (saved) return { ...DEFAULT_PRAISE_WIDGET_CONFIG, ...JSON.parse(saved) };
      } catch {}
    }
    return DEFAULT_PRAISE_WIDGET_CONFIG;
  });

  const handleUpdateWidgetConfig = (newCfg: Partial<PraiseWidgetConfig>) => {
    const updated = { ...widgetConfig, ...newCfg };
    setWidgetConfig(updated);
    if (typeof window !== 'undefined' && classKey) {
      localStorage.setItem(`kis_praise_widget_config_${classKey}`, JSON.stringify(updated));
      window.dispatchEvent(new Event('kis_praise_widget_config_updated'));
    }
    toast({
      title: '자리배치도 칭찬 위젯 설정 저장',
      description: '자리 배치도에서 표시될 기본 칭찬 현황 설정이 변경되었습니다.',
    });
  };

  // 칭찬 모달 상태
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState<MasterStudent | null>(null);
  // 학생별 배치도 분단/모둠 번호 맵 및 배치도 설정
  const [studentGroupMap, setStudentGroupMap] = useState<Record<string, number>>({});
  const [seatingConfig, setSeatingConfig] = useState(DEFAULT_SEATING_CONFIG);

  // 로컬스토리지 및 배치도 데이터 동기화
  useEffect(() => {
    if (!classKey) return;

    // 2. 배치도 슬롯 데이터 동기화
    getSeatingPlans(classKey).then((plans) => {
      if (plans.length > 0) {
        const latest = plans[0];
        if (latest.config) {
          setSeatingConfig(latest.config);
        }
        if (latest.praiseTargetGoal) {
          setTargetGoal(latest.praiseTargetGoal);
        }
        const gMap: Record<string, number> = {};
        latest.slots.forEach((slot) => {
          if (slot.studentId) {
            if (slot.groupId) gMap[slot.studentId] = slot.groupId;
          }
        });
        setStudentGroupMap(gMap);
      }
    });
  }, [classKey, students]);

  // 가상 슬롯 목록 (PraiseGaugeBar와 호환용)
  const virtualSlots: DeskSlot[] = useMemo(() => {
    return students.map((s, idx) => {
      const sid = s.studentId || s.id || '';
      const points = studentPraiseMap[sid] || 0;
      const gId = (sid && studentGroupMap[sid]) || ((idx % 3) + 1);
      return {
        id: `slot_${sid || idx}`,
        col: 0,
        row: 0,
        groupId: gId,
        studentId: sid,
        studentName: s.name,
        studentNum: s.studentNum || null,
        studentGender: s.gender || null,
        studentPhotoUrl: s.photoUrl || null,
        praisePoints: points,
        isFixed: false,
        isActive: true,
      };
    });
  }, [students, studentPraiseMap, studentGroupMap]);

  // 칭찬 목표 점수 수정
  const handleChangeTargetGoal = (newGoal: number) => {
    setTargetGoal(newGoal);
    try {
      localStorage.setItem(`kis_praise_target_goal_${classKey}`, String(newGoal));
    } catch (e) {}
    toast({
      title: '칭찬 목표 점수 설정',
      description: `오늘의 칭찬 목표 점수가 ${newGoal}점으로 설정되었습니다.`,
    });
  };

  // 칭찬 점수 증감 (delta) — 늘어난 점수는 포인트 통장에도 적립 및 등급 승급 시 순차 축하 팝업 표출
  const handlePraiseChange = (studentId: string, delta: number) => {
    const st = students.find((x) => (x.studentId || x.id) === studentId);
    changePraisePoints(classKey, studentId, st?.name || '학생', delta, {
      studentNum: st?.studentNum || null,
      gender: st?.gender || null,
      photoUrl: st?.photoUrl || null,
    });
  };

  // 칭찬 점수 0점 초기화 (개별)
  const handlePraiseReset = (studentId: string) => {
    resetPraisePoints(classKey, [studentId]);
  };

  // 학급 전체 칭찬 초기화
  const handleResetAllPraise = () => {
    if (confirm('학급 전체 학생의 칭찬 점수를 0점으로 초기화하시겠습니까?')) {
      resetPraisePoints(
        classKey,
        Array.from(
          new Set([...students.map((x) => x.studentId || x.id || ''), ...Object.keys(studentPraiseMap)])
        ).filter(Boolean)
      );
      toast({
        title: '칭찬 초기화 완료',
        description: '모든 학생의 칭찬 점수가 0점으로 초기화되었습니다.',
      });
    }
  };

  // 카드 클릭 시 칭찬 모달 열기
  const handleCardClick = (student: MasterStudent) => {
    setSelectedStudent(student);
    setIsModalOpen(true);
  };

  const selectedSlot: DeskSlot | null = useMemo(() => {
    if (!selectedStudent) return null;
    const sid = selectedStudent.studentId || selectedStudent.id || '';
    return {
      id: sid,
      col: 0,
      row: 0,
      divisionIndex: 0,
      rowIndex: 0,
      deskIndex: 0,
      studentId: sid,
      studentName: selectedStudent.name,
      studentNum: selectedStudent.studentNum || null,
      studentGender: selectedStudent.gender || null,
      studentPhotoUrl: selectedStudent.photoUrl || null,
      praisePoints: studentPraiseMap[sid] || 0,
      isFixed: false,
      isActive: true,
    };
  }, [selectedStudent, studentPraiseMap]);

  // 성장 티어 체계 갱신 트리거
  const [tierVer, setTierVer] = useState(0);
  useEffect(() => {
    const handleUpdate = () => setTierVer((v) => v + 1);
    window.addEventListener('class-praise-tiers-updated', handleUpdate);
    return () => window.removeEventListener('class-praise-tiers-updated', handleUpdate);
  }, []);

  return (
    <div className={`w-full font-sans ${isFullscreen ? 'space-y-5' : 'space-y-4'}`}>
      {/* ─── 상단: 우리 반 칭찬 온도계 (목표 점수 및 듀오링고 3D 골드 게이지 바) ─── */}
      <PraiseGaugeBar
        slots={virtualSlots}
        config={seatingConfig}
        classKey={classKey}
        targetGoal={targetGoal}
        onChangeTargetGoal={handleChangeTargetGoal}
        onResetPraise={handleResetAllPraise}
        extraActions={
          <>
            <SeatingDisplayToggles
              tone="amber"
              bar={seatingPrefs.praiseBar}
              cards={seatingPrefs.praiseCards}
              onBarChange={(v) => setSeatingPrefs({ praiseBar: v })}
              onCardsChange={(v) => setSeatingPrefs({ praiseCards: v })}
              cardsLabel="책상 등급"
              cardsTitle="자리 배치도의 책상마다 칭찬 등급 배지를 표시합니다"
            />
            {/* 자리배치도 칭찬 위젯 기본 설정 팝오버 */}
            <Popover>
              <PopoverTrigger asChild>
                <button
                  type="button"
                  className="flex items-center gap-1.5 h-8 px-2.5 rounded-2xl text-xs font-bold bg-white hover:bg-slate-50 text-slate-700 border-2 border-slate-200/90 shadow-2xs transition-all cursor-pointer whitespace-nowrap shrink-0"
                  title="자리 배치도 화면에 표시될 칭찬 현황 위젯의 기본값(학급/분단/팀, 열림 여부)을 설정합니다."
                >
                  <Sliders className="w-3.5 h-3.5 text-slate-600" />
                  <span>자리배치도 위젯 설정</span>
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-80 p-4 bg-white shadow-xl rounded-2xl border border-slate-200 z-[100000]">
                <div className="space-y-3">
                  <div className="flex items-center gap-1.5 pb-2 border-b border-slate-100">
                    <Sliders className="w-4 h-4 text-amber-600" />
                    <span className="text-sm font-black text-slate-900">
                      자리배치도 칭찬 위젯 기본 설정
                    </span>
                  </div>
                  <div className="space-y-2 text-xs">
                    <div>
                      <label className="font-bold text-slate-700 block mb-1">
                        기본 표시 칭찬 현황
                      </label>
                      <Select
                        value={widgetConfig.defaultMode}
                        onValueChange={(val: PraiseWidgetViewMode) =>
                          handleUpdateWidgetConfig({ defaultMode: val })
                        }
                      >
                        <SelectTrigger className="h-8 text-xs font-bold bg-slate-50 border-slate-200">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="z-[100000]">
                          <SelectItem value="ALL" className="text-xs font-bold">
                            학급 전체 칭찬
                          </SelectItem>
                          <SelectItem value="DIVISION" className="text-xs font-bold">
                            분단별 칭찬
                          </SelectItem>
                          <SelectItem value="GROUP" className="text-xs font-bold">
                            모둠·팀별 칭찬
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <label className="font-bold text-slate-700 block mb-1">
                        자리배치도 진입 시 위젯 기본 상태
                      </label>
                      <Select
                        value={widgetConfig.defaultOpen ? 'open' : 'closed'}
                        onValueChange={(val: string) =>
                          handleUpdateWidgetConfig({ defaultOpen: val === 'open' })
                        }
                      >
                        <SelectTrigger className="h-8 text-xs font-bold bg-slate-50 border-slate-200">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="z-[100000]">
                          <SelectItem value="closed" className="text-xs font-bold">
                            기본 접힘 (한 줄 요약 바)
                          </SelectItem>
                          <SelectItem value="open" className="text-xs font-bold">
                            기본 펼침 (상세 카드 그리드 노출)
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <p className="text-[11px] text-slate-400 pt-1">
                      💡 여기서 선택한 설정이 [자리 배치] 화면의 칭찬 위젯에 디폴트로 자동 적용됩니다.
                    </p>
                  </div>
                </div>
              </PopoverContent>
            </Popover>
          </>
        }
      />

      {/* ─── 본문: 학생 칭찬 도장/스탬프 카드 그리드 (10개 모일 때마다 색상 변화) ─── */}
      <div className="bg-white/95 rounded-3xl p-4 sm:p-6 border-2 border-slate-200/90 shadow-sm">
        <div className="flex items-center justify-between mb-4 px-1 flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <Trophy className="w-5 h-5 text-[#C49832]" />
            <h3 className="text-base sm:text-lg font-black text-slate-900 tracking-tight">
              학생별 칭찬 도장판 ({students.length}명)
            </h3>
            <Badge className="bg-amber-100 text-amber-900 text-xs font-bold border-amber-300">
              성장 등급 체계 연동
            </Badge>
          </div>

          <span className="text-xs text-slate-400 hidden sm:inline font-medium">
            💡 카드를 누르면 상세 칭찬을 줄 수 있고, 우측 [+1] 버튼을 누르면 원터치 칭찬이 부여됩니다.
          </span>
        </div>

        {students.length === 0 ? (
          <div className="text-center py-12 text-slate-400">
            <Sparkles className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm font-bold">등록된 학생이 없습니다.</p>
          </div>
        ) : (
          <div
            className={`grid ${
              isFullscreen
                ? 'grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-3 sm:gap-4'
                : 'grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2.5 sm:gap-3'
            }`}
          >
            {students.map((s) => {
              const sid = s.studentId || s.id || '';
              const praise = studentPraiseMap[sid] || 0;
              const tier = getPraiseTier(praise, classKey);

              return (
                <motion.div
                  key={sid}
                  whileHover={{ scale: 1.03, y: -2 }}
                  whileTap={{ scale: 0.96, y: 1 }}
                  transition={{ type: 'spring', stiffness: 500, damping: 22 }}
                  onClick={() => handleCardClick(s)}
                  className={`p-3.5 sm:p-4 rounded-2xl border-2 transition-all cursor-pointer select-none relative overflow-hidden shadow-xs border-b-4 ${tier.cardBgClass} ${tier.cardBorderClass}`}
                >
                  {/* 상단: 번호 및 보석 티어 배지 */}
                  <div className="flex items-center justify-between gap-1 mb-2">
                    <span className="text-xs font-bold text-slate-500">
                      {s.studentNum ? `${s.studentNum}번` : ''}
                    </span>
                    <Badge className={`text-[10px] px-1.5 py-0 h-4 border-0 ${tier.badgeClass}`}>
                      {tier.name}
                    </Badge>
                  </div>

                  {/* 중앙: 학생 사진(또는 이니셜)과 이름 */}
                  <div className="flex flex-col items-center justify-center my-1 text-center">
                    {s.photoUrl ? (
                      <img
                        src={s.photoUrl}
                        alt={s.name}
                        className="w-12 h-12 sm:w-14 sm:h-14 rounded-full object-cover border-2 border-white shadow-sm mb-1.5"
                      />
                    ) : (
                      <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-full bg-slate-200 text-slate-700 flex items-center justify-center font-black text-sm mb-1.5 shadow-inner">
                        {s.name.slice(-2)}
                      </div>
                    )}
                    <span className="text-sm sm:text-base font-black text-slate-900 tracking-tight truncate max-w-full">
                      {s.name}
                    </span>
                  </div>

                  {/* 하단: 칭찬 점수 및 +1 원터치 햅틱 버튼 */}
                  <div className="flex items-center justify-between gap-1.5 mt-2 pt-2 border-t border-slate-200/60">
                    <div className="flex items-center gap-1 font-black text-xs sm:text-sm">
                      <Star className={`w-4 h-4 ${tier.starClass}`} />
                      <span className={tier.textColor}>{praise}개</span>
                    </div>

                    <motion.button
                      type="button"
                      whileHover={{ scale: 1.15 }}
                      whileTap={{ scale: 0.85 }}
                      onClick={(e) => {
                        e.stopPropagation();
                        handlePraiseChange(sid, 1);
                        toast({
                          title: `칭찬 도장 +1`,
                          description: `${s.name} 학생에게 칭찬이 부여되었습니다! (현재 ${praise + 1}개)`,
                        });
                      }}
                      className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-[#C49832] hover:bg-[#B0872A] text-white flex items-center justify-center font-black text-xs shadow-md border-b-2 border-[#8E6D21] active:translate-y-0.5 cursor-pointer"
                      title="원터치 칭찬 +1"
                    >
                      +1
                    </motion.button>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>

      {/* ─── 칭찬 상세 모달 (PraiseModal) ─── */}
      <PraiseModal
        isOpen={isModalOpen}
        onOpenChange={setIsModalOpen}
        targetSlot={selectedSlot}
        student={selectedStudent}
        classKey={classKey}
        onPraiseChange={(slotId, delta) => {
          if (selectedStudent) {
            const sid = selectedStudent.studentId || selectedStudent.id || '';
            handlePraiseChange(sid, delta);
          }
        }}
        onPraiseReset={(slotId) => {
          if (selectedStudent) {
            const sid = selectedStudent.studentId || selectedStudent.id || '';
            handlePraiseReset(sid);
          }
        }}
        onToggleFixed={() => {}}
        onStartMove={() => {}}
        onClearSeat={() => {}}
      />

      {/* ─── 칭찬 성장 등급 승급 축하 순차 팝업 모달 ─── */}
      <PraisePromotionModal classKey={classKey} />
    </div>
  );
};
