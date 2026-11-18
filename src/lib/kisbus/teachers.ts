import { getKisbusDb as db } from './firebase';
import { doc, deleteDoc, writeBatch, collection, getDocs, getDoc, updateDoc } from 'firebase/firestore';
import { overlayTeacherNames, withBusTeacherAccount } from '@/lib/teachers/teacherRegistry';
import type { Teacher, NewTeacher } from './types';
import { fetchCollection, onCollectionUpdate, addDocument } from './core';
import { sanitizeDataForSystem } from './utils';
import { errorEmitter } from '@/lib/error-emitter';
import { FirestorePermissionError, type SecurityRuleContext } from '@/lib/errors';

// ─── 교직원은 시스템 설정(사용자 관리) 계정이 원본 ───────────────────────────────
// 스쿨버스 교사 문서(통근·방과후·토요)는 email로 시스템 계정에 연결하고, 화면 이름은 시스템 계정 이름을 따른다.
// 배차 정보(assignedBusId 등)는 버스 교사 문서에 저장되므로, 목록에는 버스 교사로 등록된 사람만 나온다.
// (이전 코드는 스쿨버스 DB의 users를 읽어 시스템 교직원이 실제로 합쳐진 적이 없다. 시스템에만 있는 교사를 배차에
//  고르면 존재하지 않는 버스 교사 문서를 고치려다 저장이 실패하므로 합치지 않는다.)

export const getTeachers = async (): Promise<Teacher[]> => overlayTeacherNames(await fetchCollection<Teacher>('teachers'));

export const onTeachersUpdate = (callback: (teachers: Teacher[]) => void) => onLinkedTeachersUpdate('teachers', callback);

/** 방과후·토요 교사 목록: 연결된 교사는 시스템 이름으로 표시 */
const onLinkedTeachersUpdate = (col: string, callback: (teachers: Teacher[]) => void) => {
    let seq = 0;
    return onCollectionUpdate<Teacher>(col, (list) => {
        const mine = ++seq;
        overlayTeacherNames(list).then(shown => { if (mine === seq) callback(shown); });
    });
};

/** 저장 전 시스템 계정 연결 (이름 정리 → 계정 찾기 → 시스템 이름으로) */
const linked = (t: any, prev?: any) =>
    withBusTeacherAccount({ ...t, ...(t.name !== undefined ? { name: sanitizeDataForSystem(t.name) } : {}) }, prev);

const updateLinked = async (col: string, id: string, data: Partial<Teacher>) => {
    const docRef = doc(db(), col, id);
    let payload: any = data;
    if (data.name !== undefined || (data as any).email !== undefined) {
        const prev = await getDoc(docRef).then(s => s.data()).catch(() => null);
        payload = await linked(data, prev);
    }
    await updateDoc(docRef, payload).catch(async (serverError) => {
        const permissionError = new FirestorePermissionError({ path: docRef.path, operation: 'update', requestResourceData: payload } satisfies SecurityRuleContext);
        errorEmitter.emit('permission-error', permissionError);
        throw serverError;
    });
};

const addLinkedInBatch = async (col: string, teachers: Omit<Teacher, 'id'>[]) => {
    const prepared = await Promise.all(teachers.map(teacher => {
        const { afterSchoolDays, ...rest } = teacher;
        const data: any = { ...rest };
        if (afterSchoolDays !== undefined) data.afterSchoolDays = afterSchoolDays;
        return linked(data);
    }));
    const batch = writeBatch(db());
    prepared.forEach(data => batch.set(doc(collection(db(), col)), data));
    await batch.commit().catch(async (serverError) => {
        errorEmitter.emit('permission-error', new FirestorePermissionError({ path: '/' + col, operation: 'create' } satisfies SecurityRuleContext));
        throw serverError;
    });
};

export const addTeacher = async (teacher: NewTeacher) => addDocument<Teacher>('teachers', await linked(teacher));

