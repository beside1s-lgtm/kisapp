'use client';

import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { 
  Pin, 
  RotateCcw, 
  Check, 
  Users2, 
  BookOpen, 
  Bus, 
  Activity, 
  Stethoscope, 
  HeartHandshake, 
  Users, 
  Plus, 
  Inbox, 
  Send, 
  FileClock, 
  Eye, 
  ListFilter, 
  CalendarCheck, 
  FileText, 
  Briefcase, 
  Clock, 
  UserPlus, 
  Calendar,
  Sparkles
} from 'lucide-react';
import { 
  ALL_SHORTCUT_ITEMS, 
  DEFAULT_SHORTCUT_IDS, 
  getSavedShortcutIds, 
  saveShortcutIds, 
  ShortcutItem 
} from '@/lib/sidebarShortcuts';
import { useAuth } from '@/hooks/use-auth';
import { useToast } from '@/hooks/use-toast';

interface SidebarShortcutsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

// 아이콘 매퍼 헬퍼
function renderShortcutIcon(iconName: string, className = "w-4 h-4") {
  switch (iconName) {
    case 'Users2': return <Users2 className={className} />;
    case 'BookOpen': return <BookOpen className={className} />;
    case 'Bus': return <Bus className={className} />;
    case 'Activity': return <Activity className={className} />;
    case 'Stethoscope': return <Stethoscope className={className} />;
    case 'HeartHandshake': return <HeartHandshake className={className} />;
    case 'Users': return <Users className={className} />;
    case 'Plus': return <Plus className={className} />;
    case 'Inbox': return <Inbox className={className} />;
    case 'Send': return <Send className={className} />;
    case 'FileClock': return <FileClock className={className} />;
    case 'Eye': return <Eye className={className} />;
    case 'ListFilter': return <ListFilter className={className} />;
    case 'CalendarCheck': return <CalendarCheck className={className} />;
    case 'FileText': return <FileText className={className} />;
    case 'Briefcase': return <Briefcase className={className} />;
    case 'Clock': return <Clock className={className} />;
    case 'UserPlus': return <UserPlus className={className} />;
    case 'Calendar': return <Calendar className={className} />;
    default: return <Pin className={className} />;
  }
}

export function SidebarShortcutsModal({ open, onOpenChange }: SidebarShortcutsModalProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  useEffect(() => {
    if (open) {
      setSelectedIds(getSavedShortcutIds(user?.email));
    }
  }, [open, user?.email]);

  const handleToggle = (id: string) => {
    setSelectedIds(prev => {
      if (prev.includes(id)) {
        return prev.filter(x => x !== id);
      } else {
        return [...prev, id];
      }
    });
  };

  const handleResetToDefault = () => {
    setSelectedIds(DEFAULT_SHORTCUT_IDS);
    toast({
      title: '기본값 설정',
      description: '추천 기본 바로가기로 복원되었습니다.',
    });
  };

  const handleClearAll = () => {
    setSelectedIds([]);
  };

  const handleSave = () => {
    saveShortcutIds(selectedIds, user?.email);
    toast({
      title: '설정 저장 완료',
      description: `바로가기 ${selectedIds.length}개가 사이드바에 저장되었습니다.`,
    });
    onOpenChange(false);
  };

  // 카테고리별 그룹화
  const categories: Array<{ key: ShortcutItem['category']; label: string }> = [
    { key: 'education', label: '교육활동' },
    { key: 'approval', label: '전자결재' },
    { key: 'teacher', label: '교원 서비스' },
    { key: 'tool', label: '빠른 도구' },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl max-h-[85vh] flex flex-col p-0 overflow-hidden">
        <DialogHeader className="p-4 sm:p-5 border-b shrink-0 bg-muted/20">
          <div className="flex items-center justify-between">
            <DialogTitle className="text-base sm:text-lg font-bold flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-primary/10 text-primary">
                <Pin className="w-4 h-4" />
              </div>
              사이드바 바로가기 설정
            </DialogTitle>
            <Badge variant="secondary" className="font-bold text-xs">
              선택됨: <b className="text-primary ml-1">{selectedIds.length}</b>개
            </Badge>
          </div>
          <DialogDescription className="text-xs text-muted-foreground mt-1">
            자주 사용하는 교육활동 및 결재 메뉴를 선택하여 사이드바에 고정할 수 있습니다.
          </DialogDescription>
        </DialogHeader>

        {/* 선택 항목 목록 (스크롤 영역) */}
        <div className="flex-1 overflow-y-auto p-4 space-y-5 divide-y divide-border/60">
          {categories.map(cat => {
            const items = ALL_SHORTCUT_ITEMS.filter(i => i.category === cat.key);
            if (items.length === 0) return null;

            return (
              <div key={cat.key} className="pt-3 first:pt-0 space-y-2">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-primary" />
                    {cat.label}
                  </h3>
                  <span className="text-[11px] text-muted-foreground">
                    {items.filter(i => selectedIds.includes(i.id)).length} / {items.length}개 선택
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {items.map(item => {
                    const isChecked = selectedIds.includes(item.id);
                    return (
                      <div
                        key={item.id}
                        onClick={() => handleToggle(item.id)}
                        className={`flex items-start gap-2.5 p-2.5 rounded-xl border text-left cursor-pointer transition-all select-none ${
                          isChecked
                            ? 'bg-primary/5 border-primary/40 shadow-xs'
                            : 'bg-card border-border/70 hover:bg-muted/50'
                        }`}
                      >
                        <Checkbox
                          checked={isChecked}
                          onCheckedChange={() => handleToggle(item.id)}
                          className="mt-0.5"
                          onClick={(e) => e.stopPropagation()}
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5 text-xs font-bold text-foreground">
                            <span className={isChecked ? 'text-primary' : 'text-muted-foreground'}>
                              {renderShortcutIcon(item.iconName, 'w-3.5 h-3.5')}
                            </span>
                            <span className="truncate">{item.label}</span>
                          </div>
                          {item.description && (
                            <p className="text-[11px] text-muted-foreground line-clamp-1 mt-0.5">
                              {item.description}
                            </p>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

        {/* 하단 버튼 액션 바 */}
        <DialogFooter className="p-3 sm:p-4 border-t bg-muted/20 shrink-0 flex items-center justify-between sm:justify-between w-full">
          <div className="flex items-center gap-1.5">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleResetToDefault}
              className="h-8 text-xs font-semibold text-slate-600"
            >
              <RotateCcw className="w-3.5 h-3.5 mr-1" />
              기본값 복원
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleClearAll}
              className="h-8 text-xs text-muted-foreground"
            >
              전체 해제
            </Button>
          </div>

          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(false)}
              className="h-8 text-xs"
            >
              취소
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={handleSave}
              className="h-8 text-xs font-bold bg-primary text-primary-foreground shadow-xs"
            >
              <Check className="w-3.5 h-3.5 mr-1" />
              저장 및 적용
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
