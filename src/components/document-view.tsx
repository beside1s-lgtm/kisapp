'use client';

import { ApprovalDoc, DocConfig } from '@/lib/types';
import { useAuth } from '@/hooks/use-auth';
import { useToast } from '@/hooks/use-toast';
import { approveDocument, rejectDocument, recallDocument, deleteDocument } from '@/lib/services/documentService';
import { Button } from '@/components/ui/button';
import { CheckCircle2, Printer, Loader2, XCircle, Undo2, Edit, CopyPlus, AlertTriangle, Paperclip, Trash2, Lock } from 'lucide-react';
import { format } from 'date-fns';
import { useState, useTransition, useEffect } from 'react';
import Link from 'next/link'; 
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
import { Textarea } from './ui/textarea';
import { ParentFormView } from './parent-form-view';
import { TeacherDutyView } from './teacher-duty-view';
import { TeacherOvertimeView } from './teacher-overtime-view';
type DocumentViewProps = {
  initialDoc: ApprovalDoc;
  initialConfig: DocConfig;
};

export default function DocumentView({ initialDoc, initialConfig }: DocumentViewProps) {
  const { user, profile } = useAuth();
  const { toast } = useToast();
  const [isApproving, startApproveTransition] = useTransition();
  const [isRejecting, startRejectTransition] = useTransition();
  const [isRecalling, startRecallTransition] = useTransition();
  const [isDeleting, startDeleteTransition] = useTransition();
  
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');
  
  const isTeacherTurn = initialDoc.status === 'pending' && 
                        initialDoc.approvers[initialDoc.currentStep]?.email?.trim().toLowerCase() === user?.email?.trim().toLowerCase() &&
                        initialDoc.approvers[initialDoc.currentStep]?.role === '담임' &&
                        initialDoc.docType === 'parent' && 
                        initialDoc.parentFormData?.type === 'absence';
                        
  const [teacherConfirmData, setTeacherConfirmData] = useState({
    absenceType: initialDoc.parentFormData?.absenceType || '병결',
    confirmMethod: initialDoc.parentFormData?.teacherConfirmMethod || '',
    confirmDate: initialDoc.parentFormData?.teacherConfirmDate || format(new Date(), 'yyyy-MM-dd')
  });

  useEffect(() => {
    // 스타일 백업을 보관할 상위 스코프 변수
    let savedHtmlFontSize = '';
    let savedAreaStyle = { position: '', width: '', padding: '', margin: '', boxSizing: '', display: '' };
    let savedFooterStyle = { position: '', display: '' };
    let savedContentStyle = { paddingBottom: '', display: '' };
    let isPrinting = false;

    const updateSpacer = () => {
      if (isPrinting) return;

      const area = document.querySelector('.printable-area') as HTMLElement;
      const footer = document.querySelector('.doc-footer') as HTMLElement;
      const content = document.querySelector('.doc-content-wrapper') as HTMLElement;
      if (!area || !footer || !content) return;

      const oldSpacer = document.getElementById('print-spacer');
      if (oldSpacer) oldSpacer.remove();

      // 측정 전: 원래 스타일 임시 백업
      const tempHtmlFontSize = document.documentElement.style.fontSize;
      const tempAreaStyle = {
        position: area.style.position,
        width: area.style.width,
        padding: area.style.padding,
        margin: area.style.margin,
        boxSizing: area.style.boxSizing,
      };
      const tempFooterStyle = { position: footer.style.position };
      const tempContentStyle = { paddingBottom: content.style.paddingBottom };

      // 임시로 인쇄 전용 스타일 주입하여 높이 측정
      const MM_TO_PX = 3.7795275591;
      const A4_HEIGHT_MM = 297;
      const MARGIN_TOP_MM = 10;
      const MARGIN_BOTTOM_MM = 10;
      const PAGE_HEIGHT_PX = (A4_HEIGHT_MM - MARGIN_TOP_MM - MARGIN_BOTTOM_MM) * MM_TO_PX; // 277mm ≈ 1047px
      const CONTENT_WIDTH = '190mm';
      const PRINT_FONT_SIZE = '12pt';

      document.documentElement.style.setProperty('font-size', PRINT_FONT_SIZE, 'important');
      area.style.setProperty('position', 'static', 'important');
      area.style.setProperty('width', CONTENT_WIDTH, 'important');
      area.style.setProperty('padding', '0px', 'important');
      area.style.setProperty('margin', '0px', 'important');
      area.style.setProperty('box-sizing', 'border-box', 'important');
      footer.style.setProperty('position', 'static', 'important');
      content.style.setProperty('padding-bottom', '0px', 'important');

      // 레이아웃 강제 재계산 (reflow trigger)
      void area.offsetHeight;

      const contentHeight = content.offsetHeight;
      const footerHeight = footer.offsetHeight;
      const totalHeight = contentHeight + footerHeight;

      // 필요 spacer 높이 계산
      const BUFFER_PX = 25; // 브라우저 단수 오차 및 푸터 밀림 방지용 안전 버퍼
      const adjustedTotalHeight = totalHeight + BUFFER_PX;
      const pageCount = Math.ceil(adjustedTotalHeight / PAGE_HEIGHT_PX);
      const targetTotalHeight = pageCount * PAGE_HEIGHT_PX;
      let neededSpacerHeight = targetTotalHeight - adjustedTotalHeight;
      if (neededSpacerHeight < 0) neededSpacerHeight = 0;

      // 측정 후 즉시 원래 스타일로 복구
      if (tempHtmlFontSize) {
        document.documentElement.style.setProperty('font-size', tempHtmlFontSize);
      } else {
        document.documentElement.style.removeProperty('font-size');
      }
      area.style.setProperty('position', tempAreaStyle.position);
      area.style.setProperty('width', tempAreaStyle.width);
      area.style.setProperty('padding', tempAreaStyle.padding);
      area.style.setProperty('margin', tempAreaStyle.margin);
      area.style.setProperty('box-sizing', tempAreaStyle.boxSizing);
      footer.style.setProperty('position', tempFooterStyle.position);
      content.style.setProperty('padding-bottom', tempContentStyle.paddingBottom);

      // spacer 삽입
      if (neededSpacerHeight > 0) {
        const spacer = document.createElement('div');
        spacer.id = 'print-spacer';
        spacer.style.setProperty('height', `${neededSpacerHeight}px`, 'important');
        spacer.style.setProperty('box-sizing', 'border-box', 'important');
        spacer.style.setProperty('display', 'block', 'important');
        content.appendChild(spacer);
      }
    };

    const handleBeforePrint = () => {
      isPrinting = true; // 일반 리사이즈 시 spacer 계산 방지

      const area = document.querySelector('.printable-area') as HTMLElement;
      const footer = document.querySelector('.doc-footer') as HTMLElement;
      const content = document.querySelector('.doc-content-wrapper') as HTMLElement;
      if (!area || !footer || !content) return;

      const oldSpacer = document.getElementById('print-spacer');
      if (oldSpacer) oldSpacer.remove();

      // 인쇄 완료 전까지 유지할 원래 스타일 백업
      savedHtmlFontSize = document.documentElement.style.fontSize;
      savedAreaStyle = {
        position: area.style.position,
        width: area.style.width,
        padding: area.style.padding,
        margin: area.style.margin,
        boxSizing: area.style.boxSizing,
        display: area.style.display,
      };
      savedFooterStyle = {
        position: footer.style.position,
        display: footer.style.display,
      };
      savedContentStyle = {
        paddingBottom: content.style.paddingBottom,
        display: content.style.display,
      };

      // @media print 조건과 동일하게 강제 적용 (인쇄 완료 시까지 복구 지연)
      const MM_TO_PX = 3.7795275591;
      const A4_HEIGHT_MM = 297;
      const MARGIN_TOP_MM = 10;
      const MARGIN_BOTTOM_MM = 10;
      const PAGE_HEIGHT_PX = (A4_HEIGHT_MM - MARGIN_TOP_MM - MARGIN_BOTTOM_MM) * MM_TO_PX;
      const CONTENT_WIDTH = '190mm';
      const PRINT_FONT_SIZE = '12pt';

      document.documentElement.style.setProperty('font-size', PRINT_FONT_SIZE, 'important');
      area.style.setProperty('position', 'static', 'important');
      area.style.setProperty('width', CONTENT_WIDTH, 'important');
      area.style.setProperty('padding', '0px', 'important');
      area.style.setProperty('margin', '0px', 'important');
      area.style.setProperty('box-sizing', 'border-box', 'important');
      area.style.setProperty('display', 'block', 'important');
      
      footer.style.setProperty('position', 'static', 'important');
      footer.style.setProperty('display', 'block', 'important');
      
      content.style.setProperty('padding-bottom', '0px', 'important');
      content.style.setProperty('display', 'block', 'important');

      // 레이아웃 강제 재계산 (reflow trigger)
      void area.offsetHeight;

      const contentHeight = content.offsetHeight;
      const footerHeight = footer.offsetHeight;
      const totalHeight = contentHeight + footerHeight;

      // 필요 spacer 높이 계산
      const BUFFER_PX = 25; // 브라우저 단수 오차 및 푸터 밀림 방지용 안전 버퍼
      const adjustedTotalHeight = totalHeight + BUFFER_PX;
      const pageCount = Math.ceil(adjustedTotalHeight / PAGE_HEIGHT_PX);
      const targetTotalHeight = pageCount * PAGE_HEIGHT_PX;
      let neededSpacerHeight = targetTotalHeight - adjustedTotalHeight;
      if (neededSpacerHeight < 0) neededSpacerHeight = 0;

      if (neededSpacerHeight > 0) {
        const spacer = document.createElement('div');
        spacer.id = 'print-spacer';
        spacer.style.setProperty('height', `${neededSpacerHeight}px`, 'important');
        spacer.style.setProperty('box-sizing', 'border-box', 'important');
        spacer.style.setProperty('display', 'block', 'important');
        content.appendChild(spacer);
      }
    };

    const handleAfterPrint = () => {
      const spacer = document.getElementById('print-spacer');
      if (spacer) spacer.remove();

      const area = document.querySelector('.printable-area') as HTMLElement;
      const footer = document.querySelector('.doc-footer') as HTMLElement;
      const content = document.querySelector('.doc-content-wrapper') as HTMLElement;

      // 인쇄 완료 후 원래 스타일 복구
      if (savedHtmlFontSize) {
        document.documentElement.style.setProperty('font-size', savedHtmlFontSize);
      } else {
        document.documentElement.style.removeProperty('font-size');
      }

      if (area) {
        area.style.setProperty('position', savedAreaStyle.position);
        area.style.setProperty('width', savedAreaStyle.width);
        area.style.setProperty('padding', savedAreaStyle.padding);
        area.style.setProperty('margin', savedAreaStyle.margin);
        area.style.setProperty('box-sizing', savedAreaStyle.boxSizing);
        area.style.setProperty('display', savedAreaStyle.display);
      }

      if (footer) {
        footer.style.setProperty('position', savedFooterStyle.position);
        footer.style.setProperty('display', savedFooterStyle.display);
      }

      if (content) {
        content.style.setProperty('padding-bottom', savedContentStyle.paddingBottom);
        content.style.setProperty('display', savedContentStyle.display);
      }

      isPrinting = false;
      
      // 복구 완료 후 화면용 spacer 최신화 재트리거
      updateSpacer();
    };

    updateSpacer();

    // 1. 창 크기 변경 감지
    window.addEventListener('resize', updateSpacer);
    
    // 2. 비동기 웹폰트 로딩 완료 감지
    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(updateSpacer);
    }

    // 3. 비동기 이미지 (로고 및 서명) 로딩 완료 감지
    const images = document.querySelectorAll('.printable-area img');
    images.forEach(img => {
      const htmlImg = img as HTMLImageElement;
      if (htmlImg.complete) {
        updateSpacer();
      } else {
        htmlImg.addEventListener('load', updateSpacer);
      }
    });

    window.addEventListener('beforeprint', handleBeforePrint);
    window.addEventListener('afterprint', handleAfterPrint);

    return () => {
      window.removeEventListener('resize', updateSpacer);
      window.removeEventListener('beforeprint', handleBeforePrint);
      window.removeEventListener('afterprint', handleAfterPrint);
      images.forEach(img => {
        img.removeEventListener('load', updateSpacer);
      });
    };
  }, []);

  const handlePrint = () => {
    window.print();
  };

  if (!user || !profile || !initialDoc) return (
    <div className="flex h-full w-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
    </div>
  );

  const isRequester = initialDoc.requesterId === user.uid;
  const isApprover = initialDoc.approvers?.some(ap => ap.email?.toLowerCase() === user.email?.toLowerCase()) ?? false;
  const isCircular = initialDoc.circulars?.some(c => c.email?.toLowerCase() === profile.email?.toLowerCase()) ?? false;

  let hasViewPermission = false;
  if (profile.isAdmin) hasViewPermission = true;
  else if (initialDoc.status === 'recalled') hasViewPermission = isRequester;
  else if (initialDoc.status === 'approved') {
      if (initialDoc.publishStatus === '공개' || initialDoc.publishStatus === '부분공개') hasViewPermission = true;
      else hasViewPermission = isRequester || isApprover || isCircular;
  } else hasViewPermission = isRequester || isApprover || isCircular;

  const hasAttachmentPermission = 
    initialDoc.publishStatus !== '부분공개' || 
    isRequester || 
    isApprover || 
    isCircular || 
    profile.isAdmin;
  
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

  const isMyTurn = initialDoc.status === 'pending' && 
                   initialDoc.approvers[initialDoc.currentStep]?.email?.trim().toLowerCase() === user.email?.trim().toLowerCase();
  const canRecall = isRequester && initialDoc.status === 'pending';
  const isRecalled = initialDoc.status === 'recalled';
  const isApproved = initialDoc.status === 'approved';
  const isFamily = initialDoc.category === 'family';

  const approvalDate = initialDoc.completedAt 
    ? new Date(initialDoc.completedAt as string) 
    : (initialDoc.createdAt ? new Date(initialDoc.createdAt as string) : new Date());
    
  const assistant = initialDoc.approvers.find(a => a.role === '협조');
  const mainApprovers = initialDoc.approvers.filter(a => a.role !== '협조');

  const getTypeText = (type: string) => type === 'final' ? '전결' : type === 'proxy' ? '대결' : '';

  const containerMaxWidth = (initialDoc.docType === 'teacher-duty' || initialDoc.docType === 'teacher-overtime') ? 'max-w-full' : 'max-w-[210mm]';

  const handleApprove = () => {
    if (!profile?.signature) { if(!window.confirm("저장된 서명이 없습니다. 서명 없이 결재하시겠습니까?")) return; }
    
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
      const parentUpdateData = isTeacherTurn ? {
        absenceType: teacherConfirmData.absenceType,
        teacherConfirmMethod: teacherConfirmData.confirmMethod,
        teacherConfirmDate: teacherConfirmData.confirmDate
      } : undefined;

      const result = await approveDocument(initialDoc.id, profile, parentUpdateData);
      if (result.success) { toast({ title: '결재 완료!' }); window.location.href = '/inbox'; } 
      else { toast({ variant: 'destructive', title: '결재 실패', description: result.error }); }
    });
  };
  
  const handleReject = () => {
    if (!rejectionReason) { toast({ variant: 'destructive', title: '반려 사유 입력 필요' }); return; }
    startRejectTransition(async () => {
        const result = await rejectDocument(initialDoc.id, profile, rejectionReason);
        if (result.success) { toast({ title: '반려됨' }); setShowRejectModal(false); window.location.href = '/inbox'; } 
        else { toast({ variant: 'destructive', title: '반려 실패', description: result.error }); }
    });
  };

  const handleRecall = () => {
    startRecallTransition(async () => {
        const result = await recallDocument(initialDoc.id, user.uid);
        if (result.success) { toast({ title: '회수 완료' }); window.location.href = '/recalled'; } 
        else { toast({ variant: 'destructive', title: '회수 실패', description: result.error }); }
    });
  };

  const handleDelete = () => {
    if (!window.confirm("문서를 완전히 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.")) return;
    startDeleteTransition(async () => {
        const result = await deleteDocument(initialDoc.id, user.uid);
        if (result.success) { toast({ title: '삭제 완료' }); window.location.href = '/recalled'; } 
        else { toast({ variant: 'destructive', title: '삭제 실패', description: result.error }); }
    });
  };

  const downloadFile = (file: { data: string; name: string }) => {
    if (!hasAttachmentPermission) {
      toast({ variant: 'destructive', title: '권한 없음', description: '첨부파일을 다운로드할 권한이 없습니다.' });
      return;
    }
    const link = document.createElement('a'); 
    link.href = file.data; 
    link.download = file.name;
    link.target = '_blank'; 
    document.body.appendChild(link); 
    link.click(); 
    document.body.removeChild(link);
  };

  return (
    <div className="relative w-full bg-muted/30 py-8 min-h-screen print:bg-white print:py-0 print:min-h-0 print:block">
        <div className={`print:hidden flex justify-end gap-2 mb-6 ${containerMaxWidth} mx-auto px-4`}>
            {canRecall && (
                <AlertDialog>
                    <AlertDialogTrigger asChild><Button variant="outline" disabled={isRecalling}>회수하기</Button></AlertDialogTrigger>
                    <AlertDialogContent>
                        <AlertDialogHeader><AlertDialogTitle>회수하시겠습니까?</AlertDialogTitle></AlertDialogHeader>
                        <AlertDialogFooter><AlertDialogCancel>취소</AlertDialogCancel><AlertDialogAction onClick={handleRecall}>확인</AlertDialogAction></AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>
            )}

            {isRecalled && isRequester && (
                <>
                <Button asChild variant="default" className="shadow-sm cursor-pointer">
                    <Link href={`/edit/${initialDoc.id}`}>
                        <Edit className="mr-2 h-4 w-4" />
                        수정 및 재기안
                    </Link>
                </Button>
                <Button variant="destructive" className="shadow-sm cursor-pointer" onClick={handleDelete} disabled={isDeleting}>
                    {isDeleting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Trash2 className="mr-2 h-4 w-4" />}
                    삭제
                </Button>
                </>
            )}

            {isApproved && (
                <Button asChild variant="default" className="shadow-sm cursor-pointer">
                    <Link href={`/new?cloneId=${initialDoc.id}`}>
                        <CopyPlus className="mr-2 h-4 w-4" />
                        재기안 (복사 작성)
                    </Link>
                </Button>
            )}

            {isMyTurn && (
                <Button asChild variant="outline" className="shadow-sm bg-white hover:bg-gray-100 cursor-pointer">
                    <Link href={`/edit/${initialDoc.id}`}>
                        <Edit className="mr-2 h-4 w-4" />
                        내용 수정
                    </Link>
                </Button>
            )}

            <Button variant="outline" type="button" onClick={handlePrint} className="cursor-pointer shadow-sm bg-white hover:bg-gray-100">
                <Printer className="mr-2 h-4 w-4" /> 인쇄 / PDF로 저장
            </Button>
        </div>

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
        ) : (
        <div className="printable-area flex flex-col print:block print:w-full print:max-w-none print:m-0 print:p-0">
            {initialDoc.docType === 'parent' ? (
                <ParentFormView 
                  doc={initialDoc} 
                  teacherMode={isTeacherTurn} 
                  teacherData={teacherConfirmData}
                  onTeacherDataChange={setTeacherConfirmData}
                />
            ) : (
                <>
                    <div className="doc-content-wrapper">
                        <header className="text-center mb-4 shrink-0">
                            <p className="text-sm font-medium text-gray-500 mb-6 tracking-tight">{initialConfig.slogan || '글로네이컬(GloNaCal) 미래 인재를 키우는 행복한 학교'}</p>
                            {isFamily ? (
                                    <h1 className="text-3xl md:text-5xl font-extrabold tracking-[0.3em] text-gray-900 mb-6 border-2 border-black inline-block px-8 py-2">가 정 통 신 문</h1>
                            ) : (
                                initialDoc.headerImage ? <img src={initialDoc.headerImage} alt="Header" className="h-16 md:h-20 mx-auto mb-2 object-contain" /> : <h1 className="text-3xl font-extrabold mb-2">호치민시한국국제학교</h1>
                            )}
                        </header>

                        <div className="doc-body">
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
                            
                            <div className="text-[12pt] leading-loose font-serif text-gray-800 tracking-normal" dangerouslySetInnerHTML={{ __html: initialDoc.content }} />
                        </div>
                    </div>
                    
                    <footer className="doc-footer pt-10 mt-auto">
                        <div className="text-center mb-16 h-[80px] flex items-center justify-center">
                            {initialDoc.docType === 'external' && <h2 className="text-3xl md:text-4xl font-black tracking-[0.4em] text-gray-900 pl-2">호치민시한국국제학교장</h2>}
                        </div>
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
                                            {ap.type !== 'normal' && <span className="text-xs text-primary font-bold">{getTypeText(ap.type)}</span>}
                                        </div>
                                        <div className="flex items-center gap-1">
                                            <span className="font-semibold">{ap.approverName}</span>
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
                </>
            )}
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
    </div>
  );
}