export const getAfterSchoolTeachers = () => fetchCollection<Teacher>('afterSchoolTeachers');
export const onAfterSchoolTeachersUpdate = (callback: (teachers: Teacher[]) => void) => onLinkedTeachersUpdate('afterSchoolTeachers', callback);
export const addAfterSchoolTeacher = async (teacher: NewTeacher) => addDocument<Teacher>('afterSchoolTeachers', await linked(teacher));

export const getSaturdayTeachers = () => fetchCollection<Teacher>('saturdayTeachers');
export const onSaturdayTeachersUpdate = (callback: (teachers: Teacher[]) => void) => onLinkedTeachersUpdate('saturdayTeachers', callback);
export const addSaturdayTeacher = async (teacher: NewTeacher) => addDocument<Teacher>('saturdayTeachers', await linked(teacher));

export const updateTeacher = (id: string, data: Partial<Teacher>) => updateLinked('teachers', id, data);

export const updateAfterSchoolTeacher = (id: string, data: Partial<Teacher>) => updateLinked('afterSchoolTeachers', id, data);

export const updateSaturdayTeacher = (id: string, data: Partial<Teacher>) => updateLinked('saturdayTeachers', id, data);

export const deleteTeacher = (id: string) => deleteDoc(doc(db(), 'teachers', id)).catch(async (serverError) => {
    const permissionError = new FirestorePermissionError({ path: `/teachers/${id}`, operation: 'delete' } satisfies SecurityRuleContext);
    errorEmitter.emit('permission-error', permissionError);
    throw serverError;
});

export const deleteAfterSchoolTeacher = (id: string) => deleteDoc(doc(db(), 'afterSchoolTeachers', id)).catch(async (serverError) => {
    const permissionError = new FirestorePermissionError({ path: `/afterSchoolTeachers/${id}`, operation: 'delete' } satisfies SecurityRuleContext);
    errorEmitter.emit('permission-error', permissionError);
    throw serverError;
});

export const deleteSaturdayTeacher = (id: string) => deleteDoc(doc(db(), 'saturdayTeachers', id)).catch(async (serverError) => {
    const permissionError = new FirestorePermissionError({ path: `/saturdayTeachers/${id}`, operation: 'delete' } satisfies SecurityRuleContext);
    errorEmitter.emit('permission-error', permissionError);
    throw serverError;
});

export const addTeachersInBatch = (teachers: Omit<Teacher, 'id'>[]) => addLinkedInBatch('teachers', teachers);

export const deleteTeachersInBatch = async (ids: string[]) => {
    const batch = writeBatch(db());
    ids.forEach(id => batch.delete(doc(db(), 'teachers', id)));
    try {
        const routesSnap = await getDocs(collection(db(), 'routes'));
        routesSnap.docs.forEach(rDoc => {
            const data = rDoc.data();
            if (data.teacherIds && Array.isArray(data.teacherIds)) {
                const remaining = data.teacherIds.filter((tid: string) => !ids.includes(tid));
                if (remaining.length !== data.teacherIds.length) {
                    batch.update(rDoc.ref, { teacherIds: remaining });
                }
            }
        });
    } catch (e) {
        console.warn('Failed to clean up routes for deleted teachers:', e);
    }
    await batch.commit().catch(async (serverError) => {
        errorEmitter.emit('permission-error', new FirestorePermissionError({ path: '/teachers', operation: 'delete' } satisfies SecurityRuleContext));
        throw serverError;
    });
};

export const addAfterSchoolTeachersInBatch = (teachers: Omit<Teacher, 'id'>[]) => addLinkedInBatch('afterSchoolTeachers', teachers);

export const addSaturdayTeachersInBatch = (teachers: Omit<Teacher, 'id'>[]) => addLinkedInBatch('saturdayTeachers', teachers);

