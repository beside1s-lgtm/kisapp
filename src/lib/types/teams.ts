export interface TeamColorTheme {
  id: string;
  name: string;
  border: string;
  bg: string;
  badge: string;
  ring: string;
  text: string;
  headerBg: string;
}

export const TEAM_COLOR_PALETTES: TeamColorTheme[] = [
  {
    id: 'blue',
    name: '청룡 (블루)',
    border: 'border-blue-400',
    bg: 'bg-blue-50/80',
    headerBg: 'bg-blue-100/90',
    badge: 'bg-blue-600',
    ring: 'ring-blue-300',
    text: 'text-blue-800',
  },
  {
    id: 'amber',
    name: '백호 (골드/옐로우)',
    border: 'border-amber-400',
    bg: 'bg-amber-50/80',
    headerBg: 'bg-amber-100/90',
    badge: 'bg-amber-600',
    ring: 'ring-amber-300',
    text: 'text-amber-800',
  },
  {
    id: 'rose',
    name: '주작 (레드/로즈)',
    border: 'border-rose-400',
    bg: 'bg-rose-50/80',
    headerBg: 'bg-rose-100/90',
    badge: 'bg-rose-600',
    ring: 'ring-rose-300',
    text: 'text-rose-800',
  },
  {
    id: 'emerald',
    name: '현무 (그린)',
    border: 'border-emerald-400',
    bg: 'bg-emerald-50/80',
    headerBg: 'bg-emerald-100/90',
    badge: 'bg-emerald-600',
    ring: 'ring-emerald-300',
    text: 'text-emerald-800',
  },
  {
    id: 'purple',
    name: '황룡 (퍼플)',
    border: 'border-purple-400',
    bg: 'bg-purple-50/80',
    headerBg: 'bg-purple-100/90',
    badge: 'bg-purple-600',
    ring: 'ring-purple-300',
    text: 'text-purple-800',
  },
  {
    id: 'indigo',
    name: '은하 (인디고)',
    border: 'border-indigo-400',
    bg: 'bg-indigo-50/80',
    headerBg: 'bg-indigo-100/90',
    badge: 'bg-indigo-600',
    ring: 'ring-indigo-300',
    text: 'text-indigo-800',
  },
  {
    id: 'orange',
    name: '태양 (오렌지)',
    border: 'border-orange-400',
    bg: 'bg-orange-50/80',
    headerBg: 'bg-orange-100/90',
    badge: 'bg-orange-600',
    ring: 'ring-orange-300',
    text: 'text-orange-800',
  },
  {
    id: 'teal',
    name: '바다 (민트/틸)',
    border: 'border-teal-400',
    bg: 'bg-teal-50/80',
    headerBg: 'bg-teal-100/90',
    badge: 'bg-teal-600',
    ring: 'ring-teal-300',
    text: 'text-teal-800',
  },
];

export interface ClassTeamData {
  id: number;
  name: string;
  themeId: string;
  leaderStudentId: string | null;
  memberStudentIds: string[]; // studentId or studentNum or id
}

export function getSavedClassTeams(classKey: string): ClassTeamData[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(`kis_class_teams_${classKey}`);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveClassTeams(classKey: string, teams: ClassTeamData[]) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(`kis_class_teams_${classKey}`, JSON.stringify(teams));
    window.dispatchEvent(new CustomEvent('class-teams-updated', { detail: { classKey, teams } }));
  } catch (e) {
    console.error('Failed to save class teams:', e);
  }
}
