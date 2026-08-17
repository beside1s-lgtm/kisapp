'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useAuth } from '@/hooks/use-auth';
import { onPrivacyPolicyUpdate, savePrivacyPolicy, type PrivacyPolicyMeta } from '@/lib/services/settingsService';
import { Edit3, Save, X, Plus, Trash2, RefreshCw, Shield, CheckCircle2 } from 'lucide-react';

// ─── 기본값 (Firestore 미설정 시 적용) ──────────────────────────────────────

const DEFAULT_POLICY: PrivacyPolicyMeta = {
  effectiveDate: '2026년 3월 1일',
  lastUpdated: '2026년 8월 14일',
  version: 'v1.0',
  changeLog: [
    { date: '2026.08.14', description: '방과후학교 및 스쿨버스 운영 조항 추가, 최초 제정' },
  ],
};

// ─── 메인 페이지 ─────────────────────────────────────────────────────────────

export default function PrivacyPolicyPage() {
  const { profile, user, loading: authLoading } = useAuth();
  const [policy, setPolicy] = useState<PrivacyPolicyMeta>(DEFAULT_POLICY);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [draft, setDraft] = useState<PrivacyPolicyMeta>(DEFAULT_POLICY);
  const [isSaving, setIsSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<string | null>(null);

  const isAdmin =
    profile?.isAdmin === true ||
    (user?.email || '').toLowerCase() === 'beside1s@kshcm.net';

  // Firestore 실시간 구독
  useEffect(() => {
    const unsub = onPrivacyPolicyUpdate((data) => {
      if (data) {
        setPolicy(data);
        setDraft(data);
      }
    });
    return () => unsub();
  }, []);

  // 편집 열기
  const handleOpenEdit = () => {
    setDraft({ ...policy });
    setIsEditOpen(true);
  };

  // 저장
  const handleSave = async () => {
    setIsSaving(true);
    const res = await savePrivacyPolicy(draft, user?.email || '관리자');
    setIsSaving(false);
    if (res.success) {
      setPolicy(draft);
      setIsEditOpen(false);
      setSavedAt(new Date().toLocaleString('ko-KR'));
    } else {
      alert(`저장 실패: ${res.error}`);
    }
  };

  // 개정 이력 추가
  const handleAddChangeLog = () => {
    setDraft((prev) => ({
      ...prev,
      changeLog: [{ date: new Date().toLocaleDateString('ko-KR').replace(/\. /g, '.').replace('.', '').replace(/\.$/, ''), description: '' }, ...prev.changeLog],
    }));
  };

  // 개정 이력 삭제
  const handleRemoveChangeLog = (idx: number) => {
    setDraft((prev) => ({
      ...prev,
      changeLog: prev.changeLog.filter((_, i) => i !== idx),
    }));
  };

  return (
    <div className="min-h-screen bg-slate-50">
      {/* 상단 헤더 */}
      <header className="bg-slate-900 text-white py-6 px-4 text-center relative">
        <div className="max-w-4xl mx-auto">
          <p className="text-slate-400 text-sm mb-1">호치민시한국국제학교</p>
          <h1 className="text-2xl font-bold">개인정보처리방침</h1>
          <p className="text-slate-300 text-sm mt-2">Privacy Policy — KSHCM 통합 스마트 교원 및 학생 수송 서비스</p>
        </div>

        {/* 관리자 전용: 수정/갱신 버튼 */}
        {!authLoading && isAdmin && (
          <div className="absolute top-4 right-4">
            <button
              onClick={handleOpenEdit}
              className="flex items-center gap-2 bg-amber-500 hover:bg-amber-400 text-amber-950 font-black text-xs px-3 py-2 rounded-xl shadow-lg transition cursor-pointer"
            >
              <Shield className="w-3.5 h-3.5" />
              <Edit3 className="w-3.5 h-3.5" />
              관리자 수정/갱신
            </button>
          </div>
        )}
      </header>

      {/* 저장 완료 알림 */}
      {savedAt && (
        <div className="bg-emerald-600 text-white text-center text-xs py-2 font-bold flex items-center justify-center gap-2">
          <CheckCircle2 className="w-4 h-4" />
          개인정보처리방침이 {savedAt}에 갱신되었습니다.
          <button onClick={() => setSavedAt(null)} className="ml-2 text-emerald-200 hover:text-white">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* 관리자 수정 패널 */}
      {isEditOpen && (
        <div className="max-w-4xl mx-auto px-4 py-4">
          <div className="bg-slate-900 text-white rounded-2xl border border-amber-400/40 shadow-2xl overflow-hidden">
            {/* 패널 헤더 */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-700 bg-amber-900/30">
              <div className="flex items-center gap-2">
                <Shield className="w-5 h-5 text-amber-400" />
                <span className="font-bold text-lg text-white">개인정보처리방침 수정/갱신 (시스템 관리자 전용)</span>
              </div>
              <button
                onClick={() => setIsEditOpen(false)}
                className="text-slate-400 hover:text-white p-1 rounded transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-5">
              {/* 기본 정보 */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="text-xs font-bold text-amber-300 block mb-1">시행일</label>
                  <input
                    type="text"
                    value={draft.effectiveDate}
                    onChange={(e) => setDraft((p) => ({ ...p, effectiveDate: e.target.value }))}
                    className="w-full bg-slate-800 text-white border border-slate-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-amber-400"
                    placeholder="예: 2026년 3월 1일"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-amber-300 block mb-1">최종 개정일</label>
                  <input
                    type="text"
                    value={draft.lastUpdated}
                    onChange={(e) => setDraft((p) => ({ ...p, lastUpdated: e.target.value }))}
                    className="w-full bg-slate-800 text-white border border-slate-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-amber-400"
                    placeholder="예: 2026년 8월 14일"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-amber-300 block mb-1">버전</label>
                  <input
                    type="text"
                    value={draft.version}
                    onChange={(e) => setDraft((p) => ({ ...p, version: e.target.value }))}
                    className="w-full bg-slate-800 text-white border border-slate-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-amber-400"
                    placeholder="예: v2.0"
                  />
                </div>
              </div>

              {/* 개정 이력 */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-bold text-amber-300">개정 이력 (최신 순)</label>
                  <button
                    onClick={handleAddChangeLog}
                    className="flex items-center gap-1 text-xs bg-amber-500 hover:bg-amber-400 text-amber-950 font-bold px-2.5 py-1 rounded-lg transition cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    이력 추가
                  </button>
                </div>
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {draft.changeLog.map((log, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <input
                        type="text"
                        value={log.date}
                        onChange={(e) =>
                          setDraft((p) => ({
                            ...p,
                            changeLog: p.changeLog.map((l, i) =>
                              i === idx ? { ...l, date: e.target.value } : l
                            ),
                          }))
                        }
                        className="w-32 shrink-0 bg-slate-800 text-white border border-slate-600 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:border-amber-400"
                        placeholder="2026.08.14"
                      />
                      <input
                        type="text"
                        value={log.description}
                        onChange={(e) =>
                          setDraft((p) => ({
                            ...p,
                            changeLog: p.changeLog.map((l, i) =>
                              i === idx ? { ...l, description: e.target.value } : l
                            ),
                          }))
                        }
                        className="flex-1 bg-slate-800 text-white border border-slate-600 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:border-amber-400"
                        placeholder="변경 내용을 입력하세요"
                      />
                      <button
                        onClick={() => handleRemoveChangeLog(idx)}
                        className="text-slate-500 hover:text-rose-400 transition cursor-pointer shrink-0"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {/* 안내 */}
              <div className="bg-slate-800 rounded-xl p-3 text-xs text-slate-400 space-y-1">
                <p className="font-bold text-slate-300">💡 수정 안내</p>
                <p>• 시행일·최종 개정일·버전을 업데이트하고 개정 이력에 변경 내용을 기록하세요.</p>
                <p>• 저장 시 Firestore에 즉시 반영되며, 모든 사용자에게 실시간으로 갱신된 방침이 표시됩니다.</p>
                <p>• 방침 본문(조항 내용)의 대폭 개정이 필요한 경우 시스템 관리자(beside1s@kshcm.net)에게 문의하세요.</p>
              </div>

              {/* 저장 버튼 */}
              <div className="flex justify-end gap-2">
                <button
                  onClick={() => setIsEditOpen(false)}
                  className="px-4 py-2 text-sm font-bold text-slate-400 hover:text-white border border-slate-600 rounded-xl transition cursor-pointer"
                >
                  취소
                </button>
                <button
                  onClick={handleSave}
                  disabled={isSaving}
                  className="flex items-center gap-2 bg-amber-500 hover:bg-amber-400 disabled:opacity-60 text-amber-950 font-black text-sm px-5 py-2 rounded-xl transition shadow-md cursor-pointer"
                >
                  {isSaving ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      저장 중...
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4" />
                      방침 갱신 저장
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 본문 */}
      <main className="max-w-4xl mx-auto px-4 py-10 space-y-10">

        {/* 시행일 및 개요 */}
        <section className="bg-indigo-50 border border-indigo-200 rounded-2xl p-6">
          <p className="text-sm text-indigo-700">
            <strong>시행일:</strong> {policy.effectiveDate} &nbsp;|&nbsp;
            <strong>최종 개정일:</strong> {policy.lastUpdated} &nbsp;|&nbsp;
            <strong>버전:</strong> {policy.version}
          </p>
          {policy.updatedBy && policy.updatedAt && (
            <p className="text-xs text-slate-500 mt-1">
              마지막 갱신: {policy.updatedBy} · {new Date(policy.updatedAt).toLocaleString('ko-KR')}
            </p>
          )}
          <p className="mt-3 text-sm text-slate-700 leading-relaxed">
            호치민시한국국제학교(이하 "본교")는 「개인정보 보호법」 제30조 및 제30조의2에 따라 정보주체(학생, 보호자, 교직원)의
            개인정보를 보호하고 이와 관련한 고충을 신속하고 원활하게 처리할 수 있도록 다음과 같이 개인정보처리방침을 수립·공개합니다.
          </p>
        </section>

        <Divider />

        <Section number={1} title="개인정보의 처리 목적">
          <p>본교는 다음의 목적을 위하여 개인정보를 처리합니다. 처리하고 있는 개인정보는 다음의 목적 이외의 용도로는 이용되지 않으며, 이용 목적이 변경되는 경우에는 「개인정보 보호법」 제18조에 따라 별도의 동의를 받는 등 필요한 조치를 이행합니다.</p>
          <ol className="list-decimal list-inside space-y-2 mt-3 text-sm">
            <li><strong>학적 관리</strong>: 학생의 학년·반·출결·생활기록부 작성 및 관리 (「초·중등교육법」 제25조 근거)</li>
            <li><strong>건강·안전 관리</strong>: 건강검진 결과 기록 및 감염병 예방 조치 (「학교보건법」 제5조, 제7조 근거)</li>
            <li><strong>스쿨버스 운영</strong>: 학생 승·하차 노선 배정 및 안전 수송 관리</li>
            <li><strong>방과후학교 운영</strong>: 수강 신청, 수강료 청구·납부 관리, 출석부 관리</li>
            <li><strong>교직원 복무 관리</strong>: 근태·출퇴근 기록, 수당 산정, 전자결재 처리</li>
            <li><strong>학부모 서비스</strong>: 가정통신문 발송, 체험학습 승인 신청, 학교 일정 공유</li>
          </ol>
        </Section>

        <Section number={2} title="처리하는 개인정보의 항목">
          <p>본교는 다음의 개인정보 항목을 처리하고 있습니다.</p>
          <div className="mt-3 space-y-4">
            <InfoTable title="학생" items={['성명, 생년월일, 성별', '학년·반·번호, 학적 번호', '주소, 보호자 연락처, 이메일', '출결 기록, 생활기록부 항목', '건강기록(신체검사, 예방접종), 급식 정보', '스쿨버스 탑승 노선, 승차권 카드 번호', '방과후학교 수강 이력 및 납부 정보']} />
            <InfoTable title="교직원 및 강사" items={['성명, 소속, 직위', '이메일(업무용), 연락처', '근태·출퇴근 기록, 방과후 출근부', '은행 계좌 정보 (수당 지급 목적)']} />
            <InfoTable title="보호자" items={['성명, 연락처', '이메일(학부모 앱 계정)', '학교 공지 수신 설정 정보']} />
          </div>
        </Section>

        <Section number={3} title="개인정보의 처리 및 보유 기간">
          <p>본교는 법령에 따른 개인정보 보유·이용 기간 또는 정보주체로부터 개인정보를 수집 시에 동의 받은 개인정보 보유·이용 기간 내에서 개인정보를 처리·보유합니다.</p>
          <table className="w-full mt-4 text-sm border border-slate-200 rounded-xl overflow-hidden">
            <thead className="bg-slate-100">
              <tr>
                <th className="text-left p-3 font-bold text-slate-700">처리 목적</th>
                <th className="text-left p-3 font-bold text-slate-700">보유 기간</th>
                <th className="text-left p-3 font-bold text-slate-700">법적 근거</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {[
                ['생활기록부', '학교 졸업 후 30년', '초·중등교육법 시행규칙 제24조'],
                ['건강기록', '학교 졸업 후 5년', '학교보건법 시행규칙 제5조'],
                ['출결·근태 기록', '5년', '개인정보 보호법 시행령 제16조'],
                ['방과후 수강·납부 기록', '3년', '회계 및 세무 관련 법령'],
                ['스쿨버스 탑승 기록', '1년', '안전 및 민원 대응 목적'],
                ['학부모 앱 계정 정보', '재학 기간 종료 후 1년', '정보주체 동의'],
              ].map(([purpose, period, basis]) => (
                <tr key={purpose} className="hover:bg-slate-50">
                  <td className="p-3">{purpose}</td>
                  <td className="p-3 font-semibold text-indigo-700">{period}</td>
                  <td className="p-3 text-slate-500 text-xs">{basis}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Section>

        <Section number={4} title="개인정보의 제3자 제공">
          <p>본교는 원칙적으로 정보주체의 개인정보를 제3자에게 제공하지 않습니다. 다만, 다음의 경우에는 예외로 합니다.</p>
          <ul className="list-disc list-inside mt-3 space-y-1 text-sm">
            <li>정보주체가 사전에 동의한 경우</li>
            <li>법률의 특별한 규정이 있거나 법령상 의무를 준수하기 위해 불가피한 경우 (예: 교육부·교육청 통계 보고, 보건당국 감염병 신고)</li>
            <li>학생의 급박한 생명·신체·재산상 이익을 위해 필요하다고 인정되는 경우</li>
          </ul>
        </Section>

        <Section number={5} title="개인정보처리 위탁">
          <p>본교는 원활한 개인정보 업무처리를 위하여 다음과 같이 개인정보 처리 업무를 위탁합니다.</p>
          <table className="w-full mt-3 text-sm border border-slate-200 rounded-xl overflow-hidden">
            <thead className="bg-slate-100">
              <tr>
                <th className="text-left p-3 font-bold text-slate-700">수탁자(업체)</th>
                <th className="text-left p-3 font-bold text-slate-700">위탁 업무 내용</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              <tr className="hover:bg-slate-50">
                <td className="p-3">Google LLC (Firebase)</td>
                <td className="p-3">서버 호스팅, 데이터베이스 저장·관리, 인증 서비스 운영</td>
              </tr>
              <tr className="hover:bg-slate-50">
                <td className="p-3">스쿨버스 운송 업체</td>
                <td className="p-3">학생 탑승 노선 배정 정보 공유 (승·하차 관리 목적)</td>
              </tr>
            </tbody>
          </table>
        </Section>

        <Section number={6} title="정보주체의 권리·의무 및 행사 방법">
          <p>정보주체는 본교에 대해 언제든지 다음 각 호의 개인정보 보호 관련 권리를 행사할 수 있습니다.</p>
          <ol className="list-decimal list-inside mt-3 space-y-2 text-sm">
            <li>개인정보 열람 요구</li>
            <li>오류 등이 있을 경우 정정 요구</li>
            <li>삭제 요구 (단, 법령에서 의무적으로 보관하는 정보는 제외)</li>
            <li>처리 정지 요구</li>
          </ol>
          <p className="mt-3 text-sm text-slate-600">권리 행사는 서면, 전화, 전자우편으로 가능하며 본교는 이에 대해 지체 없이 조치합니다.</p>
        </Section>

        <Section number={7} title="개인정보의 안전성 확보 조치">
          <p>본교는 「개인정보 보호법」 제29조 및 「개인정보의 안전성 확보조치 기준」에 따라 다음과 같이 안전성 확보에 필요한 기술적·관리적·물리적 조치를 취하고 있습니다.</p>
          <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4">
            {[
              { title: '관리적 조치', items: ['개인정보 내부 관리계획 수립·시행', '개인정보 취급 직원 정기 교육', '접근 권한 관리 및 최소화'] },
              { title: '기술적 조치', items: ['개인정보 처리 시스템 접근통제', '개인정보 암호화 (저장·전송)', '보안 프로그램 설치·갱신', '접속 기록 보관 및 위·변조 방지'] },
              { title: '물리적 조치', items: ['전산실·자료보관실 접근 통제', '문서 잠금 장치 및 별도 보관'] },
            ].map((c) => (
              <div key={c.title} className="bg-slate-50 border border-slate-200 rounded-xl p-4">
                <h4 className="font-bold text-slate-800 text-sm mb-2">{c.title}</h4>
                <ul className="text-xs text-slate-600 space-y-1">
                  {c.items.map((item) => (
                    <li key={item} className="flex items-start gap-1.5">
                      <span className="text-indigo-400 mt-0.5">•</span>
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </Section>

        <Section number={8} title="개인정보 자동 수집 장치의 설치·운영 및 거부">
          <p>본교 시스템은 서비스 품질 향상을 위해 세션 쿠키(Session Cookie)를 사용합니다. 세션 쿠키는 사용자가 브라우저를 종료하면 자동으로 삭제됩니다. 이용자는 웹 브라우저의 설정을 통해 쿠키 저장을 거부할 수 있으나, 이 경우 로그인 등 일부 서비스 이용이 제한될 수 있습니다.</p>
        </Section>

        <Section number={9} title="개인정보 보호책임자 및 문의처">
          <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-sm">
              <p className="font-bold text-slate-800 mb-2">개인정보 보호책임자</p>
              <ul className="text-slate-600 space-y-1 text-xs">
                <li>직위: 교무부장</li>
                <li>전화: 학교 대표번호로 연락</li>
                <li>이메일: 교무실 공식 이메일</li>
              </ul>
            </div>
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-sm">
              <p className="font-bold text-slate-800 mb-2">시스템 관리 담당자</p>
              <ul className="text-slate-600 space-y-1 text-xs">
                <li>직위: 정보부장 / 담당 교사</li>
                <li>이메일: beside1s@kshcm.net</li>
                <li>문의 가능 시간: 평일 08:00~17:00</li>
              </ul>
            </div>
          </div>
          <p className="mt-4 text-sm text-slate-600">개인정보침해로 인한 신고·상담은 아래 기관에 요청할 수 있습니다.</p>
          <ul className="mt-2 text-sm text-slate-600 space-y-1">
            <li>• 개인정보 침해신고센터: <a href="https://privacy.kisa.or.kr" target="_blank" rel="noopener noreferrer" className="text-indigo-600 underline">privacy.kisa.or.kr</a> (☎ 118)</li>
            <li>• 개인정보분쟁조정위원회: <a href="https://www.kopico.go.kr" target="_blank" rel="noopener noreferrer" className="text-indigo-600 underline">www.kopico.go.kr</a> (☎ 1833-6972)</li>
            <li>• 대검찰청 사이버범죄 수사단 (☎ 1301)</li>
            <li>• 경찰청 사이버수사국 (☎ 182)</li>
          </ul>
        </Section>

        {/* 개정 이력 */}
        <Section number={10} title="개인정보처리방침 변경 및 개정 이력">
          <p>이 방침은 <strong>{policy.effectiveDate}</strong>부터 적용되며, 변경 사항은 시행 7일 전(권리에 중요한 변경 시 30일 전)에 공지됩니다.</p>
          <div className="mt-4 border border-slate-200 rounded-xl overflow-hidden">
            <div className="bg-slate-800 text-white px-4 py-2 text-xs font-bold flex items-center gap-2">
              <RefreshCw className="w-3.5 h-3.5" />
              개정 이력
            </div>
            <div className="divide-y divide-slate-100">
              {policy.changeLog.map((log, idx) => (
                <div key={idx} className="flex items-start gap-4 px-4 py-3 text-sm hover:bg-slate-50">
                  <span className="text-indigo-700 font-bold text-xs shrink-0 mt-0.5">{log.date}</span>
                  <span className="text-slate-700">{log.description}</span>
                </div>
              ))}
            </div>
          </div>
        </Section>

        {/* 법적 근거 요약 */}
        <section className="bg-slate-900 text-white rounded-2xl p-6 text-sm">
          <h2 className="font-bold text-lg mb-4 text-amber-400">관계 법령 및 근거 고시</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs text-slate-300">
            {[
              ['개인정보 보호법', '전문 (법률 제19234호)'],
              ['개인정보 보호법 시행령', '전문'],
              ['개인정보의 안전성 확보조치 기준', '개인정보보호위원회 고시'],
              ['교육부 개인정보 보호지침', '교육행정기관 적용'],
              ['초·중등교육법', '제25조 (학생생활기록부)'],
              ['학교보건법', '제5조, 제7조 (건강검진·기록)'],
              ['개인정보 보호법', '제30조 (처리방침 수립·공개 의무)'],
              ['개인정보 보호법', '제29조 (안전성 확보 의무)'],
            ].map(([law, desc]) => (
              <div key={law + desc} className="flex gap-2">
                <span className="text-indigo-400 font-bold shrink-0">•</span>
                <span><strong className="text-white">{law}</strong> {desc}</span>
              </div>
            ))}
          </div>
        </section>

        {/* 하단 */}
        <div className="text-center py-6 border-t border-slate-200">
          <p className="text-sm text-slate-500">
            본 방침은 <strong>{policy.effectiveDate}</strong>부터 시행됩니다.
          </p>
          <p className="text-xs text-slate-400 mt-1">
            호치민시한국국제학교 | Ho Chi Minh City Korean International School
          </p>
          <Link href="/" className="mt-3 inline-block text-indigo-600 hover:underline text-sm font-semibold">
            ← 홈으로 돌아가기
          </Link>
        </div>
      </main>
    </div>
  );
}

/* ───────── 하위 컴포넌트 ───────── */

function Section({ number, title, children }: { number: number; title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
        <span className="bg-indigo-600 text-white text-sm font-black w-8 h-8 rounded-full flex items-center justify-center shrink-0">
          {number}
        </span>
        제{number}조 ({title})
      </h2>
      <div className="text-sm text-slate-700 leading-relaxed pl-10 space-y-2">
        {children}
      </div>
    </section>
  );
}

function Divider() {
  return <hr className="border-slate-200" />;
}

function InfoTable({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="bg-slate-50 border border-slate-200 rounded-xl overflow-hidden">
      <div className="bg-slate-800 text-white px-4 py-2 text-xs font-bold">{title}</div>
      <ul className="px-4 py-3 space-y-1">
        {items.map((item) => (
          <li key={item} className="text-xs text-slate-700 flex items-start gap-2">
            <span className="text-indigo-400 mt-0.5 shrink-0">-</span>
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}
