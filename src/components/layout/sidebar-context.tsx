'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { useAuth } from '@/hooks/use-auth';

interface SidebarContextType {
  isSidebarOpen: boolean;
  toggleSidebar: () => void;
  setIsSidebarOpen: (open: boolean) => void;
}

const SidebarContext = createContext<SidebarContextType>({
  isSidebarOpen: true,
  toggleSidebar: () => {},
  setIsSidebarOpen: () => {},
});

export const SidebarProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const { profile } = useAuth();
  // 직책이 '담당'인 사용자는 사이드바를 항상 닫힌 상태로 고정
  const isDamdan = profile?.role === '담당';

  useEffect(() => {
    if (isDamdan) {
      setIsSidebarOpen(false);
      return;
    }
    const saved = localStorage.getItem('sidebar_open');
    if (saved !== null) {
      setIsSidebarOpen(saved === 'true');
    }
  }, [isDamdan]);

  const toggleSidebar = () => {
    // '담당' 직책은 사이드바를 사용하지 않으므로 토글 차단
    if (isDamdan) return;
    setIsSidebarOpen(prev => {
      const next = !prev;
      localStorage.setItem('sidebar_open', String(next));
      return next;
    });
  };

  const handleSetIsSidebarOpen = (open: boolean) => {
    if (isDamdan) return;
    setIsSidebarOpen(open);
    localStorage.setItem('sidebar_open', String(open));
  };

  return (
    <SidebarContext.Provider value={{ isSidebarOpen, toggleSidebar, setIsSidebarOpen: handleSetIsSidebarOpen }}>
      {children}
    </SidebarContext.Provider>
  );
};

export const useSidebar = () => useContext(SidebarContext);
