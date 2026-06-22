import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  writeBatch,
  deleteDoc as firestoreDeleteDoc,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { UserProfile, Approver } from '@/lib/types';
import * as xlsx from 'xlsx';
import { getOrgStructure } from '@/lib/services/settingsService';

const getUsersCol = () => collection(db, 'users');

export async function getUserProfileByEmail(email: string): Promise<UserProfile | null> {
  if (!email) return null;
  const userDocRef = doc(getUsersCol(), email.toLowerCase());
  try {
    const snap = await getDoc(userDocRef);
    if (!snap.exists()) return null;
    const data = snap.data();
    return {
      name: data?.name || '',
      role: data?.role || '',
      signature: data?.signature || '',
      uid: data?.uid || '',
      email: snap.id,
      isAdmin: data?.isAdmin || false,
      parentPhone: data?.parentPhone ?? null,
      parentSignature: data?.parentSignature ?? null,
      hashedPin: data?.hashedPin ?? null,
      parentName: data?.parentName ?? null,
      studentName: data?.studentName ?? null,
      studentGrade: data?.studentGrade ?? null,
      studentClass: data?.studentClass ?? null,
      studentNumber: data?.studentNumber ?? null,
    };
  } catch (error) {
    console.error(`[UserService] getUserProfileByEmail error:`, error);
    return null;
  }
}

export async function saveUserProfile(userId: string, email: string, profileData: Partial<UserProfile>) {
  if (!email || !profileData) return { success: false, error: 'Invalid data' };
  const userProfileRef = doc(getUsersCol(), email.toLowerCase());
  try {
    const docSnap = await getDoc(userProfileRef);
    
    // undefined 필드 제거 방어 코드
    const dataToSave: any = {};
    Object.entries(profileData).forEach(([key, val]) => {
      if (val !== undefined) {
        dataToSave[key] = val;
      }
    });
    
    if (!docSnap.exists() && userId) {
      dataToSave.uid = userId;
    }
    
    await setDoc(userProfileRef, dataToSave, { merge: true });
    const finalProfileSnap = await getDoc(userProfileRef);
    const finalData = finalProfileSnap.data() as UserProfile;

    return { 
      success: true, 
      profile: { ...finalData, email: finalProfileSnap.id, uid: finalData.uid || userId }
    };
  } catch (error: any) {
    return { success: false, error: `저장 실패: ${error.message}` };
  }
}

export async function getUsersDirectory(): Promise<UserProfile[]> {
  try {
    const snapshot = await getDocs(getUsersCol());
    if (snapshot.empty) return [];
    return snapshot.docs.map((d: any) => {
      const data = d.data();
      return {
        email: d.id,
        uid: data.uid,
        name: data.name,
        role: data.role,
        signature: data.signature,
        isAdmin: data.isAdmin,
        parentPhone: data.parentPhone,
        parentSignature: data.parentSignature,
        hashedPin: data.hashedPin,
      } as UserProfile;
    });
  } catch (error) {
    console.error("[UserService] getUsersDirectory failed:", error);
    return [];
  }
}

export async function bulkRegisterUsers(fileData: string) {
  try {
    const base64Data = fileData.split(',')[1];
    const buffer = Buffer.from(base64Data, 'base64');
    const workbook = xlsx.read(buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const users = xlsx.utils.sheet_to_json(worksheet) as { email: string; name: string; role: string }[];
    
    if (!users.length) return { success: false, error: '엑셀 파일에 데이터가 없습니다.' };

    const batch = writeBatch(db);
    let count = 0;

    for (const user of users) {
      if (user.email && user.name && user.role) {
        const userRef = doc(db, "users", user.email.toLowerCase());
        batch.set(userRef, {
          name: user.name,
          role: user.role,
          email: user.email.toLowerCase(),
          isAdmin: false,
          signature: '',
        }, { merge: true });
        count++;
      }
    }
    await batch.commit();
    return { success: true, summary: `${count}명의 사용자가 등록/업데이트되었습니다.` };
  } catch (error: any) {
    return { success: false, error: `일괄 등록 실패: ${error.message}` };
  }
}

export async function deleteUser(email: string) {
  if (!email) return { success: false, error: '이메일이 제공되지 않았습니다.' };
  try {
    const userRef = doc(getUsersCol(), email.toLowerCase());
    await firestoreDeleteDoc(userRef);
    return { success: true };
  } catch (error: any) {
    console.error('[UserService] deleteUser failed:', error);
    return { success: false, error: `사용자 삭제 중 오류: ${error.message}` };
  }
}

export async function resetParentAuth(email: string) {
  if (!email) return { success: false, error: '이메일이 제공되지 않았습니다.' };
  try {
    const userRef = doc(getUsersCol(), email.toLowerCase());
    await setDoc(userRef, {
      parentPhone: null,
      parentSignature: null,
      hashedPin: null,
    }, { merge: true });
    return { success: true };
  } catch (error: any) {
    return { success: false, error: `인증 정보 초기화 중 오류: ${error.message}` };
  }
}

export async function getApproversByGradeClass(grade: string, studentClass: string, isFieldTrip: boolean = false): Promise<Approver[]> {
  const org = await getOrgStructure();
  const approvers: Approver[] = [];
  
  const gradeClassKey = `${grade}-${studentClass}`;
  
  // 1차 결재: 담임 선생님
  const homeroomEmail = org.homerooms?.[gradeClassKey];
  if (!homeroomEmail) {
    throw new Error(`선택하신 학년/반(${grade}학년 ${studentClass}반)의 담당 교사가 아직 배정되지 않았습니다. 학교 관리자에게 문의해 주세요.`);
  }
  const homeroomUser = await getUserProfileByEmail(homeroomEmail);
  if (!homeroomUser) {
    throw new Error(`배정된 담임 교사(${homeroomEmail})의 계정을 찾을 수 없습니다. 학교 관리자에게 문의해 주세요.`);
  }

  approvers.push({
    name: homeroomUser.name,
    email: homeroomUser.email,
    role: '담임',
    type: 'normal',
    status: 'pending',
  });
  
  // 2차 결재: 부장 선생님
  const headEmail = org.gradeHeads?.[grade];
  if (!headEmail) {
    throw new Error(`${grade}학년 부장 교사가 아직 배정되지 않았습니다. 학교 관리자에게 문의해 주세요.`);
  }
  const headUser = await getUserProfileByEmail(headEmail);
  if (!headUser) {
    throw new Error(`배정된 학년 부장 교사(${headEmail})의 계정을 찾을 수 없습니다. 학교 관리자에게 문의해 주세요.`);
  }

  approvers.push({
    name: headUser.name,
    email: headUser.email,
    role: '부장',
    type: isFieldTrip ? 'normal' : 'final',
    status: 'pending',
  });
  
  // 3차 결재: 교감 선생님 (체험학습일 경우에만 전결)
  if (isFieldTrip) {
    const vpEmail = org.vicePrincipal;
    if (!vpEmail) {
      throw new Error(`교감 선생님이 아직 배정되지 않았습니다. 학교 관리자에게 문의해 주세요.`);
    }
    const vpUser = await getUserProfileByEmail(vpEmail);
    if (!vpUser) {
      throw new Error(`배정된 교감 선생님(${vpEmail})의 계정을 찾을 수 없습니다. 학교 관리자에게 문의해 주세요.`);
    }

    approvers.push({
      name: vpUser.name,
      email: vpUser.email,
      role: '교감',
      type: 'final',
      status: 'pending',
    });
  }
  
  return approvers;
}
