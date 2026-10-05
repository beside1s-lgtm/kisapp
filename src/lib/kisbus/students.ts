import { getKisbusDb as db } from './firebase';
import { collection, doc, writeBatch, updateDoc, onSnapshot, query, getDocs, getDoc, setDoc } from 'firebase/firestore';
import type { Student, NewStudent, Destination } from './types';
import { fetchCollection, onCollectionUpdate, addDocument } from './core';
import { sanitizeDataForSystem } from './utils';
import { errorEmitter } from '@/lib/error-emitter';
import { FirestorePermissionError, type SecurityRuleContext } from '@/lib/errors';

import { getDb } from '@/lib/firebase';

export const getStudents = () => fetchCollection<Student>('students');
export const onStudentsUpdate = (callback: (students: Student[]) => void) => onCollectionUpdate<Student>('students', callback);

// 스쿨버스 학생 정보 변경 시 통합 마스터 학생(master_students & users)으로 양방향 실시간 동기화
export const syncKisbusStudentToMaster = async (studentId: string, updatedData: Partial<Student>) => {
    try {
        const busDb = db();
        const mainDb = getDb();
        
        // 1. 현재 학생 데이터 조회
        const sSnap = await getDoc(doc(busDb, 'students', studentId));
        if (!sSnap.exists()) return;
        const student = { id: sSnap.id, ...sSnap.data(), ...updatedData } as Student;
        
        const destId = updatedData.morningDestinationId || updatedData.afternoonDestinationId || updatedData.suggestedMorningDestination || student.morningDestinationId || student.afternoonDestinationId;
        
        let destName: string | null = null;
        if (destId) {
            const destSnap = await getDocs(collection(busDb, 'destinations'));
            const destinations = destSnap.docs.map(d => ({ id: d.id, ...d.data() }));
            const matched = destinations.find((d: any) => d.id === destId || (d as any).name === destId) as any;
            destName = matched ? (matched.name || destId) : destId;
        }

        const studentNumber = (updatedData as any).number || (updatedData as any).studentNum || student.number || (student as any).studentNum || null;
        const studentEmail = (student.studentEmail || '').toLowerCase().trim();
        const studentName = (student.nameKo || student.name || '').trim();
        const studentGrade = String(student.grade || '').trim();
        const studentClass = String(student.class || student.classNum || '').trim();

        // 2. master_students 컬렉션 동기화
        const masterSnap = await getDocs(collection(mainDb, 'master_students'));
        masterSnap.forEach(async (mDoc) => {
            const mData = mDoc.data();
            const mEmail = (mData.studentEmail || '').toLowerCase().trim();
            const mName = (mData.name || mData.nameKo || '').trim();
            const mGrade = String(mData.grade || '').trim();
            const mClass = String(mData.classNum || '').trim();

            const emailMatches = Boolean(studentEmail && mEmail && studentEmail === mEmail);
            const nameGradeClassMatches = Boolean(studentName && mName === studentName && studentGrade === mGrade && (!studentClass || studentClass === mClass));
            const nameGradeMatches = Boolean(studentName && mName === studentName && studentGrade === mGrade);

            if (emailMatches || nameGradeClassMatches || nameGradeMatches) {
                const masterUpdates: any = {
                    updatedAt: new Date().toISOString()
                };
                if (destName) masterUpdates.address = destName;
                if (studentNumber) masterUpdates.studentNum = String(studentNumber);
                if (student.contact) masterUpdates.contact = student.contact;
                if (student.gender) masterUpdates.gender = student.gender;
                if (student.grade) masterUpdates.grade = String(student.grade);
                if (student.class || student.classNum) masterUpdates.classNum = String(student.class || student.classNum);

                await updateDoc(doc(mainDb, 'master_students', mDoc.id), masterUpdates).catch(() => {});
            }
        });

        // 3. users 컬렉션 동기화
        const userSnap = await getDocs(collection(mainDb, 'users'));
        userSnap.forEach(async (uDoc) => {
            const uData = uDoc.data();
            const uEmail = (uData.email || uDoc.id || '').toLowerCase().trim();
            const uName = (uData.studentName || uData.name || '').trim();
            const uGrade = String(uData.grade || uData.studentGrade || '').trim();
            const uClass = String(uData.class || uData.classNum || uData.studentClass || '').trim();

            const emailMatches = Boolean(studentEmail && uEmail && studentEmail === uEmail);
            const nameGradeClassMatches = Boolean(studentName && uName === studentName && studentGrade === uGrade && (!studentClass || studentClass === uClass));
            const nameGradeMatches = Boolean(studentName && uName === studentName && studentGrade === uGrade);

            if (emailMatches || nameGradeClassMatches || nameGradeMatches) {
                const userUpdates: any = {};
                if (destName) userUpdates.address = destName;
                if (studentNumber) {
                    userUpdates.number = String(studentNumber);
                    userUpdates.studentNumber = String(studentNumber);
                }
                if (student.contact) {
                    userUpdates.phone = student.contact;
                    userUpdates.parentPhone = student.contact;
                }
                if (student.gender) userUpdates.gender = student.gender;
                if (student.grade) {
                    userUpdates.grade = String(student.grade);
                    userUpdates.studentGrade = String(student.grade);
                }
                if (student.class || student.classNum) {
                    userUpdates.class = String(student.class || student.classNum);
                    userUpdates.studentClass = String(student.class || student.classNum);
                }

                if (Object.keys(userUpdates).length > 0) {
                    await updateDoc(doc(mainDb, 'users', uDoc.id), userUpdates).catch(() => {});
                }
            }
        });
    } catch (err) {
        console.error("Error syncing kisbus student to master:", err);
    }
};