export const deleteAfterSchoolTeachersInBatch = async (ids: string[]) => {
    const batch = writeBatch(db());
    ids.forEach(id => batch.delete(doc(db(), 'afterSchoolTeachers', id)));
    try {
        const routesSnap = await getDocs(collection(db(), 'routes'));
        routesSnap.docs.forEach(rDoc => {
            const data = rDoc.data();
            if (data.teacherIds && Array.isArray(data.teacherIds)) {
                const remaining = data.teacherIds.filter((tid: string) => !ids.includes(tid));
                if (remaining.length !== data.teacherIds.length) {
                    batch.update(rDoc.ref, { teacherIds: remaining });
                }
            }
        });
    } catch (e) {
        console.warn('Failed to clean up routes for deleted afterschool teachers:', e);
    }
    await batch.commit().catch(async (serverError) => {
        errorEmitter.emit('permission-error', new FirestorePermissionError({ path: '/afterSchoolTeachers', operation: 'delete' } satisfies SecurityRuleContext));
        throw serverError;
    });
};

export const deleteSaturdayTeachersInBatch = async (ids: string[]) => {
    const batch = writeBatch(db());
    ids.forEach(id => batch.delete(doc(db(), 'saturdayTeachers', id)));
    try {
        const routesSnap = await getDocs(collection(db(), 'routes'));
        routesSnap.docs.forEach(rDoc => {
            const data = rDoc.data();
            if (data.teacherIds && Array.isArray(data.teacherIds)) {
                const remaining = data.teacherIds.filter((tid: string) => !ids.includes(tid));
                if (remaining.length !== data.teacherIds.length) {
                    batch.update(rDoc.ref, { teacherIds: remaining });
                }
            }
        });
    } catch (e) {
        console.warn('Failed to clean up routes for deleted saturday teachers:', e);
    }
    await batch.commit().catch(async (serverError) => {
        errorEmitter.emit('permission-error', new FirestorePermissionError({ path: '/saturdayTeachers', operation: 'delete' } satisfies SecurityRuleContext));
        throw serverError;
    });
};

export const clearTeachers = async () => {
    const snapshot = await getDocs(collection(db(), 'teachers'));
    if (snapshot.empty) return;
    
    // Process in chunks of 500
    const docs = snapshot.docs;
    for (let i = 0; i < docs.length; i += 500) {
        const batch = writeBatch(db());
        const chunk = docs.slice(i, i + 500);
        chunk.forEach(doc => batch.delete(doc.ref));
        await batch.commit().catch(async (serverError) => {
            const permissionError = new FirestorePermissionError({ path: `/teachers`, operation: 'delete' } satisfies SecurityRuleContext);
            errorEmitter.emit('permission-error', permissionError);
            throw serverError;
        });
    }
};

export const clearAfterSchoolTeachers = async () => {
    const snapshot = await getDocs(collection(db(), 'afterSchoolTeachers'));
    if (snapshot.empty) return;

    const docs = snapshot.docs;
    for (let i = 0; i < docs.length; i += 500) {
        const batch = writeBatch(db());
        const chunk = docs.slice(i, i + 500);
        chunk.forEach(doc => batch.delete(doc.ref));
        await batch.commit().catch(async (serverError) => {
            const permissionError = new FirestorePermissionError({ path: `/afterSchoolTeachers`, operation: 'delete' } satisfies SecurityRuleContext);
            errorEmitter.emit('permission-error', permissionError);
            throw serverError;
        });
    }
};

export const clearSaturdayTeachers = async () => {
    const snapshot = await getDocs(collection(db(), 'saturdayTeachers'));
    if (snapshot.empty) return;

    const docs = snapshot.docs;
    for (let i = 0; i < docs.length; i += 500) {
        const batch = writeBatch(db());
        const chunk = docs.slice(i, i + 500);
        chunk.forEach(doc => batch.delete(doc.ref));
        await batch.commit().catch(async (serverError) => {
            const permissionError = new FirestorePermissionError({ path: `/saturdayTeachers`, operation: 'delete' } satisfies SecurityRuleContext);
            errorEmitter.emit('permission-error', permissionError);
            throw serverError;
        });
    }
};
