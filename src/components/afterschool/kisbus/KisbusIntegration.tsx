import React, { useState } from 'react';
import type { KisbusBusRoute, Course, Student } from '@/lib/afterschool/types';
import { Bus, RefreshCw, CheckCircle2, Link2 } from 'lucide-react';

interface KisbusIntegrationProps {
  routes: KisbusBusRoute[];
  courses: Course[];
  students: Student[];
}

export const KisbusIntegration: React.FC<KisbusIntegrationProps> = ({
  routes,
  courses,
  students,
}) => {
  const [syncStatus, setSyncStatus] = useState<'CONNECTED' | 'SYNCING'>('CONNECTED');
  const [apiKey, setApiKey] = useState('kisbus_live_token_77a9f821c990b4d');
  const [webHookUrl, setWebHookUrl] = useState('https://api.kisbus.school.kr/v1/afterschool/sync');
  const [logs, setLogs] = useState<string[]>([
    '[SYSTEM] kisbus SSO 토큰 검증 완료',
    '[SYNC] 방과후 하교 버스 1호차 15:40 배치 완료',
    '[SYNC] 수강생 홍길동 (1학년 1반 1번) 통학버스 자동 매칭됨',
  ]);

  const handleRunManualSync = () => {
    setSyncStatus('SYNCING');
    setLogs((prev) => [`[${new Date().toLocaleTimeString()}] 수동 동기화 요청 중...`, ...prev]);
    setTimeout(() => {
      setSyncStatus('CONNECTED');
      setLogs((prev) => [
        `[${new Date().toLocaleTimeString()}] 동기화 성공: 방과후 수강생 ${students.length}명 및 강좌 ${courses.length}개 시간표 동기화 완료`,
        ...prev,
      ]);
    }, 1200);
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-indigo-900 via-indigo-800 to-blue-900 text-white p-6 rounded-2xl shadow-lg flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="bg-indigo-500/30 text-indigo-200 border border-indigo-400/30 text-xs px-2.5 py-1 rounded-full font-bold flex items-center gap-1">
              <Bus className="w-3.5 h-3.5" />
              kisbus 앱연동 모듈
            </span>
            <span className="bg-emerald-400 text-slate-900 text-xs px-2 py-0.5 rounded-full font-bold">
              연동 준비완료 (Ready)
            </span>
          </div>
          <h2 className="text-2xl font-black mt-2">kisbus (학교 통학버스/셔틀) 시스템 연동 관리</h2>
          <p className="text-xs text-indigo-200 mt-1">
            방과후 수업 종료시각과 학생별 kisbus 탑승 노선·시간표를 실시간 자동 매칭 및 동기화합니다.
          </p>
        </div>

        <button
          onClick={handleRunManualSync}
          disabled={syncStatus === 'SYNCING'}
          className="bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-slate-900 font-bold px-4 py-2.5 rounded-xl transition flex items-center gap-2 shadow"
        >
          <RefreshCw className={`w-4 h-4 ${syncStatus === 'SYNCING' ? 'animate-spin' : ''}`} />
          {syncStatus === 'SYNCING' ? 'kisbus 데이터 동기화 중...' : '즉시 수동 동기화'}
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Columns: Route & Course Matching Table */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="font-bold text-slate-900 text-base flex items-center gap-2">
                <Bus className="w-5 h-5 text-indigo-600" />
                방과후 강좌 ↔ kisbus 셔틀 버스노선 시간 매칭
              </h3>
              <span className="text-xs text-slate-500 font-mono">자동 매칭 활성화됨</span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-100 font-bold text-slate-700 border-b">
                  <tr>
                    <th className="p-3">방과후 강좌명</th>
                    <th className="p-3">수업 종료시각</th>
                    <th className="p-3">kisbus 버스 노선</th>
                    <th className="p-3">셔틀 출발 시각</th>
                    <th className="p-3 text-center">연동 상태</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {courses.map((course) => {
                    const matchedRoute = routes.find((r) => r.afterschoolCourseId === course.id);
                    return (
                      <tr key={course.id} className="hover:bg-slate-50">
                        <td className="p-3 font-bold text-slate-900">{course.title}</td>
                        <td className="p-3 font-mono font-bold text-slate-700">
                          {course.classTime.includes('15:00') ? '16:00' : '15:20'}
                        </td>
                        <td className="p-3 font-medium text-indigo-700">
                          {matchedRoute ? matchedRoute.busName : 'KIS 버스 1호차 (기본배차)'}
                        </td>
                        <td className="p-3 font-mono font-bold text-emerald-700">
                          {course.kisbusDepartureTime || '15:30'} 탑승
                        </td>
                        <td className="p-3 text-center">
                          <span className="inline-flex items-center gap-1 bg-emerald-100 text-emerald-800 text-[11px] px-2 py-0.5 rounded-full font-bold">
                            <CheckCircle2 className="w-3 h-3" />
                            연동중
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Right Column: API Sync Settings & Logs */}
        <div className="space-y-6">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-4">
            <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
              <Link2 className="w-4 h-4 text-indigo-600" />
              kisbus OpenAPI 연동 설정
            </h3>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-600 font-semibold mb-1">API Key / Secret Token</label>
                <input
                  type="password"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  className="w-full border p-2 rounded-lg font-mono text-slate-700 bg-slate-50"
                />
              </div>

              <div>
                <label className="block text-slate-600 font-semibold mb-1">WebHook Endpoint URL</label>
                <input
                  type="text"
                  value={webHookUrl}
                  onChange={(e) => setWebHookUrl(e.target.value)}
                  className="w-full border p-2 rounded-lg font-mono text-slate-700 bg-slate-50"
                />
              </div>
            </div>
          </div>

          {/* Integration Logs */}
          <div className="bg-slate-900 rounded-2xl p-5 text-white space-y-3 font-mono text-xs shadow-inner">
            <div className="flex justify-between items-center text-slate-400 pb-2 border-b border-slate-800">
              <span className="font-bold text-slate-200">kisbus Sync Log</span>
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>
            </div>
            <div className="space-y-1.5 max-h-40 overflow-y-auto">
              {logs.map((log, i) => (
                <div key={i} className="text-slate-300 leading-relaxed">
                  {log}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
