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
  value: string;
  onChange?: (value: string) => void;
  onSelectUser: (user: UserProfile) => void;
  placeholder?: string;
  roleFilter?: string;
};

export default function UserSearch({
  users,
  value,
  onSelectUser,
  placeholder,
}: UserSearchProps) {
  const [open, setOpen] = useState(false);

  // 선택 핸들러
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
          type="button"
          className="w-full justify-between font-normal"
        >
          {value ? value : (placeholder || '사용자 선택...')}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      
      {/* z-index와 포인터 이벤트 강제 설정 */}
      <PopoverContent className="w-[300px] p-0 pointer-events-auto z-[1000]" align="start">
        <Command>
          <CommandInput placeholder="이름, 이메일, 직책 검색..." />
          <CommandList className="max-h-[300px] overflow-y-auto">
            <CommandEmpty>검색 결과가 없습니다.</CommandEmpty>
            <CommandGroup heading="사용자 목록">
              {users.map((user) => (
                <CommandItem
                  key={user.email || user.uid}
                  // value는 검색 매칭용 (소문자로 변환하여 정확도 향상)
                  value={`${user.name} ${user.role} ${user.email}`.toLowerCase()}
                  
                  // 1. 키보드 엔터 선택용
                  onSelect={() => handleSelect(user)}
                  
                  // 2. 마우스 클릭 강제 처리 (onClick보다 확실함)
                  onMouseDown={(e) => {
                    e.preventDefault(); // 포커스 잃음 방지
                    e.stopPropagation(); // 이벤트 전파 방지
                    handleSelect(user);
                  }}
                  
                  // 3. 강제 스타일 적용: 커서 손가락 모양, 비활성화 상태 무시하고 클릭 허용
                  className="cursor-pointer data-[disabled]:pointer-events-auto data-[disabled]:opacity-100"
                >
                  <Check
                    className={cn(
                      'mr-2 h-4 w-4',
                      value === user.name ? 'opacity-100' : 'opacity-0'
                    )}
                  />
                  <div className="flex flex-col text-left">
                      <span className="font-medium">
                        {user.name} <span className="text-xs font-normal text-muted-foreground">({user.role})</span>
                      </span>
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