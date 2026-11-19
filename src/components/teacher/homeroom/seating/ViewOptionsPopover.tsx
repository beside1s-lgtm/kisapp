'use client';

import React from 'react';
import { Eye, Image, Star, BarChart2, Users } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import type { SeatingViewOptions } from '@/lib/types/seating';

interface ViewOptionsPopoverProps {
  options: SeatingViewOptions;
  onChange: (newOptions: SeatingViewOptions) => void;
}

export const ViewOptionsPopover: React.FC<ViewOptionsPopoverProps> = ({
  options,
  onChange,
}) => {
  const toggle = (key: keyof SeatingViewOptions) => {
    onChange({
      ...options,
      [key]: !options[key],
    });
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="h-8 text-xs gap-1.5 border-slate-200 text-slate-700 bg-white hover:bg-slate-50"
        >
          <Eye className="w-3.5 h-3.5 text-slate-500" />
          <span>보기 설정</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56 p-2">
        <DropdownMenuLabel className="text-xs font-bold text-slate-500 px-2 py-1">
          수업 화면 표시 옵션
        </DropdownMenuLabel>
        <DropdownMenuSeparator />

        <DropdownMenuCheckboxItem
          checked={options.showPhoto}
          onCheckedChange={() => toggle('showPhoto')}
          className="text-xs gap-2 py-1.5 cursor-pointer font-medium"
        >
          <Image className="w-4 h-4 text-amber-500 shrink-0" />
          <span>학생 사진 표시</span>
        </DropdownMenuCheckboxItem>

        <DropdownMenuCheckboxItem
          checked={options.showPraise}
          onCheckedChange={() => toggle('showPraise')}
          className="text-xs gap-2 py-1.5 cursor-pointer font-medium"
        >
          <Star className="w-4 h-4 text-amber-400 fill-amber-400 shrink-0" />
          <span>칭찬 포인트 표시</span>
        </DropdownMenuCheckboxItem>

        <DropdownMenuCheckboxItem
          checked={options.showGauge}
          onCheckedChange={() => toggle('showGauge')}
          className="text-xs gap-2 py-1.5 cursor-pointer font-medium"
        >
          <BarChart2 className="w-4 h-4 text-emerald-500 shrink-0" />
          <span>모둠/학급 게이지 표시</span>
        </DropdownMenuCheckboxItem>

        <DropdownMenuCheckboxItem
          checked={options.showGenderBadge}
          onCheckedChange={() => toggle('showGenderBadge')}
          className="text-xs gap-2 py-1.5 cursor-pointer font-medium"
        >
          <Users className="w-4 h-4 text-indigo-500 shrink-0" />
          <span>성별 배지 표시</span>
        </DropdownMenuCheckboxItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
