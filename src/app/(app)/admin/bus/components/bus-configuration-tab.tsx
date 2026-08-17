'use client';

import React, { useState, useRef, useMemo, useCallback, useEffect } from 'react';
import { 
    addDestination, deleteDestination, approveSuggestedDestination, addDestinationsInBatch,
    updateRouteStops, clearAllSuggestedDestinations, clearDestinations,
    deleteSuggestedDestination, updateRoute, updateDestinationZone, updateDestinationsZoneBatch
} from '@/lib/kisbus';
import { getGlobalSettings, updateGlobalSettings } from '@/lib/kisbus/settings';
import type { Bus, Route, Destination, DayOfWeek, RouteType, NewDestination } from '@/lib/kisbus/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Upload, Trash2, PlusCircle, Download, X, Search, Copy, ArrowLeft, ArrowRight, ArrowUp, ArrowDown, Bus as BusIcon, Check } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { cn, normalizeString } from '@/lib/kisbus/utils';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { useTranslation } from '@/hooks/use-translation';
import { doc, deleteDoc } from 'firebase/firestore';
import { getKisbusDb as db } from '@/lib/kisbus/firebase';

interface BusConfigurationTabProps {
  buses: Bus[];
  routes: Route[];
  destinations: Destination[];
  suggestedDestinations: Destination[];
  selectedDay: DayOfWeek;
  selectedRouteType: RouteType;
  selectedBusId: string | null;
}

