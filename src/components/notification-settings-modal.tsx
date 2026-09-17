'use client';

import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/use-auth';
import { 
  Bell, BellRing, CheckCircle2, AlertCircle, Volume2, Sparkles, 
  Layers, Sliders, ExternalLink, ShieldCheck, Laptop, Clock, Calendar
} from 'lucide-react';
import { 
  loadNotificationSettings, 
  saveNotificationSettings, 
  getNotificationPermission, 
  requestNotificationPermission, 
  sendBrowserNotification, 
  updateAppBadge, 
  playNotificationSound,
  type UserNotificationSettings 
} from '@/lib/services/notificationService';

interface NotificationSettingsModalProps {
  children?: React.ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function NotificationSettingsModal({ children, open: controlledOpen, onOpenChange: setControlledOpen }: NotificationSettingsModalProps) {
  const { user, profile } = useAuth();
  const { toast } = useToast();
  const [internalOpen, setInternalOpen] = useState(false);
  const isControlled = controlledOpen !== undefined;
  const isOpen = isControlled ? controlledOpen : internalOpen;
  const setIsOpen = isControlled ? (setControlledOpen || (() => {})) : setInternalOpen;

  const [permission, setPermission] = useState<NotificationPermission>('default');
  const [settings, setSettings] = useState<UserNotificationSettings>(() => 
    loadNotificationSettings(user?.email)
  );
  const [isTesting, setIsTesting] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setPermission(getNotificationPermission());
      setSettings(loadNotificationSettings(user?.email));
    }
  }, [isOpen, user?.email]);

  // 권한 요청 핸들러
  const handleRequestPermission = async () => {
    const result = await requestNotificationPermission();
    setPermission(result);
    if (result === 'granted') {
      toast({
        title: '알림 권한 허용 완료',
        description: '이제 결재문서 도착 시 PC 우측 하단에 카카오톡 스타일 팝업 알림이 표시됩니다.'
      });
      // 허용 즉시 브라우저 알림 설정도 활성화
      const updated = { ...settings, enableBrowserNotification: true };
      setSettings(updated);
      saveNotificationSettings(updated, user?.email);
    } else if (result === 'denied') {
      toast({
        title: '알림이 차단되었습니다',
        description: '브라우저 상단 주소창 좌측의 설정/자물쇠 아이콘을 클릭하여 알림을 허용으로 변경해주세요.',
        variant: 'destructive'
      });
    }
  };

  // 설정 변경 및 저장
  const handleToggle = (key: keyof UserNotificationSettings, value: boolean) => {
    const updated = { ...settings, [key]: value };
    setSettings(updated);
    saveNotificationSettings(updated, user?.email);

    // 작업표시줄 배지 끄면 즉시 클리어
    if (key === 'enableTaskbarBadge' && !value) {
      updateAppBadge(0, false);
    }
  };

  // 알림 및 배지 즉시 테스트 발송
  const handleTestNotification = () => {
    setIsTesting(true);

    // 1) 알림음 재생
    if (settings.enableSound) {
      playNotificationSound();
    }

    // 2) 작업표시줄 배지 테스트 (숫자 1 설정 후 4초 뒤 복원)
    if (settings.enableTaskbarBadge) {
      updateAppBadge(1, true);
      setTimeout(() => {
        updateAppBadge(0, false);
      }, 4000);
    }

    // 3) 브라우저 토스트 팝업 전송
    const notif = sendBrowserNotification('[테스트] 결재 대기 알림', {
      body: '호치민시한국국제학교 포털 알림이 정상적으로 수신되었습니다. (클릭 시 이동)',
      url: '/inbox',
      playSound: false, // 이미 위에서 재생
      requireInteraction: settings.keepPopupUntilDismissed
    });

    if (!notif && permission !== 'granted') {
      toast({
        title: '알림 권한 필요',
        description: '먼저 상단의 [알림 권한 허용하기] 버튼을 눌러 알림을 허용해주세요.',
        variant: 'destructive'
      });
    } else {
      toast({
        title: '테스트 알림 발송 완료',
        description: '화면 우측 하단 팝업과 작업표시줄 아이콘 배지(1)를 확인해주세요.'
      });
    }

    setTimeout(() => setIsTesting(false), 1500);
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      {children && (
        <DialogTrigger asChild>
          {children}
        </DialogTrigger>
      )}
      <DialogContent className="sm:max-w-[480px] w-[95vw] p-5 sm:p-6 rounded-2xl">
        <DialogHeader className="pb-2 border-b border-slate-100">
          <div className="flex items-center justify-between">
            <DialogTitle className="text-base font-bold flex items-center gap-2 text-slate-900">
              <div className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center border border-indigo-100">
                <BellRing className="w-4 h-4" />
              </div>
              <span>개인 알림 & 작업표시줄 배지 설정</span>
            </DialogTitle>
          </div>
          <DialogDescription className="text-xs text-slate-500 pt-1 leading-relaxed">
            결재문서 도착 및 주요 학교 업무 신호를 Windows 우측 하단 팝업과 작업표시줄 배지로 실시간 수신합니다.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2 text-xs">
          {/* 1. 브라우저 알림 권한 상태 배너 */}
          <div className="p-3.5 rounded-xl border bg-slate-50 border-slate-200 space-y-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 font-bold text-slate-700">
                <Laptop className="w-3.5 h-3.5 text-indigo-600" />
                <span>PC 브라우저 알림 권한</span>
              </div>
              {permission === 'granted' ? (
                <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200 text-[11px] font-bold">
                  <CheckCircle2 className="w-3 h-3 mr-1" /> 알림 허용됨 (정상)
                </Badge>
              ) : permission === 'denied' ? (
                <Badge variant="destructive" className="text-[11px] font-bold">
                  <AlertCircle className="w-3 h-3 mr-1" /> 차단됨 (설정 변경 필요)
                </Badge>
              ) : (
                <Badge variant="outline" className="bg-amber-50 text-amber-800 border-amber-200 text-[11px] font-bold">
                  권한 미허용
                </Badge>
              )}
            </div>

            {permission !== 'granted' ? (
              <div className="pt-1">
                <Button 
                  onClick={handleRequestPermission}
                  className="w-full h-8 text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg shadow-xs"
                >
                  <Bell className="w-3.5 h-3.5 mr-1.5" /> 알림 권한 허용하기 (클릭)
                </Button>
                <p className="text-[11px] text-slate-500 mt-1.5 leading-normal">
                  버튼 클릭 후 브라우저 좌측 상단에 뜨는 팝업에서 <strong>[허용]</strong>을 선택해주세요.
                </p>
              </div>
            ) : (
              <p className="text-[11px] text-slate-600 leading-normal">
                브라우저가 최소화되어 있어도 결재 도착 시 Windows 우측 하단에 카카오톡처럼 팝업 알림이 뜹니다.
              </p>
            )}
          </div>

          {/* 2. 세부 설정 토글 옵션 */}
          <div className="space-y-3 pt-1">
            {/* 작업표시줄 아이콘 배지 */}
            <div className="flex items-center justify-between p-3 rounded-xl border border-slate-200 bg-white hover:bg-slate-50/60 transition-colors">
              <div className="space-y-0.5 pr-2">
                <Label htmlFor="taskbar-badge" className="text-xs font-bold text-slate-800 flex items-center gap-1.5 cursor-pointer">
                  <Layers className="w-3.5 h-3.5 text-rose-500" />
                  <span>작업표시줄 아이콘에 미결재 숫자 배지 표시</span>
                </Label>
                <p className="text-[11px] text-slate-500 leading-relaxed">
                  결재 대기 문서가 있을 때 작업표시줄 아이콘과 브라우저 탭에 카카오톡처럼 빨간색 숫자 배지(1, 2..)를 표시합니다.
                </p>
              </div>
              <Switch 
                id="taskbar-badge"
                checked={settings.enableTaskbarBadge}
                onCheckedChange={(val) => handleToggle('enableTaskbarBadge', val)}
              />
            </div>

            {/* 새 결재문서 팝업 알림 */}
            <div className="flex items-center justify-between p-3 rounded-xl border border-slate-200 bg-white hover:bg-slate-50/60 transition-colors">
              <div className="space-y-0.5 pr-2">
                <Label htmlFor="browser-popup" className="text-xs font-bold text-slate-800 flex items-center gap-1.5 cursor-pointer">
                  <Bell className="w-3.5 h-3.5 text-indigo-600" />
                  <span>새 결재문서 도착 시 PC 우측 하단 팝업 띄우기</span>
                </Label>
                <p className="text-[11px] text-slate-500 leading-relaxed">
                  본인이 결재해야 할 결석계, 체험학습, 기안서가 도착하면 화면 우측 하단에 알림 팝업을 띄웁니다.
                </p>
              </div>
              <Switch 
                id="browser-popup"
                checked={settings.enableBrowserNotification && permission === 'granted'}
                disabled={permission !== 'granted'}
                onCheckedChange={(val) => handleToggle('enableBrowserNotification', val)}
              />
            </div>

            {/* 팝업 화면에 계속 유지 (자리 비움 대비) */}
            <div className="flex items-center justify-between p-3 rounded-xl border border-slate-200 bg-white hover:bg-slate-50/60 transition-colors">
              <div className="space-y-0.5 pr-2">
                <Label htmlFor="sticky-popup" className="text-xs font-bold text-slate-800 flex items-center gap-1.5 cursor-pointer">
                  <Clock className="w-3.5 h-3.5 text-blue-600" />
                  <span>자리 비움 대비: 직접 닫을 때까지 팝업 유지</span>
                </Label>
                <p className="text-[11px] text-slate-500 leading-relaxed">
                  자리를 비웠을 때도 놓치지 않도록, 사용자가 직접 클릭하거나 닫을 때까지 알림창이 사라지지 않고 화면에 유지됩니다.
                </p>
              </div>
              <Switch 
                id="sticky-popup"
                checked={settings.keepPopupUntilDismissed}
                disabled={permission !== 'granted'}
                onCheckedChange={(val) => handleToggle('keepPopupUntilDismissed', val)}
              />
            </div>

            {/* 등교지도 근무 전일 알림 */}
            <div className="flex items-center justify-between p-3 rounded-xl border border-slate-200 bg-white hover:bg-slate-50/60 transition-colors">
              <div className="space-y-0.5 pr-2">
                <Label htmlFor="duty-notify" className="text-xs font-bold text-slate-800 flex items-center gap-1.5 cursor-pointer">
                  <Calendar className="w-3.5 h-3.5 text-emerald-600" />
                  <span>등교지도 근무일 전일(11:40) 사전 알림</span>
                </Label>
                <p className="text-[11px] text-slate-500 leading-relaxed">
                  등교지도 근무일 전날(월요일 근무는 직전 금요일) 오전 11시 40분에 내일(월요일) 아침 등교지도 근무 안내 팝업을 띄웁니다.
                </p>
              </div>
              <Switch 
                id="duty-notify"
                checked={settings.notifyOnDutySchedule}
                disabled={permission !== 'granted'}
                onCheckedChange={(val) => handleToggle('notifyOnDutySchedule', val)}
              />
            </div>

            {/* 알림 소리 */}
            <div className="flex items-center justify-between p-3 rounded-xl border border-slate-200 bg-white hover:bg-slate-50/60 transition-colors">
              <div className="space-y-0.5 pr-2">
                <Label htmlFor="sound-toggle" className="text-xs font-bold text-slate-800 flex items-center gap-1.5 cursor-pointer">
                  <Volume2 className="w-3.5 h-3.5 text-amber-500" />
                  <span>알림 소리(챠임 사운드) 재생</span>
                </Label>
                <p className="text-[11px] text-slate-500 leading-relaxed">
                  알림 수신 시 경쾌한 챠임 효과음을 함께 재생합니다.
                </p>
              </div>
              <Switch 
                id="sound-toggle"
                checked={settings.enableSound}
                onCheckedChange={(val) => handleToggle('enableSound', val)}
              />
            </div>
          </div>
        </div>

        <DialogFooter className="pt-2 border-t border-slate-100 flex items-center justify-between sm:justify-between w-full">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleTestNotification}
            disabled={isTesting}
            className="h-8 text-xs font-bold text-indigo-700 border-indigo-200 bg-indigo-50/50 hover:bg-indigo-100"
          >
            <Sparkles className="w-3.5 h-3.5 mr-1 text-indigo-600" />
            <span>알림 및 배지 테스트</span>
          </Button>

          <Button
            type="button"
            onClick={() => setIsOpen(false)}
            className="h-8 text-xs font-bold px-4 bg-slate-900 hover:bg-slate-800 text-white rounded-lg"
          >
            확인 및 닫기
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
