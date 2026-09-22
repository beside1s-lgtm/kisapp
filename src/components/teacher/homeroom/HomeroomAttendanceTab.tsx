'use client';

import { format } from 'date-fns';
import { Edit3, Phone } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';
import type { MasterStudent } from '@/lib/types/masterStudent';
import type { HomeroomAttendanceStatus } from '@/lib/services/homeroomAttendanceSync';
import type { DayOfWeek } from '@/lib/kisbus/types';

/**
 * "학생 정보 확인(출석부)" 탭의 본문(모바일 카드 뷰 + 데스크톱 테이블 뷰).
 *
 * teacher/homeroom/page.tsx의 TabsContent value="student-info" 블록을
 * 그대로 옮긴 것으로, 상태/로직은 전부 부모(page.tsx)에 남아 있고
 * 이 컴포넌트는 순수하게 마크업만 담당한다 (동작 변경 없음).
 */
export interface HomeroomAttendanceTabProps {
  classStudents: MasterStudent[];
  effectiveAttendanceMap: Map<string, { status: HomeroomAttendanceStatus; reason?: string; source: string }>;
  highlightedStudentId: string | null;
  studentAfternoonBusMap: Map<string, Record<DayOfWeek, { busNo: string; routeId: string } | null>>;
  onAttendanceChange: (student: MasterStudent, newStatus: HomeroomAttendanceStatus) => void;
  onCycleAttendanceStatus: (student: MasterStudent, currentStatus: HomeroomAttendanceStatus) => void;
  onEditStudent: (student: MasterStudent) => void;
  onBusUnassignRequest: (target: {
    studentId: string;
    studentName: string;
    dayOfWeek: DayOfWeek;
    dayLabel: string;
    routeId: string;
    busNo: string;
  }) => void;
}

