'use client';
import { useAuth } from '@/hooks/use-auth';
import { Button } from '@/components/ui/button';
import { FileText, Loader2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

// Google Icon SVG
const GoogleIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 48 48" {...props}>
    <path fill="#FFC107" d="M43.611,20.083H42V20H24v8h11.303c-1.649,4.657-6.08,8-11.303,8c-6.627,0-12-5.373-12-12s5.373-12,12-12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4C12.955,4,4,12.955,4,24s8.955,20,20,20s20-8.955,20-20C44,22.659,43.862,21.35,43.611,20.083z" />
    <path fill="#FF3D00" d="M6.306,14.691l6.571,4.819C14.655,15.108,18.961,12,24,12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4C16.318,4,9.656,8.337,6.306,14.691z" />
    <path fill="#4CAF50" d="M24,44c5.166,0,9.86-1.977,13.409-5.192l-6.19-5.238C29.211,35.091,26.715,36,24,36c-5.202,0-9.619-3.317-11.283-7.946l-6.522,5.025C9.505,39.556,16.227,44,24,44z" />
    <path fill="#1976D2" d="M43.611,20.083H42V20H24v8h11.303c-0.792,2.237-2.231,4.166-4.087,5.571l6.19,5.238C42.022,35.242,44,30.038,44,24C44,22.659,43.862,21.35,43.611,20.083z" />
  </svg>
);


export default function LoginPage() {
  const { user, loading, googleSignIn } = useAuth();
  const [isSigningIn, setIsSigningIn] = useState(false);
  const router = useRouter();

  useEffect(() => {
    if (!loading && user) {
      router.push('/inbox');
    }
  }, [user, loading, router]);

  const handleSignIn = async () => {
    setIsSigningIn(true);
    try {
      await googleSignIn();
      // The useEffect will handle redirection
    } catch (error) {
      console.error('Sign-in failed', error);
      setIsSigningIn(false);
    }
  };

  if (loading || user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-12 w-12 text-primary animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <main className="w-full max-w-md text-center">
        <div className="mx-auto w-fit p-4 bg-primary text-primary-foreground rounded-2xl shadow-lg mb-6">
          <FileText className="h-10 w-10" />
        </div>
        <h1 className="font-headline text-4xl font-bold text-foreground mb-2">
          KISH Approval System
        </h1>
        <p className="text-muted-foreground mb-8">
          Please sign in with your Google Workspace account.
        </p>

        <Button
          onClick={handleSignIn}
          disabled={isSigningIn}
          size="lg"
          className="w-full text-lg h-14 rounded-xl shadow-lg transition-all transform hover:scale-105"
        >
          {isSigningIn ? (
            <Loader2 className="mr-2 h-5 w-5 animate-spin" />
          ) : (
            <GoogleIcon className="mr-3 h-6 w-6" />
          )}
          Sign in with Google
        </Button>
         <p className="text-xs text-muted-foreground mt-8">
          Only authorized users from the KISH domain can access this system.
        </p>
      </main>
    </div>
  );
}
