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
    // This effect ensures that if the form is reset or the value is changed externally,
    // the internal state of UserSearch is updated.
    if(value !== internalValue) {
        setInternalValue(value || '');
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  const filteredUsers = useMemo(() => {
    if (!internalValue) return [];
    // Don't filter if the input value exactly matches a user's name (which happens after selection).
    if (users.some(u => u.name === internalValue)) return [];

    return users.filter(
      (u) => u.name.toLowerCase().includes(internalValue.toLowerCase()) || 
             u.email.toLowerCase().includes(internalValue.toLowerCase())
    );
  }, [internalValue, users]);

  const handleSelect = (user: UserProfile) => {
    onSelectUser(user);
    // The parent form will update the `value` prop via react-hook-form's `setValue`,
    // which will then be reflected in the input via the useEffect.
    // We also update internal state to immediately reflect the change.
    setInternalValue(user.name); 
    setOpen(false);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setInternalValue(newValue);
    if (onValueChange) {
        onValueChange(newValue);
    }
    if (newValue) {
        setOpen(true)
    } else {
        // If the input is cleared, also clear the parent form state.
        onSelectUser({ name: '', email: '', role: '', uid: '' });
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
            // Only open if there's something to search for, or to show the full list.
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
