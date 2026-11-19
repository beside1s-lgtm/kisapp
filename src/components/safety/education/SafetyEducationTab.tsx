'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  GraduationCap,
  FileText,
  Printer,
  PlusCircle,
  Clock,
  ShieldCheck,
  Flame,
  Activity,
  ArrowRight,
  ChevronRight,
  FilePlus,
  Settings2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { SafetyDocModal, SafetyDocTypeId } from './SafetyDocModal';
import { YearlyTemplateModal } from './YearlyTemplateModal';
import { EvacuationTemplateModal } from './EvacuationTemplateModal';
import {
  generateYearlyPlanAttachmentHtml,
  generateEvacuationPlanAttachmentHtml,
} from './templates/safetyHtmlGenerator';
import {
  loadYearlyTemplate,
  loadEvacuationTemplate,
} from '@/lib/safety/safetyTemplateService';
import { getApprovalsCol } from '@/lib/services/documentService';
import { query, where, getDocs, orderBy, limit } from 'firebase/firestore';
import { ApprovalDoc } from '@/lib/types';
import { useRouter } from 'next/navigation';

export function SafetyEducationTab() {
  const router = useRouter();

  // 스쿨버스 스타일 공문서 기안 모달 열림 상태
  const [isDocModalOpen, setIsDocModalOpen] = useState(false);
  const [selectedDocType, setSelectedDocType] = useState<SafetyDocTypeId>(1);

  // 기본 템플릿(틀) 설정 모달 상태
  const [isYearlyTemplateModalOpen, setIsYearlyTemplateModalOpen] = useState(false);
  const [isEvacTemplateModalOpen, setIsEvacTemplateModalOpen] = useState(false);

  // 최근 안전교육 관련 결재 문서 목록
  const [safetyDocs, setSafetyDocs] = useState<ApprovalDoc[]>([]);
  const [isLoadingDocs, setIsLoadingDocs] = useState(false);

  // 결재 문서 목록 불러오기
  const loadSafetyDocs = useCallback(async () => {
    setIsLoadingDocs(true);
    try {
      const q = query(
        getApprovalsCol(),
        where('docType', '==', 'internal'),
        orderBy('createdAt', 'desc'),
        limit(20)
      );
      const snap = await getDocs(q);
      const docs: ApprovalDoc[] = [];
      snap.forEach((d) => {
        const data = d.data() as ApprovalDoc;
        if (
          data.title?.includes('안전교육') ||
          data.title?.includes('대피 훈련') ||
          data.title?.includes('안전지도')
        ) {
          docs.push({ ...data, id: d.id });
        }
      });
      setSafetyDocs(docs);
    } catch (e) {
      console.warn('안전 결재 문서 로드 스킵 또는 인덱스 대기:', e);
    } finally {
      setIsLoadingDocs(false);
    }
  }, []);

  useEffect(() => {
    loadSafetyDocs();
  }, [loadSafetyDocs]);

  // 1. 연간 안전교육 운영 계획 문서 검색
  const yearlyDoc = useMemo(() => {
    return safetyDocs.find((d) => d.title?.includes('안전교육 운영 계획'));
  }, [safetyDocs]);

  // 2. 1학기 재난대피(지진) 훈련 문서 검색
  const earthquakeDoc = useMemo(() => {
    return safetyDocs.find(
      (d) =>
        d.title?.includes('지진') ||
        (d.title?.includes('대피') && (d.title?.includes('1학기') || d.title?.includes('5월')))
    );
  }, [safetyDocs]);

  // 3. 2학기 재난대피(화재) 훈련 문서 검색
  const fireDoc = useMemo(() => {
    return safetyDocs.find(
      (d) =>
        d.title?.includes('화재') ||
        (d.title?.includes('대피') && (d.title?.includes('2학기') || d.title?.includes('10월')))
    );
  }, [safetyDocs]);

  // 기안문 본문에서 일시 추출 헬퍼
  const extractDateTime = (doc?: ApprovalDoc, defaultFallback = '일정 미정'): string => {
    if (!doc) return defaultFallback;
    if (doc.content) {
      const match = doc.content.match(/일\s*시\s*[:：]\s*([^<\n]+)/i);
      if (match && match[1]) {
        return match[1].replace(/&nbsp;/g, ' ').trim();
      }
    }
    return defaultFallback;
  };

  // 공문서 모달 열기
  const openDocModal = (docType: SafetyDocTypeId) => {
    setSelectedDocType(docType);
    setIsDocModalOpen(true);
  };

  // 붙임 문서 HTML 팝업 미리보기 및 즉시 PDF 출력 (커스텀 템플릿 실시간 반영)
  const handlePreviewAttachment = async (type: SafetyDocTypeId) => {
    let html = '';
    if (type === 1) {
      const yearlyTpl = await loadYearlyTemplate();
      html = generateYearlyPlanAttachmentHtml('2026', '1학기', yearlyTpl);
    } else {
      const evacTpl = await loadEvacuationTemplate();
      html = generateEvacuationPlanAttachmentHtml(
        '2026',
        '1학기',
        '지진',
        '2026. 5. 23.(금) 7교시',
        '각 교실 및 학교 전체 대피소',
        evacTpl
      );
    }

    const win = window.open('', '_blank');
    if (win) {
      win.document.write(html);
      win.document.close();
    }
  };

  return (
    <div className="space-y-6">
      {/* 1. 상단 통계 및 추진 현황 카드 + 공문서 기안 바로가기 액션 바 */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-3.5 sm:p-4 rounded-2xl border border-slate-200/80 shadow-2xs">
        <div className="space-y-0.5">
          <h2 className="text-sm font-black text-slate-900 flex items-center gap-1.5">
            <GraduationCap className="w-4 h-4 text-rose-600" />
            2026학년도 학생 안전교육 관리소
          </h2>
          <p className="text-xs text-slate-500">
            스쿨버스 관리자와 동일한 시스템 표준 기안기를 통해 안전교육 운영 계획 및 재난대피 훈련을 즉시 기안합니다.
          </p>
        </div>

        <Button
          onClick={() => openDocModal(1)}
          className="h-9 px-4 text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white rounded-xl shadow-xs shrink-0"
        >
          <FilePlus className="w-4 h-4 mr-1.5" />
          공문서 기안 작성
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
        {/* 카드 1: 연간 이수 시수 (계획 수립 여부 실시간 연동) */}
        <Card
          onClick={() => openDocModal(1)}
          className={cn(
            'border shadow-2xs cursor-pointer transition-all hover:shadow-xs',
            yearlyDoc
              ? 'border-rose-200/80 bg-gradient-to-br from-rose-50/70 via-white to-white'
              : 'border-slate-200 bg-slate-50/60 hover:bg-slate-100/60'
          )}
        >
          <CardContent className="p-4 flex items-center justify-between">
            <div className="space-y-1">
              <div className="flex items-center gap-1.5">
                <span className={cn('text-[11px] font-bold uppercase tracking-wider', yearlyDoc ? 'text-rose-700' : 'text-slate-500')}>
                  2026학년도 연간 이수 시수
                </span>
                <Badge
                  variant="outline"
                  className={cn(
                    'text-[10px] px-1.5 py-0 font-bold',
                    yearlyDoc
                      ? yearlyDoc.status === 'approved'
                        ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                        : yearlyDoc.status === 'rejected'
                        ? 'bg-rose-100 text-rose-800 border-rose-300'
                        : 'bg-amber-100 text-amber-800 border-amber-300'
                      : 'bg-slate-100 text-slate-500 border-slate-300'
                  )}
                >
                  {yearlyDoc
                    ? yearlyDoc.status === 'approved'
                      ? '결재 완료'
                      : yearlyDoc.status === 'rejected'
                      ? '반려'
                      : '결재 진행 중'
                    : '계획 수립 전'}
                </Badge>
              </div>

              {yearlyDoc ? (
                <div className="text-xl sm:text-2xl font-black text-slate-900 flex items-baseline gap-1">
                  51~52<span className="text-xs font-semibold text-slate-500">차시 / 학년별</span>
                </div>
              ) : (
                <div className="text-lg sm:text-xl font-bold text-slate-400">
                  미수립 <span className="text-xs font-normal text-slate-400">(계획 수립 대기)</span>
                </div>
              )}

              <p className="text-[11px] text-slate-500">
                {yearlyDoc
                  ? `7대 안전교육 표준 영역 100% 반영 (${yearlyDoc.docNo || '문서 상신됨'})`
                  : '클릭하여 연간 안전교육 기본 계획을 수립하세요.'}
              </p>
            </div>
            <div
              className={cn(
                'w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 shadow-2xs',
                yearlyDoc ? 'bg-rose-100 text-rose-700' : 'bg-slate-200/70 text-slate-400'
              )}
            >
              <GraduationCap className="w-6 h-6" />
            </div>
          </CardContent>
        </Card>

        {/* 카드 2: 1학기 지진 대피 훈련 (기안 문서 실시간 연동) */}
        <Card
          onClick={() => openDocModal(2)}
          className={cn(
            'border shadow-2xs cursor-pointer transition-all hover:shadow-xs',
            earthquakeDoc
              ? 'border-blue-200/80 bg-gradient-to-br from-blue-50/70 via-white to-white'
              : 'border-slate-200 bg-slate-50/60 hover:bg-slate-100/60'
          )}
        >
          <CardContent className="p-4 flex items-center justify-between">
            <div className="space-y-1">
              <div className="flex items-center gap-1.5">
                <span className={cn('text-[11px] font-bold uppercase tracking-wider', earthquakeDoc ? 'text-blue-700' : 'text-slate-500')}>
                  1학기 재난대피 훈련 (지진)
                </span>
                <Badge
                  variant="outline"
                  className={cn(
                    'text-[10px] px-1.5 py-0 font-bold',
                    earthquakeDoc
                      ? earthquakeDoc.status === 'approved'
                        ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                        : 'bg-blue-100 text-blue-800 border-blue-300'
                      : 'bg-slate-100 text-slate-500 border-slate-300'
                  )}
                >
                  {earthquakeDoc
                    ? earthquakeDoc.status === 'approved'
                      ? '결재 완료'
                      : '결재 진행 중'
                    : '계획 수립 전'}
                </Badge>
              </div>

              {earthquakeDoc ? (
                <div className="text-xl sm:text-2xl font-black text-slate-900 flex items-baseline gap-1">
                  {extractDateTime(earthquakeDoc, '5월 23일(금) 7교시')}
                </div>
              ) : (
                <div className="text-lg sm:text-xl font-bold text-slate-400">
                  일정 미정 <span className="text-xs font-normal text-slate-400">(1학기 지진)</span>
                </div>
              )}

              <p className="text-[11px] text-slate-500">
                {earthquakeDoc
                  ? '전교생 실제 대피로 이동 및 행동요령 숙달'
                  : '클릭하여 1학기 지진 대피 훈련 계획을 수립하세요.'}
              </p>
            </div>
            <div
              className={cn(
                'w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 shadow-2xs',
                earthquakeDoc ? 'bg-blue-100 text-blue-700' : 'bg-slate-200/70 text-slate-400'
              )}
            >
              <Activity className="w-6 h-6" />
            </div>
          </CardContent>
        </Card>

        {/* 카드 3: 2학기 화재 대피 훈련 (기안 문서 실시간 연동) */}
        <Card
          onClick={() => openDocModal(2)}
          className={cn(
            'border shadow-2xs cursor-pointer transition-all hover:shadow-xs',
            fireDoc
              ? 'border-amber-200/80 bg-gradient-to-br from-amber-50/70 via-white to-white'
              : 'border-slate-200 bg-slate-50/60 hover:bg-slate-100/60'
          )}
        >
          <CardContent className="p-4 flex items-center justify-between">
            <div className="space-y-1">
              <div className="flex items-center gap-1.5">
                <span className={cn('text-[11px] font-bold uppercase tracking-wider', fireDoc ? 'text-amber-700' : 'text-slate-500')}>
                  2학기 재난대피 훈련 (화재)
                </span>
                <Badge
                  variant="outline"
                  className={cn(
                    'text-[10px] px-1.5 py-0 font-bold',
                    fireDoc
                      ? fireDoc.status === 'approved'
                        ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                        : 'bg-amber-100 text-amber-800 border-amber-300'
                      : 'bg-slate-100 text-slate-500 border-slate-300'
                  )}
                >
                  {fireDoc
                    ? fireDoc.status === 'approved'
                      ? '결재 완료'
                      : '결재 진행 중'
                    : '계획 수립 전'}
                </Badge>
              </div>

              {fireDoc ? (
                <div className="text-xl sm:text-2xl font-black text-slate-900 flex items-baseline gap-1">
                  {extractDateTime(fireDoc, '10월 예정')}
                </div>
              ) : (
                <div className="text-lg sm:text-xl font-bold text-slate-400">
                  일정 미정 <span className="text-xs font-normal text-slate-400">(2학기 화재)</span>
                </div>
              )}

              <p className="text-[11px] text-slate-500">
                {fireDoc
                  ? '화재 시 대피 절차 및 소화기 사용법 실습'
                  : '클릭하여 2학기 화재 대피 훈련 계획을 수립하세요.'}
              </p>
            </div>
            <div
              className={cn(
                'w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 shadow-2xs',
                fireDoc ? 'bg-amber-100 text-amber-700' : 'bg-slate-200/70 text-slate-400'
              )}
            >
              <Flame className="w-6 h-6" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 2. 학생 안전교육 기본 서식(템플릿) 커스텀 관리 카드 2종 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* 템플릿 카드 1: 학년도 안전교육 운영 계획 기본 서식 관리 */}
        <div className="bg-white border-2 border-rose-200 rounded-2xl p-5 shadow-xs hover:shadow-md transition-shadow flex flex-col justify-between">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Badge className="bg-rose-100 text-rose-800 hover:bg-rose-100 border-rose-300 font-bold px-2.5 py-0.5 text-[11px]">
                기본 서식(틀) 관리
              </Badge>
              <span className="text-[11px] text-slate-400 font-medium">컴팩트 서식 편집기</span>
            </div>

            <div className="space-y-1">
              <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
                <FileText className="w-4 h-4 text-rose-600" />
                학생 안전교육 연간 운영 계획 기본 서식
              </h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                기안문 본문 틀 및 붙임 1(HTML)의 교육 목적, 기본 방침, 주요 추진 과제, 기대효과 등 기본 내용을 학교 실정에 맞게 수정·보존합니다.
              </p>
            </div>

            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/70 text-[11px] text-slate-600 space-y-1">
              <div className="font-bold text-slate-800">커스텀 편집 가능 항목:</div>
              <div>• 기안문 본문 틀 (관련 법령 및 근거, 대상 학년군)</div>
              <div>• 3대 교육 기본 목표 및 주요 추진 과제(항목명, 세부 지침)</div>
              <div>• 재난대피 훈련 요약 문구 및 방학 전 가정연계 지도 내용</div>
            </div>
          </div>

          <div className="pt-4 mt-4 border-t border-slate-100 flex items-center gap-2">
            <Button
              onClick={() => setIsYearlyTemplateModalOpen(true)}
              className="flex-1 h-9 text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white shadow-xs rounded-xl"
            >
              <Settings2 className="w-4 h-4 mr-1.5" />
              기본 템플릿(틀) 수정
            </Button>
            <Button
              variant="outline"
              onClick={() => handlePreviewAttachment(1)}
              className="h-9 px-3 text-xs font-bold border-slate-200 text-slate-700 hover:bg-slate-50 rounded-xl"
            >
              <Printer className="w-3.5 h-3.5 mr-1 text-slate-500" />
              서식 미리보기 / PDF
            </Button>
          </div>
        </div>

        {/* 템플릿 카드 2: 재난(지진/화재) 대피 훈련 실시 계획 기본 서식 관리 */}
        <div className="bg-white border-2 border-blue-200 rounded-2xl p-5 shadow-xs hover:shadow-md transition-shadow flex flex-col justify-between">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Badge className="bg-blue-100 text-blue-800 hover:bg-blue-100 border-blue-300 font-bold px-2.5 py-0.5 text-[11px]">
                기본 서식(틀) 관리
              </Badge>
              <span className="text-[11px] text-slate-400 font-medium">컴팩트 서식 편집기</span>
            </div>

            <div className="space-y-1">
              <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-blue-600" />
                재난(지진/화재) 대피 훈련 실시 계획 기본 서식
              </h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                기안문 본문 틀 및 붙임 1(2페이지)의 점검표 항목, 당일 타임테이블 단계, 행동요령 8대 수칙, 층별 대피 경로를 학교 실정에 맞게 수정·보존합니다.
              </p>
            </div>

            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/70 text-[11px] text-slate-600 space-y-1">
              <div className="font-bold text-slate-800">커스텀 편집 가능 항목:</div>
              <div>• 훈련 목적/근거 및 사전 준비 점검표 목록 (추진일정, 담당부서)</div>
              <div>• 훈련 당일 타임테이블 (단계별 시간, 훈련 내용, 담당 교사)</div>
              <div>• 대피 8대 수칙 및 본관 1~3층 전용 대피 동선 및 집결지</div>
            </div>
          </div>

          <div className="pt-4 mt-4 border-t border-slate-100 flex items-center gap-2">
            <Button
              onClick={() => setIsEvacTemplateModalOpen(true)}
              className="flex-1 h-9 text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white shadow-xs rounded-xl"
            >
              <Settings2 className="w-4 h-4 mr-1.5" />
              기본 템플릿(틀) 수정
            </Button>
            <Button
              variant="outline"
              onClick={() => handlePreviewAttachment(2)}
              className="h-9 px-3 text-xs font-bold border-slate-200 text-slate-700 hover:bg-slate-50 rounded-xl"
            >
              <Printer className="w-3.5 h-3.5 mr-1 text-slate-500" />
              서식 미리보기 / PDF
            </Button>
          </div>
        </div>
      </div>


      {/* 4. 최근 안전교육 전자결재 기안 내역 */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-2xs space-y-3">
        <div className="flex items-center justify-between pb-2 border-b border-slate-100">
          <h3 className="text-sm font-black text-slate-900 flex items-center gap-1.5">
            <Clock className="w-4 h-4 text-slate-600" />
            최근 안전교육 전자결재 기안 내역
          </h3>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push('/inbox')}
            className="text-xs text-slate-500 hover:text-slate-900 h-7"
          >
            전자결재 문서함 가기 <ChevronRight className="w-3.5 h-3.5 ml-0.5" />
          </Button>
        </div>

        {safetyDocs.length === 0 ? (
          <div className="py-8 text-center text-xs text-slate-400 space-y-1">
            <FileText className="w-8 h-8 text-slate-300 mx-auto mb-1" />
            <p>아직 기안된 안전교육 전자결재 문서가 없습니다.</p>
            <p className="text-[11px] text-slate-400">
              상단의 [계획 수립 및 기안문 작성] 버튼을 눌러 첫 기안문을 작성해보세요.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {safetyDocs.map((doc) => (
              <div
                key={doc.id}
                onClick={() => router.push(`/documents/${doc.id}`)}
                className="py-2.5 px-2 flex items-center justify-between hover:bg-slate-50 rounded-lg cursor-pointer transition-colors"
              >
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <Badge
                      variant="outline"
                      className={`text-[10px] font-bold ${
                        doc.status === 'approved'
                          ? 'border-emerald-300 bg-emerald-50 text-emerald-700'
                          : doc.status === 'rejected'
                          ? 'border-rose-300 bg-rose-50 text-rose-700'
                          : 'border-blue-300 bg-blue-50 text-blue-700'
                      }`}
                    >
                      {doc.status === 'approved'
                        ? '결재완료'
                        : doc.status === 'rejected'
                        ? '반려'
                        : '결재진행중'}
                    </Badge>
                    <span className="text-xs font-bold text-slate-900 hover:underline">
                      {doc.title}
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-400">
                    기안자: {doc.requesterName} &nbsp;|&nbsp; 문서번호: {doc.docNo || '발번대기'}
                  </div>
                </div>

                <div className="flex items-center text-xs text-slate-400">
                  <ArrowRight className="w-3.5 h-3.5" />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 5. 📝 학생 안전교육 공문서 기안 모달 (스쿨버스 스타일) */}
      <SafetyDocModal
        isOpen={isDocModalOpen}
        onClose={() => setIsDocModalOpen(false)}
        defaultDocType={selectedDocType}
      />

      {/* 6. ⚙️ 학생 안전교육 연간 운영 계획 기본 서식(틀) 편집 모달 */}
      <YearlyTemplateModal
        isOpen={isYearlyTemplateModalOpen}
        onClose={() => setIsYearlyTemplateModalOpen(false)}
      />

      {/* 7. ⚙️ 재난대피 훈련 실시 계획 기본 서식(틀) 편집 모달 */}
      <EvacuationTemplateModal
        isOpen={isEvacTemplateModalOpen}
        onClose={() => setIsEvacTemplateModalOpen(false)}
      />
    </div>
  );
}
