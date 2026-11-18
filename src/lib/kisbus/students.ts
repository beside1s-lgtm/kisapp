import { getKisbusDb as db } from './firebase';
import { collection, doc, writeBatch, updateDoc, onSnapshot, query, where, getDocs, getDoc, setDoc } from 'firebase/firestore';
import type { Student, NewStudent, Destination } from './types';
import { fetchCollection, onCollectionUpdate, addDocument } from './core';
import { sanitizeDataForSystem } from './utils';
import { errorEmitter } from '@/lib/error-emitter';
import { FirestorePermissionError, type SecurityRuleContext } from '@/lib/errors';

import { getDb } from '@/lib/firebase';
import { getMasterStudentIndex } from '@/lib/students/masterStudentResolver';
import { resolveMasterStudentId, type StudentHint } from '@/lib/students/masterStudentKey';

export const getStudents = () => fetchCollection<Student>('students');
export const onStudentsUpdate = (callback: (students: Student[]) => void) => onCollectionUpdate<Student>('students', callback);

// 스쿨버스 학생 정보 변경 시 통합 마스터 학생(master_students & users)으로 양방향 실시간 동기화
// 통합학생계정이 관리하는 항목(이름·학년·반·번호·성별·연락처·목적지)이 바뀐 경우에만 반영
const BUS_PROFILE_KEYS = ['nameKo', 'nameEn', 'grade', 'class', 'classNum', 'number', 'studentNum', 'gender', 'contact', 'morningDestinationId', 'afternoonDestinationId', 'suggestedMorningDestination'];

