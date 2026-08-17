import { getDb } from '@/lib/firebase';
import { getKisbusDb } from '@/lib/kisbus/firebase';
import { 
  collection, doc, onSnapshot, setDoc, updateDoc, deleteDoc, writeBatch, getDocs, query, where 
} from 'firebase/firestore';
import type { MasterStudent, NewMasterStudent } from '@/lib/types/masterStudent';

const COLLECTION_NAME = 'master_students';

// 학생 계정 이메일 정규표현식 검증 유틸 (예: 2023kangdongyun@kshcm.net - 입학년도 4자리 + 영문이름 + @kshcm.net)
const STUDENT_EMAIL_REGEX = /^\d{4}[a-zA-Z0-9._-]+@kshcm\.net$/i;

export const isStudentEmail = (email?: string | null): boolean => {
  if (!email) return false;
  const lower = email.trim().toLowerCase();
  // 교직원 및 관리자 계정 배제
  if (lower === 'beside1s@kshcm.net' || lower.startsWith('teacher') || lower.startsWith('admin')) {
    return false;
  }
  // 입학년도 4자리 + 영문이름 + @kshcm.net 규칙만 허용 (예: 2023kangdongyun@kshcm.net)
  return /^\d{4}[a-zA-Z0-9._-]+@kshcm\.net$/i.test(lower);
};

// 1. 실시간 전체 통합 학생 마스터 구독 (입학년도 규칙을 만족하는 실제 등록 학생만 수신)
export const onMasterStudentsUpdate = (callback: (students: MasterStudent[]) => void) => {
  let masterList: MasterStudent[] = [];
  let userList: MasterStudent[] = [];

  const mergeAndEmit = () => {
    const map = new Map<string, MasterStudent>();
    
    // 1. users 컬렉션 (시스템에 직접 등록된 실제 학생 계정만 필터링)
    userList.forEach(s => {
      const key = (s.studentEmail || s.studentId).toLowerCase();
      if (key && isStudentEmail(key)) {
        map.set(key, s);
      }
    });

    // 2. master_students 컬렉션 (통합 마스터 학생 DB)
    masterList.forEach(s => {
      const key = (s.studentEmail || s.studentId).toLowerCase();
      if (key && isStudentEmail(key)) {
        const existing = map.get(key);
        map.set(key, { ...existing, ...s });
      }
    });

    callback(Array.from(map.values()));
  };

  // 1. master_students 실시간 리스너
  const unsubMaster = onSnapshot(collection(getDb(), COLLECTION_NAME), (snapshot) => {
    masterList = snapshot.docs.map(doc => ({
      studentId: doc.id,
      ...doc.data()
    } as MasterStudent));
    mergeAndEmit();
  }, (err) => console.error('master_students snapshot error:', err));

  // 2. users 실시간 리스너 (시스템 설정 사용자 탭에 등록된 실제 학생 계정 100% 자동 매칭)
  const unsubUsers = onSnapshot(collection(getDb(), 'users'), (snapshot) => {
    const rawUsers = snapshot.docs.map(doc => {
      const data = doc.data();
      const userEmail = (data.email || doc.id || '').trim();
      return {
        ...data,
        docId: doc.id,
        email: userEmail
      };
    });

    // beside1s@kshcm.net 등 교직원 계정은 엄격히 제외하고, 2023kangdongyun@kshcm.net 등 실제 학생 계정만 필터링
    const filtered = rawUsers.filter((u: any) => {
      return isStudentEmail(u.email);
    });
    
    userList = filtered.map((u: any) => ({
      studentEmail: u.email,
      studentId: u.docId || u.email,
      name: u.studentName || u.name || '학생',
      grade: String(u.grade || u.studentGrade || '1'),
      classNum: String(u.class || u.studentClass || '1'),
      studentNum: String(u.number || u.studentNumber || ''),
      gender: u.gender === 'Female' || u.gender === '여' ? 'Female' : 'Male',
      contact: u.phone || u.parentPhone || u.contact || '',
      parentEmail: u.parentEmail || '',
      kisbusNo: u.kisbusNo || '',
      afterschoolSummary: {
        enrolledCourseIds: [],
        enrolledCourseTitles: [],
      },
      busSummary: {
        assignedBusName: u.busName || null,
      }
    } as MasterStudent));

    mergeAndEmit();
  }, (err) => console.error('users snapshot error:', err));

  return () => {
    unsubMaster();
    unsubUsers();
  };
};

// 2. 단일 마스터 학생 생성 (users & master_students 동시 연동)
export const createMasterStudent = async (studentData: NewMasterStudent): Promise<string> => {
  const colRef = collection(getDb(), COLLECTION_NAME);
  const docRef = doc(colRef);
  const now = new Date().toISOString();
  
  const payload: MasterStudent = {
    ...studentData,
    studentId: docRef.id,
    createdAt: now,
    updatedAt: now,
  };

  await setDoc(docRef, payload);

  // users 컬렉션에도 동시 등록/업데이트하여 연동 완벽 보장
  if (studentData.studentEmail) {
    const q = query(collection(getDb(), 'users'), where("email", "==", studentData.studentEmail.trim()));
    const snapshot = await getDocs(q);
    if (!snapshot.empty) {
      const userDoc = snapshot.docs[0];
      await updateDoc(doc(getDb(), 'users', userDoc.id), {
        studentName: studentData.name,
        grade: studentData.grade,
        class: studentData.classNum,
        number: studentData.studentNum,
        phone: studentData.contact
      });
    } else {
      const userRef = doc(collection(getDb(), 'users'));
      await setDoc(userRef, {
        email: studentData.studentEmail.trim(),
        name: studentData.name,
        studentName: studentData.name,
        grade: studentData.grade,
        class: studentData.classNum,
        number: studentData.studentNum,
        phone: studentData.contact,
        role: 'student'
      });
    }
  }

  return docRef.id;
};

