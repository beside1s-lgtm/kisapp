'use client';

import { createContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { onAuthStateChanged, signInWithPopup, signOut, User as FirebaseUser } from 'firebase/auth';
import { auth, googleProvider } from '@/lib/firebase';
import { UserProfile } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react';
import { errorEmitter } from '@/lib/error-emitter';
import { getUserProfileByEmail, saveUserProfile } from '@/app/actions';

// 관리자 이메일 하드코딩
const ADMIN_EMAIL = 'beside1s@kshcm.net';
const ALLOWED_DOMAIN = 'kshcm.net';


// --- [Context & Provider] ---

interface AuthContextType {
  user: FirebaseUser | null;
  profile: UserProfile | null;
  loading: boolean;
  profileLoading: boolean;
  googleSignIn: () => Promise<void>;
  logout: () => Promise<void>;
  fetchProfile: (user: FirebaseUser) => Promise<UserProfile | null>;
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
      console.error("Permission error:", error);
      toast({
        variant: 'destructive',
        title: '권한 오류',
        description: '작업 권한이 없습니다.',
      });
    };
    errorEmitter.on('permission-error', handlePermissionError);
    return () => { errorEmitter.removeListener('permission-error', handlePermissionError); };
  }, [toast]);

  const isDomainAllowed = (email: string | null) => {
    if (!email) return false;
    if (process.env.NODE_ENV === 'development') return true;
    const domain = email.split('@')[1]?.toLowerCase();
    return domain === ALLOWED_DOMAIN;
  };

  const fetchProfile = useCallback(async (firebaseUser: FirebaseUser): Promise<UserProfile | null> => {
    if (!firebaseUser?.email) return null;
    setProfileLoading(true);

    try {
      let userProfile = await getUserProfileByEmail(firebaseUser.email);
      const isHardcodedAdmin = firebaseUser.email === ADMIN_EMAIL;
      
      let needsSave = false;
      const profileUpdates: Partial<UserProfile> = {};

      // 1. 프로필이 없으면 -> 신규 프로필 객체 생성
      if (!userProfile) {
        console.log("No profile found. Creating new profile.");
        needsSave = true;
        userProfile = {
            uid: firebaseUser.uid,
            name: firebaseUser.displayName || '사용자',
            email: firebaseUser.email,
            role: '교사',
            signature: '',
            isAdmin: isHardcodedAdmin,
        };
      }

      // 2. UID가 다르면 -> 최신 UID로 업데이트 준비
      if (userProfile.uid !== firebaseUser.uid) {
        console.log(`UID mismatch. DB: ${userProfile.uid}, Auth: ${firebaseUser.uid}. Updating.`);
        needsSave = true;
        profileUpdates.uid = firebaseUser.uid;
        userProfile.uid = firebaseUser.uid; // 즉시 반영
      }

      // 3. 관리자 권한 강제 보정
      if (isHardcodedAdmin && !userProfile.isAdmin) {
          console.log("Forcing admin status for hardcoded admin email.");
          needsSave = true;
          profileUpdates.isAdmin = true;
          userProfile.isAdmin = true; // 즉시 반영
      }

      // 4. 변경사항이 있으면 저장
      if (needsSave) {
          const combinedUpdates = { ...userProfile, ...profileUpdates };
          const saveResult = await saveUserProfile(firebaseUser.uid, firebaseUser.email, combinedUpdates);
          if (!saveResult.success) {
               throw new Error(saveResult.error || "Failed to save updated user profile.");
          }
           // 저장 후 반환된 프로필을 최종본으로 사용
          if(saveResult.profile) {
            userProfile = saveResult.profile;
          }
      }
      
      setProfile(userProfile);
      return userProfile;

    } catch (error) {
      console.error("Critical Profile Error:", error);
      toast({
          variant: 'destructive',
          title: '프로필 로딩 실패',
          description: '프로필을 불러오는 중 심각한 오류가 발생했습니다. 잠시 후 다시 시도해주세요.',
      });
      // 비상시를 위한 최소한의 폴백 프로필
      const fallbackProfile: UserProfile = {
          uid: firebaseUser.uid,
          name: firebaseUser.displayName || 'Unknown',
          email: firebaseUser.email!,
          role: 'Guest',
          isAdmin: false,
          signature: ''
      };
      setProfile(fallbackProfile);
      return fallbackProfile;
    } finally {
      setProfileLoading(false);
    }
  }, [toast]); 

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser && firebaseUser.email) {
        if (!isDomainAllowed(firebaseUser.email)) {
          toast({ variant: 'destructive', title: '로그인 실패', description: '허용되지 않은 도메인입니다.' });
          await signOut(auth);
          setUser(null);
          setProfile(null);
        } else {
          setUser(firebaseUser);
          await fetchProfile(firebaseUser);
        }
      } else {
        setUser(null);
        setProfile(null);
      }
      setLoading(false);
      setProfileLoading(false);
    });

    return () => unsubscribe();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const googleSignIn = async () => {
    try {
      googleProvider.setCustomParameters({ prompt: 'select_account' });
      await signInWithPopup(auth, googleProvider);
    } catch (error: any) {
      console.error("Login Error:", error);
      if (error.code === 'auth/popup-closed-by-user' || error.code === 'auth/cancelled-popup-request') {
        // 사용자가 팝업을 닫은 경우엔 조용히 처리
        return;
      }
      toast({ variant: 'destructive', title: '로그인 오류', description: error.message });
    }
  };

  const logout = async () => {
    await signOut(auth);
    setUser(null);
    setProfile(null);
  };

  const value = { user, profile, loading, profileLoading, googleSignIn, logout, fetchProfile };

  if (loading) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-background">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
