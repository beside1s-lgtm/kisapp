'use client';

import { User } from '@/lib/types';
import { useState, useMemo } from 'react';
import { Input, type InputProps } from './ui/input';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';

interface UserSearchProps extends Omit<InputProps, 'onSelect' | 'value'> {
  users: User[];
  onSelectUser: (user: User) => void;
  value?: string;
}

export function UserSearch({ users, onSelectUser, value, ...props }: UserSearchProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState(value || '');

  const filteredUsers = useMemo(() => {
    if (!search) return [];
    return users.filter(
      (u) => u.name.toLowerCase().includes(search.toLowerCase()) || 
             u.email.toLowerCase().includes(search.toLowerCase())
    );
  }, [search, users]);

  const handleSelect = (user: User) => {
    onSelectUser(user);
    setSearch(user.name);
    setOpen(false);
  };
  
  const currentInputValue = props.onChange ? value : search;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Input
          {...props}
          value={currentInputValue}
          onChange={(e) => {
            if (props.onChange) {
                props.onChange(e);
            } else {
                setSearch(e.target.value);
            }
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          placeholder={props.placeholder || "Search name..."}
          autoComplete="off"
        />
      </PopoverTrigger>
      {filteredUsers.length > 0 && (
        <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0">
          <div className="max-h-60 overflow-y-auto">
            {filteredUsers.map((user) => (
              <button
                key={user.uid}
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
