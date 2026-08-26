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
  let busStudentList: any[] = [];
  let destinationList: any[] = [];
  let routeList: any[] = [];
  let busList: any[] = [];

  const mergeAndEmit = () => {
    const map = new Map<string, MasterStudent>();
    const destMap = new Map<string, string>();
    destinationList.forEach(d => {
      if (d.id) destMap.set(d.id, d.name || d.id);
    });

    const busNameMap = new Map<string, string>();
    busList.forEach(b => {
      if (b.id) busNameMap.set(b.id, b.name || b.id);
    });

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

    // 3. 스쿨버스 학생 & 목적지 & 노선 정보와 양방향 100% 통합 매칭
    map.forEach((master, key) => {
      // 1. 기존 address 값이 ID 값인 경우 정류장 실제 명칭으로 변환
      if (master.address && destMap.has(master.address)) {
        master.address = destMap.get(master.address)!;
      }

      // 이름, 학년/반, 또는 연락처/카드번호로 매칭
      const matchedBusStudent = busStudentList.find(bs => {
        const nameMatches = bs.name === master.name || bs.nameKo === master.name || (bs.name && bs.name.includes(master.name));
        const gradeClassMatches = String(bs.grade) === String(master.grade) && String(bs.class) === String(master.classNum);
        const contactMatches = master.contact && bs.contact && master.contact.replace(/\D/g, '') === bs.contact.replace(/\D/g, '');
        const kisbusNoMatches = master.kisbusNo && bs.kisbusNo && master.kisbusNo === bs.kisbusNo;
        return (nameMatches && gradeClassMatches) || (nameMatches && contactMatches) || kisbusNoMatches || nameMatches;
      });

      if (matchedBusStudent) {
        // 목적지 ID -> 목적지명 변환
        const morningDestId = matchedBusStudent.morningDestinationId || matchedBusStudent.suggestedMorningDestination || null;
        const afternoonDestId = matchedBusStudent.afternoonDestinationId || matchedBusStudent.suggestedAfternoonDestination || null;
        const destName = (morningDestId ? (destMap.get(morningDestId) || morningDestId) : null) || 
                         (afternoonDestId ? (destMap.get(afternoonDestId) || afternoonDestId) : null);

        // 등하교 목적지(주소)가 비어있거나 ID 형식이면 스쿨버스 목적지명으로 자동 연동
        if ((!master.address || destMap.has(master.address)) && destName) {
          master.address = destName;
        }

        // 스쿨버스 노선 및 배정 버스/좌석 조회
        let assignedBusName: string | null = null;
        let assignedBusId: string | null = null;
        let assignedSeatNumber: number | null = null;

        for (const route of routeList) {
          const seat = (route.seating || []).find((se: any) => se.studentId === matchedBusStudent.id);
          if (seat) {
            assignedBusId = route.busId || null;
            assignedBusName = busNameMap.get(route.busId) || null;
            assignedSeatNumber = seat.seatNumber || null;
            break;
          }
        }

        master.busSummary = {
          morningDestinationId: morningDestId,
          afternoonDestinationId: afternoonDestId,
          assignedBusId,
          assignedBusName: assignedBusName || master.busSummary?.assignedBusName || null,
          assignedSeatNumber,
          afterSchoolDestinations: matchedBusStudent.afterSchoolDestinations || {}
        };
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

  // 2. users 실시간 리스너
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

    const filtered = rawUsers.filter((u: any) => isStudentEmail(u.email));
    
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
      address: u.address || u.residenceDestinationId || '',
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

  // 3. 스쿨버스 students 실시간 리스너
  const unsubBusStudents = onSnapshot(collection(getKisbusDb(), 'students'), (snapshot) => {
    busStudentList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    mergeAndEmit();
  }, (err) => console.error('kisbus students snapshot error:', err));

  // 4. 스쿨버스 destinations 실시간 리스너
  const unsubDestinations = onSnapshot(collection(getKisbusDb(), 'destinations'), (snapshot) => {
    destinationList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    mergeAndEmit();
  }, (err) => console.error('kisbus destinations snapshot error:', err));

  // 5. 스쿨버스 routes 실시간 리스너
  const unsubRoutes = onSnapshot(collection(getKisbusDb(), 'routes'), (snapshot) => {
    routeList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    mergeAndEmit();
  }, (err) => console.error('kisbus routes snapshot error:', err));

  // 6. 스쿨버스 buses 실시간 리스너
  const unsubBuses = onSnapshot(collection(getKisbusDb(), 'buses'), (snapshot) => {
    busList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    mergeAndEmit();
  }, (err) => console.error('kisbus buses snapshot error:', err));

  return () => {
    unsubMaster();
    unsubUsers();
    unsubBusStudents();
    unsubDestinations();
    unsubRoutes();
    unsubBuses();
  };
};

// 2. 단일 마스터 학생 생성 (users & master_students & kisbus students 동시 연동)
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
        phone: studentData.contact,
        address: studentData.address || ''
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
        address: studentData.address || '',
        role: 'student'
      });
    }
  }

  // 스쿨버스 students 컬렉션에도 거주지 주소(목적지) 동기화
  if (studentData.address && studentData.name) {
    await syncAddressToKisbusStudent(studentData.name, studentData.grade, studentData.classNum, studentData.address, studentData.contact);
  }

  return docRef.id;
};

