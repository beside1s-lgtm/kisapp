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

import type { Metadata } from 'next';
import { AuthProvider } from '@/components/auth-provider';
import { LanguageProvider } from '@/contexts/language-context';
import { FirebaseErrorListener } from '@/components/firebase-error-listener';
import { Toaster } from '@/components/ui/toaster';
import './globals.css';
import { cn } from '@/lib/utils';
import { Inter, Space_Grotesk, Source_Code_Pro } from 'next/font/google';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });
const spaceGrotesk = Space_Grotesk({ subsets: ['latin'], variable: '--font-space-grotesk' });
const sourceCodePro = Source_Code_Pro({ subsets: ['latin'], variable: '--font-source-code-pro' });

export const metadata: Metadata = {
  title: 'KSHCM 결재 시스템',
  description: 'KSHCM 전자 결재 시스템',
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
            <Toaster />
          </AuthProvider>
        </LanguageProvider>
      </body>
    </html>
  );
}