export const syncKisbusStudentToMaster = async (studentId: string, updatedData: Partial<Student>) => {
    if (!updatedData || !BUS_PROFILE_KEYS.some(k => (updatedData as any)[k] !== undefined)) return;
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

        // 2. 대상 통합학생 1명 특정 (공통 학생 키 → 이메일 → 이름+학년+반(+번호)이 한 명일 때)
        //    이름·학년만 같은 여러 학생을 한꺼번에 덮어쓰지 않는다.
        const prev = sSnap.data() as any;
        const index = await getMasterStudentIndex();
        const tryResolve = (hint: StudentHint) => resolveMasterStudentId(hint, index).id || '';
        const masterId =
            tryResolve({ masterStudentId: (student as any).masterStudentId, email: studentEmail, name: studentName, grade: studentGrade, classNum: studentClass, studentNum: studentNumber }) ||
            tryResolve({ name: prev?.nameKo || prev?.name, grade: prev?.grade, classNum: prev?.class ?? prev?.classNum, studentNum: prev?.number ?? prev?.studentNum });
        if (!masterId) {
            console.warn(`[kisbus] 통합학생계정에서 ${studentName}(${studentGrade}-${studentClass}) 학생을 한 명으로 특정하지 못해 역동기화를 건너뜁니다.`);
            return;
        }

        // 버스 학생에 공통 학생 키 기록
        if ((student as any).masterStudentId !== masterId) {
            await updateDoc(doc(busDb, 'students', studentId), { masterStudentId: masterId }).catch(() => {});
        }

        // 3. 이번에 바뀐 항목만 통합학생계정에 저장 (버스 문서의 다른 오래된 값으로 덮어쓰지 않음)
        //    통합학생계정 저장 창구(updateMasterStudent)가 학생 계정·학부모·방과후에 다시 내려보내고 이력을 남긴다.
        const has = (k: string) => Object.prototype.hasOwnProperty.call(updatedData, k) && (updatedData as any)[k] !== undefined;
        const patch: Record<string, any> = {};
        if (destName && (has('morningDestinationId') || has('afternoonDestinationId') || has('suggestedMorningDestination'))) patch.address = destName;
        if ((has('number') || has('studentNum')) && studentNumber) patch.studentNum = String(studentNumber);
        if (has('contact')) patch.contact = (updatedData as any).contact || '';
        if (has('gender') && (updatedData as any).gender) patch.gender = (updatedData as any).gender;
        if (has('grade') && (updatedData as any).grade) patch.grade = String((updatedData as any).grade);
        if ((has('class') || has('classNum')) && studentClass) patch.classNum = studentClass;
        if (has('nameKo') && String((updatedData as any).nameKo || '').trim()) patch.name = String((updatedData as any).nameKo).trim();
        if (has('nameEn') && String((updatedData as any).nameEn || '').trim()) patch.nameEn = String((updatedData as any).nameEn).trim();
        if (Object.keys(patch).length === 0) return;

        const { updateMasterStudent } = await import('@/lib/services/masterStudentService');
        await updateMasterStudent(masterId, patch as any, { source: 'bus', skipBus: true });
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
    // 일괄 수정도 통합학생계정에 반영 (순차 처리로 동시 쓰기 폭주 방지, 실패는 기록만)
    void (async () => {
        for (const u of updates) await syncKisbusStudentToMaster(u.id, u.data).catch(console.error);
    })();
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
    syncKisbusStudentToMaster(docRef.id, data).catch(console.error);
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
  /** 공통 학생 키 (알고 있으면 전달) */
  masterStudentId?: string | null;
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

    // 2. 공통 학생 키(통합학생 ID) 확인 → kisbus students 컬렉션에서 학생 매칭
    const masterId = resolveMasterStudentId({
      masterStudentId: params.masterStudentId,
      name: cleanName,
      grade: cleanGrade,
      classNum: cleanClass,
      studentNum: studentNumber,
    }, await getMasterStudentIndex()).id || '';

    const busStudentsSnap = await getDocs(collection(busDb, 'students'));
    let matchedBusStudent: { id: string; data: Student } | null = null;

    const busDocs = busStudentsSnap.docs.map(d => ({ id: d.id, data: d.data() as Student }));
    // 다른 학생 키가 이미 붙은 버스 학생은 후보에서 제외
    const candidates = busDocs.filter(b => !(masterId && (b.data as any).masterStudentId && (b.data as any).masterStudentId !== masterId));
    const sameName = (s: Student) => (s.nameKo || s.name || '').replace(/\s+/g, '') === cleanName.replace(/\s+/g, '');
    const pickOne = (list: typeof busDocs) => (list.length === 1 ? list[0] : null);

    matchedBusStudent =
      // 조건 0: 공통 학생 키 일치 (최우선)
      (masterId ? busDocs.find(b => (b.data as any).masterStudentId === masterId) || null : null) ||
      // 조건 1: 이름 + 학년 + 반이 한 명과 일치
      pickOne(candidates.filter(b => sameName(b.data) && String(b.data.grade || '').trim() === cleanGrade &&
        (!cleanClass || String(b.data.class || b.data.classNum || '').trim() === cleanClass))) ||
      // 조건 2: 이름 + 학부모 이메일이 한 명과 일치
      (cleanEmail ? pickOne(candidates.filter(b => sameName(b.data) && (b.data.parentEmail || '').toLowerCase().trim() === cleanEmail)) : null) ||
      // 조건 3: 이름 + 연락처가 한 명과 일치
      (cleanPhone ? pickOne(candidates.filter(b => sameName(b.data) && (b.data.contact || '').replace(/\D/g, '') === cleanPhone)) : null);

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
      if (masterId) updatePayload.masterStudentId = masterId;

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
        ...(masterId ? { masterStudentId: masterId } : {}),
        applicationStatus: 'pending',
        createdAt: new Date().toISOString(),
      };
      await addDocument('students', newStudentPayload).catch(err => {
        console.warn('[syncParentResidence] add new bus student failed:', err);
      });
    }

    // 3. master_students 동기화: 공통 학생 키로 특정된 학생 1명만
    if ((destName || cleanPhone) && masterId) {
      const mUpdates: any = { updatedAt: new Date().toISOString() };
      if (destName) mUpdates.address = destName;
      if (cleanPhone) mUpdates.contact = cleanPhone;
      if (studentNumber) mUpdates.studentNum = String(studentNumber);
      await updateDoc(doc(mainDb, 'master_students', masterId), mUpdates).catch(() => {});
    }
  } catch (err) {
    console.error('[syncParentResidenceToKisbus] 전체 동기화 오류 (논블로킹):', err);
  }
}


