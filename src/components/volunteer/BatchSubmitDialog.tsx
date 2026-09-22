'use client';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Loader2, Send, CheckSquare } from 'lucide-react';

export function BatchSubmitDialog({
  isBatchModalOpen,
  setIsBatchModalOpen,
  selectedDocIds,
  profile,
  batchTitle,
  setBatchTitle,
  batchContent,
  setBatchContent,
  handleSubmitBatch,
  isSubmittingBatch,
}: {
  isBatchModalOpen: boolean;
  setIsBatchModalOpen: (open: boolean) => void;
  selectedDocIds: string[];
  profile: any;
  batchTitle: string;
  setBatchTitle: (val: string) => void;
  batchContent: string;
  setBatchContent: (val: string) => void;
  handleSubmitBatch: () => void;
  isSubmittingBatch: boolean;
}) {
  return (
    <Dialog open={isBatchModalOpen} onOpenChange={setIsBatchModalOpen}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto p-4 sm:p-6 space-y-4">
        <DialogHeader>
          <DialogTitle className="text-base sm:text-lg font-bold flex items-center gap-2">
            <CheckSquare className="w-5 h-5 text-primary" />
            봉사활동 계획서 일괄 기안 상신
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            선택된 {selectedDocIds.length}건의 봉사활동 계획서를 수합하여 결재선으로 기안합니다.
          </DialogDescription>
        </DialogHeader>

        {/* 결재선 안내 */}
        <div className="bg-muted/40 p-3 rounded-lg border text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <span className="font-bold text-slate-700">결재선 (전결 규정 자동 지정):</span>
          <div className="flex items-center gap-1.5 flex-wrap">
            <Badge variant="outline" className="bg-sky-50 text-sky-800 border-sky-200 text-xs">
              기안: {profile?.name || '봉사활동 담당'}
            </Badge>
            <span className="text-muted-foreground">→</span>
            <Badge variant="outline" className="bg-indigo-50 text-indigo-800 border-indigo-200 text-xs">
              검토: 담당 부장
            </Badge>
            <span className="text-muted-foreground">→</span>
            <Badge variant="outline" className="bg-purple-50 text-purple-800 border-purple-200 text-xs">
              결재: 교감 (전결)
            </Badge>
          </div>
        </div>

        <div className="space-y-3">
          <div>
            <Label className="text-xs font-bold">기안문 제목</Label>
            <Input
              value={batchTitle}
              onChange={e => setBatchTitle(e.target.value)}
              placeholder="기안문 제목을 입력하세요"
              className="h-9 text-xs mt-1 font-bold"
            />
          </div>

          <div>
            <Label className="text-xs font-bold">본문 내용 (공문서 표준 수합 양식)</Label>
            <Textarea
              value={batchContent}
              onChange={e => setBatchContent(e.target.value)}
              rows={10}
              className="text-xs mt-1 font-mono leading-relaxed"
            />
            <p className="text-[11px] text-muted-foreground mt-1">
              ※ 위 본문은 HTML 양식으로 전자결재 본문에 등록됩니다. 필요에 따라 세부 문구를 수정하실 수 있습니다.
            </p>
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-2 border-t">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setIsBatchModalOpen(false)}
            disabled={isSubmittingBatch}
          >
            취소
          </Button>
          <Button
            type="button"
            size="sm"
            className="font-bold bg-primary hover:bg-primary/90 text-primary-foreground"
            onClick={handleSubmitBatch}
            disabled={isSubmittingBatch}
          >
            {isSubmittingBatch ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <Send className="w-4 h-4 mr-1.5" />}
            일괄 기안 상신하기 ({selectedDocIds.length}건)
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
