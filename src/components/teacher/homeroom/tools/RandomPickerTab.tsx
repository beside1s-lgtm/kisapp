'use client';

import React, { useState, useEffect } from 'react';
import {
  Sparkles,
  Dice5,
  RotateCcw,
  Star,
  Users,
  Check,
  Award,
  Volume2,
  HelpCircle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { motion, AnimatePresence } from 'framer-motion';
import { useToast } from '@/hooks/use-toast';
import type { MasterStudent } from '@/lib/types/masterStudent';
import { isMaleStudent, isFemaleStudent } from '@/lib/services/seatingService';

interface RandomPickerTabProps {
  students: MasterStudent[];
  classLabel: string;
  isFullscreen?: boolean;
  onGrantPraise?: (studentId: string, delta: number) => void;
}

export const RandomPickerTab: React.FC<RandomPickerTabProps> = ({
  students,
  classLabel,
  isFullscreen = false,
  onGrantPraise,
}) => {
  const { toast } = useToast();

  // 뽑을 인원수 (1 ~ 12명)
  const [pickCount, setPickCount] = useState<number>(1);

  // 옵션들
  const [avoidPrevious, setAvoidPrevious] = useState<boolean>(true); // 이전 당첨자 제외
  const [genderBalance, setGenderBalance] = useState<boolean>(false); // 남녀 균등

  // 당첨 이력 및 현재 당첨된 학생 목록
  const [pickedHistory, setPickedHistory] = useState<string[]>([]); // studentIds
  const [currentWinners, setCurrentWinners] = useState<MasterStudent[]>([]);

  // 롤링 셔플 애니메이션 상태
  const [isRolling, setIsRolling] = useState<boolean>(false);
  const [displayCandidates, setDisplayCandidates] = useState<string[]>([]);

  // 칭찬 완료된 학생 추적
  const [praisedStudentIds, setPraisedStudentIds] = useState<Set<string>>(new Set());

  // 후보 학생 풀 계산 (제외 옵션 반영)
  const candidatePool = students.filter((s) => {
    const sid = s.studentId || s.id || '';
    if (avoidPrevious && pickedHistory.includes(sid)) return false;
    return true;
  });

  // 뽑기 실행
  const handleRoll = () => {
    if (candidatePool.length === 0) {
      toast({
        title: '뽑을 수 있는 학생이 없습니다',
        description: '모든 학생이 이미 뽑혔거나 대상 학생이 없습니다. 이력을 초기화해주세요.',
        variant: 'destructive',
      });
      return;
    }

    const targetCount = Math.min(pickCount, candidatePool.length);
    setIsRolling(true);
    setCurrentWinners([]);
    setPraisedStudentIds(new Set());

    // 롤링 애니메이션 (0.9초 동안 이름이 빠르게 회전)
    let rollTicks = 0;
    const interval = setInterval(() => {
      rollTicks++;
      const randomNames = Array.from({ length: targetCount }, () => {
        const rand = candidatePool[Math.floor(Math.random() * candidatePool.length)];
        return rand?.name || '';
      });
      setDisplayCandidates(randomNames);

      if (rollTicks >= 12) {
        clearInterval(interval);
        finalizePick(targetCount);
      }
    }, 75);
  };

  // 최종 당첨자 산출
  const finalizePick = (targetCount: number) => {
    let pool = [...candidatePool];
    let winners: MasterStudent[] = [];

    if (genderBalance && targetCount > 1) {
      // 남녀 균등 선발
      const boys = pool.filter(isMaleStudent);
      const girls = pool.filter(isFemaleStudent);

      const half = Math.floor(targetCount / 2);
      const shuffledBoys = [...boys].sort(() => Math.random() - 0.5);
      const shuffledGirls = [...girls].sort(() => Math.random() - 0.5);

      const pickedBoys = shuffledBoys.slice(0, half);
      const pickedGirls = shuffledGirls.slice(0, targetCount - pickedBoys.length);
      winners = [...pickedBoys, ...pickedGirls].sort(() => Math.random() - 0.5);
    } else {
      // 순수 무작위 선발
      const shuffled = [...pool].sort(() => Math.random() - 0.5);
      winners = shuffled.slice(0, targetCount);
    }

    setCurrentWinners(winners);
    setIsRolling(false);

    // 당첨 이력 갱신
    const winnerIds = winners.map((w) => w.studentId || w.id || '');
    setPickedHistory((prev) => [...prev, ...winnerIds]);

    toast({
      title: '🎉 발표자 추첨 완료!',
      description: `${winners.map((w) => w.name).join(', ')} 학생이 선정되었습니다!`,
    });
  };

  // 칭찬 포인트 부여
  const handlePraiseWinner = (student: MasterStudent) => {
    const sid = student.studentId || student.id || '';
    if (!sid) return;

    if (onGrantPraise) {
      onGrantPraise(sid, 1);
    }
    setPraisedStudentIds((prev) => new Set(prev).add(sid));

    toast({
      title: '칭찬 포인트 지급 완료',
      description: `${student.name} 학생에게 칭찬 1점이 부여되었습니다!`,
    });
  };

  // 이력 리셋
  const handleResetHistory = () => {
    setPickedHistory([]);
    setCurrentWinners([]);
    setPraisedStudentIds(new Set());
    toast({
      title: '추첨 이력 초기화 완료',
      description: '모든 학생이 다시 추첨 대상에 포함됩니다.',
    });
  };

  return (
    <div className={`w-full font-sans ${isFullscreen ? 'space-y-6' : 'space-y-5'}`}>
      {/* ─── 상단 설정 패널 (듀오링고 스타일 인원수 선택 칩) ─── */}
      <div className="p-4 sm:p-5 rounded-3xl bg-white border-2 border-slate-200/90 shadow-sm space-y-4">
        {/* 인원수 선택 */}
        <div>
          <div className="flex items-center justify-between mb-2.5 flex-wrap gap-2">
            <label className="text-xs sm:text-sm font-black text-slate-800 flex items-center gap-1.5 whitespace-nowrap break-keep">
              <Dice5 className="w-4 h-4 text-[#2471B2]" />
              <span>뽑을 인원수 선택:</span>
              <strong className="text-[#2471B2] font-mono text-base ml-1">
                {pickCount}명
              </strong>
            </label>
            <span className="text-xs text-slate-500 font-bold whitespace-nowrap">
              추첨 가능 대상: <strong className="text-slate-900">{candidatePool.length}명</strong> / 총 {students.length}명
            </span>
          </div>

          {/* 1 ~ 12명 듀오링고 3D 퀵 선택 칩 버튼들 */}
          <div className="grid grid-cols-6 sm:grid-cols-12 gap-1.5 sm:gap-2">
            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((num) => (
              <motion.button
                key={num}
                type="button"
                whileHover={{ scale: 1.05, y: -2 }}
                whileTap={{ scale: 0.95, y: 1 }}
                transition={{ type: 'spring', stiffness: 500, damping: 20 }}
                onClick={() => setPickCount(num)}
                className={`h-10 rounded-2xl font-black text-xs sm:text-sm transition-all border-b-4 select-none whitespace-nowrap ${
                  pickCount === num
                    ? 'bg-[#2471B2] text-white border-[#1A5384] shadow-sm'
                    : 'bg-slate-100 hover:bg-slate-200/80 text-slate-700 border-slate-300'
                }`}
              >
                {num}명
              </motion.button>
            ))}
          </div>
        </div>

        {/* 세부 옵션 체크박스 */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t-2 border-slate-100">
          <div className="flex flex-wrap items-center gap-4">
            <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-slate-700 select-none whitespace-nowrap">
              <input
                type="checkbox"
                checked={avoidPrevious}
                onChange={(e) => setAvoidPrevious(e.target.checked)}
                className="w-4 h-4 rounded text-[#2471B2] focus:ring-[#2471B2]"
              />
              <span>이미 뽑힌 학생 제외하기 (중복 방지)</span>
              {pickedHistory.length > 0 && (
                <Badge variant="outline" className="text-[10px] text-slate-400 font-mono rounded-full">
                  {pickedHistory.length}명 제외 중
                </Badge>
              )}
            </label>

            {pickCount > 1 && (
              <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-slate-700 select-none whitespace-nowrap">
                <input
                  type="checkbox"
                  checked={genderBalance}
                  onChange={(e) => setGenderBalance(e.target.checked)}
                  className="w-4 h-4 rounded text-[#2471B2] focus:ring-[#2471B2]"
                />
                <span>남녀 성별 균등 배분</span>
              </label>
            )}
          </div>

          {pickedHistory.length > 0 && (
            <motion.button
              type="button"
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.95 }}
              onClick={handleResetHistory}
              className="flex items-center gap-1.5 h-8 px-3 rounded-xl text-xs font-bold text-[#B01E23] hover:bg-rose-50 border border-rose-200 transition-all select-none whitespace-nowrap"
            >
              <RotateCcw className="w-3 h-3 text-[#B01E23]" />
              <span>이력 초기화</span>
            </motion.button>
          )}
        </div>
      </div>

      {/* ─── 뽑기 실행 메가 버튼 (학교 골드 #C49832 테마 듀오링고 3D 모션) ─── */}
      <div className="flex flex-col items-center justify-center p-6 sm:p-10 rounded-3xl bg-gradient-to-b from-blue-50/50 via-amber-50/30 to-transparent border-2 border-dashed border-[#2471B2]/30">
        <motion.button
          type="button"
          whileHover={{ scale: 1.05, y: -2 }}
          whileTap={{ scale: 0.94, y: 2 }}
          transition={{ type: 'spring', stiffness: 500, damping: 20 }}
          disabled={isRolling || candidatePool.length === 0}
          onClick={handleRoll}
          className="flex items-center gap-3 h-14 sm:h-16 px-8 sm:px-12 rounded-2xl bg-[#C49832] hover:bg-[#B0872A] border-b-4 border-[#8E6D21] text-white font-black text-base sm:text-xl shadow-xl transition-all select-none disabled:opacity-50 disabled:pointer-events-none active:border-b-0 active:translate-y-1 whitespace-nowrap break-keep"
        >
          <Sparkles className={`w-6 h-6 text-white ${isRolling ? 'animate-spin' : ''}`} />
          <span>{isRolling ? '두구두구... 추첨 중!' : `🎲 ${pickCount}명 뽑기 시작!`}</span>
        </motion.button>

        {/* 롤링 중 텍스트 */}
        {isRolling && (
          <div className="mt-4 flex items-center gap-2 text-[#C49832] font-black text-base sm:text-lg animate-pulse whitespace-nowrap break-keep">
            <span>추첨 중... {displayCandidates.join(' · ')}</span>
          </div>
        )}
      </div>

      {/* ─── 당첨자 결과 화면 ─── */}
      {currentWinners.length > 0 && !isRolling && (
        <div className="space-y-3.5">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <h4 className="text-base sm:text-lg font-black text-slate-900 flex items-center gap-2 whitespace-nowrap break-keep">
              <Award className="w-5 h-5 text-[#C49832]" />
              <span>선정된 발표자 ({currentWinners.length}명)</span>
            </h4>
            <span className="text-xs text-slate-500 font-bold whitespace-nowrap">
              칭찬 버튼을 눌러 격려 포인트를 부여하세요!
            </span>
          </div>

          {/* 1명 단독 당첨일 때: 대형 Hero 카드 */}
          {currentWinners.length === 1 ? (
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: 'spring', stiffness: 450, damping: 18 }}
              className="p-6 sm:p-8 rounded-3xl bg-gradient-to-b from-amber-50/80 via-white to-blue-50/40 border-2 border-[#C49832] border-b-6 border-b-[#8E6D21] shadow-xl flex flex-col items-center justify-center max-w-sm mx-auto text-center gap-3 select-none"
            >
              {currentWinners[0].photoUrl ? (
                <img
                  src={currentWinners[0].photoUrl}
                  alt={currentWinners[0].name}
                  className="w-24 h-24 rounded-full object-cover border-4 border-[#C49832] shadow-md"
                />
              ) : (
                <div className={`w-24 h-24 rounded-full font-black text-2xl flex items-center justify-center border-4 border-white shadow-md text-white ${
                  isMaleStudent(currentWinners[0]) ? 'bg-[#2471B2]' : 'bg-[#B01E23]'
                }`}>
                  {currentWinners[0].name.slice(-2)}
                </div>
              )}

              <div>
                <span className="text-xs font-mono font-black text-slate-500">
                  {currentWinners[0].studentNum ? `${currentWinners[0].studentNum}번` : ''}
                </span>
                <h3 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight whitespace-nowrap break-keep">
                  {currentWinners[0].name}
                </h3>
                <Badge className={`mt-1 font-black text-xs px-2.5 py-0.5 rounded-full ${
                  isMaleStudent(currentWinners[0])
                    ? 'bg-blue-100 text-[#2471B2] border border-blue-200'
                    : 'bg-rose-100 text-[#B01E23] border border-rose-200'
                }`}>
                  {isMaleStudent(currentWinners[0]) ? '남학생' : '여학생'}
                </Badge>
              </div>

              {/* 칭찬 바로 주기 버튼 */}
              <motion.button
                type="button"
                whileHover={{ scale: 1.05, y: -1 }}
                whileTap={{ scale: 0.95, y: 1 }}
                onClick={() => handlePraiseWinner(currentWinners[0])}
                disabled={praisedStudentIds.has(currentWinners[0].studentId || currentWinners[0].id || '')}
                className={`mt-2 flex items-center justify-center gap-2 h-11 px-6 rounded-2xl font-black text-xs sm:text-sm border-b-4 transition-all select-none whitespace-nowrap ${
                  praisedStudentIds.has(currentWinners[0].studentId || currentWinners[0].id || '')
                    ? 'bg-emerald-600 text-white border-emerald-800'
                    : 'bg-[#C49832] hover:bg-[#B0872A] text-white border-[#8E6D21] shadow-md'
                }`}
              >
                {praisedStudentIds.has(currentWinners[0].studentId || currentWinners[0].id || '') ? (
                  <>
                    <Check className="w-4 h-4" /> 칭찬 완료!
                  </>
                ) : (
                  <>
                    <Star className="w-4 h-4 fill-white" /> 칭찬 +1 주기
                  </>
                )}
              </motion.button>
            </motion.div>
          ) : (
            /* 2명 이상 당첨일 때: 반응형 그리드 카드 */
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
              {currentWinners.map((winner) => {
                const wid = winner.studentId || winner.id || '';
                const isPraised = praisedStudentIds.has(wid);
                const isMale = isMaleStudent(winner);

                return (
                  <motion.div
                    key={wid}
                    initial={{ scale: 0.85, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    whileHover={{ scale: 1.03, y: -2 }}
                    transition={{ type: 'spring', stiffness: 450, damping: 18 }}
                    className="p-3 sm:p-4 rounded-3xl bg-white border-2 border-slate-200/90 border-b-4 border-b-slate-300 shadow-xs flex flex-col items-center text-center gap-2 group select-none"
                  >
                    {winner.photoUrl ? (
                      <img
                        src={winner.photoUrl}
                        alt={winner.name}
                        className="w-14 h-14 rounded-full object-cover border-2 border-[#2471B2]/30 shadow-xs"
                      />
                    ) : (
                      <div
                        className={`w-14 h-14 rounded-full flex items-center justify-center font-black text-sm border-2 shadow-xs text-white ${
                          isMale
                            ? 'bg-[#2471B2] border-blue-400'
                            : 'bg-[#B01E23] border-rose-400'
                        }`}
                      >
                        {winner.name.slice(-2)}
                      </div>
                    )}

                    <div className="w-full">
                      <span className="text-[10px] font-mono font-bold text-slate-400 block">
                        {winner.studentNum ? `${winner.studentNum}번` : ''}
                      </span>
                      <span className="text-sm font-black text-slate-900 tracking-tight block truncate whitespace-nowrap">
                        {winner.name}
                      </span>
                      <span
                        className={`text-[9px] font-bold px-1.5 py-0.2 rounded-full inline-block mt-0.5 whitespace-nowrap ${
                          isMale
                            ? 'bg-blue-100 text-[#2471B2]'
                            : 'bg-rose-100 text-[#B01E23]'
                        }`}
                      >
                        {isMale ? '남' : '여'}
                      </span>
                    </div>

                    <motion.button
                      type="button"
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => handlePraiseWinner(winner)}
                      disabled={isPraised}
                      className={`w-full mt-1 h-8 rounded-xl font-black text-[11px] flex items-center justify-center gap-1 border-b-2 transition-all select-none whitespace-nowrap ${
                        isPraised
                          ? 'bg-emerald-600 text-white border-emerald-800'
                          : 'bg-[#C49832] hover:bg-[#B0872A] text-white border-[#8E6D21]'
                      }`}
                    >
                      {isPraised ? (
                        <>
                          <Check className="w-3 h-3" /> 완료
                        </>
                      ) : (
                        <>
                          <Star className="w-3 h-3 fill-white" /> +1점
                        </>
                      )}
                    </motion.button>
                  </motion.div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
