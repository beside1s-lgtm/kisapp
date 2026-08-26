'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect } from 'react';
import { Loader2 } from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';

function RootRedirect() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, loading, isParent } = useAuth();

  const redirectTarget = searchParams.get('redirect') || searchParams.get('next');

  useEffect(() => {
    if (!loading) {
      if (user) {
        if (isParent) {
          if (redirectTarget && (redirectTarget.startsWith('/parents') || redirectTarget.startsWith('/afterschool'))) {
            router.replace(redirectTarget);
          } else {
            router.replace('/parents');
          }
        } else {
          if (redirectTarget && redirectTarget.startsWith('/')) {
            router.replace(redirectTarget);
          } else {
            router.replace('/inbox');
          }
        }
      } else {
        const loginUrl = redirectTarget ? `/login?redirect=${encodeURIComponent(redirectTarget)}` : '/login';
        router.replace(loginUrl);
      }
    }
  }, [router, user, loading, redirectTarget, isParent]);

  return (
    <div className="flex h-screen w-full items-center justify-center bg-background">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
    </div>
  );
}

export default function AppPage() {
  return (
    <Suspense fallback={
      <div className="flex h-screen w-full items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    }>
      <RootRedirect />
    </Suspense>
  );
}
