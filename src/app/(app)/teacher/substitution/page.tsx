'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { UserPlus, Construction } from 'lucide-react';

export default function SubstitutionPage() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] p-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <Card className="max-w-2xl w-full border-t-4 border-t-emerald-500 shadow-2xl overflow-hidden backdrop-blur-sm bg-card/80">
        <CardHeader className="text-center pb-2 bg-muted/30 border-b">
          <div className="mx-auto bg-emerald-50 w-16 h-16 rounded-full flex items-center justify-center mb-4 border border-emerald-100">
            <UserPlus className="w-8 h-8 text-emerald-500" />
          </div>
          <CardTitle className="text-3xl font-bold font-headline tracking-tight">보결 관리</CardTitle>
          <CardDescription className="text-lg mt-2 font-medium">수업 보결 배정 및 확인을 위한 공간입니다.</CardDescription>
        </CardHeader>
        <CardContent className="p-10 flex flex-col items-center gap-6">
          <div className="flex items-center gap-3 text-amber-600 bg-amber-50 px-6 py-3 rounded-full border border-amber-200">
            <Construction className="w-5 h-5" />
            <span className="font-bold">기능 개발 중</span>
          </div>
          <p className="text-muted-foreground text-center leading-relaxed">
            원활한 수업 운영을 위한 보결 배정 시스템을 개발하고 있습니다.<br />
            선생님들의 업무 부담을 줄여드리는 스마트한 시스템으로 찾아뵙겠습니다.
          </p>
          
          <div className="grid grid-cols-2 gap-4 w-full mt-4">
            {['보결 배정', '나의 보결'].map((item) => (
              <div key={item} className="bg-muted/50 p-4 rounded-xl text-center text-sm font-bold border border-border/50 hover:bg-muted transition-colors">
                {item}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
