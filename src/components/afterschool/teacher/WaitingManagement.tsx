import React, { useState } from 'react';
import type { Course, Enrollment, Student } from '@/lib/afterschool/types';
import { UserPlus, ArrowRightLeft } from 'lucide-react';

interface WaitingManagementProps {
  courses: Course[];
  enrollments: Enrollment[];
  setEnrollments: React.Dispatch<React.SetStateAction<Enrollment[]>>;
  studentsList: Student[];
}

export const WaitingManagement: React.FC<WaitingManagementProps> = ({
  courses,
  enrollments,
  setEnrollments,
  studentsList,
}) => {
  const [selectedCourseId, setSelectedCourseId] = useState<string>(courses[1]?.id || courses[0]?.id);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Manual waiting registration state
  const [searchName, setSearchName] = useState('');
  const [foundStudents, setFoundStudents] = useState<Student[]>([]);
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);

  const currentCourse = courses.find((c) => c.id === selectedCourseId) || courses[0];

  // Waiting list for selected course - 선착순 정렬 (등록 일시 또는 timestampMs 기준 오름차순)
  const waitingList = enrollments
    .filter((e) => e.courseId === currentCourse.id && e.status === 'WAITING')
    .sort((a, b) => {
      const aTime = a.timestampMs || new Date(a.registrationDate).getTime() || 0;
      const bTime = b.timestampMs || new Date(b.registrationDate).getTime() || 0;
      return aTime - bTime;
    });

  // Convert waiting student to enrolled (매뉴얼 3.2 대기자 신청자 전환)
  const handleConvertToEnrolled = (enrollmentId: string) => {
    if (confirm('해당 대기자를 정식 수강 신청자로 전환(등록)하시겠습니까?')) {
      setEnrollments((prev) =>
        prev.map((e) => (e.id === enrollmentId ? { ...e, status: 'ENROLLED' } : e))
      );
    }
  };

  // Search student for manual waiting registration
  const handleSearchStudent = () => {
    const res = studentsList.filter((s) => s.name.includes(searchName));
    setFoundStudents(res);
  };

  // Complete manual waiting register (매뉴얼 3.3 대기자 등록)
  const handleCompleteRegisterWaiting = () => {
    if (!selectedStudent) return;
    const newWaiting: Enrollment = {
      id: `e_wait_${Date.now()}`,
      courseId: currentCourse.id,
      studentId: selectedStudent.id,
      yearNo: waitingList.length + 1,
      grade: selectedStudent.grade,
      classNum: selectedStudent.classNum,
      studentNum: selectedStudent.studentNum,
      name: selectedStudent.name,
      phone: selectedStudent.phone,
      parentPhone: selectedStudent.parentPhone,
      tuition: currentCourse.tuition,
      textbookFee: currentCourse.textbookFee,
      materialFee: currentCourse.materialFee,
      registrationDate: new Date().toISOString().replace('T', ' ').slice(0, 19),
      timestampMs: Date.now(),
      status: 'WAITING',
    };
    setEnrollments((prev) => [...prev, newWaiting]);
    setIsModalOpen(false);
    setSelectedStudent(null);
  };

  return (
    <div className="space-y-6">
      {/* Title & Course Selector */}
      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="bg-amber-100 text-amber-800 text-xs px-2.5 py-1 rounded-md font-bold">
              대기자 관리
            </span>
            <h2 className="text-xl font-bold text-slate-800">강좌별 수강 대기자 현황</h2>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            매뉴얼 3.1~3.3: 정원 초과 시 대기자 신청 등록 및 정식 수강 신청자로 전환 기능
          </p>
        </div>

        <div className="flex items-center gap-3">
          <select
            value={selectedCourseId}
            onChange={(e) => setSelectedCourseId(e.target.value)}
            className="text-sm font-bold text-slate-800 border-2 border-amber-500 rounded-lg px-3 py-2 bg-amber-50/50 focus:outline-none"
          >
            {courses.map((c) => (
              <option key={c.id} value={c.id}>
                {c.title} (대기 {c.waitingStudents}/{c.maxWaiting})
              </option>
            ))}
          </select>

          <button
            onClick={() => setIsModalOpen(true)}
            className="bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs px-3.5 py-2 rounded-lg transition flex items-center gap-1.5 shadow-sm whitespace-nowrap"
          >
            <UserPlus className="w-4 h-4" />
            대기자 직접 등록
          </button>
        </div>
      </div>

      {/* Waiting List Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-4 bg-slate-50 border-b flex justify-between items-center text-xs">
          <span className="font-bold text-slate-700">
            강좌명: <b className="text-amber-700">{currentCourse.title}</b> | 총 대기자 인원:{' '}
            <b className="text-amber-700">{waitingList.length}</b>명
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left text-slate-600">
            <thead className="text-slate-700 uppercase bg-slate-100 font-bold border-b">
              <tr>
                <th className="py-3 px-4 text-center">대기 순번</th>
                <th className="py-3 px-4 text-center">전환 신청</th>
                <th className="py-3 px-4 text-center">학년</th>
                <th className="py-3 px-4 text-center">반</th>
                <th className="py-3 px-4 text-center">번호</th>
                <th className="py-3 px-4">이름</th>
                <th className="py-3 px-4">연락처</th>
                <th className="py-3 px-4">대기 등록일자</th>
                <th className="py-3 px-4 text-center">상태</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {waitingList.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-8 text-center text-slate-400">
                    현재 강좌에 대기 등록된 학생이 없습니다.
                  </td>
                </tr>
              ) : (
                waitingList.map((item, idx) => (
                  <tr key={item.id} className="hover:bg-amber-50/50 transition">
                    <td className="py-3 px-4 text-center font-bold text-amber-700 font-mono text-sm">
                      {idx + 1}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <button
                        onClick={() => handleConvertToEnrolled(item.id)}
                        className="bg-blue-600 hover:bg-blue-700 text-white font-bold px-3 py-1 rounded text-xs transition flex items-center gap-1 mx-auto shadow-sm"
                        title="대기자에서 정식 수강 신청자로 전환"
                      >
                        <ArrowRightLeft className="w-3.5 h-3.5" />
                        [신청] 전환
                      </button>
                    </td>
                    <td className="py-3 px-4 text-center font-bold">{item.grade}</td>
                    <td className="py-3 px-4 text-center">{item.classNum}</td>
                    <td className="py-3 px-4 text-center">{item.studentNum}</td>
                    <td className="py-3 px-4 font-bold text-slate-900">{item.name}</td>
                    <td className="py-3 px-4 font-mono text-slate-500">{item.parentPhone}</td>
                    <td className="py-3 px-4 font-mono text-[11px] text-slate-400">
                      {item.registrationDate}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <span className="bg-amber-100 text-amber-800 text-xs px-2 py-0.5 rounded-full font-bold">
                        대기중
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal: Manual Waiting Register */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full border border-slate-200 overflow-hidden">
            <div className="bg-amber-600 text-white px-6 py-4 flex justify-between items-center">
              <h3 className="font-bold text-base flex items-center gap-2">
                <UserPlus className="w-4 h-4" />
                대기자 직접 등록 (매뉴얼 3.3)
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="text-white font-bold">
                &times;
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div className="bg-amber-50 p-3 rounded-lg text-xs text-amber-800 border border-amber-200">
                대상 강좌: <b>{currentCourse.title}</b>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  대기 등록할 학생 이름 검색
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="학생 이름..."
                    value={searchName}
                    onChange={(e) => setSearchName(e.target.value)}
                    className="flex-1 border p-2 rounded-lg text-sm"
                  />
                  <button
                    onClick={handleSearchStudent}
                    className="bg-amber-600 text-white px-4 py-2 rounded-lg text-xs font-bold"
                  >
                    검색
                  </button>
                </div>
              </div>

              {foundStudents.length > 0 && (
                <div className="border rounded-lg max-h-40 overflow-y-auto">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-slate-100">
                      <tr>
                        <th className="p-2">학년/반/번호</th>
                        <th className="p-2">이름</th>
                        <th className="p-2 text-center">선택</th>
                      </tr>
                    </thead>
                    <tbody>
                      {foundStudents.map((st) => (
                        <tr key={st.id} className="border-t">
                          <td className="p-2">
                            {st.grade}학년 {st.classNum}반 {st.studentNum}번
                          </td>
                          <td className="p-2 font-bold">{st.name}</td>
                          <td className="p-2 text-center">
                            <button
                              onClick={() => setSelectedStudent(st)}
                              className={`px-2 py-1 rounded text-xs ${
                                selectedStudent?.id === st.id
                                  ? 'bg-amber-600 text-white font-bold'
                                  : 'bg-slate-200 text-slate-700'
                              }`}
                            >
                              {selectedStudent?.id === st.id ? '선택됨 ✓' : '선택'}
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              <div className="flex justify-end gap-2 pt-4 border-t">
                <button
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 border rounded-lg text-xs font-medium text-slate-700"
                >
                  취소
                </button>
                <button
                  disabled={!selectedStudent}
                  onClick={handleCompleteRegisterWaiting}
                  className="px-4 py-2 bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white rounded-lg text-xs font-bold shadow"
                >
                  대기자로 등록
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
