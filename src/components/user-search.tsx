'use client';

import { Check, ChevronsUpDown } from 'lucide-react';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { UserProfile } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { useState } from 'react';
import { ControllerRenderProps } from 'react-hook-form';

type UserSearchProps = {
  users: UserProfile[];
  onSelectUser: (user: UserProfile) => void;
  placeholder?: string;
  field?: ControllerRenderProps<any, any>; // To handle RHF state
  roleFilter?: string; // To filter users by role
};

export default function UserSearch({
  users,
  onSelectUser,
  placeholder,
  field,
  roleFilter,
}: UserSearchProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');

  const handleSelect = (user: UserProfile) => {
    onSelectUser(user);
    // If a field is passed from react-hook-form, update it
    if (field) {
        field.onChange(user.name);
    }
    setOpen(false);
    setQuery('');
  };

  const filteredUsers = users.filter(user => {
    const matchesQuery = user.name.toLowerCase().includes(query.toLowerCase()) || user.email.toLowerCase().includes(query.toLowerCase());
    const matchesRole = roleFilter ? user.role === roleFilter : true;
    return matchesQuery && matchesRole;
  });

  const displayValue = field?.value || query;
  
  // For 공람, where field might be undefined
  if (!field && !query) {
      const selectedUser = users.find(user => user.name === displayValue);
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between"
        >
          <span className="truncate">
            {field?.value
              ? users.find((user) => user.name === field.value)?.name
              : placeholder || '사용자 선택...'}
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
        <Command>
          <CommandInput
            placeholder={placeholder || '이름 또는 이메일로 검색...'}
            value={query}
            onValueChange={setQuery}
          />
          <CommandList>
            <CommandEmpty>
                {roleFilter ? `'${roleFilter}' 직책의 사용자를 찾을 수 없습니다.` : '사용자를 찾을 수 없습니다.'}
            </CommandEmpty>
            <CommandGroup>
              {filteredUsers.map((user) => (
                <CommandItem
                  key={user.email}
                  value={user.name}
                  onSelect={() => handleSelect(user)}
                  className="cursor-pointer"
                >
                  <Check
                    className={cn(
                      'mr-2 h-4 w-4',
                      field?.value === user.name ? 'opacity-100' : 'opacity-0'
                    )}
                  />
                  <div>
                    <p>{user.name} <span className="text-xs text-muted-foreground">{user.role}</span></p>
                    <p className="text-xs text-muted-foreground">
                      {user.email}
                    </p>
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
