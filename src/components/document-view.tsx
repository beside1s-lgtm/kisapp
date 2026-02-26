'use client';

import { ApprovalDoc, DocConfig } from '@/lib/types';
import { useAuth } from '@/hooks/use-auth';
import { useToast } from '@/hooks/use-toast';
import { approveDocument, rejectDocument, recallDocument } from '@/app/actions';
import { Button } from '@/components/ui/button';
import { CheckCircle2, Printer, Loader2, XCircle, Undo2, Edit, CopyPlus, AlertTriangle } from 'lucide-react';
import { format } from 'date-fns';
import { useState, useTransition } from 'react';
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
  
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');

  const handlePrint = () => {
    const printContent = document.querySelector('.printable-area');
    if (!printContent) {
        toast({ variant: "destructive", title: "오류", description: "인쇄할 내용을 찾을 수 없습니다." });
        return;
    }

    const printWindow = window.open('', '_blank', 'width=1100,height=900,resizable=yes,scrollbars=yes');
    if (!printWindow) return;

    const styles = Array.from(document.querySelectorAll('style, link[rel="stylesheet"]'))
        .map(node => node.outerHTML).join('');

    printWindow.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>${initialDoc.title}</title>
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            ${styles}
            <style>
                *, *::before, *::after { box-sizing: border-box !important; }
                html { font-size: 16px !important; }
                html, body {
                    margin: 0 !important; padding: 0 !important;
                    background-color: white !important;
                    -webkit-print-color-adjust: exact !important;
                    print-color-adjust: exact !important;
                    height: 100%;
                }
                @page { size: A4 portrait; margin: 0; }
                .printable-area { 
                    width: 210mm !important; 
                    min-height: 280mm !important; 
                    height: auto !important;
                    margin: 0 auto !important; 
                    padding: 20mm !important; 
                    background: white !important; border: none !important; box-shadow: none !important;
                    display: flex !important; flex-direction: column !important; justify-content: space-between !important; 
                }
                .doc-content-wrapper { display: flex; flex-direction: column; flex: 1 1 auto; }
                header { flex: 0 0 auto !important; }
                .doc-body { display: block !important; font-size: 1.1rem !important; line-height: 1.6 !important; flex-grow: 1 !important; }
                .doc-footer { flex: 0 0 auto !important; margin-top: auto !important; width: 100% !important; break-inside: avoid !important; padding-top: 10mm !important; }
                table { width: 100% !important; border-collapse: collapse !important; margin: 10px 0 !important; }
                th, td { border: 1px solid black !important; padding: 6px !important; font-size: 1rem !important; }
                th { background-color: #f3f4f6 !important; font-weight: bold !important; text-align: center !important; }
                .no-print, button, nav, aside, .fixed { display: none !important; }
            </style>
        </head>
        <body>
            ${printContent.outerHTML}
            <script>window.onload = function() { setTimeout(function() { window.focus(); window.print(); }, 500); };</script>
        </body>
        </html>
    `);
    printWindow.document.close();
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
      if (initialDoc.publishStatus === '공개') hasViewPermission = true;
      else hasViewPermission = isRequester || isApprover || isCircular;
  } else hasViewPermission = isRequester || isApprover || isCircular;
  
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

  const handleApprove = () => {
    if (!profile?.signature) { if(!window.confirm("저장된 서명이 없습니다. 서명 없이 결재하시겠습니까?")) return; }
    startApproveTransition(async () => {
      const result = await approveDocument(initialDoc.id, user.uid, profile);
      if (result.success) { toast({ title: '결재 완료!' }); window.location.href = '/inbox'; } 
      else { toast({ variant: 'destructive', title: '결재 실패', description: result.error }); }
    });
  };
  
  const handleReject = () => {
    if (!rejectionReason) { toast({ variant: 'destructive', title: '반려 사유 입력 필요' }); return; }
    startRejectTransition(async () => {
        const result = await rejectDocument(initialDoc.id, user.uid, profile, rejectionReason);
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

  const downloadFile = (file: { data: string; name: string }) => {
    const link = document.createElement('a'); link.href = file.data; link.download = file.name;
    document.body.appendChild(link); link.click(); document.body.removeChild(link);
  };

  return (
    <div className="relative w-full">
        <div className="no-print relative z-50 p-4 md:p-0 flex justify-end gap-2 mb-4 max-w-4xl mx-auto pointer-events-auto">
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
                <Button asChild variant="default" className="shadow-sm cursor-pointer">
                    <Link href={`/edit/${initialDoc.id}`}>
                        <Edit className="mr-2 h-4 w-4" />
                        수정 및 재기안
                    </Link>
                </Button>
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

        <div className="printable-area bg-white p-8 md:p-12 shadow-lg rounded-lg max-w-[210mm] mx-auto flex flex-col min-h-[29.7cm] justify-between text-lg leading-relaxed">
            <div className="flex flex-col flex-1 doc-content-wrapper">
                <header className="text-center mb-4 shrink-0">
                    <p className="text-sm font-medium text-gray-500 mb-6 tracking-tight">글로네이컬(GloNaCal) 미래 인재를 키우는 행복한 학교</p>
                    {isFamily ? (
                         <h1 className="text-3xl md:text-5xl font-extrabold tracking-[0.3em] text-gray-900 mb-6 border-2 border-black inline-block px-8 py-2">가 정 통 신 문</h1>
                    ) : (
                        initialDoc.headerImage ? <img src={initialDoc.headerImage} alt="Header" className="h-16 md:h-20 mx-auto mb-2 object-contain" /> : <h1 className="text-3xl font-extrabold mb-2">호치민시한국국제학교</h1>
                    )}
                </header>

                <div className="doc-body flex-1 flex flex-col">
                    {!isFamily && (
                        <div className="mb-8">
                            <div className="space-y-1 mb-2">
                                <p className="text-base md:text-lg"><span className="font-bold">수신</span> <span className="ml-2 font-medium">{initialDoc.docType === 'external' ? initialDoc.receiverInfo?.name : '내부결재'}</span></p>
                                <p className="text-base md:text-lg">(경유)</p>
                                <div className="flex items-start text-base md:text-lg"><span className="font-bold shrink-0">제목</span><span className="ml-2 font-medium">{initialDoc.title}</span></div>
                            </div>
                            <div className="h-0.5 bg-black w-full" />
                        </div>
                    )}
                    
                    <div className="min-h-[300px] text-lg md:text-xl leading-loose font-serif text-gray-800 tracking-normal" dangerouslySetInnerHTML={{ __html: initialDoc.content }} />

                    {initialDoc.attachments?.length > 0 && (
                        <div className="mt-12">
                            <h3 className="font-bold mb-2 text-lg md:text-xl">붙임</h3>
                            <ul className="list-decimal list-inside space-y-2 text-base md:text-lg">
                            {initialDoc.attachments.map((file, idx) => (
                                <li key={idx}><button onClick={() => downloadFile(file)} className="text-blue-600 hover:underline">{file.name}</button></li>
                            ))}
                            </ul>
                        </div>
                    )}
                </div>
            </div>
            
            <footer className="doc-footer mt-16 shrink-0 mt-auto">
                <div className="text-center mb-16 h-[80px] flex items-center justify-center">
                    {initialDoc.docType === 'external' && <h2 className="text-3xl md:text-4xl font-black tracking-[0.4em] text-gray-900 pl-2">호치민시한국국제학교장</h2>}
                </div>
                <div className="border-t-2 border-black pt-4 pb-2">
                    <div className="flex items-center justify-between text-xs md:text-sm w-full">
                        <div className="flex items-center gap-1 md:gap-2">
                            <span className="font-bold">{initialDoc.requesterRole}</span>
                            <div className="flex items-center gap-1">
                                <span className="font-semibold">{initialDoc.requesterName}</span>
                                {initialDoc.requesterSignature && <div className="w-10 h-10 flex items-center justify-center"><img src={initialDoc.requesterSignature} className="max-h-full max-w-full object-contain" alt="sig" /></div>}
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
                        <div className="flex items-center gap-2 text-xs md:text-sm pt-2 mt-2 border-t border-dashed">
                             <span className="font-bold">{assistant.role}</span>
                             <span className="font-semibold">{assistant.approverName || assistant.name}</span>
                             {assistant.status === 'approved' && assistant.signature && <div className="w-10 h-10 flex items-center justify-center"><img src={assistant.signature} className="max-h-full max-w-full object-contain" alt="sig" /></div>}
                        </div>
                    )}
                </div>
                {initialDoc.status === 'rejected' && (
                    <div className="mt-4 p-3 bg-destructive/10 border border-destructive/50 rounded-lg">
                        <p className="text-base font-bold text-destructive">반려 사유: <span className="font-normal text-destructive-foreground">{initialDoc.approvers.find(ap => ap.status === 'rejected')?.comment}</span></p>
                    </div>
                )}
                <div className="mt-4 text-xs md:text-sm font-medium text-gray-700 space-y-2 border-t border-gray-200 pt-4">
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
        
        {isMyTurn && (
             <div className="no-print fixed bottom-4 md:bottom-6 left-1/2 -translate-x-1/2 z-50 flex gap-4">
                <Button variant="destructive" onClick={() => setShowRejectModal(true)}>반려</Button>
                <Button onClick={handleApprove}>결재 및 서명</Button>
            </div>
        )}
        {showRejectModal && (
             <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4">
                 <div className="bg-white p-6 rounded-lg max-w-lg w-full space-y-4">
                     <h3>반려 사유</h3>
                     <Textarea value={rejectionReason} onChange={(e) => setRejectionReason(e.target.value)} />
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