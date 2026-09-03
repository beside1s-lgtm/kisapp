'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '@/hooks/use-auth';
import type { DepartmentTask, TaskSubmission, TaskScenarioItem, TaskAttachment, OrgStructure } from '@/lib/types';
import { 
  uploadTaskSubmissionFile, 
  submitDepartmentTaskResponse,
  delegateDepartmentTask 
} from '@/lib/services/departmentTaskService';
import { getOrgStructure } from '@/lib/services/settingsService';
import { cn } from '@/lib/utils';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { 
  FileUp, 
  Paperclip, 
  CheckCircle2, 
  Calendar, 
  User, 
  Loader2, 
  AlertCircle,
  FileText,
  Plus,
  Trash2,
  Clock,
  Presentation,
  Layers,
  Sparkles,
  Link as LinkIcon,
  UserCheck,
  ArrowRightLeft,
  CalendarDays,
  ExternalLink,
  HardDrive,
  Folder,
  MessageSquare
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { v4 as uuidv4 } from 'uuid';
import { getDriveTypeInfo } from '@/lib/services/googleDriveService';

interface SubmitDepartmentTaskDialogProps {
  task: DepartmentTask | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function SubmitDepartmentTaskDialog({
  task,
  open,
  onOpenChange
}: SubmitDepartmentTaskDialogProps) {
  const { profile } = useAuth();
  const { toast } = useToast();

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [linkUrl, setLinkUrl] = useState('');
  const [linkTitle, setLinkTitle] = useState('');
  const [note, setNote] = useState('');
  const [selectedGrade, setSelectedGrade] = useState<string>('1');
  const [scenarios, setScenarios] = useState<TaskScenarioItem[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // 업무 위임(다른 교사에게 넘기기) 상태
  const [isDelegateOpen, setIsDelegateOpen] = useState(false);
  const [delegateToEmail, setDelegateToEmail] = useState('');
  const [delegateReason, setDelegateReason] = useState('');
  const [isDelegating, setIsDelegating] = useState(false);
  const [orgStructure, setOrgStructure] = useState<OrgStructure>({});

  const myEmail = profile?.email?.toLowerCase() || '';
  const myAssignedGrade = profile?.assignedGrade ? String(profile.assignedGrade) : (profile?.grade ? String(profile.grade) : '');

  // 1. 해당 업무에서 나에게 할당된 정확한 학년 감지 (예: "5학년 (강지욱)" -> "5")
  const assignedGradeForMe = useMemo(() => {
    if (!task) return '';
    
    // (1) targetNames[myEmail]에서 검사
    if (task.targetNames) {
      for (const [email, name] of Object.entries(task.targetNames)) {
        if (email.toLowerCase() === myEmail) {
          const match = name.match(/([1-6])학년/);
          if (match) return match[1];
        }
      }
    }

    // (2) task.title 또는 description에서 단일 학년 감지
    const titleMatch = task.title.match(/([1-6])학년/);
    if (titleMatch) return titleMatch[1];

    // (3) 사용자 프로필 학년
    if (myAssignedGrade) return myAssignedGrade;

    return '1';
  }, [task, myEmail, myAssignedGrade]);

  // 조직도 로드 (업무 위임용 교원 명단)
  useEffect(() => {
    if (open) {
      getOrgStructure().then(org => {
        if (org) setOrgStructure(org);
      }).catch(console.error);
    }
  }, [open]);

  const teacherList = useMemo(() => {
    const list: { email: string; name: string; roleInfo?: string }[] = [];
    const seen = new Set<string>();

    (orgStructure.gradeGroups || []).forEach(g => {
      if (g.headEmail && !seen.has(g.headEmail.toLowerCase())) {
        seen.add(g.headEmail.toLowerCase());
        list.push({ email: g.headEmail, name: `${g.gradeName || g.grade}학년부장`, roleInfo: `${g.grade}학년` });
      }
      (g.memberEmails || []).forEach(m => {
        if (!seen.has(m.toLowerCase())) {
          seen.add(m.toLowerCase());
          list.push({ email: m, name: m.split('@')[0], roleInfo: `${g.grade}학년` });
        }
      });
    });

    (orgStructure.departments || []).forEach(d => {
      if (d.headEmail && !seen.has(d.headEmail.toLowerCase())) {
        seen.add(d.headEmail.toLowerCase());
        list.push({ email: d.headEmail, name: `${d.name} 부장`, roleInfo: d.name });
      }
      (d.memberEmails || []).forEach(m => {
        if (!seen.has(m.toLowerCase())) {
          seen.add(m.toLowerCase());
          list.push({ email: m, name: m.split('@')[0], roleInfo: d.name });
        }
      });
    });

    return list.filter(t => t.email.toLowerCase() !== myEmail);
  }, [orgStructure, myEmail]);

  // 기존 제출 확인
  const existingSubmission = useMemo(() => {
    if (!task?.submissions) return null;
    // 1. 학년별 키 우선 검색
    const gradeKey = selectedGrade ? `${myEmail}_${selectedGrade}` : '';
    if (gradeKey && task.submissions[gradeKey]) {
      return task.submissions[gradeKey];
    }
    // 2. 이메일 키 검색
    return task.submissions[myEmail] || null;
  }, [task, myEmail, selectedGrade]);

  // 모달이 열리거나 task가 변경될 때 초기화
  useEffect(() => {
    if (task && open) {
      // 기존 제출된 학년이 있으면 그것을 쓰고, 없으면 나에게 할당된 학년(assignedGradeForMe)으로 설정
      const initialGrade = existingSubmission?.grade ? String(existingSubmission.grade) : (assignedGradeForMe || '1');
      setSelectedGrade(initialGrade);

      if (existingSubmission) {
        setNote(existingSubmission.note || '');
        setLinkUrl(existingSubmission.linkUrl || '');
        setLinkTitle(existingSubmission.linkTitle || '');
        setScenarios(existingSubmission.scenarios || []);
      } else {
        setNote('');
        setLinkUrl('');
        setLinkTitle('');
        // 체육행사/스포츠데이 관련 업무인 경우 기본 타임테이블 1~2개 템플릿 제공
        if (task.title.includes('스포츠') || task.title.includes('체육') || task.description.includes('타임테이블') || task.description.includes('시나리오')) {
          setScenarios([
            {
              id: uuidv4(),
              time: '09:00 ~ 09:40',
              program: '학년 단체 경기 (예: 볼풀공 던지기 / 줄다리기)',
              target: `${initialGrade}학년 전 학급`,
              rules: '학급별 토너먼트 또는 청백전 대항',
              preparations: '볼풀공 200개, 바구니 4개, 호루라기',
              note: '진행 담임교사 및 보조 인력 배치'
            },
            {
              id: uuidv4(),
              time: '09:50 ~ 10:30',
              program: '학년 개인/학급 대표 릴레이 경기',
              target: `${initialGrade}학년 학급별 대표`,
              rules: '트랙 1바퀴씩 주행 후 바톤 터치',
              preparations: '바톤 4개, 계측용 스톱워치',
              note: '결승선 심판 교사 배치'
            }
          ]);
        } else {
          setScenarios([]);
        }
      }
      setSelectedFile(null);
    }
  }, [task, open, existingSubmission, assignedGradeForMe]);

  if (!task) return null;

  // 전체 요일별/시간대별 체육행사 일정표 연동
  const eventSchedules = task.eventSchedules || [];

  const handleAddScenario = () => {
    setScenarios(prev => [
      ...prev,
      {
        id: uuidv4(),
        time: '10:00 ~ 10:40',
        program: '',
        target: `${selectedGrade}학년 전 학급`,
        rules: '',
        preparations: '',
        note: ''
      }
    ]);
  };

  const handleUpdateScenario = (id: string, field: keyof TaskScenarioItem, value: string) => {
    setScenarios(prev => prev.map(s => s.id === id ? { ...s, [field]: value } : s));
  };

  const handleRemoveScenario = (id: string) => {
    setScenarios(prev => prev.filter(s => s.id !== id));
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setSelectedFile(e.target.files[0]);
    }
  };

  // 상단 요일별 시간표 클릭 시 해당 일정 반영
  const handleSelectScheduleSlot = (sch: any) => {
    setScenarios(prev => [
      ...prev,
      {
        id: uuidv4(),
        time: sch.time || '09:00 ~ 11:30',
        program: sch.title || `${selectedGrade}학년 메인 경기 프로그램`,
        target: sch.target || `${selectedGrade}학년 전체`,
        rules: '세부 규칙 및 경기 진행 방식 입력',
        preparations: sch.location ? `장소: ${sch.location}` : '',
        note: '진행 교사 및 심판 배치'
      }
    ]);
    toast({ title: '일정표 시간대 반영 완료', description: `${sch.time} ${sch.title} 타임테이블이 추가되었습니다.` });
  };

  // 업무 위임 / 다른 교사에게 넘기기
  const handleDelegateSubmit = async () => {
    if (!delegateToEmail) {
      toast({ variant: 'destructive', title: '위임 대상 교사를 선택해주세요.' });
      return;
    }
    setIsDelegating(true);
    try {
      const targetTeacher = teacherList.find(t => t.email.toLowerCase() === delegateToEmail.toLowerCase());
      const targetName = targetTeacher?.name || delegateToEmail.split('@')[0];

      const res = await delegateDepartmentTask(
        task.id,
        myEmail,
        delegateToEmail,
        targetName,
        delegateReason.trim()
      );

      if (res.success) {
        toast({
          title: '업무 위임(이관) 완료',
          description: `${targetName} 선생님에게 업무가 성공적으로 이관되었습니다.`
        });
        setIsDelegateOpen(false);
        onOpenChange(false);
      } else {
        toast({ variant: 'destructive', title: '위임 실패', description: res.error });
      }
    } catch (e: any) {
      toast({ variant: 'destructive', title: '오류 발생', description: e.message });
    } finally {
      setIsDelegating(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    setIsSubmitting(true);
    try {
      let fileUrl = existingSubmission?.fileUrl;
      let fileName = existingSubmission?.fileName;

      if (selectedFile) {
        const uploadRes = await uploadTaskSubmissionFile(task.id, myEmail, selectedFile);
        if (!uploadRes.success) {
          toast({ variant: 'destructive', title: '파일 업로드 실패', description: uploadRes.error });
          setIsSubmitting(false);
          return;
        }
        fileUrl = uploadRes.fileUrl;
        fileName = uploadRes.fileName;
      }

      const submission: TaskSubmission = {
        submitterEmail: myEmail,
        submitterName: profile?.name || '교직원',
        submittedAt: new Date().toISOString(),
        status: 'submitted',
        fileUrl,
        fileName,
        linkUrl: linkUrl.trim() || undefined,
        linkTitle: linkTitle.trim() || (linkUrl.trim() ? '캔바/웹 발표자료' : undefined),
        note: note.trim(),
        grade: selectedGrade || myAssignedGrade || undefined,
        scenarios: scenarios.filter(s => s.program.trim() !== ''),
      };

      const res = await submitDepartmentTaskResponse(task.id, submission);
      if (res.success) {
        if (task.taskType === 'acknowledgment' || task.taskType === 'simple_check') {
          toast({ 
            title: '확인 완료', 
            description: note.trim() ? '작성하신 의견과 함께 확인 완료되었습니다.' : '확인 완료 처리되었습니다.' 
          });
        } else {
          toast({ 
            title: '세부계획 제출 완료', 
            description: `${selectedGrade}학년 세부 운영계획이 정상적으로 제출되었습니다.` 
          });
        }
        onOpenChange(false);
      } else {
        toast({ variant: 'destructive', title: '제출 실패', description: res.error });
      }
    } catch (err: any) {
      toast({ variant: 'destructive', title: '오류 발생', description: err.message });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto p-5 sm:p-6 rounded-2xl">
        <DialogHeader className="border-b pb-3">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-2">
              <Badge className="bg-indigo-600 text-white text-[10px] px-1.5 py-0 h-4 leading-none font-bold">
                {task.creatorDept || '부서 요청'}
              </Badge>
              {existingSubmission ? (
                <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-300 text-[10px] px-1.5 py-0 h-4 font-bold">
                  ✓ 제출 완료됨 (수정 가능)
                </Badge>
              ) : (
                <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-300 text-[10px] px-1.5 py-0 h-4 font-bold">
                  작성 대기 중
                </Badge>
              )}
            </div>

            {/* 업무 위임(다른 교사에게 넘기기) 버튼 */}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIsDelegateOpen(true)}
              className="h-7 text-xs font-bold text-slate-700 border-slate-300 hover:bg-slate-50 flex items-center gap-1 shadow-2xs"
            >
              <ArrowRightLeft className="w-3 h-3 text-indigo-600" />
              <span>업무 다른 교사에게 넘기기 (위임)</span>
            </Button>
          </div>

          <DialogTitle className="text-base sm:text-lg font-black text-slate-900 mt-1 leading-snug">
            {task.title}
          </DialogTitle>
          <DialogDescription className="text-xs text-slate-500 flex items-center gap-3 pt-1">
            <span className="flex items-center gap-1">
              <User className="w-3.5 h-3.5 text-slate-400" />
              요청자: <strong>{task.creatorName}</strong>
            </span>
            <span className="flex items-center gap-1 text-rose-600 font-semibold">
              <Calendar className="w-3.5 h-3.5" />
              제출 마감일: {task.deadline}
            </span>
          </DialogDescription>
        </DialogHeader>

        {/* 업무 위임(재할당) 모달 */}
        {isDelegateOpen && (
          <div className="p-4 bg-indigo-50/70 border border-indigo-200 rounded-xl space-y-3 animate-in fade-in">
            <div className="flex items-center justify-between">
              <p className="text-xs font-black text-indigo-950 flex items-center gap-1.5">
                <ArrowRightLeft className="w-4 h-4 text-indigo-600" />
                업무 다른 교사에게 넘기기 (위임/재할당)
              </p>
              <Button variant="ghost" size="sm" onClick={() => setIsDelegateOpen(false)} className="h-6 text-xs text-slate-400">닫기</Button>
            </div>
            <p className="text-[11px] text-slate-600 leading-tight">
              해당 학년의 다른 교사나 동료 선생님을 지정하여 업무를 넘길 수 있습니다. 위임 시 상대방의 '나에게 할당된 업무'로 즉시 이관됩니다.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label className="text-[11px] font-bold text-slate-700">이관받을 담당 교사</Label>
                <Select value={delegateToEmail} onValueChange={setDelegateToEmail}>
                  <SelectTrigger className="h-8 text-xs bg-white">
                    <SelectValue placeholder="교사 선택..." />
                  </SelectTrigger>
                  <SelectContent className="max-h-56">
                    {teacherList.map((t, idx) => (
                      <SelectItem key={`${t.email}-${idx}`} value={t.email} className="text-xs">
                        <span className="font-bold">{t.name}</span>{' '}
                        <span className="text-slate-400 text-[10px]">({t.email})</span>
                        {t.roleInfo && <Badge variant="secondary" className="ml-1 text-[9px]">{t.roleInfo}</Badge>}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-[11px] font-bold text-slate-700">위임 사유 및 전달 사항</Label>
                <Input
                  placeholder="예: 3학년 동학년 체육 담당 교사에게 위임합니다."
                  value={delegateReason}
                  onChange={e => setDelegateReason(e.target.value)}
                  className="h-8 text-xs bg-white"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <Button size="sm" variant="ghost" onClick={() => setIsDelegateOpen(false)} className="h-7 text-xs">취소</Button>
              <Button size="sm" onClick={handleDelegateSubmit} disabled={isDelegating || !delegateToEmail} className="h-7 text-xs bg-indigo-600 text-white font-bold">
                {isDelegating ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <UserCheck className="w-3 h-3 mr-1" />}
                위임 완료
              </Button>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 pt-1">
          {/* 요청 상세 안내 */}
          {task.description && (
            <div className="p-3 bg-slate-50 border border-slate-200/80 rounded-xl text-xs text-slate-700 leading-relaxed">
              <p className="font-bold text-slate-900 mb-1 flex items-center gap-1 text-[11px]">
                <AlertCircle className="w-3.5 h-3.5 text-indigo-600" />
                업무 요청 지침 및 안내:
              </p>
              <div className="whitespace-pre-wrap">{task.description}</div>
            </div>
          )}

          {/* 요청자가 등록한 참고자료 (공문, 운영계획서 PDF, 안내 이미지 등) */}
          {task.attachments && task.attachments.length > 0 && (
            <div className="p-3.5 bg-indigo-50/70 border border-indigo-200/80 rounded-xl space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-indigo-950 flex items-center gap-1.5">
                  <Paperclip className="w-3.5 h-3.5 text-indigo-600" />
                  요청자 첨부 참고자료 및 제출 서식 ({task.attachments.length}건)
                </span>
                <span className="text-[10px] text-indigo-600 font-semibold">서식 다운로드 및 필독 자료</span>
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
                      className="flex items-center gap-2.5 p-2 bg-white rounded-lg border border-indigo-200/80 hover:border-indigo-400 hover:shadow-2xs transition-all group cursor-pointer"
                    >
                      {att.isGoogleDrive ? (
                        <div className={cn("w-8 h-8 rounded-md flex items-center justify-center shrink-0 border", driveInfo?.bgColor, driveInfo?.borderColor)}>
                          {att.driveFileType === 'sheet' && <FileSpreadsheet className="w-4 h-4 text-emerald-700" />}
                          {att.driveFileType === 'doc' && <FileText className="w-4 h-4 text-blue-700" />}
                          {att.driveFileType === 'slide' && <Presentation className="w-4 h-4 text-amber-700" />}
                          {att.driveFileType === 'folder' && <Folder className="w-4 h-4 text-indigo-700" />}
                          {att.driveFileType === 'pdf' && <span className="text-[9px] font-black text-rose-700">PDF</span>}
                          {(!att.driveFileType || att.driveFileType === 'file') && <HardDrive className="w-4 h-4 text-slate-700" />}
                        </div>
                      ) : isImage ? (
                        <div className="w-8 h-8 rounded-md bg-slate-100 overflow-hidden shrink-0 border border-slate-200">
                          <img src={att.url} alt={att.name} className="w-full h-full object-cover" />
                        </div>
                      ) : isPdf ? (
                        <div className="w-8 h-8 rounded-md bg-rose-50 border border-rose-200 flex items-center justify-center shrink-0 text-[10px] font-black text-rose-600">
                          PDF
                        </div>
                      ) : (
                        <div className="w-8 h-8 rounded-md bg-indigo-50 border border-indigo-200 flex items-center justify-center shrink-0 text-indigo-600">
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
                          {att.isGoogleDrive ? 'Google Drive 클라우드 문서 · 클릭 시 열람' : (att.size ? `${(att.size / 1024).toFixed(1)} KB · 클릭 시 열람` : '첨부 파일 · 클릭 시 열람')}
                        </p>
                      </div>
                      <ExternalLink className="w-3.5 h-3.5 text-slate-400 group-hover:text-indigo-600 shrink-0" />
                    </a>
                  );
                })}
              </div>
            </div>
          )}

          {/* 구글 시트 / 협업 서식 배너 */}
          {task.sheetsConfig && (
            <div className={cn(
              "p-3.5 rounded-xl border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-2xs",
              task.sheetsConfig.mode === 'html_draft' 
                ? "bg-indigo-50/90 border-indigo-200 text-indigo-950" 
                : "bg-emerald-50/90 border-emerald-200 text-emerald-950"
            )}>
              <div className="space-y-0.5">
                <div className="flex items-center gap-1.5 font-black text-xs">
                  {task.sheetsConfig.mode === 'html_draft' ? (
                    <Sparkles className="w-4 h-4 text-indigo-600" />
                  ) : (
                    <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                  )}
                  <span>
                    {task.sheetsConfig.mode === 'custom' && (
                      task.sheetsConfig.sheetUrl?.includes('docs.google.com/forms') 
                        ? 'Google Forms 설문지 응답 업무' 
                        : '사용자 문서/시트 링크형 협업 업무'
                    )}
                    {task.sheetsConfig.mode === 'template' && (task.sheetsConfig.templateName ? `${task.sheetsConfig.templateName} (표준 시트)` : '표준 시트 양식 배포 업무')}
                    {task.sheetsConfig.mode === 'html_draft' && '기안문 붙임 문서 자동 생성형 업무'}
                  </span>
                </div>
                <p className="text-[11px] opacity-80 leading-tight">
                  {task.sheetsConfig.mode === 'custom' && (
                    task.sheetsConfig.sheetUrl?.includes('docs.google.com/forms')
                      ? '요청자가 배포한 구글 설문지 링크에 접속하여 설문 문항에 응답해주세요.'
                      : '요청자가 지정한 구글 문서/시트 링크에 접속하여 본인 담당 내용을 직접 입력해주세요.'
                  )}
                  {task.sheetsConfig.mode === 'template' && '배포된 표준 구글 시트 링크에 접속하여 내용을 입력하거나 아래 양식을 확인 후 제출해주세요.'}
                  {task.sheetsConfig.mode === 'html_draft' && '하단에 입력하신 세부 내용이 공문서 무테 표로 자동 취합되어 원클릭 결재 상신에 반영됩니다.'}
                </p>
                {task.sheetsConfig.columnDefs && task.sheetsConfig.columnDefs.length > 0 ? (
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {task.sheetsConfig.columnDefs.map((colDef: any) => (
                      <span key={colDef.id || colDef.name} className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] bg-white border border-indigo-200 text-indigo-950 rounded-lg font-bold shadow-2xs">
                        <span>{colDef.name}</span>
                        {colDef.guide && <span className="text-[9px] text-indigo-500 font-normal">({colDef.guide})</span>}
                      </span>
                    ))}
                  </div>
                ) : (task.sheetsConfig.columns && task.sheetsConfig.columns.length > 0 && (
                  <div className="flex flex-wrap gap-1 pt-1">
                    {task.sheetsConfig.columns.map((col: string) => (
                      <span key={col} className="px-1.5 py-0.5 text-[9px] bg-white/80 border border-current/20 rounded font-semibold">
                        {col}
                      </span>
                    ))}
                  </div>
                ))}
              </div>

              {task.sheetsConfig.sheetUrl && (
                <a
                  href={task.sheetsConfig.sheetUrl}
                  target="_blank"
                  rel="noreferrer"
                  className={cn(
                    "px-3 py-2 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shrink-0 shadow-xs transition-colors",
                    task.sheetsConfig.sheetUrl.includes('docs.google.com/forms')
                      ? "bg-purple-600 hover:bg-purple-700"
                      : "bg-emerald-600 hover:bg-emerald-700"
                  )}
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>
                    {task.sheetsConfig.sheetUrl.includes('docs.google.com/forms')
                      ? 'Google 설문지 바로 열기'
                      : 'Google Sheets 바로 열기'}
                  </span>
                </a>
              )}
            </div>
          )}

          {/* 0. 체육행사 전체 요일별/시간대별 일정표 협의 및 원클릭 타임테이블 선택 */}
          {eventSchedules.length > 0 && (
            <div className="p-3 bg-blue-50/60 border border-blue-200 rounded-xl space-y-2">
              <p className="text-xs font-black text-blue-950 flex items-center gap-1.5">
                <CalendarDays className="w-4 h-4 text-blue-600" />
                체육교사가 배정한 학년별 운영 요일 및 시간표 (원클릭 추가 지원)
              </p>
              <p className="text-[11px] text-blue-800 leading-tight">
                자신의 학년에 해당하는 배정 시간표를 클릭하면 하단 세부 운영 시나리오에 해당 시간대가 자동으로 입력됩니다.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                {eventSchedules.map((sch: any, idx: number) => (
                  <div
                    key={sch.id || idx}
                    onClick={() => handleSelectScheduleSlot(sch)}
                    className="p-2.5 bg-white border border-blue-200 rounded-lg hover:border-blue-500 hover:shadow-xs transition-all cursor-pointer flex items-center justify-between text-xs"
                  >
                    <div>
                      <div className="flex items-center gap-1.5 font-black text-slate-900">
                        <span className="text-blue-600">{sch.date}</span>
                        <span>{sch.time}</span>
                      </div>
                      <p className="text-[11px] text-slate-600 font-medium truncate">{sch.title}</p>
                      <p className="text-[10px] text-slate-400">대상: {sch.target} | 장소: {sch.location || '체육관/운동장'}</p>
                    </div>
                    <Badge variant="outline" className="text-[10px] bg-blue-50 text-blue-700 font-bold shrink-0 ml-1">
                      + 선택
                    </Badge>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── [CASE A] 단순 확인 완료형 (acknowledgment / simple_check) 전용 UI ── */}
          {(task.taskType === 'acknowledgment' || task.taskType === 'simple_check') ? (
            <div className="space-y-4 py-2">
              <div className="p-4 bg-indigo-50/70 border border-indigo-200 rounded-2xl space-y-2">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5 text-indigo-600 shrink-0" />
                  <h4 className="font-bold text-sm text-indigo-950">공지 및 지침 확인 완료 처리</h4>
                </div>
                <p className="text-xs text-indigo-800 leading-relaxed">
                  상단에 등록된 업무 안내 사항 및 참고자료(첨부파일)를 충분히 숙지하셨으면 확인 완료를 진행해주세요.
                  전달할 의견이나 소견이 있는 경우 하단에 선택적으로 작성하여 함께 제출하실 수 있습니다.
                </p>
              </div>

              {/* 의견 첨부 (선택) */}
              <div className="p-4 bg-white border border-slate-200 rounded-2xl space-y-2 shadow-2xs">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                    <MessageSquare className="w-3.5 h-3.5 text-indigo-600" />
                    <span>의견 첨부 (선택)</span>
                  </Label>
                  <span className="text-[11px] text-slate-400">
                    {note.trim() ? `${note.length}자 입력됨` : '미작성 시 확인만 완료'}
                  </span>
                </div>
                <Textarea
                  value={note}
                  onChange={e => setNote(e.target.value)}
                  placeholder="요청 부서나 관리자에게 전달할 의견, 건의사항, 또는 확인 소견이 있으시면 입력해주세요. (작성하지 않고 확인만 하셔도 됩니다)"
                  rows={3}
                  className="text-xs resize-none rounded-xl"
                />
                <p className="text-[10.5px] text-slate-400">
                  * 작성된 의견은 요청 부서의 취합 현황에 함께 기록됩니다.
                </p>
              </div>

              <DialogFooter className="border-t pt-3 flex items-center justify-between gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => onOpenChange(false)}
                  disabled={isSubmitting}
                  className="text-xs rounded-xl"
                >
                  닫기
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  disabled={isSubmitting}
                  className="h-8 px-4 text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl shadow-xs flex items-center gap-1.5 cursor-pointer"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" />
                      처리 중...
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-3.5 h-3.5 mr-0.5" />
                      <span>{note.trim() ? '의견과 함께 확인 완료' : '확인 완료'}</span>
                    </>
                  )}
                </Button>
              </DialogFooter>
            </div>
          ) : (
            <>
              {/* 대상 학년 선택 */}
              <div className="flex items-center gap-3 p-2.5 bg-slate-50 border border-slate-200 rounded-xl">
                <Label className="text-xs font-bold text-slate-700 shrink-0">작성 학년 구분:</Label>
                <div className="flex items-center gap-1.5 flex-wrap">
                  {['1', '2', '3', '4', '5', '6'].map(g => (
                    <button
                      key={g}
                      type="button"
                      onClick={() => setSelectedGrade(g)}
                      className={cn(
                        "px-2.5 py-1 text-xs font-bold rounded-lg border transition-all",
                        selectedGrade === g
                          ? "bg-indigo-600 text-white border-indigo-600 shadow-2xs"
                          : "bg-white text-slate-600 border-slate-200 hover:border-slate-300"
                      )}
                    >
                      {g}학년
                    </button>
                  ))}
                </div>
              </div>

              {/* 1. 학년 세부계획 타임테이블(시나리오) 작성 영역 */}
              <div className="bg-slate-50/70 p-3.5 rounded-xl border border-slate-200/80 space-y-3">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-black text-slate-800 flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-indigo-600" />
                    1. {selectedGrade}학년 세부 운영 타임테이블 (시나리오) ({scenarios.length}개)
                  </Label>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={handleAddScenario}
                    className="h-6 px-2 text-[11px] font-bold text-indigo-600 border-indigo-200 hover:bg-indigo-50 flex items-center gap-1"
                  >
                    <Plus className="w-3 h-3" />
                    프로그램/시나리오 추가
                  </Button>
                </div>

                <div className="space-y-2.5">
                  {scenarios.map((sc, idx) => (
                    <div key={sc.id} className="bg-white p-3 rounded-lg border border-slate-200 shadow-2xs space-y-2 text-xs">
                      <div className="flex items-center justify-between gap-2 border-b pb-1.5">
                        <div className="flex items-center gap-2 flex-1">
                          <Badge variant="secondary" className="text-[10px] font-bold">
                            #{idx + 1}
                          </Badge>
                          <Input
                            placeholder="시간대 (예: 09:00 ~ 09:40)"
                            value={sc.time}
                            onChange={e => handleUpdateScenario(sc.id, 'time', e.target.value)}
                            className="h-7 text-xs w-[140px] font-medium"
                          />
                          <Input
                            placeholder="세부 경기/프로그램명 (예: 볼풀공 던지기)"
                            value={sc.program}
                            onChange={e => handleUpdateScenario(sc.id, 'program', e.target.value)}
                            className="h-7 text-xs font-bold flex-1"
                          />
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => handleRemoveScenario(sc.id)}
                          className="h-6 px-1.5 text-rose-500 hover:text-rose-700 hover:bg-rose-50"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <div className="space-y-1">
                          <span className="text-[10px] font-bold text-slate-500">경기 규칙 및 진행 요령 (시나리오)</span>
                          <Input
                            placeholder="예: 청백 대항전, 호루라기 신호 후 2분간 투척"
                            value={sc.rules || ''}
                            onChange={e => handleUpdateScenario(sc.id, 'rules', e.target.value)}
                            className="h-7 text-xs"
                          />
                        </div>
                        <div className="space-y-1">
                          <span className="text-[10px] font-bold text-slate-500">필요 준비물 / 비품 및 교사 배치</span>
                          <Input
                            placeholder="예: 볼풀공 200개, 바구니 4개, 호루라기, 담임 4명 배치"
                            value={sc.preparations || ''}
                            onChange={e => handleUpdateScenario(sc.id, 'preparations', e.target.value)}
                            className="h-7 text-xs"
                          />
                        </div>
                      </div>
                    </div>
                  ))}

                  {scenarios.length === 0 && (
                    <div className="p-3 text-center text-xs text-slate-400 bg-white rounded-lg border border-dashed">
                      상단의 [프로그램/시나리오 추가] 버튼을 눌러 학년별 경기 타임테이블과 진행 시나리오를 작성하세요.
                    </div>
                  )}
                </div>
              </div>

              {/* 2. PPT 파일 첨부 및 캔바(Canva)/웹 링크 연결 영역 */}
              <div className="bg-slate-50/70 p-3.5 rounded-xl border border-slate-200/80 space-y-3">
                <Label className="text-xs font-black text-slate-800 flex items-center gap-1.5">
                  <Presentation className="w-3.5 h-3.5 text-indigo-600" />
                  2. 행사 진행용 PPT 파일 첨부 또는 캔바(Canva) 웹 링크 연결
                </Label>
                
                {/* 기존 파일 확인 */}
                {existingSubmission?.fileUrl && !selectedFile && (
                  <div className="p-2.5 bg-emerald-50/80 border border-emerald-200 rounded-lg flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2 text-emerald-800 truncate">
                      <FileText className="w-4 h-4 text-emerald-600 shrink-0" />
                      <span className="font-bold truncate">{existingSubmission.fileName || '첨부된 PPT 파일'}</span>
                    </div>
                    <a
                      href={existingSubmission.fileUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[11px] text-emerald-700 underline shrink-0 hover:text-emerald-900 font-bold ml-2"
                    >
                      기존 파일 확인
                    </a>
                  </div>
                )}

                {/* 파일 선택 */}
                <div className="space-y-1">
                  <span className="text-[10px] font-bold text-slate-500">1) 파일 직접 업로드 (PPT, PDF, 한글 등)</span>
                  <Input
                    type="file"
                    id="task-file-input"
                    onChange={handleFileChange}
                    accept=".ppt,.pptx,.pdf,.xlsx,.xls,.hwp,.hwpx,.doc,.docx,.png,.jpg"
                    className="h-8 text-xs bg-white cursor-pointer"
                  />
                </div>

                {/* 캔바 / 웹 링크 연결 */}
                <div className="space-y-1 pt-1 border-t border-slate-200/80">
                  <span className="text-[10px] font-bold text-slate-500 flex items-center gap-1">
                    <LinkIcon className="w-3 h-3 text-indigo-600" />
                    2) 캔바(Canva), 노션, 구글 슬라이드 공유 링크 연결
                  </span>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <Input
                      placeholder="링크 제목 (예: 1학년 캔바 진행 PPT)"
                      value={linkTitle}
                      onChange={e => setLinkTitle(e.target.value)}
                      className="h-8 text-xs bg-white"
                    />
                    <Input
                      placeholder="공유 웹 URL (https://www.canva.com/...)"
                      value={linkUrl}
                      onChange={e => setLinkUrl(e.target.value)}
                      className="h-8 text-xs bg-white sm:col-span-2 font-mono"
                    />
                  </div>
                </div>

                <p className="text-[10px] text-slate-400">
                  * 파일이나 웹 링크가 없는 경우 공문서 및 취합 화면에 <strong>'참고자료 없음'</strong>으로 자동 표기됩니다.
                </p>
              </div>

          {/* 3. 기타 건의사항 및 특이사항 메모 */}
          <div className="space-y-1">
            <Label className="text-xs font-bold text-slate-700">
              3. 기타 협조 요청 및 특이사항 메모
            </Label>
            <Textarea
              value={note}
              onChange={e => setNote(e.target.value)}
              placeholder="체육교사 또는 주최 부서에 전달할 학년별 특이사항(학생 건강 주의자, 시설 사용 조율 등)을 입력하세요."
              rows={2}
              className="text-xs resize-none"
            />
          </div>

          <DialogFooter className="border-t pt-3 flex items-center justify-between gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
              className="text-xs"
            >
              취소
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={isSubmitting}
              className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs flex items-center gap-1 shadow-xs"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>제출 처리 중...</span>
                </>
              ) : (
                <>
                  <FileUp className="w-3.5 h-3.5" />
                  <span>{existingSubmission ? `${selectedGrade}학년 세부계획 수정 제출` : `${selectedGrade}학년 세부계획 제출하기`}</span>
                </>
              )}
            </Button>
          </DialogFooter>
        </>
      )}
    </form>
  </DialogContent>
</Dialog>
  );
}
