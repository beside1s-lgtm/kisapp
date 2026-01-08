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
  onClear: () => void;
  initialValue?: string; // Changed from 'value' to 'initialValue'
  placeholder?: string;
}

export function UserSearch({ users, onSelectUser, onClear, initialValue, placeholder, ...props }: UserSearchProps) {
  const [open, setOpen] = useState(false);
  const [internalValue, setInternalValue] = useState(initialValue || '');
  
  // This effect ensures that if the form is reset externally, the internal value updates.
  // It only runs when the initialValue prop changes.
  useEffect(() => {
    setInternalValue(initialValue || '');
  }, [initialValue]);


  const filteredUsers = useMemo(() => {
    if (!internalValue) return []; // Don't show list if input is empty
    // Don't filter if the input value exactly matches a user's name (which happens after selection).
    if (users.some(u => u.name === internalValue)) return [];

    return users.filter(
      (u) => u.name.toLowerCase().includes(internalValue.toLowerCase()) || 
             u.email.toLowerCase().includes(internalValue.toLowerCase())
    );
  }, [internalValue, users]);

  const handleSelect = (user: UserProfile) => {
    onSelectUser(user);
    setInternalValue(user.name); 
    setOpen(false);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setInternalValue(newValue);
    if (newValue) {
        setOpen(true)
    } else {
        // If the input is cleared, call the onClear callback
        onClear();
        setOpen(false);
    }
  }
  
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Input
          {...props}
          value={internalValue}
          onChange={handleChange}
          onFocus={() => {
            // Re-filter and open if there's text
            if(internalValue && filteredUsers.length > 0) setOpen(true);
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
