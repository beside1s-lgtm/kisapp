'use client';

import React, { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ExternalLink, Folder, FolderOpen, Loader2, X } from 'lucide-react';
import {
  REGISTRY_DEPT_ALL,
  REGISTRY_FOLDER_ALL,
  type RegistryDeptGroup,
  type RegistryFolderSummary,
} from '@/lib/drive/registryFolderUtils';

interface RegistryFolderBrowserProps {
  totalDocsCount: number;
  deptGroups: RegistryDeptGroup[];
  folderItems: RegistryFolderSummary[];
  selectedDeptName: string;
  selectedFolderKey: string;
  onSelectDept: (deptName: string) => void;
  onSelectFolder: (folderKey: string, deptName?: string) => void;
  isLoadingAllDocs?: boolean;
  hasMoreDocs?: boolean;
  onLoadAllDocs?: () => void;
}

/**
 * 문서등록대장 상단의 편철 폴더별 문서함 탐색/필터 바.
 * 부서별 폴더 그룹 및 개별 편철 문서함 칩, Google Drive 폴더 바로가기를 제공한다.
 */
export function RegistryFolderBrowser({
  totalDocsCount,
  deptGroups,
  folderItems,
  selectedDeptName,
  selectedFolderKey,
  onSelectDept,
  onSelectFolder,
  isLoadingAllDocs = false,
  hasMoreDocs = false,
  onLoadAllDocs,
}: RegistryFolderBrowserProps) {
  const [showEmptyFolders, setShowEmptyFolders] = useState(false);

  const activeFolderObj = useMemo(
    () => folderItems.find((f) => f.folderKey === selectedFolderKey) || null,
    [folderItems, selectedFolderKey]
  );

  const visibleFolders = useMemo(() => {
    const base =
      selectedDeptName !== REGISTRY_DEPT_ALL
        ? deptGroups.find((g) => g.deptName === selectedDeptName)?.folders || []
        : folderItems;

    if (showEmptyFolders || selectedDeptName !== REGISTRY_DEPT_ALL) {
      return base;
    }
    const nonEmpty = base.filter((f) => f.count > 0 || f.folderKey === selectedFolderKey);
    return nonEmpty.length > 0 ? nonEmpty : base;
  }, [deptGroups, folderItems, selectedDeptName, selectedFolderKey, showEmptyFolders]);

  const hiddenEmptyCount = useMemo(() => {
    if (selectedDeptName !== REGISTRY_DEPT_ALL || showEmptyFolders) return 0;
    return folderItems.filter((f) => f.count === 0 && f.folderKey !== selectedFolderKey).length;
  }, [folderItems, selectedDeptName, selectedFolderKey, showEmptyFolders]);

  const isFilteringFolder =
    selectedDeptName !== REGISTRY_DEPT_ALL || selectedFolderKey !== REGISTRY_FOLDER_ALL;

  return (
    <div className="bg-slate-50/80 border border-slate-200 rounded-xl p-3.5 sm:p-4 space-y-3 shadow-2xs w-full overflow-x-hidden">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <FolderOpen className="h-4 w-4 text-indigo-600 shrink-0" />
          <span className="font-bold text-xs sm:text-sm text-slate-800">
            편철 폴더(문서함)별 조회
          </span>
          {isLoadingAllDocs && (
            <span className="inline-flex items-center gap-1 text-[11px] font-medium text-indigo-700 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded-full">
              <Loader2 className="w-3 h-3 animate-spin" />
              <span>전체 편철 문서 불러오는 중...</span>
            </span>
          )}
        </div>

        <div className="flex items-center gap-1.5 flex-wrap">
          {hasMoreDocs && !isLoadingAllDocs && onLoadAllDocs && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onLoadAllDocs}
              className="h-7 px-2.5 text-[11px] font-semibold bg-white border-slate-300 text-slate-700 hover:bg-slate-100"
            >
              미로드 문서 포함 전체 불러오기
            </Button>
          )}

          {activeFolderObj?.folderUrl && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => window.open(activeFolderObj.folderUrl, '_blank')}
              className="h-7 px-2.5 text-[11px] font-bold bg-white border-indigo-300 text-indigo-700 hover:bg-indigo-50 gap-1"
            >
              <ExternalLink className="w-3 h-3" />
              <span>Drive 폴더 열기</span>
            </Button>
          )}

          {isFilteringFolder && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                onSelectDept(REGISTRY_DEPT_ALL);
                onSelectFolder(REGISTRY_FOLDER_ALL, REGISTRY_DEPT_ALL);
              }}
              className="h-7 px-2 text-[11px] font-semibold text-slate-600 hover:text-slate-900 gap-1"
            >
              <X className="w-3 h-3" />
              <span>폴더 필터 해제</span>
            </Button>
          )}
        </div>
      </div>

      {/* 1단: 부서(폴더 그룹) 선택 칩 */}
      <div className="flex flex-wrap items-center gap-1.5">
        <button
          type="button"
          onClick={() => {
            onSelectDept(REGISTRY_DEPT_ALL);
            onSelectFolder(REGISTRY_FOLDER_ALL, REGISTRY_DEPT_ALL);
          }}
          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold border transition-colors cursor-pointer ${
            selectedDeptName === REGISTRY_DEPT_ALL && selectedFolderKey === REGISTRY_FOLDER_ALL
              ? 'bg-indigo-600 text-white border-indigo-600 shadow-2xs'
              : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
          }`}
        >
          <span>전체</span>
          <Badge
            variant="secondary"
            className={`px-1.5 py-0 text-[10px] font-bold ${
              selectedDeptName === REGISTRY_DEPT_ALL && selectedFolderKey === REGISTRY_FOLDER_ALL
                ? 'bg-indigo-500 text-white'
                : 'bg-slate-100 text-slate-700'
            }`}
          >
            {totalDocsCount}
          </Badge>
        </button>

        {deptGroups.map((group) => {
          const isActiveDept =
            selectedDeptName === group.deptName && selectedFolderKey === REGISTRY_FOLDER_ALL;
          const isChildSelected =
            selectedFolderKey !== REGISTRY_FOLDER_ALL &&
            activeFolderObj?.deptName === group.deptName;

          return (
            <button
              key={group.deptName}
              type="button"
              onClick={() => {
                onSelectDept(group.deptName);
                onSelectFolder(REGISTRY_FOLDER_ALL, group.deptName);
              }}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold border transition-colors cursor-pointer ${
                isActiveDept
                  ? 'bg-indigo-600 text-white border-indigo-600 shadow-2xs'
                  : isChildSelected
                    ? 'bg-indigo-50 text-indigo-800 border-indigo-300'
                    : group.totalCount > 0
                      ? 'bg-white text-slate-800 border-slate-200 hover:border-indigo-300 hover:bg-indigo-50/40'
                      : 'bg-white/60 text-slate-400 border-slate-200/80 hover:text-slate-700'
              }`}
            >
              <span>{group.deptName}</span>
              <span
                className={`text-[10px] font-bold px-1.5 rounded-full ${
                  isActiveDept
                    ? 'bg-indigo-500 text-white'
                    : group.totalCount > 0
                      ? 'bg-slate-100 text-slate-700'
                      : 'bg-slate-100/70 text-slate-400'
                }`}
              >
                {group.totalCount}
              </span>
            </button>
          );
        })}
      </div>

      {/* 2단: 세부 편철 폴더 목록 */}
      {visibleFolders.length > 0 && (
        <div className="pt-2 border-t border-slate-200/80 flex flex-wrap items-center gap-1.5">
          {visibleFolders.map((folder) => {
            const isSelected = selectedFolderKey === folder.folderKey;
            const displayLabel =
              selectedDeptName !== REGISTRY_DEPT_ALL ? folder.folderName : folder.label;

            return (
              <button
                key={folder.folderKey}
                type="button"
                onClick={() =>
                  onSelectFolder(
                    isSelected ? REGISTRY_FOLDER_ALL : folder.folderKey,
                    folder.deptName
                  )
                }
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-semibold border transition-all cursor-pointer ${
                  isSelected
                    ? 'bg-slate-900 text-white border-slate-900 shadow-2xs'
                    : folder.count > 0
                      ? 'bg-white text-slate-700 border-slate-300 hover:border-indigo-400 hover:text-indigo-800'
                      : 'bg-white/50 text-slate-400 border-slate-200 hover:text-slate-600'
                }`}
                title={`${folder.label} (${folder.count}건)`}
              >
                <Folder
                  className={`w-3 h-3 shrink-0 ${
                    isSelected
                      ? 'text-amber-300'
                      : folder.count > 0
                        ? 'text-amber-500'
                        : 'text-slate-300'
                  }`}
                />
                <span className="truncate max-w-[220px]">{displayLabel}</span>
                <span
                  className={`text-[10px] font-bold px-1 rounded ${
                    isSelected
                      ? 'bg-slate-700 text-white'
                      : folder.count > 0
                        ? 'bg-indigo-50 text-indigo-700'
                        : 'text-slate-400'
                  }`}
                >
                  {folder.count}
                </span>
              </button>
            );
          })}

          {hiddenEmptyCount > 0 && (
            <button
              type="button"
              onClick={() => setShowEmptyFolders(true)}
              className="text-[11px] font-medium text-slate-500 hover:text-indigo-700 underline underline-offset-2 px-1.5 py-0.5 cursor-pointer"
            >
              문서 없는 폴더 {hiddenEmptyCount}개 더 보기
            </button>
          )}
          {showEmptyFolders && selectedDeptName === REGISTRY_DEPT_ALL && (
            <button
              type="button"
              onClick={() => setShowEmptyFolders(false)}
              className="text-[11px] font-medium text-slate-500 hover:text-indigo-700 underline underline-offset-2 px-1.5 py-0.5 cursor-pointer"
            >
              빈 폴더 숨기기
            </button>
          )}
        </div>
      )}
    </div>
  );
}
