import React from 'react';
import type { Role, GlobalTimerConfig } from '@/lib/afterschool/types';
import {
  BookOpen, Users, ClipboardList, UserCheck, RotateCcw,
  Settings, Shield
} from 'lucide-react';

interface NavbarProps {
  role: Role;
  setRole: (role: Role) => void;
  activeTab: string;
  setActiveTab: (tab: string) => void;
  timerConfig: GlobalTimerConfig;
  onOpenAdminPanel: () => void;
  approvalDocCount: number;
}

export const Navbar: React.FC<NavbarProps> = ({
  role,
  setRole,
  activeTab,
  setActiveTab,
  timerConfig,
  onOpenAdminPanel,
  approvalDocCount,
}) => {
  const teacherTabs = [
    { key: 'course', icon: <BookOpen className="w-3.5 h-3.5" />, label: '강좌관리' },
    { key: 'student', icon: <Users className="w-3.5 h-3.5" />, label: '수강생' },
    { key: 'waiting', icon: <ClipboardList className="w-3.5 h-3.5" />, label: '대기자' },
    { key: 'attendance', icon: <UserCheck className="w-3.5 h-3.5" />, label: '출석부' },
    { key: 'refund', icon: <RotateCcw className="w-3.5 h-3.5" />, label: '환불' },
  ];

  const adminExtraTabs = [
    { key: 'control', icon: <Settings className="w-3.5 h-3.5" />, label: '타이머/락', danger: true },
  ];

  const isTeacherOrAdmin = role === 'teacher' || role === 'admin';

  return (
    <header className="bg-white border-b border-slate-200 sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-3 sm:px-6 h-14 flex items-center justify-between gap-2">
        {/* Brand */}
        <div
          className="flex items-center gap-2 cursor-pointer shrink-0"
          onClick={() => isTeacherOrAdmin ? setActiveTab('course') : setActiveTab('student-apply')}
        >
          <div className="w-7 h-7 bg-indigo-600 rounded-lg flex items-center justify-center text-white font-black text-xs shadow-sm shrink-0">방</div>
          <span className="font-bold text-slate-900 text-sm tracking-tight hidden sm:block">방과후학교</span>
          <span className="text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded font-mono hidden sm:block">한국초</span>
        </div>

        {/* Desktop Nav Tabs - Teacher/Admin */}
        {isTeacherOrAdmin && (
          <nav className="hidden md:flex items-center space-x-0.5 pl-2 border-l border-slate-200">
            {teacherTabs.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`px-2.5 py-1.5 text-xs font-semibold rounded-lg transition flex items-center gap-1 ${
                  activeTab === tab.key
                    ? 'bg-indigo-50 text-indigo-700 font-bold'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                }`}
              >
                {tab.icon}{tab.label}
              </button>
            ))}
            {role === 'admin' && adminExtraTabs.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`px-2.5 py-1.5 text-xs font-bold rounded-lg transition flex items-center gap-1 border ${
                  activeTab === tab.key
                    ? 'bg-rose-50 text-rose-700 border-rose-200'
                    : 'text-rose-600 border-slate-200 hover:bg-rose-50/50'
                }`}
              >
                {tab.icon}{tab.label}
              </button>
            ))}
          </nav>
        )}

        {/* Right Area */}
        <div className="flex items-center gap-1.5 ml-auto">
          {/* Master lock status */}
          {timerConfig.masterStatus === 'FORCE_LOCK' && (
            <span className="hidden sm:inline-flex items-center gap-1 bg-rose-50 text-rose-700 border border-rose-200 text-[10px] font-bold px-2 py-0.5 rounded-full">
              <span className="w-1.5 h-1.5 rounded-full bg-rose-600 animate-ping inline-block"></span>잠김
            </span>
          )}

          {/* app.cjwave.kr badge */}
          <div className="hidden sm:flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-blue-50 text-blue-700 border border-blue-200">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-500 inline-block"></span>
            <span className="font-mono hidden lg:block">app.cjwave.kr</span>
          </div>

          {/* Admin Panel Button (관리자만) */}
          {role === 'admin' && (
            <button
              onClick={onOpenAdminPanel}
              className="relative flex items-center gap-1 bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold px-2.5 py-1.5 rounded-xl shadow transition"
              title="관리자 패널 열기 (예체능방과후부장 전용)"
            >
              <Shield className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">관리자</span>
              {approvalDocCount > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 bg-rose-600 text-white rounded-full text-[9px] font-black flex items-center justify-center">
                  {approvalDocCount}
                </span>
              )}
            </button>
          )}

          {/* kisapp SSO 로그인 사용자 프로필 표시 (요구사항 3) */}
          <div className="hidden md:flex items-center gap-1.5 bg-slate-50 border px-2.5 py-1 rounded-xl text-xs">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
            <span className="text-slate-500">접속자:</span>
            <span className="font-bold text-slate-800">
              {role === 'admin' ? '예체능부장(교사)' : role === 'teacher' ? '김강사(교사)' : '김학생(학생)'}
            </span>
          </div>

          {/* Role Switcher */}
          <div className="bg-slate-100 p-0.5 rounded-lg border border-slate-200 flex items-center">
            <button
              onClick={() => setRole('admin')}
              className={`px-2 py-1 rounded-md text-[10px] font-bold transition ${role === 'admin' ? 'bg-amber-500 text-white shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}
            >
              부장
            </button>
            <button
              onClick={() => setRole('teacher')}
              className={`px-2 py-1 rounded-md text-[10px] font-bold transition ${role === 'teacher' ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}
            >
              강사
            </button>
            <button
              onClick={() => setRole('student')}
              className={`px-2 py-1 rounded-md text-[10px] font-bold transition ${role === 'student' ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}
            >
              학생
            </button>
          </div>
        </div>
      </div>
    </header>
  );
};
