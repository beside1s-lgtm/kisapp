'use client';

import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, Trophy, Award, ArrowRight, Check } from 'lucide-react';
import type { PromotedStudentInfo, PromotionGroup } from '@/lib/types/praisePromotion';
import {
  PRAISE_PROMOTION_EVENT,
  type PromotionEventDetail,
} from '@/lib/services/praisePromotionStore';
import { ConfettiCanvas } from './ConfettiCanvas';

interface PraisePromotionModalProps {
  classKey: string;
}

export const PraisePromotionModal: React.FC<PraisePromotionModalProps> = ({ classKey }) => {
  // 등급별로 그룹화되어 높은 등급부터 순차 대기하는 큐
  const [queue, setQueue] = useState<PromotionGroup[]>([]);
  const [confettiKey, setConfettiKey] = useState<number>(0);

  useEffect(() => {
    const handlePromotionEvent = (e: Event) => {
      const customEvent = e as CustomEvent<PromotionEventDetail>;
      if (!customEvent.detail || customEvent.detail.classKey !== classKey) return;

      const newStudents = customEvent.detail.promotedStudents;
      if (!newStudents || newStudents.length === 0) return;

      // 1. 들어온 학생들을 승급 레벨(newLevel) 기준으로 그룹화
      const groupMap = new Map<number, PromotedStudentInfo[]>();
      newStudents.forEach((st) => {
        const list = groupMap.get(st.newLevel) || [];
        // 중복 방지 (같은 학생이 같은 레벨로 여러 번 들어온 경우)
        if (!list.some((existing) => existing.studentId === st.studentId)) {
          list.push(st);
        }
        groupMap.set(st.newLevel, list);
      });

      // 2. 높은 등급(높은 level)부터 내림차순 정렬된 신규 그룹 목록 생성
      const sortedNewGroups: PromotionGroup[] = Array.from(groupMap.entries())
        .sort(([lvlA], [lvlB]) => lvlB - lvlA) // 높은 등급 먼저!
        .map(([level, students]) => ({
          level,
          tier: students[0].tier,
          students,
        }));

      // 3. 기존 대기 큐에 병합 (동일 레벨이 이미 대기 중이면 합치고, 아니면 순서대로 추가)
      setQueue((prevQueue) => {
        let merged = [...prevQueue];

        sortedNewGroups.forEach((newGrp) => {
          const existingIdx = merged.findIndex((g) => g.level === newGrp.level);
          if (existingIdx !== -1) {
            // 이미 큐에 있는 동일 레벨 그룹에 학생 추가
            const existing = merged[existingIdx];
            const combinedStudents = [...existing.students];
            newGrp.students.forEach((st) => {
              if (!combinedStudents.some((s) => s.studentId === st.studentId)) {
                combinedStudents.push(st);
              }
            });
            merged[existingIdx] = { ...existing, students: combinedStudents };
          } else {
            // 큐에 추가
            merged.push(newGrp);
          }
        });

        // 전체 큐를 다시 높은 등급 순으로 정렬
        return merged.sort((a, b) => b.level - a.level);
      });

      // 폭죽 키 리셋
      setConfettiKey((prev) => prev + 1);
    };

    window.addEventListener(PRAISE_PROMOTION_EVENT, handlePromotionEvent);
    return () => {
      window.removeEventListener(PRAISE_PROMOTION_EVENT, handlePromotionEvent);
    };
  }, [classKey]);

  // 현재 화면에 띄울 팝업: 큐의 맨 앞(0번째 인덱스)
  const currentGroup = queue[0] || null;

  // 현재 팝업 닫기 -> 다음 팝업으로 전환
  const handleCloseCurrent = () => {
    setQueue((prev) => {
      const next = prev.slice(1);
      if (next.length > 0) {
        setConfettiKey((k) => k + 1); // 다음 팝업이 뜨면 새로운 폭죽 발사
      }
      return next;
    });
  };

  if (!currentGroup) return null;

  const { tier, students } = currentGroup;
  const isMultiple = students.length > 1;
  const remainingCount = queue.length - 1;

  return (
    <>
      {/* ─── 축하 폭죽 파티클 효과 ─── */}
      <ConfettiCanvas key={confettiKey} />

      <Dialog open={true} onOpenChange={(open) => !open && handleCloseCurrent()}>
        <DialogContent
          hideCloseButton
          className="sm:max-w-lg p-6 rounded-3xl border-2 border-amber-300/80 bg-white shadow-2xl z-[99999] overflow-hidden"
        >
          {/* 상단 화려한 축하 헤더 */}
          <div className="text-center space-y-2 pt-2">
            <motion.div
              initial={{ scale: 0, rotate: -20 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ type: 'spring', stiffness: 350, damping: 15 }}
              className="inline-flex items-center justify-center"
            >
              <div
                className={`w-20 h-20 rounded-full flex items-center justify-center text-4xl shadow-lg border-4 border-white ${tier.badgeClass} ring-4 ring-amber-300/60`}
              >
                {tier.icon}
              </div>
            </motion.div>

            <div>
              <div className="flex items-center justify-center gap-1.5 text-xs font-black text-amber-600 mb-1">
                <Sparkles className="w-4 h-4 text-amber-500 fill-amber-400" />
                <span>성장 등급 승급 축하</span>
                <Sparkles className="w-4 h-4 text-amber-500 fill-amber-400" />
              </div>
              <DialogTitle className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
                <span className="text-amber-600">[{tier.name}]</span> 등급 승급!
              </DialogTitle>
            </div>

            {/* 축하 멘트 */}
            <p className="text-xs sm:text-sm text-slate-600 font-medium px-4">
              {isMultiple ? (
                <>
                  총 <span className="font-black text-amber-600">{students.length}명</span>의 학생이
                  새로운 등급으로 함께 승급했습니다! 큰 박수로 축하해주세요!
                </>
              ) : (
                <>
                  <span className="font-black text-slate-900">{students[0].studentName}</span> 학생이
                  멋진 노력으로 <span className="font-black text-amber-600">[{tier.name}]</span> 등급으로 승급했습니다!
                </>
              )}
            </p>
          </div>

          {/* ─── 승급 학생 카드 영역 ─── */}
          <div className="py-3">
            {!isMultiple ? (
              // 1명 단독 승급 카드
              <motion.div
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                className={`p-4 rounded-2xl border-2 ${tier.cardBorderClass} ${tier.cardBgClass} flex flex-col items-center text-center space-y-2.5 shadow-xs`}
              >
                {students[0].photoUrl ? (
                  <img
                    src={students[0].photoUrl}
                    alt={students[0].studentName}
                    className="w-20 h-20 rounded-full object-cover border-4 border-white shadow-md"
                  />
                ) : (
                  <div
                    className={`w-20 h-20 rounded-full flex items-center justify-center font-black text-2xl border-4 border-white shadow-md ${
                      students[0].gender === 'Female' || students[0].gender === '여'
                        ? 'bg-rose-100 text-rose-700'
                        : 'bg-blue-100 text-blue-700'
                    }`}
                  >
                    {students[0].studentName.slice(-2)}
                  </div>
                )}

                <div>
                  <div className="flex items-center justify-center gap-1.5">
                    {students[0].studentNum && (
                      <span className="font-mono text-xs font-bold text-slate-500">
                        {students[0].studentNum}번
                      </span>
                    )}
                    <span className="text-lg font-black text-slate-900">
                      {students[0].studentName}
                    </span>
                    {students[0].gender && (
                      <Badge
                        variant="outline"
                        className={`text-[10px] px-1.5 py-0 ${
                          students[0].gender === 'Female' || students[0].gender === '여'
                            ? 'text-rose-600 border-rose-200'
                            : 'text-blue-600 border-blue-200'
                        }`}
                      >
                        {students[0].gender === 'Female' || students[0].gender === '여' ? '여' : '남'}
                      </Badge>
                    )}
                  </div>

                  <div className="inline-flex items-center gap-1.5 mt-1.5 text-xs font-bold text-slate-500 bg-white/80 px-3 py-1 rounded-full border border-slate-200">
                    <span>Lv.{students[0].oldLevel} {students[0].oldTierName || '새싹'}</span>
                    <ArrowRight className="w-3.5 h-3.5 text-amber-500" />
                    <span className="font-black text-amber-700">Lv.{students[0].newLevel} {tier.name}</span>
                  </div>
                </div>
              </motion.div>
            ) : (
              // 2명 이상 다수 학생 승급 그리드
              <div className="max-h-56 overflow-y-auto space-y-2 pr-1">
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {students.map((st) => (
                    <motion.div
                      key={st.studentId}
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className={`p-2.5 rounded-xl border ${tier.cardBorderClass} ${tier.cardBgClass} flex flex-col items-center text-center space-y-1.5 shadow-2xs`}
                    >
                      {st.photoUrl ? (
                        <img
                          src={st.photoUrl}
                          alt={st.studentName}
                          className="w-12 h-12 rounded-full object-cover border-2 border-white shadow-xs"
                        />
                      ) : (
                        <div
                          className={`w-12 h-12 rounded-full flex items-center justify-center font-black text-xs border-2 border-white shadow-xs ${
                            st.gender === 'Female' || st.gender === '여'
                              ? 'bg-rose-100 text-rose-700'
                              : 'bg-blue-100 text-blue-700'
                          }`}
                        >
                          {st.studentName.slice(-2)}
                        </div>
                      )}
                      <div>
                        <div className="flex items-center justify-center gap-1">
                          {st.studentNum && (
                            <span className="text-[10px] font-mono text-slate-500 font-bold">
                              {st.studentNum}번
                            </span>
                          )}
                          <span className="text-xs font-black text-slate-900 truncate max-w-[70px]">
                            {st.studentName}
                          </span>
                        </div>
                        <Badge className={`text-[9px] px-1 py-0 mt-0.5 ${tier.badgeClass}`}>
                          {tier.name}
                        </Badge>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* ─── 하단 액션 버튼 (다음 승급 팝업 큐 안내) ─── */}
          <DialogFooter className="pt-2 border-t border-slate-100 flex items-center justify-between sm:justify-between w-full">
            <div className="text-xs text-slate-400 font-bold">
              {remainingCount > 0 ? (
                <span className="text-amber-600 font-black">
                  대기 중인 다음 승급 팝업: {remainingCount}개
                </span>
              ) : (
                <span>모든 승급 축하 완료</span>
              )}
            </div>

            <Button
              type="button"
              onClick={handleCloseCurrent}
              className="h-10 px-5 rounded-2xl text-xs font-black bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white shadow-md border-b-2 border-amber-800 transition-all gap-1.5"
            >
              <Check className="w-4 h-4" />
              <span>
                {remainingCount > 0 ? `다음 승급 확인하기 (${remainingCount}개 남음)` : '멋져요, 축하합니다!'}
              </span>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};
