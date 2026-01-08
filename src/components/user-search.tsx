'use client';

import { UserProfile } from '@/lib/types';
import { useState, useMemo, ChangeEvent } from 'react';
import { Input, type InputProps } from './ui/input';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';

interface UserSearchProps extends Omit<InputProps, 'onSelect' | 'value' | 'onChange'> {
  users: UserProfile[];
  onSelectUser: (user: UserProfile) => void;
  value: string;
  onChange: (event: ChangeEvent<HTMLInputElement>) => void;
  placeholder?: string;
}

export function UserSearch({ users, onSelectUser, value, onChange, placeholder, ...props }: UserSearchProps) {
  const [open, setOpen] = useState(false);

  const filteredUsers = useMemo(() => {
    if (!value) return [];
    if (users.some(u => u.name === value)) return [];

    return users.filter(
      (u) => u.name.toLowerCase().includes(value.toLowerCase()) || 
             u.email.toLowerCase().includes(value.toLowerCase())
    );
  }, [value, users]);

  const handleSelect = (user: UserProfile) => {
    onSelectUser(user);
    setOpen(false);
  };
  
  const handleInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    onChange(e); // Forward the event to react-hook-form
    if (e.target.value) {
        setOpen(true);
    } else {
        setOpen(false);
    }
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Input
          {...props}
          value={value}
          onChange={handleInputChange}
          onFocus={() => {
            if(value && filteredUsers.length > 0) setOpen(true);
          }}
          placeholder={placeholder || "Search name..."}
          autoComplete="off"
        />
      </PopoverTrigger>
      {open && filteredUsers.length > 0 && (
        <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0">
          <div className="max-h-60 overflow-y-auto">
            {filteredUsers.map((user) => (
              <button
                key={user.email}
                type="button"
                onClick={() => handleSelect(user)}
                className="w-full p-3 text-left hover:bg-muted text-sm flex justify-between items-center rounded-lg"
              >
                <div>
                    <p className="font-medium">{user.name}</p>
                    <p className="text-xs text-muted-foreground">{user.email}</p>
                </div>
                <span className="text-xs bg-secondary text-secondary-foreground px-2 py-1 rounded-md">{user.role}</span>
              </button>
            ))}
          </div>
        </PopoverContent>
      )}
    </Popover>
  );
}
