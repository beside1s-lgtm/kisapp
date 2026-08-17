'use client';

import { Check, ChevronsUpDown, UserPlus, Pencil } from 'lucide-react';
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
import { Input } from '@/components/ui/input';
import { useState, useCallback } from 'react';

type UserSearchProps = {
  users: UserProfile[];
  value: string;
  onChange?: (value: string) => void;
  onSelectUser: (user: UserProfile) => void;
  placeholder?: string;
  roleFilter?: string;
  allowCustomInput?: boolean;
};

export default function UserSearch({
  users,
  value,
  onSelectUser,
  placeholder,
  allowCustomInput = true,
}: UserSearchProps) {
  const [open, setOpen] = useState(false);
  const [searchValue, setSearchValue] = useState('');
  const [isDirectInputMode, setIsDirectInputMode] = useState(false);
  const [customNameInput, setCustomNameInput] = useState('');

  // 선택 핸들러
  const handleSelect = useCallback((user: UserProfile) => {
    onSelectUser(user);
    setOpen(false);
    setSearchValue('');
    setIsDirectInputMode(false);
  }, [onSelectUser]);

  // 직접 입력 선택 핸들러
  const handleCustomSelect = useCallback((nameToUse: string) => {
    const trimmed = nameToUse.trim();
    if (!trimmed) return;
    const defaultRole = placeholder?.replace(' 검색...', '') || '직접입력';
    const customUser: UserProfile = {
      uid: `manual_${Date.now()}`,
      name: trimmed,
      email: '',
      role: defaultRole as any,
    };
    onSelectUser(customUser);
    setOpen(false);
    setSearchValue('');
    setCustomNameInput('');
    setIsDirectInputMode(false);
  }, [onSelectUser, placeholder]);

  return (
    <Popover open={open} onOpenChange={(nextOpen) => {
      setOpen(nextOpen);
      if (!nextOpen) {
        setIsDirectInputMode(false);
        setSearchValue('');
      }
    }}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          type="button"
          className="w-full justify-between font-normal h-9 text-xs"
        >
          {value ? (
            <span className="font-semibold text-slate-800">{value}</span>
          ) : (
            <span className="text-muted-foreground">{placeholder || '사용자 선택...'}</span>
          )}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      
      <PopoverContent className="w-[320px] p-0 pointer-events-auto z-[1000]" align="start">
        {isDirectInputMode ? (
          <div className="p-3 space-y-3">
            <div className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
              <Pencil className="w-3.5 h-3.5 text-primary" />
              직접 성명 입력 (미가입자/교장/외부인)
            </div>
            <Input
              autoFocus
              placeholder="예: 홍길동 (교장)"
              value={customNameInput}
              onChange={(e) => setCustomNameInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleCustomSelect(customNameInput);
                }
              }}
              className="h-8 text-xs font-medium"
            />
            <div className="flex gap-2 justify-end">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 text-xs px-2"
                onClick={() => setIsDirectInputMode(false)}
              >
                검색으로 돌아가기
              </Button>
              <Button
                type="button"
                size="sm"
                className="h-7 text-xs px-3 font-bold"
                onClick={() => handleCustomSelect(customNameInput)}
                disabled={!customNameInput.trim()}
              >
                확인
              </Button>
            </div>
          </div>
        ) : (
          <Command shouldFilter={true}>
            <CommandInput 
              placeholder="이름, 이메일, 직책 검색..." 
              value={searchValue}
              onValueChange={setSearchValue}
            />
            <CommandList className="max-h-[300px] overflow-y-auto">
              <CommandEmpty>
                <div className="p-2 space-y-2 text-center">
                  <p className="text-xs text-muted-foreground">검색 결과가 없습니다.</p>
                  {allowCustomInput && searchValue.trim() && (
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      className="w-full text-xs font-bold text-primary bg-primary/10 hover:bg-primary/20 flex items-center justify-center gap-1.5"
                      onClick={() => handleCustomSelect(searchValue)}
                    >
                      <UserPlus className="w-3.5 h-3.5" />
                      "{searchValue}"(으)로 직접 등록
                    </Button>
                  )}
                </div>
              </CommandEmpty>
              <CommandGroup heading="사용자 목록">
                {users.map((user) => (
                  <CommandItem
                    key={user.email || user.uid}
                    value={`${user.name} ${user.role} ${user.email}`.toLowerCase()}
                    onSelect={() => handleSelect(user)}
                    onMouseDown={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      handleSelect(user);
                    }}
                    className="cursor-pointer data-[disabled]:pointer-events-auto data-[disabled]:opacity-100"
                  >
                    <Check
                      className={cn(
                        'mr-2 h-4 w-4',
                        value === user.name ? 'opacity-100' : 'opacity-0'
                      )}
                    />
                    <div className="flex flex-col text-left">
                        <span className="font-medium text-xs">
                          {user.name} <span className="text-[11px] font-normal text-muted-foreground">({user.role})</span>
                        </span>
                        <span className="text-[10px] text-muted-foreground">{user.email}</span>
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
            {allowCustomInput && (
              <div className="p-2 border-t bg-slate-50 flex items-center justify-between">
                <span className="text-[11px] text-slate-500">목록에 없나요?</span>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-6 text-[11px] px-2 text-slate-700 bg-white hover:bg-slate-100 flex items-center gap-1"
                  onClick={() => {
                    setCustomNameInput(searchValue);
                    setIsDirectInputMode(true);
                  }}
                >
                  <Pencil className="w-3 h-3" />
                  직접 성명 입력
                </Button>
              </div>
            )}
          </Command>
        )}
      </PopoverContent>
    </Popover>
  );
}