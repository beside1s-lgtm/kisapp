'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { TabsContent } from '@/components/ui/tabs';
import { Loader2, Send, Users, Search, Calendar, Building, MapPin } from 'lucide-react';
import type { VolunteerStudentItem } from '@/lib/types';

interface GroupPlanForm {
  startDate: string;
  endDate: string;
  startDayOfWeek: string;
  endDayOfWeek: string;
  totalDays: number;
  totalHours: number;
  institution: string;
  location: string;
  content: string;
  students: VolunteerStudentItem[];
}

export function ApplyTabContent({
  groupPlanForm,
  setGroupPlanForm,
  minSelectableDate,
  handleStudentChange,
  handleDateChange,
  setIsStudentSearchOpen,
  isSubmitting,
  handleSubmitGroupPlan,
  volunteerManagerName,
}: {
  groupPlanForm: GroupPlanForm;
  setGroupPlanForm: React.Dispatch<React.SetStateAction<GroupPlanForm>>;
  minSelectableDate: string;
  handleStudentChange: (index: number, field: keyof VolunteerStudentItem, val: string) => void;
  handleDateChange: (start: string, end: string) => void;
  setIsStudentSearchOpen: (open: boolean) => void;
  isSubmitting: boolean;
  handleSubmitGroupPlan: (e: React.FormEvent) => void;
  volunteerManagerName: string;
}) {
  return (
    <TabsContent value="apply">
      <Card className="border shadow-xs">
        <CardHeader className="p-4 sm:p-5 bg-muted/20 border-b">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base sm:text-lg font-bold flex items-center gap-2">
                <Users className="w-5 h-5 text-primary" />
                봉사활동 계획서 작성 (초등단체)
              </CardTitle>
              <CardDescription className="text-xs mt-1">
                담당 교사가 학생 단체를 대표하여 계획서를 상신합니다. (결재선: [업무 담당: {volunteerManagerName || '양유정'}] → [담당 부장: 최선미] → [교감: 신선영 전결])
              </CardDescription>
            </div>
            <Badge variant="outline" className="text-xs text-blue-700 bg-blue-50 border-blue-200">
              서식 3
            </Badge>
          </div>
        </CardHeader>

        <form onSubmit={handleSubmitGroupPlan}>
          <CardContent className="p-4 sm:p-6 space-y-5">
            {/* 1. 학생 명단 20명 슬롯 테이블 */}
            <div className="space-y-2">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  <Label className="text-xs font-bold flex items-center gap-1.5">
                    <Users className="w-4 h-4 text-primary" />
                    참여 학생 명단 (최대 20명)
                  </Label>
                  <Badge variant="secondary" className="text-[11px]">
                    입력됨: <b>{groupPlanForm.students.filter(s => s.name?.trim()).length}</b>명
                  </Badge>
                </div>

                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-7 text-xs font-bold"
                  onClick={() => setIsStudentSearchOpen(true)}
                >
                  <Search className="w-3.5 h-3.5 mr-1" />
                  학생 검색 추가
                </Button>
              </div>

              {/* 2열 20명 슬롯 그리드 */}
              <div className="border rounded-xl overflow-hidden shadow-2xs">
                <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x">
                  {/* 좌측 1~10번 */}
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs text-center border-collapse">
                      <thead className="bg-muted/50 text-[11px] font-bold border-b">
                        <tr>
                          <th className="p-1.5 w-10">순번</th>
                          <th className="p-1.5 w-14">학년</th>
                          <th className="p-1.5 w-12">반</th>
                          <th className="p-1.5 w-14">번호</th>
                          <th className="p-1.5">이름</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y text-[11px]">
                        {groupPlanForm.students.slice(0, 10).map((s, idx) => (
                          <tr key={idx} className="hover:bg-muted/30">
                            <td className="p-1 font-bold text-muted-foreground">{idx + 1}</td>
                            <td className="p-1">
                              <Input
                                value={s.grade}
                                onChange={e => handleStudentChange(idx, 'grade', e.target.value)}
                                placeholder="학년"
                                className="h-7 text-xs text-center p-1"
                              />
                            </td>
                            <td className="p-1">
                              <Input
                                value={s.classNum}
                                onChange={e => handleStudentChange(idx, 'classNum', e.target.value)}
                                placeholder="반"
                                className="h-7 text-xs text-center p-1"
                              />
                            </td>
                            <td className="p-1">
                              <Input
                                value={s.studentNum}
                                onChange={e => handleStudentChange(idx, 'studentNum', e.target.value)}
                                placeholder="번호"
                                className="h-7 text-xs text-center p-1"
                              />
                            </td>
                            <td className="p-1">
                              <Input
                                value={s.name}
                                onChange={e => handleStudentChange(idx, 'name', e.target.value)}
                                placeholder="학생 이름"
                                className="h-7 text-xs font-bold p-1"
                              />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* 우측 11~20번 */}
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs text-center border-collapse">
                      <thead className="bg-muted/50 text-[11px] font-bold border-b">
                        <tr>
                          <th className="p-1.5 w-10">순번</th>
                          <th className="p-1.5 w-14">학년</th>
                          <th className="p-1.5 w-12">반</th>
                          <th className="p-1.5 w-14">번호</th>
                          <th className="p-1.5">이름</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y text-[11px]">
                        {groupPlanForm.students.slice(10, 20).map((s, idx) => {
                          const realIdx = idx + 10;
                          return (
                            <tr key={realIdx} className="hover:bg-muted/30">
                              <td className="p-1 font-bold text-muted-foreground">{realIdx + 1}</td>
                              <td className="p-1">
                                <Input
                                  value={s.grade}
                                  onChange={e => handleStudentChange(realIdx, 'grade', e.target.value)}
                                  placeholder="학년"
                                  className="h-7 text-xs text-center p-1"
                                />
                              </td>
                              <td className="p-1">
                                <Input
                                  value={s.classNum}
                                  onChange={e => handleStudentChange(realIdx, 'classNum', e.target.value)}
                                  placeholder="반"
                                  className="h-7 text-xs text-center p-1"
                                />
                              </td>
                              <td className="p-1">
                                <Input
                                  value={s.studentNum}
                                  onChange={e => handleStudentChange(realIdx, 'studentNum', e.target.value)}
                                  placeholder="번호"
                                  className="h-7 text-xs text-center p-1"
                                />
                              </td>
                              <td className="p-1">
                                <Input
                                  value={s.name}
                                  onChange={e => handleStudentChange(realIdx, 'name', e.target.value)}
                                  placeholder="학생 이름"
                                  className="h-7 text-xs font-bold p-1"
                                />
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>

            {/* 2. 활동 기간 및 총 계획 시간 */}
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-bold flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-primary" />
                  활동 기간 및 계획 시간
                </Label>
                <span className="text-[11px] text-red-600 font-bold">
                  ※ 무조건 7일 전 제출 ({minSelectableDate}부터 신청 가능)
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                <div>
                  <Label className="text-[11px] text-muted-foreground">시작일</Label>
                  <Input
                    type="date"
                    min={minSelectableDate}
                    value={groupPlanForm.startDate}
                    onChange={e => handleDateChange(e.target.value, groupPlanForm.endDate)}
                    required
                    className="h-8 text-xs mt-1"
                  />
                </div>
                <div>
                  <Label className="text-[11px] text-muted-foreground">종료일</Label>
                  <Input
                    type="date"
                    min={groupPlanForm.startDate || minSelectableDate}
                    value={groupPlanForm.endDate}
                    onChange={e => handleDateChange(groupPlanForm.startDate, e.target.value)}
                    required
                    className="h-8 text-xs mt-1"
                  />
                </div>
                <div>
                  <Label className="text-[11px] text-muted-foreground">봉사활동 계획 시간 (총 시간)</Label>
                  <Input
                    type="number"
                    min={1}
                    value={groupPlanForm.totalHours}
                    onChange={e => setGroupPlanForm({ ...groupPlanForm, totalHours: Number(e.target.value) })}
                    required
                    className="h-8 text-xs mt-1 font-bold"
                  />
                </div>
              </div>

              <div className="p-2.5 bg-amber-50/70 border border-amber-200 rounded-lg text-[11px] text-amber-800 leading-relaxed">
                선택 기간: <b>{groupPlanForm.startDate || 'YYYY-MM-DD'} ({groupPlanForm.startDayOfWeek}요일) ~ {groupPlanForm.endDate || 'YYYY-MM-DD'} ({groupPlanForm.endDayOfWeek}요일)</b> / 총 <b>{groupPlanForm.totalDays}</b>일간 (계획: <b>{groupPlanForm.totalHours}</b>시간)
                <br />
                <span className="text-red-600 font-semibold">※ 휴일, 공휴일 8시간 이내 인정 (학기 중 등교 시간은 미인정)</span>
              </div>
            </div>

            {/* 3. 대상 기관 및 장소 */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label className="text-xs font-bold flex items-center gap-1.5">
                  <Building className="w-3.5 h-3.5 text-primary" />
                  대상 기관명
                </Label>
                <Input
                  value={groupPlanForm.institution}
                  onChange={e => setGroupPlanForm({ ...groupPlanForm, institution: e.target.value })}
                  placeholder="예: 호치민 적십자사, 교내 도서관 등"
                  required
                  className="h-8 text-xs mt-1"
                />
              </div>
              <div>
                <Label className="text-xs font-bold flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5 text-primary" />
                  활동 장소
                </Label>
                <Input
                  value={groupPlanForm.location}
                  onChange={e => setGroupPlanForm({ ...groupPlanForm, location: e.target.value })}
                  placeholder="예: 7군 센터 회관, 학교 도서관 등"
                  required
                  className="h-8 text-xs mt-1"
                />
              </div>
            </div>

            {/* 4. 활동 내용 */}
            <div>
              <Label className="text-xs font-bold">활동 내용</Label>
              <Textarea
                value={groupPlanForm.content}
                onChange={e => setGroupPlanForm({ ...groupPlanForm, content: e.target.value })}
                placeholder="단체 봉사활동의 구체적인 계획 및 활동 내용을 상세히 기재해 주세요."
                rows={4}
                required
                className="text-xs mt-1 leading-relaxed"
              />
            </div>

            {/* 안내 문구 */}
            <div className="text-[11px] text-red-600 bg-red-50/50 p-2.5 rounded-lg border border-red-100 leading-normal">
              ※ 봉사활동 계획서는 무조건 <b>실시 7일 전까지</b> 제출해야 하며(신청일로부터 6일 이내 날짜는 신청 불가), 봉사활동 실시 이후 7일 내 확인서 제출 시 학교생활기록부에 등재됩니다.
            </div>
          </CardContent>

          <CardFooter className="p-4 bg-muted/20 border-t flex justify-end gap-2">
            <Button
              type="submit"
              disabled={isSubmitting}
              className="h-9 px-4 font-bold bg-primary hover:bg-primary/90 text-primary-foreground shadow-xs"
            >
              {isSubmitting ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <Send className="w-4 h-4 mr-1.5" />}
              단체 계획서 결재 상신
            </Button>
          </CardFooter>
        </form>
      </Card>
    </TabsContent>
  );
}
