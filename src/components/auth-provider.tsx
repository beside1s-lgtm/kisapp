'use client';

import { createContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { onAuthStateChanged, signInWithPopup, signOut, User as FirebaseUser } from 'firebase/auth';
import { auth, googleProvider } from '@/lib/firebase';
import { getUserProfile, saveUserProfile } from '@/app/actions';
import { UserProfile } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react';
import { ProfileModal } from './profile-modal';
import { errorEmitter } from '@/lib/error-emitter';

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
  const [showProfileModal, setShowProfileModal] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    const handlePermissionError = (error: Error) => {
      console.error(error); // Log the detailed error to the console
      toast({
        variant: 'destructive',
        title: '권한 오류',
        description: '데이터베이스 작업에 실패했습니다. 보안 규칙을 확인하세요.',
        duration: 10000,
      });
    };

    errorEmitter.on('permission-error', handlePermissionError);

    return () => {
      errorEmitter.removeListener('permission-error', handlePermissionError);
    };
  }, [toast]);


  const fetchProfile = useCallback(async (firebaseUser: FirebaseUser) => {
    setProfileLoading(true);
    try {
      let userProfile = await getUserProfile(firebaseUser.uid);
      if (!userProfile) {
        const newProfile: UserProfile = {
          name: firebaseUser.displayName || 'New User',
          role: '담당', // default role
          email: firebaseUser.email!,
          signature: '',
          isAdmin: false,
        };
        await saveUserProfile(firebaseUser.uid, firebaseUser.email!, newProfile);
        userProfile = newProfile;
        setShowProfileModal(true); // Show modal for new users
      } else if (userProfile.name === 'New User' || !userProfile.signature) {
        setShowProfileModal(true); // Show modal if profile is incomplete
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
      googleProvider.setCustomParameters({
        prompt: 'select_account'
      });
      await signInWithPopup(auth, googleProvider);
    } catch (error: any) {
      console.error("Google Sign-In Error:", error);
      let description = '로그인 중 오류가 발생했습니다.';
      if (error.code === 'auth/popup-closed-by-user') {
        description = '로그인 팝업이 닫혔습니다. 다시 시도해주세요.';
      } else if (error.code === 'auth/cancelled-popup-request') {
        description = '여러 번의 로그인 시도가 감지되었습니다. 잠시 후 다시 시도해주세요.';
      }
      toast({ variant: 'destructive', title: '로그인 실패', description: description });
    }
  };

  const logout = async () => {
    await signOut(auth);
  };
  
  const value = { user, profile, loading, profileLoading, googleSignIn, logout, setProfile };

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
        {user && profile && (
            <ProfileModal 
                isOpen={showProfileModal} 
                setIsOpen={setShowProfileModal}
            />
        )}
    </AuthContext.Provider>
  );
}
