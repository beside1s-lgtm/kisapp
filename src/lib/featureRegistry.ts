import React from 'react';
import {
  Users2,
  BookOpen,
  Bus,
  Activity,
  Stethoscope,
  HeartHandshake,
  Users,
  Plus,
  Inbox,
  Send,
  FileClock,
  Eye,
  ListFilter,
  CalendarCheck,
  FileText,
  Briefcase,
  Clock,
  UserPlus,
  Calendar,
  Undo2,
  XCircle,
  Sparkles,
  type LucideIcon,
} from 'lucide-react';

/**
 * 포털 전체 기능(페이지)에 대한 단일 원천 목록.
 *
 * 사이드바 "바로가기 설정"(개인화 즐겨찾기)과 "기능 검색"(빠른 도구)이
 * 모두 이 목록 하나를 함께 사용한다. 새 기능/페이지를 추가할 때는
 * 이 배열에 항목 하나만 추가하면 두 기능(바로가기 후보, 검색 결과)에
 * 자동으로 반영된다 — 검색에서 빼고 싶으면 searchable: false,
 * 바로가기 후보에서 빼고 싶으면 pinnable: false 를 지정한다.
 */
export interface FeatureItem {
  id: string;
  label: string;
  href?: string;
  iconName: string;
  category: 'education' | 'approval' | 'teacher' | 'admin' | 'tool';
  categoryLabel: string;
  description?: string;
  /** 검색 매칭에 쓰이는 동의어/약어 (예: "봉사" 항목에 "자원봉사", "VMS" 등) */
  keywords?: string[];
  badgeKey?: 'inbox' | 'pending' | 'teacher' | 'absence' | 'trip';
  actionType?: 'link' | 'calendar-sync';
  /** 사이드바 "바로가기 설정" 모달의 선택 후보로 노출할지 (기본 true) */
  pinnable?: boolean;
  /** "기능 검색"의 결과 후보로 노출할지 (기본 true) */
  searchable?: boolean;
}

