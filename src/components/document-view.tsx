'use client';

import { ApprovalDoc, DocConfig } from '@/lib/types';
import { useAuth } from '@/hooks/use-auth';
import { useToast } from '@/hooks/use-toast';
import { approveDocument, rejectDocument, recallDocument, deleteDocument } from '@/lib/services/documentService';
import { getUserProfileByEmail } from '@/lib/services/userService';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { CheckCircle2, Loader2, XCircle, Undo2, Edit, CopyPlus, AlertTriangle, Paperclip, Trash2, Lock, Download, FileCheck, Printer } from 'lucide-react';
import { format } from 'date-fns';
import { useState, useTransition, useEffect } from 'react';
import Link from 'next/link'; 
import { useRouter, usePathname } from 'next/navigation'; 
import { exportA4PagesToPdf } from '@/lib/pdf-export'; 
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
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { ParentFormView } from './parent-form-view';
import { ParentNotificationModal } from './parent-notification-modal';
import { TeacherDutyView } from './teacher-duty-view';
import { TeacherOvertimeView } from './teacher-overtime-view';
import { AfterschoolFormView } from './afterschool-form-view';
import { formatOfficialDocumentHtml } from '@/lib/documentFormatter';
import { useRef } from 'react';
type DocumentViewProps = {
  initialDoc: ApprovalDoc;
  initialConfig: DocConfig;
};

