'use client';

import React from 'react';
import { useLanguage } from '@/contexts/language-context';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Check, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

// 모든 OS(Windows, Mac, iOS, Android)에서 100% 동일하게 렌더링되는 국기 SVG 컴포넌트
function KoreaFlag({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 36 24" className={cn("rounded-xs shrink-0 shadow-2xs", className)}>
      <rect width="36" height="24" fill="#ffffff" />
      <circle cx="18" cy="12" r="6" fill="#cd2e3a" />
      <path d="M18,18 C14.686,18 12,15.314 12,12 C12,8.686 14.686,6 18,6 C18,8.686 15.314,12 18,12 C20.686,12 18,15.314 18,18 Z" fill="#0047a0" />
      <circle cx="15" cy="12" r="3" fill="#cd2e3a" />
      <circle cx="21" cy="12" r="3" fill="#0047a0" />
      {/* 4괘 */}
      <path d="M5,4 L8,6 M4,6 L7,8 M3,8 L6,10" stroke="#000" strokeWidth="0.8" />
      <path d="M28,4 L31,6 M29,6 L32,8 M30,8 L33,10" stroke="#000" strokeWidth="0.8" />
      <path d="M5,20 L8,18 M4,18 L7,16 M3,16 L6,14" stroke="#000" strokeWidth="0.8" />
      <path d="M28,20 L31,18 M29,18 L32,16 M30,16 L33,14" stroke="#000" strokeWidth="0.8" />
    </svg>
  );
}

function VietnamFlag({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 36 24" className={cn("rounded-xs shrink-0 shadow-2xs", className)}>
      <rect width="36" height="24" fill="#da251d" />
      <polygon
        points="18,5.5 19.8,11.2 25.8,11.2 20.9,14.7 22.8,20.4 18,16.8 13.2,20.4 15.1,14.7 10.2,11.2 16.2,11.2"
        fill="#ffff00"
      />
    </svg>
  );
}

function UsFlag({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 36 24" className={cn("rounded-xs shrink-0 shadow-2xs", className)}>
      <rect width="36" height="24" fill="#b22234" />
      <path d="M0,3.69 H36 M0,7.38 H36 M0,11.07 H36 M0,14.76 H36 M0,18.45 H36 M0,22.14 H36" stroke="#ffffff" strokeWidth="1.84" />
      <rect width="14.4" height="12.9" fill="#3c3b6e" />
      <circle cx="3.6" cy="3.2" r="0.7" fill="#ffffff" />
      <circle cx="7.2" cy="3.2" r="0.7" fill="#ffffff" />
      <circle cx="10.8" cy="3.2" r="0.7" fill="#ffffff" />
      <circle cx="5.4" cy="6.4" r="0.7" fill="#ffffff" />
      <circle cx="9.0" cy="6.4" r="0.7" fill="#ffffff" />
      <circle cx="3.6" cy="9.6" r="0.7" fill="#ffffff" />
      <circle cx="7.2" cy="9.6" r="0.7" fill="#ffffff" />
      <circle cx="10.8" cy="9.6" r="0.7" fill="#ffffff" />
    </svg>
  );
}

export function LanguageSwitcher() {
  const { language, setLanguage } = useLanguage();

  const langConfig: Record<string, { label: string; flag: React.ReactNode }> = {
    ko: { label: '한국어', flag: <KoreaFlag className="w-4 h-3 sm:w-5 sm:h-3.5" /> },
    vi: { label: 'Tiếng Việt', flag: <VietnamFlag className="w-4 h-3 sm:w-5 sm:h-3.5" /> },
    en: { label: 'English', flag: <UsFlag className="w-4 h-3 sm:w-5 sm:h-3.5" /> },
  };

  const current = langConfig[language] || langConfig.ko;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="h-8 px-2 sm:px-2.5 rounded-lg border-slate-300 bg-white hover:bg-slate-50 font-bold text-xs flex items-center gap-1.5 shrink-0 shadow-2xs transition cursor-pointer"
          title="언어 변경 / Đổi ngôn ngữ / Change Language"
        >
          {current.flag}
          <span className="font-bold text-slate-800 tracking-tight text-xs">{current.label}</span>
          <ChevronDown className="w-3 h-3 text-slate-400 shrink-0" />
        </Button>
      </DropdownMenuTrigger>
      
      <DropdownMenuContent align="end" className="min-w-[140px] p-1 shadow-lg rounded-xl z-50">
        <DropdownMenuItem
          onClick={() => setLanguage('ko')}
          className={cn(
            "flex items-center justify-between text-xs py-2 px-2.5 rounded-lg font-medium cursor-pointer",
            language === 'ko' && "bg-indigo-50 text-indigo-700 font-bold"
          )}
        >
          <span className="flex items-center gap-2">
            <KoreaFlag className="w-4 h-3" />
            <span>한국어</span>
          </span>
          {language === 'ko' && <Check className="w-3.5 h-3.5 text-indigo-600 ml-1" />}
        </DropdownMenuItem>

        <DropdownMenuItem
          onClick={() => setLanguage('vi')}
          className={cn(
            "flex items-center justify-between text-xs py-2 px-2.5 rounded-lg font-medium cursor-pointer",
            language === 'vi' && "bg-indigo-50 text-indigo-700 font-bold"
          )}
        >
          <span className="flex items-center gap-2">
            <VietnamFlag className="w-4 h-3" />
            <span>Tiếng Việt</span>
          </span>
          {language === 'vi' && <Check className="w-3.5 h-3.5 text-indigo-600 ml-1" />}
        </DropdownMenuItem>

        <DropdownMenuItem
          onClick={() => setLanguage('en')}
          className={cn(
            "flex items-center justify-between text-xs py-2 px-2.5 rounded-lg font-medium cursor-pointer",
            language === 'en' && "bg-indigo-50 text-indigo-700 font-bold"
          )}
        >
          <span className="flex items-center gap-2">
            <UsFlag className="w-4 h-3" />
            <span>English</span>
          </span>
          {language === 'en' && <Check className="w-3.5 h-3.5 text-indigo-600 ml-1" />}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
