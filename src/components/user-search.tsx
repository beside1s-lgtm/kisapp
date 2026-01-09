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

type UserSearchProps = {
  users: UserProfile[];
  value: string; // The selected user's name
  onSelectUser: (user: UserProfile) => void;
  placeholder?: string;
};

export default function UserSearch({
  users,
  value,
  onSelectUser,
  placeholder,
}: UserSearchProps) {
  const [open, setOpen] = useState(false);

  const handleSelect = (user: UserProfile) => {
    onSelectUser(user);
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between"
        >
          {value
            ? users.find((user) => user.name === value)?.name
            : placeholder || 'Select user...'}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
        <Command>
          <CommandInput
            placeholder={placeholder || 'Search user...'}
          />
          <CommandList>
            <CommandEmpty>No user found.</CommandEmpty>
            <CommandGroup>
              {users.map((user) => (
                <CommandItem
                  key={user.email}
                  value={user.name}
                  onSelect={() => handleSelect(user)}
                >
                  <Check
                    className={cn(
                      'mr-2 h-4 w-4',
                      value === user.name ? 'opacity-100' : 'opacity-0'
                    )}
                  />
                  <div>
                    <p>{user.name}</p>
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
