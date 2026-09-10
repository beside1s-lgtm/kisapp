'use client';

import React, { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { BookOpen, Bus, Plus, Activity, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useAuth } from '@/hooks/use-auth';
import { onOrgStructureUpdate } from '@/lib/services/settingsService';
import { checkHomeroomAccessPermission } from '@/lib/services/permissionService';

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
  const { user, profile } = useAuth();
  const pathname = usePathname();
  const [orgStructure, setOrgStructure] = useState<any>(null);

  useEffect(() => {
    if (!user || profile?.role === '강사') return;
    const unsub = onOrgStructureUpdate((org) => setOrgStructure(org));
    return () => unsub();
  }, [user, profile?.role]);

  // 담임 업무 바로가기 노출 조건: 학급 담임, 학생출결 담당자, 시스템 설정 담당자만 노출
  const isHomeroomTeacher = useMemo(() => {
    if (!user?.email) return false;
    const { canAccess } = checkHomeroomAccessPermission(user.email, profile, orgStructure);
    return canAccess;
  }, [user?.email, profile, orgStructure]);

  // 통합 학생 계정 관리 접근 권한: isAdmin 또는 systemManagers 등록자 전용
  const canAccessStudentAdmin = useMemo(() => {
    if (!user?.email) return false;
    if (profile?.isAdmin) return true;
    const emailLower = user.email.trim().toLowerCase();
    if (orgStructure?.systemManagers?.some((m: string) => m.toLowerCase() === emailLower)) return true;
    return false;
  }, [user?.email, profile?.isAdmin, orgStructure]);

  // 비로그인 상태이거나 스쿨버스/공유 출석부 페이지에서 로그인 인증이 안 된 경우 하단 네비게이션바 숨김 처리
  if (!user && (pathname === '/teacher/bus' || pathname.startsWith('/attendance/share/'))) {
    return null;
  }

  // 일반 페이지에서도 비로그인 사용자는 네비게이션바 미표시
  if (!user) {
    return null;
  }

  // 강사 계정은 방과후 출석부와 스쿨버스만 2분할로 깔끔하게 제공
  if (profile?.role === '강사') {
    return (
      <div className="lg:hidden fixed bottom-0 left-0 right-0 h-16 bg-card/95 backdrop-blur border-t z-40 grid grid-cols-2 items-center justify-around px-6 print:hidden shadow-lg">
        <MobileNavItem href="/teacher/afterschool" label="방과후 출석부" icon={<BookOpen size={20} />} />
        <MobileNavItem href="/teacher/bus" label="스쿨버스 탑승" icon={<Bus size={20} />} />
      </div>
    );
  }

  // 우측 버튼 목록 결정: 담임기능 최우선, 학생계정(관리자용), 학교체육
  // 모바일 하단바는 최대 5개 항목 (좌2 + 중앙Plus + 우2)으로 레이아웃 안정성 유지
  const showHomeroom = isHomeroomTeacher;
  const showStudentAdmin = canAccessStudentAdmin && !showHomeroom; // 담임이 아니거나 전산전담 관리자
  const rightSlot1 = showHomeroom ? (
    <MobileNavItem href="/teacher/homeroom" label="담임기능" icon={<Users size={18} />} />
  ) : (
    <MobileNavItem href="/teacher/pe" label="학교체육" icon={<Activity size={18} />} />
  );

  const rightSlot2 = showHomeroom ? (
    canAccessStudentAdmin ? (
      <MobileNavItem href="/admin/students" label="학생계정" icon={<Users size={18} />} />
    ) : (
      <MobileNavItem href="/teacher/pe" label="학교체육" icon={<Activity size={18} />} />
    )
  ) : (
    showStudentAdmin ? (
      <MobileNavItem href="/admin/students" label="학생계정" icon={<Users size={18} />} />
    ) : null
  );

  const colCount = rightSlot2 ? 5 : 4;

  return (
    <div className={cn(
      "lg:hidden fixed bottom-0 left-0 right-0 h-16 bg-card/95 backdrop-blur border-t z-40 items-center justify-around px-2 print:hidden shadow-lg",
      colCount === 5 ? "grid grid-cols-5" : "grid grid-cols-4"
    )}>
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
      {rightSlot1}
      {rightSlot2}
    </div>
  );
}