export const BusConfigurationTab = ({
  buses,
  routes,
  destinations,
  suggestedDestinations,
  selectedDay,
  selectedRouteType,
  selectedBusId,
}: BusConfigurationTabProps) => {
  const [newDestinationName, setNewDestinationName] = useState('');
  const [destinationSearchQuery, setDestinationSearchQuery] = useState('');
  const [newGroupName, setNewGroupName] = useState('');
  const { toast } = useToast();
  const { t } = useTranslation();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [selectedRouteStopIds, setSelectedRouteStopIds] = useState<string[]>([]);
  const [selectedAllDestIds, setSelectedAllDestIds] = useState<string[]>([]);
  const [selectedBatchZone, setSelectedBatchZone] = useState<string>('미지정');
  const [isBatchUpdatingZone, setIsBatchUpdatingZone] = useState<boolean>(false);
  
  const [busFareSettings, setBusFareSettings] = useState<Record<string, number>>({
      'Zone A (근거리)': 50000,
      'Zone B (중거리)': 80000,
      'Zone C (원거리)': 100000
  });
  const [isFareSaving, setIsFareSaving] = useState(false);
  const [busFareCurrency, setBusFareCurrency] = useState<'VND' | 'KRW' | 'USD'>('VND');

  useEffect(() => {
      getGlobalSettings().then(cfg => {
          if (cfg?.busFareSettings) {
              setBusFareSettings(cfg.busFareSettings);
          }
          if (cfg?.busFareCurrency) {
              setBusFareCurrency(cfg.busFareCurrency as any);
          }
      });
  }, []);

  const handleSaveFareSettings = async () => {
      setIsFareSaving(true);
      try {
          await updateGlobalSettings({ busFareSettings, busFareCurrency });
          toast({
              title: "요금 및 통화 설정 저장 완료",
              description: `목적지 그룹별 버스 요금 및 화폐 단위(${busFareCurrency})가 성공적으로 변경되었습니다.`
          });
      } catch (err) {
          toast({
              variant: "destructive",
              title: "저장 실패",
              description: "요금 설정을 저장하는 도중 오류가 발생했습니다."
          });
      } finally {
          setIsFareSaving(false);
      }
  };
  
  const [isCopyRouteDialogOpen, setCopyRouteDialogOpen] = useState(false);
  const allDays: DayOfWeek[] = useMemo(() => ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'], []);
  const [daysToCopyRouteTo, setDaysToCopyRouteTo] = useState<Partial<Record<DayOfWeek, boolean>>>(
      () => allDays.reduce((acc, day) => ({ ...acc, [day]: true }), {})
  );
  const [routeTypesToCopyRouteTo, setRouteTypesToCopyRouteTo] = useState<Partial<Record<'Morning' | 'Afternoon', boolean>>>({ Morning: true, Afternoon: true });


  const selectedBus = useMemo(() => {
    if (!selectedBusId) return null;
    return buses.find(b => b.id === selectedBusId);
  }, [buses, selectedBusId]);
  
  const currentRoute = useMemo(() => {
    if (!selectedBusId) return null;
    return routes.find(r =>
        r.busId === selectedBusId &&
        r.dayOfWeek === selectedDay &&
        r.type === selectedRouteType
    );
  }, [routes, selectedBusId, selectedDay, selectedRouteType]);

  useEffect(() => {
      setSelectedRouteStopIds([]);
      setSelectedAllDestIds([]);
  }, [currentRoute?.id]);


  const filteredDestinations = useMemo(() => {
    if (!destinationSearchQuery) {
        return destinations;
    }
    return destinations.filter(dest => 
        normalizeString(dest.name).includes(normalizeString(destinationSearchQuery))
    );
  }, [destinations, destinationSearchQuery]);

  const busesUsingDestination = useMemo(() => {
    const targetDestId = selectedAllDestIds.length === 1 ? selectedAllDestIds[0] : null;
    if (!targetDestId) return [];

    return routes
        .filter(r => 
            r.dayOfWeek === selectedDay && 
            r.type === selectedRouteType && 
            r.stops.includes(targetDestId)
        )
        .map(r => buses.find(b => b.id === r.busId)?.name)
        .filter(Boolean) as string[];
  }, [selectedAllDestIds, routes, selectedDay, selectedRouteType, buses]);

  const getStopsForCurrentRoute = useCallback(() => {
    if (!currentRoute) return [];
    return currentRoute.stops.map(stopId => destinations.find(d => d.id === stopId)!).filter(Boolean);
  }, [currentRoute, destinations]);

   const handleAddDestination = async () => {
        const trimmedName = newDestinationName.trim();
        if (!trimmedName) return;

        const normNew = normalizeString(trimmedName);
        if (destinations.some(d => normalizeString(d.name) === normNew)) {
            toast({ title: t('notice'), description: t('admin.bus_config.dest.add.already_exists'), variant: 'default' });
            return;
        }

        try {
            await addDestination({ name: trimmedName });
            setNewDestinationName('');
            toast({ title: t('success'), description: t('admin.bus_config.dest.add.success') });
        } catch (error) {
            toast({ title: t('error'), description: t('admin.bus_config.dest.add.error'), variant: 'destructive' });
        }
    };
    
    const handleDeleteDestination = async (id: string) => {
        try {
            await deleteDestination(id);
            toast({ title: t('success'), description: t('admin.bus_config.dest.delete.success') });
        } catch (error) {
            toast({ title: t('error'), description: t('admin.bus_config.dest.delete.error'), variant: 'destructive' });
        }
    };
    
    const handleClearAllDestinations = async () => {
        const { dismiss } = toast({ title: t('processing'), description: t('admin.bus_config.dest.delete_all.processing') });
        try {
            await clearDestinations();
            dismiss();
            toast({ title: t('success'), description: t('admin.bus_config.dest.delete_all.success') });
        } catch (error) {
            dismiss();
            toast({ title: t('error'), description: t('admin.bus_config.dest.delete_all.error'), variant: "destructive" });
        }
    };
  
  const handleDownloadDestinationTemplate = () => {
    import('xlsx').then(XLSX => {
        const headers = ["목적지 이름", "목적지그룹(선택)"];
        const examples = [["경남 랜드마크", "Zone A (근거리)"], ["서호 호수공원", "Zone B (중거리)"]];
        const wsData = [headers, ...examples];
        const ws = XLSX.utils.aoa_to_sheet(wsData);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "목적지_템플릿");
        XLSX.writeFile(wb, "destination_template.xlsx");
    }).catch(err => {
        console.error(err);
        toast({ title: t('error'), description: "Excel 다운로드 중 오류가 발생했습니다.", variant: 'destructive' });
    });
  };
  
  const handleDownloadDestinationList = useCallback(() => {
        if (destinations.length === 0) {
            toast({ title: t('notice'), description: t('admin.bus_config.dest.download.no_data') });
            return;
        }
        import('xlsx').then(XLSX => {
            const headers = ["목적지 이름", "목적지그룹"];
            const wsData = [
                headers,
                ...destinations.map(d => [d.name, d.zone || '미지정'])
            ];
            const ws = XLSX.utils.aoa_to_sheet(wsData);
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, "목적지_목록");
            XLSX.writeFile(wb, `destination_list.xlsx`);
        }).catch(err => {
            console.error(err);
            toast({ title: t('error'), description: "Excel 다운로드 중 오류가 발생했습니다.", variant: 'destructive' });
        });
    }, [destinations, toast, t]);

  const handleDestinationFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (e) => {
        try {
            const XLSX = await import('xlsx');
            const data = new Uint8Array(e.target?.result as ArrayBuffer);
            const workbook = XLSX.read(data, { type: 'array' });
            const firstSheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[firstSheetName];
            const results: any[] = XLSX.utils.sheet_to_json(worksheet, { defval: "" });

            const normalizedExisting = new Set(destinations.map(d => normalizeString(d.name)));
            const newDestinationsData: any[] = results.map((row: any) => ({
                name: (row['목적지 이름'] || row['name'] || '').toString().trim(),
                zone: (row['목적지그룹(선택)'] || row['목적지그룹'] || row['zone'] || '').toString().trim() || '미지정'
            })).filter(dest => {
                const normName = normalizeString(dest.name);
                return normName && !normalizedExisting.has(normName);
            });

            if (newDestinationsData.length === 0) {
                toast({ title: t('notice'), description: t('admin.bus_config.dest.batch.no_new'), variant: "default" });
                return;
            }
            const { dismiss } = toast({ title: t('processing'), description: t('admin.bus_config.dest.batch.processing') });
            try {
                await addDestinationsInBatch(newDestinationsData);
                dismiss();
                toast({ title: t('success'), description: t('admin.bus_config.dest.batch.success', {count: newDestinationsData.length}) });
            } catch (error) {
                dismiss();
                toast({ title: t('error'), description: t('admin.bus_config.dest.batch.error'), variant: "destructive" });
            }
        } catch (err: any) {
            toast({ title: t('admin.file_parse_error'), description: err.message, variant: "destructive" });
        }
    };
    reader.readAsArrayBuffer(file);

    if (fileInputRef.current) {
        fileInputRef.current.value = "";
    }
  };
  
  const handleApproveSuggestion = async (suggestion: Destination) => {
    const normName = normalizeString(suggestion.name);
    if (destinations.some(d => normalizeString(d.name) === normName)) {
        toast({ title: t('notice'), description: t('admin.bus_config.suggestions.already_exists') });
        try {
            await deleteSuggestedDestination(suggestion.id);
        } catch (error) {
             toast({ title: t('error'), description: t('admin.bus_config.suggestions.delete_error'), variant: 'destructive'});
        }
        return;
    }
      
    try {
        await approveSuggestedDestination(suggestion);
        toast({ title: t('success'), description: t('admin.bus_config.suggestions.approve_success')});
    } catch (error) {
        toast({ title: t('error'), description: t('admin.bus_config.suggestions.approve_error'), variant: 'destructive'});
    }
  };

  const handleRejectSuggestion = async (id: string) => {
    try {
        await deleteSuggestedDestination(id);
        toast({ title: t('success'), description: "신청을 거절했습니다." });
    } catch (error) {
        toast({ title: t('error'), description: "거절 처리 중 오류가 발생했습니다.", variant: 'destructive'});
    }
  };

  const handleClearAllSuggestions = async () => {
    const { dismiss } = toast({ title: t('processing'), description: t('admin.bus_config.suggestions.delete_all.processing') });
    try {
        await clearAllSuggestedDestinations();
        dismiss();
        toast({ title: t('success'), description: t('admin.bus_config.suggestions.delete_all.success') });
    } catch (error) {
        toast({ title: t('error'), description: t('admin.bus_config.suggestions.delete_all.error'), variant: "destructive" });
    }
  };

  const handleBatchUpdateDestinationZone = async (targetZone: string) => {
    if (selectedAllDestIds.length === 0) return;
    setIsBatchUpdatingZone(true);
    try {
      await updateDestinationsZoneBatch(selectedAllDestIds, targetZone);
      toast({
        title: "목적지 그룹 일괄 변경 완료",
        description: `선택한 ${selectedAllDestIds.length}개 목적지가 [${targetZone === '미지정' ? '미지정' : targetZone}] 그룹으로 일괄 변경되었습니다.`,
      });
    } catch (err) {
      toast({
        variant: "destructive",
        title: "일괄 변경 실패",
        description: "목적지 그룹 변경 중 오류가 발생했습니다.",
      });
    } finally {
      setIsBatchUpdatingZone(false);
    }
  };

    const handleSelectRouteStop = (e: React.MouseEvent, stopId: string) => {
        if (e.ctrlKey || e.metaKey) {
            setSelectedRouteStopIds(prev => prev.includes(stopId) ? prev.filter(id => id !== stopId) : [...prev, stopId]);
        } else {
            setSelectedRouteStopIds(prev => (prev.length === 1 && prev[0] === stopId) ? [] : [stopId]);
        }
        setSelectedAllDestIds([]);
    };

    const handleSelectAllDest = (e: React.MouseEvent, destId: string) => {
        if (e.ctrlKey || e.metaKey) {
             setSelectedAllDestIds(prev => prev.includes(destId) ? prev.filter(id => id !== destId) : [...prev, destId]);
        } else {
             setSelectedAllDestIds(prev => (prev.length === 1 && prev[0] === destId) ? [] : [destId]);
        }
        setSelectedRouteStopIds([]);
    };

  const handleMoveStop = useCallback(async (direction: 'up' | 'down') => {
      if (!currentRoute || selectedRouteStopIds.length !== 1) return;

      const targetId = selectedRouteStopIds[0];
      const currentStopIds = currentRoute.stops || [];
      const index = currentStopIds.indexOf(targetId);

      if (index === -1) return;

      const newStopIds = [...currentStopIds];
      if (direction === 'up' && index > 0) {
          [newStopIds[index - 1], newStopIds[index]] = [newStopIds[index], newStopIds[index - 1]];
      } else if (direction === 'down' && index < newStopIds.length - 1) {
          [newStopIds[index], newStopIds[index + 1]] = [newStopIds[index + 1], newStopIds[index]];
      } else {
          return;
      }
      await updateRouteStops(currentRoute.id, newStopIds);
  }, [currentRoute, selectedRouteStopIds]);

    const handleAddStopToRoute = useCallback(async () => {
        if (!currentRoute || selectedAllDestIds.length === 0) return;
        const currentStopIds = currentRoute.stops || [];
        const newDests = selectedAllDestIds.filter(id => !currentStopIds.includes(id));
        if (newDests.length === 0) {
            toast({ title: t('error'), description: t('admin.bus_config.route.add_stop_error'), variant: 'destructive' });
            return;
        }
        const newStopIds = [...currentStopIds, ...newDests];
        await updateRouteStops(currentRoute.id, newStopIds);
        setSelectedAllDestIds([]);
    }, [currentRoute, selectedAllDestIds, toast, t]);

    const handleRemoveStopFromRoute = useCallback(async () => {
        if (!currentRoute || selectedRouteStopIds.length === 0) return;
        const currentStopIds = currentRoute.stops || [];
        const newStopIds = currentStopIds.filter(id => !selectedRouteStopIds.includes(id));
        await updateRouteStops(currentRoute.id, newStopIds);
        setSelectedRouteStopIds([]);
    }, [currentRoute, selectedRouteStopIds]);

    const handleClearRoute = useCallback(async () => {
        if (!currentRoute) return;
        try {
            // Also clear seating when clearing stops to ensure data consistency
            const emptySeating = currentRoute.seating.map(s => ({ ...s, studentId: null }));
            await updateRoute(currentRoute.id, { stops: [], seating: emptySeating });
            toast({ title: t('success'), description: t('admin.bus_config.route.clear.success') });
        } catch (error) {
            toast({ title: t('error'), description: t('error'), variant: 'destructive' });
        }
    }, [currentRoute, t, toast]);

 const handleCopyRoute = useCallback(async () => {
      if (!currentRoute) {
          toast({ title: t('error'), description: t('admin.bus_config.route.copy.no_source_error'), variant: "destructive" });
          return;
      }

      const selectedDays = allDays.filter(day => daysToCopyRouteTo[day]);
      
      let targetRoutes: Route[] = [];

      if (currentRoute.type === 'Morning' || currentRoute.type === 'Afternoon') {
        const selectedRouteTypes = (['Morning', 'Afternoon'] as const).filter(type => routeTypesToCopyRouteTo[type]);
        if (selectedDays.length === 0 || selectedRouteTypes.length === 0) {
            toast({ title: t('notice'), description: t('admin.bus_config.route.copy.no_selection_commute') });
            return;
        }
        targetRoutes = routes.filter(r =>
            r.busId === currentRoute.busId &&
            selectedDays.includes(r.dayOfWeek) &&
            selectedRouteTypes.includes(r.type as 'Morning' | 'Afternoon') &&
            r.id !== currentRoute.id
        );
      } else { // AfterSchool
        if (selectedDays.length === 0) {
            toast({ title: t('notice'), description: t('admin.bus_config.route.copy.no_selection_after_school') });
            return;
        }
        targetRoutes = routes.filter(r =>
            r.busId === currentRoute.busId &&
            selectedDays.includes(r.dayOfWeek) &&
            r.type === 'AfterSchool' &&
            r.id !== currentRoute.id
        );
      }

      if (targetRoutes.length === 0) {
          toast({ title: t('notice'), description: t('admin.bus_config.route.copy.no_target_routes') });
          return;
      }
      
      try {
          await Promise.all(targetRoutes.map(r => updateRouteStops(r.id, currentRoute.stops)));
          toast({ title: t('success'), description: t('admin.bus_config.route.copy.success') });
          setCopyRouteDialogOpen(false);
      } catch (error) {
          console.error("Error copying route plan:", error);
          toast({ title: t('error'), description: t('admin.bus_config.route.copy.error'), variant: "destructive" });
      }
  }, [currentRoute, routes, toast, t, daysToCopyRouteTo, routeTypesToCopyRouteTo, allDays]);

  const handleToggleAllCopyToDays = (checked: boolean) => {
      const newDays = allDays.reduce((acc, day) => ({ ...acc, [day]: checked }), {});
      setDaysToCopyRouteTo(newDays);
  };


  return (
    <div className="space-y-6">
        {suggestedDestinations.length > 0 && (
            <Card className="border-amber-300 bg-amber-50 dark:bg-amber-900/20">
                <CardHeader>
                <CardTitle className="text-amber-800 dark:text-amber-300 flex items-center gap-2">
                    <PlusCircle className="h-5 w-5" /> {t('admin.bus_config.suggestions.title')}
                </CardTitle>
                <CardDescription className="text-amber-700/80 dark:text-amber-400/80">
                    {t('admin.bus_config.suggestions.description')}
                </CardDescription>
                </CardHeader>
                <CardContent>
                <div className="flex flex-wrap gap-3">
                    {suggestedDestinations.map(suggestion => (
                    <div key={suggestion.id} className="flex items-center bg-white dark:bg-amber-900/40 border border-amber-300 dark:border-amber-700 rounded-full pl-3 pr-1 py-1 gap-2 shadow-sm">
                        <span className="text-sm font-medium text-amber-900 dark:text-amber-100">{suggestion.name}</span>
                        <div className="flex gap-1">
                            <Button 
                                size="icon" 
                                variant="ghost" 
                                className="h-6 w-6 rounded-full hover:bg-green-100 hover:text-green-700" 
                                onClick={() => handleApproveSuggestion(suggestion)}
                                title="승인"
                            >
                                <Check className="h-3 w-3" />
                            </Button>
                            <Button 
                                size="icon" 
                                variant="ghost" 
                                className="h-6 w-6 rounded-full hover:bg-destructive/10 hover:text-destructive" 
                                onClick={() => handleRejectSuggestion(suggestion.id)}
                                title="거절"
                            >
                                <X className="h-3 w-3" />
                            </Button>
                        </div>
                    </div>
                    ))}
                </div>
                </CardContent>
                    <CardFooter>
                    <AlertDialog>
                        <AlertDialogTrigger asChild>
                            <Button variant="ghost" size="sm" className="text-amber-700 dark:text-amber-400 hover:bg-amber-100">
                                <Trash2 className="mr-2 h-4 w-4" /> 모든 요청 삭제
                            </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                            <AlertDialogHeader>
                            <AlertDialogTitle>{t('admin.bus_config.suggestions.delete_all.confirm_title')}</AlertDialogTitle>
                            <AlertDialogDescription>
                                {t('admin.bus_config.suggestions.delete_all.confirm_description')}
                            </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                            <AlertDialogCancel>{t('cancel')}</AlertDialogCancel>
                            <AlertDialogAction onClick={handleClearAllSuggestions}>{t('delete')}</AlertDialogAction>
                            </AlertDialogFooter>
                        </AlertDialogContent>
                    </AlertDialog>
                </CardFooter>
            </Card>
        )}

        <div className="grid grid-cols-1 md:grid-cols-[1fr_auto_1fr] gap-4 items-start">
            <Card>
                <CardHeader>
                <CardTitle>{t('admin.bus_config.dest.title')}</CardTitle>
                <CardDescription>
                    {t('admin.bus_config.dest.description')}
                </CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="flex justify-end gap-2 mb-4 flex-wrap">
                        <Button variant="outline" onClick={handleDownloadDestinationTemplate}><Download className="mr-2 h-4 w-4" /> {t('admin.bus_config.dest.template')}</Button>
                        <Button variant="outline" onClick={handleDownloadDestinationList}><Download className="mr-2 h-4 w-4" /> {t('admin.bus_config.dest.download.button')}</Button>
                        <Button variant="outline" onClick={() => fileInputRef.current?.click()}><Upload className="mr-2 h-4 w-4" /> {t('batch_upload')}</Button>
                        <input type="file" ref={fileInputRef} onChange={handleDestinationFileUpload} accept=".xlsx" className="hidden" />
                    </div>
                     <div className="flex justify-end gap-2 mb-4">
                        <Dialog>
                            <DialogTrigger asChild><Button className="w-full"><PlusCircle className="mr-2" /> {t('admin.bus_config.dest.add.button')}</Button></DialogTrigger>
                            <DialogContent>
                                <DialogHeader><DialogTitle>{t('admin.bus_config.dest.add.title')}</DialogTitle></DialogHeader>
                                <Input placeholder={t('admin.bus_config.dest.add.placeholder')} value={newDestinationName} onChange={e => setNewDestinationName(e.target.value)} />
                                <Button className="mt-2" onClick={handleAddDestination}>{t('add')}</Button>
                            </DialogContent>
                        </Dialog>
                        <AlertDialog>
                            <AlertDialogTrigger asChild>
                                <Button variant="destructive" className="w-full"><Trash2 className="mr-2 h-4 w-4" /> {t('delete_all')}</Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                                <AlertDialogHeader>
                                    <AlertDialogTitle>{t('admin.bus_config.dest.delete_all.confirm_title')}</AlertDialogTitle>
                                    <AlertDialogDescription>
                                        {t('admin.bus_config.dest.delete_all.confirm_description')}
                                    </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                    <AlertDialogCancel>{t('cancel')}</AlertDialogCancel>
                                    <AlertDialogAction onClick={handleClearAllDestinations}>{t('delete')}</AlertDialogAction>
                                </AlertDialogFooter>
                            </AlertDialogContent>
                        </AlertDialog>
                    </div>
                    <div className="relative mb-4">
                        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input 
                            type="search"
                            placeholder={t('admin.bus_config.dest.search_placeholder')}
                            className="pl-8 w-full"
                            value={destinationSearchQuery}
                            onChange={(e) => setDestinationSearchQuery(e.target.value)}
                        />
                    </div>

                    {selectedAllDestIds.length === 1 && (
                        <div className="mb-4 p-3 bg-primary/5 border border-primary/20 rounded-md animate-in fade-in slide-in-from-top-1">
                            <div className="flex items-start gap-2">
                                <BusIcon className="h-4 w-4 text-primary mt-0.5" />
                                <div className="space-y-1">
                                    <div className="text-xs font-semibold text-primary flex items-center gap-1">
                                        운행 중인 버스 확인
                                        <Badge variant="outline" className="text-[10px] py-0 h-4 border-primary/30 text-primary">
                                            {t(`day_short.${selectedDay.toLowerCase()}`)} {selectedRouteType === 'AfterSchool' ? t('route_type.after_school') : t(`route_type.${selectedRouteType.toLowerCase()}`)}
                                        </Badge>
                                    </div>
                                    <div className="flex flex-wrap gap-1.5 mt-1">
                                        {busesUsingDestination.length > 0 ? (
                                            busesUsingDestination.map((busName, idx) => (
                                                <Badge key={idx} variant="secondary" className="text-[10px] font-medium bg-white border">
                                                    {busName}
                                                </Badge>
                                            ))
                                        ) : (
                                            <p className="text-[10px] text-muted-foreground italic">이 시간대에 해당 목적지를 운행하는 버스가 없습니다.</p>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* 목적지 다중 선택 및 그룹 일괄 지정 툴바 */}
                    <div className="mb-3 bg-gradient-to-r from-indigo-50 to-blue-50/80 p-3 rounded-xl border border-indigo-200/80 shadow-xs space-y-2">
                        {/* 헤더: 전체 선택 & 선택 건수 */}
                        <div className="flex items-center justify-between gap-2">
                            <label className="flex items-center gap-2 text-xs font-bold text-slate-800 cursor-pointer select-none">
                                <Checkbox
                                    checked={filteredDestinations.length > 0 && filteredDestinations.every(d => selectedAllDestIds.includes(d.id))}
                                    onCheckedChange={(checked) => {
                                        if (checked) {
                                            const allIds = filteredDestinations.map(d => d.id);
                                            setSelectedAllDestIds(allIds);
                                        } else {
                                            setSelectedAllDestIds([]);
                                        }
                                    }}
                                />
                                <span>전체 선택</span>
                                <span className="text-[11px] font-semibold text-indigo-700 bg-indigo-100/90 px-1.5 py-0.5 rounded-md">
                                    {selectedAllDestIds.length} / {filteredDestinations.length}개
                                </span>
                            </label>

                            {selectedAllDestIds.length > 0 && (
                                <button
                                    type="button"
                                    onClick={() => setSelectedAllDestIds([])}
                                    className="text-[11px] text-slate-500 hover:text-slate-800 underline font-medium transition"
                                >
                                    선택 해제
                                </button>
                            )}
                        </div>

                        {/* 일괄 그룹 설정 컨트롤 (가로 넘침 없이 2단 레이아웃) */}
                        <div className="pt-2 border-t border-indigo-200/60 space-y-1.5">
                            <div className="text-[11px] font-bold text-indigo-900 flex items-center gap-1">
                                <span>🏷️ 선택 목적지 그룹 이동:</span>
                            </div>
                            <div className="flex items-center gap-1.5">
                                <select
                                    value={selectedBatchZone}
                                    onChange={(e) => setSelectedBatchZone(e.target.value)}
                                    className="text-xs border border-indigo-200 rounded-lg px-2.5 py-1.5 font-bold text-slate-800 bg-white shadow-xs focus:outline-none focus:ring-2 focus:ring-indigo-400 flex-1 min-w-0"
                                >
                                    <option value="미지정">미지정 (요금 없음)</option>
                                    {Object.keys(busFareSettings).map((g) => (
                                        <option key={g} value={g}>{g}</option>
                                    ))}
                                </select>
                                <Button
                                    size="sm"
                                    onClick={() => handleBatchUpdateDestinationZone(selectedBatchZone)}
                                    disabled={selectedAllDestIds.length === 0 || isBatchUpdatingZone}
                                    className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs px-3 py-1.5 h-8 shrink-0 shadow-xs cursor-pointer disabled:opacity-50 transition rounded-lg"
                                >
                                    {isBatchUpdatingZone ? '적용 중...' : `${selectedAllDestIds.length}개 이동`}
                                </Button>
                            </div>
                        </div>
                    </div>

                    <div className="flex flex-col gap-2 p-2 border rounded-md min-h-[300px] max-h-[40vh] overflow-y-auto bg-muted/50">
                        {filteredDestinations.map((dest) => {
                            const isChecked = selectedAllDestIds.includes(dest.id);
                            return (
                                <div
                                    key={dest.id}
                                    className={cn(
                                        "p-2 flex items-center gap-2.5 rounded-md transition border border-transparent",
                                        isChecked ? "bg-indigo-100/80 border-indigo-300 ring-1 ring-indigo-400" : "hover:bg-primary/10 bg-white"
                                    )}
                                >
                                    <Checkbox
                                        checked={isChecked}
                                        onCheckedChange={(checked) => {
                                            if (checked) {
                                                setSelectedAllDestIds(prev => [...prev, dest.id]);
                                            } else {
                                                setSelectedAllDestIds(prev => prev.filter(id => id !== dest.id));
                                            }
                                        }}
                                    />
                                    <span 
                                        className="flex-1 text-sm font-bold text-slate-800 cursor-pointer select-none"
                                        onClick={(e) => handleSelectAllDest(e, dest.id)}
                                    >
                                        {dest.name}
                                    </span>
                                    <select
                                        value={dest.zone && Object.keys(busFareSettings).includes(dest.zone) ? dest.zone : '미지정'}
                                        onChange={async (e) => {
                                            const newZone = e.target.value;
                                            try {
                                                await updateDestinationZone(dest.id, newZone);
                                                toast({
                                                    title: "목적지 그룹 변경 완료",
                                                    description: `"${dest.name}" 목적지가 ${newZone === '미지정' ? '미지정' : newZone}으로 설정되었습니다.`,
                                                });
                                            } catch (err) {
                                                toast({
                                                    variant: "destructive",
                                                    title: "변경 실패",
                                                    description: "목적지 그룹을 변경하는 중 오류가 발생했습니다."
                                                });
                                            }
                                        }}
                                        className="text-xs border rounded-md p-1.5 font-bold text-slate-700 bg-white mr-1 cursor-pointer focus:outline-none focus:ring-1 focus:ring-indigo-300"
                                        onClick={(e) => e.stopPropagation()}
                                    >
                                        <option value="미지정">미지정 (요금 없음)</option>
                                        {Object.keys(busFareSettings).map((g) => (
                                            <option key={g} value={g}>{g}</option>
                                        ))}
                                    </select>
                                    <AlertDialog onOpenChange={(open) => open && setSelectedAllDestIds([])}>
                                        <AlertDialogTrigger asChild>
                                            <Button variant="ghost" size="icon" className="h-6 w-6">
                                                <X className="w-3 h-3 text-destructive" />
                                            </Button>
                                        </AlertDialogTrigger>
                                        <AlertDialogContent>
                                            <AlertDialogHeader>
                                                <AlertDialogTitle>{t('admin.bus_config.dest.delete.confirm_title')}</AlertDialogTitle>
                                                <AlertDialogDescription>{t('confirm_irreversible')}</AlertDialogDescription>
                                            </AlertDialogHeader>
                                            <AlertDialogFooter>
                                                <AlertDialogCancel>{t('cancel')}</AlertDialogCancel>
                                                <AlertDialogAction onClick={() => handleDeleteDestination(dest.id)}>{t('delete')}</AlertDialogAction>
                                            </AlertDialogFooter>
                                        </AlertDialogContent>
                                    </AlertDialog>
                                </div>
                            );
                        })}
                    </div>
                </CardContent>
            </Card>

            <div className="flex flex-col items-center justify-center gap-4 self-stretch">
                <Button 
                    size="icon"
                    className="h-12 w-12"
                    onClick={handleAddStopToRoute}
                    disabled={!currentRoute || selectedAllDestIds.length === 0}
                    aria-label="Add stop to route"
                >
                    <ArrowRight className="h-6 w-6" />
                </Button>
                 <Button 
                    variant="destructive"
                    size="icon"
                    className="h-12 w-12"
                    onClick={handleRemoveStopFromRoute}
                    disabled={!currentRoute || selectedRouteStopIds.length === 0}
                    aria-label="Remove stop from route"
                >
                    <ArrowLeft className="h-6 w-6" />
                </Button>
            </div>

            <Card>
                 <CardHeader>
                    <CardTitle className="whitespace-nowrap">{t('admin.bus_config.route.title')}</CardTitle>
                    <CardDescription>
                        {t('admin.bus_config.route.description')}
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="flex justify-end gap-2 flex-wrap mb-4">
                        <Dialog open={isCopyRouteDialogOpen} onOpenChange={setCopyRouteDialogOpen}>
                            <DialogTrigger asChild>
                                <Button variant="outline" disabled={!currentRoute}>
                                    <Copy className="mr-2" /> {t('admin.bus_config.route.copy.button')}
                                </Button>
                            </DialogTrigger>
                            <DialogContent>
                                <DialogHeader>
                                    <DialogTitle>{t('admin.bus_config.route.copy.title')}</DialogTitle>
                                    <CardDescription>
                                        {selectedRouteType === 'AfterSchool'
                                            ? t('admin.bus_config.route.copy.description_after_school')
                                            : t('admin.bus_config.route.copy.description_commute')
                                        }
                                    </CardDescription>
                                </DialogHeader>
                                <div className="space-y-4 py-4">
                                    <div>
                                        <Label>{t('admin.bus_config.route.copy.select_days')}</Label>
                                        <div className="flex items-center space-x-2 mt-2">
                                            <Checkbox
                                                id="copy-route-all-days"
                                                checked={allDays.every(day => daysToCopyRouteTo[day])}
                                                onCheckedChange={(checked) => handleToggleAllCopyToDays(checked as boolean)}
                                            />
                                            <Label htmlFor="copy-route-all-days">{t('select_all')}</Label>
                                        </div>
                                        <div className="grid grid-cols-3 gap-2 mt-2">
                                            {allDays.map(day => (
                                                <div key={`route-day-${day}`} className="flex items-center space-x-2">
                                                    <Checkbox
                                                        id={`copy-route-day-${day}`}
                                                        checked={!!daysToCopyRouteTo[day]}
                                                        onCheckedChange={(checked) => setDaysToCopyRouteTo(prev => ({ ...prev, [day]: checked }))}
                                                    />
                                                    <Label htmlFor={`copy-route-day-${day}`}>{t(`day.${day.toLowerCase()}`)}</Label>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                    {(selectedRouteType === 'Morning' || selectedRouteType === 'Afternoon') && (
                                    <div>
                                        <Label>{t('admin.bus_config.route.copy.select_route_types')}</Label>
                                        <div className="flex items-center space-x-4 mt-2">
                                            <div className="flex items-center space-x-2">
                                                <Checkbox
                                                    id="copy-route-type-morning"
                                                    checked={!!routeTypesToCopyRouteTo.Morning}
                                                    onCheckedChange={(checked) => setRouteTypesToCopyRouteTo(prev => ({ ...prev, Morning: checked as boolean }))}
                                                />
                                                <Label htmlFor="copy-route-type-morning">{t('route_type.morning')}</Label>
                                            </div>
                                            <div className="flex items-center space-x-2">
                                                <Checkbox
                                                    id="copy-route-type-afternoon"
                                                    checked={!!routeTypesToCopyRouteTo.Afternoon}
                                                    onCheckedChange={(checked) => setRouteTypesToCopyRouteTo(prev => ({ ...prev, Afternoon: checked as boolean }))}
                                                />
                                                <Label htmlFor="copy-route-type-afternoon">{t('route_type.afternoon')}</Label>
                                            </div>
                                        </div>
                                    </div>
                                    )}
                                </div>
                                <DialogFooter>
                                    <Button onClick={handleCopyRoute} className="w-full">{t('copy')}</Button>
                                </DialogFooter>
                            </DialogContent>
                        </Dialog>

                        <AlertDialog>
                            <AlertDialogTrigger asChild>
                                <Button variant="outline" disabled={!currentRoute || (currentRoute.stops || []).length === 0} className="text-destructive border-destructive hover:bg-destructive/10">
                                    <Trash2 className="mr-2 h-4 w-4" /> {t('admin.bus_config.route.clear.button')}
                                </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                                <AlertDialogHeader>
                                    <AlertDialogTitle>{t('admin.bus_config.route.clear.confirm_title')}</AlertDialogTitle>
                                    <AlertDialogDescription>
                                        {t('admin.bus_config.route.clear.confirm_description')}
                                    </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                    <AlertDialogCancel>{t('cancel')}</AlertDialogCancel>
                                    <AlertDialogAction onClick={handleClearRoute}>{t('confirm')}</AlertDialogAction>
                                </AlertDialogFooter>
                            </AlertDialogContent>
                        </AlertDialog>
                    </div>
                    {selectedBus && currentRoute ? (
                        <Card>
                            <CardHeader>
                                <div className="flex justify-between items-start">
                                    <div>
                                        <CardTitle>{selectedBus.name} - {t(`day.${selectedDay.toLowerCase()}`)} {
                                            selectedRouteType === 'AfterSchool' ? t('route_type.after_school') : t(`route_type.${selectedRouteType.toLowerCase()}`)
                                        }</CardTitle>
                                        <CardDescription>{t('admin.bus_config.route.stops_description')}</CardDescription>
                                    </div>
                                    {(() => {
                                        const selectedStopIndex = currentRoute && selectedRouteStopIds.length === 1 ? (currentRoute.stops || []).indexOf(selectedRouteStopIds[0]) : -1;
                                        return (
                                            <div className="flex gap-1">
                                                <Button variant="outline" size="icon" onClick={() => handleMoveStop('up')} disabled={selectedStopIndex <= 0}><ArrowUp className="h-4 w-4"/></Button>
                                                <Button variant="outline" size="icon" onClick={() => handleMoveStop('down')} disabled={selectedStopIndex === -1 || selectedStopIndex >= (currentRoute?.stops?.length || 0) - 1}><ArrowDown className="h-4 w-4"/></Button>
                                            </div>
                                        );
                                    })()}
                                </div>
                            </CardHeader>
                        <CardContent>
                            <div className="flex flex-col gap-2 p-2 border rounded-md min-h-[300px] max-h-[40vh] overflow-y-auto bg-muted/50">
                                {getStopsForCurrentRoute().map((dest) => (
                                     <div
                                        key={dest.id}
                                        onClick={(e) => handleSelectRouteStop(e, dest.id)}
                                        className={cn(
                                            "p-2 flex items-center gap-2 rounded-md cursor-pointer hover:bg-primary/10",
                                            "bg-card/80",
                                            selectedRouteStopIds.includes(dest.id) && "bg-primary/20 ring-2 ring-primary"
                                        )}
                                    >
                                        <span className="flex-1 text-sm font-medium">{dest.name}</span>
                                    </div>
                                ))}
                            </div>
                        </CardContent>
                        </Card>
                    ) : (
                        <div className="text-center text-muted-foreground py-10">{t('admin.bus_config.route.select_bus_prompt')}</div>
                    )}
                </CardContent>
            </Card>
            {/* 목적지 그룹(Zone)별 버스 요금 설정 카드 */}
            <Card className="col-span-full border-t-4 border-indigo-500 shadow-md mt-6">
                <CardHeader>
                    <CardTitle className="text-slate-900 font-bold flex items-center gap-2">
                        목적지 그룹 및 요금제 커스텀 설정
                    </CardTitle>
                    <CardDescription>
                        지역 및 학구에 맞추어 스쿨버스 목적지 그룹(Zone)을 추가하고, 그룹별 기본 징수 요금을 설정할 수 있습니다.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    {/* 화폐 통화 설정 드롭다운 */}
                    <div className="flex gap-2 items-center bg-indigo-50/30 p-4 rounded-xl border border-indigo-100/30 mb-4 max-w-xl">
                        <div className="flex-1 space-y-1">
                            <Label className="text-xs font-bold text-indigo-700">기본 화폐 단위 설정</Label>
                            <select
                                value={busFareCurrency}
                                onChange={(e) => setBusFareCurrency(e.target.value as any)}
                                className="w-full border rounded p-1.5 font-bold text-xs text-slate-800 bg-white focus:outline-none focus-visible:ring-indigo-500 cursor-pointer"
                            >
                                <option value="VND">VND (베트남 동)</option>
                                <option value="KRW">KRW (대한민국 원)</option>
                                <option value="USD">USD (미국 달러)</option>
                            </select>
                        </div>
                    </div>

                    {/* 그룹 추가 폼 */}
                    <div className="flex gap-2 items-end bg-indigo-50/50 p-4 rounded-xl border border-indigo-100/50 mb-4 max-w-xl">
                        <div className="flex-1 space-y-1">
                            <Label className="text-xs font-bold text-indigo-700">새 목적지 그룹(Zone) 추가</Label>
                            <Input
                                placeholder="예: 푸미흥 (근거리), 안푸 (중거리)"
                                value={newGroupName}
                                onChange={(e) => setNewGroupName(e.target.value)}
                                className="bg-white focus-visible:ring-indigo-500 text-xs font-bold"
                            />
                        </div>
                        <Button
                            onClick={() => {
                                const name = newGroupName.trim();
                                if (!name) return;
                                if (busFareSettings[name] !== undefined) {
                                    toast({
                                        variant: "destructive",
                                        title: "추가 불가",
                                        description: "이미 존재하는 그룹 이름입니다."
                                    });
                                    return;
                                }
                                setBusFareSettings(prev => ({
                                    ...prev,
                                    [name]: 0
                                }));
                                setNewGroupName('');
                                toast({
                                    title: "그룹 추가 완료",
                                    description: `"${name}" 그룹이 목록에 추가되었습니다. 적용 저장 버튼을 눌러 확정해 주세요.`,
                                });
                            }}
                            className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold"
                        >
                            그룹 추가
                        </Button>
                    </div>

                    {/* 요금 입력 리스트 */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        {Object.keys(busFareSettings).map((zoneName) => (
                            <div key={zoneName} className="space-y-1.5 p-4 rounded-xl bg-slate-50 border border-slate-100 flex flex-col justify-between">
                                <div className="flex justify-between items-center gap-1 border-b pb-1.5 mb-1">
                                    <Label className="text-xs font-bold text-slate-700 truncate" title={zoneName}>{zoneName}</Label>
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-6 w-6 text-destructive hover:bg-destructive/10 rounded-full"
                                        onClick={() => {
                                            if (confirm(`"${zoneName}" 목적지 그룹을 삭제하시겠습니까? 해당 그룹에 지정된 목적지들은 미지정으로 변경됩니다.`)) {
                                                setBusFareSettings(prev => {
                                                    const next = { ...prev };
                                                    delete next[zoneName];
                                                    return next;
                                                });
                                            }
                                        }}
                                    >
                                        <Trash2 className="w-3.5 h-3.5" />
                                    </Button>
                                </div>
                                <div className="relative mt-1">
                                    <Input
                                        type="number"
                                        value={busFareSettings[zoneName] || 0}
                                        onChange={(e) => {
                                            const val = parseInt(e.target.value, 10) || 0;
                                            setBusFareSettings(prev => ({
                                                ...prev,
                                                [zoneName]: val
                                            }));
                                        }}
                                        className="pr-8 text-right font-bold text-slate-800 focus-visible:ring-indigo-500 text-xs"
                                    />
                                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">
                                        {busFareCurrency === 'KRW' ? '원' : busFareCurrency === 'USD' ? '$' : 'VND'}
                                    </span>
                                </div>
                            </div>
                        ))}
                    </div>
                </CardContent>
                <CardFooter className="flex justify-end border-t bg-slate-50/50 px-6 py-3">
                    <Button 
                        onClick={handleSaveFareSettings}
                        disabled={isFareSaving}
                        className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold"
                    >
                        {isFareSaving ? "저장 중..." : "요금 설정 적용 저장"}
                    </Button>
                </CardFooter>
            </Card>
        </div>
    </div>
  );
};