// 3. 마스터 학생 정보 수정 (기본 프로필 + users 컬렉션 동시 업데이트)
export const updateMasterStudent = async (studentId: string, updateData: Partial<MasterStudent>): Promise<void> => {
  const docRef = doc(getDb(), COLLECTION_NAME, studentId);
  const now = new Date().toISOString();
  await updateDoc(docRef, {
    ...updateData,
    updatedAt: now
  });

  // users 컬렉션 동시 업데이트
  if (updateData.studentEmail || updateData.name || updateData.grade) {
    const emailToSearch = updateData.studentEmail || studentId;
    const q = query(collection(getDb(), 'users'), where("email", "==", emailToSearch.trim()));
    const snapshot = await getDocs(q);
    if (!snapshot.empty) {
      const userDoc = snapshot.docs[0];
      const payload: any = {};
      if (updateData.name) payload.studentName = updateData.name;
      if (updateData.grade) payload.grade = updateData.grade;
      if (updateData.classNum) payload.class = updateData.classNum;
      if (updateData.studentNum) payload.number = updateData.studentNum;
      if (updateData.contact) payload.phone = updateData.contact;
      await updateDoc(doc(getDb(), 'users', userDoc.id), payload);
    }
  }
};

// 4. 마스터 학생 삭제
export const deleteMasterStudent = async (studentId: string): Promise<void> => {
  const docRef = doc(getDb(), COLLECTION_NAME, studentId);
  await deleteDoc(docRef);
};

// 5. 전교생 엑셀 일괄 동기화 (Batch Import)
export const batchImportMasterStudents = async (students: NewMasterStudent[]): Promise<number> => {
  const batch = writeBatch(getDb());
  const colRef = collection(getDb(), COLLECTION_NAME);
  let count = 0;
  const now = new Date().toISOString();

  students.forEach((s) => {
    if (!isStudentEmail(s.studentEmail)) return;
    const docRef = doc(colRef);
    const payload: MasterStudent = {
      ...s,
      studentId: docRef.id,
      createdAt: now,
      updatedAt: now,
    };
    batch.set(docRef, payload);
    count++;
  });

  await batch.commit();
  return count;
};

// 6. 학년/반 일괄 진급 처리 (Grade Advancement Batch Update + Automatic Academic Year Archiving)
export const batchPromoteStudents = async (advancements: { studentEmail: string; newGrade: string; newClassNum: string; newStudentNum: string }[]): Promise<number> => {
  const batch = writeBatch(getDb());
  let count = 0;
  const currentYear = new Date().getFullYear();
  const previousAcademicYear = currentYear - 1; // 진급 전 학학년도 (예: 2025학년도)

  for (const item of advancements) {
    if (!item.studentEmail) continue;
    const qMaster = query(collection(getDb(), COLLECTION_NAME), where("studentEmail", "==", item.studentEmail.trim()));
    const snapMaster = await getDocs(qMaster);
    snapMaster.forEach(d => {
      const data = d.data();
      const existingHistory = Array.isArray(data.academicHistory) ? data.academicHistory : [];
      
      // 진급 전 기존 학학년도의 학년/반/번호 아카이브 스냅샷 보존
      const alreadyArchived = existingHistory.some((h: any) => h.academicYear === previousAcademicYear);
      let updatedHistory = existingHistory;
      if (!alreadyArchived && data.grade) {
        updatedHistory = [
          ...existingHistory,
          {
            academicYear: previousAcademicYear,
            grade: String(data.grade),
            classNum: String(data.classNum || '1'),
            studentNum: String(data.studentNum || ''),
            archivedAt: new Date().toISOString()
          }
        ];
      }

      batch.update(doc(getDb(), COLLECTION_NAME, d.id), {
        grade: item.newGrade,
        classNum: item.newClassNum,
        studentNum: item.newStudentNum,
        academicHistory: updatedHistory,
        updatedAt: new Date().toISOString()
      });
    });

    const qUser = query(collection(getDb(), 'users'), where("email", "==", item.studentEmail.trim()));
    const snapUser = await getDocs(qUser);
    snapUser.forEach(d => {
      batch.update(doc(getDb(), 'users', d.id), {
        grade: item.newGrade,
        class: item.newClassNum,
        number: item.newStudentNum
      });
    });
    count++;
  }

  await batch.commit();
  return count;
};

// 7. 이메일 기반 단일 마스터 학생 조회
export const getMasterStudentByEmail = async (email: string): Promise<MasterStudent | null> => {
  if (!email) return null;
  const q = query(collection(getDb(), COLLECTION_NAME), where("studentEmail", "==", email.trim()));
  const snapshot = await getDocs(q);
  if (snapshot.empty) return null;
  const firstDoc = snapshot.docs[0];
  return { studentId: firstDoc.id, ...firstDoc.data() } as MasterStudent;
};
