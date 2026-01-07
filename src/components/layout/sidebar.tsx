'use client';

import { Button } from '@/components/ui/button';
import { Inbox, ListFilter, Plus, Send } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';
import { useEffect, useState } from 'react';
import { getInboxDocuments } from '@/app/actions';
import { cn } from '@/lib/utils';

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
        'flex items-center justify-between p-3.5 rounded-xl font-bold transition-all text-sm',
        isActive
          ? 'bg-primary/10 text-primary'
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
      // Polling for updates, in a real app this would be a WebSocket/realtime subscription
      const interval = setInterval(fetchCount, 30000); 
      return () => clearInterval(interval);
    }
  }, [user]);

  return (
    <aside className="w-64 space-y-4 shrink-0 p-4 border-r bg-card h-[calc(100vh-65px)] sticky top-16 hidden md:block">
      <Button asChild size="lg" className="w-full font-bold text-base h-14 rounded-xl shadow-lg shadow-primary/20 hover:shadow-primary/30 transition-shadow">
        <Link href="/new">
          <Plus className="mr-2 h-5 w-5" />
          새 결재문서
        </Link>
      </Button>
      <div className="bg-background rounded-xl p-2 space-y-1">
        <NavItem href="/inbox" label="결재함" icon={<Inbox size={18} />} count={inboxCount} />
        <NavItem href="/sent" label="보낸 문서" icon={<Send size={18} />} />
        <div className="h-px bg-border my-1 mx-2"></div>
        <NavItem href="/registry" label="문서대장" icon={<ListFilter size={18} />} />
      </div>
    </aside>
  );
}
