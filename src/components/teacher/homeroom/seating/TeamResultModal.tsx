'use client';

import React from 'react';
import {
  Users,
  Sparkles,
  Check,
  X,
  Palette,
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
import { motion } from 'framer-motion';
import type { MasterStudent } from '@/lib/types/masterStudent';
import {
  TEAM_COLOR_PALETTES,
  type TeamColorTheme,
  type ClassTeamData,
} from '@/lib/types/teams';
import { isFemaleStudent } from '@/lib/services/seatingService';

export interface DisplayTeam {
  id: number;
  name: string;
  themeId: string;
  theme: TeamColorTheme;
  members: MasterStudent[];
}

interface TeamResultModalProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  teams: DisplayTeam[];
}

export const TeamResultModal: React.FC<TeamResultModalProps> = ({
  isOpen,
  onOpenChange,
  teams,
}) => {
  if (!teams || teams.length === 0) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent
        hideCloseButton
        container={typeof document !== 'undefined' ? (document.fullscreenElement as HTMLElement) || undefined : undefined}
        className="sm:max-w-2xl p-6 overflow-hidden z-[99999] border-2 border-rose-300 bg-gradient-to-b from-rose-50/80 via-white to-red-50/40"
      >
        <DialogHeader className="pb-3 border-b border-rose-200/80 text-center relative">
          <div className="mx-auto w-12 h-12 rounded-2xl bg-gradient-to-tr from-red-600 to-rose-500 flex items-center justify-center text-white shadow-md mb-2 animate-bounce">
            <Users className="w-6 h-6" />
          </div>
          <DialogTitle className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight flex items-center justify-center gap-1.5">
            <Sparkles className="w-5 h-5 text-rose-500 animate-spin-slow" />
            <span>팀 나누기 완료!</span>
            <Sparkles className="w-5 h-5 text-rose-500 animate-spin-slow" />
          </DialogTitle>
          <DialogDescription className="text-xs font-bold text-rose-800">
            총 {teams.length}개 팀으로 편성되었으며, 자리배치도 책상에 팀 색상이 실시간 반영되었습니다! 🎨
          </DialogDescription>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="absolute top-0 right-0 p-1.5 rounded-full hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </DialogHeader>

        {/* 팀별 결과 그리드 */}
        <div className="py-4 max-h-[60vh] overflow-y-auto">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {teams.map((team, idx) => {
              const theme =
                TEAM_COLOR_PALETTES.find((p) => p.id === team.themeId) ||
                TEAM_COLOR_PALETTES[idx % TEAM_COLOR_PALETTES.length];

              return (
                <motion.div
                  key={team.id}
                  initial={{ scale: 0.9, opacity: 0, y: 10 }}
                  animate={{ scale: 1, opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.05 }}
                  className={`p-3.5 rounded-2xl border-2 shadow-xs border-b-4 ${theme.bg} ${theme.border}`}
                >
                  {/* 팀 헤더: 팀 이름 및 색상 배지 */}
                  <div className="flex items-center justify-between pb-2 mb-2 border-b border-black/10">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span className={`w-3.5 h-3.5 rounded-full ${theme.badge} shadow-xs shrink-0`} />
                      <span className="font-black text-sm text-slate-900 truncate">
                        {team.name}
                      </span>
                    </div>
                    <Badge className={`${theme.badge} text-white font-bold text-[10px] px-2 py-0.2 shrink-0 border-0`}>
                      {team.members.length}명
                    </Badge>
                  </div>

                  {/* 팀원 명단 칩 목록 */}
                  <div className="flex flex-wrap gap-1.5">
                    {team.members.map((member) => {
                      const isFemale = isFemaleStudent(member);
                      return (
                        <div
                          key={member.studentId || member.id}
                          className="flex items-center gap-1 bg-white/95 px-2 py-1 rounded-xl border border-slate-200/90 shadow-2xs text-xs font-bold text-slate-800"
                        >
                          {member.photoUrl ? (
                            <img
                              src={member.photoUrl}
                              alt={member.name}
                              className="w-4 h-4 rounded-full object-cover shrink-0"
                            />
                          ) : (
                            <span className="text-[10px] text-slate-400 font-mono">
                              {member.studentNum ? `${member.studentNum}.` : ''}
                            </span>
                          )}
                          <span>{member.name}</span>
                          <span className={`text-[8px] font-bold px-1 rounded-xs ${isFemale ? 'bg-rose-100 text-rose-700' : 'bg-blue-100 text-blue-700'}`}>
                            {isFemale ? '여' : '남'}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>

        {/* 하단 버튼 바 */}
        <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
          <Button
            type="button"
            size="sm"
            onClick={() => onOpenChange(false)}
            className="px-6 text-xs font-black bg-[#B01E23] hover:bg-[#8E1519] text-white shadow-sm"
          >
            확인 및 자리배치 색상 보기
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