// 하위 호환성 유지 별칭
const syncKisbusDestinationToMasterAddress = syncKisbusStudentToMaster;


export const addStudent = async (student: NewStudent) => {
    const docRef = doc(collection(db(), 'students'));
    const sanitizedName = sanitizeDataForSystem(student.name);
    const sanitizedContact = student.contact?.replace(/\D/g, '') || null;
    const data = { 
        ...student, 
        name: sanitizedName, 
        contact: sanitizedContact 
    };
    await setDoc(docRef, data).catch(async (serverError) => {
        const permissionError = new FirestorePermissionError({ path: docRef.path, operation: 'create', requestResourceData: data } satisfies SecurityRuleContext);
        errorEmitter.emit('permission-error', permissionError);
        throw serverError;
    });
    
    syncKisbusDestinationToMasterAddress(docRef.id, data).catch(console.error);
    return { id: docRef.id, ...data } as Student;
};

export const updateStudent = async (studentId: string, data: Partial<Student>) => {
    const docRef = doc(db(), 'students', studentId);
    const updateData = { ...data };
    if (updateData.name) updateData.name = sanitizeDataForSystem(updateData.name);
    if (updateData.contact) updateData.contact = updateData.contact.replace(/\D/g, '') || null;
    await updateDoc(docRef, updateData).catch(async (serverError) => {
        const permissionError = new FirestorePermissionError({ path: docRef.path, operation: 'update', requestResourceData: data } satisfies SecurityRuleContext);
        errorEmitter.emit('permission-error', permissionError);
        throw serverError;
    });
    
    syncKisbusDestinationToMasterAddress(studentId, updateData).catch(console.error);
};

export const deleteStudentsInBatch = async (ids: string[]) => {
    const batch = writeBatch(db());
    ids.forEach(id => batch.delete(doc(db(), 'students', id)));
    await batch.commit().catch(serverError => {
        errorEmitter.emit('permission-error', new FirestorePermissionError({ path: '/students', operation: 'delete' }));
        throw serverError;
    });
};

export const updateStudentsInBatch = async (updates: { id: string, data: Partial<Student> }[]) => {
    const batch = writeBatch(db());
    updates.forEach(u => batch.update(doc(db(), 'students', u.id), u.data));
    await batch.commit().catch(serverError => {
        errorEmitter.emit('permission-error', new FirestorePermissionError({ path: '/students', operation: 'update' }));
        throw serverError;
    });
};

export const upsertStudent = async (student: Partial<Student> & { id?: string }) => {
    const docRef = student.id ? doc(db(), 'students', student.id) : doc(collection(db(), 'students'));
    const data = { ...student };
    delete data.id;
    
    if (data.name) data.name = sanitizeDataForSystem(data.name);
    if (data.nameKo) data.nameKo = sanitizeDataForSystem(data.nameKo);
    if (data.nameEn) data.nameEn = sanitizeDataForSystem(data.nameEn);
    if (data.contact) data.contact = data.contact.replace(/\D/g, '') || null;
    
    await setDoc(docRef, data, { merge: true }).catch(async (serverError) => {
        const permissionError = new FirestorePermissionError({ path: docRef.path, operation: 'write', requestResourceData: data } satisfies SecurityRuleContext);
        errorEmitter.emit('permission-error', permissionError);
        throw serverError;
    });
    return { id: docRef.id, ...data } as Student;
};

