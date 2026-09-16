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

