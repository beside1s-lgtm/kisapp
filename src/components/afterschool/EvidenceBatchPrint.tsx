'use client';

/**
 * 방과후 강사료 증빙서류(출석부·강사출근부) 일괄 출력 — 강좌별로 A4 세로 쪽마다 이어서 출력
 *  - 결재 완료본(운영 결과 기안 별첨): 교감 결재까지 끝난 서류
 *  - 수기 결재용(manual): 결재 단계와 관계없이 지정한 서류, 부장·교감 서명 칸은 비움
 *  - autoPrint: 문서를 그리고 서명 이미지를 다 불러오면 바로 인쇄 창을 띄우고, 인쇄 창을 닫으면 onClose
 *    (방과후 관리자 화면의 [증빙 서류 출력] 버튼 — 새 페이지 없이 바로 인쇄)
 *  - 쪽 여백은 강사 출석부·출근부 출력과 같게 쪽 안에서 직접 잡는다 (@page 여백 0)
 */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Loader2, Printer, X } from 'lucide-react';
import { evidenceStage } from '@/lib/afterschool/evidenceApproval';
import { EvidenceDocViewer } from '@/components/afterschool/EvidenceDocViewer';
import { useEvidenceData } from '@/components/afterschool/useEvidenceData';

/*
 * 쪽(A4 210×297mm) 안에 강사 출석부·출근부 출력과 같은 여백을 직접 잡는다.
 *  - 출석부: 좌우 8mm (표 너비 194mm)   - 강사출근부: 좌우 14mm (표 너비 182mm)
 */
const SHEET_CSS = `
  .evidence-print-page {
    width: 210mm; height: 297mm; overflow: hidden; box-sizing: border-box;
    background: #ffffff; margin: 0 auto 8mm auto; box-shadow: 0 2px 10px rgba(15,23,42,.18);
  }
  .evidence-print-page.evidence-page-attendance { padding: 1mm 8mm 0 8mm !important; }
  .evidence-print-page.evidence-page-work {
    padding-left: 14mm !important; padding-right: 14mm !important; padding-bottom: 0 !important;
    border: none !important; border-radius: 0 !important;
  }
`;

const PRINT_CSS = `
  @media print {
    @page { size: A4 portrait; margin: 0; }
    html, body {
      margin: 0 !important; padding: 0 !important; height: auto !important; overflow: visible !important;
      background: #ffffff !important;
      -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important;
    }
    svg {
      -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important;
    }
    svg circle {
      stroke: #000000 !important;
    }
    body > *:not(.evidence-batch-root) { display: none !important; }
    .evidence-batch-root {
      position: static !important; overflow: visible !important; height: auto !important;
      background: #ffffff !important; padding: 0 !important;
    }
    .evidence-batch-toolbar, .no-print { display: none !important; }
    .evidence-batch-sheet { box-shadow: none !important; border: none !important; margin: 0 !important; padding: 0 !important; max-width: none !important; background: transparent !important; }
    .evidence-print-page {
      margin: 0 !important;
      break-before: page; page-break-before: always;
      break-inside: avoid; page-break-inside: avoid;
      box-shadow: none !important;
    }
    /* 첫 쪽 앞에는 빈 쪽을 만들지 않음 */
    .evidence-batch-sheet > .evidence-print-page:first-child,
    .evidence-batch-sheet > :first-child > .evidence-print-page:first-child {
      break-before: auto; page-break-before: auto;
    }
    table, tr { break-inside: avoid; page-break-inside: avoid; }
  }
`;

/** 쪽 안의 서명·도장 이미지를 다 불러올 때까지 (최대 8초) */
function waitForImages(root: HTMLElement | null, timeoutMs = 8000): Promise<void> {
  if (!root) return Promise.resolve();
  const pending = Array.from(root.querySelectorAll('img')).filter((img) => !img.complete);
  if (pending.length === 0) return Promise.resolve();
  return new Promise((resolve) => {
    let left = pending.length;
    const done = () => {
      left -= 1;
      if (left <= 0) resolve();
    };
    pending.forEach((img) => {
      img.addEventListener('load', done, { once: true });
      img.addEventListener('error', done, { once: true });
    });
    setTimeout(resolve, timeoutMs);
  });
}

