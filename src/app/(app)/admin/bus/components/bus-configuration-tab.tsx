'use client';

import React, { useState, useRef, useMemo, useCallback, useEffect } from 'react';
import { 
    addDestination, deleteDestination, approveSuggestedDestination, addDestinationsInBatch,
    updateRouteStops, clearAllSuggestedDestinations, clearDestinations,
    deleteSuggestedDestination, updateRoute, updateDestinationZone, updateDestinationsZoneBatch,
    updateDestinationSaturdayZone, updateDestinationsSaturdayZoneBatch,
    syncDestinationsFromExcelBatch
} from '@/lib/kisbus';
import { getGlobalSettings, updateGlobalSettings } from '@/lib/kisbus/settings';
import type { Bus, Route, Destination, DayOfWeek, RouteType, NewDestination, Student, BusQuarterSetting } from '@/lib/kisbus/types';
import type { AcademicCalendarConfig } from '@/lib/types';
import { calculateSchoolDays } from '@/lib/services/academicCalendarService';
import { getDefaultQuarters, calculateAllStudentsBusFare, downloadBusFareExcel, StudentBusFareDetail } from '@/lib/kisbus/fareCalculator';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { 
    Upload, Trash2, PlusCircle, Download, X, Search, Copy, ArrowLeft, ArrowRight, ArrowUp, ArrowDown, 
    Bus as BusIcon, Check, Calendar, DollarSign, Users, FileSpreadsheet, Eye, Info, Sparkles, CheckCircle2, ChevronRight, Edit3,
    GraduationCap
} from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from '@/components/ui/dialog';
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
  students?: Student[];
  academicCalendar?: AcademicCalendarConfig;
}

