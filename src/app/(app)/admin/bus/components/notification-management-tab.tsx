'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
    Save, Bell, Users, GraduationCap, Info, Plus, 
    Calendar, Clock, Trash2, Edit2 
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useTranslation } from '@/hooks/use-translation';
import { 
    onNotificationSettingsUpdate, saveNotificationSettings,
    getNotificationSchedules, onNotificationSchedulesUpdate, addNotificationSchedule, 
    updateNotificationSchedule, deleteNotificationSchedule,
    sendInstantNotification,
    onGlobalNotificationConfigUpdate, updateGlobalNotificationConfig
} from '@/lib/kisbus';
import type { 
    NotificationSettings, NotificationTrigger, NotificationSchedule, 
    NewNotificationSchedule, Teacher, DayOfWeek 
} from '@/lib/kisbus/types';
import { Badge } from '@/components/ui/badge';
import { 
    Dialog, DialogContent, DialogDescription, DialogFooter, 
    DialogHeader, DialogTitle, DialogTrigger 
} from '@/components/ui/dialog';
import { 
    AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, 
    AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger 
} from '@/components/ui/alert-dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { cn } from '@/lib/kisbus/utils';
import { SendHorizontal, Zap } from 'lucide-react';

const DEFAULT_SETTINGS: NotificationSettings[] = [
    { id: 'parent-boarding', target: 'parent', trigger: 'boarding', isEnabled: true, titleTemplate: '[KIS 버스] 승차 안내', bodyTemplate: '{studentName} 학생이 {busName} 버스에 승차하였습니다. (시간: {time})', lastModified: '' },
    { id: 'parent-disembarking', target: 'parent', trigger: 'disembarking', isEnabled: true, titleTemplate: '[KIS 버스] 하차 안내', bodyTemplate: '{studentName} 학생이 {destinationName}에서 하차하였습니다. 안심하고 마중 나오세요.', lastModified: '' },
    { id: 'parent-absence', target: 'parent', trigger: 'absence', isEnabled: true, titleTemplate: '[KIS 버스] 미탑승/결석 확인', bodyTemplate: '{studentName} 학생의 미탑승(결석) 처리가 완료되었습니다. 확인 부탁드립니다.', lastModified: '' },
    { id: 'teacher-delay', target: 'teacher', trigger: 'delay', isEnabled: true, titleTemplate: '[KIS 버스] 운행 지연 알림', bodyTemplate: '{busName} 버스 운행이 지연되고 있습니다. {routeType} 노선 확인 바랍니다.', lastModified: '' },
];

const DAYS: DayOfWeek[] = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

interface NotificationManagementTabProps {
    teachers: Teacher[];
}

