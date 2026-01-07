'use client';

import { UserProfile } from '@/lib/types';
import { useState, useMemo, useEffect } from 'react';
import { Input, type InputProps } from './ui/input';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';

interface UserSearchProps extends Omit<InputProps, 'onSelect' | 'value' | 'onChange'> {
  users: UserProfile[];
  onSelectUser: (user: UserProfile) => void;
  value?: string;
  onValueChange?: (value: string) => void;
  placeholder?: string;
}

export function UserSearch({ users, onSelectUser, value, onValueChange, placeholder, ...props }: UserSearchProps) {
  const [open, setOpen] = useState(false);
  const [internalValue, setInternalValue] = useState(value || '');

  useEffect(() => {
    if(value !== internalValue) {
        setInternalValue(value || '');
    }
  }, [value]);

  const filteredUsers = useMemo(() => {
    if (!internalValue) return [];
    return users.filter(
      (u) => u.name.toLowerCase().includes(internalValue.toLowerCase()) || 
             u.email.toLowerCase().includes(internalValue.toLowerCase())
    );
  }, [internalValue, users]);

  const handleSelect = (user: UserProfile) => {
    onSelectUser(user);
    setInternalValue(user.name);
    if(onValueChange) {
        onValueChange(user.name);
    }
    setOpen(false);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setInternalValue(newValue);
    if (onValueChange) {
        onValueChange(newValue);
    }
    setOpen(!!newValue);
  }
  
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Input
          {...props}
          value={internalValue}
          onChange={handleChange}
          onFocus={() => {
            if(internalValue) setOpen(true);
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
