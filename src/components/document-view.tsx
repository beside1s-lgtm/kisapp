'use client';
import {
  ApprovalDoc,
  DocConfig,
} from '@/lib/types';
import { useAuth } from '@/hooks/use-auth';
import { useToast } from '@/hooks/use-toast';
import { approveDocument } from '@/app/actions';
import { useRouter } from 'next/navigation';
import { Button } from './ui/button';
import { CheckCircle2, Download, Printer } from 'lucide-react';
import { format } from 'date-fns';
import { useTransition } from 'react';

type DocumentViewProps = {
  initialDoc: ApprovalDoc;
  initialConfig: DocConfig;
};

export default function DocumentView({ initialDoc, initialConfig }: DocumentViewProps) {
  const { user, profile } = useAuth();
  const { toast } = useToast();
  const router = useRouter();
  const [isApproving, startApproveTransition] = useTransition();

  if (!user || !profile) return null;

  const isMyTurn = initialDoc.approvers[initialDoc.currentStep]?.email === user.email && initialDoc.status === 'pending';
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
        const confirmed = window.confirm("You have no signature set. Do you want to approve without a signature?");
        if(!confirmed) return;
    }
    startApproveTransition(async () => {
      const result = await approveDocument(initialDoc.id, user.uid, profile);
      if (result.success) {
        toast({ title: 'Approved!', description: 'The document has been approved.' });
        router.push('/inbox');
        router.refresh();
      } else {
        toast({ variant: 'destructive', title: 'Approval Failed', description: result.error });
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

  return (
    <div>
        <div className="print:hidden flex justify-end gap-2 mb-4">
            <Button variant="outline" onClick={() => window.print()}>
                <Printer className="mr-2 h-4 w-4" /> Print / Save as PDF
            </Button>
        </div>
        <div className="bg-white p-12 shadow-lg rounded-lg max-w-4xl mx-auto A4-page">
            <style jsx global>{`
                @media print {
                    body * {
                        visibility: hidden;
                    }
                    .printable-area, .printable-area * {
                        visibility: visible;
                    }
                    .printable-area {
                        position: absolute;
                        left: 0;
                        top: 0;
                        width: 100%;
                        height: 100%;
                        padding: 2.5cm;
                        margin: 0;
                    }
                    .print-hidden {
                        display: none;
                    }
                }
                 @page {
                    size: A4;
                    margin: 0;
                }
            `}</style>
            <div className="printable-area">
                <header className="text-center mb-8">
                    <p className="text-sm font-medium text-gray-500 mb-6 tracking-tight">글로네이컬(GloNaCal) 미래 인재를 키우는 행복한 학교</p>
                    {initialDoc.headerImage ? (
                        <img src={initialDoc.headerImage} alt="School Header" className="h-16 mx-auto mb-2 object-contain" />
                    ) : (
                        <>
                            <h1 className="text-4xl font-extrabold tracking-[0.2em] text-gray-900 mb-0">호치민시한국국제학교</h1>
                            <p className="text-sm font-bold text-gray-500 tracking-wider">KOREAN INTERNATIONAL SCHOOL HCMC</p>
                        </>
                    )}
                </header>

                <div className="mt-12 mb-8">
                    <div className="space-y-1 mb-2">
                        <p className="text-base"><span className="font-bold">수신</span> <span className="ml-2 font-medium">{initialDoc.docType === 'external' ? initialDoc.receiverInfo?.name : '내부결재'}</span></p>
                        <p className="text-sm">(경유)</p>
                    </div>
                    <div className="h-0.5 bg-black w-full" />
                </div>
                
                <div className="flex mb-10 items-start">
                    <span className="w-20 font-bold text-lg shrink-0">제 목:</span>
                    <span className="text-xl font-bold text-gray-900 leading-tight">{initialDoc.title}</span>
                </div>

                <div className="min-h-[400px] text-base leading-loose whitespace-pre-wrap font-serif text-gray-800 tracking-normal"
                    dangerouslySetInnerHTML={{ __html: initialDoc.content.replace(/\n/g, '<br />') }} />

                {initialDoc.attachments?.length > 0 && (
                <div className="mt-12">
                    <h3 className="font-bold mb-2 text-lg">붙임</h3>
                    <ul className="list-decimal list-inside space-y-1">
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
                
                <footer className="mt-16">
                     <div className="text-center mb-16 h-[60px] flex items-center justify-center">
                        {initialDoc.docType === 'external' && <h2 className="text-3xl font-black tracking-[0.4em] text-gray-900 pl-2">호치민시한국국제학교장</h2>}
                    </div>
                    <div className="border-t-2 border-black pt-4 pb-2">
                         <div className="flex items-center justify-between text-sm w-full">
                            <div className="flex items-center gap-2">
                                <span className="font-bold">{initialDoc.requesterRole}</span>
                                <div className="flex items-center gap-1">
                                    <span className="font-semibold">{initialDoc.requesterName}</span>
                                    {initialDoc.requesterSignature && <div className="w-12 h-12 flex items-center justify-center"><img src={initialDoc.requesterSignature} className="max-h-full max-w-full object-contain" alt="requester-sig" /></div>}
                                </div>
                            </div>
                            {mainApprovers.map((ap, idx) => (
                                <div key={idx} className="flex items-center gap-2">
                                    <div className="flex flex-col items-start leading-tight">
                                        <span className="font-bold">{ap.role}</span>
                                        {ap.type !== 'normal' && <span className="text-xs text-primary font-bold">{getTypeText(ap.type)}</span>}
                                    </div>
                                    <div className="flex items-center gap-1">
                                        <span className="font-semibold">{ap.approverName || ap.name}</span>
                                        {ap.status === 'approved' && ap.signature && <div className="w-12 h-12 flex items-center justify-center"><img src={ap.signature} className="max-h-full max-w-full object-contain" alt="signature" /></div>}
                                    </div>
                                </div>
                            ))}
                         </div>
                         {assistant && (
                            <div className="flex items-center gap-2 text-sm pt-2 mt-2 border-t border-dashed">
                               <span className="font-bold">{assistant.role}</span>
                                <div className="flex items-center gap-1">
                                    <span className="font-semibold">{assistant.approverName || assistant.name}</span>
                                    {assistant.status === 'approved' && assistant.signature && <div className="w-12 h-12 flex items-center justify-center"><img src={assistant.signature} className="max-h-full max-w-full object-contain" alt="assistant-sig" /></div>}
                                </div>
                            </div>
                         )}
                    </div>
                    <div className="mt-2 text-xs font-medium text-gray-700 space-y-1.5 border-t border-gray-200 pt-4">
                        <div className="flex gap-4">
                            <span><strong>시행</strong> {initialDoc.docNo} ({format(approvalDate, 'yyyy. MM. dd.')})</span>
                            <span><strong>접수</strong> ( )</span>
                        </div>
                        <p><strong>우</strong> {initialConfig.address}</p>
                        <div className="flex justify-between">
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
        </div>
        {isMyTurn && (
            <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 print-hidden">
                <Button 
                    size="lg"
                    className="h-14 text-lg rounded-full shadow-2xl animate-in slide-in-from-bottom-10 fade-in"
                    onClick={handleApprove}
                    disabled={isApproving}
                >
                    {isApproving ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <CheckCircle2 className="mr-2 h-5 w-5" />}
                    Approve and Sign
                </Button>
            </div>
        )}
    </div>
  );
}
