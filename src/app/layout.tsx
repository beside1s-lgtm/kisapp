if (typeof window !== "undefined") {
  window.addEventListener('error', function(event) {
    if (event.error) {
      console.error("DEBUG_ERROR_STACK:", event.error.stack);
    }
  });
  window.addEventListener('unhandledrejection', function(event) {
    if (event.reason) {
      console.error("DEBUG_REJECTION_STACK:", event.reason.stack || event.reason.message || event.reason);
    }
  });
}

import type { Metadata, Viewport } from 'next';
import { AuthProvider } from '@/components/auth-provider';
import { LanguageProvider } from '@/contexts/language-context';
import { FirebaseErrorListener } from '@/components/firebase-error-listener';
import { PwaInstallPrompt } from '@/components/pwa-install-prompt';
import { Toaster } from '@/components/ui/toaster';
import './globals.css';
import { cn } from '@/lib/utils';
import { Inter, Space_Grotesk, Source_Code_Pro } from 'next/font/google';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });
const spaceGrotesk = Space_Grotesk({ subsets: ['latin'], variable: '--font-space-grotesk' });
const sourceCodePro = Source_Code_Pro({ subsets: ['latin'], variable: '--font-source-code-pro' });

export const viewport: Viewport = {
  themeColor: '#4f46e5',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export const metadata: Metadata = {
  title: 'KIS 스쿨버스 & 학교 포털',
  description: '호치민시한국국제학교 스쿨버스 관리 및 전자 결재 통합 포털',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'KIS 스쿨버스',
  },
  formatDetection: {
    telephone: false,
  },
  icons: {
    icon: [
      { url: '/icons/icon-192x192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icons/icon-512x512.png', sizes: '512x512', type: 'image/png' },
      { url: '/icons/icon.svg', type: 'image/svg+xml' }
    ],
    apple: [
      { url: '/icons/apple-touch-icon.png', sizes: '180x180', type: 'image/png' }
    ]
  }
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko" suppressHydrationWarning>
      <head>
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="KIS 스쿨버스" />
      </head>
      <body
        className={cn(
          "min-h-screen bg-background font-body antialiased text-foreground",
          inter.variable,
          spaceGrotesk.variable,
          sourceCodePro.variable,
          process.env.NODE_ENV === 'development' ? 'debug-screens' : ''
        )}
      >
        <LanguageProvider>
          <AuthProvider>
            <FirebaseErrorListener />
            <div className="relative flex min-h-screen flex-col">
              {children}
            </div>
            <PwaInstallPrompt />
            <Toaster />
          </AuthProvider>
        </LanguageProvider>
      </body>
    </html>
  );
}