export default function DocumentView({ initialDoc, initialConfig }: DocumentViewProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, profile } = useAuth();
  const { toast } = useToast();
  const [isApproving, startApproveTransition] = useTransition();
  const [isRejecting, startRejectTransition] = useTransition();
  const [isRecalling, startRecallTransition] = useTransition();
  const [isDeleting, startDeleteTransition] = useTransition();
  
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');
  
  const isTeacherParentTurn = initialDoc.status === 'pending' && 
                              initialDoc.approvers[initialDoc.currentStep]?.email?.trim().toLowerCase() === user?.email?.trim().toLowerCase() &&
                              Boolean(initialDoc.approvers[initialDoc.currentStep]?.role?.includes('담임')) &&
                              initialDoc.docType === 'parent';

  const isTeacherTurn = isTeacherParentTurn && initialDoc.parentFormData?.type === 'absence';
                        
  const defaultApplyDateStr = initialDoc.parentFormData?.applyDate || 
    (initialDoc.createdAt ? format(new Date(initialDoc.createdAt), 'yyyy-MM-dd') : format(new Date(), 'yyyy-MM-dd'));

  const [approvalDateOverride, setApprovalDateOverride] = useState<string>(defaultApplyDateStr);
  const [showTeacherApproveModal, setShowTeacherApproveModal] = useState(false);

  const [teacherConfirmData, setTeacherConfirmData] = useState({
    absenceType: initialDoc.parentFormData?.absenceType || '병결',
    confirmMethod: initialDoc.parentFormData?.teacherConfirmMethod || '전화/문자',
    confirmDate: initialDoc.parentFormData?.teacherConfirmDate || defaultApplyDateStr
  });

  const [showNotificationModal, setShowNotificationModal] = useState(false);
  const [approverSignatures, setApproverSignatures] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!initialDoc?.approvers) return;
    const emails = initialDoc.approvers.map(a => a.email?.trim().toLowerCase()).filter(Boolean) as string[];
    if (emails.length === 0) return;
    
    Promise.all(emails.map(email => getUserProfileByEmail(email)))
      .then(profiles => {
        const sigs: Record<string, string> = {};
        profiles.forEach(p => {
          if (p && p.signature && p.email) {
            sigs[p.email.trim().toLowerCase()] = p.signature;
          }
        });
        setApproverSignatures(sigs);
      })
      .catch(err => console.error("Failed to load approver signatures:", err));
  }, [initialDoc]);
  const handlePrint = () => {
    window.print();
  };

  if (!user || !profile || !initialDoc) return (
    <div className="flex h-full w-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
    </div>
  );

  const normalizedUserEmail = user.email?.trim().toLowerCase();
  const normalizedProfileEmail = profile.email?.trim().toLowerCase();
  const userName = profile.name?.trim();

  const isRequester = Boolean(
    initialDoc.requesterId === user?.uid || 
    (normalizedUserEmail && initialDoc.requesterEmail?.trim().toLowerCase() === normalizedUserEmail) ||
    (normalizedProfileEmail && initialDoc.requesterEmail?.trim().toLowerCase() === normalizedProfileEmail) ||
    (initialDoc.docType === 'parent' && (profile.role === '학부모' || !profile.role || profile.isAdmin))
  );
  
  const isApprover = initialDoc.approvers?.some(ap => {
      const apEmail = ap.email?.trim().toLowerCase();
      const apName = ap.name?.trim();
      return (normalizedUserEmail && apEmail && apEmail === normalizedUserEmail) ||
             (normalizedProfileEmail && apEmail && apEmail === normalizedProfileEmail) ||
             (userName && apName && apName === userName);
  }) ?? false;

  const isCircular = initialDoc.circulars?.some(c => {
      const cEmail = c.email?.trim().toLowerCase();
      const cName = c.name?.trim();
      return (normalizedProfileEmail && cEmail && cEmail === normalizedProfileEmail) ||
             (userName && cName && cName === userName);
  }) ?? false;

  const isParentPortal = Boolean(
    pathname?.startsWith('/parents') || 
    (profile?.role === '학부모' && !pathname?.startsWith('/documents'))
  );

  let hasViewPermission = false;
  if (profile.isAdmin) hasViewPermission = true;
  else if (initialDoc.docType === 'parent') hasViewPermission = true;
  else if (initialDoc.status === 'recalled') hasViewPermission = isRequester;
  else if (initialDoc.status === 'approved') {
      if (initialDoc.publishStatus === '공개' || initialDoc.publishStatus === '부분공개') hasViewPermission = true;
      else hasViewPermission = isRequester || isApprover || isCircular;
  } else hasViewPermission = isRequester || isApprover || isCircular;

  const hasAttachmentPermission = Boolean(
    initialDoc.publishStatus !== '부분공개' || 
    isRequester || 
    isApprover || 
    isCircular || 
    profile.isAdmin
  );
  
  if (!hasViewPermission) {
      return (
          <div className="flex h-full w-full items-center justify-center p-8">
              <Alert variant="destructive" className="max-w-md">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertTitle>열람 제한</AlertTitle>
                  <AlertDescription>이 문서를 열람할 권한이 없습니다.</AlertDescription>
              </Alert>
          </div>
      );
  }

  const currentAp = initialDoc.approvers[initialDoc.currentStep];
  const currentApEmail = currentAp?.email?.trim().toLowerCase();
  const currentApName = currentAp?.name?.trim();

  const isMyTurn = initialDoc.status === 'pending' && (
      (normalizedUserEmail && currentApEmail && currentApEmail === normalizedUserEmail) ||
      (normalizedProfileEmail && currentApEmail && currentApEmail === normalizedProfileEmail) ||
      (userName && currentApName && currentApName === userName)
  );
  const canRecall = isRequester && initialDoc.status === 'pending';
  const isRecalled = initialDoc.status === 'recalled';
  const isRejected = initialDoc.status === 'rejected';
  const isApproved = initialDoc.status === 'approved';
  const isFamily = initialDoc.category === 'family';

  const approvalDate = initialDoc.completedAt 
    ? new Date(initialDoc.completedAt as string) 
    : (initialDoc.createdAt ? new Date(initialDoc.createdAt as string) : new Date());
    
  const assistant = initialDoc.approvers.find(a => a.role === '협조');
  const mainApprovers = initialDoc.approvers.filter(a => a.role !== '협조');

  const isPrincipalRole = (role?: string) => {
    if (!role) return false;
    const r = role.trim();
    return r === '교장' || r === '학교장' || r === '원장' || r === '대표';
  };

  const getTypeText = (type: string, role?: string) => {
    if (isPrincipalRole(role)) return '';
    return type === 'final' ? '전결' : type === 'proxy' ? '대결' : '';
  };

  const containerMaxWidth = (initialDoc.docType === 'teacher-duty' || initialDoc.docType === 'teacher-overtime') ? 'max-w-full' : 'max-w-[210mm]';

  const executeApprove = (overrideDate?: string) => {
    if (!profile?.signature) {
      toast({
        variant: 'destructive',
        title: '결재 불가',
        description: '서명이 등록되어 있지 않습니다. 우측 상단 프로필에서 서명을 먼저 등록해 주세요.'
      });
      return;
    }
    
    if (isTeacherTurn) {
      if (!teacherConfirmData.confirmMethod) {
        toast({ variant: 'destructive', title: '입력 오류', description: '확인서 내용을 먼저 입력해 주세요. (확인방법)' });
        return;
      }
      if (!teacherConfirmData.confirmDate) {
        toast({ variant: 'destructive', title: '입력 오류', description: '확인일시를 입력해 주세요.' });
        return;
      }
    }

    startApproveTransition(async () => {
      const finalDate = overrideDate || approvalDateOverride;
      const parentUpdateData: any = {};
      if (isTeacherTurn) {
        parentUpdateData.absenceType = teacherConfirmData.absenceType;
        parentUpdateData.teacherConfirmMethod = teacherConfirmData.confirmMethod;
        parentUpdateData.teacherConfirmDate = teacherConfirmData.confirmDate || finalDate;
      }
      if (isTeacherParentTurn && finalDate) {
        parentUpdateData.applyDate = finalDate;
      }

      const result = await approveDocument(
        initialDoc.id, 
        profile, 
        Object.keys(parentUpdateData).length > 0 ? parentUpdateData : undefined,
        isTeacherParentTurn ? finalDate : undefined
      );

      if (result.success) { 
        toast({ title: '결재 완료!' }); 
        setShowTeacherApproveModal(false);
        router.push('/inbox');
        router.refresh();
      } else { 
        toast({ variant: 'destructive', title: '결재 실패', description: result.error }); 
      }
    });
  };

  const handleApprove = () => {
    if (isTeacherParentTurn) {
      setShowTeacherApproveModal(true);
      return;
    }
    executeApprove();
  };
  
  const handleReject = () => {
    if (!rejectionReason) { toast({ variant: 'destructive', title: '반려 사유 입력 필요' }); return; }
    startRejectTransition(async () => {
        const result = await rejectDocument(initialDoc.id, profile, rejectionReason);
        if (result.success) { 
          toast({ title: '반려됨' }); 
          setShowRejectModal(false); 
          router.push('/inbox');
          router.refresh();
        } else { 
          toast({ variant: 'destructive', title: '반려 실패', description: result.error }); 
        }
    });
  };

  const handleRecall = () => {
    startRecallTransition(async () => {
        const identifier = user.email || user.uid;
        const result = await recallDocument(initialDoc.id, identifier);
        if (result.success) { 
          toast({ title: '회수 완료' }); 
          if (initialDoc.docType === 'parent' || profile?.role === '학부모') {
            router.push('/parents/history');
          } else {
            router.push('/recalled');
          }
          router.refresh();
        } else { 
          toast({ variant: 'destructive', title: '회수 실패', description: result.error }); 
        }
    });
  };

  const handleDelete = () => {
    if (!window.confirm("문서를 완전히 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.")) return;
    startDeleteTransition(async () => {
        const identifier = profile?.email || user?.email || user?.uid || '';
        const result = await deleteDocument(initialDoc.id, identifier, !!profile?.isAdmin);
        if (result.success) { 
          toast({ title: '삭제 완료' }); 
          if (initialDoc.docType === 'parent' || profile?.role === '학부모') {
            router.push('/parents/history');
          } else {
            router.push('/recalled');
          }
          router.refresh();
        } else { 
          toast({ variant: 'destructive', title: '삭제 실패', description: result.error }); 
        }
    });
  };

  const downloadFile = async (file: { data: string; name: string }) => {
    if (!hasAttachmentPermission) {
      toast({ variant: 'destructive', title: '권한 없음', description: '첨부파일을 다운로드할 권한이 없습니다.' });
      return;
    }
    try {
      if (file.data && file.data.startsWith('data:')) {
        const res = await fetch(file.data);
        const blob = await res.blob();
        const blobUrl = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = blobUrl;
        link.download = file.name;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
      } else {
        const link = document.createElement('a');
        link.href = file.data;
        link.download = file.name;
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }
    } catch (e) {
      console.error("Download Error:", e);
      window.open(file.data, '_blank');
    }
  };

  const handleBypassApprove = () => {
    if (process.env.NODE_ENV !== 'development') return;
    
    const activeApprover = initialDoc.approvers[initialDoc.currentStep];
    if (!activeApprover) {
      toast({ variant: 'destructive', title: '에러', description: '진행 중인 결재선이 없습니다.' });
      return;
    }

    startApproveTransition(async () => {
      const mockProfile = {
        email: activeApprover.email,
        name: activeApprover.name || activeApprover.role,
        role: activeApprover.role,
        uid: (activeApprover as any).uid || 'mock_uid_' + activeApprover.role
      };
      
      const parentUpdateData = activeApprover.role === '담임' && initialDoc.parentFormData?.type === 'absence' ? {
        absenceType: teacherConfirmData.absenceType,
        teacherConfirmMethod: teacherConfirmData.confirmMethod || '유선연락',
        teacherConfirmDate: teacherConfirmData.confirmDate || format(new Date(), 'yyyy-MM-dd')
      } : undefined;

      const result = await approveDocument(initialDoc.id, mockProfile as any, parentUpdateData);
      if (result.success) {
        toast({ title: `[개발자 우회] ${activeApprover.role}(${activeApprover.name || ''}) 결재 승인 완료!` });
        window.location.reload();
      } else {
        toast({ variant: 'destructive', title: '우회 결재 실패', description: result.error });
      }
    });
  };

  const handleBypassReject = () => {
    if (process.env.NODE_ENV !== 'development') return;

    const activeApprover = initialDoc.approvers[initialDoc.currentStep];
    if (!activeApprover) return;

    const reason = window.prompt("[개발자 우회] 반려 사유를 입력해 주세요:", "테스트 반려 처리");
    if (reason === null) return;

    startRejectTransition(async () => {
      const mockProfile = {
        email: activeApprover.email,
        name: activeApprover.name || activeApprover.role,
        role: activeApprover.role,
        uid: (activeApprover as any).uid || 'mock_uid_' + activeApprover.role
      };

      const result = await rejectDocument(initialDoc.id, mockProfile as any, reason);
      if (result.success) {
        toast({ title: `[개발자 우회] ${activeApprover.role} 반려 완료!` });
        window.location.reload();
      } else {
        toast({ variant: 'destructive', title: '우회 반려 실패', description: result.error });
      }
    });
  };

  const [isPdfGenerating, setIsPdfGenerating] = useState(false);
  const [pdfStatusText, setPdfStatusText] = useState('');

  const handlePdfDownload = async () => {
    try {
      setIsPdfGenerating(true);
      setPdfStatusText('PDF 변환 준비 중...');
      
      const docTypeTitle = initialDoc.title || (initialDoc.docType === 'parent' ? (initialDoc.parentFormData?.type === 'absence' ? '결석계' : '교외체험학습 신청서') : '공문서');
      const studentName = initialDoc.parentFormData?.studentName ? `_${initialDoc.parentFormData.studentName}` : '';
      const fileName = `${docTypeTitle}${studentName}_${format(new Date(), 'yyyyMMdd')}.pdf`;

      // 1. 화면에 렌더링된 학부모 서식 A4 시트들 (.a4-print-sheet)
      const sheets = Array.from(document.querySelectorAll<HTMLElement>('.parent-form-view-wrapper .a4-print-sheet'));

      if (sheets.length > 0) {
        await exportA4PagesToPdf(sheets, fileName, (msg) => setPdfStatusText(msg));
        toast({ title: 'PDF 다운로드 완료', description: `${fileName} 파일이 성공적으로 다운로드되었습니다.` });
        return;
      }

      // 2. 일반 공문서 또는 교원 결재 서식
      const targetElement = document.getElementById('a4-document-paper') || document.querySelector<HTMLElement>('.printable-area');
      if (targetElement) {
        await exportA4PagesToPdf([targetElement], fileName, (msg) => setPdfStatusText(msg));
        toast({ title: 'PDF 다운로드 완료', description: `${fileName} 파일이 성공적으로 다운로드되었습니다.` });
        return;
      }

      toast({ variant: 'destructive', title: 'PDF 생성 불가', description: '화면에서 인쇄할 문서 요소를 찾지 못했습니다.' });
    } catch (err: any) {
      console.error('PDF generation error:', err);
      toast({ variant: 'destructive', title: 'PDF 생성 오류', description: err.message || 'PDF 생성 중 문제가 발생했습니다.' });
    } finally {
      setIsPdfGenerating(false);
      setPdfStatusText('');
    }
  };



  return (
    <div className="relative w-full bg-muted/30 py-4 sm:py-8 min-h-screen print:bg-white print:py-0 print:min-h-0 print:block">
        <div className={`print:hidden flex flex-wrap justify-between sm:justify-end items-center gap-2 mb-4 sm:mb-6 ${containerMaxWidth} mx-auto px-2 sm:px-4`}>
             {process.env.NODE_ENV === 'development' && initialDoc.status === 'pending' && (
                 <div className="w-full sm:w-auto flex flex-wrap gap-1.5 p-1 border border-amber-200 bg-amber-50 rounded-xl shadow-inner sm:mr-auto items-center">
                     <span className="text-[10px] text-amber-800 font-bold px-1.5">🛠️ 우회 결재:</span>
                     <Button 
                         variant="outline" 
                         onClick={handleBypassApprove}
                         className="bg-amber-600 hover:bg-amber-700 text-white text-xs h-7 px-2.5 border-none font-bold rounded-lg"
                         disabled={isApproving}
                     >
                         {isApproving ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : null}
                         강제 승인 ({initialDoc.approvers[initialDoc.currentStep]?.role})
                     </Button>
                     <Button 
                         variant="outline" 
                         onClick={handleBypassReject}
                         className="bg-red-600 hover:bg-red-700 text-white text-xs h-7 px-2.5 border-none font-bold rounded-lg"
                         disabled={isRejecting}
                     >
                         강제 반려
                     </Button>
                 </div>
             )}

            <div className="flex items-center gap-2 ml-auto flex-wrap">
              {canRecall && (
                  <AlertDialog>
                      <AlertDialogTrigger asChild><Button variant="outline" size="sm" className="h-8 text-xs font-bold" disabled={isRecalling}>회수하기</Button></AlertDialogTrigger>
                      <AlertDialogContent>
                          <AlertDialogHeader><AlertDialogTitle>회수하시겠습니까?</AlertDialogTitle></AlertDialogHeader>
                          <AlertDialogFooter><AlertDialogCancel>취소</AlertDialogCancel><AlertDialogAction onClick={handleRecall}>확인</AlertDialogAction></AlertDialogFooter>
                      </AlertDialogContent>
                  </AlertDialog>
              )}

              {(isRecalled || isRejected) && isRequester && (
                  <>
                  <Button asChild variant="default" size="sm" className="h-8 text-xs shadow-sm cursor-pointer bg-primary hover:bg-primary/90 text-primary-foreground font-bold">
                      <Link href={
                        initialDoc.docType === 'parent' 
                          ? `/parents/apply?type=${initialDoc.parentFormData?.type || 'field-trip'}&cloneId=${initialDoc.id}`
                          : initialDoc.docType === 'teacher-duty'
                          ? `/teacher/duty?cloneId=${initialDoc.id}`
                          : initialDoc.docType === 'teacher-overtime'
                          ? `/teacher/overtime?cloneId=${initialDoc.id}`
                          : initialDoc.docType === 'teacher-afterschool'
                          ? `/teacher/afterschool/new?cloneId=${initialDoc.id}`
                          : `/edit/${initialDoc.id}`
                      }>
                          <Edit className="mr-1.5 h-3.5 w-3.5" />
                          수정 및 재기안
                      </Link>
                  </Button>
                  <Button variant="destructive" size="sm" className="h-8 text-xs shadow-sm cursor-pointer font-bold" onClick={handleDelete} disabled={isDeleting}>
                      {isDeleting ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Trash2 className="mr-1.5 h-3.5 w-3.5" />}
                      삭제
                  </Button>
                  </>
              )}

              {isApproved && isRequester && (
                  <Button asChild variant="default" size="sm" className="h-8 text-xs shadow-sm cursor-pointer font-bold">
                      <Link href={
                        initialDoc.docType === 'parent' 
                          ? `/parents/apply?type=${initialDoc.parentFormData?.type || 'field-trip'}&cloneId=${initialDoc.id}`
                          : initialDoc.docType === 'teacher-duty'
                          ? `/teacher/duty?cloneId=${initialDoc.id}`
                          : initialDoc.docType === 'teacher-overtime'
                          ? `/teacher/overtime?cloneId=${initialDoc.id}`
                          : initialDoc.docType === 'teacher-afterschool'
                          ? `/teacher/afterschool/new?cloneId=${initialDoc.id}`
                          : `/new?cloneId=${initialDoc.id}`
                      }>
                          <CopyPlus className="mr-1.5 h-3.5 w-3.5" />
                          재기안 (복사)
                      </Link>
                  </Button>
              )}

              {isMyTurn && (
                  <Button asChild variant="outline" size="sm" className="h-8 text-xs shadow-sm bg-white hover:bg-gray-100 cursor-pointer font-bold">
                      <Link href={
                        initialDoc.docType === 'parent' 
                          ? `/parents/apply?type=${initialDoc.parentFormData?.type || 'field-trip'}&cloneId=${initialDoc.id}`
                          : initialDoc.docType === 'teacher-duty'
                          ? `/teacher/duty?cloneId=${initialDoc.id}`
                          : initialDoc.docType === 'teacher-overtime'
                          ? `/teacher/overtime?cloneId=${initialDoc.id}`
                          : initialDoc.docType === 'teacher-afterschool'
                          ? `/teacher/afterschool/new?cloneId=${initialDoc.id}`
                          : `/edit/${initialDoc.id}`
                      }>
                          <Edit className="mr-1.5 h-3.5 w-3.5" />
                          내용 수정
                      </Link>
                  </Button>
              )}

              {/* 체험학습 승인 완료시 통보서 받기 버튼 */}
              {initialDoc.docType === 'parent' && initialDoc.parentFormData?.type === 'field-trip' && initialDoc.status === 'approved' && (
                  <Button 
                      variant="outline" 
                      size="sm"
                      type="button" 
                      onClick={() => setShowNotificationModal(true)}
                      className="h-8 text-xs cursor-pointer shadow-xs bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold border-indigo-200"
                  >
                      <FileCheck className="mr-1.5 h-3.5 w-3.5 text-indigo-600" />
                      통보서 받기
                  </Button>
              )}

              <Button 
                  variant="outline" 
                  size="sm"
                  type="button" 
                  onClick={() => window.print()}
                  className="h-8 text-xs cursor-pointer shadow-xs bg-white hover:bg-slate-50 text-slate-700 font-bold border-slate-300"
              >
                  <Printer className="mr-1.5 h-3.5 w-3.5 text-slate-600" />
                  인쇄 / 브라우저 저장
              </Button>

              <Button 
                  variant="default" 
                  size="sm"
                  type="button" 
                  onClick={handlePdfDownload}
                  disabled={isPdfGenerating}
                  className="h-8 text-xs cursor-pointer shadow-xs bg-blue-600 hover:bg-blue-700 text-white font-bold"
              >
                  {isPdfGenerating ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Download className="mr-1.5 h-3.5 w-3.5" />}
                  {isPdfGenerating ? (pdfStatusText || 'PDF 생성 중...') : 'PDF 다운로드'}
              </Button>
            </div>
        </div>

        {/* ── 반려 사유 상단 안내 배너 (화면 전용, 인쇄시 숨김) ── */}
        {initialDoc.status === 'rejected' && (
            <div className={`print:hidden ${containerMaxWidth} mx-auto px-4 mb-6`}>
                <div className="p-5 bg-red-50 border-2 border-red-200 rounded-2xl shadow-sm space-y-2">
                    <div className="flex items-center gap-2 text-red-700 font-black text-base">
                        <AlertTriangle className="w-5 h-5 text-red-600 shrink-0" />
                        <span>결재가 반려된 문서입니다.</span>
                    </div>
                    <div className="bg-white/80 p-3 rounded-xl border border-red-100 text-sm text-red-950">
                        <p className="font-semibold text-xs text-red-600 mb-1">반려 사유:</p>
                        <p className="whitespace-pre-wrap font-medium">
                            {initialDoc.comment || initialDoc.approvers.find(ap => ap.status === 'rejected')?.comment || '반려 사유가 입력되지 않았습니다.'}
                        </p>
                    </div>
                    {isRequester && (
                        <p className="text-xs text-red-600/90 font-medium pt-1">
                            💡 상단의 <strong>[수정 및 재기안]</strong> 버튼을 누르면 내용을 보완하여 다시 상신할 수 있습니다.
                        </p>
                    )}
                </div>
            </div>
        )}

        {/* [수정] 본문 밖으로 분리된 첨부파일 다운로드 영역 (화면 전용, 인쇄시 숨김) */}
        {initialDoc.attachments && initialDoc.attachments.length > 0 && hasAttachmentPermission && (
            <div className={`print:hidden ${containerMaxWidth} mx-auto px-4 mb-4`}>
                <div className="flex flex-col gap-3 p-4 bg-white rounded-lg shadow-sm border border-gray-200">
                    <h3 className="font-bold text-sm text-gray-700">첨부파일 다운로드</h3>
                    <div className="flex flex-wrap gap-2">
                        {initialDoc.attachments.map((file, idx) => (
                            <Button key={idx} variant="outline" size="sm" onClick={() => downloadFile(file)}>
                                <Paperclip className="h-4 w-4 mr-2" />
                                {file.name}
                            </Button>
                        ))}
                    </div>
                </div>
            </div>
        )}

        {/* 부분공개 문서에서 첨부파일 비권한자 안내 */}
        {initialDoc.publishStatus === '부분공개' && !hasAttachmentPermission && initialDoc.attachments && initialDoc.attachments.length > 0 && (
            <div className={`print:hidden ${containerMaxWidth} mx-auto px-4 mb-4`}>
                <div className="flex items-center gap-3 p-4 bg-amber-50 rounded-lg border border-amber-200">
                    <Lock className="h-5 w-5 text-amber-500 shrink-0" />
                    <div>
                        <p className="text-sm font-semibold text-amber-700">첨부파일 열람 제한</p>
                        <p className="text-xs text-amber-600 mt-0.5">
                            이 문서는 부분공개 설정으로, 첨부파일은 기안자·결재자·참조인·관리자만 다운로드할 수 있습니다.
                        </p>
                    </div>
                </div>
            </div>
        )}

        {initialDoc.docType === 'teacher-duty' ? (
            <div className={`w-full ${containerMaxWidth} mx-auto px-4`}>
                <TeacherDutyView doc={initialDoc} />
            </div>
        ) : initialDoc.docType === 'teacher-overtime' ? (
            <div className={`w-full ${containerMaxWidth} mx-auto px-4`}>
                <TeacherOvertimeView doc={initialDoc} />
            </div>
        ) : initialDoc.docType === 'teacher-afterschool' ? (
            <div className={`w-full ${containerMaxWidth} mx-auto px-4`}>
                <AfterschoolFormView doc={initialDoc} approverSignatures={approverSignatures} />
            </div>
        ) : initialDoc.docType === 'parent' ? (
            <div className={`w-full ${containerMaxWidth} mx-auto px-4 print:p-0 print:w-[210mm] print:mx-auto`}>
                <ParentFormView 
                  doc={initialDoc} 
                  teacherMode={isTeacherTurn} 
                  teacherData={teacherConfirmData}
                  onTeacherDataChange={setTeacherConfirmData}
                  approverSignatures={approverSignatures}
                  isParentPortal={isParentPortal}
                />
            </div>
        ) : (
        <div 
            id="a4-document-paper" 
            style={{
                width: '210mm',
                minHeight: '297mm',
                padding: '16mm 20mm 15mm 20mm',
                boxSizing: 'border-box' as const,
                display: 'flex' as const,
                flexDirection: 'column' as const,
                justifyContent: 'space-between' as const,
                backgroundColor: '#ffffff',
            }}
            className="printable-area mx-auto shadow-2xl border border-slate-300 rounded-sm print:shadow-none print:border-none print:m-0"
        >
            <div className="doc-content-wrapper flex-1 flex flex-col justify-start">
                <header className="text-center mb-4 shrink-0">
                    <p className="text-sm font-medium text-gray-500 mb-4 tracking-tight">{initialConfig.slogan || '글로네이컬(GloNaCal) 미래 인재를 키우는 행복한 학교'}</p>
                    {isFamily ? (
                            <h1 className="text-3xl md:text-5xl font-extrabold tracking-[0.3em] text-gray-900 mb-6 border-2 border-black inline-block px-8 py-2">가 정 통 신 문</h1>
                    ) : (
                        initialDoc.headerImage ? <img src={initialDoc.headerImage} alt="Header" className="h-16 md:h-20 mx-auto mb-2 object-contain" /> : <h1 className="text-3xl font-extrabold mb-2">호치민시한국국제학교</h1>
                    )}
                </header>

                <div className="doc-body flex-1">
                    {!isFamily && (
                        <div className="mb-4">
                            <div className="space-y-1 mb-2">
                                <p className="text-[12pt]"><span className="font-bold">수신</span> <span className="ml-2 font-medium">{initialDoc.docType === 'external' ? initialDoc.receiverInfo?.name : '내부결재'}</span></p>
                                <p className="text-[12pt]">(경유)</p>
                                <div className="flex items-start text-[12pt]"><span className="font-bold shrink-0">제목</span><span className="ml-2 font-medium">{initialDoc.title}</span></div>
                            </div>
                            <div className="h-0.5 bg-black w-full" />
                        </div>
                    )}
                    
                    <div className="text-[12pt] leading-loose font-serif text-gray-800 tracking-normal" dangerouslySetInnerHTML={{ __html: formatOfficialDocumentHtml(initialDoc.content) }} />
                </div>
            </div>
            
            <footer className="doc-footer shrink-0 pt-2 mt-auto">
                {initialDoc.docType === 'external' && (
                    <div className="text-center mb-6 h-[40px] flex items-center justify-center">
                        <h2 className="text-3xl md:text-4xl font-black tracking-[0.4em] text-gray-900 pl-2">호치민시한국국제학교장</h2>
                    </div>
                )}
                <div className="border-t-2 border-black pt-4 pb-2">
                    <div className="flex items-center justify-between text-sm w-full">
                        <div className="flex items-center gap-1 md:gap-2">
                            <span className="font-bold">{initialDoc.requesterRole}</span>
                            <div className="flex items-center gap-1">
                                <span className="font-semibold">{initialDoc.requesterName}</span>
                                <div className="relative inline-flex items-center justify-center w-12 h-12">
                                    <span className="text-sm text-gray-800 absolute font-serif">(인)</span>
                                    {initialDoc.requesterSignature && (
                                        <img src={initialDoc.requesterSignature} className="absolute inset-0 w-full h-full object-contain mix-blend-multiply" alt="sig" />
                                    )}
                                </div>
                            </div>
                        </div>
                        {mainApprovers.map((ap, idx) => (
                            <div key={idx} className="flex items-center gap-1 md:gap-2">
                                <div className="flex flex-col items-start leading-tight">
                                    <span className="font-bold">{ap.role}</span>
                                    {ap.type !== 'normal' && getTypeText(ap.type, ap.role) && <span className="text-xs text-primary font-bold">{getTypeText(ap.type, ap.role)}</span>}
                                </div>
                                <div className="flex items-center gap-1">
                                    <span className="font-semibold">{ap.approverName || ap.name}</span>
                                    {ap.status === 'approved' && ap.signature && <div className="w-10 h-10 flex items-center justify-center"><img src={ap.signature} className="max-h-full max-w-full object-contain" alt="sig" /></div>}
                                    {ap.status === 'rejected' && <span className="text-destructive font-bold text-xs">반려</span>}
                                </div>
                            </div>
                        ))}
                    </div>
                    {assistant && (
                        <div className="flex items-center gap-2 text-sm pt-2 mt-2 border-t border-dashed">
                             <span className="font-bold">{assistant.role}</span>
                             <span className="font-semibold">{assistant.approverName || assistant.name}</span>
                             {assistant.status === 'approved' && assistant.signature && <div className="w-10 h-10 flex items-center justify-center"><img src={assistant.signature} className="max-h-full max-w-full object-contain" alt="sig" /></div>}
                        </div>
                    )}
                </div>
                {initialDoc.status === 'rejected' && (
                    <div className="mt-4 p-3 bg-destructive/10 border border-destructive/50 rounded-lg print:hidden">
                        <p className="text-base font-bold text-destructive">반려 사유: <span className="font-normal text-destructive-foreground">{initialDoc.approvers.find(ap => ap.status === 'rejected')?.comment}</span></p>
                    </div>
                )}
                <div className="mt-4 text-[10pt] font-medium text-gray-700 space-y-1 border-t border-gray-200 pt-4">
                     <div className="flex gap-6">
                        <span><strong>시행</strong> {initialDoc.docNo} ({format(approvalDate, 'yyyy. MM. dd.')})</span>
                        {!isFamily && <span><strong>접수</strong> ( )</span>}
                    </div>
                    <p><strong>우</strong> {initialConfig.address}</p>
                    <div className="flex flex-col md:flex-row justify-between">
                        <p><strong>전화</strong> {initialConfig.phone} / <strong>전송</strong> {initialConfig.fax} / {initialConfig.email}</p>
                        <p>{initialConfig.homepage} / <strong>{initialDoc.publishStatus}</strong></p>
                    </div>
                </div>
            </footer>
        </div>
        )}
        
        {isMyTurn && (
             <div className="print:hidden fixed bottom-4 md:bottom-6 left-1/2 -translate-x-1/2 z-50 flex gap-4">
                <Button variant="destructive" onClick={() => setShowRejectModal(true)}>반려</Button>
                <Button onClick={handleApprove}>결재 및 서명</Button>
            </div>
        )}
        {showRejectModal && (
             <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4">
                 <div className="bg-white p-6 rounded-lg max-w-lg w-full space-y-4">
                     <h3>반려 사유</h3>
                     <Textarea value={rejectionReason} onChange={(e: any) => setRejectionReason(e.target.value)} />
                     <div className="flex justify-end gap-2">
                         <Button variant="outline" onClick={() => setShowRejectModal(false)}>취소</Button>
                         <Button variant="destructive" onClick={handleReject}>확인</Button>
                     </div>
                 </div>
             </div>
        )}

        {/* 담임 교사 결재일 수정 및 확인 모달 */}
        {showTeacherApproveModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4 animate-in fade-in">
            <div className="bg-white p-5 sm:p-6 rounded-2xl max-w-md w-full space-y-4 shadow-2xl border">
              <div className="space-y-1">
                <h3 className="font-bold text-base sm:text-lg text-slate-900">담임 교사 결재 확인</h3>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  사전 전화 통보나 종이 신청서 접수일 등 필요한 경우 결재일자(신청일)를 수정하여 결재할 수 있습니다.
                </p>
              </div>

              <div className="space-y-3 bg-slate-50 p-3.5 rounded-xl border border-slate-200/80 text-xs">
                <div className="space-y-1">
                  <label className="font-bold text-slate-700 block">결재일자 (신청서 제출일)</label>
                  <input
                    type="date"
                    value={approvalDateOverride}
                    onChange={(e) => {
                      setApprovalDateOverride(e.target.value);
                      if (isTeacherTurn) {
                        setTeacherConfirmData(prev => ({ ...prev, confirmDate: e.target.value }));
                      }
                    }}
                    className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-xs font-semibold focus:outline-none focus:border-indigo-500"
                  />
                  <span className="text-[11px] text-muted-foreground block mt-0.5">
                    * 지정한 날짜로 결재란 및 신청서 하단 제출일자가 함께 반영됩니다.
                  </span>
                </div>

                {isTeacherTurn && (
                  <>
                    <div className="space-y-1 pt-1 border-t border-slate-200">
                      <label className="font-bold text-slate-700 block">결석 구분</label>
                      <select
                        value={teacherConfirmData.absenceType}
                        onChange={(e) => setTeacherConfirmData(prev => ({ ...prev, absenceType: e.target.value as any }))}
                        className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs"
                      >
                        <option value="병결">병결</option>
                        <option value="미인정">미인정</option>
                        <option value="기타">기타</option>
                        <option value="출석인정">출석인정</option>
                      </select>
                    </div>

                    <div className="space-y-1">
                      <label className="font-bold text-slate-700 block">확인 방법</label>
                      <select
                        value={teacherConfirmData.confirmMethod}
                        onChange={(e) => setTeacherConfirmData(prev => ({ ...prev, confirmMethod: e.target.value as any }))}
                        className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs"
                      >
                        <option value="전화/문자">전화/문자</option>
                        <option value="학부모 내교">학부모 내교</option>
                        <option value="가정방문">가정방문</option>
                        <option value="기타">기타</option>
                      </select>
                    </div>
                  </>
                )}
              </div>

              <div className="flex justify-end gap-2 pt-1">
                <Button variant="outline" size="sm" onClick={() => setShowTeacherApproveModal(false)} disabled={isApproving}>
                  취소
                </Button>
                <Button size="sm" onClick={() => executeApprove(approvalDateOverride)} disabled={isApproving} className="gap-1.5 bg-primary font-bold">
                  {isApproving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                  서명 및 결재 완료
                </Button>
              </div>
            </div>
          </div>
        )}

        <ParentNotificationModal
            doc={initialDoc}
            open={showNotificationModal}
            onOpenChange={setShowNotificationModal}
        />
    </div>
  );
}