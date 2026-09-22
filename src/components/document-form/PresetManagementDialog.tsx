'use client';

import { Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';

interface ApprovalPreset {
  id?: string;
  name: string;
  type: 'personal' | 'department';
  departmentId?: string;
  departmentName?: string;
}

interface DepartmentOption {
  id: string;
  name: string;
  headEmail?: string;
}

/**
 * "결재선 프리셋 관리" 다이얼로그.
 *
 * document-form.tsx의 Dialog(isPresetDialogOpen) 블록을 그대로 옮긴
 * 것으로, 프리셋 상태와 저장/삭제 로직은 전부 부모(document-form.tsx)에
 * 남아 있고 이 컴포넌트는 순수하게 마크업만 담당한다 (동작 변경 없음).
 */
export interface PresetManagementDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;

  newPresetName: string;
  setNewPresetName: (value: string) => void;
  newPresetType: 'personal' | 'department';
  setNewPresetType: (value: 'personal' | 'department') => void;
  canSaveDeptPreset: boolean;
  selectedDeptIdForPreset: string;
  setSelectedDeptIdForPreset: (value: string) => void;
  isAdmin?: boolean;
  allDepartments: DepartmentOption[];
  leadDepartments: DepartmentOption[];
  onSavePreset: () => void;

  presets: ApprovalPreset[];
  myDepartments: DepartmentOption[];
  currentUserEmail?: string;
  onDeletePreset: (presetId: string) => void;
}

export function PresetManagementDialog({
  open,
  onOpenChange,
  newPresetName,
  setNewPresetName,
  newPresetType,
  setNewPresetType,
  canSaveDeptPreset,
  selectedDeptIdForPreset,
  setSelectedDeptIdForPreset,
  isAdmin,
  allDepartments,
  leadDepartments,
  onSavePreset,
  presets,
  myDepartments,
  currentUserEmail,
  onDeletePreset,
}: PresetManagementDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>결재선 프리셋 관리</DialogTitle>
          <DialogDescription>
            자주 사용하는 결재선을 프리셋으로 저장하여 빠르게 기안할 수 있습니다.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* 새 프리셋 저장 섹션 */}
          <div className="space-y-3 border-b pb-4">
            <h4 className="text-sm font-bold">현재 결재선을 프리셋으로 저장</h4>

            <div className="space-y-2">
              <Label htmlFor="preset-name">프리셋 이름</Label>
              <Input
                id="preset-name"
                placeholder="예: 교무부 복무 결재선, 내 기안 결재선"
                value={newPresetName}
                onChange={(e) => setNewPresetName(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label>프리셋 종류</Label>
              <RadioGroup
                value={newPresetType}
                onValueChange={(val: any) => setNewPresetType(val)}
                className="flex gap-4 pt-1"
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="personal" id="type-personal" />
                  <Label htmlFor="type-personal" className="cursor-pointer">개인 프리셋</Label>
                </div>
                {canSaveDeptPreset && (
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="department" id="type-department" />
                    <Label htmlFor="type-department" className="cursor-pointer">부서 프리셋</Label>
                  </div>
                )}
              </RadioGroup>
            </div>

            {newPresetType === 'department' && (
              <div className="space-y-2 animate-in fade-in duration-200">
                <Label htmlFor="preset-dept-select">대상 부서</Label>
                <Select
                  value={selectedDeptIdForPreset}
                  onValueChange={setSelectedDeptIdForPreset}
                >
                  <SelectTrigger id="preset-dept-select">
                    <SelectValue placeholder="부서 선택" />
                  </SelectTrigger>
                  <SelectContent>
                    {isAdmin ? (
                      allDepartments.map(d => (
                        <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                      ))
                    ) : (
                      leadDepartments.map(d => (
                        <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
                <p className="text-[10px] text-muted-foreground">
                  * 부서 공통 프리셋은 해당 부서원 모두가 기안 시 조회하고 적용할 수 있습니다.
                </p>
              </div>
            )}

            <Button
              type="button"
              onClick={onSavePreset}
              className="w-full mt-2"
              size="sm"
            >
              현재 결재선 추가
            </Button>
          </div>

          {/* 저장된 프리셋 목록 섹션 */}
          <div className="space-y-3">
            <h4 className="text-sm font-bold">저장된 프리셋 목록</h4>
            <div className="max-h-[200px] overflow-y-auto space-y-2 border rounded-md p-2 bg-muted/20">
              {presets.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-6">저장된 프리셋이 없습니다.</p>
              ) : (
                presets.map((preset) => {
                  const isPersonal = preset.type === 'personal';
                  const isMyDept = myDepartments.some(d => d.id === preset.departmentId);

                  const canDelete = isPersonal ||
                    isAdmin ||
                    myDepartments.some(d => d.id === preset.departmentId && d.headEmail?.trim().toLowerCase() === currentUserEmail?.trim().toLowerCase());

                  return (
                    <div
                      key={preset.id}
                      className="flex items-center justify-between p-2.5 rounded-lg border bg-background shadow-sm text-xs"
                    >
                      <div className="flex flex-col gap-1 min-w-0 pr-2">
                        <span className="font-semibold text-foreground truncate">{preset.name}</span>
                        <span className="text-[10px] text-muted-foreground">
                          {isPersonal ? (
                            <span className="text-indigo-600 font-medium">개인 프리셋</span>
                          ) : (
                            <span className="text-emerald-600 font-medium">
                              부서 공통 ({preset.departmentName}) {isMyDept && '• 내 소속'}
                            </span>
                          )}
                        </span>
                      </div>

                      {canDelete && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => onDeletePreset(preset.id!)}
                          className="h-7 w-7 text-destructive hover:bg-destructive/10 shrink-0"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            닫기
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
