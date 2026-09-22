'use client';

import { useState, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { saveHealthSchoolSetting } from '@/lib/services/healthService';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Loader2, ChevronDown, ChevronUp } from "lucide-react";
import { cn } from "@/lib/utils";

// ── 건강기록부 설정 패널 (접기/펼치기) ──────────────────────
export function HealthConfigPanel({
  school,
  schoolConfig,
  onConfigChange,
}: {
  school: string;
  schoolConfig: { officialSchoolName: string; showGuardian: boolean; showBloodType: boolean };
  onConfigChange: (cfg: { officialSchoolName: string; showGuardian: boolean; showBloodType: boolean }) => void;
}) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [localName, setLocalName] = useState(schoolConfig.officialSchoolName);
  const [localGuardian, setLocalGuardian] = useState(schoolConfig.showGuardian);
  const [localBloodType, setLocalBloodType] = useState(schoolConfig.showBloodType);
  const [saving, setSaving] = useState(false);

  // schoolConfig 변경 시 동기화
  useEffect(() => {
    setLocalName(schoolConfig.officialSchoolName);
    setLocalGuardian(schoolConfig.showGuardian);
    setLocalBloodType(schoolConfig.showBloodType);
  }, [schoolConfig]);

  const handleSave = async () => {
    if (!school) return;
    setSaving(true);
    try {
      await saveHealthSchoolSetting(school, {
        officialSchoolName: localName.trim() || undefined,
        healthRecord_showGuardian: localGuardian,
        healthRecord_showBloodType: localBloodType,
      });
      onConfigChange({ officialSchoolName: localName.trim(), showGuardian: localGuardian, showBloodType: localBloodType });
      toast({ title: "✅ 건강기록부 설정 저장", description: "설정이 저장되었습니다." });
      setOpen(false);
    } catch {
      toast({ variant: "destructive", title: "설정 저장 실패" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="rounded-xl border border-green-500/30 bg-green-500/5 overflow-hidden no-print">
      {/* 헤더 (항상 표시) */}
      <button
        type="button"
        className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-green-500/10 transition-colors"
        onClick={() => setOpen(v => !v)}
      >
        <div className="flex items-center gap-2">
          <span className="text-base">🏥</span>
          <span className="font-semibold text-sm">건강기록부 설정</span>
          {schoolConfig.officialSchoolName && (
            <span className="text-xs text-muted-foreground ml-1">— {schoolConfig.officialSchoolName}</span>
          )}
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-muted-foreground hidden sm:flex gap-2">
            <span className={cn("px-1.5 py-0.5 rounded text-[10px]", schoolConfig.showGuardian ? "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300" : "bg-muted text-muted-foreground")}>
              보호자 {schoolConfig.showGuardian ? "ON" : "OFF"}
            </span>
            <span className={cn("px-1.5 py-0.5 rounded text-[10px]", schoolConfig.showBloodType ? "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300" : "bg-muted text-muted-foreground")}>
              혈액형 {schoolConfig.showBloodType ? "ON" : "OFF"}
            </span>
          </span>
          {open ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
        </div>
      </button>

      {/* 펼쳐진 설정 내용 */}
      {open && (
        <div className="px-4 pb-4 pt-2 border-t border-green-500/20 space-y-4">
          {/* 정식 학교 명칭 */}
          <div className="space-y-1.5">
            <Label htmlFor="hc-official-name" className="text-sm font-medium">정식 학교 명칭</Label>
            <p className="text-xs text-muted-foreground">건강기록부에 표시될 학교의 공식 명칭을 입력합니다. (예: 호치민한국국제학교)</p>
            <Input
              id="hc-official-name"
              placeholder="예: 호치민한국국제학교"
              value={localName}
              onChange={e => setLocalName(e.target.value)}
              className="max-w-sm h-8 text-sm"
            />
          </div>
          {/* 토글 옵션 */}
          <div className="flex flex-wrap gap-x-8 gap-y-3">
            <div className="flex items-center justify-between gap-4 min-w-[200px]">
              <div>
                <Label className="text-sm">보호자 성명 표시</Label>
                <p className="text-xs text-muted-foreground">출력 시 보호자 항목 표시</p>
              </div>
              <Switch checked={localGuardian} onCheckedChange={setLocalGuardian} />
            </div>
            <div className="flex items-center justify-between gap-4 min-w-[200px]">
              <div>
                <Label className="text-sm">혈액형 표시</Label>
                <p className="text-xs text-muted-foreground">출력 시 혈액형 항목 표시</p>
              </div>
              <Switch checked={localBloodType} onCheckedChange={setLocalBloodType} />
            </div>
          </div>
          <Button onClick={handleSave} disabled={saving} size="sm">
            {saving ? <><Loader2 className="mr-2 h-3 w-3 animate-spin" />저장 중...</> : "설정 저장"}
          </Button>
        </div>
      )}
    </div>
  );
}
