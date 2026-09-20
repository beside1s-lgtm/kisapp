'use client';

import React, { useState, useEffect } from 'react';
import { X, Check } from 'lucide-react';
import type { HomeroomHomework, HomeroomHomeworkCheck } from '@/lib/types/homeroomClass';
import type { MasterStudent } from '@/lib/types/masterStudent';

interface HomeworkPresentationModalProps {
  isOpen: boolean;
  onClose: () => void;
  mode: 'single' | 'all';
  activeHw?: HomeroomHomework | null;
  allHws: HomeroomHomework[];
  students: MasterStudent[];
  checks: HomeroomHomeworkCheck[];
  onCheckStudent: (hwId: string, studentId: string, studentName: string) => void;
}

export const HomeworkPresentationModal: React.FC<HomeworkPresentationModalProps> = ({
  isOpen,
  onClose,
  mode,
  activeHw,
  allHws,
  students,
  checks,
  onCheckStudent,
}) => {
  const [removingKey, setRemovingKey] = useState<string | null>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  // 학생별 제출 여부 확인 헬퍼
  const isDone = (hwId: string, sid: string) => {
    return checks.some((c) => c.hwId === hwId && c.studentId === sid && c.checked);
  };

  const handleCardClick = (hwId: string, student: MasterStudent) => {
    const sId = student.studentId || student.id || '';
    const key = `${hwId}_${sId}`;
    setRemovingKey(key);
    onCheckStudent(hwId, sId, student.name);

    setTimeout(() => {
      setRemovingKey(null);
    }, 300);
  };

  return (
    <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-between p-3 sm:p-6 md:p-10 bg-[#0f172a] text-white select-none transition-colors duration-200" style={{ opacity: 1 }}>
      {/* 상단 닫기 및 타이틀 영역 */}
      <div className="w-full flex items-center justify-between max-w-6xl shrink-0 border-b border-slate-800 pb-3 sm:pb-4">
        <div>
          <span className="text-xs tracking-widest text-emerald-400 font-bold uppercase bg-emerald-500/20 px-2 py-0.5 rounded border border-emerald-500/30">
            {mode === 'single' ? '숙제 미제출자 확인' : '전체 숙제 미제출 현황'}
          </span>
          <h1 className="text-xl sm:text-4xl font-black tracking-tight mt-1.5 sm:mt-2 text-yellow-300 drop-shadow-sm">
            {mode === 'single' && activeHw ? activeHw.title : '미제출 학생 명단'}
          </h1>
        </div>
        <button
          onClick={onClose}
          className="flex items-center gap-1.5 px-3.5 sm:px-5 py-1.5 sm:py-2.5 rounded-xl text-xs sm:text-sm font-bold bg-red-500/20 hover:bg-red-500 text-white border border-red-400/60 hover:border-red-400 transition-all cursor-pointer shadow-md"
          title="닫기 (ESC)"
        >
          <X className="w-4 h-4 stroke-[2.5]" />
          <span>닫기 (ESC)</span>
        </button>
      </div>

      {/* 중앙 미제출자 카드 영역 */}
      <div className="flex-1 w-full max-w-6xl overflow-y-auto my-2 sm:my-6 py-2 sm:py-4 overscroll-contain flex flex-col">
        {mode === 'single' && activeHw && (
          <div className="w-full">
            {(() => {
              const incompleteStudents = students.filter(
                (s) => !isDone(activeHw.id, s.studentId || s.id || '')
              );

              if (incompleteStudents.length === 0) {
                return (
                  <div className="text-center py-16 animate-in zoom-in-95 my-auto">
                    <div className="inline-flex p-4 bg-emerald-500/20 text-emerald-400 rounded-full mb-4">
                      <Check className="w-12 h-12 stroke-[3]" />
                    </div>
                    <h2 className="text-3xl sm:text-5xl font-black text-white">🎉 모두 완료했어요!</h2>
                    <p className="text-slate-400 text-sm mt-3">모든 학생이 숙제를 정상 제출하였습니다.</p>
                  </div>
                );
              }

              return (
                <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-2.5 sm:gap-4">
                  {incompleteStudents.map((s) => {
                    const sid = s.studentId || s.id || '';
                    const key = `${activeHw.id}_${sid}`;
                    const isRemoving = removingKey === key;

                    return (
                      <button
                        key={sid}
                        onClick={() => handleCardClick(activeHw.id, s)}
                        className={`p-3 sm:p-4 rounded-xl sm:rounded-2xl bg-white/10 hover:bg-emerald-500/20 border border-white/15 hover:border-emerald-400 flex flex-col items-center justify-center transition-all duration-200 group cursor-pointer ${
                          isRemoving ? 'opacity-0 scale-90' : 'opacity-100 scale-100'
                        }`}
                      >
                        <span className="text-[11px] sm:text-xs text-slate-400 font-semibold mb-0.5 sm:mb-1">
                          {s.studentNum ? `${s.studentNum}번` : ''}
                        </span>
                        <span className="text-lg sm:text-2xl font-black text-white group-hover:text-emerald-300">
                          {s.name}
                        </span>
                        <span className="text-[9px] sm:text-[10px] text-slate-400 group-hover:text-emerald-400 mt-1.5 sm:mt-2 font-medium">
                          클릭 시 제출
                        </span>
                      </button>
                    );
                  })}
                </div>
              );
            })()}
          </div>
        )}

        {mode === 'all' && (
          <div className="space-y-6 w-full">
            {(() => {
              const activeHomeworks = allHws.filter((hw) =>
                students.some((s) => !isDone(hw.id, s.studentId || s.id || ''))
              );

              if (activeHomeworks.length === 0) {
                return (
                  <div className="text-center py-16 animate-in zoom-in-95 my-auto">
                    <div className="inline-flex p-4 bg-emerald-500/20 text-emerald-400 rounded-full mb-4">
                      <Check className="w-12 h-12 stroke-[3]" />
                    </div>
                    <h2 className="text-3xl sm:text-5xl font-black text-white">🎉 모든 숙제가 완료되었어요!</h2>
                    <p className="text-slate-400 text-sm mt-3">미제출 학생이 한 명도 없습니다.</p>
                  </div>
                );
              }

              return activeHomeworks.map((hw) => {
                const incomplete = students.filter(
                  (s) => !isDone(hw.id, s.studentId || s.id || '')
                );

                return (
                  <div
                    key={hw.id}
                    className="bg-white/5 border border-white/10 rounded-2xl p-5 backdrop-blur-sm"
                  >
                    <div className="flex items-center justify-between pb-3 mb-3 border-b border-white/10">
                      <span className="text-lg sm:text-xl font-bold text-slate-100 flex items-center gap-2">
                        <span>📚</span>
                        <span>{hw.title}</span>
                      </span>
                      <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/30">
                        미제출 {incomplete.length}명
                      </span>
                    </div>

                    <div className="flex flex-wrap gap-2.5">
                      {incomplete.map((s) => {
                        const sid = s.studentId || s.id || '';
                        const key = `${hw.id}_${sid}`;
                        const isRemoving = removingKey === key;

                        return (
                          <button
                            key={sid}
                            onClick={() => handleCardClick(hw.id, s)}
                            className={`px-3.5 py-2 rounded-xl bg-white/10 hover:bg-emerald-500/20 border border-white/10 hover:border-emerald-400 flex items-center gap-2 transition-all duration-200 cursor-pointer ${
                              isRemoving ? 'opacity-0 scale-90' : 'opacity-100 scale-100'
                            }`}
                          >
                            <span className="text-xs text-slate-400">{s.studentNum || ''}</span>
                            <span className="text-sm font-bold text-white">{s.name}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              });
            })()}
          </div>
        )}
      </div>

      {/* 하단 힌트 라벨 */}
      <div className="text-xs text-slate-400 tracking-wide text-center shrink-0">
        💡 학생 이름을 클릭하면 실시간 제출 완료 처리되며 화면에서 즉시 사라집니다.
      </div>
    </div>
  );
};