/**
 * 방과후 수강 신청 학생의 하교 버스를 숨김 처리합니다.
 * afternoonDestinationId 값을 _hiddenAfternoonDestId로 이동(백업)하고 원본은 null로 설정합니다.
 * 실제 하교 노선 배차표에서 해당 학생이 보이지 않게 됩니다.
 */
export const hideAfternoonBusForStudent = async (studentId: string): Promise<void> => {
    if (!studentId) return;
    const docRef = doc(db(), 'students', studentId);
    const snap = await getDocs(query(collection(db(), 'students')));
    const studentDoc = snap.docs.find(d => d.id === studentId);
    if (!studentDoc) return;

    const data = studentDoc.data() as Student;
    const currentAfternoonId = data.afternoonDestinationId;
    // 이미 숨김 처리된 경우 중복 처리 방지
    if (!currentAfternoonId && (data as any)._hiddenAfternoonDestId) return;

    const updatePayload: Record<string, any> = {
        _hiddenAfternoonDestId: currentAfternoonId || null,
        afternoonDestinationId: null,
    };

    await updateDoc(docRef, updatePayload).catch(async (serverError) => {
        const permissionError = new FirestorePermissionError({ path: docRef.path, operation: 'update', requestResourceData: updatePayload } satisfies SecurityRuleContext);
        errorEmitter.emit('permission-error', permissionError);
        throw serverError;
    });
};

/**
 * 방과후 수강이 종료된 학생의 하교 버스를 복원합니다.
 * _hiddenAfternoonDestId를 다시 afternoonDestinationId로 복원하고 백업 필드는 제거합니다.
 */
export const restoreAfternoonBusForStudent = async (studentId: string): Promise<void> => {
    if (!studentId) return;
    const snap = await getDocs(query(collection(db(), 'students')));
    const studentDoc = snap.docs.find(d => d.id === studentId);
    if (!studentDoc) return;

    const data = studentDoc.data() as any;
    const hiddenDestId = data._hiddenAfternoonDestId;

    const docRef = doc(db(), 'students', studentId);
    const updatePayload: Record<string, any> = {
        afternoonDestinationId: hiddenDestId || null,
        _hiddenAfternoonDestId: null,
    };

    await updateDoc(docRef, updatePayload).catch(async (serverError) => {
        const permissionError = new FirestorePermissionError({ path: docRef.path, operation: 'update', requestResourceData: updatePayload } satisfies SecurityRuleContext);
        errorEmitter.emit('permission-error', permissionError);
        throw serverError;
    });
};

/**
 * 학부모 초기 등록 또는 프로필 설정에서 지정한 등하교 목적지(스쿨버스 정류장/주소)를
 * 스쿨버스 학생(students) 및 마스터 학생(master_students)에 실시간 연동/동기화합니다.
 */
