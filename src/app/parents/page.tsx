'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { FileEdit, History, Info } from 'lucide-react';

export default function ParentsDashboard() {
  return (
    <div className="max-w-5xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold tracking-tight font-headline text-foreground">학부모 서비스 대시보드</h1>
        <p className="text-muted-foreground text-lg">
          KISAPP 학부모 서비스에 오신 것을 환영합니다. 원하시는 메뉴를 선택해주세요.
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        <Card className="hover:shadow-lg transition-all duration-300 border-primary/20 bg-gradient-to-br from-primary/5 to-background hover:-translate-y-1">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-xl text-primary">
              <div className="p-2 bg-primary/10 rounded-lg">
                <FileEdit className="h-6 w-6" />
              </div>
              신청서 제출
            </CardTitle>
            <CardDescription className="text-sm">
              학교에 제출할 각종 신청서 및 동의서를 간편하게 작성하고 제출합니다.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button className="w-full font-bold shadow-md hover:shadow-lg transition-all" asChild>
              <Link href="/parents/apply">바로가기</Link>
            </Button>
          </CardContent>
        </Card>

        <Card className="hover:shadow-lg transition-all duration-300 hover:-translate-y-1">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-xl">
              <div className="p-2 bg-blue-500/10 text-blue-500 rounded-lg">
                <History className="h-6 w-6" />
              </div>
              제출 내역
            </CardTitle>
            <CardDescription className="text-sm">
              이전에 제출하신 문서들의 상세 내용과 실시간 처리 상태를 확인합니다.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="outline" className="w-full font-bold hover:bg-blue-500/5 hover:text-blue-600 transition-colors" asChild>
              <Link href="/parents/history">내역 보기</Link>
            </Button>
          </CardContent>
        </Card>

        <Card className="hover:shadow-lg transition-all duration-300 hover:-translate-y-1">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-xl">
              <div className="p-2 bg-green-500/10 text-green-500 rounded-lg">
                <Info className="h-6 w-6" />
              </div>
              학교 공지사항
            </CardTitle>
            <CardDescription className="text-sm">
              학교에서 안내하는 주요 공지사항과 가정통신문을 확인합니다.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="secondary" className="w-full font-bold text-muted-foreground" disabled>
              준비 중입니다
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