export function HomeroomAttendanceTab({
  classStudents,
  effectiveAttendanceMap,
  highlightedStudentId,
  studentAfternoonBusMap,
  onAttendanceChange,
  onCycleAttendanceStatus,
  onEditStudent,
  onBusUnassignRequest,
}: HomeroomAttendanceTabProps) {
  return (
    <Card className="flex-1 min-h-0 flex flex-col rounded-xl border border-slate-200/80 shadow-xs bg-white">
      <CardContent className="flex-1 min-h-0 p-0 relative">
        {/* 모바일 전용 출석부 뷰 (sm:hidden) */}
        <div className="sm:hidden divide-y divide-slate-100">
          {classStudents.length > 0 ? (
            classStudents.map(student => {
              const sId = student.studentId || student.id || '';
              const att = effectiveAttendanceMap.get(sId);
              const currentStatus = att?.status || 'ATTEND';
              const isAuto = att?.source === 'auto_field_trip' || att?.source === 'auto_absence';
              const isHighlighted = highlightedStudentId === sId;

              return (
                <div
                  key={sId}
                  id={`student-row-mobile-${sId}`}
                  className={cn(
                    "p-2.5 flex items-center justify-between gap-2 transition-all select-none",
                    isHighlighted ? "bg-amber-100/90 ring-1 ring-amber-400" : "hover:bg-slate-50/80"
                  )}
                >
                  {/* 좌측: 번호, 아바타, 이름, 연락처 */}
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    <span className="w-5 text-center text-xs font-bold text-slate-500 shrink-0">
                      {student.studentNum || '-'}
                    </span>
                    <Avatar className="w-8 h-8 rounded-lg border border-slate-200 shrink-0 bg-white shadow-2xs">
                      {student.photoUrl ? (
                        <AvatarImage src={student.photoUrl} alt={student.name} className="object-cover rounded-lg" />
                      ) : (
                        <AvatarFallback className="bg-indigo-50 text-indigo-700 font-extrabold text-[11px] rounded-lg">
                          {(student.name || '학생').slice(0, 2)}
                        </AvatarFallback>
                      )}
                    </Avatar>
                    <div className="flex flex-col min-w-0 leading-tight">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-extrabold text-slate-900 text-xs truncate">
                          {student.name}
                        </span>
                        <span className="text-[10px] text-slate-400 font-normal">
                          {student.gender === 'Female' ? '여' : '남'}
                        </span>
                        {isAuto && (
                          <Badge variant="outline" className="bg-rose-50 text-rose-700 border-rose-200 text-[9px] px-1 py-0 h-4 font-bold shrink-0">
                            {att?.source === 'auto_field_trip' ? '체험' : '결석'}
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5 text-[10px] text-slate-500 mt-0.5 flex-wrap">
                        {student.contact && (
                          <a href={`tel:${student.contact.replace(/\D/g, '')}`} className="text-slate-600 font-medium hover:text-indigo-600 flex items-center gap-0.5">
                            <Phone className="w-2.5 h-2.5" />
                            <span>{student.contact}</span>
                          </a>
                        )}
                        {/* 하교 버스 간단 표시 */}
                        {(() => {
                          const bSum = student.busSummary;
                          const sid = (student.studentId || student.id || '') as string;
                          const afternoonByDay = studentAfternoonBusMap.get(sid);
                          const todayDayEn = format(new Date(), 'EEEE') as DayOfWeek;
                          const todayBus = afternoonByDay?.[todayDayEn] || (afternoonByDay ? Object.values(afternoonByDay)[0] : null);
                          if (todayBus) {
                            return (
                              <span className="bg-blue-50 text-blue-800 border border-blue-200 rounded px-1 text-[9px] font-semibold">
                                버스: {todayBus.busNo}
                              </span>
                            );
                          }
                          if (bSum?.regularBusName) {
                            return (
                              <span className="bg-sky-50 text-sky-800 border border-sky-200 rounded px-1 text-[9px] font-semibold">
                                등교: {bSum.regularBusName}
                              </span>
                            );
                          }
                          return null;
                        })()}
                      </div>
                    </div>
                  </div>

                  {/* 우측: 모바일 원터치 출결 버튼 & 정보수정 */}
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => onCycleAttendanceStatus(student, currentStatus)}
                      className={cn(
                        "h-7 px-2.5 rounded-lg text-xs font-extrabold border transition-all active:scale-95 shadow-2xs select-none cursor-pointer flex items-center justify-center min-w-[58px]",
                        currentStatus === 'ATTEND' && "bg-emerald-500 hover:bg-emerald-600 text-white border-emerald-600",
                        currentStatus === 'ABSENT' && "bg-rose-500 hover:bg-rose-600 text-white border-rose-600",
                        currentStatus === 'EARLY_LEAVE' && "bg-amber-500 hover:bg-amber-600 text-white border-amber-600",
                        currentStatus === 'INDIVIDUAL_DISMISSAL' && "bg-purple-600 hover:bg-purple-700 text-white border-purple-700"
                      )}
                      title="탭하여 출석/결석/조퇴/개별하교 순환 변경"
                    >
                      {currentStatus === 'ATTEND' && '출석'}
                      {currentStatus === 'ABSENT' && '결석'}
                      {currentStatus === 'EARLY_LEAVE' && '조퇴'}
                      {currentStatus === 'INDIVIDUAL_DISMISSAL' && '개별하교'}
                    </button>

                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg shrink-0"
                      onClick={() => onEditStudent(student)}
                      title="정보 수정"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
              );
            })
          ) : (
            <div className="p-8 text-center text-xs text-slate-500">
              담당 학급에 등록된 학생이 없습니다.
            </div>
          )}
        </div>

        {/* 데스크톱 전용 출석부 테이블 뷰 (hidden sm:block) */}
        <div className="hidden sm:block">
          <Table>
            <TableHeader className="bg-slate-100 sticky top-0 z-20 shadow-xs">
              <TableRow>
                <TableHead className="w-[60px] whitespace-nowrap font-bold text-slate-700">번호</TableHead>
                <TableHead className="whitespace-nowrap font-bold text-slate-700">학생 이름</TableHead>
                <TableHead className="whitespace-nowrap font-bold text-slate-700 min-w-[130px]">오늘 출결</TableHead>
                <TableHead className="whitespace-nowrap font-bold text-slate-700">학생 계정 이메일</TableHead>
                <TableHead className="whitespace-nowrap font-bold text-slate-700">보호자 연락처</TableHead>
                <TableHead className="whitespace-nowrap font-bold text-slate-700">방과후 수강 현황</TableHead>
                <TableHead className="whitespace-nowrap font-bold text-slate-700">스쿨버스 노선</TableHead>
                <TableHead className="text-right whitespace-nowrap font-bold text-slate-700">관리</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {classStudents.length > 0 ? (
                classStudents.map(student => {
                  const sId = student.studentId || student.id || '';
                  const att = effectiveAttendanceMap.get(sId);
                  const currentStatus = att?.status || 'ATTEND';
                  const isAuto = att?.source === 'auto_field_trip' || att?.source === 'auto_absence';
                  const isHighlighted = highlightedStudentId === sId;

                  return (
                    <TableRow
                      key={sId}
                      id={`student-row-${sId}`}
                      className={cn(
                        "transition-all duration-300",
                        isHighlighted ? "bg-amber-100/80 ring-2 ring-amber-400 ring-inset" : "hover:bg-slate-50/80"
                      )}
                    >
                      <TableCell className="whitespace-nowrap font-medium text-slate-700">
                        {student.studentNum ? `${student.studentNum}번` : '-'}
                      </TableCell>
                      <TableCell className="whitespace-nowrap">
                        <div className="flex items-center gap-2.5">
                          <Avatar className="w-9 h-9 rounded-xl border border-slate-200 shrink-0 shadow-2xs bg-white">
                            {student.photoUrl ? (
                              <AvatarImage src={student.photoUrl} alt={student.name} className="object-cover rounded-xl" />
                            ) : (
                              <AvatarFallback className="bg-indigo-50 text-indigo-700 font-extrabold text-xs rounded-xl">
                                {(student.name || '학생').slice(0, 2)}
                              </AvatarFallback>
                            )}
                          </Avatar>
                          <div className="flex flex-col items-start leading-tight">
                            <span className="font-extrabold text-slate-900">{student.name}</span>
                            <span className="text-[10px] text-slate-400 font-normal">
                              {student.gender === 'Female' ? '여' : '남'}
                            </span>
                          </div>
                        </div>
                      </TableCell>

                      {/* 오늘 출결 선택 드롭다운 칼럼 */}
                      <TableCell className="whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          <Select
                            value={currentStatus}
                            onValueChange={(val: HomeroomAttendanceStatus) => onAttendanceChange(student, val)}
                          >
                            <SelectTrigger
                              className={cn(
                                "h-7 px-2 text-xs font-bold rounded-lg border cursor-pointer min-w-[75px]",
                                currentStatus === 'ATTEND' && "bg-emerald-50 text-emerald-700 border-emerald-300",
                                currentStatus === 'ABSENT' && "bg-rose-50 text-rose-700 border-rose-300",
                                currentStatus === 'EARLY_LEAVE' && "bg-amber-50 text-amber-700 border-amber-300",
                                currentStatus === 'INDIVIDUAL_DISMISSAL' && "bg-purple-50 text-purple-700 border-purple-300"
                              )}
                            >
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="ATTEND" className="text-xs font-bold text-emerald-700">
                                출석
                              </SelectItem>
                              <SelectItem value="ABSENT" className="text-xs font-bold text-rose-700">
                                결석
                              </SelectItem>
                              <SelectItem value="EARLY_LEAVE" className="text-xs font-bold text-amber-700">
                                조퇴
                              </SelectItem>
                              <SelectItem value="INDIVIDUAL_DISMISSAL" className="text-xs font-bold text-purple-700">
                                개별하교
                              </SelectItem>
                            </SelectContent>
                          </Select>

                          {isAuto && (
                            <Badge
                              variant="outline"
                              title={att?.reason || '결재 승인 문서'}
                              className="bg-rose-100 text-rose-800 border-rose-200 text-[10px] px-1 py-0 font-bold shrink-0"
                            >
                              {att?.source === 'auto_field_trip' ? '체험학습' : '결석계'}
                            </Badge>
                          )}
                        </div>
                      </TableCell>

                      <TableCell className="whitespace-nowrap font-mono text-xs text-slate-600">
                        {student.studentEmail}
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-xs text-slate-600">
                        {student.contact || '-'}
                      </TableCell>
                      <TableCell className="whitespace-normal min-w-[140px] max-w-[220px]">
                        {student.afterschoolSummary?.enrolledCourses && student.afterschoolSummary.enrolledCourses.length > 0 ? (
                          <div className="flex flex-col gap-1 py-1">
                            {student.afterschoolSummary.enrolledCourses.map((c, idx) => (
                              <Badge key={idx} variant="secondary" className="bg-emerald-50 text-emerald-800 border border-emerald-200 text-[11px] font-semibold py-0.5 px-2 w-fit">
                                <span className="font-bold text-emerald-950 mr-1">[{c.days.join(',')}]</span>
                                <span>{(c.title || '').slice(0, 5)}{(c.title || '').length > 5 ? '..' : ''}</span>
                              </Badge>
                            ))}
                          </div>
                        ) : student.afterschoolSummary?.enrolledCourseTitles && student.afterschoolSummary.enrolledCourseTitles.length > 0 ? (
                          <div className="flex flex-col gap-1">
                            {student.afterschoolSummary.enrolledCourseTitles.map((t, idx) => (
                              <Badge key={idx} variant="secondary" className="bg-emerald-50 text-emerald-700 border border-emerald-200 text-[11px] w-fit">
                                {(t || '').slice(0, 5)}{(t || '').length > 5 ? '..' : ''}
                              </Badge>
                            ))}
                          </div>
                        ) : (
                          <span className="text-xs text-slate-400 italic whitespace-nowrap">미수강</span>
                        )}
                      </TableCell>
                      <TableCell className="whitespace-normal min-w-[150px] max-w-[220px]">
                        {(() => {
                          const bSum = student.busSummary;
                          const sid = (student.studentId || student.id || '') as string;
                          const afternoonByDay = studentAfternoonBusMap.get(sid);
                          const afterschoolBuses = bSum?.afterSchoolBuses || [];
                          const hasAfternoonBus = afternoonByDay
                            ? Object.values(afternoonByDay).some(v => v !== null)
                            : false;
                          const hasMorningBus = !!bSum?.regularBusName;
                          const hasAfterschoolBuses = afterschoolBuses.length > 0;

                          const DAY_LABELS: Record<string, string> = {
                            Monday: '월', Tuesday: '화', Wednesday: '수', Thursday: '목', Friday: '금',
                          };
                          const DAY_ORDER: DayOfWeek[] = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];

                          if (!hasMorningBus && !hasAfternoonBus && !hasAfterschoolBuses && !bSum?.assignedBusName) {
                            return <span className="text-xs text-slate-400 italic whitespace-nowrap">자가 귀가</span>;
                          }

                          return (
                            <div className="flex flex-col gap-1 py-1">
                              {/* 등교 버스 (정규) */}
                              {hasMorningBus && (
                                <Badge variant="outline" className="bg-sky-50 text-sky-800 border-sky-200 text-[11px] font-semibold py-0.5 px-2 w-fit">
                                  <span className="font-bold text-sky-950 mr-1">[등교]</span>
                                  <span>{bSum!.regularBusName}</span>
                                </Badge>
                              )}
                              {/* 하교 버스 - 요일별 항상 표시, 클릭 시 해제 팝업 */}
                              {afternoonByDay && DAY_ORDER.map(day => {
                                const info = afternoonByDay[day];
                                if (!info) return null;
                                const dayLabel = DAY_LABELS[day] || day;
                                return (
                                  <Badge
                                    key={day}
                                    variant="outline"
                                    className="bg-blue-50 text-blue-800 border-blue-200 text-[11px] font-semibold py-0.5 px-2 w-fit cursor-pointer hover:bg-red-50 hover:border-red-300 hover:text-red-700 transition-colors"
                                    title={`${dayLabel}요일 하교 버스 해제/유지 선택`}
                                    onClick={() => onBusUnassignRequest({
                                      studentId: sid,
                                      studentName: student.nameKo || student.name || '',
                                      dayOfWeek: day,
                                      dayLabel,
                                      routeId: info.routeId,
                                      busNo: info.busNo,
                                    })}
                                  >
                                    <span className="font-bold text-blue-950 mr-1">[하교 {dayLabel}]</span>
                                    <span>{info.busNo}</span>
                                  </Badge>
                                );
                              })}
                              {/* 방과후 버스 */}
                              {afterschoolBuses.map((asb, idx) => (
                                <Badge key={idx} variant="outline" className="bg-amber-50 text-amber-900 border-amber-200 text-[11px] font-semibold py-0.5 px-2 w-fit">
                                  <span className="font-bold text-amber-950 mr-1">[방과후 {asb.day}]</span>
                                  <span>{asb.busName}</span>
                                </Badge>
                              ))}
                              {/* 기타 assignedBus (위에 아무것도 없을 때) */}
                              {!hasMorningBus && !hasAfternoonBus && !hasAfterschoolBuses && bSum?.assignedBusName && (
                                <Badge variant="outline" className="bg-sky-50 text-sky-700 border-sky-200 text-[11px] font-bold w-fit">
                                  {bSum.assignedBusName}
                                </Badge>
                              )}
                            </div>
                          );
                        })()}
                      </TableCell>
                      <TableCell className="text-right whitespace-nowrap">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-7 text-xs px-2.5 text-indigo-700 hover:bg-indigo-50 border-indigo-200 cursor-pointer font-medium"
                          onClick={() => onEditStudent(student)}
                        >
                          <Edit3 className="h-3.5 w-3.5 mr-1" /> 정보 수정
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })
              ) : (
                <TableRow>
                  <TableCell colSpan={8} className="h-28 text-center text-slate-500 whitespace-nowrap">
                    담당 학급에 등록된 학생이 없습니다.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
