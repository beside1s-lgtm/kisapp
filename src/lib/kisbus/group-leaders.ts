import { getKisbusDb as db } from './firebase';
import { collection, doc, writeBatch, getDocs } from 'firebase/firestore';
import type { GroupLeaderRecord } from './types';
import { errorEmitter } from '@/lib/error-emitter';
import { FirestorePermissionError, type SecurityRuleContext } from '@/lib/errors';

const getLeadersCollection = (routeId: string, busId?: string, type?: string) => {
    if (!busId) {
        // busId가 ?�는 경우 ?�외?�으�?routeId 기반 경로�??�용?�되 경고 로그�??�깁?�다.
        console.warn('busId missing for group leader records, falling back to route path:', routeId);
        return collection(db(), `routes/${routeId}/groupLeaderRecords`);
    }
    // 모든 ?�선 ?�???�교, ?�교, 방과???�서 버스 ID�??�역 경로�?공유?�니??
    return collection(db(), `busLeaders/${busId}/records`);
};

export const getGroupLeaderRecords = async (routeId: string, busId?: string, type?: string): Promise<GroupLeaderRecord[]> => {
    const recordsCollection = getLeadersCollection(routeId, busId, type);
    const recordsSnapshot = await getDocs(recordsCollection);
    return recordsSnapshot.docs.map(doc => doc.data() as GroupLeaderRecord);
};

export const saveGroupLeaderRecords = async (routeId: string, records: GroupLeaderRecord[], busId?: string, type?: string) => {
    const batch = writeBatch(db());
    const recordsCollection = getLeadersCollection(routeId, busId, type);
    const existingRecordsSnapshot = await getDocs(recordsCollection);
    const existingRecordIds = new Set(existingRecordsSnapshot.docs.map(d => d.id));
    const localRecordIds = new Set<string>();
    
    records.forEach(record => {
        const recordId = record.studentId + '_' + record.startDate;
        localRecordIds.add(recordId);
        batch.set(doc(recordsCollection, recordId), record, { merge: true });
    });
    
    existingRecordIds.forEach(id => { 
        if (!localRecordIds.has(id)) batch.delete(doc(recordsCollection, id)); 
    });

    await batch.commit().catch(async (serverError) => {
        const permissionError = new FirestorePermissionError({ 
            path: recordsCollection.path, 
            operation: 'write', 
            requestResourceData: records 
        } satisfies SecurityRuleContext);
        errorEmitter.emit('permission-error', permissionError);
        throw serverError;
    });
};

export const getAllGroupLeaderRecords = async (buses: import('./types').Bus[], students: import('./types').Student[]) => {
    try {
        const sortedBuses = [...buses].sort((a, b) => {
            const numA = parseInt(a.name.replace(/\D/g, ''), 10);
            const numB = parseInt(b.name.replace(/\D/g, ''), 10);
            if (!isNaN(numA) && !isNaN(numB)) return numA - numB;
            return a.name.localeCompare(b.name, 'ko');
        });

        const busPromises = sortedBuses.map(async (bus) => {
            const busName = bus.name.endsWith('호') || bus.name.endsWith('번') ? bus.name : `${bus.name}호`;
            const busLeaders: Array<{ id: string; busNo: string; grade: string; class: string; name: string; gender: string; hours: string }> = [];
            try {
                const recordsCol = collection(db(), `busLeaders/${bus.id}/records`);
                const snap = await getDocs(recordsCol);
                snap.docs.forEach(docSnap => {
                    const data = docSnap.data() as GroupLeaderRecord;
                    // endDate가 없거나 null 또는 빈 문자열이면 현재 활성 조장
                    const isActive = !data.endDate || data.endDate === null || data.endDate === '';
                    if (isActive && (data.name || data.studentId)) {
                        const matchedStudent = students.find(s => s.id === data.studentId || (data.name && s.name === data.name));
                        const rawName = (data.name || matchedStudent?.name || '').trim();
                        if (!rawName) return;

                        let extractedGrade = '';
                        let extractedClass = '';
                        let cleanName = rawName;

                        const matchPrefix = rawName.match(/^(\d)(\d)\s+(.+)$/);
                        if (matchPrefix) {
                            extractedGrade = matchPrefix[1];
                            extractedClass = matchPrefix[2];
                            cleanName = matchPrefix[3].trim();
                        } else {
                            const matchPrefix2 = rawName.match(/^(\d)(\d)(.+)$/);
                            if (matchPrefix2) {
                                extractedGrade = matchPrefix2[1];
                                extractedClass = matchPrefix2[2];
                                cleanName = matchPrefix2[3].trim();
                            } else {
                                cleanName = rawName.replace(/^\d{1,2}\s*/, '').trim();
                            }
                        }

                        busLeaders.push({
                            id: `${bus.id}_${data.studentId || cleanName}_${Math.random()}`,
                            busNo: busName,
                            grade: matchedStudent?.grade || extractedGrade || '6',
                            class: matchedStudent?.class || extractedClass || '1',
                            name: cleanName,
                            gender: matchedStudent?.gender === 'Male' ? '남' : '여',
                            hours: '8시간'
                        });
                    }
                });
            } catch (err) {
                console.error(`Error fetching busLeaders for ${bus.id}:`, err);
            }
            return busLeaders;
        });

        const resultsArray = await Promise.all(busPromises);
        let leaders = resultsArray.flat();

        // 만약 busLeaders 컬렉션에서 아무 기록도 찾지 못한 경우, students 목록에서 isGroupLeader=true 또는 차장 속성을 찾아 수집
        if (leaders.length === 0 && students.length > 0) {
            students.forEach(s => {
                if ((s as any).isGroupLeader || (s as any).isLeader || (s as any).role === 'leader') {
                    const rawName = (s.name || '').trim();
                    let cleanName = rawName.replace(/^\d{1,2}\s*/, '').trim();
                    const busObj = buses.find(b => b.id === (s as any).busId);
                    const busName = busObj ? (busObj.name.endsWith('호') ? busObj.name : `${busObj.name}호`) : '미배정';
                    leaders.push({
                        id: `std_leader_${s.id}`,
                        busNo: busName,
                        grade: s.grade || '6',
                        class: s.class || '1',
                        name: cleanName,
                        gender: s.gender === 'Male' ? '남' : '여',
                        hours: '8시간'
                    });
                }
            });
        }

        return leaders;
    } catch (e) {
        console.error("getAllGroupLeaderRecords error:", e);
        return [];
    }
};
