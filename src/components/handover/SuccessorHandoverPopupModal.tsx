'use client';

import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from '@/hooks/use-toast';
import { HandoverDocument } from '@/lib/types/handover';
import { UserProfile } from '@/lib/types';
import {
  markHandoverSuccessorChecked,
  compareHandoverItemsAsc,
  generateHandoverA4Html,
  withResolvedHandoverSignatures
} from '@/lib/services/handoverService';
import {
  CheckCircle2,
  FolderOpen,
  ExternalLink,
  Printer,
  ChevronRight,
  User,
  Calendar,
  Layers,
  Phone,
  FileText,
  AlertCircle
} from 'lucide-react';
import { useRouter } from 'next/navigation';

interface SuccessorHandoverPopupModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  documents: HandoverDocument[];
  currentUserProfile: UserProfile;
  onAllChecked?: () => void;
  onDocChecked?: (checkedDocId: string) => void;
}

export function SuccessorHandoverPopupModal({
  open,
  onOpenChange,
  documents,
  currentUserProfile,
  onAllChecked,
  onDocChecked
}: SuccessorHandoverPopupModalProps) {
  const { toast } = useToast();
  const router = useRouter();

  const [currentIndex, setCurrentIndex] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [activeDocs, setActiveDocs] = useState<HandoverDocument[]>(documents);

  // 전달받은 documents 변경 시 동기화
  React.useEffect(() => {
    setActiveDocs(documents);
    if (currentIndex >= documents.length) {
      setCurrentIndex(0);
    }
  }, [documents, currentIndex]);

  const currentDoc = activeDocs[currentIndex] || activeDocs[0];

  if (!open || !currentDoc) {
    return null;
  }

  const itemsSorted = [...(currentDoc.items || [])].sort(compareHandoverItemsAsc);

  const handleConfirmChecked = async () => {
    if (!currentDoc.id) return;
    setSubmitting(true);
    try {
      await markHandoverSuccessorChecked(
        currentDoc.id,
        currentUserProfile.email,
        currentUserProfile.name
      );

      toast({
        title: '인수 확인·서명 완료',
        description: `[${currentDoc.primaryDuty}] 인수인계서에 인수자 서명이 완료되어 교무부장 확인 대기로 전달되었습니다.`,
      });

      if (onDocChecked) {
        onDocChecked(currentDoc.id);
      }

      const remaining = activeDocs.filter(d => d.id !== currentDoc.id);
      setActiveDocs(remaining);

      if (remaining.length === 0) {
        if (onAllChecked) onAllChecked();
        onOpenChange(false);
      } else {
        setCurrentIndex(prev => (prev >= remaining.length ? 0 : prev));
      }
    } catch (err: any) {
      console.error('[SuccessorHandoverPopupModal] error:', err);
      toast({
        title: '수신 확인 오류',
        description: err.message || '수신 확인 처리 중 오류가 발생했습니다.',
        variant: 'destructive',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handlePrint = async () => {
    if (!currentDoc) return;
    // 팝업 차단을 피하려고 창은 클릭 즉시 열고, 등록 서명 조회 후 내용을 채운다
    const printWin = window.open('', '_blank', 'width=900,height=960');
    if (!printWin) {
      toast({
        title: '인쇄 팝업 차단',
        description: '브라우저 팝업 차단을 해제해 주시기 바랍니다.',
        variant: 'destructive',
      });
      return;
    }
    const htmlContent = generateHandoverA4Html(await withResolvedHandoverSignatures(currentDoc));
    printWin.document.open();
    printWin.document.write(htmlContent);
    printWin.document.close();
    printWin.focus();
    setTimeout(() => {
      printWin.print();
    }, 450);
  };

  const handleGoToFullView = () => {
    onOpenChange(false);
    router.push(`/teacher/handover?tab=received&docId=${currentDoc.id}`);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[92vh] flex flex-col p-0 gap-0 overflow-hidden border-[#2471B2]/30 shadow-2xl">
        {/* 상단 KIS Blue 헤더 바 */}
        <DialogHeader className="bg-[#2471B2] text-white p-5 shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Badge className="bg-[#C49832] text-white hover:bg-[#C49832] border-0 text-xs px-2.5 py-0.5">
                후임 인수자 수신 확인
              </Badge>
              <span className="text-xs text-white/80">
                {currentDoc.year}학년도 차년도 업무 인계
              </span>
            </div>
            {activeDocs.length > 1 && (
              <span className="text-xs font-semibold bg-white/20 px-2 py-0.5 rounded-full">
                {currentIndex + 1} / {activeDocs.length}건
              </span>
            )}
          </div>
          <DialogTitle className="text-lg sm:text-xl font-bold text-white mt-1.5 flex items-center gap-2">
            <span>{currentDoc.primaryDuty}</span>
            <span className="text-sm font-normal text-white/80">업무 인수인계서 도착</span>
          </DialogTitle>
          <DialogDescription className="text-xs sm:text-sm text-white/90 mt-0.5">
            조직도 부서 설정에 따라 선생님께서 차년도 인수자로 지정되었습니다. 전달된 인수인계 사항을 검토하시고 확인하시면 인수자 서명이 등록되어 교무부장 확인 단계로 전달됩니다.
          </DialogDescription>

          {/* 여러 건 수신된 경우 상단 탭 선택 */}
          {activeDocs.length > 1 && (
            <div className="flex items-center gap-1.5 mt-3 pt-2 border-t border-white/20 overflow-x-auto no-scrollbar">
              {activeDocs.map((doc, idx) => (
                <button
                  key={doc.id || idx}
                  type="button"
                  onClick={() => setCurrentIndex(idx)}
                  className={`px-2.5 py-1 text-xs rounded font-medium whitespace-nowrap transition-all ${
                    idx === currentIndex
                      ? 'bg-white text-[#2471B2] shadow'
                      : 'bg-white/10 text-white hover:bg-white/20'
                  }`}
                >
                  {doc.primaryDuty}
                </button>
              ))}
            </div>
          )}
        </DialogHeader>

        {/* 본문 스크롤 영역 */}
        <ScrollArea className="flex-1 p-5 overflow-y-auto max-h-[calc(92vh-180px)] bg-slate-50">
          <div className="space-y-4">
            {/* 기본 메타 카드 */}
            <Card className="border-slate-200 shadow-sm bg-white">
              <CardContent className="p-4 space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                  <div className="flex items-start gap-2">
                    <User className="w-4 h-4 text-[#2471B2] shrink-0 mt-0.5" />
                    <div>
                      <span className="text-xs text-slate-500 block">전임 인계자</span>
                      <span className="font-semibold text-slate-800">
                        {currentDoc.authorName} 교사
                      </span>
                      <span className="text-xs text-slate-500 ml-1">
                        ({currentDoc.authorDepartment || '소속 부서'})
                      </span>
                      <div className="text-xs text-slate-400">{currentDoc.authorEmail}</div>
                    </div>
                  </div>

                  <div className="flex items-start gap-2">
                    <Calendar className="w-4 h-4 text-[#2471B2] shrink-0 mt-0.5" />
                    <div>
                      <span className="text-xs text-slate-500 block">제출 일시 및 항목 수</span>
                      <span className="font-semibold text-slate-800">
                        {currentDoc.submittedAt ? currentDoc.submittedAt.slice(0, 10) : '제출 대기'}
                      </span>
                      <Badge variant="outline" className="ml-2 text-xs border-slate-300">
                        총 {itemsSorted.length}개 항목
                      </Badge>
                    </div>
                  </div>
                </div>

                {/* 전임자 연락처 */}
                {currentDoc.contactInfo && (
                  <div className="flex items-center gap-2 pt-2 border-t border-slate-100 text-xs text-slate-600">
                    <Phone className="w-3.5 h-3.5 text-slate-400" />
                    <span className="text-slate-500">전임자 비상 연락망:</span>
                    <span className="font-medium text-slate-700">{currentDoc.contactInfo}</span>
                  </div>
                )}

                {/* 전년도 업무 드라이브 링크 */}
                {currentDoc.folderUrl && (
                  <div className="pt-2 border-t border-slate-100">
                    <a
                      href={currentDoc.folderUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#2471B2] hover:underline bg-blue-50 px-2.5 py-1.5 rounded border border-blue-200"
                    >
                      <FolderOpen className="w-4 h-4" />
                      <span>전년도 업무 구글 드라이브 폴더 열람</span>
                      <ExternalLink className="w-3 h-3 ml-0.5 text-[#2471B2]" />
                    </a>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* 총괄 인계 사항 안내 박스 */}
            {currentDoc.generalGuide && (
              <Card className="border-amber-200 bg-amber-50/60 shadow-sm">
                <CardContent className="p-4 space-y-1">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-amber-900">
                    <AlertCircle className="w-4 h-4 text-[#C49832]" />
                    <span>전임자 총괄 인계 사항 및 연간 운영 팁</span>
                  </div>
                  <div className="text-xs sm:text-sm text-slate-700 whitespace-pre-wrap leading-relaxed pl-5">
                    {currentDoc.generalGuide}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* 연간 인계 타임라인 항목 요약 */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h4 className="text-xs sm:text-sm font-bold text-slate-800 flex items-center gap-1.5">
                  <Layers className="w-4 h-4 text-[#2471B2]" />
                  <span>연간 인계 타임라인 항목 ({itemsSorted.length}건)</span>
                </h4>
                <span className="text-xs text-slate-500">시기순 정렬</span>
              </div>

              {itemsSorted.length === 0 ? (
                <div className="text-center py-8 text-xs text-slate-400 bg-white rounded border border-dashed border-slate-200">
                  기록된 세부 인계 항목이 없습니다.
                </div>
              ) : (
                <div className="space-y-2">
                  {itemsSorted.map((item, idx) => (
                    <div
                      key={item.id || idx}
                      className="p-3 bg-white rounded border border-slate-200 text-xs space-y-1 hover:border-[#2471B2]/40 transition-colors"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <Badge className="bg-slate-100 text-slate-700 hover:bg-slate-100 text-[11px] px-1.5 py-0">
                            {item.period || '연간'}
                          </Badge>
                          <Badge variant="outline" className="text-[10px] text-slate-500 border-slate-200">
                            {item.category}
                          </Badge>
                          <span className="font-semibold text-slate-800">
                            {item.documentTitle}
                          </span>
                        </div>
                        <span className="text-[11px] text-slate-400 shrink-0">
                          {item.displayDateTime || item.date || '-'}
                        </span>
                      </div>

                      {item.summary && (
                        <div className="text-slate-600 pl-1 border-l-2 border-slate-200 mt-1 whitespace-pre-wrap">
                          {item.summary}
                        </div>
                      )}

                      {item.folderUrl && (
                        <div className="pt-1">
                          <a
                            href={item.folderUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-[11px] text-[#2471B2] hover:underline"
                          >
                            <ExternalLink className="w-3 h-3" />
                            <span>관련 문서/드라이브 열기</span>
                          </a>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </ScrollArea>

        {/* 하단 액션 버튼 바 */}
        <DialogFooter className="p-4 bg-white border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-2 shrink-0">
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handlePrint}
              className="text-xs h-9 border-slate-300 text-slate-700 hover:bg-slate-100"
            >
              <Printer className="w-3.5 h-3.5 mr-1" />
              A4 인쇄 / PDF
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleGoToFullView}
              className="text-xs h-9 border-slate-300 text-slate-700 hover:bg-slate-100"
            >
              <FileText className="w-3.5 h-3.5 mr-1" />
              상세 대시보드
            </Button>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => onOpenChange(false)}
              className="text-xs h-9 text-slate-500"
            >
              다음에 확인하기
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={handleConfirmChecked}
              disabled={submitting}
              className="text-xs h-9 bg-[#2471B2] hover:bg-[#1f5e94] text-white font-semibold px-4 shadow-sm"
            >
              <CheckCircle2 className="w-4 h-4 mr-1.5" />
              {submitting ? '서명 처리 중...' : '인수인계서 확인 및 서명'}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
