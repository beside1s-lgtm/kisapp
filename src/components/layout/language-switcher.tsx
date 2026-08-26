
'use client';

import { useLanguage } from '@/contexts/language-context';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Globe, Check, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

export function LanguageSwitcher() {
  const { language, setLanguage } = useLanguage();

  const langLabels: Record<string, { short: string; full: string; flag: string }> = {
    ko: { short: 'KO', full: '한국어', flag: '🇰🇷' },
    vi: { short: 'VI', full: 'Tiếng Việt', flag: '🇻🇳' },
    en: { short: 'EN', full: 'English', flag: '🇺🇸' },
  };

  const current = langLabels[language] || langLabels.ko;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="h-8 px-2.5 rounded-lg border-slate-300 bg-white hover:bg-slate-50 font-bold text-xs flex items-center gap-1.5 shrink-0 shadow-xs transition cursor-pointer"
          title="언어 변경 / Đổi ngôn ngữ / Change Language"
        >
          <span className="text-sm">{current.flag}</span>
          <span className="font-extrabold text-slate-800 tracking-tight">{current.short}</span>
          <ChevronDown className="w-3 h-3 text-slate-400 shrink-0" />
        </Button>

      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-[130px] p-1 shadow-lg rounded-xl z-50">
        <DropdownMenuItem
          onClick={() => setLanguage('ko')}
          className={cn(
            "flex items-center justify-between text-xs py-1.5 px-2 rounded-lg font-medium cursor-pointer",
            language === 'ko' && "bg-indigo-50 text-indigo-700 font-bold"
          )}
        >
          <span className="flex items-center gap-1.5">
            <span>🇰🇷</span>
            <span>한국어 (KO)</span>
          </span>
          {language === 'ko' && <Check className="w-3.5 h-3.5 text-indigo-600 ml-1" />}
        </DropdownMenuItem>

        <DropdownMenuItem
          onClick={() => setLanguage('vi')}
          className={cn(
            "flex items-center justify-between text-xs py-1.5 px-2 rounded-lg font-medium cursor-pointer",
            language === 'vi' && "bg-indigo-50 text-indigo-700 font-bold"
          )}
        >
          <span className="flex items-center gap-1.5">
            <span>🇻🇳</span>
            <span>Tiếng Việt (VI)</span>
          </span>
          {language === 'vi' && <Check className="w-3.5 h-3.5 text-indigo-600 ml-1" />}
        </DropdownMenuItem>

        <DropdownMenuItem
          onClick={() => setLanguage('en')}
          className={cn(
            "flex items-center justify-between text-xs py-1.5 px-2 rounded-lg font-medium cursor-pointer",
            language === 'en' && "bg-indigo-50 text-indigo-700 font-bold"
          )}
        >
          <span className="flex items-center gap-1.5">
            <span>🇺🇸</span>
            <span>English (EN)</span>
          </span>
          {language === 'en' && <Check className="w-3.5 h-3.5 text-indigo-600 ml-1" />}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
