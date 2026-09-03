'use client';

import React, { useState, useMemo, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useToast } from '@/hooks/use-toast';
import { resizeStudentPhoto } from '@/lib/imageResize';
import { updateMasterStudent } from '@/lib/services/masterStudentService';
import type { MasterStudent } from '@/lib/types/masterStudent';
import { 
  Camera, Upload, CheckCircle2, AlertCircle, HelpCircle, 
  Trash2, RefreshCw, Sparkles, UserCheck, Layers, ArrowRight
} from 'lucide-react';

interface BatchPhotoModalProps {
  isOpen: boolean;
  onClose: () => void;
  students: MasterStudent[];
}

interface PhotoMappingItem {
  id: string;
  file: File;
  fileName: string;
  previewUrl: string; // 160x160 2cm resized DataURL
  matchedStudentId: string | null;
  status: 'MATCHED' | 'MULTIPLE' | 'UNMATCHED';
  candidateStudents: MasterStudent[];
}

export function BatchPhotoModal({ isOpen, onClose, students }: BatchPhotoModalProps) {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 학년 및 반 선택 상태 (담임 교사 기준)
  const [selectedGrade, setSelectedGrade] = useState<string>('1');
  const [selectedClass, setSelectedClass] = useState<string>('1');

  // 업로드된 사진 매핑 아이템 목록
  const [items, setItems] = useState<PhotoMappingItem[]>([]);
  const [isProcessingFiles, setIsProcessingFiles] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // 현재 선택된 학년/반의 학생 목록 (번호순 정렬)
  const targetStudents = useMemo(() => {
    return students
      .filter(s => String(s.grade) === String(selectedGrade) && String(s.classNum) === String(selectedClass))
      .sort((a, b) => (parseInt(a.studentNum || '0') || 0) - (parseInt(b.studentNum || '0') || 0));
  }, [students, selectedGrade, selectedClass]);

  // 해당 학년에서 존재하는 반 목록
  const availableClasses = useMemo(() => {
    const classSet = new Set(
      students
        .filter(s => String(s.grade) === String(selectedGrade))
        .map(s => String(s.classNum || '1'))
        .filter(Boolean)
    );
    const list = Array.from(classSet).sort((a, b) => parseInt(a) - parseInt(b));
    return list.length > 0 ? list : ['1', '2', '3', '4', '5'];
  }, [students, selectedGrade]);

  // 스마트 파일명 매칭 알고리즘 (출석번호 단독, 번호+이름, 이름 단독 모두 완벽 지원)
  const matchFileToStudent = (fileName: string, studentPool: MasterStudent[]) => {
    // 1. 확장자 제거 및 앞뒤 공백 제거
    const baseName = fileName.replace(/\.[^/.]+$/, '').trim();
    
    // 2. [신규 강력 지원] 파일명이 순수 출석번호인 경우 (예: "1", "01", "2번", "02번", "No.1", "no_3", "#5")
    const pureNumMatch = baseName.match(/^(?:no\.?|#)?\s*(\d+)\s*번?$/i);
    if (pureNumMatch) {
      const targetNum = String(parseInt(pureNumMatch[1], 10));
      const matchedByNum = studentPool.find(s => {
        const sNum = String(parseInt(s.studentNum || '0', 10));
        return sNum === targetNum;
      });
      if (matchedByNum) {
        return {
          matchedStudentId: matchedByNum.studentId,
          status: 'MATCHED' as const,
          candidateStudents: [matchedByNum],
        };
      }
    }

    // 3. 파일명에서 번호와 이름 분리 시도 (예: "1번 김동희", "01_김동희", "김동희(1)", "1-김동희")
    const numNameMatch = baseName.match(/^(\d+)[\s_번\-\.](.+)$/) || baseName.match(/^(.+)[\s_번\-\.](\d+)$/);
    let extractedNum: string | null = null;
    let extractedName: string = baseName;

    if (numNameMatch) {
      if (/^\d+$/.test(numNameMatch[1])) {
        extractedNum = String(parseInt(numNameMatch[1], 10));
        extractedName = numNameMatch[2].trim();
      } else {
        extractedName = numNameMatch[1].trim();
        extractedNum = String(parseInt(numNameMatch[2], 10));
      }
    }

    // 이름의 공백 및 특수문자 제거
    const cleanExtractedName = extractedName.replace(/[\s_\-\(\)\[\]]/g, '').toLowerCase();

    // 4. 후보 탐색
    // 1순위: 번호와 이름이 모두 일치
    if (extractedNum) {
      const exactNumAndName = studentPool.find(s => {
        const sNum = String(parseInt(s.studentNum || '0', 10));
        const sName = (s.nameKo || s.name || '').replace(/\s/g, '').toLowerCase();
        return sNum === extractedNum && (sName === cleanExtractedName || cleanExtractedName.includes(sName));
      });
      if (exactNumAndName) {
        return {
          matchedStudentId: exactNumAndName.studentId,
          status: 'MATCHED' as const,
          candidateStudents: [exactNumAndName],
        };
      }
    }

    // 2순위: 이름이 정확히 일치
    const nameMatches = studentPool.filter(s => {
      const sName = (s.nameKo || s.name || '').replace(/\s/g, '').toLowerCase();
      return sName === cleanExtractedName || cleanExtractedName === sName;
    });

    if (nameMatches.length === 1) {
      return {
        matchedStudentId: nameMatches[0].studentId,
        status: 'MATCHED' as const,
        candidateStudents: nameMatches,
      };
    } else if (nameMatches.length > 1) {
      // 동명이인 발생! (사용자가 선택하도록 후보군 제공)
      return {
        matchedStudentId: null,
        status: 'MULTIPLE' as const,
        candidateStudents: nameMatches,
      };
    }

    // 3순위: 이름이 파일명에 포함된 경우
    const partialMatches = studentPool.filter(s => {
      const sName = (s.nameKo || s.name || '').replace(/\s/g, '').toLowerCase();
      return sName.length >= 2 && cleanExtractedName.includes(sName);
    });

    if (partialMatches.length === 1) {
      return {
        matchedStudentId: partialMatches[0].studentId,
        status: 'MATCHED' as const,
        candidateStudents: partialMatches,
      };
    } else if (partialMatches.length > 1) {
      return {
        matchedStudentId: null,
        status: 'MULTIPLE' as const,
        candidateStudents: partialMatches,
      };
    }

    // 4순위: 번호만 일치하는 경우 (보조 매칭 후보)
    if (extractedNum) {
      const numMatches = studentPool.filter(s => String(parseInt(s.studentNum || '0', 10)) === extractedNum);
      if (numMatches.length === 1) {
        return {
          matchedStudentId: numMatches[0].studentId,
          status: 'MATCHED' as const,
          candidateStudents: numMatches,
        };
      }
    }

    // 미매칭 (전체 학생 중 선택 가능하도록 후보군 제공)
    return {
      matchedStudentId: null,
      status: 'UNMATCHED' as const,
      candidateStudents: studentPool,
    };
  };

  // 다중 파일 선택 및 자동 리사이징 & 매핑 처리
  const handleFilesSelected = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setIsProcessingFiles(true);

    const imageFiles = Array.from(files).filter(f => f.type.startsWith('image/'));
    if (imageFiles.length === 0) {
      toast({
        title: '이미지 파일 없음',
        description: 'JPG, PNG, WebP 등 이미지 파일만 등록할 수 있습니다.',
        variant: 'destructive',
      });
      setIsProcessingFiles(false);
      return;
    }

    try {
      const newItems: PhotoMappingItem[] = [];

      for (let i = 0; i < imageFiles.length; i++) {
        const file = imageFiles[i];
        // 2cm 최적 해상도(160x160) 및 5~12KB 초경량 압축 변환
        const previewUrl = await resizeStudentPhoto(file);
        const matchResult = matchFileToStudent(file.name, targetStudents);

        newItems.push({
          id: `${file.name}_${Date.now()}_${i}`,
          file,
          fileName: file.name,
          previewUrl,
          matchedStudentId: matchResult.matchedStudentId,
          status: matchResult.status,
          candidateStudents: matchResult.candidateStudents,
        });
      }

      setItems(prev => [...prev, ...newItems]);
      const matchedCount = newItems.filter(item => item.status === 'MATCHED').length;
      toast({
        title: '사진 분석 및 매핑 완료',
        description: `총 ${newItems.length}개 파일 중 ${matchedCount}명의 학생이 자동으로 매핑되었습니다.`,
      });
    } catch (err: any) {
      toast({
        title: '사진 변환 오류',
        description: err.message || '사진을 분석하는 중 오류가 발생했습니다.',
        variant: 'destructive',
      });
    } finally {
      setIsProcessingFiles(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // 수동 매핑 학생 변경 핸들러
  const handleSelectStudent = (itemId: string, studentId: string) => {
    setItems(prev => prev.map(item => {
      if (item.id !== itemId) return item;
      return {
        ...item,
        matchedStudentId: studentId === 'none' ? null : studentId,
        status: studentId === 'none' ? 'UNMATCHED' : 'MATCHED',
      };
    }));
  };

  // 아이템 삭제
  const handleRemoveItem = (itemId: string) => {
    setItems(prev => prev.filter(item => item.id !== itemId));
  };

  // 전체 초기화
  const handleClearAll = () => {
    setItems([]);
  };

  // 일괄 저장 실행
  const handleSaveAll = async () => {
    const validItems = items.filter(item => item.matchedStudentId);
    if (validItems.length === 0) {
      toast({
        title: '저장할 학생 없음',
        description: '매핑된 학생이 없습니다. 학생을 지정한 후 저장해주세요.',
        variant: 'destructive',
      });
      return;
    }

    setIsSaving(true);
    let successCount = 0;

    try {
      for (const item of validItems) {
        if (!item.matchedStudentId) continue;
        await updateMasterStudent(item.matchedStudentId, {
          photoUrl: item.previewUrl,
        });
        successCount++;
      }

      toast({
        title: '사진 일괄 등록 완료',
        description: `${selectedGrade}학년 ${selectedClass}반 학생 ${successCount}명의 사진이 성공적으로 등록되었습니다.`,
      });
      setItems([]);
      onClose();
    } catch (err) {
      console.error(err);
      toast({
        title: '저장 실패',
        description: '일괄 저장 중 오류가 발생했습니다.',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  // 매핑 현황 통계
  const stats = useMemo(() => {
    const totalFiles = items.length;
    const matched = items.filter(i => i.status === 'MATCHED' && i.matchedStudentId).length;
    const multiple = items.filter(i => i.status === 'MULTIPLE').length;
    const unmatched = items.filter(i => !i.matchedStudentId).length;
    return { totalFiles, matched, multiple, unmatched };
  }, [items]);

  return (
    <Dialog open={isOpen} onOpenChange={open => { if (!open) onClose(); }}>
      <DialogContent className="sm:max-w-[760px] w-[96vw] max-h-[90vh] overflow-y-auto overflow-x-hidden p-6 sm:p-7 rounded-2xl">
        <DialogHeader className="pb-2 border-b border-slate-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="p-2.5 bg-indigo-100 text-indigo-700 rounded-xl">
                <Camera className="h-5 w-5" />
              </div>
              <div>
                <DialogTitle className="text-lg font-bold text-slate-900 flex items-center gap-2">
                  <span>학급별 학생 사진 스마트 일괄 등록</span>
                  <Badge variant="outline" className="text-[10px] bg-emerald-50 border-emerald-200 text-emerald-700 font-bold">
                    파일명 자동 인식 매핑
                  </Badge>
                </DialogTitle>
                <DialogDescription className="text-xs text-slate-500 mt-0.5">
                  학년과 반을 선택한 후 사진 파일들을 일괄 등록하면, 파일명(이름/번호)을 분석하여 학생과 자동으로 1:1 매핑합니다.
                </DialogDescription>
              </div>
            </div>
          </div>
        </DialogHeader>

        {/* 1. 학년 / 반 선택 바 (담임 모드) */}
        <div className="bg-slate-50 border border-slate-200 p-4 rounded-xl space-y-3 mt-1">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1.5">
                <Label className="text-xs font-bold text-slate-700 whitespace-nowrap">대상 학년:</Label>
                <Select value={selectedGrade} onValueChange={(val) => { setSelectedGrade(val); setItems([]); }}>
                  <SelectTrigger className="h-8.5 w-24 text-xs font-bold bg-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">1학년</SelectItem>
                    <SelectItem value="2">2학년</SelectItem>
                    <SelectItem value="3">3학년</SelectItem>
                    <SelectItem value="4">4학년</SelectItem>
                    <SelectItem value="5">5학년</SelectItem>
                    <SelectItem value="6">6학년</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center gap-1.5">
                <Label className="text-xs font-bold text-slate-700 whitespace-nowrap">대상 반:</Label>
                <Select value={selectedClass} onValueChange={(val) => { setSelectedClass(val); setItems([]); }}>
                  <SelectTrigger className="h-8.5 w-24 text-xs font-bold bg-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {availableClasses.map(c => (
                      <SelectItem key={c} value={c}>{c}반</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="text-xs font-semibold text-slate-600 flex items-center gap-2">
              <span>{selectedGrade}학년 {selectedClass}반 수강 학생: <strong className="text-indigo-600 font-extrabold">{targetStudents.length}명</strong></span>
              <span className="text-slate-300">|</span>
              <span>현재 사진 등록: <strong className="text-emerald-600">{targetStudents.filter(s => s.photoUrl).length}명</strong></span>
            </div>
          </div>
        </div>

        {/* 2. 사진 파일 다중 업로드 영역 */}
        <div 
          onClick={() => fileInputRef.current?.click()}
          className="border-2 border-dashed border-indigo-200 hover:border-indigo-400 bg-indigo-50/40 hover:bg-indigo-50/80 transition p-5 rounded-2xl text-center cursor-pointer flex flex-col items-center justify-center gap-2"
        >
          <input
            type="file"
            ref={fileInputRef}
            onChange={(e) => handleFilesSelected(e.target.files)}
            multiple
            accept="image/*"
            className="hidden"
          />
          <div className="p-3 bg-white text-indigo-600 rounded-full shadow-2xs">
            <Upload className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xs font-bold text-indigo-950">
              이곳을 클릭하거나 학생 사진 파일들을 한꺼번에 끌어다 놓으세요 (다중 선택 가능)
            </p>
            <p className="text-[11px] text-slate-600 mt-1">
              파일명 규칙 예시: <span className="font-mono text-indigo-700 font-bold bg-indigo-100/70 px-1.5 py-0.5 rounded">1.jpg</span>, <span className="font-mono text-indigo-700 font-bold bg-indigo-100/70 px-1.5 py-0.5 rounded">02.png</span>, <span className="font-mono text-indigo-700 font-bold bg-indigo-100/70 px-1.5 py-0.5 rounded">3번.jpeg</span>, <span className="font-mono text-indigo-700 font-bold bg-indigo-100/70 px-1.5 py-0.5 rounded">김동희.jpg</span>, <span className="font-mono text-indigo-700 font-bold bg-indigo-100/70 px-1.5 py-0.5 rounded">1번 김동희.png</span>
            </p>
            <p className="text-[10.5px] text-slate-500 mt-0.5">
              학급(학년/반) 내에서 등록하므로 <strong>출석번호 숫자만 적힌 파일(1.jpg, 02.png 등)</strong>도 해당 학생과 100% 자동 매핑됩니다.
            </p>
          </div>
          {isProcessingFiles && (
            <div className="flex items-center gap-2 text-xs text-indigo-700 font-bold mt-1 animate-pulse">
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              사진 파일 분석 및 2cm 최적화 리사이징 중...
            </div>
          )}
        </div>

        {/* 3. 매핑 결과 요약 바 */}
        {items.length > 0 && (
          <div className="flex items-center justify-between bg-slate-100 p-3 rounded-xl text-xs">
            <div className="flex items-center gap-3 flex-wrap">
              <span className="font-bold text-slate-700">전체 파일: {stats.totalFiles}개</span>
              <Badge className="bg-emerald-600 text-white text-[11px] font-bold">
                자동 매칭 성공: {stats.matched}명
              </Badge>
              {stats.multiple > 0 && (
                <Badge className="bg-amber-500 text-white text-[11px] font-bold">
                  동명이인/선택 필요: {stats.multiple}건
                </Badge>
              )}
              {stats.unmatched > 0 && (
                <Badge className="bg-rose-500 text-white text-[11px] font-bold">
                  미매칭: {stats.unmatched}건
                </Badge>
              )}
            </div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleClearAll}
              className="h-7 text-xs px-2 text-slate-500 hover:text-rose-600"
            >
              전체 지우기
            </Button>
          </div>
        )}

        {/* 4. 파일별 스마트 매핑 리스트 */}
        {items.length > 0 && (
          <div className="space-y-2.5 max-h-[320px] overflow-y-auto pr-1 border border-slate-200 rounded-xl p-3 bg-white">
            {items.map((item, idx) => {
              const matchedStudent = targetStudents.find(s => s.studentId === item.matchedStudentId);

              return (
                <div 
                  key={item.id}
                  className={`p-2.5 rounded-xl border flex items-center justify-between gap-3 transition ${
                    item.status === 'MATCHED' && item.matchedStudentId
                      ? 'bg-emerald-50/40 border-emerald-200'
                      : item.status === 'MULTIPLE'
                      ? 'bg-amber-50/40 border-amber-200'
                      : 'bg-rose-50/40 border-rose-200'
                  }`}
                >
                  {/* 사진 썸네일 & 파일명 */}
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <span className="text-xs font-mono text-slate-400 w-5 text-right">{idx + 1}</span>
                    <Avatar className="w-10 h-10 rounded-xl border border-slate-200 shrink-0 shadow-2xs bg-white">
                      <AvatarImage src={item.previewUrl} alt={item.fileName} className="object-cover rounded-xl" />
                      <AvatarFallback className="text-[10px] rounded-xl">사진</AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-bold text-slate-800 truncate" title={item.fileName}>
                        {item.fileName}
                      </p>
                      <p className="text-[10px] text-slate-500 font-mono">
                        {(item.file.size / 1024).toFixed(1)}KB → 2cm(160x160) 압축
                      </p>
                    </div>
                  </div>

                  {/* 매핑 상태 아이콘 */}
                  <div className="flex items-center gap-1.5 shrink-0">
                    <ArrowRight className="w-4 h-4 text-slate-400" />
                  </div>

                  {/* 학생 매핑 셀렉터 (동명이인 및 미매칭 시 수동 선택 가능) */}
                  <div className="flex items-center gap-2 flex-1 max-w-[280px]">
                    <Select 
                      value={item.matchedStudentId || 'none'} 
                      onValueChange={(val) => handleSelectStudent(item.id, val)}
                    >
                      <SelectTrigger className={`h-8 text-xs font-bold ${
                        item.matchedStudentId ? 'bg-white text-slate-900 border-slate-300' : 'bg-rose-100/60 text-rose-800 border-rose-300'
                      }`}>
                        <SelectValue placeholder="학생 선택..." />
                      </SelectTrigger>
                      <SelectContent className="max-h-56">
                        <SelectItem value="none" className="text-xs text-rose-600 font-semibold">
                          (매핑 제외 / 미지정)
                        </SelectItem>
                        {targetStudents.map(st => (
                          <SelectItem key={st.studentId} value={st.studentId} className="text-xs">
                            {st.studentNum ? `${st.studentNum}번 ` : ''}{st.name} ({st.studentEmail.split('@')[0]})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => handleRemoveItem(item.id)}
                      className="h-8 w-8 p-0 text-slate-400 hover:text-rose-600 hover:bg-rose-50 shrink-0"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <DialogFooter className="pt-3 border-t border-slate-200 flex sm:justify-between items-center flex-wrap gap-2">
          <span className="text-xs text-slate-500 font-medium">
            {items.length > 0 ? (
              <>매핑 완료: <strong className="text-emerald-700 font-bold">{stats.matched}명</strong> / 전체 파일 {stats.totalFiles}개</>
            ) : (
              '사진 파일을 등록하면 매핑 목록이 생성됩니다.'
            )}
          </span>
          <div className="flex items-center gap-2">
            <Button type="button" variant="outline" size="sm" onClick={onClose} className="h-9 text-xs font-semibold">
              닫기
            </Button>
            <Button
              type="button"
              size="sm"
              disabled={isSaving || stats.matched === 0}
              onClick={handleSaveAll}
              className="h-9 px-4 text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs"
            >
              {isSaving ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                  일괄 저장 중...
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-3.5 h-3.5 mr-1.5" />
                  매핑된 {stats.matched}명 사진 일괄 저장
                </>
              )}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
