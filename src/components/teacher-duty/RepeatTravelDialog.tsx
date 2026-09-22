'use client';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { CalendarDays, Users, Search } from 'lucide-react';

interface Traveler {
  name: string;
  email: string;
}

export function RepeatTravelDialog({
  isRepeatModalOpen,
  setIsRepeatModalOpen,
  repeatStartDate,
  setRepeatStartDate,
  repeatEndDate,
  setRepeatEndDate,
  selectedDays,
  setSelectedDays,
  repeatSubType,
  setRepeatSubType,
  repeatDestination,
  setRepeatDestination,
  repeatNoExpensesPaid,
  setRepeatNoExpensesPaid,
  repeatUseCompanyVehicle,
  setRepeatUseCompanyVehicle,
  repeatReason,
  setRepeatReason,
  selectedTravelers,
  setSelectedTravelers,
  searchKeyword,
  setSearchKeyword,
  users,
  profile,
  toggleTraveler,
  handleGenerateRepeatTravels,
}: {
  isRepeatModalOpen: boolean;
  setIsRepeatModalOpen: (open: boolean) => void;
  repeatStartDate: string;
  setRepeatStartDate: (val: string) => void;
  repeatEndDate: string;
  setRepeatEndDate: (val: string) => void;
  selectedDays: number[];
  setSelectedDays: (val: number[]) => void;
  repeatSubType: string;
  setRepeatSubType: (val: string) => void;
  repeatDestination: string;
  setRepeatDestination: (val: string) => void;
  repeatNoExpensesPaid: boolean;
  setRepeatNoExpensesPaid: (val: boolean) => void;
  repeatUseCompanyVehicle: boolean;
  setRepeatUseCompanyVehicle: (val: boolean) => void;
  repeatReason: string;
  setRepeatReason: (val: string) => void;
  selectedTravelers: Traveler[];
  setSelectedTravelers: (val: Traveler[]) => void;
  searchKeyword: string;
  setSearchKeyword: (val: string) => void;
  users: any[];
  profile: any;
  toggleTraveler: (targetUser: any) => void;
  handleGenerateRepeatTravels: () => void;
}) {
  return (
    <Dialog open={isRepeatModalOpen} onOpenChange={setIsRepeatModalOpen}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold flex items-center gap-2">
            <CalendarDays className="text-primary h-5 w-5" /> 요일 반복 및 동행자 일괄 설정
          </DialogTitle>
          <DialogDescription>
            지정된 기간 동안 선택하신 요일에 맞춰 일자별 출장 일정을 일괄 생성하고, 동행자를 함께 지정합니다.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 my-4">
          {/* 1. 기간 설정 */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="font-semibold text-xs">시작일</Label>
              <Input type="date" value={repeatStartDate} onChange={(e) => setRepeatStartDate(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label className="font-semibold text-xs">종료일</Label>
              <Input type="date" value={repeatEndDate} onChange={(e) => setRepeatEndDate(e.target.value)} />
            </div>
          </div>

          {/* 2. 반복 요일 선택 */}
          <div className="space-y-2">
            <Label className="font-semibold text-xs">반복 요일</Label>
            <div className="flex gap-2">
              {[
                { label: '일', value: 0 },
                { label: '월', value: 1 },
                { label: '화', value: 2 },
                { label: '수', value: 3 },
                { label: '목', value: 4 },
                { label: '금', value: 5 },
                { label: '토', value: 6 },
              ].map((d) => {
                const isSelected = selectedDays.includes(d.value);
                return (
                  <button
                    key={d.value}
                    type="button"
                    onClick={() => {
                      if (isSelected) {
                        setSelectedDays(selectedDays.filter(v => v !== d.value));
                      } else {
                        setSelectedDays([...selectedDays, d.value]);
                      }
                    }}
                    className={`flex-1 py-2 text-center rounded-lg border font-semibold text-sm transition-all ${
                      isSelected
                        ? 'bg-primary text-primary-foreground border-primary shadow-sm'
                        : 'bg-background hover:bg-muted text-muted-foreground'
                    }`}
                  >
                    {d.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* 3. 출장 세부 정보 */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="font-semibold text-xs">출장 구분</Label>
              <Select value={repeatSubType} onValueChange={setRepeatSubType}>
                <SelectTrigger>
                  <SelectValue placeholder="구분 선택" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="관내">관내</SelectItem>
                  <SelectItem value="관외">관외</SelectItem>
                  <SelectItem value="국외">국외</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="font-semibold text-xs">목적지</Label>
              <Input placeholder="목적지 입력" value={repeatDestination} onChange={(e) => setRepeatDestination(e.target.value)} />
            </div>
          </div>

          {/* 4. 옵션 선택 */}
          <div className="flex gap-6 border-y py-3">
            <label className="flex items-center gap-2 text-sm font-semibold cursor-pointer select-none">
              <Checkbox
                checked={repeatNoExpensesPaid}
                onCheckedChange={(checked) => setRepeatNoExpensesPaid(!!checked)}
              />
              여비 부지급
            </label>
            <label className="flex items-center gap-2 text-sm font-semibold cursor-pointer select-none">
              <Checkbox
                checked={repeatUseCompanyVehicle}
                onCheckedChange={(checked) => setRepeatUseCompanyVehicle(!!checked)}
              />
              관용차량 이용
            </label>
          </div>

          {/* 5. 사유 */}
          <div className="space-y-2">
            <Label className="font-semibold text-xs">출장 사유</Label>
            <Input placeholder="사유 입력" value={repeatReason} onChange={(e) => setRepeatReason(e.target.value)} />
          </div>

          {/* 6. 동행자 선택 */}
          <div className="space-y-3 pt-2">
            <Label className="font-semibold text-sm flex items-center gap-1.5">
              <Users size={16} className="text-primary" /> 동행자 지정
            </Label>

            {/* 선택된 동행자 표시 */}
            <div className="flex flex-wrap gap-1.5 min-h-[36px] p-2 border rounded-lg bg-muted/20">
              {selectedTravelers.length === 0 ? (
                <span className="text-xs text-muted-foreground self-center px-1">선택된 인원이 없습니다 (본인을 포함시켜 주세요).</span>
              ) : (
                selectedTravelers.map((tr) => (
                  <span key={tr.email} className="inline-flex items-center gap-1 bg-primary/10 text-primary text-xs font-bold px-2.5 py-1 rounded-full border border-primary/20">
                    {tr.name}
                    {profile?.email !== tr.email && (
                      <button
                        type="button"
                        onClick={() => setSelectedTravelers(selectedTravelers.filter(t => t.email !== tr.email))}
                        className="text-primary hover:text-destructive hover:scale-110 ml-1 text-sm font-bold transition-all"
                      >
                        &times;
                      </button>
                    )}
                  </span>
                ))
              )}
            </div>

            {/* 검색 및 검색 결과 */}
            <div className="space-y-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="교사 이름 또는 이메일 검색..."
                  value={searchKeyword}
                  onChange={(e) => setSearchKeyword(e.target.value)}
                  className="pl-9"
                />
              </div>

              <div className="border rounded-lg max-h-[160px] overflow-y-auto bg-white divide-y">
                {users.filter(u =>
                  u.name.toLowerCase().includes(searchKeyword.toLowerCase()) ||
                  u.email.toLowerCase().includes(searchKeyword.toLowerCase())
                ).map((u) => {
                  const isSelected = selectedTravelers.some(t => t.email === u.email);
                  return (
                    <div
                      key={u.uid}
                      onClick={() => toggleTraveler(u)}
                      className={`flex items-center justify-between p-2.5 text-xs cursor-pointer hover:bg-muted/50 transition-colors ${
                        isSelected ? 'bg-primary/5 font-semibold text-primary' : ''
                      }`}
                    >
                      <div>
                        <span className="font-bold text-sm">{u.name}</span>
                        <span className="text-muted-foreground ml-1.5">({u.role || '교사'})</span>
                        <span className="text-muted-foreground/60 ml-2 block sm:inline">{u.email}</span>
                      </div>
                      <Checkbox
                        checked={isSelected}
                        onCheckedChange={() => toggleTraveler(u)}
                      />
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => setIsRepeatModalOpen(false)}>
            취소
          </Button>
          <Button type="button" onClick={handleGenerateRepeatTravels}>
            일정 일괄 생성
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
