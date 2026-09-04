'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { BookOpen, Bus, Plus, Activity, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useAuth } from '@/hooks/use-auth';

const MobileNavItem = ({ href, label, icon }: { href: string; label: string; icon: React.ReactNode }) => {
  const pathname = usePathname();
  const isActive = pathname === href || pathname?.startsWith(href);

  return (
    <Link
      href={href}
      className={cn(
        "flex flex-col items-center justify-center gap-1 w-full h-full rounded-lg text-[11px] transition-colors",
        isActive ? "text-primary font-bold" : "text-muted-foreground hover:text-foreground"
      )}
    >
      {icon}
      <span className="truncate max-w-[64px] text-center">{label}</span>
    </Link>
  );
};

export function MobileBottomNav() {
  const { user } = useAuth();
  const pathname = usePathname();

  // 비로그인 상태이거나 스쿨버스/공유 출석부 페이지에서 로그인 인증이 안 된 경우 하단 네비게이션바 숨김 처리
  if (!user && (pathname === '/teacher/bus' || pathname.startsWith('/attendance/share/'))) {
    return null;
  }

  // 일반 페이지에서도 비로그인 사용자는 네비게이션바 미표시
  if (!user) {
    return null;
  }

  return (
    <div className="lg:hidden fixed bottom-0 left-0 right-0 h-16 bg-card/95 backdrop-blur border-t z-40 grid grid-cols-5 items-center justify-around px-2 print:hidden shadow-lg">
      <MobileNavItem href="/teacher/afterschool" label="방과후" icon={<BookOpen size={18} />} />
      <MobileNavItem href="/teacher/bus" label="스쿨버스" icon={<Bus size={18} />} />
      <div className="flex justify-center">
        <Button asChild className="h-12 w-12 rounded-full shadow-md -mt-5 bg-primary hover:bg-primary/90" size="icon">
          <Link href="/new" title="새 결재문서 작성">
            <Plus className="h-6 w-6" />
            <span className="sr-only">새 결재문서 작성</span>
          </Link>
        </Button>
      </div>
      <MobileNavItem href="/teacher/pe" label="학교체육" icon={<Activity size={18} />} />
      <MobileNavItem href="/admin/students" label="학생계정" icon={<Users size={18} />} />
    </div>
  );
}
