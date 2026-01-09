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
import { useState, useCallback } from 'react';

type UserSearchProps = {
  users: UserProfile[];
  value: string; // 현재 선택된 사용자의 이름
  onSelectUser: (user: UserProfile) => void;
  placeholder?: string;
  roleFilter?: string;
};

export default function UserSearch({
  users,
  value,
  onSelectUser,
  placeholder,
  roleFilter,
}: UserSearchProps) {
  const [open, setOpen] = useState(false);

  const filteredUsers = roleFilter
    ? users.filter(u => u.role === roleFilter || roleFilter === '협조')
    : users;

  // 선택 핸들러를 분리하여 안정성 확보
  const handleSelect = useCallback((user: UserProfile) => {
    onSelectUser(user);
    setOpen(false);
  }, [onSelectUser]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          type="button" // 폼 제출 방지
          className="w-full justify-between font-normal"
        >
          {value ? value : (placeholder || '사용자 선택...')}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      
      <PopoverContent className="w-[300px] p-0" align="start">
        <Command>
          {/* [수정] autoFocus 제거: Radix UI의 자동 포커스 관리와 충돌 방지 */}
          <CommandInput placeholder="이름, 이메일, 직책 검색..." />
          <CommandList>
            <CommandEmpty>검색 결과가 없습니다.</CommandEmpty>
            <CommandGroup heading="사용자 목록">
              {filteredUsers.map((user) => (
                <CommandItem
                  key={user.email}
                  // [중요] value는 검색 필터링에 사용됨. 이름+직책+이메일 조합으로 검색 편의성 제공
                  value={`${user.name} ${user.role} ${user.email}`} 
                  onSelect={() => handleSelect(user)}
                  className="cursor-pointer"
                >
                  <Check
                    className={cn(
                      'mr-2 h-4 w-4',
                      value === user.name ? 'opacity-100' : 'opacity-0'
                    )}
                  />
                  <div className="flex flex-col text-left">
                      <span className="font-medium">{user.name} <span className="text-xs font-normal text-muted-foreground">({user.role})</span></span>
                      <span className="text-xs text-muted-foreground">{user.email}</span>
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
