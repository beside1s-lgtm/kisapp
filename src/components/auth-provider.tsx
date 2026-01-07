'use client';

import { createContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { onAuthStateChanged, signInWithPopup, signOut, User as FirebaseUser, GoogleAuthProvider } from 'firebase/auth';
import { auth, googleProvider } from '@/lib/firebase';
import { getUserProfile, saveUserProfile } from '@/app/actions';
import { UserProfile } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react';

interface AuthContextType {
  user: FirebaseUser | null;
  profile: UserProfile | null;
  loading: boolean;
  profileLoading: boolean;
  googleSignIn: () => Promise<void>;
  logout: () => Promise<void>;
  setProfile: (profile: UserProfile | null) => void;
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [profileLoading, setProfileLoading] = useState(true);
  const { toast } = useToast();

  const fetchProfile = useCallback(async (firebaseUser: FirebaseUser) => {
    setProfileLoading(true);
    try {
      let userProfile = await getUserProfile(firebaseUser.uid);
      if (!userProfile) {
        // Create a basic profile if one doesn't exist
        const newProfile: UserProfile = {
          name: firebaseUser.displayName || 'New User',
          role: '담당', // default role
          email: firebaseUser.email!,
          signature: '',
        };
        await saveUserProfile(firebaseUser.uid, firebaseUser.email!, newProfile);
        userProfile = newProfile;
      }
      setProfile(userProfile);
    } catch (error) {
      console.error("Failed to fetch or create profile", error);
      toast({ variant: 'destructive', title: 'Profile Error', description: 'Could not load your profile.' });
    } finally {
      setProfileLoading(false);
    }
  }, [toast]);
  
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setLoading(true);
      setProfileLoading(true);
      if (firebaseUser) {
        if (firebaseUser.email?.endsWith('@kshcm.net')) {
            setUser(firebaseUser);
            await fetchProfile(firebaseUser);
        } else {
            toast({ variant: 'destructive', title: '접근 거부', description: 'kshcm.net 도메인 계정으로만 로그인할 수 있습니다.'});
            await signOut(auth);
            setUser(null);
            setProfile(null);
        }
      } else {
        setUser(null);
        setProfile(null);
      }
      setProfileLoading(false);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [fetchProfile, toast]);
  
  const googleSignIn = async () => {
    try {
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({
        prompt: 'select_account'
      });
      // The onAuthStateChanged listener will handle the user state update.
      await signInWithPopup(auth, provider);
    } catch (error: any) {
      console.error("Google Sign-In Error:", error);
      let description = '로그인 중 오류가 발생했습니다.';
      if (error.code === 'auth/popup-closed-by-user') {
        description = '로그인 팝업이 닫혔습니다. 다시 시도해주세요.';
      } else if (error.code === 'auth/cancelled-popup-request') {
        description = '여러 번의 로그인 시도가 감지되었습니다. 잠시 후 다시 시도해주세요.';
      } else if (error.code === 'auth/unauthorized-domain') {
        description = '이 도메인은 로그인에 허용되지 않았습니다. 관리자에게 문의하세요.';
      }
      toast({ variant: 'destructive', title: '로그인 실패', description: description });
    }
  };

  const logout = async () => {
    setLoading(true);
    try {
      await signOut(auth);
      // onAuthStateChanged will handle setting user and profile to null
    } catch (error) {
       console.error(error);
       toast({ variant: 'destructive', title: 'Sign-out Failed', description: 'An error occurred while signing out.' });
    } finally {
      setLoading(false);
    }
  };
  
  const value = { user, profile, loading, profileLoading, googleSignIn, logout, setProfile };

  if (loading) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-background">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
