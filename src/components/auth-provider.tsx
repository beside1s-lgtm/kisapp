'use client';

import { createContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { onAuthStateChanged, signInWithPopup, signOut, User as FirebaseUser } from 'firebase/auth';
import { auth, googleProvider } from '@/lib/firebase';
import { getUserProfile, saveUserProfile } from '@/app/actions';
import { UserProfile } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react';
import { errorEmitter } from '@/lib/error-emitter';

const ADMIN_EMAIL = 'beside1s@kshcm.net';

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
    const isHardcodedAdmin = firebaseUser.email === ADMIN_EMAIL;
    try {
      let userProfile = await getUserProfile(firebaseUser.uid);
      
      if (userProfile) {
        // If user is the hardcoded admin, ensure their admin status is always true in the context
        if (isHardcodedAdmin && !userProfile.isAdmin) {
          userProfile.isAdmin = true;
          // We don't need to save it back here, the context will reflect it.
          // The profile modal will save the correct state if changed.
        }
        setProfile(userProfile);
        return userProfile;
      } else {
        // User profile doesn't exist, this might be a new user.
        // The new login flow will deny them if they aren't pre-registered.
        // But if they are pre-registered but logging in for the first time, their profile won't exist.
        // We will create it here.
        
        // This path is now only for users that are in the user directory but logging in for the first time.
        // The onAuthStateChanged will handle non-registered users.
        const newProfile: UserProfile = {
          name: firebaseUser.displayName || 'New User',
          email: firebaseUser.email!,
          role: '담당', // This will be overwritten by DB data if it exists, otherwise it's a default.
          signature: '',
          isAdmin: isHardcodedAdmin, 
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
  }, []);
  
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setLoading(true);
      setProfileLoading(true);

      if (firebaseUser && firebaseUser.email) {
        const allowedDomains = ['@kshcm.net', '@kish.kr'];
        const isAllowedDomain = allowedDomains.some(domain => firebaseUser.email!.endsWith(domain)) || process.env.NODE_ENV === 'development';

        if (!isAllowedDomain) {
            toast({ variant: 'destructive', title: '접근 거부', description: '허용된 도메인 계정으로만 로그인할 수 있습니다.'});
            await signOut(auth);
            setUser(null);
            setProfile(null);
            setLoading(false);
            setProfileLoading(false);
            return;
        }

        // Check if user exists in our Firestore 'users' collection
        const existingProfile = await getUserProfile(firebaseUser.uid);
        const isHardcodedAdmin = firebaseUser.email === ADMIN_EMAIL;
        
        // Allow login if profile exists OR if the user is the hardcoded admin
        if (existingProfile || isHardcodedAdmin) {
            setUser(firebaseUser);
            // Fetch full profile data (this will also create if it's the admin's first login)
            await fetchProfile(firebaseUser);
        } else {
            toast({ variant: 'destructive', title: '미승인 사용자', description: '시스템에 등록된 사용자가 아닙니다. 관리자에게 문의하세요.' });
            await signOut(auth);
            setUser(null);
            setProfile(null);
        }
      } else {
        setUser(null);
        setProfile(null);
      }
      setLoading(false);
      setProfileLoading(false);
    });

    return () => unsubscribe();
  }, [fetchProfile]);
  
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
