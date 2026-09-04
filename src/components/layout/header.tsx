'use client';
import { useState, useEffect } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { getDb } from '@/lib/firebase';
import { useAuth } from '@/hooks/use-auth';
import Link from 'next/link';
import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar';
import { Button } from '../ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../ui/dropdown-menu';
import { FileText, LifeBuoy, LogOut, Loader2, Settings, User as UserIcon, PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import { SettingsModal } from '../settings-modal';
import { ProfileModal } from '../profile-modal';
import { DropdownMenuTriggerItem } from '../ui/dropdown-menu-trigger-item';
import { useSidebar } from './sidebar-context';
import { LanguageSwitcher } from './language-switcher';

export function AppHeader() {
  const { user, profile, logout, profileLoading } = useAuth();
  const [orgData, setOrgData] = useState<any>(null);
  const [isSystemManager, setIsSystemManager] = useState(false);
  const { isSidebarOpen, toggleSidebar } = useSidebar();

  useEffect(() => {
    if (!profile?.email) return;
    const fetchOrg = async () => {
      try {
        const docRef = doc(getDb(), 'settings', 'orgStructure');
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          const data = docSnap.data();
          setOrgData(data);
          const systemManagers = data.systemManagers || [];
          setIsSystemManager(systemManagers.map((m: string) => m.toLowerCase()).includes(profile.email.toLowerCase()));
        }
      } catch (err) {
        console.error('Error fetching org structure for header:', err);
      }
    };
    fetchOrg();
  }, [profile?.email]);

  // 사용자의 소속(학년/반 담임, 부서 등) 및 담당 업무를 파싱하는 헬퍼 함수
  const getUserInfoDetails = () => {
    if (!profile?.email || !orgData) return { belongs: '소속 정보 없음', managers: '일반 교직원' };
    const emailLower = profile.email.toLowerCase();
    
    const belongsList: string[] = [];
    const managerList: string[] = [];

    // 1. 소속 정보 파싱 (담임, 부서, 보직 등)
    if (orgData.principal?.toLowerCase() === emailLower) belongsList.push('교장');
    if (orgData.vicePrincipal?.toLowerCase() === emailLower) belongsList.push('교감');

    if (orgData.gradeHeads) {
      for (const [grade, headEmail] of Object.entries(orgData.gradeHeads)) {
        if ((headEmail as string)?.toLowerCase() === emailLower) {
          belongsList.push(`${grade}학년 부장`);
        }
      }
    }

    if (orgData.homerooms) {
      for (const [gradeClass, teacherEmail] of Object.entries(orgData.homerooms)) {
        if ((teacherEmail as string)?.toLowerCase() === emailLower) {
          belongsList.push(`${gradeClass} 담임`);
        }
      }
    }

    if (orgData.departments) {
      for (const dept of orgData.departments) {
        if (dept.headEmail?.toLowerCase() === emailLower) {
          belongsList.push(`${dept.name} (부장)`);
        }
        if (dept.memberEmails?.some((m: string) => m?.toLowerCase() === emailLower)) {
          belongsList.push(`${dept.name} (부원)`);
        }
      }
    }

    // 2. 업무 담당 정보 파싱 (방과후학교, 스쿨버스, 시스템 등)
    if (orgData.systemManagers?.map((m: string) => m.toLowerCase()).includes(emailLower)) {
      managerList.push('시스템 설정');
    }
    if (orgData.afterschoolManagers?.map((m: string) => m.toLowerCase()).includes(emailLower)) {
      managerList.push('방과후학교');
    }
    if (orgData.busManagers?.map((m: string) => m.toLowerCase()).includes(emailLower)) {
      managerList.push('스쿨버스');
    }

    return {
      belongs: belongsList.length > 0 ? belongsList.join(', ') : (profile.dept || '미배정 소속'),
      managers: managerList.length > 0 ? managerList.join(', ') : '업무 미지정'
    };
  };

  const info = getUserInfoDetails();

  return (
    <>
      <header className="fixed top-0 left-0 right-0 z-50 flex h-14 sm:h-16 items-center justify-between border-b bg-card px-2.5 sm:px-4 lg:px-8 max-w-full overflow-x-hidden min-w-0">
        <div className="flex items-center gap-2 sm:gap-3 flex-1 min-w-0">
          <Link href="/inbox" className="hidden sm:flex items-center gap-2 sm:gap-4 cursor-pointer hover:opacity-80 transition-opacity shrink-0">
            <div className="bg-primary p-1.5 sm:p-2 rounded-lg text-primary-foreground">
              <FileText className="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
            <h1 className="font-headline text-sm sm:text-lg font-bold tracking-tight text-foreground uppercase hidden sm:block">
              KSHCM ADMIN
            </h1>
          </Link>
          <Button
            variant="ghost"
            size="icon"
            onClick={toggleSidebar}
            title={isSidebarOpen ? "사이드바 숨기기" : "사이드바 열기"}
            className="hidden lg:flex h-9 w-9 text-slate-600 hover:bg-muted shrink-0"
          >
            {isSidebarOpen ? <PanelLeftClose size={20} /> : <PanelLeftOpen size={20} />}
          </Button>
        </div>

        <div className="flex items-center gap-2 sm:gap-6 shrink-0">
          {/* 깔끔하게 오른쪽 정렬된 플랫 사용자 정보 텍스트 */}
          {!profileLoading && profile && (
            <div className="hidden lg:flex items-center gap-4 text-[15.5px] text-slate-500 font-medium max-w-3xl truncate mr-4">
              <div className="flex items-center gap-1.5 shrink-0">
                <span className="text-slate-400">소속:</span>
                <span className="text-slate-800 font-semibold">{info.belongs}</span>
              </div>
              <span className="text-slate-300">|</span>
              <div className="flex items-center gap-1.5 shrink-0">
                <span className="text-slate-400">담당:</span>
                <span className="text-blue-600 font-semibold">{info.managers}</span>
              </div>
              <span className="text-slate-300">|</span>
              <div className="flex items-center gap-1 shrink-0">
                <span className="text-slate-400">직책:</span>
                <span className="text-slate-800 font-semibold">{profile.role || '교직원'}</span>
              </div>
            </div>
          )}

          {(profile?.isAdmin || isSystemManager) && <SettingsModal />}

          {profileLoading ? (
             <Loader2 className="h-5 w-5 animate-spin" />
          ) : (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="relative h-10 flex items-center gap-2.5 rounded-full px-2 hover:bg-muted">
                  <Avatar className="h-9 w-9 shrink-0">
                    <AvatarImage src={user?.photoURL || ''} alt={profile?.name || ''} />
                    <AvatarFallback>
                        {profile?.name?.charAt(0).toUpperCase() || <UserIcon />}
                    </AvatarFallback>
                  </Avatar>
                  <div className="hidden md:flex flex-col items-start leading-tight">
                    <span className="text-sm font-semibold text-foreground">{profile?.name || '사용자'}</span>
                    <span className="text-[11px] text-muted-foreground">{profile?.role || '직책 없음'}</span>
                  </div>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-56" align="end" forceMount>
                <DropdownMenuLabel className="font-normal">
                  <div className="flex flex-col space-y-1">
                    <p className="text-sm font-medium leading-none">{profile?.name}</p>
                    <p className="text-xs leading-none text-muted-foreground">
                      {profile?.email}
                    </p>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                
                <ProfileModal>
                  <DropdownMenuTriggerItem>
                    <UserIcon className="mr-2 h-4 w-4" />
                    <span>내 프로필</span>
                  </DropdownMenuTriggerItem>
                </ProfileModal>

                <DropdownMenuItem disabled>
                  <LifeBuoy className="mr-2 h-4 w-4" />
                  <span>지원</span>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={logout}>
                  <LogOut className="mr-2 h-4 w-4" />
                  <span>로그아웃</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}

          {/* 데스크톱 전용: 언어 선택기 및 로그아웃 버튼을 헤더 맨 오른쪽 구석에 전역 고정 */}
          <div className="hidden sm:flex items-center gap-2 shrink-0">
            <LanguageSwitcher />
            {user && (
              <Button
                variant="outline"
                size="sm"
                onClick={logout}
                className="h-8 px-2.5 text-xs text-rose-600 border-rose-200 hover:bg-rose-50 hover:text-rose-700 font-bold flex items-center gap-1.5 shrink-0 shadow-2xs cursor-pointer"
                title="로그아웃"
              >
                <LogOut className="h-3.5 w-3.5" />
                <span>로그아웃</span>
              </Button>
            )}
          </div>
        </div>
      </header>
    </>
  );
}
