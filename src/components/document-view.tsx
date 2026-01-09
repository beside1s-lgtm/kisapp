
'use client';

import {
  ApprovalDoc,
  DocConfig,
} from '@/lib/types';
import { useAuth } from '@/hooks/use-auth';
import { useToast } from '@/hooks/use-toast';
import { approveDocument, rejectDocument, recallDocument } from '@/app/actions';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { CheckCircle2, Printer, Loader2, XCircle, Undo2 } from 'lucide-react';
import { format } from 'date-fns';
import { useState, useTransition } from 'react';
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
} from "@/components/ui/alert-dialog"

type DocumentViewProps = {
  initialDoc: ApprovalDoc;
  initialConfig: DocConfig;
};

export default function DocumentView({ initialDoc, initialConfig }: DocumentViewProps) {
  const { user, profile } = useAuth();
  const { toast } = useToast();
  const router = useRouter();
  const [isApproving, startApproveTransition] = useTransition();
  const [isRejecting, startRejectTransition] = useTransition();
  const [isRecalling, startRecallTransition] = useTransition();
  
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');

  const handlePrint = () => {
    window.print();
  };

  if (!user || !profile || !initialDoc) return (
    <div className="flex h-full w-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
    </div>
  );

  const isMyTurn = initialDoc.approvers[initialDoc.currentStep]?.email === user.email && initialDoc.status === 'pending';
  const isRequester = initialDoc.requesterId === user.uid;
  const canRecall = isRequester && initialDoc.status === 'pending';

  const approvalDate = initialDoc.completedAt 
    ? new Date(initialDoc.completedAt as string) 
    : (initialDoc.createdAt ? new Date(initialDoc.createdAt as string) : new Date());
    
  const assistant = initialDoc.approvers.find(a => a.role === '협조');
  const mainApprovers = initialDoc.approvers.filter(a => a.role !== '협조');

  const getTypeText = (type: 'normal' | 'final' | 'proxy') => {
    if (type === 'final') return '전결';
    if (type === 'proxy') return '대결';
    return '';
  };
  
  const handleApprove = () => {
    if (!profile?.signature) {
        const confirmed = window.confirm("저장된 서명이 없습니다. 서명 없이 결재하시겠습니까?");
        if(!confirmed) return;
    }
    startApproveTransition(async () => {
      if (!user || !profile) {
        toast({ variant: 'destructive', title: '인증 오류', description: '로그인이 필요합니다.' });
        return;
      }
      const result = await approveDocument(initialDoc.id, user.uid, profile);
      if (result.success) {
        toast({ title: '결재 완료!', description: '문서가 성공적으로 결재되었습니다.' });
        router.push('/inbox');
        router.refresh();
      } else {
        toast({ variant: 'destructive', title: '결재 실패', description: result.error });
      }
    });
  };
  
  const handleReject = async () => {
    if (!rejectionReason) {
        toast({ variant: 'destructive', title: '반려 사유 필요', description: '반려 사유를 입력해야 합니다.' });
        return;
    }
    startRejectTransition(async () => {
        if (!user || !profile) return;
        const result = await rejectDocument(initialDoc.id, user.uid, profile, rejectionReason);
        if (result.success) {
            toast({ title: '반려 처리됨', description: '문서가 반려되었습니다.'});
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
        if (!user) return;
        const result = await recallDocument(initialDoc.id, user.uid);
        if (result.success) {
            toast({ title: '회수 완료', description: '문서가 회수되어 회수 문서함으로 이동했습니다.'});
            router.push('/recalled');
            router.refresh();
        } else {
            toast({ variant: 'destructive', title: '회수 실패', description: result.error });
        }
    });
  };

  const downloadFile = (file: { data: string; name: string }) => {
    const link = document.createElement('a');
    link.href = file.data;
    link.download = file.name;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Badge 컴포넌트 대체
  const getStatusBadge = (status: 'pending' | 'approved' | 'rejected') => {
    const baseClass = "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2";
    switch(status) {
        case 'approved': return <span className={`${baseClass} border-transparent bg-blue-600 text-white hover:bg-blue-700`}>결재 완료</span>;
        case 'rejected': return <span className={`${baseClass} border-transparent bg-destructive text-destructive-foreground hover:bg-destructive/80`}>반려</span>;
        case 'pending': return <span className={`${baseClass} border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80`}>진행중</span>;
        default: return null;
    }
  }

  return (
    <div className="relative w-full">
        <div className="no-print relative z-50 p-4 md:p-0 flex justify-end gap-2 mb-4 max-w-4xl mx-auto pointer-events-auto">
            {canRecall && (
                <AlertDialog>
                    <AlertDialogTrigger asChild>
                       <Button variant="outline" className="shadow-sm bg-white hover:bg-gray-100" disabled={isRecalling}>
                            {isRecalling ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Undo2 className="mr-2 h-4 w-4" />}
                            회수하기
                        </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                        <AlertDialogHeader>
                            <AlertDialogTitle>문서를 회수하시겠습니까?</AlertDialogTitle>
                            <AlertDialogDescription>
                                이 작업은 결재 과정을 중단하고 문서를 '회수 문서함'으로 이동시킵니다.
                            </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                            <AlertDialogCancel>취소</AlertDialogCancel>
                            <AlertDialogAction onClick={handleRecall} className="bg-destructive hover:bg-destructive/90">회수 확인</AlertDialogAction>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>
            )}
            <Button variant="outline" type="button" onClick={handlePrint} className="cursor-pointer shadow-sm bg-white hover:bg-gray-100">
                <Printer className="mr-2 h-4 w-4" /> 인쇄 / PDF로 저장
            </Button>
        </div>

        <div className="printable-area bg-white p-8 md:p-12 shadow-lg rounded-lg max-w-[210mm] mx-auto flex flex-col min-h-[29.7cm] justify-between">
            
            <div className="flex flex-col flex-1">
                <header className="text-center mb-8 shrink-0">
                    <p className="text-xs md:text-sm font-medium text-gray-500 mb-6 tracking-tight">글로네이컬(GloNaCal) 미래 인재를 키우는 행복한 학교</p>
                    {initialDoc.headerImage ? (
                        <img src={initialDoc.headerImage} alt="School Header" className="h-12 md:h-16 mx-auto mb-2 object-contain" />
                    ) : (
                        <>
                            <h1 className="text-2xl md:text-4xl font-extrabold tracking-[0.2em] text-gray-900 mb-0">호치민시한국국제학교</h1>
                            <p className="text-xs md:text-sm font-bold text-gray-500 tracking-wider">KOREAN INTERNATIONAL SCHOOL HCMC</p>
                        </>
                    )}
                </header>

                <div className="doc-body flex-1 flex flex-col">
                    <div className="mt-12 mb-8">
                        <div className="space-y-1 mb-2">
                            <p className="text-sm md:text-base"><span className="font-bold">수신</span> <span className="ml-2 font-medium">{initialDoc.docType === 'external' ? initialDoc.receiverInfo?.name : '내부결재'}</span></p>
                            <p className="text-xs md:text-sm">(경유)</p>
                        </div>
                        <div className="h-0.5 bg-black w-full" />
                    </div>
                    
                    <div className="flex mb-10 items-start">
                        <span className="w-16 md:w-20 font-bold text-base md:text-lg shrink-0">제 목:</span>
                        <span className="text-lg md:text-xl font-bold text-gray-900 leading-tight">{initialDoc.title}</span>
                    </div>

                    <div className="min-h-[200px] text-sm md:text-base leading-loose whitespace-pre-wrap font-serif text-gray-800 tracking-normal"
                        dangerouslySetInnerHTML={{ __html: initialDoc.content.replace(/\n/g, '<br />') }} />

                    {initialDoc.attachments?.length > 0 && (
                    <div className="mt-12">
                        <h3 className="font-bold mb-2 text-base md:text-lg">붙임</h3>
                        <ul className="list-decimal list-inside space-y-1 text-sm md:text-base">
                        {initialDoc.attachments.map((file, idx) => (
                            <li key={idx}>
                            <button onClick={() => downloadFile(file)} className="text-blue-600 hover:underline">
                                {file.name}
                            </button>
                            </li>
                        ))}
                        </ul>
                    </div>
                    )}
                </div>
            </div>
            
            <footer className="doc-footer mt-16 shrink-0 mt-auto">
                    <div className="text-center mb-16 h-[60px] flex items-center justify-center">
                    {initialDoc.docType === 'external' && <h2 className="text-2xl md:text-3xl font-black tracking-[0.4em] text-gray-900 pl-2">호치민시한국국제학교장</h2>}
                </div>
                <div className="border-t-2 border-black pt-4 pb-2">
                        <div className="flex items-center justify-between text-xs md:text-sm w-full">
                        <div className="flex items-center gap-1 md:gap-2">
                            <span className="font-bold">{initialDoc.requesterRole}</span>
                            <div className="flex items-center gap-1">
                                <span className="font-semibold">{initialDoc.requesterName}</span>
                                {initialDoc.requesterSignature && <div className="w-8 h-8 md:w-12 md:h-12 flex items-center justify-center"><img src={initialDoc.requesterSignature} className="max-h-full max-w-full object-contain" alt="requester-sig" /></div>}
                            </div>
                        </div>
                        {mainApprovers.map((ap, idx) => (
                            <div key={idx} className="flex items-center gap-1 md:gap-2">
                                <div className="flex flex-col items-start leading-tight">
                                    <span className="font-bold">{ap.role}</span>
                                    {ap.type !== 'normal' && <span className="text-xs text-primary font-bold">{getTypeText(ap.type)}</span>}
                                </div>
                                <div className="flex items-center gap-1">
                                    <span className="font-semibold">{ap.approverName || ap.name}</span>
                                    {ap.status === 'approved' && ap.signature && <div className="w-8 h-8 md:w-12 md:h-12 flex items-center justify-center"><img src={ap.signature} className="max-h-full max-w-full object-contain" alt="signature" /></div>}
                                    {ap.status === 'rejected' && <span className="text-destructive font-bold text-xs">반려</span>}
                                </div>
                            </div>
                        ))}
                        </div>
                        {assistant && (
                        <div className="flex items-center gap-2 text-xs md:text-sm pt-2 mt-2 border-t border-dashed">
                            <span className="font-bold">{assistant.role}</span>
                            <div className="flex items-center gap-1">
                                <span className="font-semibold">{assistant.approverName || assistant.name}</span>
                                {assistant.status === 'approved' && assistant.signature && <div className="w-8 h-8 md:w-12 md:h-12 flex items-center justify-center"><img src={assistant.signature} className="max-h-full max-w-full object-contain" alt="assistant-sig" /></div>}
                                {assistant.status === 'rejected' && <span className="text-destructive font-bold text-xs">반려</span>}
                            </div>
                        </div>
                        )}
                </div>
                {initialDoc.status === 'rejected' && (
                    <div className="mt-4 p-3 bg-destructive/10 border border-destructive/50 rounded-lg">
                        <p className="text-sm font-bold text-destructive">반려 사유:</p>
                        <p className="text-sm text-destructive-foreground mt-1">{initialDoc.approvers.find(ap => ap.status === 'rejected')?.comment}</p>
                    </div>
                )}
                <div className="mt-2 text-[10px] md:text-xs font-medium text-gray-700 space-y-1.5 border-t border-gray-200 pt-4">
                    <div className="flex gap-4">
                        <span><strong>시행</strong> {initialDoc.docNo} ({format(approvalDate, 'yyyy. MM. dd.')})</span>
                        <span><strong>접수</strong> ( )</span>
                    </div>
                    <p><strong>우</strong> {initialConfig.address}</p>
                    <div className="flex flex-col md:flex-row justify-between">
                        <p><strong>전화</strong> {initialConfig.phone} / <strong>전송</strong> {initialConfig.fax} / {initialConfig.email}</p>
                        <p>{initialConfig.homepage} / <strong>{initialDoc.publishStatus}</strong></p>
                    </div>
                    {initialDoc.circulars && initialDoc.circulars.length > 0 && (
                        <div className="flex gap-2 items-start pt-2 border-t border-dashed">
                            <strong className="shrink-0">공람:</strong>
                            <p>{initialDoc.circulars.map(c => c.name).join(', ')}</p>
                        </div>
                    )}
                </div>
            </footer>
        </div>

        {isMyTurn && (
            <div className="no-print fixed bottom-4 md:bottom-6 left-1/2 -translate-x-1/2 z-50 flex gap-4">
                <Button
                    variant="destructive"
                    size="lg"
                    className="h-14 text-base md:text-lg rounded-full shadow-2xl animate-in slide-in-from-bottom-10 fade-in"
                    disabled={isApproving || isRejecting}
                    onClick={() => setShowRejectModal(true)}
                >
                    <XCircle className="mr-2 h-5 w-5" />
                    반려
                </Button>

                <Button 
                    size="lg"
                    className="h-14 text-base md:text-lg rounded-full shadow-2xl animate-in slide-in-from-bottom-10 fade-in"
                    onClick={handleApprove}
                    disabled={isApproving || isRejecting}
                >
                    {isApproving ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <CheckCircle2 className="mr-2 h-5 w-5" />}
                    결재 및 서명
                </Button>
            </div>
        )}

        {showRejectModal && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in duration-200">
                <div className="bg-background w-full max-w-lg rounded-lg shadow-lg border p-6 space-y-4">
                    <div className="space-y-2 text-center sm:text-left">
                        <h2 className="text-lg font-semibold tracking-tight">문서를 반려하시겠습니까?</h2>
                        <p className="text-sm text-muted-foreground">
                            반려 사유를 입력해주세요. 반려된 문서는 기안자에게 돌아가며, 결재가 중단됩니다.
                        </p>
                    </div>
                    
                    <div className="space-y-2">
                         <label htmlFor="rejection-reason" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">반려 사유</label>
                         <textarea 
                            id="rejection-reason"
                            className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                            placeholder="예: 첨부파일 누락, 내용 수정 필요 등"
                            value={rejectionReason}
                            onChange={(e) => setRejectionReason(e.target.value)}
                         />
                    </div>

                    <div className="flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2 gap-2">
                        <Button variant="outline" onClick={() => setShowRejectModal(false)}>취소</Button>
                        <Button 
                            variant="destructive" 
                            onClick={handleReject} 
                            disabled={isRejecting || !rejectionReason}
                        >
                            {isRejecting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            반려 확인
                        </Button>
                    </div>
                </div>
            </div>
        )}
    </div>
  );
}

    