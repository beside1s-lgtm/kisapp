'use client';
import { useAuth } from '@/hooks/use-auth';
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
import { FileText, LifeBuoy, LogOut, Loader2, Settings, User as UserIcon } from 'lucide-react';
import { useState } from 'react';
import { ProfileModal } from '../profile-modal';
import { SettingsModal } from '../settings-modal';

export default function AppHeader() {
  const { user, profile, logout, profileLoading } = useAuth();
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);

  // Show profile modal automatically if the name is 'New User' after loading
  useState(() => {
    if(!profileLoading && profile?.name === 'New User') {
      setShowProfileModal(true);
    }
  });

  return (
    <>
      <header className="sticky top-0 z-50 flex h-16 items-center justify-between border-b bg-card px-4 md:px-8">
        <div className="flex items-center gap-4">
          <div className="bg-primary p-2 rounded-lg text-primary-foreground">
            <FileText size={20} />
          </div>
          <h1 className="font-headline text-lg font-bold tracking-tight text-foreground uppercase">
            KISH Approval System
          </h1>
        </div>
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => setShowSettingsModal(true)}>
            <Settings className="h-5 w-5 text-muted-foreground" />
          </Button>
          {profileLoading ? (
             <Loader2 className="h-5 w-5 animate-spin" />
          ) : (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="relative h-10 w-10 rounded-full">
                  <Avatar className="h-10 w-10">
                    <AvatarImage src={user?.photoURL || ''} alt={profile?.name || ''} />
                    <AvatarFallback>
                        {profile?.name?.charAt(0).toUpperCase() || <UserIcon />}
                    </AvatarFallback>
                  </Avatar>
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
                <DropdownMenuItem onSelect={() => setShowProfileModal(true)}>
                  <UserIcon className="mr-2 h-4 w-4" />
                  <span>Profile</span>
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => setShowSettingsModal(true)}>
                  <Settings className="mr-2 h-4 w-4" />
                  <span>Settings</span>
                </DropdownMenuItem>
                <DropdownMenuItem disabled>
                  <LifeBuoy className="mr-2 h-4 w-4" />
                  <span>Support</span>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={logout}>
                  <LogOut className="mr-2 h-4 w-4" />
                  <span>Log out</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </header>
      
      {user && profile && (
        <>
          <ProfileModal 
            isOpen={showProfileModal} 
            setIsOpen={setShowProfileModal}
          />
          <SettingsModal 
            isOpen={showSettingsModal}
            setIsOpen={setShowSettingsModal}
          />
        </>
      )}
    </>
  );
}