export function NotificationManagementTab({ teachers }: NotificationManagementTabProps) {
    const [settings, setSettings] = useState<NotificationSettings[]>(DEFAULT_SETTINGS);
    const [schedules, setSchedules] = useState<NotificationSchedule[]>([]);
    const [globalVacationMode, setGlobalVacationMode] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const { toast } = useToast();
    const { t } = useTranslation();

    // Schedule form states
    const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
    const [editingSchedule, setEditingSchedule] = useState<NotificationSchedule | null>(null);
    const [title, setTitle] = useState('');
    const [message, setMessage] = useState('');
    const [time, setTime] = useState('08:00');
    const [selectedDays, setSelectedDays] = useState<DayOfWeek[]>(['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']);
    const [selectedTeacherIds, setSelectedTeacherIds] = useState<string[]>([]);
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        const unsubSettings = onNotificationSettingsUpdate((data) => {
            if (data.length > 0) {
                const merged = DEFAULT_SETTINGS.map(def => {
                    const found = data.find(d => d.id === def.id);
                    return found || def;
                });
                setSettings(merged);
            }
            setIsLoading(false);
        });

        const unsubSchedules = onNotificationSchedulesUpdate(setSchedules);
        
        const unsubGlobal = onGlobalNotificationConfigUpdate((data) => {
            setGlobalVacationMode(!!data.vacationMode);
        });

        return () => {
            unsubSettings();
            unsubSchedules();
            unsubGlobal();
        };
    }, []);

    const resetScheduleForm = () => {
        setTitle('');
        setMessage('');
        setTime('08:00');
        setSelectedDays(['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']);
        setSelectedTeacherIds([]);
        setEditingSchedule(null);
    };

    const handleEditSchedule = (schedule: NotificationSchedule) => {
        setEditingSchedule(schedule);
        setTitle(schedule.title);
        setMessage(schedule.message);
        setTime(schedule.time);
        setSelectedDays(schedule.days);
        setSelectedTeacherIds(schedule.teacherIds);
        setIsAddDialogOpen(true);
    };

    const handleSaveSchedule = async () => {
        if (!title.trim() || !message.trim() || selectedDays.length === 0) {
            toast({ title: t('error'), description: '모든 필수 항목을 입력해주세요.', variant: 'destructive' });
            return;
        }

        setIsSaving(true);
        try {
            const scheduleData = {
                title: title.trim(),
                message: message.trim(),
                time,
                days: selectedDays,
                teacherIds: selectedTeacherIds,
                isActive: editingSchedule ? editingSchedule.isActive : true,
                createdAt: editingSchedule ? editingSchedule.createdAt : new Date().toISOString()
            };

            if (editingSchedule) {
                await updateNotificationSchedule(editingSchedule.id, scheduleData);
                toast({ title: t('success'), description: t('admin.notifications.save_success') });
            } else {
                await addNotificationSchedule(scheduleData as NewNotificationSchedule);
                toast({ title: t('success'), description: t('admin.notifications.save_success') });
            }
            setIsAddDialogOpen(false);
            resetScheduleForm();
        } catch (error) {
            toast({ title: t('error'), description: '일정 저장 중 오류가 발생했습니다.', variant: 'destructive' });
        } finally {
            setIsSaving(false);
        }
    };

    const handleDeleteSchedule = async (id: string) => {
        try {
            await deleteNotificationSchedule(id);
            toast({ title: t('success'), description: t('admin.notifications.delete_success') });
        } catch (error) {
            toast({ title: t('error'), description: '일정 삭제 중 오류가 발생했습니다.', variant: 'destructive' });
        }
    };

    const handleSendNow = async (schedule: NotificationSchedule) => {
        try {
            await sendInstantNotification(schedule);
            toast({ title: '발송 요청 완료', description: '즉시 발송 요청이 등록되었습니다.' });
        } catch (error) {
            toast({ title: '발송 실패', description: '즉시 발송 처리 중 오류가 발생했습니다.', variant: 'destructive' });
        }
    };

    const handleSettingChange = (id: string, field: keyof NotificationSettings, value: any) => {
        setSettings(prev => prev.map(s => s.id === id ? { ...s, [field]: value } : s));
    };

    const handleSaveSetting = async (id: string) => {
        const setting = settings.find(s => s.id === id);
        if (!setting) return;

        try {
            await saveNotificationSettings(setting);
            toast({ title: '저장 완료', description: '알림 설정이 성공적으로 반영되었습니다.' });
        } catch (error) {
            toast({ title: '저장 실패', description: '설정 저장 중 오류가 발생했습니다.', variant: 'destructive' });
        }
    };

    const renderSettingCard = (s: NotificationSettings) => {
        const triggerLabels: Record<NotificationTrigger, string> = {
            boarding: '버스 승차 시',
            disembarking: '목적지 하차 시',
            absence: '결석/미탑승 처리 시',
            delay: '운행 지연 시'
        };

        return (
            <Card key={s.id} className="mb-6 border-slate-200 shadow-sm overflow-hidden">
                <CardHeader className="bg-slate-50/50 py-4">
                    <div className="flex justify-between items-center">
                        <div className="flex items-center gap-3">
                            <Badge variant="outline" className="bg-white">{triggerLabels[s.trigger]}</Badge>
                            <CardTitle className="text-lg">{s.target === 'parent' ? '학부모용 알림' : '교사용 알림'}</CardTitle>
                        </div>
                        <div className="flex items-center gap-2">
                            <Label htmlFor={`${s.id}-enable`} className="text-xs text-muted-foreground">자동 발송</Label>
                            <Switch 
                                id={`${s.id}-enable`} 
                                checked={s.isEnabled} 
                                onCheckedChange={(val) => handleSettingChange(s.id, 'isEnabled', val)}
                            />
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="pt-6 space-y-4">
                    <div className="space-y-2">
                        <Label>알림 제목</Label>
                        <Input 
                            value={s.titleTemplate} 
                            onChange={(e) => handleSettingChange(s.id, 'titleTemplate', e.target.value)}
                            placeholder="알림 팝업에 표시될 제목"
                        />
                    </div>
                    <div className="space-y-2">
                        <Label>알림 내용 (템플릿)</Label>
                        <Textarea 
                            value={s.bodyTemplate} 
                            onChange={(e) => handleSettingChange(s.id, 'bodyTemplate', e.target.value)}
                            placeholder="메시지 본문 내용을 입력하세요"
                            rows={3}
                        />
                        <p className="text-[10px] text-muted-foreground flex items-center gap-1">
                            <Info className="w-3 h-3" />
                            사용 가능 변수: {`{studentName}, {busName}, {time}, {destinationName}, {routeType}`}
                        </p>
                    </div>
                </CardContent>
                <CardFooter className="bg-slate-50/30 border-t py-3 flex justify-end">
                    <Button size="sm" onClick={() => handleSaveSetting(s.id)}>
                        <Save className="w-4 h-4 mr-2" /> 저장하기
                    </Button>
                </CardFooter>
            </Card>
        );
    };

    return (
        <div className="space-y-6">
            <Card className="border-emerald-200 bg-emerald-50/50 shadow-sm">
                <CardHeader className="py-4">
                    <div className="flex justify-between items-center">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-emerald-100 rounded-full">
                                <Bell className="w-5 h-5 text-emerald-700" />
                            </div>
                            <div>
                                <CardTitle className="text-lg">전체 방학/휴일 모드</CardTitle>
                                <CardDescription className="text-xs mt-1">
                                    활성화 시, 교사용 개별 설정과 무관하게 <strong>모든 푸시 알림 발송이 일시 정지</strong>됩니다.
                                </CardDescription>
                            </div>
                        </div>
                        <Switch 
                            checked={globalVacationMode}
                            onCheckedChange={async (checked) => {
                                try {
                                    await updateGlobalNotificationConfig(checked);
                                    toast({ title: '설정 변경', description: `전체 방학/휴일 모드가 ${checked ? '활성화' : '해제'}되었습니다.` });
                                } catch (e) {
                                    toast({ title: '오류', description: '설정을 변경할 수 없습니다.', variant: 'destructive' });
                                }
                            }}
                        />
                    </div>
                </CardHeader>
            </Card>

            <Tabs defaultValue="parents" className="w-full">
                <TabsList className="grid w-full grid-cols-2 max-w-[400px]">
                    <TabsTrigger value="parents" className="gap-2">
                        <Users className="w-4 h-4" /> 학부모 앱
                    </TabsTrigger>
                    <TabsTrigger value="teachers" className="gap-2">
                        <GraduationCap className="w-4 h-4" /> 교사 앱
                    </TabsTrigger>
                </TabsList>

                {/* --- 1. 학부모 앱 탭 (자동 알림 설정) --- */}
                <TabsContent value="parents" className="space-y-6 mt-6">
                    <div className="bg-sky-50 border border-sky-100 rounded-xl p-4 flex gap-3">
                        <Bell className="w-5 h-5 text-sky-600 mt-0.5" />
                        <div className="flex-1">
                            <h3 className="font-semibold text-sky-900 text-sm">학부모용 자동 알림 설정</h3>
                            <p className="text-sky-700 text-xs mt-1 leading-relaxed">
                                학생의 버스 승/하차 시 부모님께 자동으로 발송되는 알림 템플릿입니다.
                            </p>
                        </div>
                    </div>
                    
                    <div className="grid grid-cols-1 gap-4">
                        {settings.filter(s => s.target === 'parent').map(renderSettingCard)}
                    </div>
                </TabsContent>

                {/* --- 2. 교사 앱 탭 (공지 및 예약 알림 통합) --- */}
                <TabsContent value="teachers" className="space-y-6 mt-6">
                    <div className="flex justify-between items-center bg-slate-50 border rounded-xl p-5">
                        <div className="flex gap-4 items-center">
                            <div className="p-3 bg-primary/10 rounded-full">
                                <Clock className="w-6 h-6 text-primary" />
                            </div>
                            <div>
                                <h2 className="text-lg font-bold tracking-tight">교사용 알림 관리</h2>
                                <p className="text-xs text-muted-foreground">교사들에게 주기적으로 보낼 공지나 알림 일정을 관리합니다.</p>
                            </div>
                        </div>
                        <Dialog open={isAddDialogOpen} onOpenChange={(open) => {
                            setIsAddDialogOpen(open);
                            if (!open) resetScheduleForm();
                        }}>
                            <DialogTrigger asChild>
                                <Button className="gap-2 shadow-sm">
                                    <Plus className="w-4 h-4" /> 새로운 알림 추가
                                </Button>
                            </DialogTrigger>
                            <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
                                <DialogHeader>
                                    <DialogTitle>{editingSchedule ? t('admin.notifications.edit') : t('admin.notifications.add_new')}</DialogTitle>
                                    <DialogDescription>알림 발송 일정과 내용을 설정합니다.</DialogDescription>
                                </DialogHeader>
                                <div className="grid gap-6 py-4">
                                    <div className="grid gap-2">
                                        <Label htmlFor="title">{t('admin.notifications.title_label')} <span className="text-destructive">*</span></Label>
                                        <Input id="title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="출근 확인 알림" />
                                    </div>
                                    <div className="grid gap-2">
                                        <Label htmlFor="message">{t('admin.notifications.message_label')} <span className="text-destructive">*</span></Label>
                                        <Textarea id="message" value={message} onChange={(e) => setMessage(e.target.value)} placeholder="학생들의 탑승을 확인해주세요." />
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="grid gap-2">
                                            <Label htmlFor="time">{t('admin.notifications.time_label')} <span className="text-destructive">*</span></Label>
                                            <Input id="time" type="time" value={time} onChange={(e) => setTime(e.target.value)} />
                                        </div>
                                        <div className="grid gap-2">
                                            <Label>{t('admin.notifications.days_label')} <span className="text-destructive">*</span></Label>
                                            <div className="flex flex-wrap gap-2">
                                                {DAYS.map(day => (
                                                    <Badge 
                                                        key={day} 
                                                        variant={selectedDays.includes(day) ? "default" : "outline"}
                                                        className="cursor-pointer"
                                                        onClick={() => {
                                                            setSelectedDays(curr => 
                                                                curr.includes(day) ? curr.filter(d => d !== day) : [...curr, day]
                                                            );
                                                        }}
                                                    >
                                                        {t(`day_short.${day.toLowerCase()}`)}
                                                    </Badge>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                    <div className="grid gap-2">
                                        <div className="flex justify-between items-center mb-1">
                                            <Label>{t('admin.notifications.teachers_label')} (미선택 시 전체 발송)</Label>
                                            <Button variant="ghost" size="sm" onClick={() => {
                                                if (selectedTeacherIds.length === teachers.length) setSelectedTeacherIds([]);
                                                else setSelectedTeacherIds(teachers.map(t => t.id));
                                            }} className="h-7 text-xs">
                                                {selectedTeacherIds.length === teachers.length ? '전체 해제' : '전체 선택'}
                                            </Button>
                                        </div>
                                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 border rounded-md p-3 max-h-[150px] overflow-y-auto bg-muted/30">
                                            {teachers.map(teacher => (
                                                <div key={teacher.id} className="flex items-center space-x-2">
                                                    <Checkbox 
                                                        id={`teacher-${teacher.id}`} 
                                                        checked={selectedTeacherIds.includes(teacher.id)}
                                                        onCheckedChange={() => {
                                                            setSelectedTeacherIds(curr => 
                                                                curr.includes(teacher.id) ? curr.filter(id => id !== teacher.id) : [...curr, teacher.id]
                                                            );
                                                        }}
                                                    />
                                                    <label htmlFor={`teacher-${teacher.id}`} className="text-sm font-medium leading-none cursor-pointer">
                                                        {teacher.name}
                                                    </label>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                                <DialogFooter>
                                    <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>{t('cancel')}</Button>
                                    <Button onClick={handleSaveSchedule} disabled={isSaving} className="gap-2">
                                        <Save className="w-4 h-4" /> {t('save')}
                                    </Button>
                                </DialogFooter>
                            </DialogContent>
                        </Dialog>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {schedules.length === 0 ? (
                            <Card className="col-span-full py-12 flex flex-col items-center justify-center border-dashed bg-slate-50/50">
                                <Bell className="w-12 h-12 text-muted-foreground/20 mb-4" />
                                <p className="text-muted-foreground text-sm">등록된 알림 일정이 없습니다.</p>
                            </Card>
                        ) : (
                            schedules.map(schedule => (
                                <Card key={schedule.id} className={cn("group transition-all hover:shadow-lg border-2", !schedule.isActive ? "opacity-60 border-transparent bg-slate-50" : "border-transparent border-l-primary")}>
                                    <CardHeader className="pb-3">
                                        <div className="flex justify-between items-start">
                                            <div className="flex items-center gap-2">
                                                <div className={cn("p-2 rounded-lg", schedule.isActive ? "bg-primary/10 text-primary" : "bg-slate-200 text-slate-500")}>
                                                    <Clock className="w-4 h-4" />
                                                </div>
                                                <span className="text-sm font-bold">{schedule.time}</span>
                                            </div>
                                            <div className="flex items-center gap-3">
                                                <Switch 
                                                    checked={schedule.isActive} 
                                                    onCheckedChange={async () => {
                                                        await updateNotificationSchedule(schedule.id, { isActive: !schedule.isActive });
                                                    }}
                                                />
                                            </div>
                                        </div>
                                        <CardTitle className="mt-4 text-base">{schedule.title}</CardTitle>
                                        <CardDescription className="line-clamp-2 min-h-[40px] text-xs">{schedule.message}</CardDescription>
                                    </CardHeader>
                                    <CardContent className="pb-4">
                                        <div className="flex flex-wrap gap-1 mb-4">
                                            {schedule.days.map(d => (
                                                <Badge key={d} variant="secondary" className="bg-slate-100 text-[10px] py-0 font-normal">
                                                    {t(`day_short.${d.toLowerCase()}`)}
                                                </Badge>
                                            ))}
                                        </div>
                                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                            <Users className="w-3.5 h-3.5" />
                                            <span>{schedule.teacherIds.length === 0 || schedule.teacherIds.length === teachers.length 
                                                ? '전체 교사 대상' 
                                                : `${schedule.teacherIds.length}명의 교사 대상`}</span>
                                        </div>
                                    </CardContent>
                                    <CardFooter className="bg-slate-50/50 p-3 flex justify-between gap-2 border-t">
                                        <div className="flex gap-2">
                                            <Button variant="ghost" size="sm" onClick={() => handleEditSchedule(schedule)} className="h-8 text-xs hover:bg-white px-2">
                                                <Edit2 className="w-3.5 h-3.5 mr-1" /> 수정
                                            </Button>
                                            <AlertDialog>
                                                <AlertDialogTrigger asChild>
                                                    <Button variant="ghost" size="sm" className="h-8 text-xs text-destructive hover:text-destructive hover:bg-white px-2">
                                                        <Trash2 className="w-3.5 h-3.5 mr-1" /> 삭제
                                                    </Button>
                                                </AlertDialogTrigger>
                                                <AlertDialogContent>
                                                    <AlertDialogHeader>
                                                        <AlertDialogTitle>알림 일정을 삭제하시겠습니까?</AlertDialogTitle>
                                                        <AlertDialogDescription>이 작업은 되돌릴 수 없으며 더 이상 알림이 발송되지 않습니다.</AlertDialogDescription>
                                                    </AlertDialogHeader>
                                                    <AlertDialogFooter>
                                                        <AlertDialogCancel>{t('cancel')}</AlertDialogCancel>
                                                        <AlertDialogAction onClick={() => handleDeleteSchedule(schedule.id)} className="bg-destructive hover:bg-destructive/90">
                                                            {t('delete')}
                                                        </AlertDialogAction>
                                                    </AlertDialogFooter>
                                                </AlertDialogContent>
                                            </AlertDialog>
                                        </div>
                                        
                                        <Button 
                                            variant="default" 
                                            size="sm" 
                                            onClick={() => handleSendNow(schedule)}
                                            className="h-8 text-xs gap-1.5 px-3 bg-emerald-600 hover:bg-emerald-700 shadow-sm"
                                        >
                                            <SendHorizontal className="w-3.5 h-3.5" /> 즉시 발송
                                        </Button>
                                    </CardFooter>
                                </Card>
                            ))
                        )}
                    </div>
                </TabsContent>
            </Tabs>
        </div>
    );
}

