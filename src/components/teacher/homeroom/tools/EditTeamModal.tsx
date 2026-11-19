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
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Pencil, Palette, Crown, Check } from 'lucide-react';
import { motion } from 'framer-motion';
import { TEAM_COLOR_PALETTES, type TeamColorTheme } from '@/lib/types/teams';
import type { MasterStudent } from '@/lib/types/masterStudent';

interface EditTeamModalProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  team: {
    id: number;
    name: string;
    themeId?: string;
    leaderStudentId: string | null;
    members: MasterStudent[];
  } | null;
  onSave: (updated: {
    teamId: number;
    name: string;
    themeId: string;
    leaderStudentId: string | null;
  }) => void;
}

export const EditTeamModal: React.FC<EditTeamModalProps> = ({
  isOpen,
  onOpenChange,
  team,
  onSave,
}) => {
  const [teamName, setTeamName] = useState('');
  const [selectedThemeId, setSelectedThemeId] = useState('blue');
  const [selectedLeaderId, setSelectedLeaderId] = useState<string | null>(null);

  useEffect(() => {
    if (team) {
      setTeamName(team.name || '');
      setSelectedThemeId(team.themeId || TEAM_COLOR_PALETTES[(team.id - 1) % TEAM_COLOR_PALETTES.length].id);
      setSelectedLeaderId(team.leaderStudentId);
    }
  }, [team]);

  if (!team) return null;

  const currentTheme =
    TEAM_COLOR_PALETTES.find((t) => t.id === selectedThemeId) || TEAM_COLOR_PALETTES[0];

  const handleSave = () => {
    const trimmed = teamName.trim() || team.name;
    onSave({
      teamId: team.id,
      name: trimmed,
      themeId: selectedThemeId,
      leaderStudentId: selectedLeaderId,
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md p-6 max-h-[90vh] overflow-y-auto rounded-3xl border-2 border-slate-200">
        <DialogHeader className="pb-3 border-b border-slate-100">
          <DialogTitle className="flex items-center gap-2 text-base font-black text-slate-900">
            <Pencil className="w-5 h-5 text-[#2471B2]" />
            <span>모둠/팀 설정 수정 ({team.id}모둠)</span>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* 1. 팀 이름 입력 */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700 flex items-center justify-between">
              <span>팀 이름</span>
              <span className="text-[11px] text-slate-400 font-normal">예: 1모둠 (청룡팀), 불사조팀</span>
            </label>
            <Input
              type="text"
              value={teamName}
              onChange={(e) => setTeamName(e.target.value)}
              placeholder={`${team.id}모둠 팀명 입력...`}
              className="h-10 text-sm font-bold rounded-2xl border-2 border-slate-200 focus:border-[#2471B2]"
              maxLength={20}
            />
          </div>

          {/* 2. 팀 색상 팔레트 선택 */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
              <Palette className="w-4 h-4 text-[#C49832]" />
              <span>팀 테마 색상 선택 (자리배치 책상 색상과 연동)</span>
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {TEAM_COLOR_PALETTES.map((palette) => {
                const isSelected = selectedThemeId === palette.id;
                return (
                  <motion.button
                    key={palette.id}
                    type="button"
                    whileHover={{ scale: 1.03 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => setSelectedThemeId(palette.id)}
                    className={`p-2.5 rounded-2xl border-2 text-left transition-all relative ${palette.bg} ${
                      isSelected
                        ? `${palette.border} ring-2 ${palette.ring} shadow-xs font-black`
                        : 'border-slate-200/90 opacity-75 hover:opacity-100'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className={`w-3.5 h-3.5 rounded-full ${palette.badge}`} />
                      {isSelected && <Check className={`w-3.5 h-3.5 ${palette.text}`} />}
                    </div>
                    <span className={`text-[11px] block truncate font-bold ${palette.text}`}>
                      {palette.name}
                    </span>
                  </motion.button>
                );
              })}
            </div>
          </div>

          {/* 3. 팀장 지정/변경 */}
          {team.members.length > 0 && (
            <div className="space-y-1.5 pt-1">
              <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                <Crown className="w-4 h-4 text-amber-500" />
                <span>팀장 선택 (선택 사항)</span>
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 max-h-36 overflow-y-auto p-1 border rounded-2xl border-slate-200 bg-slate-50/50 scrollbar-thin">
                {team.members.map((m) => {
                  const mId = m.studentId || m.id || '';
                  const isLeader = selectedLeaderId === mId;
                  return (
                    <button
                      key={mId}
                      type="button"
                      onClick={() => setSelectedLeaderId(isLeader ? null : mId)}
                      className={`px-2 py-1.5 rounded-xl text-xs font-bold transition-all text-left flex items-center justify-between border ${
                        isLeader
                          ? 'bg-amber-100 text-amber-950 border-amber-300 font-black shadow-2xs'
                          : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      <span className="truncate">
                        {m.studentNum ? `${m.studentNum}. ` : ''}
                        {m.name}
                      </span>
                      {isLeader && <Crown className="w-3 h-3 text-amber-600 fill-amber-500 shrink-0 ml-1" />}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* 미리보기 카드 */}
          <div className="pt-2">
            <span className="text-[11px] font-bold text-slate-500 block mb-1">자리배치 카드 미리보기:</span>
            <div
              className={`p-2.5 rounded-2xl border-2 ${currentTheme.border} ${currentTheme.bg} flex items-center justify-between`}
            >
              <div className="flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-slate-200 flex items-center justify-center text-[10px] font-black text-slate-600">
                  학생
                </span>
                <span className="text-xs font-black text-slate-900">홍길동</span>
                <Badge className={`text-[9px] px-1.5 py-0 ${currentTheme.badge} text-white`}>
                  {teamName || team.name}
                </Badge>
              </div>
              <span className={`text-[10px] font-mono font-bold ${currentTheme.text}`}>
                팀 색상 적용됨
              </span>
            </div>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0 pt-2 border-t border-slate-100">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="rounded-2xl text-xs font-bold h-10"
          >
            취소
          </Button>
          <Button
            type="button"
            onClick={handleSave}
            className="rounded-2xl text-xs font-black h-10 bg-[#2471B2] hover:bg-[#1E629D] text-white border-b-2 border-[#1A5384] shadow-xs"
          >
            설정 저장
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
