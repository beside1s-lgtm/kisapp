import React, { useState } from 'react';
import type { Course, RefundRecord, Student } from '@/lib/afterschool/types';
import { ShieldCheck, Plus, Calculator, FileSpreadsheet } from 'lucide-react';
import { downloadRefundExcel } from '@/lib/afterschool/excel';

interface RefundManagementProps {
  courses: Course[];
  refunds: RefundRecord[];
  setRefunds: React.Dispatch<React.SetStateAction<RefundRecord[]>>;
  studentsList: Student[];
}

export const RefundManagement: React.FC<RefundManagementProps> = ({
  courses,
  refunds,
  setRefunds,
  studentsList,
}) => {
  const [selectedCourseId] = useState<string>(courses[2]?.id || courses[0]?.id);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const currentCourse = courses.find((c) => c.id === selectedCourseId) || courses[0];

  // Register Refund Modal Form States
  const [searchStudentName, setSearchStudentName] = useState('');
  const [foundStudents, setFoundStudents] = useState<Student[]>([]);
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);

  const [lastClassDate, setLastClassDate] = useState('2026-08-09');
  const [refundReason, setRefundReason] = useState('코로나 전조증상을 보여서 환불신청합니다.');
  const [totalHours, setTotalHours] = useState(12);
  const [attendedHours, setAttendedHours] = useState(4);
  const [calcMethod, setCalcMethod] = useState<'SPLIT' | 'DAILY' | 'DIRECT'>('SPLIT');

  const [tuitionRefund, setTuitionRefund] = useState(10000);
  const [textbookRefund, setTextbookRefund] = useState(0);
  const [materialRefund, setMaterialRefund] = useState(0);
  const [memo, setMemo] = useState('보호자 확인 완료');
  const [status, setStatus] = useState<'REQUESTED' | 'APPROVED' | 'CONFIRMED'>('APPROVED');

  // Auto calculation algorithm (매뉴얼 17페이지 분할/일할 공식)
  const handleCalculateTuitionRefund = () => {
    const tuition = currentCourse.tuition;
    if (totalHours <= 0) return;

    if (calcMethod === 'SPLIT') {
      const ratio = attendedHours / totalHours;
      if (ratio <= 1 / 3) {
        setTuitionRefund(Math.floor((tuition * (2 / 3)) / 10) * 10);
      } else if (ratio <= 1 / 2) {
        setTuitionRefund(Math.floor((tuition * (1 / 2)) / 10) * 10);
      } else {
        setTuitionRefund(0);
      }
    } else if (calcMethod === 'DAILY') {
      const remainingHours = Math.max(0, totalHours - attendedHours);
      const perHour = tuition / totalHours;
      setTuitionRefund(Math.floor((perHour * remainingHours) / 10) * 10);
    }
  };

  const handleSearchStudent = () => {
    const res = studentsList.filter((s) => s.name.includes(searchStudentName));
    setFoundStudents(res);
  };

  const handleRegisterRefund = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStudent) {
      alert('환불 등록할 학생을 검색하여 선택해주세요.');
      return;
    }

    const newRefund: RefundRecord = {
      id: `r_${Date.now()}`,
      courseId: currentCourse.id,
      studentId: selectedStudent.id,
      studentName: selectedStudent.name,
      grade: selectedStudent.grade,
      classNum: selectedStudent.classNum,
      studentNum: selectedStudent.studentNum,
      phone: selectedStudent.phone,
      parentPhone: selectedStudent.parentPhone,
      requestDate: new Date().toISOString().replace('T', ' ').slice(0, 19),
      lastClassDate,
      refundReason,
      totalHours,
      attendedHours,
      calcMethod,
      tuitionRefund,
      textbookRefund,
      materialRefund,
      memo,
      status,
    };

    setRefunds((prev) => [newRefund, ...prev]);
    setIsModalOpen(false);
    setSelectedStudent(null);
  };

  const handleStatusChangeInList = (id: string, newStatus: 'REQUESTED' | 'APPROVED' | 'CONFIRMED') => {
    setRefunds((prev) => prev.map((r) => (r.id === id ? { ...r, status: newStatus } : r)));
  };

  return (
    <div className="space-y-6">
      {/* Title & Actions */}
      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="bg-rose-100 text-rose-800 text-xs px-2.5 py-1 rounded-md font-bold">
              환불 관리
            </span>
            <h2 className="text-xl font-bold text-slate-800">강사 환불 신청 및 계산 승인</h2>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            매뉴얼 7.1~7.2: 학생 환불 신청 등록, 분할/일할 자동 계산 및 강사확인 승인, 엑셀 출력
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => downloadRefundExcel(refunds)}
            className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs px-3.5 py-2 rounded-lg transition flex items-center gap-1.5 shadow-sm"
          >
            <FileSpreadsheet className="w-4 h-4" />
            검색결과출력 (엑셀)
          </button>
          <button
            onClick={() => setIsModalOpen(true)}
            className="bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs px-3.5 py-2 rounded-lg transition flex items-center gap-1.5 shadow-sm"
          >
            <Plus className="w-4 h-4" />
            환불신청자 등록
          </button>
        </div>
      </div>

      {/* Refund Record List Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left text-slate-600">
            <thead className="text-slate-700 uppercase bg-slate-100 font-bold border-b">
              <tr>
                <th className="py-3 px-4 text-center">연번</th>
                <th className="py-3 px-4 text-center">신청상태</th>
                <th className="py-3 px-4">강좌명</th>
                <th className="py-3 px-4 text-center">학년</th>
                <th className="py-3 px-4 text-center">반</th>
                <th className="py-3 px-4 text-center">번호</th>
                <th className="py-3 px-4">이름</th>
                <th className="py-3 px-4">연락처</th>
                <th className="py-3 px-4 text-right">수강료 (환불금액)</th>
                <th className="py-3 px-4 text-right">교재비 (환불금액)</th>
                <th className="py-3 px-4 text-right">재료비 (환불금액)</th>
                <th className="py-3 px-4">환불 적용일자</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {refunds.length === 0 ? (
                <tr>
                  <td colSpan={12} className="py-8 text-center text-slate-400">
                    등록된 환불 신청 내역이 없습니다.
                  </td>
                </tr>
              ) : (
                refunds.map((item, idx) => (
                  <tr key={item.id} className="hover:bg-slate-50 transition">
                    <td className="py-3 px-4 text-center font-mono text-slate-400">{idx + 1}</td>
                    <td className="py-3 px-4 text-center">
                      <select
                        value={item.status}
                        onChange={(e) => handleStatusChangeInList(item.id, e.target.value as any)}
                        className={`font-bold px-2 py-0.5 rounded text-xs border ${
                          item.status === 'APPROVED'
                            ? 'bg-blue-100 text-blue-800 border-blue-300'
                            : item.status === 'CONFIRMED'
                            ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                            : 'bg-amber-100 text-amber-800 border-amber-300'
                        }`}
                      >
                        <option value="REQUESTED">접수</option>
                        <option value="APPROVED">강사확인</option>
                        <option value="CONFIRMED">최종확인</option>
                      </select>
                    </td>
                    <td className="py-3 px-4 font-bold text-slate-800">과학실험A_목</td>
                    <td className="py-3 px-4 text-center font-bold">{item.grade}</td>
                    <td className="py-3 px-4 text-center">{item.classNum}</td>
                    <td className="py-3 px-4 text-center">{item.studentNum}</td>
                    <td className="py-3 px-4 font-bold text-slate-900">{item.studentName}</td>
                    <td className="py-3 px-4 font-mono text-slate-500">{item.phone}</td>
                    <td className="py-3 px-4 text-right font-mono font-bold text-rose-600">
                      {item.tuitionRefund.toLocaleString()}원
                    </td>
                    <td className="py-3 px-4 text-right font-mono text-slate-600">
                      {item.textbookRefund.toLocaleString()}원
                    </td>
                    <td className="py-3 px-4 text-right font-mono text-slate-600">
                      {item.materialRefund.toLocaleString()}원
                    </td>
                    <td className="py-3 px-4 font-mono text-[11px] text-slate-400">
                      {item.requestDate}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal: Register Refund Form */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-xl shadow-2xl max-w-xl w-full border border-slate-200 overflow-hidden my-6">
            <div className="bg-rose-700 text-white px-6 py-4 flex justify-between items-center">
              <h3 className="font-bold text-base flex items-center gap-2">
                <ShieldCheck className="w-4 h-4" />
                강사 환불신청자 등록 및 계산 (매뉴얼 7.1)
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="text-white font-bold">
                &times;
              </button>
            </div>

            <form onSubmit={handleRegisterRefund} className="p-6 space-y-4 text-xs">
              <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 space-y-2">
                <label className="block font-bold text-slate-700">1. 대상 수강생 검색</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="학생 이름..."
                    value={searchStudentName}
                    onChange={(e) => setSearchStudentName(e.target.value)}
                    className="flex-1 border p-1.5 rounded"
                  />
                  <button
                    type="button"
                    onClick={handleSearchStudent}
                    className="bg-slate-700 text-white px-3 py-1.5 rounded font-bold"
                  >
                    검색하기
                  </button>
                </div>
                {foundStudents.length > 0 && (
                  <div className="border rounded bg-white max-h-32 overflow-y-auto">
                    {foundStudents.map((st) => (
                      <div
                        key={st.id}
                        onClick={() => setSelectedStudent(st)}
                        className={`p-2 cursor-pointer flex justify-between hover:bg-rose-50 ${
                          selectedStudent?.id === st.id ? 'bg-rose-100 font-bold' : ''
                        }`}
                      >
                        <span>
                          {st.grade}학년 {st.classNum}반 {st.studentNum}번 {st.name}
                        </span>
                        {selectedStudent?.id === st.id && (
                          <span className="text-rose-700">선택됨 ✓</span>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">최종수강일</label>
                  <input
                    type="date"
                    value={lastClassDate}
                    onChange={(e) => setLastClassDate(e.target.value)}
                    className="w-full border p-1.5 rounded font-mono"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">환불사유</label>
                  <input
                    type="text"
                    value={refundReason}
                    onChange={(e) => setRefundReason(e.target.value)}
                    className="w-full border p-1.5 rounded"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">강좌 총 시수 *</label>
                  <input
                    type="number"
                    value={totalHours}
                    onChange={(e) => setTotalHours(Number(e.target.value))}
                    className="w-full border p-1.5 rounded font-mono"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">강좌 수강 시수 *</label>
                  <input
                    type="number"
                    value={attendedHours}
                    onChange={(e) => setAttendedHours(Number(e.target.value))}
                    className="w-full border p-1.5 rounded font-mono"
                  />
                </div>
              </div>

              <div className="bg-rose-50 p-3 rounded-lg border border-rose-200 space-y-2">
                <label className="block font-bold text-rose-900">환불계산 방식 선택</label>
                <div className="flex gap-4">
                  <label className="flex items-center gap-1 cursor-pointer">
                    <input
                      type="radio"
                      name="calc"
                      checked={calcMethod === 'SPLIT'}
                      onChange={() => setCalcMethod('SPLIT')}
                    />
                    분할 (1/3경과, 1/2경과 규정)
                  </label>
                  <label className="flex items-center gap-1 cursor-pointer">
                    <input
                      type="radio"
                      name="calc"
                      checked={calcMethod === 'DAILY'}
                      onChange={() => setCalcMethod('DAILY')}
                    />
                    일할 계산
                  </label>
                  <label className="flex items-center gap-1 cursor-pointer">
                    <input
                      type="radio"
                      name="calc"
                      checked={calcMethod === 'DIRECT'}
                      onChange={() => setCalcMethod('DIRECT')}
                    />
                    기타 (직접입력)
                  </label>
                </div>

                <div className="flex justify-between items-center pt-2">
                  <span className="text-[11px] text-rose-700 font-mono">
                    징수금액: {currentCourse.tuition.toLocaleString()}원
                  </span>
                  <button
                    type="button"
                    onClick={handleCalculateTuitionRefund}
                    className="bg-rose-600 text-white font-bold px-3 py-1.5 rounded flex items-center gap-1 shadow"
                  >
                    <Calculator className="w-3.5 h-3.5" />
                    수강료 환불금액 자동 계산
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">수강료 환불금액 (원)</label>
                  <input
                    type="number"
                    value={tuitionRefund}
                    onChange={(e) => setTuitionRefund(Number(e.target.value))}
                    className="w-full border p-1.5 rounded font-mono font-bold text-rose-600"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">교재비 환불금액 (원)</label>
                  <input
                    type="number"
                    value={textbookRefund}
                    onChange={(e) => setTextbookRefund(Number(e.target.value))}
                    className="w-full border p-1.5 rounded font-mono"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">재료비 환불금액 (원)</label>
                  <input
                    type="number"
                    value={materialRefund}
                    onChange={(e) => setMaterialRefund(Number(e.target.value))}
                    className="w-full border p-1.5 rounded font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">비고 (전달사항)</label>
                <input
                  type="text"
                  value={memo}
                  onChange={(e) => setMemo(e.target.value)}
                  placeholder="신청자에게 전달할 메모를 입력합니다."
                  className="w-full border p-1.5 rounded"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">신청상태 변경</label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value as any)}
                  className="w-full border p-1.5 rounded font-bold"
                >
                  <option value="REQUESTED">접수</option>
                  <option value="APPROVED">강사확인 (승인)</option>
                </select>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 border rounded font-medium text-slate-700"
                >
                  취소
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded font-bold shadow"
                >
                  환불신청 등록
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
