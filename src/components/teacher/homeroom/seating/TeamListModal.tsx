'use client';

import React, { useState } from 'react';
import {
  Users,
  Pencil,
  X,
  Palette,
  Check,
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
import type { MasterStudent } from '@/lib/types/masterStudent';
import {
  TEAM_COLOR_PALETTES,
  type TeamColorTheme,
  type ClassTeamData,
  saveClassTeams,
} from '@/lib/types/teams';
import { isFemaleStudent } from '@/lib/services/seatingService';
import { EditTeamModal } from '../tools/EditTeamModal';

interface TeamListModalProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  teams: ClassTeamData[];
  studentsMap: Map<string, MasterStudent>;
  classKey: string;
  onTeamsUpdated: () => void;
}

export const TeamListModal: React.FC<TeamListModalProps> = ({
  isOpen,
  onOpenChange,
  teams,
  studentsMap,
  classKey,
  onTeamsUpdated,
}) => {
  const [editingTeam, setEditingTeam] = useState<{
    id: number;
    name: string;
    themeId?: string;
    leaderStudentId: string | null;
    members: MasterStudent[];
  } | null>(null);

  if (!isOpen) return null;

  const handleSaveEditTeam = (updated: {
    teamId: number;
    name: string;
    themeId: string;
    leaderStudentId: string | null;
  }) => {
    const updatedTeams = teams.map((t) => {
      if (t.id === updated.teamId) {
        return {
          ...t,
          name: updated.name,
          themeId: updated.themeId,
          leaderStudentId: updated.leaderStudentId,
        };
      }
      return t;
    });
    saveClassTeams(classKey, updatedTeams);
    onTeamsUpdated();
    setEditingTeam(null);
  };

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onOpenChange}>
        <DialogContent
          hideCloseButton
          container={typeof document !== 'undefined' ? (document.fullscreenElement as HTMLElement) || undefined : undefined}
          className="sm:max-w-2xl p-6 overflow-hidden z-[99999] border-2 border-slate-200"
        >
          <DialogHeader className="pb-3 border-b border-slate-100 flex flex-row items-center justify-between">
            <div>
              <DialogTitle className="text-lg font-black text-slate-900 flex items-center gap-2">
                <Users className="w-5 h-5 text-[#B01E23]" />
                <span>팀별 명단 및 설정 ({teams.length}개 팀)</span>
              </DialogTitle>
              <DialogDescription className="text-xs text-slate-500">
                각 팀의 이름을 수정하거나 색상 테마를 변경할 수 있습니다.
              </DialogDescription>
            </div>
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="p-1 rounded-full hover:bg-slate-100 text-slate-400 hover:text-slate-600"
            >
              <X className="w-4 h-4" />
            </button>
          </DialogHeader>

          <div className="py-3 max-h-[60vh] overflow-y-auto space-y-3">
            {teams.length === 0 ? (
              <div className="p-8 text-center text-slate-400 text-sm font-bold border-2 border-dashed rounded-2xl">
                아직 생성된 팀이 없습니다. [⚡ 팀 나누기 실행]을 먼저 진행해주세요.
              </div>
            ) : (
              teams.map((team, idx) => {
                const theme =
                  TEAM_COLOR_PALETTES.find((p) => p.id === team.themeId) ||
                  TEAM_COLOR_PALETTES[idx % TEAM_COLOR_PALETTES.length];

                return (
                  <div
                    key={team.id}
                    className={`p-3.5 rounded-2xl border-2 shadow-2xs border-b-4 ${theme.bg} ${theme.border}`}
                  >
                    <div className="flex items-center justify-between pb-2 mb-2 border-b border-black/10">
                      <div className="flex items-center gap-2">
                        <span className={`w-3.5 h-3.5 rounded-full ${theme.badge} shadow-xs shrink-0`} />
                        <span className="font-black text-sm text-slate-900">{team.name}</span>
                        <Badge className={`${theme.badge} text-white font-bold text-[10px] px-1.5 py-0 border-0`}>
                          {team.memberStudentIds?.length || 0}명
                        </Badge>
                      </div>

                      {/* 연필 편집 버튼 */}
                      <button
                        type="button"
                        onClick={() => {
                          const members = (team.memberStudentIds || [])
                            .map((mId) => studentsMap.get(mId))
                            .filter(Boolean) as MasterStudent[];
                          setEditingTeam({
                            id: team.id,
                            name: team.name,
                            themeId: team.themeId,
                            leaderStudentId: team.leaderStudentId || null,
                            members,
                          });
                        }}
                        className="flex items-center gap-1 text-[11px] font-bold text-slate-600 hover:text-slate-900 bg-white/90 hover:bg-white px-2 py-1 rounded-lg border border-slate-200 shadow-2xs transition-colors cursor-pointer"
                        title="팀 이름 및 색상 수정"
                      >
                        <Pencil className="w-3 h-3" />
                        <span>수정</span>
                      </button>
                    </div>

                    {/* 멤버 목록 */}
                    <div className="flex flex-wrap gap-1.5">
                      {(team.memberStudentIds || []).map((mId) => {
                        const student = studentsMap.get(mId);
                        const sName = student?.name || mId;
                        const isFemale = student ? isFemaleStudent(student) : false;

                        return (
                          <div
                            key={mId}
                            className="flex items-center gap-1 bg-white/95 px-2 py-1 rounded-xl border border-slate-200/90 shadow-2xs text-xs font-bold text-slate-800"
                          >
                            <span>{sName}</span>
                            {student && (
                              <span className={`text-[8px] font-bold px-1 rounded-xs ${isFemale ? 'bg-rose-100 text-rose-700' : 'bg-blue-100 text-blue-700'}`}>
                                {isFemale ? '여' : '남'}
                              </span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })
            )}
          </div>

          <div className="flex justify-end pt-3 border-t border-slate-100">
            <Button
              type="button"
              size="sm"
              onClick={() => onOpenChange(false)}
              className="px-5 text-xs font-bold bg-slate-800 hover:bg-slate-900 text-white"
            >
              닫기
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* 팀 이름 및 색상 수정 팝업 모달 */}
      <EditTeamModal
        isOpen={Boolean(editingTeam)}
        onOpenChange={(open) => !open && setEditingTeam(null)}
        team={editingTeam}
        onSave={handleSaveEditTeam}
      />
    </>
  );
};