export const ALL_FEATURES: FeatureItem[] = [
  // 1. 교육활동
  {
    id: 'homeroom',
    label: '담임 업무 (출결/체험)',
    href: '/teacher/homeroom',
    iconName: 'Users2',
    category: 'education',
    categoryLabel: '교육활동',
    description: '학급 출결, 결석/체험학습 대리 작성 및 숙제/교실 관리',
    keywords: ['담임', '출결', '조퇴', '결석', '체험학습 대리'],
  },
  {
    id: 'afterschool',
    label: '방과후 수업 관리',
    href: '/teacher/afterschool',
    iconName: 'BookOpen',
    category: 'education',
    categoryLabel: '교육활동',
    description: '본인 담당 방과후 강좌 출석부 및 수강생 관리',
    keywords: ['방과후학교', '강좌', '수강생'],
  },
  {
    id: 'bus',
    label: '스쿨버스 탑승 관리',
    href: '/teacher/bus',
    iconName: 'Bus',
    category: 'education',
    categoryLabel: '교육활동',
    description: '등하교/방과후 버스 탑승 체크 및 조장/좌석표 확인',
    keywords: ['통학버스', '탑승', '좌석표'],
  },
  {
    id: 'pe',
    label: '학교 체육 (PAPS)',
    href: '/teacher/pe',
    iconName: 'Activity',
    category: 'education',
    categoryLabel: '교육활동',
    description: '체격/체력 측정 및 PAPS 종합 평가 관리',
    keywords: ['paps', '체력측정', '체격측정'],
  },
  {
    id: 'health',
    label: '학생 건강 (보건실)',
    href: '/teacher/health',
    iconName: 'Stethoscope',
    category: 'education',
    categoryLabel: '교육활동',
    description: '보건실 방문 일지, 약품 및 학생 건강기록 관리',
    keywords: ['보건실', '양호실', '건강기록', '투약'],
  },
  {
    id: 'volunteer',
    label: '학생 봉사활동',
    href: '/volunteer',
    iconName: 'HeartHandshake',
    category: 'education',
    categoryLabel: '교육활동',
    description: '개인/단체 봉사활동 계획서 상신 및 확인서 관리',
    keywords: ['자원봉사', 'vms', '확인서'],
  },
  {
    id: 'students',
    label: '통합 학생 계정 관리',
    href: '/admin/students',
    iconName: 'Users',
    category: 'education',
    categoryLabel: '교육활동',
    description: '전교생 학적, 계정, 사진 및 형제자매 관리',
    keywords: ['학적', '학생계정'],
  },

  // 2. 전자결재
  {
    id: 'new-doc',
    label: '신규 기안 작성',
    href: '/new',
    iconName: 'Plus',
    category: 'approval',
    categoryLabel: '전자결재',
    description: '새로운 결재 문서 작성 및 결재선 상신',
    keywords: ['기안문', '새 문서', '결재 작성'],
  },
  {
    id: 'inbox',
    label: '미결재함',
    href: '/inbox',
    iconName: 'Inbox',
    category: 'approval',
    categoryLabel: '전자결재',
    description: '결재 대기 중인 문서 확인 및 승인/반려',
    badgeKey: 'inbox',
  },
  {
    id: 'sent',
    label: '상신함',
    href: '/sent',
    iconName: 'Send',
    category: 'approval',
    categoryLabel: '전자결재',
    description: '내가 상신한 결재 진행 현황 조회',
  },
  {
    id: 'pending',
    label: '진행 문서함',
    href: '/pending',
    iconName: 'FileClock',
    category: 'approval',
    categoryLabel: '전자결재',
    description: '결재 진행 중인 문서 목록',
    badgeKey: 'pending',
  },
  {
    id: 'circular',
    label: '공람 문서함',
    href: '/circular',
    iconName: 'Eye',
    category: 'approval',
    categoryLabel: '전자결재',
    description: '수신된 공람 문서 열람 및 확인',
  },
  {
    id: 'recalled',
    label: '회수 문서함',
    href: '/recalled',
    iconName: 'Undo2',
    category: 'approval',
    categoryLabel: '전자결재',
    description: '상신 후 회수한 문서 목록',
    pinnable: false,
  },
  {
    id: 'rejected',
    label: '반려 문서함',
    href: '/rejected',
    iconName: 'XCircle',
    category: 'approval',
    categoryLabel: '전자결재',
    description: '결재자에게 반려된 문서 목록 및 재상신',
    pinnable: false,
  },
  {
    id: 'registry',
    label: '문서등록대장',
    href: '/registry',
    iconName: 'ListFilter',
    category: 'approval',
    categoryLabel: '전자결재',
    description: '학교 전체 완료 문서 등록대장 열람',
  },
  {
    id: 'absence-registry',
    label: '결석계 보관함',
    href: '/attendance-registry',
    iconName: 'CalendarCheck',
    category: 'approval',
    categoryLabel: '전자결재',
    description: '학부모 제출 결석계 전체 보관함',
    badgeKey: 'absence',
  },
  {
    id: 'field-trip-registry',
    label: '체험학습 문서함',
    href: '/field-trip-registry',
    iconName: 'FileText',
    category: 'approval',
    categoryLabel: '전자결재',
    description: '학부모 제출 교외체험학습 신청서 및 보고서',
    badgeKey: 'trip',
  },
  {
    id: 'volunteer-registry',
    label: '봉사활동 대장',
    href: '/volunteer?tab=registry',
    iconName: 'HeartHandshake',
    category: 'approval',
    categoryLabel: '전자결재',
    description: '학교 전체 학생 봉사활동 계획서/확인서 통합 대장',
    keywords: ['자원봉사', 'vms'],
    pinnable: false,
  },

  // 3. 교원 서비스
  {
    id: 'teacher-duty',
    label: '교원 복무',
    href: '/teacher/duty',
    iconName: 'Briefcase',
    category: 'teacher',
    categoryLabel: '교원 서비스',
    description: '출장, 연가, 병가 등 교원 복무 신청 및 결재',
    badgeKey: 'teacher',
    keywords: ['출장', '연가', '병가', '휴가', '조퇴'],
  },
  {
    id: 'teacher-overtime',
    label: '초과근무',
    href: '/teacher/overtime',
    iconName: 'Clock',
    category: 'teacher',
    categoryLabel: '교원 서비스',
    description: '시간외 근무 사전 신청 및 확인',
    keywords: ['야근', '시간외근무'],
  },
  {
    id: 'teacher-substitution',
    label: '보결 관리',
    href: '/teacher/substitution',
    iconName: 'UserPlus',
    category: 'teacher',
    categoryLabel: '교원 서비스',
    description: '결근 교사 보결 수업 배정 및 이력 관리',
  },
  {
    id: 'teacher-registry',
    label: '교원 서비스 조회',
    href: '/teacher/registry',
    iconName: 'ListFilter',
    category: 'teacher',
    categoryLabel: '교원 서비스',
    description: '개인별 복무 및 교원 서비스 내역 조회',
  },

  // 4. 관리자
  {
    id: 'admin-bus',
    label: '스쿨버스 관리 (관리자)',
    href: '/admin/bus',
    iconName: 'Bus',
    category: 'admin',
    categoryLabel: '관리자',
    description: '스쿨버스 노선/좌석/탑승 시스템 전체 관리',
    pinnable: false,
  },
  {
    id: 'admin-afterschool',
    label: '방과후학교 관리 (관리자)',
    href: '/admin/afterschool',
    iconName: 'BookOpen',
    category: 'admin',
    categoryLabel: '관리자',
    description: '방과후 강좌 개설, 수강생 배정 및 강사 관리',
    pinnable: false,
  },

  // 5. 빠른 도구
  {
    id: 'calendar-sync',
    label: '캘린더 동기화',
    iconName: 'Calendar',
    category: 'tool',
    categoryLabel: '빠른 도구',
    description: '구글 캘린더 및 학사 일정 동기화',
    actionType: 'calendar-sync',
  },
];

// 기본 추천 바로가기 항목 ID 목록
export const DEFAULT_SHORTCUT_IDS: string[] = [
  'homeroom',
  'afterschool',
  'bus',
  'volunteer',
];

const FEATURE_ICON_MAP: Record<string, LucideIcon> = {
  Users2,
  BookOpen,
  Bus,
  Activity,
  Stethoscope,
  HeartHandshake,
  Users,
  Plus,
  Inbox,
  Send,
  FileClock,
  Eye,
  ListFilter,
  CalendarCheck,
  FileText,
  Briefcase,
  Clock,
  UserPlus,
  Calendar,
  Undo2,
  XCircle,
};

export function getFeatureIcon(iconName: string, className = 'w-3.5 h-3.5'): React.ReactElement {
  const Icon = FEATURE_ICON_MAP[iconName] || Sparkles;
  return React.createElement(Icon, { className });
}