export const BusConfigurationTab = ({
  buses,
  routes,
  destinations,
  suggestedDestinations,
  selectedDay,
  selectedRouteType,
  selectedBusId,
  students = [],
  academicCalendar,
}: BusConfigurationTabProps) => {
  const [newDestinationName, setNewDestinationName] = useState('');
  const [destinationSearchQuery, setDestinationSearchQuery] = useState('');
  const [newGroupName, setNewGroupName] = useState('');
  const { toast } = useToast();
  const { t } = useTranslation();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [selectedRouteStopIds, setSelectedRouteStopIds] = useState<string[]>([]);
  const [selectedAllDestIds, setSelectedAllDestIds] = useState<string[]>([]);
  // 그룹 이동 탭: 평일/토요일
  const [batchZoneTab, setBatchZoneTab] = useState<'weekday' | 'saturday'>('weekday');
  const [selectedBatchZone, setSelectedBatchZone] = useState<string>('미지정');
  const [selectedSaturdayBatchZone, setSelectedSaturdayBatchZone] = useState<string>('미지정');
  const [isBatchUpdatingZone, setIsBatchUpdatingZone] = useState<boolean>(false);
  
  // 요금제 설정 상태
  const [busFareTab, setBusFareTab] = useState<'weekday' | 'saturday'>('weekday');
  const [busFareSettings, setBusFareSettings] = useState<Record<string, number>>({
      'Zone A (근거리)': 50000,
      'Zone B (중거리)': 80000,
      'Zone C (원거리)': 100000
  });
  const [saturdayBusFareSettings, setSaturdayBusFareSettings] = useState<Record<string, number>>({
      'Zone A (근거리)': 30000,
      'Zone B (중거리)': 50000,
      'Zone C (원거리)': 70000
  });
  const [isFareSaving, setIsFareSaving] = useState(false);
  const [busFareCurrency, setBusFareCurrency] = useState<'VND' | 'KRW' | 'USD'>('VND');

  // 📅 분기(Quarter) 설정 및 추가 요금 옵션
  const [quarters, setQuarters] = useState<BusQuarterSetting[]>(getDefaultQuarters);
  const [activeQuarterId, setActiveQuarterId] = useState<string>('q1');
  const [under3Surcharge, setUnder3Surcharge] = useState<number>(20000); // 3명 이하 목적지 일일 추가요금 (기본 20,000 VND)
  const [siblingDiscountRate, setSiblingDiscountRate] = useState<number>(10); // 형제 복수탑승 둘째 이하 할인율 (기본 10%)
  
  // 📋 분기별 학생 요금 청구서 모달 상태
  const [isBillingModalOpen, setIsBillingModalOpen] = useState(false);
  const [isExportingExcel, setIsExportingExcel] = useState(false);
  const [billingSearchQuery, setBillingSearchQuery] = useState('');
  const [billingGradeFilter, setBillingGradeFilter] = useState('all');
  const [billingRidingFilter, setBillingRidingFilter] = useState<'all' | 'riding'>('riding');

  // 신규 분기 추가 모달 상태
  const [isAddQuarterDialogOpen, setIsAddQuarterDialogOpen] = useState(false);
  const [newQuarterName, setNewQuarterName] = useState('');
  const [newQuarterStartDate, setNewQuarterStartDate] = useState('');
  const [newQuarterEndDate, setNewQuarterEndDate] = useState('');

  useEffect(() => {
      getGlobalSettings().then(cfg => {
          if (cfg?.busFareSettings) {
              setBusFareSettings(cfg.busFareSettings);
          }
          if (cfg?.saturdayBusFareSettings) {
              setSaturdayBusFareSettings(cfg.saturdayBusFareSettings);
          }
          if (cfg?.busFareCurrency) {
              setBusFareCurrency(cfg.busFareCurrency as any);
          }
          if (cfg?.quarters && Array.isArray(cfg.quarters) && cfg.quarters.length > 0) {
              setQuarters(cfg.quarters);
          }
          if (cfg?.activeQuarterId) {
              setActiveQuarterId(cfg.activeQuarterId);
          }
          if (cfg?.under3Surcharge !== undefined) {
              setUnder3Surcharge(cfg.under3Surcharge);
          }
          if (cfg?.siblingDiscountRate !== undefined) {
              setSiblingDiscountRate(cfg.siblingDiscountRate);
          }
      });
  }, []);

  // 학년별 제외일수 입력 폼 상태
  const [selectedExceptionGrade, setSelectedExceptionGrade] = useState<string>('6');
  const [exceptionDaysInput, setExceptionDaysInput] = useState<number>(3);
  const [exceptionReasonInput, setExceptionReasonInput] = useState<string>('수학여행');

  const handleSaveFareSettings = async () => {
      setIsFareSaving(true);
      try {
          await updateGlobalSettings({ 
              busFareSettings, 
              saturdayBusFareSettings, 
              busFareCurrency,
              quarters,
              activeQuarterId,
              under3Surcharge,
              siblingDiscountRate
          });
          toast({
              title: "요금제 및 분기 설정 저장 완료",
              description: `[평일/토요일] 요금제, 분기 기간, 학년별 제외일수, 3명 이하 추가금 및 형제할인율이 성공적으로 저장되었습니다.`
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

  // 현재 선택된 활성 분기 객체
  const currentQuarter = useMemo(() => {
      return quarters.find(q => q.id === activeQuarterId) || quarters[0] || getDefaultQuarters()[0];
  }, [quarters, activeQuarterId]);

  // 특정 학년 제외일수 추가
  const handleAddGradeException = () => {
      if (!selectedExceptionGrade || exceptionDaysInput <= 0) {
          toast({ variant: "destructive", title: "입력 오류", description: "학년과 1일 이상의 제외 일수를 입력해주세요." });
          return;
      }

      setQuarters(prev => prev.map(q => {
          if (q.id !== currentQuarter.id) return q;
          const currentExceptions = { ...(q.gradeExceptions || {}) };
          const currentReasons = { ...(q.gradeExceptionReasons || {}) };
          currentExceptions[selectedExceptionGrade] = exceptionDaysInput;
          if (exceptionReasonInput.trim()) {
              currentReasons[selectedExceptionGrade] = exceptionReasonInput.trim();
          } else {
              delete currentReasons[selectedExceptionGrade];
          }
          return {
              ...q,
              gradeExceptions: currentExceptions,
              gradeExceptionReasons: currentReasons
          };
      }));

      toast({
          title: "학년별 제외일수 반영",
          description: `${selectedExceptionGrade}학년 등교일수 -${exceptionDaysInput}일 (${exceptionReasonInput || '특정 활동'}) 제외가 적용되었습니다.`
      });
  };

  // 특정 학년 제외일수 삭제
  const handleRemoveGradeException = (grade: string) => {
      setQuarters(prev => prev.map(q => {
          if (q.id !== currentQuarter.id) return q;
          const currentExceptions = { ...(q.gradeExceptions || {}) };
          const currentReasons = { ...(q.gradeExceptionReasons || {}) };
          delete currentExceptions[grade];
          delete currentReasons[grade];
          return {
              ...q,
              gradeExceptions: currentExceptions,
              gradeExceptionReasons: currentReasons
          };
      }));
      toast({
          title: "제외일수 삭제",
          description: `${grade}학년 제외일수 설정이 해제되었습니다.`
      });
  };


  // 현재 활성 분기의 학사일정 연동 평일 등교일수
  const currentQuarterDaysInfo = useMemo(() => {
      return calculateSchoolDays(currentQuarter.startDate, currentQuarter.endDate, academicCalendar);
  }, [currentQuarter.startDate, currentQuarter.endDate, academicCalendar]);

  // 목적지별 탑승 학생 수 카운트 Map (3명 이하 목적지 배지 표시용)
  const destinationRiderCounts = useMemo(() => {
      const counts = new Map<string, number>();
      students.forEach(s => {
          const destId = s.morningDestinationId || s.afternoonDestinationId;
          if (destId) {
              counts.set(destId, (counts.get(destId) || 0) + 1);
          }
      });
      return counts;
  }, [students]);

  // 전체 학생 분기별 요금 계산 결과
  const fareCalculationResult = useMemo(() => {
      return calculateAllStudentsBusFare({
          students,
          destinations,
          fareConfig: {
              busFareSettings,
              saturdayBusFareSettings,
              busFareCurrency,
              quarters,
              activeQuarterId,
              under3Surcharge,
              siblingDiscountRate
          },
          selectedQuarter: currentQuarter,
          academicCalendar
      });
  }, [students, destinations, busFareSettings, saturdayBusFareSettings, busFareCurrency, quarters, activeQuarterId, under3Surcharge, siblingDiscountRate, currentQuarter, academicCalendar]);

  
  const [isCopyRouteDialogOpen, setCopyRouteDialogOpen] = useState(false);
  const allDays: DayOfWeek[] = useMemo(() => ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'], []);
  const [daysToCopyRouteTo, setDaysToCopyRouteTo] = useState<Partial<Record<DayOfWeek, boolean>>>(
      () => allDays.reduce((acc, day) => ({ ...acc, [day]: true }), {})
  );
  const [routeTypesToCopyRouteTo, setRouteTypesToCopyRouteTo] = useState<Partial<Record<'Morning' | 'Afternoon', boolean>>>({ Morning: true, Afternoon: true });


  // 목적지 그룹 필터링 상태 (all, 미지정, Zone 이름)
  const [destinationZoneFilter, setDestinationZoneFilter] = useState<string>('all');

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
    return destinations.filter(dest => {
      // 1. 검색어 필터
      if (destinationSearchQuery) {
        const normQuery = normalizeString(destinationSearchQuery);
        const normName = normalizeString(dest.name);
        if (!normName.includes(normQuery)) return false;
      }

      // 2. 그룹(Zone) 필터
      if (destinationZoneFilter !== 'all') {
        const isSaturday = batchZoneTab === 'saturday';
        const currentDestZone = isSaturday 
          ? (dest.saturdayZone && Object.keys(saturdayBusFareSettings).includes(dest.saturdayZone) ? dest.saturdayZone : '미지정')
          : (dest.zone && Object.keys(busFareSettings).includes(dest.zone) ? dest.zone : '미지정');

        if (destinationZoneFilter === '미지정') {
          if (currentDestZone !== '미지정') return false;
        } else {
          if (currentDestZone !== destinationZoneFilter) return false;
        }
      }

      return true;
    });
  }, [destinations, destinationSearchQuery, destinationZoneFilter, batchZoneTab, busFareSettings, saturdayBusFareSettings]);


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

  // 미편성 목적지: 학생이 사용 중이나 현재 경로(요일+타입)의 어떤 버스 노선에도 편성되지 않은 목적지
  const unassignedDestinations = useMemo(() => {
    if (students.length === 0) return [];

    // 현재 경로의 모든 버스 노선에 편성된 목적지 ID 집합
    const assignedDestIds = new Set<string>();
    routes
      .filter(r => r.dayOfWeek === selectedDay && r.type === selectedRouteType)
      .forEach(r => (r.stops || []).forEach(id => assignedDestIds.add(id)));

    // 현재 경로 타입에 따라 학생의 목적지 ID 수집
    const studentDestIds = new Set<string>();
    students.forEach(s => {
      const dId = selectedRouteType === 'Morning' ? s.morningDestinationId : s.afternoonDestinationId;
      if (dId && !assignedDestIds.has(dId)) studentDestIds.add(dId);
    });

    // 해당 목적지가 destinations 목록에 존재하는 경우만 반환
    return destinations.filter(d => studentDestIds.has(d.id));
  }, [students, routes, destinations, selectedDay, selectedRouteType]);


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
        const isSaturday = batchZoneTab === 'saturday';
        const headers = ["목적지 이름", "평일 목적지그룹", "토요일 목적지그룹"];
        const examples = [
            ["경남 랜드마크", "Zone A (근거리)", "Zone A (근거리)"],
            ["서호 호수공원", "Zone B (중거리)", "Zone B (중거리)"],
            ["타오디엔 펄", "미지정", "미지정"]
        ];
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
            const headers = ["목적지 이름", "평일 목적지그룹", "토요일 목적지그룹"];
            const wsData = [
                headers,
                ...destinations.map(d => [
                    d.name, 
                    d.zone || '미지정',
                    d.saturdayZone || '미지정'
                ])
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

    const currentMode = batchZoneTab; // 'weekday' | 'saturday'
    const reader = new FileReader();
    reader.onload = async (e) => {
        try {
            const XLSX = await import('xlsx');
            const data = new Uint8Array(e.target?.result as ArrayBuffer);
            const workbook = XLSX.read(data, { type: 'array' });
            const firstSheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[firstSheetName];
            const results: any[] = XLSX.utils.sheet_to_json(worksheet, { defval: "" });

            if (!results || results.length === 0) {
                toast({ title: t('notice'), description: "엑셀 파일에 데이터가 비어있습니다.", variant: "default" });
                return;
            }

            const syncItems = results.map((row: any) => {
                const name = (row['목적지 이름'] || row['목적지명'] || row['name'] || '').toString().trim();
                
                // 평일 그룹 추출
                const weekdayZone = (
                    row['평일 목적지그룹'] || 
                    row['평일목적지그룹'] || 
                    row['평일그룹'] || 
                    row['목적지그룹(평일)'] || 
                    (currentMode === 'weekday' ? (row['목적지그룹(선택)'] || row['목적지그룹'] || row['zone']) : undefined) ||
                    ''
                ).toString().trim();

                // 토요일 그룹 추출
                const satZone = (
                    row['토요일 목적지그룹'] || 
                    row['토요일목적지그룹'] || 
                    row['토요 목적지그룹'] || 
                    row['토요그룹'] || 
                    row['목적지그룹(토요일)'] || 
                    (currentMode === 'saturday' ? (row['목적지그룹(선택)'] || row['목적지그룹'] || row['saturdayZone']) : undefined) ||
                    ''
                ).toString().trim();

                // 평일/토요일 모두 컬럼이 있는 경우 'both', 아니면 현재 탭 기준
                let mode: 'weekday' | 'saturday' | 'both' = currentMode;
                if ((row['평일 목적지그룹'] || row['평일그룹']) && (row['토요일 목적지그룹'] || row['토요그룹'])) {
                    mode = 'both';
                }

                return {
                    name,
                    zone: weekdayZone || undefined,
                    saturdayZone: satZone || undefined,
                    mode
                };
            }).filter(item => !!item.name);

            if (syncItems.length === 0) {
                toast({ title: t('notice'), description: "유효한 목적지 이름이 포함된 행을 찾을 수 없습니다.", variant: "default" });
                return;
            }

            const { dismiss } = toast({ 
                title: t('processing'), 
                description: `목적지 ${syncItems.length}건을 [${currentMode === 'weekday' ? '평일' : '토요일'} 요금제] 기준으로 동기화 중입니다...` 
            });

            try {
                const res = await syncDestinationsFromExcelBatch(syncItems, destinations);
                dismiss();
                toast({ 
                    title: "목적지 및 그룹 일괄 반영 완료", 
                    description: `기존 목적지 ${res.updatedCount}건의 그룹이 업데이트되었고, 신규 목적지 ${res.addedCount}건이 등록되었습니다.` 
                });
            } catch (error) {
                dismiss();
                toast({ title: t('error'), description: "목적지 저장 중 오류가 발생했습니다.", variant: "destructive" });
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
    const movedCount = selectedAllDestIds.length;
    setIsBatchUpdatingZone(true);
    try {
      await updateDestinationsZoneBatch(selectedAllDestIds, targetZone);
      setSelectedAllDestIds([]); // 이동 완료 후 선택 항목 자동 초기화!
      toast({
        title: "📅 평일 그룹 일괄 변경 완료",
        description: `선택한 ${movedCount}개 목적지가 평일 [${targetZone === '미지정' ? '미지정' : targetZone}] 그룹으로 이동되었습니다.`,
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

  const handleBatchUpdateSaturdayZone = async (targetZone: string) => {
    if (selectedAllDestIds.length === 0) return;
    const movedCount = selectedAllDestIds.length;
    setIsBatchUpdatingZone(true);
    try {
      await updateDestinationsSaturdayZoneBatch(selectedAllDestIds, targetZone);
      setSelectedAllDestIds([]); // 이동 완료 후 선택 항목 자동 초기화!
      toast({
        title: "🚌 토요일 그룹 일괄 변경 완료",
        description: `선택한 ${movedCount}개 목적지가 토요일 [${targetZone === '미지정' ? '미지정' : targetZone}] 그룹으로 이동되었습니다.`,
      });
    } catch (err) {
      toast({
        variant: "destructive",
        title: "일괄 변경 실패",
        description: "토요일 목적지 그룹 변경 중 오류가 발생했습니다.",
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
        setSelectedAllDestIds(prev => prev.includes(destId) ? prev.filter(id => id !== destId) : [...prev, destId]);
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
                <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-3">
                    <div>
                        <CardTitle className="text-base sm:text-lg font-bold">목적지 관리</CardTitle>
                        <CardDescription className="text-xs">
                            {t('admin.bus_config.dest.description')}
                        </CardDescription>
                    </div>
                    <div className="flex items-center gap-1.5 flex-wrap">
                        <Button variant="outline" size="sm" className="h-8 text-xs font-semibold" onClick={handleDownloadDestinationTemplate}>
                            <Download className="mr-1.5 h-3.5 w-3.5" /> {t('admin.bus_config.dest.template')}
                        </Button>
                        <Button variant="outline" size="sm" className="h-8 text-xs font-semibold" onClick={handleDownloadDestinationList}>
                            <Download className="mr-1.5 h-3.5 w-3.5" /> {t('admin.bus_config.dest.download.button')}
                        </Button>
                        <Button variant="outline" size="sm" className="h-8 text-xs font-semibold" onClick={() => fileInputRef.current?.click()}>
                            <Upload className="mr-1.5 h-3.5 w-3.5" /> {t('batch_upload')}
                        </Button>
                        <input type="file" ref={fileInputRef} onChange={handleDestinationFileUpload} accept=".xlsx" className="hidden" />
                    </div>
                </CardHeader>
                <CardContent>
                    <div className="flex justify-end gap-2 mb-3">
                        <Dialog>
                            <DialogTrigger asChild><Button className="w-full h-9 text-xs font-bold"><PlusCircle className="mr-2 h-4 w-4" /> {t('admin.bus_config.dest.add.button')}</Button></DialogTrigger>
                            <DialogContent>
                                <DialogHeader><DialogTitle>{t('admin.bus_config.dest.add.title')}</DialogTitle></DialogHeader>
                                <Input placeholder={t('admin.bus_config.dest.add.placeholder')} value={newDestinationName} onChange={e => setNewDestinationName(e.target.value)} />
                                <Button className="mt-2" onClick={handleAddDestination}>{t('add')}</Button>
                            </DialogContent>
                        </Dialog>
                        <AlertDialog>
                            <AlertDialogTrigger asChild>
                                <Button variant="destructive" className="w-full h-9 text-xs font-bold"><Trash2 className="mr-2 h-4 w-4" /> {t('delete_all')}</Button>
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

                    {/* ── 미편성 목적지 추천 + 목적지 그룹 설정 나란히 배치 (높이 일치) ── */}
                    <div className="flex gap-3 mb-3 items-stretch">
                        {/* 왼쪽: 미편성 목적지 추천 */}
                        {unassignedDestinations.length > 0 && (
                            <div className="flex-1 min-w-0 rounded-xl border border-amber-200 bg-amber-50/60 overflow-hidden flex flex-col justify-between">
                                <div>
                                    <div className="flex items-center justify-between px-3 py-2 border-b border-amber-200/70 bg-amber-100/60">
                                        <div className="flex items-center gap-1.5">
                                            <Sparkles className="w-4 h-4 text-amber-600 shrink-0" />
                                            <span className="text-sm sm:text-base font-bold text-amber-800 whitespace-nowrap">미편성 목적지 추천</span>
                                            <Badge className="bg-amber-500 text-white text-xs px-1.5 py-0 font-bold">{unassignedDestinations.length}</Badge>
                                        </div>
                                        <span className="text-xs text-amber-700 font-medium hidden sm:inline">노선 미편성</span>
                                    </div>
                                    <div className="p-2 space-y-1.5 max-h-40 overflow-y-auto">
                                        {unassignedDestinations.map((dest) => {
                                            const studentCount = students.filter(s => {
                                                const dId = selectedRouteType === 'Morning' ? s.morningDestinationId : s.afternoonDestinationId;
                                                return dId === dest.id;
                                            }).length;
                                            const candidateRoutes = routes.filter(r =>
                                                r.dayOfWeek === selectedDay &&
                                                r.type === selectedRouteType
                                            );
                                            const shortName = dest.name.length > 20 ? dest.name.slice(0, 20) + '...' : dest.name;
                                            return (
                                                <div key={dest.id} className="flex items-center gap-2 bg-white rounded-lg border border-amber-200/60 px-2.5 py-1.5">
                                                    <div className="flex-1 min-w-0">
                                                        <span className="text-sm font-bold text-slate-800 block truncate" title={dest.name}>{shortName}</span>
                                                        <span className="text-xs text-slate-600 font-medium">{studentCount}명</span>
                                                    </div>
                                                    {candidateRoutes.length > 0 ? (
                                                        <select
                                                            className="h-7 text-xs border border-amber-300 rounded px-1.5 font-bold text-slate-800 bg-white focus:outline-none focus:ring-1 focus:ring-amber-400 cursor-pointer w-20 shrink-0"
                                                            defaultValue=""
                                                            title="버스 선택 후 노선에 추가"
                                                            onChange={async (e) => {
                                                                const routeId = e.target.value;
                                                                if (!routeId) return;
                                                                const route = routes.find(r => r.id === routeId);
                                                                if (!route) return;
                                                                const newStops = [...(route.stops || [])];
                                                                if (!newStops.includes(dest.id)) newStops.push(dest.id);
                                                                try {
                                                                    await updateRouteStops(routeId, newStops);
                                                                    toast({ title: '노선 편성 완료', description: `[${dest.name}]이(가) ${buses.find(b => b.id === route.busId)?.name || '해당 버스'} 노선에 추가되었습니다.` });
                                                                } catch {
                                                                    toast({ title: '편성 실패', variant: 'destructive', description: '노선 stops 업데이트 중 오류가 발생했습니다.' });
                                                                }
                                                                e.target.value = '';
                                                            }}
                                                        >
                                                            <option value="">버스</option>
                                                            {candidateRoutes.map(r => {
                                                                const busName = buses.find(b => b.id === r.busId)?.name || r.busId;
                                                                return <option key={r.id} value={r.id}>{busName}</option>;
                                                            })}
                                                        </select>
                                                    ) : (
                                                        <span className="text-xs text-slate-400 italic shrink-0">노선 없음</span>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* 오른쪽: 목적지 그룹 설정 (높이 맞춤) */}
                        <div className={cn(
                            "rounded-xl border border-indigo-200/80 bg-gradient-to-r from-indigo-50 to-blue-50/80 shadow-xs overflow-hidden flex flex-col justify-between",
                            unassignedDestinations.length > 0 ? "flex-1 min-w-0" : "w-full"
                        )}>
                            <div>
                                {/* 헤더: 전체 선택 */}
                                <div className="flex items-center justify-between gap-2 px-3 py-2 border-b border-indigo-200/60 bg-indigo-100/40">
                                    <label className="flex items-center gap-2 text-sm font-bold text-slate-800 cursor-pointer select-none">
                                        <Checkbox
                                            checked={filteredDestinations.length > 0 && filteredDestinations.every(d => selectedAllDestIds.includes(d.id))}
                                            onCheckedChange={(checked) => {
                                                if (checked) {
                                                    setSelectedAllDestIds(filteredDestinations.map(d => d.id));
                                                } else {
                                                    setSelectedAllDestIds([]);
                                                }
                                            }}
                                        />
                                        <span>전체 선택</span>
                                        <span className="text-xs font-semibold text-indigo-700 bg-indigo-100 px-1.5 py-0.5 rounded">
                                            {selectedAllDestIds.length}/{filteredDestinations.length}
                                        </span>
                                    </label>
                                    {selectedAllDestIds.length > 0 && (
                                        <button type="button" onClick={() => setSelectedAllDestIds([])} className="text-xs text-slate-500 hover:text-slate-800 underline font-medium transition">
                                            해제
                                        </button>
                                    )}
                                </div>

                                {/* 그룹 이동 탭 + 드롭다운 */}
                                <div className="px-3 py-2.5 space-y-2">
                                    <div className="flex items-center justify-between gap-2">
                                        <span className="text-xs sm:text-sm font-bold text-indigo-900">선택 목적지 그룹 이동:</span>
                                        {/* 탭 버튼 */}
                                        <div className="flex gap-1 p-0.5 bg-indigo-100/70 rounded-md">
                                            <button
                                                type="button"
                                                onClick={() => setBatchZoneTab('weekday')}
                                                className={cn(
                                                    "text-xs font-bold px-2.5 py-1 rounded transition",
                                                    batchZoneTab === 'weekday' ? "bg-blue-600 text-white shadow-sm" : "text-indigo-700 hover:bg-indigo-200/60"
                                                )}
                                            >
                                                평일
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => setBatchZoneTab('saturday')}
                                                className={cn(
                                                    "text-xs font-bold px-2.5 py-1 rounded transition",
                                                    batchZoneTab === 'saturday' ? "bg-orange-500 text-white shadow-sm" : "text-indigo-700 hover:bg-indigo-200/60"
                                                )}
                                            >
                                                토요일
                                            </button>
                                        </div>
                                    </div>

                                    {/* 평일 탭 */}
                                    {batchZoneTab === 'weekday' && (
                                        <div className="flex items-center gap-1.5 pt-0.5">
                                            <select
                                                value={selectedBatchZone}
                                                onChange={(e) => setSelectedBatchZone(e.target.value)}
                                                className="text-xs sm:text-sm border border-blue-200 rounded-md px-2 py-1.5 font-bold text-slate-800 bg-white focus:outline-none focus:ring-1 focus:ring-blue-400 flex-1 min-w-0"
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
                                                className="bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs px-3 h-8 shrink-0 shadow-xs cursor-pointer disabled:opacity-50 transition rounded-md"
                                            >
                                                {isBatchUpdatingZone ? '적용 중' : `${selectedAllDestIds.length}개 이동`}
                                            </Button>
                                        </div>
                                    )}

                                    {/* 토요일 탭 */}
                                    {batchZoneTab === 'saturday' && (
                                        <div className="flex items-center gap-1.5 pt-0.5">
                                            <select
                                                value={selectedSaturdayBatchZone}
                                                onChange={(e) => setSelectedSaturdayBatchZone(e.target.value)}
                                                className="text-xs sm:text-sm border border-orange-200 rounded-md px-2 py-1.5 font-bold text-slate-800 bg-white focus:outline-none focus:ring-1 focus:ring-orange-400 flex-1 min-w-0"
                                            >
                                                <option value="미지정">미지정 (요금 없음)</option>
                                                {Object.keys(saturdayBusFareSettings).map((g) => (
                                                    <option key={g} value={g}>{g}</option>
                                                ))}
                                            </select>
                                            <Button
                                                size="sm"
                                                onClick={() => handleBatchUpdateSaturdayZone(selectedSaturdayBatchZone)}
                                                disabled={selectedAllDestIds.length === 0 || isBatchUpdatingZone}
                                                className="bg-orange-500 hover:bg-orange-600 text-white font-bold text-xs px-3 h-8 shrink-0 shadow-xs cursor-pointer disabled:opacity-50 transition rounded-md"
                                            >
                                                {isBatchUpdatingZone ? '적용 중' : `${selectedAllDestIds.length}개 이동`}
                                            </Button>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>


                    {/* 검색 및 그룹(Zone) 필터 바 */}
                    <div className="flex flex-col sm:flex-row gap-2 mb-3">
                        <div className="relative flex-1">
                            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                            <Input 
                                type="search"
                                placeholder={t('admin.bus_config.dest.search_placeholder')}
                                className="pl-8 w-full h-9 text-xs font-medium"
                                value={destinationSearchQuery}
                                onChange={(e) => setDestinationSearchQuery(e.target.value)}
                            />
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                            <select
                                value={destinationZoneFilter}
                                onChange={(e) => {
                                    setDestinationZoneFilter(e.target.value);
                                    setSelectedAllDestIds([]); // 필터 변경 시 선택 초기화
                                }}
                                className="h-9 text-xs border border-indigo-200 rounded-md px-2.5 font-bold text-slate-800 bg-white shadow-2xs focus:outline-none focus:ring-2 focus:ring-indigo-400 cursor-pointer"
                                title="목적지 그룹(Zone)별 필터링"
                            >
                                <option value="all">전체 그룹 보기 ({destinations.length}개)</option>
                                <option value="미지정">미지정 (요금 없음)만 보기</option>
                                {Object.keys(batchZoneTab === 'weekday' ? busFareSettings : saturdayBusFareSettings).map((zoneName) => (
                                    <option key={zoneName} value={zoneName}>
                                        {zoneName}
                                    </option>
                                ))}
                            </select>
                        </div>
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
                                    {(() => {
                                        const riderCount = destinationRiderCounts.get(dest.id) || 0;
                                        const isSmall = riderCount >= 1 && riderCount <= 3;
                                        return (
                                            <div className="flex-1 flex flex-col min-w-0 pr-2">
                                                <div className="flex items-center gap-1.5 flex-wrap">
                                                    <span 
                                                        className="text-sm font-bold text-slate-800 cursor-pointer select-none truncate hover:text-indigo-600"
                                                        onClick={(e) => handleSelectAllDest(e, dest.id)}
                                                    >
                                                        {dest.name}
                                                    </span>
                                                    {riderCount > 0 ? (
                                                        <span className={cn(
                                                            "text-[10px] px-1.5 py-0.5 rounded font-bold border shrink-0",
                                                            isSmall 
                                                                ? "bg-rose-50 text-rose-700 border-rose-200" 
                                                                : "bg-slate-100 text-slate-700 border-slate-200"
                                                        )}>
                                                            {riderCount}명 {isSmall && under3Surcharge > 0 ? `(3명이하 소수탑승 +${under3Surcharge.toLocaleString()} ${busFareCurrency})` : ''}
                                                        </span>
                                                    ) : (
                                                        <span className="text-[10px] text-slate-400 font-medium shrink-0">0명</span>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })()}
                                    {/* 평일/토요일 zone 셀렉트 (가로 너비 통일 및 글씨 1pt 확대) */}
                                    <div className="flex flex-col gap-1 items-end shrink-0">
                                        <div className="flex items-center gap-1">
                                            <span className="text-xs text-blue-600 font-bold shrink-0 bg-blue-50 border border-blue-200 w-8 text-center py-0.5 rounded">평일</span>
                                            <select
                                                value={dest.zone && Object.keys(busFareSettings).includes(dest.zone) ? dest.zone : '미지정'}
                                                onChange={async (e) => {
                                                    const newZone = e.target.value;
                                                    try {
                                                        await updateDestinationZone(dest.id, newZone);
                                                        toast({
                                                            title: "평일 그룹 변경",
                                                            description: `\"${dest.name}\" → 평일 ${newZone === '미지정' ? '미지정' : newZone}`,
                                                        });
                                                    } catch (err) {
                                                        toast({ variant: "destructive", title: "변경 실패", description: "평일 그룹을 변경하는 중 오류가 발생했습니다." });
                                                    }
                                                }}
                                                className="text-xs border border-blue-200 rounded-md px-2 py-1 font-bold text-slate-700 bg-white cursor-pointer focus:outline-none focus:ring-1 focus:ring-blue-300 w-32 sm:w-36"
                                                onClick={(e) => e.stopPropagation()}
                                            >
                                                <option value="미지정">미지정</option>
                                                {Object.keys(busFareSettings).map((g) => (
                                                    <option key={g} value={g}>{g}</option>
                                                ))}
                                            </select>
                                        </div>
                                        <div className="flex items-center gap-1">
                                            <span className="text-xs text-orange-600 font-bold shrink-0 bg-orange-50 border border-orange-200 w-8 text-center py-0.5 rounded">토</span>
                                            <select
                                                value={dest.saturdayZone && Object.keys(saturdayBusFareSettings).includes(dest.saturdayZone) ? dest.saturdayZone : '미지정'}
                                                onChange={async (e) => {
                                                    const newZone = e.target.value;
                                                    try {
                                                        await updateDestinationSaturdayZone(dest.id, newZone);
                                                        toast({
                                                            title: "토요일 그룹 변경",
                                                            description: `\"${dest.name}\" → 토요일 ${newZone === '미지정' ? '미지정' : newZone}`,
                                                        });
                                                    } catch (err) {
                                                        toast({ variant: "destructive", title: "변경 실패", description: "토요일 그룹을 변경하는 중 오류가 발생했습니다." });
                                                    }
                                                }}
                                                className="text-xs border border-orange-200 rounded-md px-2 py-1 font-bold text-slate-700 bg-white cursor-pointer focus:outline-none focus:ring-1 focus:ring-orange-300 w-32 sm:w-36"
                                                onClick={(e) => e.stopPropagation()}
                                            >
                                                <option value="미지정">미지정</option>
                                                {Object.keys(saturdayBusFareSettings).map((g) => (
                                                    <option key={g} value={g}>{g}</option>
                                                ))}
                                            </select>
                                        </div>
                                    </div>
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
        </div>
    </div>
  );
};


