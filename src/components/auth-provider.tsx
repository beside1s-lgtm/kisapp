'use client';

import { createContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { onAuthStateChanged, signInWithPopup, signOut, User as FirebaseUser } from 'firebase/auth';
import { auth, googleProvider } from '@/lib/firebase';
import { UserProfile } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react';
import { errorEmitter } from '@/lib/error-emitter';
import { getUserProfileByEmail, saveUserProfile } from '@/lib/services/userService';

const ADMIN_EMAIL = 'beside1s@kshcm.net';

// --- [Context & Provider] ---

interface AuthContextType {
  user: FirebaseUser | null;
  profile: UserProfile | null;
  loading: boolean;
  profileLoading: boolean;
  googleSignIn: () => Promise<void>;
  logout: () => Promise<void>;
  fetchProfile: (user: FirebaseUser) => Promise<UserProfile | null>;
  isParent: boolean;
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

  const isStudentPattern = (email: string | null) => {
    if (!email) return false;
    if (process.env.NODE_ENV === 'development' && email.includes('student')) return true; // dev 환경 폴백
    // 이메일 앞부분이 숫자 4자리로 시작하고, 도메인이 @kshcm.net인지 검사
    return /^\d{4}[a-zA-Z0-9._-]+@kshcm\.net$/.test(email);
  };

  const fetchProfile = useCallback(async (firebaseUser: FirebaseUser): Promise<UserProfile | null> => {
    if (!firebaseUser?.email) return null;
    setProfileLoading(true);

    try {
      let userProfile = await getUserProfileByEmail(firebaseUser.email);
      const isHardcodedAdmin = firebaseUser.email === ADMIN_EMAIL;
      
      let needsSave = false;
      const profileUpdates: Partial<UserProfile> = {};

      // 1. 프로필이 없으면 (즉, users 컬렉션에 없는 경우) -> 학생 패턴인지 확인
      if (!userProfile) {
        if (isStudentPattern(firebaseUser.email)) {
          console.log("No profile found, but matches student pattern. Creating parent profile.");
          needsSave = true;
          userProfile = {
              uid: firebaseUser.uid,
              name: firebaseUser.displayName || '사용자',
              email: firebaseUser.email,
              role: '학부모',
              signature: '',
              isAdmin: isHardcodedAdmin,
          };
        } else {
          // DB에도 없고 학생 패턴도 아니면 차단 (등록되지 않은 교직원이거나 외부 계정)
          throw new Error("unregistered_account");
        }
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

    } catch (error: any) {
      if (error.message === "unregistered_account") {
        throw error; // onAuthStateChanged 로 에러 전파하여 로그아웃 처리
      }
      console.error("Critical Profile Error:", error);
      toast({
          variant: 'destructive',
          title: '프로필 로딩 실패',
          description: '프로필을 불러오는 중 심각한 오류가 발생했습니다. 잠시 후 다시 시도해주세요.',
      });
      return null;
    } finally {
      setProfileLoading(false);
    }
  }, [toast]); 

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setLoading(true);
      setProfileLoading(true);
      if (firebaseUser && firebaseUser.email) {
        const isKshcmDomain = firebaseUser.email.endsWith('@kshcm.net') || (process.env.NODE_ENV === 'development');
        
        if (!isKshcmDomain) {
          toast({ variant: 'destructive', title: '로그인 실패', description: '올바른 학교 계정(@kshcm.net)이 아닙니다.' });
          await signOut(auth);
          setUser(null);
          setProfile(null);
          setProfileLoading(false);
        } else {
          try {
            const fetchedProfile = await fetchProfile(firebaseUser);
            if (fetchedProfile) {
              setUser(firebaseUser);
            } else {
              toast({ variant: 'destructive', title: '로그인 실패', description: '등록되지 않은 계정이거나 올바른 학교 계정이 아닙니다.' });
              await signOut(auth);
              setUser(null);
              setProfile(null);
            }
          } catch (e: any) {
            if (e.message === "unregistered_account") {
              toast({ variant: 'destructive', title: '로그인 실패', description: '등록되지 않은 계정이거나 올바른 학교 계정이 아닙니다.' });
              await signOut(auth);
              setUser(null);
              setProfile(null);
            }
          }
        }
      } else {
        setUser(null);
        setProfile(null);
        setProfileLoading(false);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, [fetchProfile, toast]);

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

  const isParent = profile?.role === '학부모';

  const value = { user, profile, loading, profileLoading, googleSignIn, logout, fetchProfile, isParent };

  if (loading) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-background">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
