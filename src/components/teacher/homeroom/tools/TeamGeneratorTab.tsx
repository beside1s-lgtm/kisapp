'use client';

import React, { useState } from 'react';
import {
  Users,
  Sparkles,
  Crown,
  Printer,
  Copy,
  RotateCcw,
  Dice6,
  Check,
  Pencil,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { motion, AnimatePresence } from 'framer-motion';
import { useToast } from '@/hooks/use-toast';
import type { MasterStudent } from '@/lib/types/masterStudent';
import { isMaleStudent, isFemaleStudent } from '@/lib/services/seatingService';
import {
  TEAM_COLOR_PALETTES,
  type TeamColorTheme,
  type ClassTeamData,
  saveClassTeams,
  getSavedClassTeams,
} from '@/lib/types/teams';
import { EditTeamModal } from './EditTeamModal';

interface TeamGeneratorTabProps {
  students: MasterStudent[];
  classLabel: string;
  classKey?: string;
  isFullscreen?: boolean;
}

interface GeneratedTeam {
  id: number;
  name: string;
  themeId?: string;
  colorTheme: string;
  leaderStudentId: string | null;
  members: MasterStudent[];
}

const TEAM_THEMES = TEAM_COLOR_PALETTES;

export const TeamGeneratorTab: React.FC<TeamGeneratorTabProps> = ({
  students,
  classLabel,
  classKey = 'default_class',
  isFullscreen = false,
}) => {
  const { toast } = useToast();

  // 팀 나누기 기준: 'BY_COUNT'(팀 개수) vs 'BY_SIZE'(팀당 인원수)
  const [splitMode, setSplitMode] = useState<'BY_COUNT' | 'BY_SIZE'>('BY_COUNT');
  const [targetNumber, setTargetNumber] = useState<number>(4); // 기본 4개 팀
  const [genderBalance, setGenderBalance] = useState<boolean>(true); // 남녀 성별 균등

  // 생성된 팀 목록
  const [teams, setTeams] = useState<GeneratedTeam[]>([]);
  // 팀 수정 모달 상태
  const [editingTeam, setEditingTeam] = useState<GeneratedTeam | null>(null);

  // 학급 기존 팀 로드
  React.useEffect(() => {
    if (!classKey || students.length === 0) return;
    const saved = getSavedClassTeams(classKey);
    if (saved && saved.length > 0) {
      const studentMap = new Map<string, MasterStudent>();
      students.forEach((s) => {
        studentMap.set(s.studentId || s.id || '', s);
        if (s.studentNum) studentMap.set(String(s.studentNum), s);
      });

      const loadedTeams: GeneratedTeam[] = saved.map((st) => {
        const theme =
          TEAM_COLOR_PALETTES.find((p) => p.id === st.themeId) ||
          TEAM_COLOR_PALETTES[(st.id - 1) % TEAM_COLOR_PALETTES.length];
        const members: MasterStudent[] = [];
        (st.memberStudentIds || []).forEach((mId) => {
          const student = studentMap.get(mId);
          if (student && !members.some((m) => (m.studentId || m.id) === (student.studentId || student.id))) {
            members.push(student);
          }
        });

        return {
          id: st.id,
          name: st.name,
          themeId: theme.id,
          colorTheme: theme.border,
          leaderStudentId: st.leaderStudentId,
          members,
        };
      });

      if (loadedTeams.some((t) => t.members.length > 0)) {
        setTeams(loadedTeams);
      }
    }
  }, [classKey, students]);

  // 팀 저장 헬퍼
  const persistTeams = (newTeams: GeneratedTeam[]) => {
    setTeams(newTeams);
    if (!classKey) return;
    const exportData: ClassTeamData[] = newTeams.map((t) => ({
      id: t.id,
      name: t.name,
      themeId: t.themeId || TEAM_COLOR_PALETTES[(t.id - 1) % TEAM_COLOR_PALETTES.length].id,
      leaderStudentId: t.leaderStudentId,
      memberStudentIds: t.members.map((m) => m.studentId || m.id || m.studentNum || ''),
    }));
    saveClassTeams(classKey, exportData);
  };

  // 팀 나누기 실행
  const handleGenerateTeams = () => {
    if (students.length === 0) {
      toast({
        title: '나눌 학생이 없습니다',
        description: '학급에 등록된 학생이 없습니다.',
        variant: 'destructive',
      });
      return;
    }

    let teamCount = targetNumber;
    if (splitMode === 'BY_SIZE') {
      teamCount = Math.max(1, Math.ceil(students.length / targetNumber));
    }

    // 팀 컨테이너 초기화
    const newTeams: GeneratedTeam[] = Array.from({ length: teamCount }, (_, idx) => {
      const theme = TEAM_THEMES[idx % TEAM_THEMES.length];
      return {
        id: idx + 1,
        name: `${idx + 1}모둠 (${theme.name.split(' ')[0]})`,
        themeId: theme.id,
        colorTheme: theme.border,
        leaderStudentId: null,
        members: [],
      };
    });

    if (genderBalance) {
      // 남녀 분리 후 골고루 라운드로빈 배분
      const boys = students.filter(isMaleStudent).sort(() => Math.random() - 0.5);
      const girls = students.filter(isFemaleStudent).sort(() => Math.random() - 0.5);

      let tIdx = 0;
      boys.forEach((b) => {
        newTeams[tIdx % teamCount].members.push(b);
        tIdx++;
      });

      // 여학생은 역순으로 배분하여 균형 맞춤
      tIdx = teamCount - 1;
      girls.forEach((g) => {
        newTeams[((tIdx % teamCount) + teamCount) % teamCount].members.push(g);
        tIdx--;
      });
    } else {
      // 완전 무작위 셔플 배분
      const shuffled = [...students].sort(() => Math.random() - 0.5);
      shuffled.forEach((s, idx) => {
        newTeams[idx % teamCount].members.push(s);
      });
    }

    // 각 팀 내부 번호순 정렬
    newTeams.forEach((t) => {
      t.members.sort((a, b) => (Number(a.studentNum) || 0) - (Number(b.studentNum) || 0));
    });

    persistTeams(newTeams);

    toast({
      title: '👥 모둠/팀 생성 완료!',
      description: `총 ${students.length}명의 학생이 ${teamCount}개 팀으로 나누어졌으며, 자리배치 색상과 실시간 동기화되었습니다.`,
    });
  };

  // 특정 팀의 팀장 랜덤 뽑기
  const handlePickLeader = (teamId: number) => {
    const updated = teams.map((t) => {
      if (t.id === teamId && t.members.length > 0) {
        const rand = t.members[Math.floor(Math.random() * t.members.length)];
        const randId = rand.studentId || rand.id || '';
        return {
          ...t,
          leaderStudentId: randId,
        };
      }
      return t;
    });

    persistTeams(updated);

    const targetTeam = teams.find((t) => t.id === teamId);
    if (targetTeam && targetTeam.members.length > 0) {
      toast({
        title: '👑 팀장 선정 완료',
        description: `${targetTeam.name}의 팀장이 새로 선정되었습니다!`,
      });
    }
  };

  // 팀 정보 (이름, 색상, 팀장) 수정 저장
  const handleSaveEditedTeam = (updated: {
    teamId: number;
    name: string;
    themeId: string;
    leaderStudentId: string | null;
  }) => {
    const theme =
      TEAM_COLOR_PALETTES.find((p) => p.id === updated.themeId) || TEAM_COLOR_PALETTES[0];
    const newTeams = teams.map((t) => {
      if (t.id === updated.teamId) {
        return {
          ...t,
          name: updated.name,
          themeId: updated.themeId,
          colorTheme: theme.border,
          leaderStudentId: updated.leaderStudentId,
        };
      }
      return t;
    });

    persistTeams(newTeams);
    toast({
      title: '팀 설정 변경 완료',
      description: `[${updated.name}] 팀의 이름과 색상이 저장되어 자리배치도에 반영되었습니다.`,
    });
  };

  // 팀 명단 클립보드 복사
  const handleCopyClipboard = () => {
    if (teams.length === 0) return;

    let text = `[${classLabel} 모둠/팀 편성표]\n\n`;
    teams.forEach((t) => {
      text += `■ ${t.name} (총 ${t.members.length}명)\n`;
      const membersText = t.members
        .map((m) => {
          const isLeader = (m.studentId || m.id) === t.leaderStudentId;
          return `${m.studentNum ? `${m.studentNum}번 ` : ''}${m.name}${isLeader ? '(👑팀장)' : ''}`;
        })
        .join(', ');
      text += `  ${membersText}\n\n`;
    });

    navigator.clipboard.writeText(text).then(() => {
      toast({
        title: '팀 명단 복사 완료',
        description: '클립보드에 복사되었습니다.',
      });
    });
  };

  // A4 인쇄
  const handlePrint = () => {
    if (teams.length === 0) return;

    const popup = window.open('', '_blank', 'width=900,height=750');
    if (!popup) {
      toast({
        title: '팝업 차단됨',
        description: '인쇄 팝업을 허용해주세요.',
        variant: 'destructive',
      });
      return;
    }

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>${classLabel} 모둠/팀 편성표</title>
        <style>
          @page { size: A4 landscape; margin: 15mm; }
          body { font-family: 'Pretendard', 'Noto Sans KR', sans-serif; padding: 10px; color: #111; }
          .header { text-align: center; margin-bottom: 20px; }
          .title { font-size: 24px; font-weight: bold; margin-bottom: 5px; }
          .subtitle { font-size: 13px; color: #666; }
          .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 16px; }
          .team-card { border: 2px solid #cbd5e1; border-radius: 8px; padding: 12px; background: #fafafa; }
          .team-title { font-size: 15px; font-weight: bold; margin-bottom: 10px; border-bottom: 1.5px solid #000; padding-bottom: 4px; }
          .member { font-size: 12px; padding: 3px 0; display: flex; justify-content: space-between; }
          .leader { font-weight: bold; color: #b45309; }
          @media print {
            body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="title">${classLabel} 모둠/팀 편성표</div>
          <div class="subtitle">편성일: ${new Date().toLocaleDateString()} | 총 학생수: ${students.length}명</div>
        </div>
        <div class="grid">
          ${teams
            .map((t) => {
              const membersHtml = t.members
                .map((m) => {
                  const isLeader = (m.studentId || m.id) === t.leaderStudentId;
                  return `
                    <div class="member ${isLeader ? 'leader' : ''}">
                      <span>${m.studentNum ? `${m.studentNum}번 ` : ''}${m.name}</span>
                      <span>${isLeader ? '👑팀장' : ''} (${isMaleStudent(m) ? '남' : '여'})</span>
                    </div>
                  `;
                })
                .join('');
              return `
                <div class="team-card">
                  <div class="team-title">${t.name} (${t.members.length}명)</div>
                  ${membersHtml}
                </div>
              `;
            })
            .join('')}
        </div>
      </body>
      </html>
    `;

    popup.document.write(html);
    popup.document.close();
    popup.focus();
    setTimeout(() => {
      popup.print();
    }, 300);
  };

  return (
    <div className={`w-full font-sans ${isFullscreen ? 'space-y-6' : 'space-y-5'}`}>
      {/* ─── 상단 설정 패널 ─── */}
      <div className="p-4 sm:p-5 rounded-3xl bg-white border-2 border-slate-200/90 shadow-sm space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          {/* 모드 선택: 팀 개수 vs 팀당 인원수 */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs sm:text-sm font-black text-slate-800 whitespace-nowrap">
              나누기 방식:
            </span>
            <div className="flex items-center p-1 bg-slate-100 rounded-2xl border border-slate-200/80">
              <motion.button
                type="button"
                whileTap={{ scale: 0.95 }}
                onClick={() => setSplitMode('BY_COUNT')}
                className={`text-xs px-3.5 py-1.5 rounded-xl font-black transition-all select-none whitespace-nowrap ${
                  splitMode === 'BY_COUNT'
                    ? 'bg-[#2471B2] text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                팀 개수로 나누기
              </motion.button>
              <motion.button
                type="button"
                whileTap={{ scale: 0.95 }}
                onClick={() => setSplitMode('BY_SIZE')}
                className={`text-xs px-3.5 py-1.5 rounded-xl font-black transition-all select-none whitespace-nowrap ${
                  splitMode === 'BY_SIZE'
                    ? 'bg-[#2471B2] text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                팀당 인원수로 나누기
              </motion.button>
            </div>
          </div>

          <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-slate-700 select-none whitespace-nowrap">
            <input
              type="checkbox"
              checked={genderBalance}
              onChange={(e) => setGenderBalance(e.target.checked)}
              className="w-4 h-4 rounded text-[#2471B2] focus:ring-[#2471B2]"
            />
            <span>남녀 성별 균등 배분</span>
          </label>
        </div>

        {/* 숫자 칩 선택 */}
        <div>
          <label className="text-xs font-bold text-slate-600 mb-2 block whitespace-nowrap">
            {splitMode === 'BY_COUNT' ? '생성할 팀 개수 선택:' : '팀당 목표 인원수 선택:'}
          </label>
          <div className="grid grid-cols-4 sm:grid-cols-7 gap-2">
            {[2, 3, 4, 5, 6, 7, 8].map((num) => (
              <motion.button
                key={num}
                type="button"
                whileHover={{ scale: 1.05, y: -2 }}
                whileTap={{ scale: 0.95, y: 1 }}
                transition={{ type: 'spring', stiffness: 500, damping: 20 }}
                onClick={() => setTargetNumber(num)}
                className={`h-10 rounded-2xl font-black text-xs sm:text-sm transition-all border-b-4 select-none whitespace-nowrap ${
                  targetNumber === num
                    ? 'bg-[#2471B2] text-white border-[#1A5384] shadow-sm'
                    : 'bg-slate-100 hover:bg-slate-200/80 text-slate-700 border-slate-300'
                }`}
              >
                {splitMode === 'BY_COUNT' ? `${num}개 팀` : `${num}명씩`}
              </motion.button>
            ))}
          </div>
        </div>

        {/* 하단 액션 버튼 */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t-2 border-slate-100">
          <motion.button
            type="button"
            whileHover={{ scale: 1.04, y: -2 }}
            whileTap={{ scale: 0.94, y: 2 }}
            transition={{ type: 'spring', stiffness: 500, damping: 20 }}
            onClick={handleGenerateTeams}
            className="flex items-center gap-2.5 h-12 px-7 rounded-2xl bg-[#B01E23] hover:bg-[#9B191D] border-b-4 border-[#7E1519] text-white font-black text-xs sm:text-sm shadow-md transition-all select-none whitespace-nowrap break-keep active:border-b-0 active:translate-y-1"
          >
            <Sparkles className="w-4 h-4 text-white" />
            <span>모둠/팀 생성하기</span>
          </motion.button>

          {teams.length > 0 && (
            <div className="flex items-center gap-2">
              <motion.button
                type="button"
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.95 }}
                onClick={handleCopyClipboard}
                className="flex items-center gap-1.5 h-9 px-3.5 rounded-2xl text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 border-b-4 border-slate-300 transition-all select-none whitespace-nowrap"
              >
                <Copy className="w-3.5 h-3.5 text-slate-500" />
                <span>명단 복사</span>
              </motion.button>
              <motion.button
                type="button"
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.95 }}
                onClick={handlePrint}
                className="flex items-center gap-1.5 h-9 px-3.5 rounded-2xl text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 border-b-4 border-slate-300 transition-all select-none whitespace-nowrap"
              >
                <Printer className="w-3.5 h-3.5 text-slate-500" />
                <span>A4 인쇄</span>
              </motion.button>
            </div>
          )}
        </div>
      </div>

      {/* ─── 생성된 팀 결과 그리드 (듀오링고 스타일 모둠 카드) ─── */}
      {teams.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {teams.map((team, idx) => {
            const theme =
              TEAM_COLOR_PALETTES.find((p) => p.id === team.themeId) ||
              TEAM_COLOR_PALETTES[(team.id - 1) % TEAM_COLOR_PALETTES.length];
            const boyCount = team.members.filter(isMaleStudent).length;
            const girlCount = team.members.length - boyCount;

            return (
              <motion.div
                key={team.id}
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                whileHover={{ scale: 1.02, y: -2 }}
                transition={{ type: 'spring', stiffness: 450, damping: 18 }}
                className={`rounded-3xl border-2 ${theme.border} border-b-4 bg-white shadow-sm overflow-hidden flex flex-col select-none`}
              >
                {/* 팀 헤더 */}
                <div
                  className={`p-3.5 ${theme.bg} border-b-2 ${theme.border} flex items-center justify-between flex-wrap gap-1`}
                >
                  <div className="flex-1 min-w-0 mr-1">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <h4 className="text-sm font-black text-slate-900 truncate">{team.name}</h4>
                      {/* 화살표 위치: 팀 이름/색상 수정 연필 버튼 */}
                      <motion.button
                        type="button"
                        whileHover={{ scale: 1.15 }}
                        whileTap={{ scale: 0.9 }}
                        onClick={() => setEditingTeam(team)}
                        title="팀 이름 및 테마 색상 변경"
                        className="p-1 rounded-lg hover:bg-black/10 text-slate-600 hover:text-slate-900 transition-colors cursor-pointer shrink-0"
                      >
                        <Pencil className="w-3.5 h-3.5 text-slate-600" />
                      </motion.button>
                    </div>
                    <span className="text-[11px] text-slate-600 font-bold whitespace-nowrap block mt-0.5">
                      총 {team.members.length}명 (남 {boyCount} · 여 {girlCount})
                    </span>
                  </div>
                  <motion.button
                    type="button"
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => handlePickLeader(team.id)}
                    className="flex items-center gap-1 h-7 px-2.5 text-[11px] font-black bg-[#C49832] hover:bg-[#B0872A] text-white border-b-2 border-[#8E6D21] rounded-xl shadow-2xs whitespace-nowrap shrink-0"
                  >
                    <Crown className="w-3.5 h-3.5 text-white fill-white" />
                    <span>팀장 뽑기</span>
                  </motion.button>
                </div>

                {/* 팀원 목록 */}
                <div className="p-3 divide-y divide-slate-100 flex-1 space-y-1">
                  {team.members.map((member) => {
                    const mid = member.studentId || member.id || '';
                    const isLeader = team.leaderStudentId === mid;
                    const isMale = isMaleStudent(member);

                    return (
                      <div
                        key={mid}
                        className={`pt-1.5 first:pt-0 flex items-center justify-between text-xs py-1 rounded-xl px-2 transition-colors ${
                          isLeader ? 'bg-amber-100/90 font-black text-amber-950 border border-amber-300' : 'hover:bg-slate-50'
                        }`}
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          {member.photoUrl ? (
                            <img
                              src={member.photoUrl}
                              alt={member.name}
                              className="w-7 h-7 rounded-full object-cover border border-slate-200 shrink-0"
                            />
                          ) : (
                            <div
                              className={`w-7 h-7 rounded-full flex items-center justify-center font-black text-[10px] shrink-0 text-white ${
                                isMale
                                  ? 'bg-[#2471B2]'
                                  : 'bg-[#B01E23]'
                              }`}
                            >
                              {member.name.slice(-2)}
                            </div>
                          )}
                          <div className="flex items-center gap-1 truncate">
                            <span className="text-[10px] font-mono text-slate-400 font-bold shrink-0">
                              {member.studentNum ? `${member.studentNum}.` : ''}
                            </span>
                            <span className="font-bold text-slate-900 truncate whitespace-nowrap">
                              {member.name}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0 ml-2">
                          {isLeader && (
                            <span className="flex items-center gap-0.5 text-[9px] font-black bg-[#C49832] text-white px-1.5 py-0.2 rounded-full whitespace-nowrap">
                              👑 팀장
                            </span>
                          )}
                          <span
                            className={`text-[9px] font-black px-1.5 py-0.2 rounded-full whitespace-nowrap ${
                              isMale ? 'bg-blue-100 text-[#2471B2]' : 'bg-rose-100 text-[#B01E23]'
                            }`}
                          >
                            {isMale ? '남' : '여'}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* 팀 이름 및 색상 수정 모달 */}
      <EditTeamModal
        isOpen={Boolean(editingTeam)}
        onOpenChange={(open) => !open && setEditingTeam(null)}
        team={editingTeam}
        onSave={handleSaveEditedTeam}
      />
    </div>
  );
};
