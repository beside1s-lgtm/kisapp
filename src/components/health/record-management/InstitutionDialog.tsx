'use client';

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { Plus } from "lucide-react";
import { LocalBadge as Badge } from './LocalBadge';

export function InstitutionDialog({
  isInstDialogOpen,
  setIsInstDialogOpen,
  generalInstInput,
  setGeneralInstInput,
  generalInstitutions,
  setGeneralInstitutions,
  dentalInstInput,
  setDentalInstInput,
  dentalInstitutions,
  setDentalInstitutions,
  handleSaveInstitutions,
}: {
  isInstDialogOpen: boolean;
  setIsInstDialogOpen: (open: boolean) => void;
  generalInstInput: string;
  setGeneralInstInput: (val: string) => void;
  generalInstitutions: string[];
  setGeneralInstitutions: (list: string[]) => void;
  dentalInstInput: string;
  setDentalInstInput: (val: string) => void;
  dentalInstitutions: string[];
  setDentalInstitutions: (list: string[]) => void;
  handleSaveInstitutions: () => void;
}) {
  return (
    <Dialog open={isInstDialogOpen} onOpenChange={setIsInstDialogOpen}>
      <DialogContent className="sm:max-w-[450px]">
        <DialogHeader>
          <DialogTitle>학교 지정 검진기관 설정</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          {/* 일반검진 기관 */}
          <div className="space-y-2">
            <Label className="font-bold">일반 건강검진 지정 기관</Label>
            <div className="flex gap-2">
              <Input value={generalInstInput} onChange={e => setGeneralInstInput(e.target.value)} placeholder="검진기관명 입력..." />
              <Button size="sm" onClick={() => {
                if (generalInstInput.trim() && !generalInstitutions.includes(generalInstInput.trim())) {
                  setGeneralInstitutions([...generalInstitutions, generalInstInput.trim()]);
                  setGeneralInstInput("");
                }
              }}><Plus className="h-4 w-4" /></Button>
            </div>
            <div className="flex flex-wrap gap-1.5 pt-1">
              {generalInstitutions.map(inst => (
                <Badge key={inst} variant="secondary" className="gap-1.5 px-2 py-1">
                  {inst}
                  <button className="text-destructive font-black text-xs" onClick={() => setGeneralInstitutions(generalInstitutions.filter(x => x !== inst))}>x</button>
                </Badge>
              ))}
            </div>
          </div>

          {/* 구강검진 기관 */}
          <div className="space-y-2 pt-2 border-t">
            <Label className="font-bold">구강검진 지정 기관</Label>
            <div className="flex gap-2">
              <Input value={dentalInstInput} onChange={e => setDentalInstInput(e.target.value)} placeholder="치과명 입력..." />
              <Button size="sm" onClick={() => {
                if (dentalInstInput.trim() && !dentalInstitutions.includes(dentalInstInput.trim())) {
                  setDentalInstitutions([...dentalInstitutions, dentalInstInput.trim()]);
                  setDentalInstInput("");
                }
              }}><Plus className="h-4 w-4" /></Button>
            </div>
            <div className="flex flex-wrap gap-1.5 pt-1">
              {dentalInstitutions.map(inst => (
                <Badge key={inst} variant="secondary" className="gap-1.5 px-2 py-1">
                  {inst}
                  <button className="text-destructive font-black text-xs" onClick={() => setDentalInstitutions(dentalInstitutions.filter(x => x !== inst))}>x</button>
                </Badge>
              ))}
            </div>
          </div>
        </div>
        <DialogFooter>
          <DialogClose asChild><Button variant="ghost">취소</Button></DialogClose>
          <Button onClick={() => { handleSaveInstitutions(); setIsInstDialogOpen(false); }}>저장 완료</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
