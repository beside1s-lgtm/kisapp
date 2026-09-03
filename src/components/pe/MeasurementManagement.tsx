'use client';
import { useState, useMemo, useEffect } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { 
    addItem as addItemToDb, 
    archiveItem, 
    archiveCategory, 
    getItems,
    deleteItemAndAssociatedRecords,
    deleteCategoryAndAssociatedRecords,
    updateItem,
    deactivateItem,
    deactivateCategory,
    updateSchoolPeriods,
    getSchoolByName,
} from '@/lib/services/peService';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { Plus, Loader2, Trash2, Pencil, Swords, Target, CalendarRange, Check, X, ChevronRight, Youtube, Calendar as CalendarIcon } from 'lucide-react';
import type { MeasurementItem, RecordType, MeasurementPeriod } from '@/lib/pe/types';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
  DialogClose,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { papsStandards } from '@/lib/pe/paps';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"
import { Checkbox } from '@/components/ui/checkbox';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Skeleton } from '@/components/ui/skeleton';

interface MeasurementManagementProps {
  items: MeasurementItem[];
  onItemsUpdate: (items: MeasurementItem[]) => void;
}

const recordTypeDisplay: Record<RecordType, string> = {
    time: "시간(낮을수록 우수)",
    count: "횟수(높을수록 우수)",
    distance: "거리(높을수록 우수)",
    weight: "무게(높을수록 우수)",
    level: "상중하(정성평가)",
    compound: "복합(BMI 등)"
};