export async function syncParentResidenceToKisbus(params: {
  studentName: string;
  studentGrade: string;
  studentClass: string;
  studentNumber?: string;
  phone?: string;
  parentEmail?: string;
  residenceDestinationId?: string | null;
  address?: string | null;
}): Promise<void> {
  const {
    studentName,
    studentGrade,
    studentClass,
    studentNumber,
    phone,
    parentEmail,
    residenceDestinationId,
    address,
  } = params;

  if (!studentName) return;

  try {
    const busDb = db();
    const mainDb = getDb();

    const cleanName = studentName.trim();
    const cleanGrade = String(studentGrade || '').trim();
    const cleanClass = String(studentClass || '').trim();
    const cleanPhone = phone ? phone.replace(/\D/g, '') : null;
    const cleanEmail = parentEmail ? parentEmail.toLowerCase().trim() : null;

    // 1. 정류장 이름 조회 (ID가 주어졌을 때)
    let destName = address ? address.trim() : null;
    let destId = residenceDestinationId || null;

    if (destId && !destName) {
      try {
        const destSnap = await getDoc(doc(busDb, 'destinations', destId));
        if (destSnap.exists()) {
          destName = (destSnap.data() as Destination).name || destId;
        }
      } catch (err) {
        console.warn('[syncParentResidence] Failed to fetch destination name:', err);
      }
    } else if (!destId && destName) {
      // 거꾸로 이름만 있는 경우 목적지 ID 역조회
      try {
        const allDestSnap = await getDocs(collection(busDb, 'destinations'));
        const found = allDestSnap.docs.find(d => (d.data() as Destination).name === destName);
        if (found) {
          destId = found.id;
        }
      } catch (err) {
        console.warn('[syncParentResidence] Failed to reverse-match destination id:', err);
      }
    }

    // 2. kisbus students 컬렉션에서 학생 매칭
    const busStudentsSnap = await getDocs(collection(busDb, 'students'));
    let matchedBusStudent: { id: string; data: Student } | null = null;

    for (const d of busStudentsSnap.docs) {
      const s = d.data() as Student;
      const sName = (s.nameKo || s.name || '').trim();
      const sGrade = String(s.grade || '').trim();
      const sClass = String(s.class || s.classNum || '').trim();
      const sContact = (s.contact || '').replace(/\D/g, '');
      const sParentEmail = (s.parentEmail || '').toLowerCase().trim();

      // 조건 1: 이름 + 학년 + 반 일치 (최우선)
      if (sName === cleanName && sGrade === cleanGrade && (!cleanClass || sClass === cleanClass)) {
        matchedBusStudent = { id: d.id, data: s };
        break;
      }
      // 조건 2: 이름 + 학부모 이메일 일치
      if (cleanEmail && sParentEmail === cleanEmail && sName === cleanName) {
        matchedBusStudent = { id: d.id, data: s };
        break;
      }
      // 조건 3: 이름 + 연락처 일치
      if (cleanPhone && sContact && sContact === cleanPhone && sName === cleanName) {
        matchedBusStudent = { id: d.id, data: s };
        break;
      }
    }

    if (matchedBusStudent) {
      // 기존 스쿨버스 학생 레코드 업데이트
      const updatePayload: Record<string, any> = {
        updatedAt: new Date().toISOString(),
      };
      if (destId) {
        updatePayload.morningDestinationId = destId;
        updatePayload.afternoonDestinationId = destId;
      }
      if (destName) {
        updatePayload.suggestedMorningDestination = destName;
        updatePayload.suggestedAfternoonDestination = destName;
      }
      if (cleanPhone) updatePayload.contact = cleanPhone;
      if (cleanEmail) updatePayload.parentEmail = cleanEmail;
      if (studentNumber) updatePayload.number = String(studentNumber);

      await updateDoc(doc(busDb, 'students', matchedBusStudent.id), updatePayload).catch(err => {
        console.warn('[syncParentResidence] update bus student failed:', err);
      });
    } else if (destId || destName) {
      // 스쿨버스 학생 목록에 없으나 목적지를 등록한 경우 새 학생 레코드 등록
      const newStudentPayload: any = {
        name: cleanName,
        nameKo: cleanName,
        grade: cleanGrade,
        class: cleanClass,
        number: studentNumber ? String(studentNumber) : null,
        contact: cleanPhone,
        parentEmail: cleanEmail,
        morningDestinationId: destId,
        afternoonDestinationId: destId,
        suggestedMorningDestination: destName,
        suggestedAfternoonDestination: destName,
        afterSchoolDestinations: {},
        gender: 'Male',
        applicationStatus: 'pending',
        createdAt: new Date().toISOString(),
      };
      await addDocument('students', newStudentPayload).catch(err => {
        console.warn('[syncParentResidence] add new bus student failed:', err);
      });
    }

    // 3. master_students 컬렉션 동기화
    if (destName || cleanPhone) {
      const masterSnap = await getDocs(collection(mainDb, 'master_students'));
      for (const mDoc of masterSnap.docs) {
        const mData = mDoc.data();
        const mName = (mData.name || mData.nameKo || '').trim();
        const mGrade = String(mData.grade || '').trim();
        const mClass = String(mData.classNum || '').trim();

        if (mName === cleanName && mGrade === cleanGrade && (!cleanClass || mClass === cleanClass)) {
          const mUpdates: any = { updatedAt: new Date().toISOString() };
          if (destName) mUpdates.address = destName;
          if (cleanPhone) mUpdates.contact = cleanPhone;
          if (studentNumber) mUpdates.studentNum = String(studentNumber);
          await updateDoc(doc(mainDb, 'master_students', mDoc.id), mUpdates).catch(() => {});
        }
      }
    }
  } catch (err) {
    console.error('[syncParentResidenceToKisbus] 전체 동기화 오류 (논블로킹):', err);
  }
}


