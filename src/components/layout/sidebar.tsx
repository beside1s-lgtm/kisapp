'use client';

import { Button } from '@/components/ui/button';
import { FileClock, Inbox, ListFilter, Plus, Send, Undo2, Users, CalendarOff, Backpack, Briefcase, Clock, UserPlus, CalendarCheck } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';
import { useEffect, useState } from 'react';
import { getInboxDocuments } from '@/lib/services/documentService';
import { cn } from '@/lib/utils';
import { Card } from '../ui/card';

type NavItemProps = {
  href: string;
  label: string;
  icon: React.ReactNode;
  count?: number;
};

const NavItem = ({ href, label, icon, count }: NavItemProps) => {
  const pathname = usePathname();
  const isActive = pathname === href;


  return (
    <Link
      href={href}
      className={cn(
        'flex items-center justify-between p-3 rounded-lg font-medium transition-all text-sm',
        isActive
          ? 'bg-primary/10 text-primary font-bold'
          : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground'
      )}
    >
      <div className="flex items-center gap-3">
        {icon}
        <span>{label}</span>
      </div>
      {count != null && count > 0 && (
        <span className="bg-destructive text-destructive-foreground text-xs font-black w-5 h-5 flex items-center justify-center rounded-full">
          {count}
        </span>
      )}
    </Link>
  );
};

export default function AppSidebar() {
  const { user } = useAuth();
  const [inboxCount, setInboxCount] = useState(0);

  useEffect(() => {
    if (user?.email) {
      const fetchCount = async () => {
        const inboxItems = await getInboxDocuments(user.email!);
        setInboxCount(inboxItems.length);
      };
      fetchCount();
      const interval = setInterval(fetchCount, 30000); 
      return () => clearInterval(interval);
    }
  }, [user]);

  return (
    <aside className="w-64 space-y-4 shrink-0 p-4 h-[calc(100vh-65px)] sticky top-16 hidden md:block overflow-y-auto pb-8">
      <Button asChild size="lg" className="w-full font-bold text-base h-12 rounded-xl shadow-lg shadow-primary/20 hover:shadow-primary/30 transition-shadow">
        <Link href="/new">
          <Plus className="mr-2 h-5 w-5" />
          신규 기안 작성
        </Link>
      </Button>
      <Card className="p-2 bg-card shadow-sm">
        <NavItem href="/inbox" label="미결재함" icon={<Inbox size={18} />} count={inboxCount} />
        <NavItem href="/sent" label="상신함" icon={<Send size={18} />} />
        <NavItem href="/pending" label="진행 문서함" icon={<FileClock size={18} />} />
        <NavItem href="/recalled" label="회수 문서함" icon={<Undo2 size={18} />} />
        <div className="h-px bg-border my-1 mx-2"></div>
        <NavItem href="/registry" label="문서등록대장" icon={<ListFilter size={18} />} />
        <NavItem href="/attendance-registry" label="출결문서 보관함" icon={<CalendarCheck size={18} />} />
        
        <div className="mt-6 mb-2 px-3 flex items-center gap-2">
          <div className="h-px bg-border flex-1"></div>
          <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1">
            <Briefcase size={14} /> 교원 서비스
          </span>
          <div className="h-px bg-border flex-1"></div>
        </div>
        <NavItem href="/teacher/duty" label="교원 복무" icon={<Briefcase size={18} />} />
        <NavItem href="/teacher/overtime" label="초과근무" icon={<Clock size={18} />} />
        <NavItem href="/teacher/substitution" label="보결 관리" icon={<UserPlus size={18} />} />

        <div className="mt-6 mb-2 px-3 flex items-center gap-2">
          <div className="h-px bg-border flex-1"></div>
          <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1">
            <Users size={14} /> 학부모 서비스
          </span>
          <div className="h-px bg-border flex-1"></div>
        </div>
        <NavItem href="/parents-absence" label="결석계 조회" icon={<CalendarOff size={18} />} />
        <NavItem href="/parents-fieldtrip" label="체험학습 신청서 조회" icon={<Backpack size={18} />} />
      </Card>

    </aside>
  );
}
