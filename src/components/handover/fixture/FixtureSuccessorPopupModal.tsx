'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { UserProfile } from '@/lib/types';
import { FixtureHandoverDocument } from '@/lib/types/fixtureHandover';
import { markFixtureSuccessorChecked } from '@/lib/services/fixtureHandoverService';
import { CheckCircle2, ExternalLink, KeyRound, Loader2 } from 'lucide-react';

interface FixtureSuccessorPopupModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  documents: FixtureHandoverDocument[];
  currentUserProfile: UserProfile;
  onAllChecked?: () => void;
}

function getRoomLabel(docItem: FixtureHandoverDocument): string {
  return docItem.type === 'CLASSROOM'
    ? `${docItem.grade}학년 ${docItem.classNum}반`
    : docItem.roomName || '특별실';
}

/**
 * 차년도 인수자에게 도착한 비품 인계서 알림 팝업.
 * 확인 시 인수자 서명(등록 서명 또는 성명 직인)이 들어가고 교무부장 확인 대기로 전달된다.
 */
export function FixtureSuccessorPopupModal({
  open,
  onOpenChange,
  documents,
  currentUserProfile,
  onAllChecked,
}: FixtureSuccessorPopupModalProps) {
  const { toast } = useToast();
  const router = useRouter();
  const [activeDocs, setActiveDocs] = useState<FixtureHandoverDocument[]>(documents);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    setActiveDocs(documents);
    setCurrentIndex(0);
  }, [documents]);

  const currentDoc = activeDocs[currentIndex] || activeDocs[0];
  if (!open || !currentDoc) return null;

  const roomLabel = getRoomLabel(currentDoc);
  const filledItems = (currentDoc.items || []).filter((it) => (it.name || '').trim());

  const handleConfirm = async () => {
    setSubmitting(true);
    try {
      await markFixtureSuccessorChecked(
        currentDoc.id,
        currentUserProfile.name || '',
        currentUserProfile.email || ''
      );
      toast({
        title: '비품 인수 확인·서명 완료',
        description: `"${roomLabel}" 비품 인계서에 인수자 서명이 완료되어 교무부장 확인 대기로 전달되었습니다.`,
      });
      const remaining = activeDocs.filter((d) => d.id !== currentDoc.id);
      setActiveDocs(remaining);
      if (remaining.length === 0) {
        onAllChecked?.();
        onOpenChange(false);
      } else {
        setCurrentIndex(0);
      }
    } catch (err: any) {
      toast({
        variant: 'destructive',
        title: '확인 처리 실패',
        description: err?.message || '처리 중 오류가 발생했습니다.',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleGoToList = () => {
    onOpenChange(false);
    router.push('/teacher/handover?mainTab=fixture');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl max-h-[90vh] flex flex-col p-0 gap-0 overflow-hidden">
        <DialogHeader className="bg-[#2471B2] text-white p-5 shrink-0">
          <div className="flex items-center justify-between gap-2">
            <Badge className="bg-[#C49832] text-white hover:bg-[#C49832] border-0 text-xs px-2.5 py-0.5">
              비품 인계서 도착
            </Badge>
            {activeDocs.length > 1 && (
              <span className="text-xs font-semibold bg-white/20 px-2 py-0.5 rounded-full">
                {currentIndex + 1} / {activeDocs.length}건
              </span>
            )}
          </div>
          <DialogTitle className="text-lg font-bold text-white mt-1.5">
            {roomLabel} 비품 인수인계서
          </DialogTitle>
          <DialogDescription className="text-xs text-white/90">
            {currentDoc.authorName} 선생님이 선생님을 {currentDoc.targetNextYear || currentDoc.year + 1}학년도
            인수자로 지정하여 비품 인계서를 보냈습니다. 비품 목록과 윈도우 비밀번호를 확인하시면 인수자 서명이
            등록되어 교무부장 확인 단계로 전달됩니다.
          </DialogDescription>
          {activeDocs.length > 1 && (
            <div className="flex items-center gap-1.5 mt-3 pt-2 border-t border-white/20 overflow-x-auto">
              {activeDocs.map((d, idx) => (
                <button
                  key={d.id}
                  type="button"
                  onClick={() => setCurrentIndex(idx)}
                  className={`text-[11px] px-2 py-0.5 rounded-full whitespace-nowrap ${
                    idx === currentIndex ? 'bg-white text-[#2471B2] font-bold' : 'bg-white/15 text-white'
                  }`}
                >
                  {getRoomLabel(d)}
                </button>
              ))}
            </div>
          )}
        </DialogHeader>

        <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-slate-50">
          <div className="flex items-center gap-2 text-xs bg-white border border-slate-200 rounded-lg p-2.5">
            <KeyRound className="w-4 h-4 text-[#C49832] shrink-0" />
            <span className="text-slate-600">윈도우 로그인 비밀번호:</span>
            <b className="text-slate-900">{currentDoc.windowsPassword || '없음'}</b>
          </div>
          <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
            <table className="w-full text-xs">
              <thead className="bg-slate-100 text-slate-600">
                <tr>
                  <th className="p-2 w-10 text-center">번호</th>
                  <th className="p-2 text-left">비품명</th>
                  <th className="p-2 w-14 text-center">수량</th>
                  <th className="p-2 text-left">비고</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filledItems.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="p-3 text-center text-slate-400">
                      등록된 비품 품목이 없습니다.
                    </td>
                  </tr>
                ) : (
                  filledItems.map((it, idx) => (
                    <tr key={it.id || idx}>
                      <td className="p-2 text-center text-slate-500">{idx + 1}</td>
                      <td className="p-2 font-semibold text-slate-800">{it.name}</td>
                      <td className="p-2 text-center">{it.quantity}</td>
                      <td className="p-2 text-slate-600">{it.note}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        <DialogFooter className="p-4 border-t bg-white flex-row justify-end gap-2 shrink-0">
          <Button type="button" variant="outline" size="sm" onClick={handleGoToList} className="gap-1 text-xs">
            <ExternalLink className="w-3.5 h-3.5" />
            <span>비품 인수인계 화면에서 보기</span>
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={handleConfirm}
            disabled={submitting}
            className="gap-1 text-xs font-bold bg-[#2471B2] hover:bg-[#1f5e94] text-white"
          >
            {submitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
            <span>확인 및 서명</span>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
