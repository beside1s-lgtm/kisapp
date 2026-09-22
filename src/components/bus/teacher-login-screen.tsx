'use client';

import { useMemo } from 'react';
import { GraduationCap, UserX } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { cn } from '@/lib/kisbus/utils';

/**
 * 스쿨버스 교사 페이지 로그인 화면 (teacher/bus/page.tsx에서 순수 이동).
 *
 * 원래부터 TeacherPage 내부 클로저를 참조하지 않는, props만으로 동작하는
 * 독립 컴포넌트였기 때문에 그대로 파일만 옮긴 것이다 (동작 변경 없음).
 */
export function TeacherLoginScreen({
  pin, onPinPress, onBackspace, error, lang, validPin,
  loginStep, setLoginStep, nameInput, setNameInput, teachers = []
}: any) {
  const sortedTeachers = useMemo(() => {
    return [...teachers].sort((a: any, b: any) => (a.name || '').localeCompare(b.name || '', 'ko'));
  }, [teachers]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 font-sans p-4">
      <Card className="w-full max-w-[400px] shadow-lg border-none bg-white">
        <CardHeader className="text-center pb-4">
          <div className="mx-auto w-12 h-12 bg-primary rounded-xl flex items-center justify-center mb-2">
            <GraduationCap className="text-white w-6 h-6" />
          </div>
          <CardTitle className="text-xl font-bold text-slate-800">KIS BUS</CardTitle>
          <CardDescription>
            {loginStep === 'name' ? '선생님 본인 확인' : '교사용 인증번호 입력'}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {loginStep === 'name' ? (
            <div className="space-y-3">
              <Label className="text-slate-600 font-semibold text-xs">{lang === 'ko' ? '선생님 성함을 선택하거나 입력해주세요' : 'Select or enter your name'}</Label>

              {sortedTeachers.length > 0 && (
                <Select
                  value={nameInput}
                  onValueChange={(val) => {
                    setNameInput(val);
                    setLoginStep('pin');
                  }}
                >
                  <SelectTrigger className="h-10 font-medium bg-slate-50">
                    <SelectValue placeholder={lang === 'ko' ? '교직원 명단에서 선택' : 'Select from faculty list'} />
                  </SelectTrigger>
                  <SelectContent className="max-h-60">
                    {sortedTeachers.map((t: any) => (
                      <SelectItem key={t.id || t.email || t.name} value={t.name}>
                        {t.name} {t.role ? `(${t.role})` : ''} {t.dept ? `- ${t.dept}` : ''}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}

              <div className="relative flex py-0.5 items-center">
                <div className="flex-grow border-t border-slate-200"></div>
                <span className="flex-shrink mx-2 text-[10px] text-slate-400 font-bold">또는 직접 입력</span>
                <div className="flex-grow border-t border-slate-200"></div>
              </div>

              <Input
                placeholder={lang === 'ko' ? '이름 직접 입력' : 'Name'}
                value={nameInput}
                onChange={(e) => setNameInput(e.target.value)}
                className="h-10"
                onKeyDown={(e) => e.key === 'Enter' && setLoginStep('pin')}
              />
              <Button className="w-full h-10 font-bold" onClick={() => setLoginStep('pin')}>
                {lang === 'ko' ? '다음 (인증번호 입력)' : 'Next'}
              </Button>
            </div>
          ) : (
            <div className="space-y-6">
              <div className="flex justify-center gap-4">
                {Array.from({ length: validPin.length }).map((_, i) => (
                  <div
                    key={i}
                    className={cn(
                      "w-4 h-4 rounded-full border-2 transition-all duration-200",
                      pin.length >= i + 1
                        ? (error ? "bg-red-500 border-red-500" : "bg-primary border-primary")
                        : "border-slate-300 bg-transparent"
                    )}
                  />
                ))}
              </div>

              <div className="grid grid-cols-3 gap-3">
                {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
                  <Button
                    key={num}
                    variant="outline"
                    className="h-12 text-lg font-bold border-slate-200 hover:bg-slate-50"
                    onClick={() => onPinPress(num.toString())}
                  >
                    {num}
                  </Button>
                ))}
                <Button
                  variant="ghost"
                  className="h-12 text-sm text-slate-400"
                  onClick={() => setLoginStep('name')}
                >
                  {lang === 'ko' ? '이전' : 'Back'}
                </Button>
                <Button
                  variant="outline"
                  className="h-12 text-lg font-bold border-slate-200 hover:bg-slate-50"
                  onClick={() => onPinPress('0')}
                >
                  0
                </Button>
                <Button
                  variant="ghost"
                  className="h-12 flex items-center justify-center text-slate-500"
                  onClick={onBackspace}
                >
                  <UserX className="w-5 h-5" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