export default function MeasurementManagement({ items, onItemsUpdate }: MeasurementManagementProps) {
  const { user } = useAuth(); const school = 'KISH';
  const { toast } = useToast();
  
  const [editMode, setEditMode] = useState<'none' | 'delete' | 'measurementWeek'>('none');
  const [selection, setSelection] = useState<Record<string, boolean>>({});
  const [isProcessing, setIsProcessing] = useState(false);
  const [schoolSettings, setSchoolSettings] = useState<any>({ measurementPeriods: [] });

  const refreshItems = async () => {
      if (!school) return;
      try {
        const [updatedItems, updatedSchool] = await Promise.all([
          getItems(school),
          getSchoolByName(school)
        ]);
        onItemsUpdate(updatedItems);
        if (updatedSchool) setSchoolSettings(updatedSchool);
      } catch (e) {
        console.error('refreshItems error:', e);
      }
  }

  useEffect(() => {
    if (school) {
      getSchoolByName(school).then(s => {
        if (s) setSchoolSettings(s);
      }).catch(console.error);
    }
  }, [school]);

  // Handle automatic deactivation of measurement week if period ended
  useEffect(() => {
    if (!school || !schoolSettings?.measurementPeriods?.length || !items.length) return;

    const today = new Date().toISOString().split('T')[0];
    const isAnyPeriodActive = schoolSettings.measurementPeriods.some((p: any) => 
      today >= p.startDate && today <= p.endDate
    );
    const hasAnyPeriodInFuture = schoolSettings.measurementPeriods.some((p: any) => 
      today < p.startDate
    );

    // If no periods are active and all have passed
    const allPeriodsPassed = !isAnyPeriodActive && !hasAnyPeriodInFuture;
    
    if (allPeriodsPassed) {
      const itemsToDisable = items.filter(i => i.isMeasurementWeek);
      if (itemsToDisable.length > 0) {
        // Automatically set isMeasurementWeek to false for all items
        const updatedItems = items.map(i => i.isMeasurementWeek ? { ...i, isMeasurementWeek: false } : i);
        onItemsUpdate(updatedItems);
        
        // Sync with DB
        Promise.all(itemsToDisable.map(i => updateItem(school, i.id, { isMeasurementWeek: false })))
          .then(() => {
            toast({ title: '측정 종료', description: '측정 기간이 종료되어 모든 종목의 측정 주간 설정이 자동 해제되었습니다.' });
          });
      }
    }
  }, [schoolSettings, school]);

  const handleAddItem = async (newItem: Omit<MeasurementItem, 'id'>) => {
    if (newItem.name.trim() === '' || !school) {
      toast({
        variant: 'destructive',
        title: '입력 오류',
        description: '종목 이름을 입력해주세요.',
      });
      return;
    }
    await addItemToDb(school, newItem);
    await refreshItems();
    toast({
      title: '추가/활성화 완료',
      description: `"${newItem.name}" 종목이 활성 목록에 추가되었습니다.`,
    });
  };

  const handleUpdateSchoolPeriods = async (periods: MeasurementPeriod[]) => {
    const schoolId = (school as any)?.id || (typeof school === 'string' ? school : null);
    if (!schoolId) return;
    try {
      await updateSchoolPeriods(schoolId, periods);
      await refreshItems();
      toast({ title: '학교 측정 주간 저장 완료' });
    } catch (e) {
      toast({ variant: 'destructive', title: '저장 실패' });
    }
  };
  
  const handleUpdateItem = async (itemId: string, data: Partial<Omit<MeasurementItem, 'id'>>) => {
    if (!school) return;
    try {
        await updateItem(school, itemId, data);
        await refreshItems();
        toast({ title: '수정 완료', description: '종목 정보가 업데이트되었습니다.'});
    } catch (e) {
        toast({ variant: 'destructive', title: '수정 실패', description: '종목 정보 업데이트 중 오류가 발생했습니다.'});
    }
  }

  const handleToggleMeasurementWeek = async (item: MeasurementItem, checked: boolean) => {
    if (!school) return;
    try {
      // Optimistic update
      const updatedItems = items.map(i => i.id === item.id ? { ...i, isMeasurementWeek: checked } : i);
      onItemsUpdate(updatedItems);
      
      await updateItem(school, item.id, { isMeasurementWeek: checked });
    } catch(error) {
       toast({
        variant: 'destructive',
        title: '업데이트 실패',
      });
      // Rollback
      const rolledBack = items.map(i => i.id === item.id ? { ...i, isMeasurementWeek: !checked } : i);
      onItemsUpdate(rolledBack);
    }
  };

  const cancelEditMode = () => {
    setEditMode('none');
    setSelection({});
  }

  const toggleCategorySelection = (category: string, checked: boolean) => {
    const categoryItems = items.filter(item => {
        const itemCategory = item.category || (item.isPaps ? 'PAPS' : '기타');
        return itemCategory === category && !item.isDeactivated;
    });
    
    const newSelection = { ...selection };
    categoryItems.forEach(item => {
        newSelection[item.id] = checked;
    });
    newSelection[category] = checked;
    setSelection(newSelection);
  }

  const handleBulkAction = async () => {
    if (!school || editMode === 'none') return;

    const selectedItems = items.filter(item => selection[item.id]);
    const selectedCategories = Object.keys(selection).filter(key => !items.some(item => item.id === key) && selection[key]);
    
    if (selectedItems.length === 0 && selectedCategories.length === 0) {
      toast({ variant: 'destructive', title: '선택 오류', description: '처리할 항목을 선택해주세요.' });
      return;
    }

    setIsProcessing(true);
    try {
        if (editMode === 'delete') {
            const papsIncluded = selectedItems.some(i => i.isPaps);
            if (papsIncluded) {
                toast({ variant: 'destructive', title: '삭제 불가', description: 'PAPS 종목은 영구 삭제할 수 없습니다. 대신 비활성화를 이용해주세요.' });
                setIsProcessing(false);
                return;
            }
            for (const category of selectedCategories) {
                await deleteCategoryAndAssociatedRecords(school, category, items);
            }
            for (const item of selectedItems) {
                await deleteItemAndAssociatedRecords(school, item);
            }
            toast({ title: '영구 삭제 완료', description: '선택한 항목과 관련 기록이 모두 삭제되었습니다.' });
        } else {
            // Archive / Deactivate mode
            for (const item of selectedItems) {
                await archiveItem(school, item.id, true);
            }
            for (const category of selectedCategories) {
                await archiveCategory(school, category, items, true);
            }
            toast({ title: '비활성화 완료', description: '선택한 항목들이 목록에서 숨겨졌습니다.' });
        }
        
        await refreshItems();
        cancelEditMode();
    } catch (error) {
        console.error("Failed to perform bulk action", error);
        toast({ variant: 'destructive', title: '작업 실패' });
    } finally {
        setIsProcessing(false);
    }
  };

  const { groupedItems, groupedArchivedItems } = useMemo(() => {
    const active: Record<string, MeasurementItem[]> = {};
    const archived: Record<string, MeasurementItem[]> = {};

    items.forEach(item => {
        if (item.isDeactivated) return; 

        const category = item.category || (item.isPaps ? 'PAPS' : '기타');
        if (item.isArchived) {
            if (!archived[category]) archived[category] = [];
            archived[category].push(item);
        } else {
            if (!active[category]) active[category] = [];
            active[category].push(item);
        }
    });

    const orderCategories = (data: Record<string, MeasurementItem[]>) => {
        const ordered: Record<string, MeasurementItem[]> = {};
        if (data['PAPS']) ordered['PAPS'] = data['PAPS'];
        Object.keys(data)
            .filter(k => k !== 'PAPS' && k !== '기타')
            .sort((a, b) => a.localeCompare(b))
            .forEach(k => { ordered[k] = data[k]; });
        if (data['기타']) ordered['기타'] = data['기타'];
        return ordered;
    };

    return { 
        groupedItems: orderCategories(active), 
        groupedArchivedItems: orderCategories(archived) 
    };
  }, [items]);

  if (!school) {
    return (
        <Card className="bg-transparent shadow-none border-none">
            <CardHeader>
                <Skeleton className="h-8 w-48 mb-2" />
                <Skeleton className="h-4 w-full max-w-[500px]" />
            </CardHeader>
            <CardContent className="space-y-6">
                <div className="flex gap-2">
                    <Skeleton className="h-10 w-24" />
                    <Skeleton className="h-10 w-24" />
                    <Skeleton className="h-10 w-24" />
                </div>
                <div className="border rounded-md p-6 space-y-4">
                    <Skeleton className="h-6 w-32" />
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {[1,2,3,4,5,6].map(i => <Skeleton key={i} className="h-12 w-full" />)}
                    </div>
                </div>
            </CardContent>
        </Card>
    );
  }

  return (
    <Card className="bg-transparent shadow-none border-none">
      <CardHeader>
        <CardTitle>종목 관리</CardTitle>
        <CardDescription>측정할 종목을 추가하고 관리합니다. 비활성화된 종목은 '+스포츠' 또는 '+PAPS' 메뉴에서 다시 꺼낼 수 있습니다.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex w-full flex-wrap items-center gap-2">
            <AddPapsItemDialog onAddItem={handleAddItem} currentItems={items} />
            <AddSportDialog onAddItem={handleAddItem} allItems={items} />
            <AddCustomItemDialog onAddItem={handleAddItem} />

            <div className="flex flex-col items-end gap-2 ml-auto">
                {schoolSettings?.measurementPeriods?.length > 0 && (
                  <div className="flex flex-wrap justify-end gap-2 mb-1">
                    {schoolSettings.measurementPeriods.map((p: any) => (
                      <Badge key={p.id} variant="secondary" className="text-[10px] px-1.5 py-0 h-5 bg-primary/10 text-primary border-primary/20">
                        {p.name} ({p.startDate.split('-').slice(1).join('/')}~)
                      </Badge>
                    ))}
                  </div>
                )}
                <div className="flex gap-2">
                    <SchoolPeriodDialog 
                      school={schoolSettings} 
                      onUpdate={handleUpdateSchoolPeriods} 
                      items={items} 
                      onToggleItem={handleToggleMeasurementWeek} 
                    />
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="outline"><Trash2 className="mr-2 h-4 w-4" /> 종목 편집/삭제</Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent>
                        <DropdownMenuItem onSelect={() => { setEditMode('measurementWeek'); setSelection({}); }}>
                          비활성화 (항목 숨기기)
                        </DropdownMenuItem>
                        <DropdownMenuItem onSelect={() => { setEditMode('delete'); setSelection({}); }} className="text-destructive font-semibold">
                          선택 항목 영구 삭제 (데이터 소멸)
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                </div>
            </div>
        </div>

        <div className="border rounded-md p-4 space-y-2">
            <div className="flex items-center justify-between mb-2">
                <h3 className="font-semibold">활성 종목 목록</h3>
            </div>
            
            {Object.values(groupedItems).some(arr => arr.length > 0) ? (
                <Accordion type="multiple" defaultValue={Object.keys(groupedItems)} className="w-full">
                    {Object.entries(groupedItems).map(([category, categoryItems]) => (
                        categoryItems.length > 0 && (
                            <AccordionItem value={category} key={category}>
                                <div className="flex items-center w-full">
                                    {editMode !== 'none' && (
                                        <Checkbox
                                            id={`category-${category}`}
                                            checked={selection[category] || false}
                                            onCheckedChange={(checked) => toggleCategorySelection(category, !!checked)}
                                            className="mr-4"
                                        />
                                    )}
                                    <AccordionTrigger className="font-semibold flex-1">
                                        {category} ({categoryItems.length})
                                    </AccordionTrigger>
                                </div>
                                <AccordionContent>
                                    <ul className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 pl-2">
                                        {categoryItems.map((item) => (
                                          <li key={item.id} className="flex items-center p-2 bg-secondary rounded-md text-sm group">
                                               {editMode !== 'none' && (
                                                    <Checkbox
                                                        id={`item-${item.id}`}
                                                        checked={selection[item.id] || false}
                                                        onCheckedChange={(checked) => setSelection(prev => ({...prev, [item.id]: !!checked}))}
                                                        className="mr-4"
                                                    />
                                                )}
                                              <div className="flex-1 truncate">
                                                  <span className="font-semibold">{item.name}</span>
                                                  <span className="text-muted-foreground ml-2">({item.unit})</span>
                                              </div>
                                              <div className="flex gap-1 ml-auto opacity-0 group-hover:opacity-100 transition-opacity">
                                                  <EditItemDialog item={item} onUpdate={handleUpdateItem} />
                                              </div>
                                          </li>
                                        ))}
                                    </ul>
                                </AccordionContent>
                            </AccordionItem>
                        )
                    ))}
                </Accordion>
            ) : (
                <p className="text-sm text-muted-foreground text-center py-4">활성화된 종목이 없습니다.</p>
            )}
        </div>

        {editMode !== 'none' && (
            <div className="flex justify-between items-center p-4 border rounded-md bg-primary/5 animate-in fade-in slide-in-from-bottom-2">
                <div className="flex items-center gap-2">
                    <p className="text-sm font-medium">{Object.values(selection).filter(Boolean).length}개 항목 선택됨</p>
                </div>
                <div className="flex gap-2">
                    <Button variant="ghost" size="sm" onClick={cancelEditMode}>취소</Button>
                    <AlertDialog>
                        <AlertDialogTrigger asChild>
                            <Button
                                size="sm"
                                variant={editMode === 'delete' ? "destructive" : "default"}
                                disabled={isProcessing || Object.values(selection).filter(Boolean).length === 0}
                            >
                                {isProcessing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                                {editMode === 'delete' ? '선택 항목 영구 삭제' : '선택 항목 비활성화'}
                            </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                            <AlertDialogHeader>
                                <AlertDialogTitle>
                                    {editMode === 'delete' ? '정말로 영구 삭제하시겠습니까?' : '선택한 항목을 비활성화하시겠습니까?'}
                                </AlertDialogTitle>
                                <AlertDialogDescription>
                                    {editMode === 'delete' 
                                        ? '이 작업은 되돌릴 수 없습니다. 모든 기록이 영구적으로 삭제됩니다. (PAPS는 삭제 불가)'
                                        : '비활성화된 종목은 목록에서 숨겨지며, 언제든지 상위 [+스포츠] 또는 [+PAPS] 버튼을 통해 다시 복원할 수 있습니다.'}
                                </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                                <AlertDialogCancel>취소</AlertDialogCancel>
                                <AlertDialogAction onClick={handleBulkAction} className={editMode === 'delete' ? "bg-destructive" : ""}>
                                    확인
                                </AlertDialogAction>
                            </AlertDialogFooter>
                        </AlertDialogContent>
                    </AlertDialog>
                </div>
            </div>
        )}
      </CardContent>
    </Card>
  );
}

function EditItemDialog({ item, onUpdate }: { item: MeasurementItem, onUpdate: (itemId: string, data: Partial<Omit<MeasurementItem, 'id'>>) => Promise<void> }) {
    const [isOpen, setIsOpen] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [name, setName] = useState(item.name || '');
    const [unit, setUnit] = useState(item.unit || '');
    const [recordType, setRecordType] = useState<RecordType>(item.recordType);
    const [goal, setGoal] = useState(item.goal?.toString() || '');
    const [category, setCategory] = useState(item.category || '');
    const [videoUrl, setVideoUrl] = useState(item.videoUrl || '');
    const { toast } = useToast();
    
    useEffect(() => {
        if(isOpen) {
            setName(item.name || '');
            setUnit(item.unit || '');
            setRecordType(item.recordType);
            setGoal(item.goal?.toString() || '');
            setCategory(item.category || (item.isPaps ? 'PAPS' : ''));
            setVideoUrl(item.videoUrl || '');
        }
    }, [isOpen, item]);

    const handleSubmit = async () => {
        if (!name.trim() || !unit.trim()) {
            toast({ variant: 'destructive', title: '입력 오류', description: '이름과 단위는 필수입니다.' });
            return;
        }

        const dataToUpdate: any = {};
        
        if (!item.isPaps) {
            dataToUpdate.name = name.trim();
            dataToUpdate.recordType = recordType;
            dataToUpdate.unit = unit.trim();
        }
        
        dataToUpdate.category = category.trim();
        dataToUpdate.videoUrl = videoUrl.trim();
        
        if (recordType !== 'time' && recordType !== 'level' && recordType !== 'compound') {
            dataToUpdate.goal = goal ? parseFloat(goal) : null;
        } else {
            dataToUpdate.goal = null;
        }
        
        setIsSubmitting(true);
        try {
            await onUpdate(item.id, dataToUpdate);
            setIsOpen(false);
        } catch (e) {
            console.error("Update failed", e);
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogTrigger asChild>
                <Button variant="ghost" size="icon" className="h-6 w-6 ml-auto hover:bg-primary/10">
                    <Pencil className="h-4 w-4 text-muted-foreground group-hover:text-primary" />
                </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
                <DialogHeader>
                    <DialogTitle>종목 정보 수정</DialogTitle>
                    <DialogDescription>
                        {item.isPaps ? 'PAPS 종목은 이름과 측정 방식을 수정할 수 없습니다.' : '종목의 상세 설정을 수정합니다.'}
                    </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="edit-name" className="text-right">종목명</Label>
                        <Input id="edit-name" value={name} onChange={(e) => setName(e.target.value)} disabled={item.isPaps} className="col-span-3" />
                    </div>
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="edit-category" className="text-right">카테고리</Label>
                        <Input id="edit-category" value={category} onChange={(e) => setCategory(e.target.value)} className="col-span-3" placeholder="예: 구기, 육상" />
                    </div>
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="edit-unit" className="text-right">단위</Label>
                        <Input id="edit-unit" value={unit} onChange={(e) => setUnit(e.target.value)} className="col-span-3" placeholder="예: 회, 초, m" />
                    </div>
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="edit-type" className="text-right">기록 유형</Label>
                        <Select value={recordType} onValueChange={(v) => setRecordType(v as RecordType)} disabled={item.isPaps}>
                            <SelectTrigger className="col-span-3"><SelectValue /></SelectTrigger>
                            <SelectContent>
                                {Object.entries(recordTypeDisplay).map(([key, label]) => (
                                    <SelectItem key={key} value={key}>{label}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                    {(recordType !== 'time' && recordType !== 'level' && recordType !== 'compound') && (
                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label htmlFor="edit-goal" className="text-right">목표값</Label>
                            <Input id="edit-goal" type="number" value={goal} onChange={(e) => setGoal(e.target.value)} className="col-span-3" placeholder="달성률 계산 기준 (예: 10)" />
                        </div>
                    )}
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="edit-video" className="text-right flex items-center justify-end gap-1"><Youtube className="h-4 w-4 text-red-600" /> 영상 주소</Label>
                        <Input id="edit-video" value={videoUrl} onChange={(e) => setVideoUrl(e.target.value)} className="col-span-3" placeholder="유튜브 링크 (선택 사항)" />
                    </div>
                </div>
                <DialogFooter>
                    <DialogClose asChild><Button variant="outline">취소</Button></DialogClose>
                    <Button onClick={handleSubmit} disabled={isSubmitting}>
                        {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        저장하기
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

function AddPapsItemDialog({ onAddItem, currentItems }: { onAddItem: (item: Omit<MeasurementItem, 'id'>) => Promise<void>, currentItems: MeasurementItem[] }) {
    const [selectedItemName, setSelectedItemName] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const { toast } = useToast();

    const availablePapsItems = Object.keys(papsStandards).filter(
        papsItemName => !currentItems.some(item => item.name === papsItemName && !item.isDeactivated)
    );

    const handleSubmit = async () => {
        if (!selectedItemName) return;
        setIsSubmitting(true);
        const standard = papsStandards[selectedItemName as keyof typeof papsStandards];
        const newItem: Omit<MeasurementItem, 'id'> = {
            name: selectedItemName,
            unit: standard.unit,
            recordType: standard.type,
            isPaps: true,
            isCompound: standard.type === 'compound',
            category: 'PAPS',
        };
        await onAddItem(newItem);
        setSelectedItemName('');
        setIsSubmitting(false);
        document.getElementById('add-paps-item-dialog-close')?.click();
    };

    return (
        <Dialog>
            <DialogTrigger asChild><Button variant="outline"><Plus className="mr-2 h-4 w-4" /> PAPS</Button></DialogTrigger>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>PAPS 종목 추가/활성화</DialogTitle>
                    <DialogDescription>비활성화된 PAPS 종목을 다시 활성 목록으로 가져옵니다.</DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                    <Label htmlFor="paps-item">종목 선택</Label>
                    <Select onValueChange={setSelectedItemName} value={selectedItemName}>
                        <SelectTrigger id="paps-item"><SelectValue placeholder="PAPS 종목 선택" /></SelectTrigger>
                        <SelectContent>
                            {availablePapsItems.length > 0 ? (
                                availablePapsItems.map(name => <SelectItem key={name} value={name}>{name}</SelectItem>)
                            ) : (
                                <SelectItem value="none" disabled>모든 PAPS 종목이 활성화되어 있습니다.</SelectItem>
                            )}
                        </SelectContent>
                    </Select>
                </div>
                <DialogFooter>
                    <DialogClose asChild><Button id="add-paps-item-dialog-close" variant="outline">취소</Button></DialogClose>
                    <Button onClick={handleSubmit} disabled={availablePapsItems.length === 0 || isSubmitting}>
                       {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                       활성화하기
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

function AddSportDialog({ onAddItem, allItems }: { onAddItem: (item: Omit<MeasurementItem, 'id'>) => Promise<void>, allItems: MeasurementItem[] }) {
    const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
    const { toast } = useToast();

    const baseCategories = ['배구', '농구', '야구', '축구', '피구'];
    const currentCategories = [...new Set(allItems.filter(i => !i.isPaps && i.category !== '기타').map(i => i.category as string))];
    const categories = [...new Set([...baseCategories, ...currentCategories])].sort();

    const deactivatedInCategory = useMemo(() => {
        if (!selectedCategory) return [];
        return allItems.filter(i => i.category === selectedCategory && i.isDeactivated);
    }, [selectedCategory, allItems]);

    return (
        <Dialog onOpenChange={(open) => !open && setSelectedCategory(null)}>
            <DialogTrigger asChild><Button className="bg-primary text-white"><Swords className="mr-2 h-4 w-4" /> +스포츠</Button></DialogTrigger>
            <DialogContent className="max-w-2xl">
                <DialogHeader>
                    <DialogTitle>스포츠 종목 관리</DialogTitle>
                    <DialogDescription>스포츠를 선택하여 비활성화된 종목을 복원하거나 새 지표를 추가하세요.</DialogDescription>
                </DialogHeader>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 py-4">
                    <div className="space-y-2">
                        <Label>카테고리 선택</Label>
                        <div className="grid grid-cols-2 gap-2 max-h-64 overflow-y-auto pr-2">
                            {categories.map(cat => (
                                <Button key={cat} variant={selectedCategory === cat ? "default" : "outline"} onClick={() => setSelectedCategory(cat)} className="justify-between">
                                    {cat} <ChevronRight className="h-4 w-4 opacity-50" />
                                </Button>
                            ))}
                        </div>
                        <AddCategoryDialog onAdd={(name) => setSelectedCategory(name)} />
                    </div>
                    <div className="space-y-4 border-l pl-6">
                        {selectedCategory ? (
                            <>
                                <div className="flex items-center justify-between">
                                    <h4 className="font-bold text-lg text-primary">{selectedCategory} 지표</h4>
                                    <AddMetricInCategoryDialog category={selectedCategory} onAddItem={onAddItem} />
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-muted-foreground text-xs">비활성화된 종목</Label>
                                    <div className="space-y-1">
                                        {deactivatedInCategory.length > 0 ? (
                                            deactivatedInCategory.map(item => (
                                                <Button key={item.id} variant="secondary" className="w-full justify-start text-sm" onClick={() => onAddItem({ ...item })}>
                                                    <Plus className="h-3 w-3 mr-2" /> {item.name} ({item.unit})
                                                </Button>
                                            ))
                                        ) : <p className="text-xs text-muted-foreground text-center py-4 border border-dashed rounded-md">관리할 수 있는 종목이 없습니다.</p>}
                                    </div>
                                </div>
                            </>
                        ) : (
                            <div className="flex flex-col items-center justify-center h-full text-muted-foreground opacity-50">
                                <Swords className="h-12 w-12 mb-2" /><p className="text-sm">스포츠를 선택해주세요.</p>
                            </div>
                        )}
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}

function AddCategoryDialog({ onAdd }: { onAdd: (name: string) => void }) {
    const [name, setName] = useState('');
    const [isOpen, setIsOpen] = useState(false);
    return (
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogTrigger asChild><Button variant="ghost" className="w-full border-dashed border-2 mt-2"><Plus className="h-4 w-4 mr-2" /> 새로운 스포츠 추가</Button></DialogTrigger>
            <DialogContent>
                <DialogHeader><DialogTitle>새 스포츠 카테고리</DialogTitle></DialogHeader>
                <div className="py-4">
                    <Label htmlFor="new-cat-name">스포츠 이름</Label>
                    <Input id="new-cat-name" value={name} onChange={e => setName(e.target.value)} placeholder="예: 배드민턴, 핸드볼" />
                </div>
                <DialogFooter><Button onClick={() => { if(name.trim()) { onAdd(name.trim()); setIsOpen(false); setName(''); } }}>추가</Button></DialogFooter>
            </DialogContent>
        </Dialog>
    )
}

function AddMetricInCategoryDialog({ category, onAddItem }: { category: string, onAddItem: (item: Omit<MeasurementItem, 'id'>) => Promise<void> }) {
    const [name, setName] = useState('');
    const [unit, setUnit] = useState('');
    const [recordType, setRecordType] = useState<RecordType>('count');
    const [goal, setGoal] = useState('');
    const [videoUrl, setVideoUrl] = useState('');
    const [isOpen, setIsOpen] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleSubmit = async () => {
        if (!name.trim() || !unit.trim()) return;
        setIsSubmitting(true);
        await onAddItem({ name: name.trim(), unit: unit.trim(), recordType, category, isPaps: false, goal: goal ? parseFloat(goal) : undefined, videoUrl: videoUrl.trim() });
        setIsSubmitting(false); setIsOpen(false); setName(''); setUnit(''); setGoal(''); setVideoUrl('');
    }

    return (
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogTrigger asChild><Button size="sm" variant="outline"><Plus className="h-3 w-3 mr-1" /> 추가</Button></DialogTrigger>
            <DialogContent>
                <DialogHeader><DialogTitle>{category} 지표 추가</DialogTitle></DialogHeader>
                <div className="grid gap-4 py-4">
                    <div className="grid grid-cols-4 items-center gap-4"><Label className="text-right">지표명</Label><Input value={name} onChange={e => setName(e.target.value)} className="col-span-3" placeholder="예: 스파이트 성공" /></div>
                    <div className="grid grid-cols-4 items-center gap-4"><Label className="text-right">단위</Label><Input value={unit} onChange={e => setUnit(e.target.value)} className="col-span-3" placeholder="예: 회, 초" /></div>
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label className="text-right">유형</Label>
                        <Select value={recordType} onValueChange={v => setRecordType(v as RecordType)}>
                            <SelectTrigger className="col-span-3"><SelectValue /></SelectTrigger>
                            <SelectContent>{Object.entries(recordTypeDisplay).map(([key, label]) => <SelectItem key={key} value={key}>{label}</SelectItem>)}</SelectContent>
                        </Select>
                    </div>
                    {recordType !== 'time' && recordType !== 'level' && (
                        <div className="grid grid-cols-4 items-center gap-4"><Label className="text-right">목표치</Label><Input type="number" value={goal} onChange={e => setGoal(e.target.value)} className="col-span-3" /></div>
                    )}
                    <div className="grid grid-cols-4 items-center gap-4"><Label className="text-right font-bold"><Youtube className="h-4 w-4 text-red-600 inline mr-1" /> 영상</Label><Input value={videoUrl} onChange={e => setVideoUrl(e.target.value)} className="col-span-3" placeholder="링크" /></div>
                </div>
                <DialogFooter><Button onClick={handleSubmit} disabled={isSubmitting}>{isSubmitting ? <Loader2 className="animate-spin h-4 w-4" /> : '추가하기'}</Button></DialogFooter>
            </DialogContent>
        </Dialog>
    )
}

function AddCustomItemDialog({ onAddItem }: { onAddItem: (item: Omit<MeasurementItem, 'id'>) => Promise<void> }) {
  const [name, setName] = useState('');
  const [unit, setUnit] = useState('');
  const [recordType, setRecordType] = useState<RecordType | ''>('');
  const [goal, setGoal] = useState('');
  const [videoUrl, setVideoUrl] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();

  const handleSubmit = async () => {
    if (!name || !unit || !recordType) return;
    setIsSubmitting(true);
    const newItem: Omit<MeasurementItem, 'id'> = { name, unit, recordType, isPaps: false, category: '기타', videoUrl: videoUrl.trim() };
    if (goal) newItem.goal = parseFloat(goal);
    await onAddItem(newItem);
    setName(''); setUnit(''); setRecordType(''); setGoal(''); setVideoUrl(''); setIsSubmitting(false);
    document.getElementById('add-custom-item-dialog-close')?.click();
  };

  return (
    <Dialog>
      <DialogTrigger asChild><Button variant="outline"><Target className="mr-2 h-4 w-4" /> +기타</Button></DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>기타 종목 추가</DialogTitle></DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-4 items-center gap-4"><Label className="text-right">종목명</Label><Input value={name} onChange={e => setName(e.target.value)} className="col-span-3" /></div>
          <div className="grid grid-cols-4 items-center gap-4"><Label className="text-right">단위</Label><Input value={unit} onChange={e => setUnit(e.target.value)} className="col-span-3" /></div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label className="text-right">유형</Label>
            <Select onValueChange={(v) => setRecordType(v as RecordType)} value={recordType}>
                <SelectTrigger className="col-span-3"><SelectValue /></SelectTrigger>
                <SelectContent>
                    <SelectItem value="time">시간</SelectItem>
                    <SelectItem value="count">횟수</SelectItem>
                    <SelectItem value="distance">거리</SelectItem>
                    <SelectItem value="weight">무게</SelectItem>
                    <SelectItem value="level">상중하</SelectItem>
                </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-4 items-center gap-4"><Label className="text-right">영상</Label><Input value={videoUrl} onChange={e => setVideoUrl(e.target.value)} className="col-span-3" /></div>
        </div>
        <DialogFooter>
          <DialogClose asChild><Button id="add-custom-item-dialog-close" variant="outline">취소</Button></DialogClose>
          <Button onClick={handleSubmit} disabled={isSubmitting}>추가</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function SchoolPeriodDialog({ school, onUpdate, items, onToggleItem }: { school: any, onUpdate: (periods: MeasurementPeriod[]) => Promise<void>, items: MeasurementItem[], onToggleItem: (item: MeasurementItem, checked: boolean) => Promise<void> }) {
    const [isOpen, setIsOpen] = useState(false);
    const [periods, setPeriods] = useState<MeasurementPeriod[]>(school?.measurementPeriods || []);
    useEffect(() => { if (isOpen) setPeriods(school?.measurementPeriods || []); }, [isOpen, school]);
    const activeItems = useMemo(() => items.filter(i => !i.isDeactivated && !i.isArchived), [items]);
    const addPeriod = () => {
        setPeriods([...periods, { id: crypto.randomUUID(), name: `${periods.length + 1}차 측정`, startDate: format(new Date(), 'yyyy-MM-dd'), endDate: format(new Date(), 'yyyy-MM-dd') }]);
    };
    return (
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogTrigger asChild><Button variant="outline" className="border-primary text-primary hover:bg-primary/5"><CalendarRange className="mr-2 h-4 w-4" /> 측정 주간 & 종목 설정</Button></DialogTrigger>
            <DialogContent className="max-w-2xl">
                <DialogHeader><DialogTitle>학교 공통 측정 설정</DialogTitle><DialogDescription>측정 기간과 해당 주간에 측정할 종목을 선택하세요.</DialogDescription></DialogHeader>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 py-4">
                    <div className="space-y-4">
                        <h4 className="font-bold flex items-center gap-2"><CalendarIcon className="h-4 w-4" /> 기간 설정</h4>
                        <div className="space-y-4 max-h-[300px] overflow-y-auto pr-2">
                            {periods.map((p, index) => (
                                <div key={p.id} className="p-3 bg-muted/50 rounded-lg border space-y-2">
                                    <div className="flex items-center gap-2">
                                        <Input value={p.name} onChange={e => setPeriods(periods.map(pr => pr.id === p.id ? {...pr, name: e.target.value} : pr))} className="h-8 font-bold" />
                                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setPeriods(periods.filter(pr => pr.id !== p.id))}><X className="h-4 w-4" /></Button>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <Input type="date" value={p.startDate} onChange={e => setPeriods(periods.map(pr => pr.id === p.id ? {...pr, startDate: e.target.value} : pr))} className="h-8 text-xs" />
                                        <span>~</span>
                                        <Input type="date" value={p.endDate} onChange={e => setPeriods(periods.map(pr => pr.id === p.id ? {...pr, endDate: e.target.value} : pr))} className="h-8 text-xs" />
                                    </div>
                                </div>
                            ))}
                            <Button variant="outline" className="w-full border-dashed" onClick={addPeriod}>+ 주간 추가</Button>
                        </div>
                    </div>
                    <div className="space-y-4 border-l pl-6">
                        <h4 className="font-bold flex items-center gap-2"><Target className="h-4 w-4" /> 측정 종목 선택</h4>
                        <div className="space-y-1 max-h-[300px] overflow-y-auto pr-2">
                            {activeItems.map(item => (
                                <div key={item.id} className="flex items-center space-x-3 p-2 hover:bg-secondary rounded-md">
                                    <Checkbox id={`mp-${item.id}`} checked={item.isMeasurementWeek || false} onCheckedChange={(c) => onToggleItem(item, !!c)} />
                                    <label htmlFor={`mp-${item.id}`} className="text-sm font-medium leading-none cursor-pointer flex-1">{item.name}</label>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
                <DialogFooter><DialogClose asChild><Button variant="outline">닫기</Button></DialogClose><Button onClick={() => { onUpdate(periods); setIsOpen(false); }}>저장</Button></DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

function format(date: Date, formatStr: string) {
    const yyyy = date.getFullYear();
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const dd = String(date.getDate()).padStart(2, '0');
    return formatStr.replace('yyyy', String(yyyy)).replace('MM', mm).replace('dd', dd);
}
