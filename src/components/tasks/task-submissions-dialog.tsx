'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import type { DepartmentTask, TaskSubmission, TaskScenarioItem } from '@/lib/types';
import { 
  deleteDepartmentTask, 
  updateDepartmentTaskStatus,
  deleteDepartmentTaskSubmission,
  updateDepartmentTaskSubmission
} from '@/lib/services/departmentTaskService';
import { getPeEvents } from '@/lib/services/peService';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { 
  Users, 
  Download, 
  CheckCircle2, 
  Clock, 
  Calendar, 
  FileText, 
  Trash2, 
  ExternalLink,
  Lock,
  MessageSquare,
  Link as LinkIcon,
  Edit,
  Save,
  Plus,
  X,
  Loader2,
  Paperclip,
  HardDrive,
  Folder,
  Presentation
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { v4 as uuidv4 } from 'uuid';
import { getDriveTypeInfo } from '@/lib/services/googleDriveService';

interface TaskSubmissionsDialogProps {
  task: DepartmentTask | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onTaskDeleted?: () => void;
}

export function TaskSubmissionsDialog({
  task,
  open,
  onOpenChange,
  onTaskDeleted
}: TaskSubmissionsDialogProps) {
  const { toast } = useToast();

  const router = useRouter();
  const [isDrafting, setIsDrafting] = useState(false);

  // 로컬 제출 데이터 상태 (삭제 및 수정 시 즉각 UI 반영)
  const [localSubmissions, setLocalSubmissions] = useState<Record<string, TaskSubmission>>({});
  
  // 제출물 수정 모달 상태
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [editGrade, setEditGrade] = useState('');
  const [editNote, setEditNote] = useState('');
  const [editLinkUrl, setEditLinkUrl] = useState('');
  const [editLinkTitle, setEditLinkTitle] = useState('');
  const [editScenarios, setEditScenarios] = useState<TaskScenarioItem[]>([]);
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  useEffect(() => {
    if (task && open) {
      setLocalSubmissions(task.submissions || {});
      setEditingKey(null);
    }
  }, [task, open]);

  // ── 전자결재 기안문 상신 연동 (체육 행사/일반 부서 업무 통합 지원) ──
  const handleSendApprovalDraft = async () => {
    if (!task) return;
    setIsDrafting(true);
    try {
      // 1. 연결된 체육 행사 정보 조회 (있는 경우)
      let matchedEvent: any = null;
      try {
        const peEvents = await getPeEvents('KISH');
        matchedEvent = peEvents.find((e: any) => e.linkedTaskId === task.id || (e.title && task.title.includes(e.title)));
      } catch (err) {
        console.error('Failed to load matched PE event:', err);
      }

      const eventTitle = matchedEvent?.title || task.title.replace(/^\[업무요청\]\s*/, '').replace(/\s*학년별\s*세부계획\s*제출$/, '');
      const draftTitle = `[계획] ${eventTitle}`;
      const startDate = matchedEvent?.startDate || task.deadline || '';
      const endDate = matchedEvent?.endDate || task.deadline || '';
      const location = matchedEvent?.location || '학교 대운동장 및 메인 체육관';
      const manager = matchedEvent?.manager || task.creatorName || '체육교사';
      const totalBudgetFormatted = matchedEvent?.totalBudget ? Number(matchedEvent.totalBudget).toLocaleString() : '0';
      const targetGradesText = matchedEvent?.targetGrades && matchedEvent.targetGrades.length > 0 
        ? matchedEvent.targetGrades.join(', ') + '학년'
        : slots.filter(s => s.grade).map(s => s.grade).join(', ') ? slots.filter(s => s.grade).map(s => s.grade).join(', ') + '학년' : '전교생';

      const hasGradeSubmissions = Object.keys(localSubmissions).length > 0;

      // -------------------------------------------------------------
      // 1. 공문서 기안문 본문 (단순하고 정제된 요약 양식)
      // -------------------------------------------------------------
      const bodyHtml = `
<p style="line-height: 1.8; margin-bottom: 8px; font-size: 13px;">1. 관련: 초등 체육과 교육과정 및 2026학년도 학교 체육 운영 계획</p>
<p style="line-height: 1.8; margin-bottom: 8px; font-size: 13px;">2. <strong>${eventTitle}</strong>을 다음과 같이 추진하고자 하오니 결재하여 주시기 바랍니다.</p>
<p style="line-height: 1.8; margin-bottom: 4px; margin-left: 16px; font-size: 13px;">가. &nbsp;행사명: ${eventTitle}</p>
<p style="line-height: 1.8; margin-bottom: 4px; margin-left: 16px; font-size: 13px;">나. &nbsp;운영 일시: ${startDate}${endDate && endDate !== startDate ? ` ~ ${endDate}` : ''}</p>
<p style="line-height: 1.8; margin-bottom: 4px; margin-left: 16px; font-size: 13px;">다. &nbsp;진행 장소: ${location}</p>
<p style="line-height: 1.8; margin-bottom: 4px; margin-left: 16px; font-size: 13px;">라. &nbsp;대상 학년: ${targetGradesText}</p>
${matchedEvent?.totalBudget ? `<p style="line-height: 1.8; margin-bottom: 8px; margin-left: 16px; font-size: 13px;">마. &nbsp;소요 예산: 금 ${totalBudgetFormatted} VND</p>` : ''}
<table style="width: 100%; border-collapse: collapse; border: none; margin-top: 24px; margin-bottom: 6px; line-height: 1.8; font-size: 13px;" class="attachment-table">
  <tbody>
    <tr>
      <td style="vertical-align: top; width: 36px; border: none; padding: 0 8px 3px 0; white-space: nowrap; font-weight: normal; color: inherit;">붙임</td>
      <td style="vertical-align: top; border: none; padding: 0 0 3px 0; font-weight: normal; color: inherit; word-break: keep-all;">1. &nbsp;${eventTitle} 세부 운영 계획서 1부.</td>
    </tr>
    ${hasGradeSubmissions ? `
    <tr>
      <td style="border: none; padding: 0 8px 3px 0;"></td>
      <td style="vertical-align: top; border: none; padding: 0 0 3px 0; font-weight: normal; color: inherit; word-break: keep-all;">2. &nbsp;학년별 세부 운영 시나리오 및 타임테이블(취합본) 1부. &nbsp;&nbsp;끝.</td>
    </tr>` : `
    <tr>
      <td style="border: none; padding: 0 8px 3px 0;"></td>
      <td style="vertical-align: top; border: none; padding: 0 0 3px 0; font-weight: normal; color: inherit; word-break: keep-all;">끝.</td>
    </tr>`}
  </tbody>
</table>
      `.trim();

      // -------------------------------------------------------------
      // 2. [붙임 1] 세부 운영 계획서 HTML 문서
      // -------------------------------------------------------------
      const schedules = matchedEvent?.schedules || [];
      const schedulesTableRows = schedules.map((s: any, idx: number) => `
        <tr>
          <td style="border: 1px solid #cbd5e1; padding: 8px; text-align: center;">${idx + 1}</td>
          <td style="border: 1px solid #cbd5e1; padding: 8px; text-align: center; font-weight: bold;">${s.date}${s.time ? `<br><span style="font-size: 11px; color: #64748b; font-weight: normal;">${s.time}</span>` : ''}</td>
          <td style="border: 1px solid #cbd5e1; padding: 8px;"><strong>${s.title}</strong></td>
          <td style="border: 1px solid #cbd5e1; padding: 8px; text-align: center;">${s.target || '-'}</td>
          <td style="border: 1px solid #cbd5e1; padding: 8px; text-align: center;">${s.location || '-'}</td>
        </tr>
      `).join('');

      const budgets = matchedEvent?.budgets || [];
      const budgetsTableRows = budgets.map((b: any, idx: number) => `
        <tr>
          <td style="border: 1px solid #cbd5e1; padding: 8px; text-align: center;">${idx + 1}</td>
          <td style="border: 1px solid #cbd5e1; padding: 8px; text-align: center; font-weight: 600;">${b.category}</td>
          <td style="border: 1px solid #cbd5e1; padding: 8px;">${b.item}</td>
          <td style="border: 1px solid #cbd5e1; padding: 8px; text-align: right; font-weight: bold;">${Number(b.amount).toLocaleString()} VND</td>
          <td style="border: 1px solid #cbd5e1; padding: 8px;">${b.note || '-'}</td>
        </tr>
      `).join('');

      const planHtml = `<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="utf-8">
<title>${eventTitle} 세부 운영 계획서</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@400;500;700;800;900&display=swap');
  body {
    font-family: 'Noto Sans KR', sans-serif;
    color: #1e293b;
    background-color: #f8fafc;
    margin: 0;
    padding: 30px 15px;
  }
  .page {
    max-width: 820px;
    margin: 0 auto 25px auto;
    background: #ffffff;
    padding: 50px 60px;
    border-radius: 12px;
    box-shadow: 0 4px 20px rgba(0,0,0,0.06);
    box-sizing: border-box;
  }
  .header-title {
    font-size: 22px;
    font-weight: 800;
    text-align: center;
    color: #0f172a;
    letter-spacing: -0.5px;
    margin-bottom: 8px;
  }
  .header-decor {
    height: 4px;
    width: 100%;
    background: linear-gradient(to right, #4f46e5 70%, #06b6d4 30%);
    margin-bottom: 24px;
    border-radius: 2px;
  }
  .section-badge {
    font-size: 15px;
    font-weight: 800;
    color: #1e1b4b;
    border-bottom: 2px solid #4f46e5;
    padding-bottom: 4px;
    margin: 22px 0 10px 0;
  }
  p.indent-1 {
    margin: 6px 0;
    line-height: 1.7;
    font-size: 13px;
  }
  table.custom-table {
    width: 100%;
    border-collapse: collapse;
    margin: 12px 0;
    font-size: 12px;
  }
  table.custom-table th, table.custom-table td {
    border: 1px solid #cbd5e1;
    padding: 8px 10px;
  }
  table.custom-table th {
    background-color: #f1f5f9;
    font-weight: 700;
    color: #0f172a;
    text-align: center;
  }
  .print-btn-container {
    text-align: center;
    margin-bottom: 20px;
  }
  .print-btn {
    background: #4f46e5;
    color: white;
    border: none;
    padding: 10px 22px;
    font-size: 14px;
    font-weight: 700;
    border-radius: 8px;
    cursor: pointer;
    box-shadow: 0 2px 8px rgba(79,70,229,0.3);
    transition: all 0.2s;
  }
  .print-btn:hover {
    background: #4338ca;
  }
  @media print {
    @page { size: A4 portrait; margin: 12mm 15mm; }
    body { background: white; padding: 0; }
    .page { box-shadow: none; padding: 0; margin: 0; max-width: 100%; }
    .print-btn-container { display: none; }
    table { page-break-inside: auto; }
    tr { page-break-inside: avoid; }
  }
</style>
</head>
<body>
  <div class="print-btn-container">
    <button class="print-btn" onclick="window.print()">PDF 다운로드 / 인쇄하기</button>
  </div>
  
  <div class="page">
    <div class="header-title">${eventTitle} 세부 운영 계획서</div>
    <div class="header-decor"></div>
    
    <div class="section-badge">1. 행사 기본 개요</div>
    <table class="custom-table">
      <tbody>
        <tr>
          <th style="width: 20%;">행사명</th>
          <td colspan="3"><strong>${eventTitle}</strong></td>
        </tr>
        <tr>
          <th style="width: 20%;">운영 일시</th>
          <td>${startDate}${endDate && endDate !== startDate ? ` ~ ${endDate}` : ''}</td>
          <th style="width: 20%;">진행 장소</th>
          <td>${location}</td>
        </tr>
        <tr>
          <th>대상 학년</th>
          <td>${targetGradesText}</td>
          <th>추진 담당</th>
          <td>${manager}</td>
        </tr>
      </tbody>
    </table>

    <div class="section-badge">2. 목적 및 운영 방침</div>
    <p class="indent-1">${matchedEvent?.description || task.description || '학생들의 기초 체력 증진과 활기찬 스포츠 문화 형성을 목적으로 함.'}</p>

    <div class="section-badge">3. 총괄 운영 타임테이블 및 일정표</div>
    <table class="custom-table">
      <thead>
        <tr>
          <th style="width: 40px;">No</th>
          <th style="width: 140px;">일자 및 시간</th>
          <th>프로그램명</th>
          <th style="width: 110px;">대상</th>
          <th style="width: 120px;">장소</th>
        </tr>
      </thead>
      <tbody>
        ${schedulesTableRows || '<tr><td colspan="5" style="text-align: center; color: #94a3b8; padding: 12px;">등록된 일정이 없습니다.</td></tr>'}
      </tbody>
    </table>

    <div class="section-badge">4. 소요 예산 내역 (총계: 금 ${totalBudgetFormatted} VND)</div>
    <table class="custom-table">
      <thead>
        <tr>
          <th style="width: 40px;">No</th>
          <th style="width: 100px;">항목 구분</th>
          <th>산출 내역</th>
          <th style="width: 130px;">금액</th>
          <th style="width: 120px;">비고</th>
        </tr>
      </thead>
      <tbody>
        ${budgetsTableRows || '<tr><td colspan="5" style="text-align: center; color: #94a3b8; padding: 12px;">소요 예산 내역이 없습니다.</td></tr>'}
      </tbody>
    </table>
  </div>
</body>
</html>`;

      // -------------------------------------------------------------
      // 3. [붙임 2] 학년별 세부 운영 시나리오 및 타임테이블 (취합본)
      // -------------------------------------------------------------
      let gradeSubmissionsHtml = '';
      if (hasGradeSubmissions) {
        const uniqueSubmissionsByGrade = new Map<string, { key: string; sub: TaskSubmission }>();
        Object.entries(localSubmissions).forEach(([key, sub]) => {
          let grade = sub.grade ? String(sub.grade) : '';
          if (!grade) {
            const match = key.match(/_([1-6])$/);
            if (match) grade = match[1];
          }
          if (!grade) grade = '5';

          const existing = uniqueSubmissionsByGrade.get(grade);
          if (!existing || (sub.submittedAt && (!existing.sub.submittedAt || sub.submittedAt > existing.sub.submittedAt))) {
            uniqueSubmissionsByGrade.set(grade, { key, sub });
          }
        });

        const sortedGradeEntries = Array.from(uniqueSubmissionsByGrade.entries())
          .sort((a, b) => Number(a[0]) - Number(b[0]));

        const gradeSectionsHtml = sortedGradeEntries.map(([grade, { key, sub }]) => {
          const scenariosRows = (sub.scenarios || []).map((sc, idx) => `
            <tr>
              <td style="border: 1px solid #cbd5e1; padding: 8px; text-align: center; font-weight: bold;">${sc.time}</td>
              <td style="border: 1px solid #cbd5e1; padding: 8px; font-weight: bold; color: #1e1b4b;">${sc.program}</td>
              <td style="border: 1px solid #cbd5e1; padding: 8px;">${sc.rules ? sc.rules.replace(/\n/g, '<br>') : '-'}</td>
              <td style="border: 1px solid #cbd5e1; padding: 8px;">${sc.preparations ? sc.preparations.replace(/\n/g, '<br>') : '-'}</td>
            </tr>
          `).join('');

          return `
            <div style="margin-bottom: 24px; border: 1px solid #cbd5e1; border-radius: 8px; padding: 16px; background-color: #ffffff;">
              <div style="font-size: 15px; font-weight: 800; color: #4338ca; border-bottom: 1.5px solid #e2e8f0; padding-bottom: 8px; margin-bottom: 12px; display: flex; justify-content: space-between; align-items: center;">
                <span>■ ${grade}학년 세부 운영 계획</span>
                <span style="font-size: 12px; color: #64748b; font-weight: normal;">작성 교사: ${sub.submitterName || key.split('@')[0]}</span>
              </div>
              
              ${sub.linkUrl ? `
                <div style="margin-bottom: 10px; font-size: 12px; background-color: #f5f3ff; border: 1px solid #ddd6fe; padding: 8px 12px; border-radius: 6px;">
                  <strong>발표 / 캔바(Canva) 자료:</strong> <a href="${sub.linkUrl}" target="_blank" style="color: #6366f1; text-decoration: underline; font-weight: bold;">${sub.linkTitle || sub.linkUrl}</a>
                </div>
              ` : ''}

              <table class="custom-table" style="margin-top: 8px;">
                <thead>
                  <tr>
                    <th style="width: 120px;">시간</th>
                    <th style="width: 160px;">프로그램명</th>
                    <th>경기 규칙 및 진행 요령</th>
                    <th style="width: 150px;">비품 / 교사 배치</th>
                  </tr>
                </thead>
                <tbody>
                  ${scenariosRows || '<tr><td colspan="4" style="text-align: center; color: #94a3b8; padding: 12px;">작성된 시나리오가 없습니다.</td></tr>'}
                </tbody>
              </table>

              ${sub.note ? `<p style="font-size: 12px; color: #475569; margin: 8px 0 0 0; background: #f8fafc; padding: 6px 10px; border-radius: 4px;"><strong>특이사항 및 안내:</strong> ${sub.note}</p>` : ''}
            </div>
          `;
        }).join('');

        gradeSubmissionsHtml = `<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="utf-8">
<title>${eventTitle} 학년별 세부 운영 시나리오 및 타임테이블 (취합본)</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@400;500;700;800;900&display=swap');
  body {
    font-family: 'Noto Sans KR', sans-serif;
    color: #1e293b;
    background-color: #f8fafc;
    margin: 0;
    padding: 30px 15px;
  }
  .page {
    max-width: 820px;
    margin: 0 auto 25px auto;
    background: #ffffff;
    padding: 50px 60px;
    border-radius: 12px;
    box-shadow: 0 4px 20px rgba(0,0,0,0.06);
    box-sizing: border-box;
  }
  .header-title {
    font-size: 22px;
    font-weight: 800;
    text-align: center;
    color: #0f172a;
    letter-spacing: -0.5px;
    margin-bottom: 8px;
  }
  .header-decor {
    height: 4px;
    width: 100%;
    background: linear-gradient(to right, #6366f1 70%, #ec4899 30%);
    margin-bottom: 24px;
    border-radius: 2px;
  }
  table.custom-table {
    width: 100%;
    border-collapse: collapse;
    margin: 8px 0;
    font-size: 12px;
  }
  table.custom-table th, table.custom-table td {
    border: 1px solid #cbd5e1;
    padding: 8px 10px;
  }
  table.custom-table th {
    background-color: #f1f5f9;
    font-weight: 700;
    color: #0f172a;
    text-align: center;
  }
  .print-btn-container {
    text-align: center;
    margin-bottom: 20px;
  }
  .print-btn {
    background: #6366f1;
    color: white;
    border: none;
    padding: 10px 22px;
    font-size: 14px;
    font-weight: 700;
    border-radius: 8px;
    cursor: pointer;
    box-shadow: 0 2px 8px rgba(99,102,241,0.3);
    transition: all 0.2s;
  }
  .print-btn:hover {
    background: #4f46e5;
  }
  @media print {
    @page { size: A4 portrait; margin: 12mm 15mm; }
    body { background: white; padding: 0; }
    .page { box-shadow: none; padding: 0; margin: 0; max-width: 100%; }
    .print-btn-container { display: none; }
    table { page-break-inside: auto; }
    tr { page-break-inside: avoid; }
  }
</style>
</head>
<body>
  <div class="print-btn-container">
    <button class="print-btn" onclick="window.print()">PDF 다운로드 / 인쇄하기</button>
  </div>
  
  <div class="page">
    <div class="header-title">${eventTitle} 학년별 세부 운영 시나리오 및 타임테이블 (취합본)</div>
    <div class="header-decor"></div>
    ${gradeSectionsHtml}
  </div>
</body>
</html>`;
      }

      // -------------------------------------------------------------
      // 4. 첨부파일 목록 구성
      // -------------------------------------------------------------
      const attachments = [
        {
          name: `붙임 1. ${eventTitle} 세부 운영 계획서.html`,
          size: planHtml.length * 2,
          data: 'data:text/html;charset=utf-8,' + encodeURIComponent(planHtml)
        },
        ...(hasGradeSubmissions ? [{
          name: `붙임 2. 학년별 세부 운영 시나리오 및 타임테이블 (취합본).html`,
          size: gradeSubmissionsHtml.length * 2,
          data: 'data:text/html;charset=utf-8,' + encodeURIComponent(gradeSubmissionsHtml)
        }] : [])
      ];

      sessionStorage.setItem('pending_doc_draft', JSON.stringify({
        title: draftTitle,
        content: bodyHtml,
        attachments
      }));

      toast({
        title: '체육 행사 기안문 생성 완료',
        description: `전자결재 기안 작성 페이지로 이동합니다. (붙임 ${attachments.length}건 탑재됨)`,
      });

      onOpenChange(false);
      router.push('/new?peTemplate=true');
    } catch (e: any) {
      console.error(e);
      toast({ variant: 'destructive', title: '기안문 생성 실패', description: e.message });
    } finally {
      setIsDrafting(false);
    }
  };

  // 대상자 슬롯 계산: 실제로 업무가 요청/할당된 대상자 및 학년 슬롯만 1:1로 정밀하게 생성
  const slots = React.useMemo(() => {
    if (!task) return [];
    const emails = task.targetEmails || [];
    const targetNames = task.targetNames || {};

    // 1. targetNames에 학년 정보가 포함된 경우 (예: { "beside1s@kshcm.net": "5학년 (강지욱)" })
    const gradeEntries: { email: string; grade: string; displayName: string }[] = [];
    const seenGrades = new Set<string>();

    Object.entries(targetNames).forEach(([email, name]) => {
      const match = name.match(/([1-6])학년/);
      if (match) {
        const grade = match[1];
        if (!seenGrades.has(grade)) {
          seenGrades.add(grade);
          gradeEntries.push({
            email: email.toLowerCase(),
            grade,
            displayName: name,
          });
        }
      }
    });

    // submissions에 이미 제출된 학년 중 누락된 항목 추가
    Object.entries(localSubmissions).forEach(([key, sub]) => {
      if (sub.grade && !seenGrades.has(String(sub.grade))) {
        seenGrades.add(String(sub.grade));
        const email = sub.submitterEmail?.toLowerCase() || key.split('_')[0].toLowerCase();
        gradeEntries.push({
          email,
          grade: String(sub.grade),
          displayName: `${sub.grade}학년 (${sub.submitterName || email.split('@')[0]})`,
        });
      }
    });

    if (gradeEntries.length > 0) {
      // 학년 오름차순 정렬
      gradeEntries.sort((a, b) => Number(a.grade) - Number(b.grade));

      return gradeEntries.map(entry => {
        const gradeKey = `${entry.email}_${entry.grade}`;
        
        // 제출물 매칭: 학년 키 우선 -> sub.grade 일치 확인 -> 이메일 키 확인
        let sub = localSubmissions[gradeKey] || Object.values(localSubmissions).find(s => String(s.grade) === String(entry.grade));
        if (!sub) {
          const directSub = localSubmissions[entry.email];
          if (directSub && (!directSub.grade || String(directSub.grade) === String(entry.grade))) {
            sub = directSub;
          }
        }

        return {
          slotKey: gradeKey,
          email: entry.email,
          displayName: entry.displayName,
          grade: entry.grade,
          sub: sub || null,
        };
      });
    }

    // 2. 일반 부서 업무인 경우 (고유 대상자 기준)
    const uniqueEmails = [...new Set(emails.map(e => e.toLowerCase()))];
    return uniqueEmails.map((email) => {
      const sub = localSubmissions[email] || Object.values(localSubmissions).find(s => s.submitterEmail?.toLowerCase() === email);
      const displayName = targetNames[email] || email.split('@')[0];

      return {
        slotKey: email,
        email,
        displayName,
        grade: undefined,
        sub: sub || null,
      };
    });
  }, [task, localSubmissions]);

  if (!task) return null;

  // 슬롯 기반으로 실제 제출 완료 건수를 계산하여 상단 진행률과 하단 목록이 항상 100% 일치하도록 보장
  const totalCount = slots.length;
  const submittedCount = slots.filter(s => !!s.sub).length;
  const unsubmittedCount = Math.max(0, totalCount - submittedCount);
  const progressPercent = totalCount > 0 ? Math.round((submittedCount / totalCount) * 100) : 0;

  // 전체 업무 삭제
  const handleDelete = async () => {
    if (!confirm('이 업무를 정말 삭제하시겠습니까? (제출된 내역도 함께 삭제됩니다)')) return;
    try {
      await deleteDepartmentTask(task.id);
      toast({ title: '업무 삭제 완료', description: '업무가 성공적으로 삭제되었습니다.' });
      onOpenChange(false);
      onTaskDeleted?.();
    } catch (err: any) {
      toast({ variant: 'destructive', title: '삭제 실패', description: err.message });
    }
  };

  // 개별 제출물 삭제/초기화
  const handleDeleteSingleSubmission = async (submissionKey: string, grade?: string) => {
    if (!confirm('해당 교사/학년의 제출 내역을 삭제(초기화)하시겠습니까?')) return;
    try {
      const keyToDelete = grade ? `${submissionKey}_${grade}` : submissionKey;
      const res = await deleteDepartmentTaskSubmission(task.id, keyToDelete);
      if (res.success) {
        // 로컬 상태에서도 즉시 삭제 반영
        setLocalSubmissions(prev => {
          const next = { ...prev };
          delete next[keyToDelete.toLowerCase()];
          delete next[submissionKey.toLowerCase()];
          if (grade) {
            Object.keys(next).forEach(k => {
              if (String(next[k].grade) === String(grade)) {
                delete next[k];
              }
            });
          }
          return next;
        });
        toast({ title: '제출 내역 삭제 완료', description: '해당 제출 내역이 초기화되었습니다.' });
      } else {
        toast({ variant: 'destructive', title: '삭제 실패', description: res.error });
      }
    } catch (err: any) {
      toast({ variant: 'destructive', title: '오류 발생', description: err.message });
    }
  };

  // 업무 마감/재개 토글
  const handleToggleStatus = async () => {
    const nextStatus = task.status === 'closed' ? 'active' : 'closed';
    try {
      await updateDepartmentTaskStatus(task.id, nextStatus);
      toast({ 
        title: nextStatus === 'closed' ? '업무 마감 완료' : '업무 재활성화 완료',
        description: nextStatus === 'closed' ? '추가 제출이 마감되었습니다.' : '다시 제출할 수 있습니다.'
      });
    } catch (err: any) {
      toast({ variant: 'destructive', title: '상태 변경 실패', description: err.message });
    }
  };

  // 수정 모달 열기
  const handleOpenEdit = (key: string, sub: TaskSubmission, grade?: string) => {
    setEditingKey(key);
    setEditGrade(sub.grade || grade || '');
    setEditNote(sub.note || '');
    setEditLinkUrl(sub.linkUrl || '');
    setEditLinkTitle(sub.linkTitle || '');
    setEditScenarios(sub.scenarios || []);
  };

  // 시나리오 행 추가/수정/삭제
  const handleAddEditScenario = () => {
    setEditScenarios(prev => [
      ...prev,
      {
        id: uuidv4(),
        time: '10:00 ~ 10:40',
        program: '',
        target: `${editGrade || '전'}학년`,
        rules: '',
        preparations: '',
        note: ''
      }
    ]);
  };

  const handleUpdateEditScenario = (id: string, field: keyof TaskScenarioItem, val: string) => {
    setEditScenarios(prev => prev.map(s => s.id === id ? { ...s, [field]: val } : s));
  };

  const handleRemoveEditScenario = (id: string) => {
    setEditScenarios(prev => prev.filter(s => s.id !== id));
  };

  // 수정 내용 저장
  const handleSaveEdit = async () => {
    if (!editingKey) return;
    setIsSavingEdit(true);
    try {
      const updatedSubmissionData: Partial<TaskSubmission> = {
        grade: editGrade,
        note: editNote.trim(),
        linkUrl: editLinkUrl.trim() || undefined,
        linkTitle: editLinkTitle.trim() || undefined,
        scenarios: editScenarios.filter(s => s.program.trim() !== '')
      };

      const res = await updateDepartmentTaskSubmission(task.id, editingKey, updatedSubmissionData);
      if (res.success) {
        setLocalSubmissions(prev => {
          const next = { ...prev };
          const existing = next[editingKey.toLowerCase()] || {};
          const merged = { ...existing, ...updatedSubmissionData, submittedAt: new Date().toISOString() } as TaskSubmission;
          next[editingKey.toLowerCase()] = merged;
          if (editGrade) {
            next[`${merged.submitterEmail.toLowerCase()}_${editGrade}`] = merged;
          }
          return next;
        });
        toast({ title: '제출 내용 수정 완료', description: '세부 계획이 정상적으로 업데이트되었습니다.' });
        setEditingKey(null);
      } else {
        toast({ variant: 'destructive', title: '수정 실패', description: res.error });
      }
    } catch (e: any) {
      toast({ variant: 'destructive', title: '오류 발생', description: e.message });
    } finally {
      setIsSavingEdit(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto p-5 sm:p-6 rounded-2xl">
        <DialogHeader className="border-b pb-3">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Badge className="bg-indigo-600 text-white text-[10px] px-1.5 py-0 h-4 leading-none font-bold">
                {task.creatorDept || '부서 업무'}
              </Badge>
              <Badge variant="outline" className={task.status === 'closed' ? 'bg-slate-100 text-slate-600 text-[10px]' : 'bg-emerald-50 text-emerald-700 border-emerald-300 text-[10px]'}>
                {task.status === 'closed' ? '마감됨' : '진행 중'}
              </Badge>
            </div>
            <div className="flex items-center gap-1.5">
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={handleToggleStatus}
                className="h-7 text-xs text-slate-500 hover:text-slate-900 rounded-lg px-2"
              >
                <Lock className="w-3 h-3 mr-1" />
                {task.status === 'closed' ? '업무 재개' : '업무 마감'}
              </Button>
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={handleDelete}
                className="h-7 text-xs text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-lg px-2"
              >
                <Trash2 className="w-3 h-3 mr-1" />
                삭제
              </Button>
            </div>
          </div>

          <DialogTitle className="text-base sm:text-lg font-black text-slate-900 leading-snug mt-1">
            {task.title}
          </DialogTitle>

          <DialogDescription className="text-xs text-slate-500 flex items-center gap-3 pt-0.5">
            <span className="flex items-center gap-1">
              <Users className="w-3.5 h-3.5" />
              요청자: <strong>{task.creatorName}</strong> ({task.creatorDept})
            </span>
            <span className="flex items-center gap-1 text-rose-600 font-semibold">
              <Calendar className="w-3.5 h-3.5" />
              마감일: {task.deadline}
            </span>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* 등록된 참고자료 (공문, 계획서 PDF, 이미지 등) */}
          {task.attachments && task.attachments.length > 0 && (
            <div className="p-3 bg-indigo-50/70 border border-indigo-200/80 rounded-2xl space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-indigo-950 flex items-center gap-1.5">
                  <Paperclip className="w-3.5 h-3.5 text-indigo-600" />
                  배포된 업무 참고자료 ({task.attachments.length}건)
                </span>
                <span className="text-[10px] text-indigo-600 font-semibold">첨부 파일 열람 가능</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {task.attachments.map((att, idx) => {
                  const isImage = !att.isGoogleDrive && (att.type?.startsWith('image/') || /\.(png|jpe?g|webp|gif)$/i.test(att.name));
                  const isPdf = att.isGoogleDrive ? att.driveFileType === 'pdf' : (att.type === 'application/pdf' || /\.pdf$/i.test(att.name));
                  const driveInfo = att.isGoogleDrive ? getDriveTypeInfo(att.driveFileType) : null;

                  return (
                    <a
                      key={idx}
                      href={att.url}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center gap-2.5 p-2 bg-white rounded-xl border border-indigo-200/80 hover:border-indigo-400 hover:shadow-2xs transition-all group cursor-pointer"
                    >
                      {att.isGoogleDrive ? (
                        <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center shrink-0 border", driveInfo?.bgColor, driveInfo?.borderColor)}>
                          {att.driveFileType === 'sheet' && <FileSpreadsheet className="w-4 h-4 text-emerald-700" />}
                          {att.driveFileType === 'doc' && <FileText className="w-4 h-4 text-blue-700" />}
                          {att.driveFileType === 'slide' && <Presentation className="w-4 h-4 text-amber-700" />}
                          {att.driveFileType === 'folder' && <Folder className="w-4 h-4 text-indigo-700" />}
                          {att.driveFileType === 'pdf' && <span className="text-[9px] font-black text-rose-700">PDF</span>}
                          {(!att.driveFileType || att.driveFileType === 'file') && <HardDrive className="w-4 h-4 text-slate-700" />}
                        </div>
                      ) : isImage ? (
                        <div className="w-8 h-8 rounded-lg bg-slate-100 overflow-hidden shrink-0 border border-slate-200">
                          <img src={att.url} alt={att.name} className="w-full h-full object-cover" />
                        </div>
                      ) : isPdf ? (
                        <div className="w-8 h-8 rounded-lg bg-rose-50 border border-rose-200 flex items-center justify-center shrink-0 text-[10px] font-black text-rose-600">
                          PDF
                        </div>
                      ) : (
                        <div className="w-8 h-8 rounded-lg bg-indigo-50 border border-indigo-200 flex items-center justify-center shrink-0 text-indigo-600">
                          <FileText className="w-4 h-4" />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <p className="text-xs font-bold text-slate-800 truncate group-hover:text-indigo-600 transition-colors">
                            {att.name}
                          </p>
                          {att.isGoogleDrive && (
                            <Badge className={cn("text-[9px] px-1 py-0 h-3.5 shrink-0", driveInfo?.badgeColor)}>
                              {driveInfo?.label}
                            </Badge>
                          )}
                        </div>
                        <p className="text-[10px] text-slate-400">
                          {att.isGoogleDrive ? 'Google Drive 클라우드 문서 · 새 창 열기' : (att.size ? `${(att.size / 1024).toFixed(1)} KB` : '첨부 문서')} · 새 창 열기
                        </p>
                      </div>
                      <ExternalLink className="w-3.5 h-3.5 text-slate-400 group-hover:text-indigo-600 shrink-0" />
                    </a>
                  );
                })}
              </div>
            </div>
          )}

          {/* 구글 시트 / 협업 서식 바로가기 배너 */}
          {task.sheetsConfig && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-2">
                <FileSpreadsheet className="w-4 h-4 text-emerald-600 shrink-0" />
                <div>
                  <p className="font-bold text-emerald-950">
                    {task.sheetsConfig.mode === 'custom' && (
                      task.sheetsConfig.sheetUrl?.includes('docs.google.com/forms')
                        ? 'Google Forms 설문지 응답 문서'
                        : '사용자 문서/시트 링크형 협업 문서'
                    )}
                    {task.sheetsConfig.mode === 'template' && (task.sheetsConfig.templateName ? `${task.sheetsConfig.templateName} (표준 시트)` : '표준 시트 양식 배포 취합')}
                    {task.sheetsConfig.mode === 'html_draft' && '기안문 붙임 문서 자동 생성형 취합'}
                  </p>
                  <p className="text-[11px] text-emerald-700">
                    {task.sheetsConfig.mode === 'html_draft' 
                      ? '하단 [기안문 상신]을 클릭하면 취합된 데이터가 표준 공문서 무테 표로 자동 변환됩니다.' 
                      : (task.sheetsConfig.sheetUrl?.includes('docs.google.com/forms')
                          ? '배포된 구글 설문지 링크를 열어 설문 응답 현황을 확인하실 수 있습니다.'
                          : '교원들이 구글 스프레드시트에 입력한 최신 취합본을 확인하실 수 있습니다.')}
                  </p>
                </div>
              </div>
              {task.sheetsConfig.sheetUrl && (
                <a
                  href={task.sheetsConfig.sheetUrl}
                  target="_blank"
                  rel="noreferrer"
                  className={cn(
                    "px-3 py-1.5 text-white rounded-xl font-bold flex items-center gap-1 shrink-0 text-xs shadow-xs transition-colors",
                    task.sheetsConfig.sheetUrl.includes('docs.google.com/forms')
                      ? "bg-purple-600 hover:bg-purple-700"
                      : "bg-emerald-600 hover:bg-emerald-700"
                  )}
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>
                    {task.sheetsConfig.sheetUrl.includes('docs.google.com/forms')
                      ? 'Google 설문지 열기'
                      : 'Google Sheets 열기'}
                  </span>
                </a>
              )}
            </div>
          )}

          {/* 제출 진행률 현황 바 */}
          <div className="bg-slate-50 border border-slate-200/80 p-3.5 rounded-2xl space-y-2">
            <div className="flex items-center justify-between text-xs font-bold">
              <span className="text-slate-700 flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                전체 제출 진행률: {submittedCount} / {totalCount}명 제출 완료
              </span>
              <span className="text-indigo-600 font-extrabold text-sm">{progressPercent}%</span>
            </div>
            <Progress value={progressPercent} className="h-2.5 bg-slate-200" />
          </div>

          {/* 요청 내용 */}
          {task.description && (
            <div className="text-xs text-slate-600 bg-indigo-50/40 border border-indigo-100 p-3 rounded-xl">
              <p className="font-bold text-indigo-950 mb-0.5 text-[11px]">요청 지침 및 안내:</p>
              <div className="whitespace-pre-wrap leading-relaxed">{task.description}</div>
            </div>
          )}

          {/* 대상자/학년별 제출 상세 목록 테이블 */}
          <div className="space-y-2">
            <h4 className="text-xs font-bold text-slate-800 flex items-center justify-between">
              <span>교직원 및 학년별 제출 상태 ({slots.length}개 슬롯)</span>
              <span className="text-[11px] text-slate-400 font-normal">
                미제출: {Math.max(0, slots.length - submittedCount)}개
              </span>
            </h4>

            <div className="border border-slate-200 rounded-2xl overflow-hidden divide-y divide-slate-100 bg-white">
              {slots.map((slot) => {
                const sub = slot.sub;

                return (
                  <div key={slot.slotKey} className="p-3.5 flex items-start justify-between gap-3 hover:bg-slate-50/60 transition-colors">
                    <div className="min-w-0 flex-1 space-y-1.5">
                      <div className="flex items-center gap-2 flex-wrap">
                        {slot.grade && (
                          <Badge variant="outline" className="bg-indigo-50 text-indigo-800 font-bold text-[11px] px-1.5 py-0.5">
                            {slot.grade}학년
                          </Badge>
                        )}
                        <span className="font-bold text-xs text-slate-900">{slot.displayName}</span>
                        <span className="text-[10px] text-slate-400 font-mono truncate max-w-[140px]">({slot.email})</span>
                        {sub ? (
                          <Badge className="bg-emerald-500 text-white text-[9px] px-1.5 py-0 h-4 leading-none font-bold">
                            {(task.taskType === 'acknowledgment' || task.taskType === 'simple_check') ? '✓ 확인 완료' : '✓ 제출 완료'}
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-300 text-[9px] px-1.5 py-0 h-4 leading-none font-semibold">
                            {(task.taskType === 'acknowledgment' || task.taskType === 'simple_check') ? '⏳ 미확인' : '⏳ 미제출'}
                          </Badge>
                        )}
                      </div>

                      {/* 제출 세부 내역 (타임테이블 시나리오, 캔바 링크, 특이사항/의견) */}
                      {sub && (
                        <div className="space-y-1 text-[11px] text-slate-600 bg-slate-50 p-2 rounded-lg border border-slate-100">
                          <div className="flex items-center gap-2 flex-wrap text-[10px] text-slate-400">
                            {sub.submittedAt && (
                              <span className="flex items-center gap-0.5">
                                <Clock className="w-3 h-3" />
                                확인/제출일시: {new Date(sub.submittedAt).toLocaleDateString('ko-KR', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                              </span>
                            )}
                            {sub.submitterName && (
                              <span>작성자: {sub.submitterName}</span>
                            )}
                          </div>

                          {sub.note && (
                            <div className="pt-0.5">
                              {(task.taskType === 'acknowledgment' || task.taskType === 'simple_check') ? (
                                <p className="text-slate-800 font-medium bg-indigo-50/80 border border-indigo-100 p-1.5 rounded-md flex items-start gap-1 text-[11px]">
                                  <MessageSquare className="w-3 h-3 text-indigo-600 shrink-0 mt-0.5" />
                                  <span><strong className="text-indigo-900">첨부 의견:</strong> {sub.note}</span>
                                </p>
                              ) : (
                                <p className="text-slate-700 font-medium">
                                  <strong className="text-slate-900">특이사항:</strong> {sub.note}
                                </p>
                              )}
                            </div>
                          )}

                          {/* 타임테이블 시나리오 요약 뱃지 */}
                          {sub.scenarios && sub.scenarios.length > 0 && (
                            <div className="pt-1 flex flex-wrap gap-1">
                              {sub.scenarios.map((sc, i) => (
                                <span key={sc.id || i} className="inline-flex items-center gap-1 bg-white border border-slate-200 px-1.5 py-0.5 rounded text-[10px] font-medium text-slate-800 shadow-2xs">
                                  <span className="text-indigo-600 font-bold">{sc.time}</span>
                                  <span>{sc.program}</span>
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    {/* 액션 버튼 그룹 (다운로드, 캔바 링크, 수정, 삭제) */}
                    <div className="shrink-0 flex items-center gap-1.5 pt-0.5">
                      {sub?.fileUrl ? (
                        <a 
                          href={sub.fileUrl} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 h-7 px-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-lg text-xs font-bold transition-colors shadow-2xs"
                        >
                          <Download className="w-3.5 h-3.5 text-indigo-600" />
                          <span className="truncate max-w-[80px]">{sub.fileName || '문서 다운'}</span>
                        </a>
                      ) : sub?.linkUrl ? (
                        <a 
                          href={sub.linkUrl} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 h-7 px-2 bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-200 rounded-lg text-xs font-bold transition-colors shadow-2xs"
                        >
                          <ExternalLink className="w-3.5 h-3.5 text-purple-600" />
                          <span className="truncate max-w-[80px]">{sub.linkTitle || '캔바 자료'}</span>
                        </a>
                      ) : sub ? (
                        <Badge variant="secondary" className="text-[10px] text-slate-400 bg-slate-100">
                          참고자료 없음
                        </Badge>
                      ) : (
                        <span className="text-[11px] text-amber-600 font-semibold px-2">대기 중</span>
                      )}

                      {/* 제출물 직접 수정 버튼 */}
                      {sub && (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => handleOpenEdit(slot.slotKey, sub, slot.grade)}
                          className="h-7 px-2 text-xs font-bold text-slate-700 hover:bg-slate-100 rounded-lg border-slate-200"
                          title="제출 내용 수정"
                        >
                          <Edit className="w-3 h-3 mr-1 text-slate-600" />
                          수정
                        </Button>
                      )}

                      {/* 제출물 삭제/초기화 버튼 */}
                      {sub && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeleteSingleSubmission(slot.slotKey, slot.grade)}
                          className="h-7 w-7 p-0 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg"
                          title="제출 내역 삭제 및 초기화"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* ── 개별 제출 내용 수정 다이얼로그 (인라인 모달) ── */}
        {editingKey && (
          <div className="mt-4 p-4 bg-indigo-50/80 border border-indigo-200 rounded-2xl space-y-3 animate-in fade-in">
            <div className="flex items-center justify-between border-b border-indigo-200 pb-2">
              <h4 className="text-xs font-black text-indigo-950 flex items-center gap-1.5">
                <Edit className="w-4 h-4 text-indigo-600" />
                {editGrade ? `${editGrade}학년 ` : ''}제출 세부계획 내용 수정
              </h4>
              <Button variant="ghost" size="sm" onClick={() => setEditingKey(null)} className="h-6 w-6 p-0 text-slate-400">
                <X className="w-4 h-4" />
              </Button>
            </div>

            <div className="space-y-3 text-xs">
              {/* 시나리오 목록 수정 */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-bold text-indigo-900">운영 타임테이블 (시나리오) ({editScenarios.length}개)</Label>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={handleAddEditScenario}
                    className="h-6 px-2 text-[11px] font-bold text-indigo-600 bg-white border-indigo-200 hover:bg-indigo-50"
                  >
                    <Plus className="w-3 h-3 mr-1" />
                    프로그램 추가
                  </Button>
                </div>

                <div className="space-y-2">
                  {editScenarios.map((sc, idx) => (
                    <div key={sc.id || idx} className="p-2.5 bg-white border border-indigo-100 rounded-lg shadow-2xs space-y-1.5">
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary" className="text-[10px] font-bold">#{idx + 1}</Badge>
                        <Input
                          placeholder="시간대 (09:00 ~ 09:40)"
                          value={sc.time}
                          onChange={e => handleUpdateEditScenario(sc.id, 'time', e.target.value)}
                          className="h-7 text-xs w-[130px] font-bold"
                        />
                        <Input
                          placeholder="프로그램명"
                          value={sc.program}
                          onChange={e => handleUpdateEditScenario(sc.id, 'program', e.target.value)}
                          className="h-7 text-xs font-bold flex-1"
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => handleRemoveEditScenario(sc.id)}
                          className="h-6 px-1 text-rose-500 hover:text-rose-700"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <Input
                          placeholder="경기 규칙 및 진행 요령"
                          value={sc.rules || ''}
                          onChange={e => handleUpdateEditScenario(sc.id, 'rules', e.target.value)}
                          className="h-7 text-xs"
                        />
                        <Input
                          placeholder="필요 준비물 / 교사 배치"
                          value={sc.preparations || ''}
                          onChange={e => handleUpdateEditScenario(sc.id, 'preparations', e.target.value)}
                          className="h-7 text-xs"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* 캔바 / 웹 링크 수정 */}
              <div className="space-y-1 bg-white p-2.5 rounded-lg border border-indigo-100">
                <Label className="text-[11px] font-bold text-slate-700 flex items-center gap-1">
                  <LinkIcon className="w-3.5 h-3.5 text-indigo-600" />
                  캔바(Canva) 및 웹 공유 링크 수정
                </Label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <Input
                    placeholder="링크명 (예: 캔바 PPT)"
                    value={editLinkTitle}
                    onChange={e => setEditLinkTitle(e.target.value)}
                    className="h-7 text-xs"
                  />
                  <Input
                    placeholder="공유 URL (https://...)"
                    value={editLinkUrl}
                    onChange={e => setEditLinkUrl(e.target.value)}
                    className="h-7 text-xs sm:col-span-2 font-mono"
                  />
                </div>
              </div>

              {/* 특이사항 메모 수정 */}
              <div className="space-y-1">
                <Label className="text-[11px] font-bold text-slate-700">특이사항 및 메모</Label>
                <Textarea
                  value={editNote}
                  onChange={e => setEditNote(e.target.value)}
                  rows={2}
                  className="text-xs bg-white resize-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-1 border-t border-indigo-200">
                <Button size="sm" variant="ghost" onClick={() => setEditingKey(null)} className="h-7 text-xs">취소</Button>
                <Button size="sm" onClick={handleSaveEdit} disabled={isSavingEdit} className="h-7 text-xs bg-indigo-600 text-white font-bold">
                  {isSavingEdit ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <Save className="w-3 h-3 mr-1" />}
                  수정 내용 저장
                </Button>
              </div>
            </div>
          </div>
        )}

        <DialogFooter className="pt-3 border-t flex flex-row items-center justify-between gap-2">
          <Button 
            type="button" 
            size="sm" 
            onClick={handleSendApprovalDraft}
            disabled={isDrafting}
            className="h-8 px-4 text-xs font-bold rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs flex items-center gap-1.5"
          >
            {isDrafting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FileText className="w-3.5 h-3.5" />}
            기안문 상신
          </Button>

          <Button 
            type="button" 
            variant="outline" 
            size="sm" 
            onClick={() => onOpenChange(false)}
            className="h-8 px-4 text-xs font-bold rounded-xl"
          >
            닫기
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
