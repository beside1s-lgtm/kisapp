import React from 'react';
import type { Role } from '@/lib/afterschool/types';
import { Home, UserCheck, BookOpen, ClipboardList, Package } from 'lucide-react';

interface MobileBottomNavProps {
  role: Role;
  activeTab: string;
  setActiveTab: (tab: string) => void;
  approvalDocCount: number;
}

export const MobileBottomNav: React.FC<MobileBottomNavProps> = ({
  role,
  activeTab,
  setActiveTab,
  approvalDocCount,
}) => {
  if (role === 'student') {
    return (
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-slate-200 flex">
        <button
          onClick={() => setActiveTab('student-apply')}
          className={`flex-1 flex flex-col items-center py-2.5 gap-0.5 text-[10px] font-bold transition ${
            activeTab === 'student-apply' ? 'text-indigo-600' : 'text-slate-500'
          }`}
        >
          <Home className="w-5 h-5" />홈
        </button>
        <button
          onClick={() => setActiveTab('student-my')}
          className={`flex-1 flex flex-col items-center py-2.5 gap-0.5 text-[10px] font-bold transition ${
            activeTab === 'student-my' ? 'text-indigo-600' : 'text-slate-500'
          }`}
        >
          <ClipboardList className="w-5 h-5" />내 신청
        </button>
      </nav>
    );
  }

  // Teacher / Admin tabs
  const tabs = [
    { key: 'course', icon: <Home className="w-5 h-5" />, label: '홈' },
    { key: 'attendance', icon: <UserCheck className="w-5 h-5" />, label: '출석부' },
    { key: 'student', icon: <BookOpen className="w-5 h-5" />, label: '수강생' },
    { key: 'refund', icon: <ClipboardList className="w-5 h-5" />, label: '환불' },
    {
      key: 'batch',
      icon: (
        <div className="relative">
          <Package className="w-5 h-5" />
          {approvalDocCount > 0 && (
            <span className="absolute -top-1.5 -right-1.5 w-3.5 h-3.5 bg-rose-500 text-white rounded-full text-[8px] font-black flex items-center justify-center">
              {approvalDocCount}
            </span>
          )}
        </div>
      ),
      label: '결재함',
    },
  ];

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-slate-200 flex">
      {tabs.map((tab) => (
        <button
          key={tab.key}
          onClick={() => {
            if (tab.key === 'batch') {
              setActiveTab('attendance');
            } else {
              setActiveTab(tab.key);
            }
          }}
          className={`flex-1 flex flex-col items-center py-2.5 gap-0.5 text-[10px] font-bold transition ${
            activeTab === tab.key ||
            (tab.key === 'batch' && activeTab === 'attendance')
              ? 'text-indigo-600'
              : 'text-slate-500'
          }`}
        >
          {tab.icon}
          {tab.label}
        </button>
      ))}
    </nav>
  );
};
