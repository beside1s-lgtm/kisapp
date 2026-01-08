import type { Metadata } from 'next';
import { AuthProvider } from '@/components/auth-provider';
import { Toaster } from '@/components/ui/toaster';
import './globals.css';
import { cn } from '@/lib/utils';
import { Inter, Space_Grotesk, Source_Code_Pro, Noto_Sans_KR } from 'next/font/google';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });
const spaceGrotesk = Space_Grotesk({ subsets: ['latin'], variable: '--font-space-grotesk' });
const sourceCodePro = Source_Code_Pro({ subsets: ['latin'], variable: '--font-source-code-pro' });
const notoSansKr = Noto_Sans_KR({
  subsets: ['latin'],
  weight: ['100', '300', '400', '500', '700', '900'], // 다양한 굵기 추가
  variable: '--font-noto-sans-kr',
});

export const metadata: Metadata = {
  title: 'KISH 결재 시스템',
  description: 'KISH 전자 결재 시스템',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko" suppressHydrationWarning>
      <body
        className={cn(
          // [수정 포인트]
          // 1. min-h-screen: 화면 전체 높이 확보
          // 2. bg-background: 테마 배경색 적용 (다크모드 등 대응)
          // 3. font-sans: 기본 폰트 적용 (tailwind 설정에 따라 Noto Sans KR 등 적용됨)
          "min-h-screen bg-background font-sans antialiased text-foreground",
          inter.variable,
          spaceGrotesk.variable,
          sourceCodePro.variable,
          notoSansKr.variable,
          process.env.NODE_ENV === 'development' ? 'debug-screens' : ''
        )}
      >
        <AuthProvider>
          {/* 레이아웃 구조를 잡아주는 div 추가 (선택사항이나 권장됨) */}
          <div className="relative flex min-h-screen flex-col">
            {children}
          </div>
          <Toaster />
        </AuthProvider>
      </body>
    </html>
  );
}