// 3. 마스터 학생 정보 수정 (기본 프로필 + users 컬렉션 + 스쿨버스 students 동시 양방향 업데이트)
export const updateMasterStudent = async (studentId: string, updateData: Partial<MasterStudent>): Promise<void> => {
  const docRef = doc(getDb(), COLLECTION_NAME, studentId);
  const now = new Date().toISOString();
  await updateDoc(docRef, {
    ...updateData,
    updatedAt: now
  });

  // users 컬렉션 동시 업데이트
  if (updateData.studentEmail || updateData.name || updateData.grade || updateData.address) {
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
      if (updateData.address !== undefined) payload.address = updateData.address;
      await updateDoc(doc(getDb(), 'users', userDoc.id), payload);
    }
  }

  // 스쿨버스 students 컬렉션 동시 양방향 동기화
  if (updateData.name || updateData.address !== undefined) {
    const name = updateData.name;
    const grade = updateData.grade;
    const classNum = updateData.classNum;
    const address = updateData.address;
    const contact = updateData.contact;
    if (name && address) {
      await syncAddressToKisbusStudent(name, grade, classNum, address, contact);
    }
  }
};

// 스쿨버스 학생 목적지 동기화 헬퍼 함수
export const syncAddressToKisbusStudent = async (
  name: string, 
  grade?: string, 
  classNum?: string, 
  address?: string | null,
  contact?: string | null
) => {
  try {
    if (!name || !address) return;
    const busDb = getKisbusDb();
    
    // 1. 목적지 목록에서 목적지 ID 조회
    const destSnap = await getDocs(collection(busDb, 'destinations'));
    const destinations = destSnap.docs.map(d => ({ id: d.id, ...d.data() }));
    const matchedDest = destinations.find((d: any) => d.name === address || d.id === address);
    const destIdToSet = matchedDest ? matchedDest.id : address;

    // 2. 스쿨버스 students 컬렉션에서 학생 조회
    const studSnap = await getDocs(collection(busDb, 'students'));
    const busStudents = studSnap.docs.map(d => ({ id: d.id, ...d.data() }));
    
    const targetStudent = busStudents.find((s: any) => {
      const nameMatches = s.name === name || s.nameKo === name || (s.name && s.name.includes(name));
      const gradeMatches = !grade || String(s.grade) === String(grade);
      const classMatches = !classNum || String(s.class) === String(classNum);
      return nameMatches && gradeMatches && classMatches;
    }) || busStudents.find((s: any) => s.name === name || s.nameKo === name);

    if (targetStudent) {
      await updateDoc(doc(busDb, 'students', targetStudent.id), {
        morningDestinationId: destIdToSet,
        afternoonDestinationId: destIdToSet,
        suggestedMorningDestination: destIdToSet,
        suggestedAfternoonDestination: destIdToSet,
        contact: contact ? contact.replace(/\D/g, '') : targetStudent.contact
      });
    }
  } catch (err) {
    console.error("Error syncing address to kisbus student:", err);
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