export interface EvidenceBatchPrintProps {
  /** 출력할 증빙서류 id (결재 완료본은 비우면 전체) */
  ids?: string[];
  /** 수기 결재용: 결재 단계와 관계없이, 부장·교감 서명 없이 */
  manual?: boolean;
  /** 준비되면 바로 인쇄 창을 띄운다 */
  autoPrint?: boolean;
  /** 출력할 서류 종류 (기본: 출석부·강사출근부 모두) */
  kinds?: { attendance: boolean; work: boolean };
  /** 닫기 (autoPrint면 인쇄 창을 닫은 뒤 자동 호출) */
  onClose?: () => void;
}

export function EvidenceBatchPrint({ ids = [], manual = false, autoPrint = false, kinds, onClose }: EvidenceBatchPrintProps) {
  const idKey = ids.join(',');
  const idFilter = useMemo(() => new Set(ids.filter(Boolean)), [idKey]); // eslint-disable-line react-hooks/exhaustive-deps
  const {
    authLoading, access, courseById, docs, enrollments, attendanceRecords,
    substituteRecords, settings, holidayDates, sigBook, ready,
  } = useEvidenceData();
  const [mounted, setMounted] = useState(false);
  const [include, setInclude] = useState(() => kinds ?? { attendance: true, work: true });
  const [printing, setPrinting] = useState(autoPrint);
  const sheetRef = useRef<HTMLDivElement>(null);
  const printedRef = useRef(false);
  useEffect(() => setMounted(true), []);

  const targets = useMemo(
    () =>
      docs
        .filter((d) => courseById.has(d.courseId) && (manual ? d.status !== 'REJECTED' : evidenceStage(d) === 'APPROVED'))
        .filter((d) => (manual ? idFilter.has(d.id) : idFilter.size === 0 || idFilter.has(d.id)))
        .sort((a, b) => String(a.courseTitle || '').localeCompare(String(b.courseTitle || ''), 'ko')),
    [docs, courseById, idFilter, manual]
  );

  const kindLabel = include.attendance && include.work ? '출석부·출근부' : include.attendance ? '출석부' : '출근부';
  const fileTitle = `${settings?.year || ''}-${settings?.semester || ''}_방과후학교_강사료_증빙서류(${kindLabel})${manual ? '_수기결재용' : ''}`;
  const doPrint = () => {
    const prev = document.title;
    document.title = fileTitle;
    window.print();
    document.title = prev;
  };

  // 바로 인쇄: 데이터·서명 이미지가 준비되면 인쇄 창 → 인쇄 창을 닫으면 닫기
  const loaded = !authLoading && access !== null && (!access.canView || ready);
  useEffect(() => {
    if (!autoPrint || !mounted || !loaded || printedRef.current) return;
    printedRef.current = true;
    if (!access?.canView || targets.length === 0) {
      setPrinting(false);
      return;
    }
    let cancelled = false;
    (async () => {
      await new Promise((r) => setTimeout(r, 50));
      await waitForImages(sheetRef.current);
      await new Promise((r) => requestAnimationFrame(() => r(null)));
      if (cancelled) return;
      const finish = () => {
        window.removeEventListener('afterprint', finish);
        setPrinting(false);
        onClose?.();
      };
      window.addEventListener('afterprint', finish);
      doPrint();
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoPrint, mounted, loaded, targets.length]);

  if (!mounted) return null;

  if (!loaded) {
    return createPortal(
      <div className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-900/40">
        <div className="bg-white rounded-2xl shadow-xl px-6 py-4 flex items-center gap-3 text-sm font-bold text-slate-700">
          <Loader2 className="h-5 w-5 animate-spin text-indigo-600" /> 증빙서류를 불러오는 중...
        </div>
      </div>,
      document.body
    );
  }
  if (!access?.canView) {
    return createPortal(
      <div className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-900/40" onClick={onClose}>
        <div className="bg-white rounded-2xl shadow-xl px-6 py-4 text-sm text-slate-700">
          방과후 담당 부장·교감·교장·시스템 관리자만 출력할 수 있습니다.
        </div>
      </div>,
      document.body
    );
  }

  const pageCount = targets.length * ((include.attendance ? 1 : 0) + (include.work ? 1 : 0));

  return createPortal(
    <div className="evidence-batch-root fixed inset-0 z-[200] overflow-y-auto bg-slate-200">
      <style>{SHEET_CSS + PRINT_CSS}</style>
      <div className="evidence-batch-toolbar sticky top-0 z-10 bg-white border-b border-slate-200 px-4 py-3 flex flex-wrap items-center gap-3 shadow-sm">
        <div className="flex-1 min-w-[220px]">
          <div className="text-sm font-bold text-slate-900">
            {manual ? '방과후 강사료 증빙서류 출력 (수기 결재용 · 부장·교감 서명 없음)' : '방과후 강사료 증빙서류 일괄 출력 (별첨)'}
          </div>
          <div className="text-[11px] text-slate-500">
            {printing
              ? '인쇄 창을 여는 중입니다...'
              : `${manual ? '선택한' : '교감 결재 완료'} ${targets.length}개 강좌 · 약 ${pageCount}쪽 이상 (수강생 30명 초과 강좌의 출석부는 2쪽)`}
          </div>
        </div>
        <label className="flex items-center gap-1 text-xs font-bold text-slate-700">
          <input type="checkbox" checked={include.attendance} onChange={(e) => setInclude((p) => ({ ...p, attendance: e.target.checked }))} /> 출석부
        </label>
        <label className="flex items-center gap-1 text-xs font-bold text-slate-700">
          <input type="checkbox" checked={include.work} onChange={(e) => setInclude((p) => ({ ...p, work: e.target.checked }))} /> 강사출근부
        </label>
        <button
          type="button"
          disabled={targets.length === 0 || pageCount === 0}
          onClick={doPrint}
          className="bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 text-white font-bold text-xs px-4 py-2 rounded-xl flex items-center gap-1.5"
        >
          <Printer className="w-4 h-4" /> 인쇄 / PDF 저장
        </button>
        <button
          type="button"
          onClick={() => (onClose ? onClose() : window.close())}
          className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg border border-slate-200"
          title="닫기"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {targets.length === 0 ? (
        <div className="max-w-xl mx-auto mt-20 text-center text-sm text-slate-600 bg-white rounded-xl p-8">
          {manual ? '출력할 증빙서류가 없습니다. 증빙서류 결재 카드에서 서류를 선택해 주세요.' : '교감 결재가 완료된 증빙서류가 없습니다.'}
        </div>
      ) : (
        <div ref={sheetRef} className="evidence-batch-sheet mx-auto my-6">
          {targets.map((d) => {
            const c = courseById.get(d.courseId)!;
            const common = {
              course: c,
              approvalDoc: d,
              enrollments,
              attendanceRecords,
              substituteRecords,
              settings,
              holidayDates,
              sigBook,
              onClose: () => {},
              variant: 'page' as const,
              hideApprovalSignatures: manual,
              allDocs: docs,
              allCourses: Array.from(courseById.values()),
            };
            return (
              <React.Fragment key={d.id}>
                {include.attendance && <EvidenceDocViewer {...common} docType="ATTENDANCE" />}
                {include.work && <EvidenceDocViewer {...common} docType="WORK_REGISTER" />}
              </React.Fragment>
            );
          })}
        </div>
      )}
    </div>,
    document.body
  );
}
