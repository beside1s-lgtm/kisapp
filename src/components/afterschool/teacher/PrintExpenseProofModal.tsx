import React from 'react';
import type { ExpenseProof } from '@/lib/afterschool/types';
import { X, Printer } from 'lucide-react';

interface PrintExpenseProofModalProps {
  proof: ExpenseProof;
  onClose: () => void;
  currency?: 'KRW' | 'VND' | 'USD';
}

export const PrintExpenseProofModal: React.FC<PrintExpenseProofModalProps> = ({
  proof,
  onClose,
  currency = 'KRW',
}) => {
  const formatMoney = (amount: number) => {
    const formatted = (amount || 0).toLocaleString();
    if (currency === 'VND') return `${formatted} VND`;
    if (currency === 'USD') return `$${formatted}`;
    return `${formatted}원`;
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-sm z-50 flex flex-col items-center justify-start p-4 overflow-y-auto print:p-0 print:bg-white print:static print:z-auto">
      {/* 화면 조작용 헤더 (인쇄 시 숨김) */}
      <div className="w-full max-w-4xl flex items-center justify-between bg-slate-900 text-white px-6 py-3.5 rounded-t-2xl shrink-0 print:hidden">
        <div className="flex items-center gap-2">
          <Printer className="w-5 h-5 text-emerald-400" />
          <h3 className="font-bold text-sm sm:text-base">지출증빙서류 인쇄 미리보기 (서식 1, 서식 2, 서식 3)</h3>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={handlePrint}
            className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs px-4 py-2 rounded-xl transition flex items-center gap-1.5 shadow-sm cursor-pointer"
          >
            <Printer className="w-4 h-4" />
            인쇄하기 (Print)
          </button>
          <button onClick={onClose} className="text-slate-400 hover:text-white transition">
            <X className="w-6 h-6" />
          </button>
        </div>
      </div>

      {/* A4 양식 본문 영역 */}
      <div className="w-full max-w-4xl bg-white p-8 sm:p-12 shadow-2xl border border-slate-200 rounded-b-2xl space-y-12 print:shadow-none print:border-none print:p-0 print:m-0 print:max-w-none text-slate-900 font-sans print:bg-transparent">

        {/* ─── 서식 1: 영수증 등 지출 증빙서 ──────────────────────────────────── */}
        <div className="page-break-after border border-slate-800 p-6 space-y-6 bg-white">
          <div className="flex items-center justify-between border-b-2 border-slate-900 pb-2">
            <div className="border border-slate-900 font-bold text-xs px-3 py-1 bg-slate-100">
              서식 1
            </div>
            <h2 className="font-bold text-xs tracking-tight">영수증 등 지출 증빙서(서식)</h2>
          </div>

          <h1 className="text-2xl font-black text-center tracking-widest my-4">영 수 증</h1>

          <p className="text-xs text-slate-700 font-semibold">※ 품의서 출력 후 함께 제출</p>

          <table className="w-full border-collapse border border-slate-900 text-xs">
            <thead>
              <tr className="bg-slate-100 border-b border-slate-900">
                <th className="border-r border-slate-900 p-2.5 w-1/4 text-center font-bold">카드종류</th>
                <th className="border-r border-slate-900 p-2.5 text-center font-bold">카드 명의자(입금자)</th>
                <th className="p-2.5 w-1/4 text-center font-bold">사용액</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-slate-900">
                <td className="border-r border-slate-900 p-2.5 text-center font-semibold">
                  개인카드(현금 등)
                </td>
                <td className="border-r border-slate-900 p-2.5 text-slate-800">
                  {proof.cardType === 'PERSONAL' ? (
                    <div>
                      <div className="font-bold">{proof.cardOwnerName}</div>
                      {proof.bankInfo && <div className="text-[11px] text-slate-600">({proof.bankInfo})</div>}
                      {proof.accountHolderEng && <div className="text-[11px] text-slate-600">예금주명: {proof.accountHolderEng}</div>}
                    </div>
                  ) : '-'}
                </td>
                <td className="p-2.5 text-right font-bold">
                  {proof.cardType === 'PERSONAL' ? formatMoney(proof.spentAmount) : '-'}
                </td>
              </tr>
              <tr className="border-b border-slate-900">
                <td className="border-r border-slate-900 p-2.5 text-center font-semibold">
                  학교카드
                </td>
                <td className="border-r border-slate-900 p-2.5 text-slate-800">
                  {proof.cardType === 'SCHOOL' ? (
                    <div>
                      <div className="font-bold">{proof.cardOwnerName}</div>
                      {proof.bankInfo && <div className="text-[11px] text-slate-600">({proof.bankInfo})</div>}
                    </div>
                  ) : '-'}
                </td>
                <td className="p-2.5 text-right font-bold">
                  {proof.cardType === 'SCHOOL' ? formatMoney(proof.spentAmount) : '-'}
                </td>
              </tr>
              <tr className="bg-slate-50 font-bold">
                <td colSpan={2} className="border-r border-slate-900 p-2.5 text-center">계</td>
                <td className="p-2.5 text-right text-sm">{formatMoney(proof.spentAmount)}</td>
              </tr>
            </tbody>
          </table>

          {/* 영수증 붙이는 곳 */}
          <div className="border-2 border-dashed border-slate-400 min-h-[320px] rounded-lg p-4 flex flex-col items-center justify-center bg-slate-50/50">
            {proof.receiptImageUrl ? (
              <img src={proof.receiptImageUrl} alt="영수증" className="max-h-[380px] object-contain rounded shadow-xs" />
            ) : (
              <div className="text-center text-slate-400 space-y-1">
                <div className="font-bold text-sm">영수증 붙이는 곳</div>
                <div className="text-xs">실물 영수증 또는 전자영수증 캡처본</div>
              </div>
            )}
          </div>
        </div>

        {/* ─── 서식 2: 물품 검수 조서 ──────────────────────────────────────────── */}
        <div className="page-break-after border border-slate-800 p-6 space-y-6 bg-white">
          <div className="flex items-center justify-between border-b-2 border-slate-900 pb-2">
            <div className="border border-slate-900 font-bold text-xs px-3 py-1 bg-slate-100">
              서식 2
            </div>
            <h2 className="font-bold text-xs tracking-tight">물품 검수 조서(서식)</h2>
          </div>

          <h1 className="text-2xl font-black text-center tracking-widest my-4">물 품 검 수 조 서</h1>

          <div className="space-y-2 text-xs font-semibold text-slate-800">
            <div>1. 사업명 : <span className="font-bold text-slate-950">{proof.businessName || proof.courseTitle}</span></div>
            <div>2. 납품처 : <span className="font-bold text-slate-950">{proof.supplierName || '(주) 한국과학'}</span></div>
            <div>3. 납품일 : <span className="font-bold text-slate-950">{proof.deliveryDate || '2026년 03월 30일'}</span></div>
            <div>4. 검수일 : <span className="font-bold text-slate-950">{proof.inspectionDate || '2026년 03월 30일'}</span></div>
          </div>

          <h3 className="font-bold text-center text-sm tracking-wider my-2">검 수 내 역</h3>

          <table className="w-full border-collapse border border-slate-900 text-xs">
            <thead>
              <tr className="bg-slate-100 border-b border-slate-900">
                <th className="border-r border-slate-900 p-2 text-center font-bold">품 명</th>
                <th className="border-r border-slate-900 p-2 text-center font-bold">모델명</th>
                <th className="border-r border-slate-900 p-2 text-center font-bold w-16">단위</th>
                <th className="border-r border-slate-900 p-2 text-center font-bold w-20">계약수량</th>
                <th className="border-r border-slate-900 p-2 text-center font-bold w-20">검수수량</th>
                <th className="p-2 text-center font-bold w-32">금 액</th>
              </tr>
            </thead>
            <tbody>
              {(proof.items || []).map((item, idx) => (
                <tr key={idx} className="border-b border-slate-900">
                  <td className="border-r border-slate-900 p-2 font-semibold">{item.name}</td>
                  <td className="border-r border-slate-900 p-2 text-center text-slate-700">{item.modelName || '-'}</td>
                  <td className="border-r border-slate-900 p-2 text-center">{item.unit || 'SET'}</td>
                  <td className="border-r border-slate-900 p-2 text-right">{item.contractQty}</td>
                  <td className="border-r border-slate-900 p-2 text-right">{item.inspectedQty}</td>
                  <td className="p-2 text-right font-bold">{formatMoney(item.amount)}</td>
                </tr>
              ))}
              <tr className="bg-slate-50 font-bold">
                <td colSpan={3} className="border-r border-slate-900 p-2 text-center">계</td>
                <td className="border-r border-slate-900 p-2 text-right">
                  {(proof.items || []).reduce((s, i) => s + (i.contractQty || 0), 0)}
                </td>
                <td className="border-r border-slate-900 p-2 text-right">
                  {(proof.items || []).reduce((s, i) => s + (i.inspectedQty || 0), 0)}
                </td>
                <td className="p-2 text-right text-sm">{formatMoney(proof.spentAmount)}</td>
              </tr>
            </tbody>
          </table>

          <div className="text-center space-y-6 pt-6 text-xs font-semibold">
            <p className="text-sm font-bold">위와 같이 검수 하였습니다.</p>
            <p className="font-bold">{proof.inspectionDate || '2026년 03월 30일'}</p>

            <div className="flex justify-around pt-4 font-bold">
              <div>
                검수자 &nbsp;&nbsp; 직책 - 교사 &nbsp;&nbsp;&nbsp;&nbsp; 성명 : {proof.inspectorName || proof.instructorName} &nbsp;&nbsp;(서명)
              </div>
              <div>
                입회자 &nbsp;&nbsp; 직책 - 교감 &nbsp;&nbsp;&nbsp;&nbsp; 성명 : {proof.witnessName || '배경희'} &nbsp;&nbsp;(서명)
              </div>
            </div>
          </div>
        </div>

        {/* ─── 서식 3: 검수 사진 ───────────────────────────────────────────────── */}
        <div className="border border-slate-800 p-6 space-y-4 bg-white">
          <h2 className="text-center font-bold text-base my-2">#검수사진</h2>

          <div className="grid grid-cols-2 gap-4">
            {[0, 1, 2, 3].map((idx) => {
              const photo = (proof.inspectionPhotos || [])[idx];
              return (
                <div key={idx} className="border border-slate-300 rounded-lg aspect-4/3 flex items-center justify-center bg-slate-50 overflow-hidden relative">
                  {photo ? (
                    <img src={photo} alt={`검수사진 ${idx + 1}`} className="w-full h-full object-cover" />
                  ) : (
                    <div className="text-slate-300 text-xs font-bold text-center">
                      검수 사진 {idx + 1}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

      </div>
    </div>
  );
};
