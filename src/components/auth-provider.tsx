'use client';

import { createContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { onAuthStateChanged, signInWithPopup, signOut, User as FirebaseUser } from 'firebase/auth';
import { auth, googleProvider } from '@/lib/firebase';
import { getUserProfile, saveUserProfile } from '@/app/actions';
import { UserProfile } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react';
import { errorEmitter } from '@/lib/error-emitter';

interface AuthContextType {
  user: FirebaseUser | null;
  profile: UserProfile | null;
  loading: boolean;
  profileLoading: boolean;
  googleSignIn: () => Promise<void>;
  logout: () => Promise<void>;
  fetchProfile: (user: FirebaseUser) => Promise<UserProfile | null>;
  setProfile: (profile: UserProfile | null) => void;
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [profileLoading, setProfileLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    const handlePermissionError = (error: Error) => {
      console.error(error); // Log the detailed error to the console
      toast({
        variant: 'destructive',
        title: '권한 오류',
        description: error.message || '데이터베이스 작업에 실패했습니다. 보안 규칙을 확인하세요.',
        duration: 10000,
      });
    };

    errorEmitter.on('permission-error', handlePermissionError);

    return () => {
      errorEmitter.removeListener('permission-error', handlePermissionError);
    };
  }, [toast]);


  const fetchProfile = useCallback(async (firebaseUser: FirebaseUser): Promise<UserProfile | null> => {
    setProfileLoading(true);
    try {
      let userProfile = await getUserProfile(firebaseUser.uid);
      if (userProfile) {
        setProfile(userProfile);
        return userProfile;
      } else {
        const newProfile: UserProfile = {
          name: firebaseUser.displayName || 'New User',
          email: firebaseUser.email!,
          role: '담당',
          signature: '',
          isAdmin: false,
        };
        await saveUserProfile(firebaseUser.uid, firebaseUser.email!, newProfile);
        setProfile(newProfile);
        return newProfile;
      }
    } catch (error) {
      console.error("Failed to fetch or create profile", error);
      toast({ variant: 'destructive', title: 'Profile Error', description: '프로필을 불러오는 데 실패했습니다.' });
      return null;
    } finally {
      setProfileLoading(false);
    }
  }, [toast]);
  
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setLoading(true);
      if (firebaseUser) {
        if (firebaseUser.email?.endsWith('@kshcm.net') || firebaseUser.email?.endsWith('@kish.kr') || process.env.NODE_ENV === 'development' ) {
            setUser(firebaseUser);
            await fetchProfile(firebaseUser);
        } else {
            toast({ variant: 'destructive', title: '접근 거부', description: '허용된 도메인 계정으로만 로그인할 수 있습니다.'});
            await signOut(auth);
            setUser(null);
            setProfile(null);
        }
      } else {
        setUser(null);
        setProfile(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  
  const googleSignIn = async () => {
    try {
      googleProvider.setCustomParameters({
        prompt: 'select_account'
      });
      await signInWithPopup(auth, googleProvider);
      // onAuthStateChanged will handle the rest
    } catch (error: any) {
      console.error("Google Sign-In Error:", error);
      // Re-throw the error to be caught by the caller in the login page
      throw error;
    }
  };

  const logout = async () => {
    await signOut(auth);
  };
  
  const value = { user, profile, loading, profileLoading, googleSignIn, logout, fetchProfile, setProfile };

  if (loading) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-background">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <AuthContext.Provider value={value}>
        {children}
    </AuthContext.Provider>
  );
}
