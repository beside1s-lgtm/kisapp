'use client';

import {
  ArrowDown,
  ArrowUp,
  ExternalLink,
  FileSpreadsheet,
  Link2,
  Loader2,
  Plus,
  RotateCcw,
  Save,
  Sparkles,
  Table,
  Trash2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import type { SystemTaskTemplate } from '@/lib/services/taskTemplateService';
import { COLUMN_PRESETS, type DraftColumnDef } from './create-department-task-dialog';

export type ExtendedTaskType = 'sheets_custom' | 'sheets_template' | 'html_draft';

/**
 * 업무 유형(taskType)이 sheets_custom / sheets_template / html_draft일 때
 * 표시되는 세부 설정 섹션 3종을 모아둔 컴포넌트.
 *
 * create-department-task-dialog.tsx의 {taskType === '...' && (...)} 블록
 * 3개를 그대로 옮긴 것으로, 상태와 컬럼/템플릿 편집 로직은 전부
 * 부모(CreateDepartmentTaskDialog)에 남아 있고 이 컴포넌트는 순수하게
 * 마크업만 담당한다 (동작 변경 없음).
 */
export interface TaskTypeConfigSectionProps {
  taskType: ExtendedTaskType | string;

  // 세부 옵션 A: 사용자 지정 URL
  customSheetUrl: string;
  setCustomSheetUrl: (value: string) => void;

  // 세부 옵션 B: 표준 프리셋 템플릿
  systemTemplates: SystemTaskTemplate[];
  selectedTemplateId: string;
  setSelectedTemplateId: (value: string) => void;
  templateColumns: DraftColumnDef[];
  isSavingTemplate: boolean;
  onSaveCurrentAsSchoolTemplate: () => void;
  onTemplateResetToOriginal: () => void;
  onTemplateClearColumns: () => void;
  onTemplateAddColumn: () => void;
  onTemplateMoveColumn: (index: number, direction: 'up' | 'down') => void;
  onTemplateUpdateColumn: (id: string, name: string) => void;
  onTemplateRemoveColumn: (id: string) => void;

  // 세부 옵션 C: 기안문 직행 HTML 표 컬럼 빌더
  draftColumns: DraftColumnDef[];
  onApplyPreset: (presetId: string) => void;
  onClearColumns: () => void;
  onAddColumn: () => void;
  onMoveColumn: (index: number, direction: 'up' | 'down') => void;
  onUpdateColumn: (id: string, field: 'name' | 'guide', val: string) => void;
  onRemoveColumn: (id: string) => void;
}

export function TaskTypeConfigSection({
  taskType,
  customSheetUrl,
  setCustomSheetUrl,
  systemTemplates,
  selectedTemplateId,
  setSelectedTemplateId,
  templateColumns,
  isSavingTemplate,
  onSaveCurrentAsSchoolTemplate,
  onTemplateResetToOriginal,
  onTemplateClearColumns,
  onTemplateAddColumn,
  onTemplateMoveColumn,
  onTemplateUpdateColumn,
  onTemplateRemoveColumn,
  draftColumns,
  onApplyPreset,
  onClearColumns,
  onAddColumn,
  onMoveColumn,
  onUpdateColumn,
  onRemoveColumn,
}: TaskTypeConfigSectionProps) {
  return (
    <>
      {/* ── 세부 옵션 A: 사용자 지정 Google Sheets / Docs / Slides / Forms URL 입력창 ── */}
      {taskType === 'sheets_custom' && (
        <div className="p-3.5 bg-emerald-50/80 border border-emerald-200 rounded-xl space-y-2">
          <div className="flex items-center justify-between flex-wrap gap-1">
            <Label className="text-xs font-bold text-emerald-900 flex items-center gap-1.5">
              <Link2 className="w-3.5 h-3.5 text-emerald-600" />
              Google 시트 / 문서 / 슬라이드 / 설문지(Forms) 웹 URL *
            </Label>
            <div className="flex items-center gap-2 text-[11px]">
              <a
                href="https://forms.new"
                target="_blank"
                rel="noreferrer"
                className="text-purple-700 hover:underline flex items-center gap-0.5 font-semibold"
              >
                새 설문지 <ExternalLink className="w-2.5 h-2.5" />
              </a>
              <span className="text-emerald-300">|</span>
              <a
                href="https://sheets.new"
                target="_blank"
                rel="noreferrer"
                className="text-emerald-700 hover:underline flex items-center gap-0.5 font-semibold"
              >
                새 시트 <ExternalLink className="w-2.5 h-2.5" />
              </a>
            </div>
          </div>
          <Input
            placeholder="https://docs.google.com/forms/..., spreadsheets/..., document/... 등"
            value={customSheetUrl}
            onChange={(e) => setCustomSheetUrl(e.target.value)}
            className="h-9 text-xs rounded-xl bg-white border-emerald-300 font-mono"
            required
          />
          <p className="text-[11px] text-emerald-700">
            * 구글 스프레드시트, 구글 문서, 프레젠테이션, 또는 구글 설문지(Google Forms) 공유 링크를 등록하세요. (학교 계정: <strong>@kshcm.net</strong>)
          </p>
        </div>
      )}

      {/* ── 세부 옵션 B: 표준 프리셋 템플릿 선택 및 컬럼 편집창 ── */}
      {taskType === 'sheets_template' && (
        <div className="p-4 bg-emerald-50/90 border border-emerald-200 rounded-xl space-y-3.5 shadow-2xs">
          {/* 상단 템플릿 선택 및 저장 바 */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-emerald-200/80 pb-2.5">
            <div className="flex-1 min-w-0">
              <Label className="text-xs font-black text-emerald-950 flex items-center gap-1.5">
                <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                제공할 표준 프리셋 템플릿 선택 *
              </Label>
              <p className="text-[11px] text-emerald-800 mt-0.5">
                선택한 템플릿의 컬럼명을 직접 바꾸거나, 필요한 항목을 추가/삭제하여 업무를 배포할 수 있습니다.
              </p>
            </div>
            {/* 관리자: 현재 수정한 템플릿을 학교 표준 템플릿으로 영구 저장 */}
            <Button
              type="button"
              size="sm"
              onClick={onSaveCurrentAsSchoolTemplate}
              disabled={isSavingTemplate}
              className="h-7 px-2.5 text-xs font-bold bg-emerald-700 hover:bg-emerald-800 text-white shadow-2xs shrink-0 flex items-center gap-1 cursor-pointer"
              title="수정한 컬럼 구성을 학교 표준 템플릿으로 영구 저장합니다."
            >
              {isSavingTemplate ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <Save className="w-3 h-3 mr-1" />}
              <span>학교 표준 템플릿으로 저장</span>
            </Button>
          </div>

          {/* 템플릿 드롭다운 선택 */}
          <div className="space-y-1">
            <Select value={selectedTemplateId} onValueChange={setSelectedTemplateId}>
              <SelectTrigger className="h-9 text-xs rounded-xl bg-white border-emerald-300 font-bold text-slate-800 shadow-2xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="max-h-60">
                {systemTemplates.map(t => (
                  <SelectItem key={t.id} value={t.id} className="text-xs font-medium">
                    <div className="flex items-center gap-2">
                      <span>{t.name}</span>
                      {t.isCustom && (
                        <Badge variant="outline" className="text-[9px] bg-emerald-100 text-emerald-800 font-bold px-1 py-0 h-4">
                          학교 맞춤형
                        </Badge>
                      )}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {(() => {
              const t = systemTemplates.find(tpl => tpl.id === selectedTemplateId);
              return t?.desc ? <p className="text-[11px] text-emerald-700 px-1">{t.desc}</p> : null;
            })()}
          </div>

          {/* 템플릿 컬럼 편집 섹션 */}
          <div className="space-y-2 pt-1">
            <div className="flex items-center justify-between flex-wrap gap-1">
              <span className="text-[11px] font-bold text-emerald-950 flex items-center gap-1">
                <span>선택된 템플릿 컬럼 구성 ({templateColumns.length}개 항목)</span>
                <Badge variant="outline" className="text-[9px] bg-white text-emerald-700 border-emerald-200">
                  자유 편집 가능
                </Badge>
              </span>

              <div className="flex items-center gap-1.5">
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={onTemplateResetToOriginal}
                  className="h-6 px-1.5 text-xs text-emerald-800 hover:bg-emerald-100/70 flex items-center gap-1 cursor-pointer"
                  title="템플릿 초기 기본 컬럼으로 복원"
                >
                  <RotateCcw className="w-3 h-3 text-emerald-600" />
                  <span>원본 복원</span>
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={onTemplateClearColumns}
                  className="h-6 px-1.5 text-xs text-slate-500 hover:text-rose-600 hover:bg-rose-50 flex items-center gap-1 cursor-pointer"
                >
                  <Trash2 className="w-3 h-3 text-slate-400" />
                  <span>내용 비우기</span>
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={onTemplateAddColumn}
                  className="h-6 px-2 text-xs font-bold text-emerald-800 bg-white border-emerald-300 hover:bg-emerald-100 flex items-center gap-1 shadow-2xs cursor-pointer"
                >
                  <Plus className="w-3 h-3" />
                  <span>항목 추가</span>
                </Button>
              </div>
            </div>

            {/* 컬럼 개별 입력 및 수정 리스트 */}
            <div className="space-y-1.5 max-h-[220px] overflow-y-auto pr-1">
              {templateColumns.map((col, index) => (
                <div
                  key={col.id}
                  className="flex items-center gap-2 p-2 bg-white rounded-xl border border-emerald-200 shadow-2xs"
                >
                  {/* 순서 뱃지 & 위/아래 이동 */}
                  <div className="flex items-center gap-1 shrink-0">
                    <span className="w-10 text-center py-0.5 text-[10px] font-bold bg-emerald-100 text-emerald-800 rounded-md">
                      열 {index + 1}
                    </span>
                    <div className="flex flex-col">
                      <button
                        type="button"
                        disabled={index === 0}
                        onClick={() => onTemplateMoveColumn(index, 'up')}
                        className="text-slate-400 hover:text-emerald-700 disabled:opacity-20 p-0.5 cursor-pointer"
                        title="위로 이동"
                      >
                        <ArrowUp className="w-2.5 h-2.5" />
                      </button>
                      <button
                        type="button"
                        disabled={index === templateColumns.length - 1}
                        onClick={() => onTemplateMoveColumn(index, 'down')}
                        className="text-slate-400 hover:text-emerald-700 disabled:opacity-20 p-0.5 cursor-pointer"
                        title="아래로 이동"
                      >
                        <ArrowDown className="w-2.5 h-2.5" />
                      </button>
                    </div>
                  </div>

                  {/* 컬럼 이름(항목명) 입력 및 수정칸 */}
                  <div className="flex-1 min-w-[150px]">
                    <Input
                      value={col.name}
                      onChange={(e) => onTemplateUpdateColumn(col.id, e.target.value)}
                      placeholder={`열 ${index + 1} 이름 (예: 프로그램명, 장소 등)`}
                      className="h-8 text-xs font-bold bg-slate-50/50 border-emerald-300 focus:border-emerald-500"
                      required
                    />
                  </div>

                  {/* 삭제 버튼 */}
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => onTemplateRemoveColumn(col.id)}
                    className="h-7 w-7 p-0 text-slate-400 hover:text-rose-600 hover:bg-rose-50 shrink-0 cursor-pointer"
                    title="컬럼 삭제"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              ))}
            </div>

            {/* 실시간 템플릿 컬럼 뱃지 미리보기 */}
            <div className="pt-1 border-t border-emerald-200/60 flex items-center gap-1.5 flex-wrap">
              <span className="text-[10.5px] font-bold text-emerald-900">배포될 컬럼 미리보기:</span>
              {templateColumns.map((col, idx) => (
                <span key={col.id || idx} className="px-2 py-0.5 text-[10px] bg-white border border-emerald-300 rounded-md text-emerald-900 font-bold shadow-2xs">
                  {col.name || `(열 ${idx + 1})`}
                </span>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── 세부 옵션 C: 기안문 직행 HTML 표 컬럼 스마트 빌더 (개별 입력칸 지원) ── */}
      {taskType === 'html_draft' && (
        <div className="p-4 bg-indigo-50/90 border border-indigo-200 rounded-xl space-y-3.5 shadow-2xs">
          {/* 상단 안내 & 템플릿 프리셋 선택 */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-indigo-200/80 pb-2.5">
            <div>
              <Label className="text-xs font-black text-indigo-950 flex items-center gap-1.5">
                <Table className="w-4 h-4 text-indigo-600" />
                취합 및 공문서 표 컬럼(항목) 개별 구성
              </Label>
              <p className="text-[11px] text-indigo-800 mt-0.5">
                각 열의 이름과, 교사가 무엇을 적어야 하는지 입력 안내(예시)를 명확하게 지정할 수 있습니다.
              </p>
            </div>
            {/* 프리셋 버튼 그룹 */}
            <div className="flex items-center gap-1 flex-wrap">
              <span className="text-[10px] text-indigo-700 font-bold whitespace-nowrap">추천 양식:</span>
              {COLUMN_PRESETS.map(preset => (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => onApplyPreset(preset.id)}
                  className="px-2 py-0.5 text-[10.5px] bg-white hover:bg-indigo-100/80 text-indigo-800 border border-indigo-200 rounded-lg font-bold transition shadow-2xs cursor-pointer"
                >
                  {preset.title}
                </button>
              ))}
            </div>
          </div>

          {/* 개별 컬럼 입력 리스트 */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-700">
                표 항목 목록 ({draftColumns.length}개 컬럼)
              </span>
              <div className="flex items-center gap-1.5">
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={onClearColumns}
                  className="h-6 px-2 text-xs font-semibold text-slate-500 hover:text-rose-600 hover:bg-rose-50 flex items-center gap-1 cursor-pointer"
                >
                  <Trash2 className="w-3 h-3 text-slate-400" />
                  <span>내용 비우기</span>
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={onAddColumn}
                  className="h-6 px-2.5 text-xs font-bold text-indigo-700 bg-white border-indigo-300 hover:bg-indigo-100 flex items-center gap-1 shadow-2xs cursor-pointer"
                >
                  <Plus className="w-3 h-3" />
                  <span>항목 추가</span>
                </Button>
              </div>
            </div>

            <div className="space-y-1.5 max-h-[260px] overflow-y-auto pr-1">
              {draftColumns.map((col, index) => (
                <div
                  key={col.id}
                  className="flex items-center gap-2 p-2 bg-white rounded-xl border border-indigo-200/90 shadow-2xs"
                >
                  {/* 순서 및 뱃지 */}
                  <div className="flex items-center gap-1 shrink-0">
                    <span className="w-10 text-center py-0.5 text-[10px] font-bold bg-indigo-100 text-indigo-800 rounded-md">
                      열 {index + 1}
                    </span>
                    <div className="flex flex-col">
                      <button
                        type="button"
                        disabled={index === 0}
                        onClick={() => onMoveColumn(index, 'up')}
                        className="text-slate-400 hover:text-indigo-600 disabled:opacity-20 p-0.5 cursor-pointer"
                        title="위로 이동"
                      >
                        <ArrowUp className="w-2.5 h-2.5" />
                      </button>
                      <button
                        type="button"
                        disabled={index === draftColumns.length - 1}
                        onClick={() => onMoveColumn(index, 'down')}
                        className="text-slate-400 hover:text-indigo-600 disabled:opacity-20 p-0.5 cursor-pointer"
                        title="아래로 이동"
                      >
                        <ArrowDown className="w-2.5 h-2.5" />
                      </button>
                    </div>
                  </div>

                  {/* 컬럼 이름(항목명) 입력칸 */}
                  <div className="w-1/3 min-w-[120px]">
                    <Input
                      value={col.name}
                      onChange={(e) => onUpdateColumn(col.id, 'name', e.target.value)}
                      placeholder="열 이름 (예: 프로그램명)"
                      className="h-8 text-xs font-bold bg-slate-50/50 border-slate-300"
                      required
                    />
                  </div>

                  {/* 어디다 어떤 정보 적어야 하는지 안내/예시 입력칸 */}
                  <div className="flex-1 min-w-[150px]">
                    <Input
                      value={col.guide}
                      onChange={(e) => onUpdateColumn(col.id, 'guide', e.target.value)}
                      placeholder="어디에 어떤 내용 입력할지 예시 안내 (예: 볼풀공 던지기 / 릴레이)"
                      className="h-8 text-xs bg-slate-50/50 border-slate-300"
                    />
                  </div>

                  {/* 삭제 버튼 */}
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => onRemoveColumn(col.id)}
                    className="h-7 w-7 p-0 text-slate-400 hover:text-rose-600 hover:bg-rose-50 shrink-0 cursor-pointer"
                    title="컬럼 삭제"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              ))}
            </div>
          </div>

          {/* 실시간 표 미리보기 */}
          <div className="space-y-1.5 pt-1">
            <div className="flex items-center justify-between">
              <Label className="text-[11px] font-bold text-indigo-900 flex items-center gap-1">
                <Sparkles className="w-3 h-3 text-indigo-600" />
                실시간 표 렌더링 미리보기 (작성 교사가 보게 될 양식)
              </Label>
              <span className="text-[10px] text-slate-500">하단 연한 회색 글씨는 입력 예시 안내입니다.</span>
            </div>
            <div className="border border-indigo-200 rounded-xl overflow-x-auto bg-white shadow-2xs">
              <table className="w-full text-xs text-left border-collapse">
                <thead>
                  <tr className="bg-indigo-100/60 border-b border-indigo-200">
                    {draftColumns.map((col, idx) => (
                      <th key={col.id || idx} className="p-2 font-bold text-indigo-950 border-r border-indigo-200 last:border-r-0 whitespace-nowrap">
                        {col.name || `열 ${idx + 1}`}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  <tr className="bg-white">
                    {draftColumns.map((col, idx) => (
                      <td key={col.id || idx} className="p-2 text-slate-400 italic text-[11px] border-r border-indigo-100 last:border-r-0">
                        {col.guide || '내용 입력칸'}
                      </td>
                    ))}
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
