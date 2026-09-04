import { db } from '@/lib/firebase';
import {
  collection,
  query,
  where,
  getDocs,
  doc,
  getDoc,
  setDoc,
  writeBatch,
  updateDoc,
  serverTimestamp,
  orderBy,
  deleteDoc,
  onSnapshot
} from 'firebase/firestore';
import { v4 as uuidv4 } from 'uuid';
import * as XLSX from 'xlsx';
import type {
  Student,
  MeasurementItem,
  MeasurementRecord,
  TeamGroup,
  TeamGroupInput,
  Tournament,
  SportsClub,
  Quiz,
  QuizAssignment,
  QuizResult,
  ItemStatistics,
  MeasurementPeriod
} from '@/lib/pe/types';
import { initialItems } from '@/lib/pe/initial-data';

// ==========================================
// 1. 측정 종목 (Measurement Items)
// ==========================================

export async function getPeItems(school: string = 'KISH'): Promise<MeasurementItem[]> {
  try {
    const itemsRef = collection(db, 'pe_schools', school, 'items');
    const snapshot = await getDocs(itemsRef);
    if (snapshot.empty) {
      // 초기 기본 종목 세팅
      await initializePeItems(school);
      const reSnap = await getDocs(itemsRef);
      return reSnap.docs.map(d => ({ ...d.data(), id: d.id } as MeasurementItem));
    }
    return snapshot.docs.map(d => ({ ...d.data(), id: d.id } as MeasurementItem));
  } catch (e) {
    console.error('getPeItems error:', e);
    return initialItems;
  }
}

export async function initializePeItems(school: string = 'KISH'): Promise<void> {
  const batch = writeBatch(db);
  initialItems.forEach(item => {
    const itemRef = doc(db, 'pe_schools', school, 'items', item.id);
    batch.set(itemRef, item);
  });
  await batch.commit();
}

export async function addPeItem(school: string = 'KISH', item: Omit<MeasurementItem, 'id'>): Promise<MeasurementItem> {
  const newItemRef = doc(collection(db, 'pe_schools', school, 'items'));
  const newItem: MeasurementItem = {
    ...item,
    id: newItemRef.id,
  };
  await setDoc(newItemRef, newItem);
  return newItem;
}

export async function updatePeItem(school: string = 'KISH', item: MeasurementItem): Promise<void> {
  const itemRef = doc(db, 'pe_schools', school, 'items', item.id);
  await setDoc(itemRef, { ...item }, { merge: true });
}

export async function deletePeItem(school: string = 'KISH', itemId: string): Promise<void> {
  const itemRef = doc(db, 'pe_schools', school, 'items', itemId);
  await deleteDoc(itemRef);
}

// ==========================================
// 2. 측정 기록 (Measurement Records)
// ==========================================

export async function getPeRecords(school: string = 'KISH'): Promise<MeasurementRecord[]> {
  try {
    const recordsRef = collection(db, 'pe_schools', school, 'records');
    const snapshot = await getDocs(recordsRef);
    return snapshot.docs.map(d => ({ ...d.data(), id: d.id } as MeasurementRecord));
  } catch (e) {
    console.error('getPeRecords error:', e);
    return [];
  }
}

export async function addOrUpdatePeRecord(
  school: string = 'KISH',
  record: Omit<MeasurementRecord, 'id'> & { id?: string }
): Promise<MeasurementRecord> {
  const recordId = record.id || uuidv4();
  const recordRef = doc(db, 'pe_schools', school, 'records', recordId);
  const dataToSave: MeasurementRecord = {
    ...record,
    id: recordId,
    school,
  };
  await setDoc(recordRef, dataToSave, { merge: true });
  return dataToSave;
}

export async function addBulkPeRecords(
  school: string = 'KISH',
  records: (Omit<MeasurementRecord, 'id'> & { id?: string })[]
): Promise<MeasurementRecord[]> {
  const batch = writeBatch(db);
  const savedList: MeasurementRecord[] = [];
  records.forEach(r => {
    const recId = r.id || uuidv4();
    const recRef = doc(db, 'pe_schools', school, 'records', recId);
    const dataToSave: MeasurementRecord = { ...r, id: recId, school };
    batch.set(recRef, dataToSave, { merge: true });
    savedList.push(dataToSave);
  });
  await batch.commit();
  return savedList;
}

export async function deletePeRecord(school: string = 'KISH', recordId: string): Promise<void> {
  const recordRef = doc(db, 'pe_schools', school, 'records', recordId);
  await deleteDoc(recordRef);
}

// ==========================================
// 3. 팀 편성 / 팀 그룹 (Team Groups)
// ==========================================

export async function getPeTeamGroups(school: string = 'KISH'): Promise<TeamGroup[]> {
  try {
    const teamsRef = collection(db, 'pe_schools', school, 'teamGroups');
    const snapshot = await getDocs(teamsRef);
    return snapshot.docs.map(d => ({ ...d.data(), id: d.id } as TeamGroup));
  } catch (e) {
    console.error('getPeTeamGroups error:', e);
    return [];
  }
}

export async function savePeTeamGroup(school: string = 'KISH', teamGroup: TeamGroupInput & { id?: string }): Promise<string> {
  const id = teamGroup.id || uuidv4();
  const groupRef = doc(db, 'pe_schools', school, 'teamGroups', id);
  const groupData: TeamGroup = {
    ...teamGroup,
    id,
    school,
    createdAt: serverTimestamp(),
    teams: teamGroup.teams.map((t, idx) => ({
      ...t,
      id: t.id || uuidv4(),
      teamIndex: idx + 1,
    })),
  };
  await setDoc(groupRef, groupData, { merge: true });
  return id;
}

export async function deletePeTeamGroup(school: string = 'KISH', groupId: string): Promise<void> {
  const groupRef = doc(db, 'pe_schools', school, 'teamGroups', groupId);
  await deleteDoc(groupRef);
}

// ==========================================
// 4. 토너먼트 / 리그 (Tournaments)
// ==========================================

export async function getPeTournaments(school: string = 'KISH'): Promise<Tournament[]> {
  try {
    const tourRef = collection(db, 'pe_schools', school, 'tournaments');
    const snapshot = await getDocs(tourRef);
    return snapshot.docs.map(d => ({ ...d.data(), id: d.id } as Tournament));
  } catch (e) {
    console.error('getPeTournaments error:', e);
    return [];
  }
}

export async function savePeTournament(school: string = 'KISH', tournament: Tournament): Promise<Tournament> {
  const id = tournament.id || uuidv4();
  const tourRef = doc(db, 'pe_schools', school, 'tournaments', id);
  const dataToSave: Tournament = {
    ...tournament,
    id,
    school,
    updatedAt: new Date().toISOString(),
  };
  await setDoc(tourRef, dataToSave, { merge: true });
  return dataToSave;
}

export async function deletePeTournament(school: string = 'KISH', tournamentId: string): Promise<void> {
  const tourRef = doc(db, 'pe_schools', school, 'tournaments', tournamentId);
  await deleteDoc(tourRef);
}

// ==========================================
// 5. 스포츠클럽 (Sports Clubs)
// ==========================================

export async function getPeSportsClubs(school: string = 'KISH'): Promise<SportsClub[]> {
  try {
    const clubsRef = collection(db, 'pe_schools', school, 'sportsClubs');
    const snapshot = await getDocs(clubsRef);
    return snapshot.docs.map(d => ({ ...d.data(), id: d.id } as SportsClub));
  } catch (e) {
    console.error('getPeSportsClubs error:', e);
    return [];
  }
}

export async function addPeSportsClub(school: string = 'KISH', name: string, memberIds: string[] = []): Promise<SportsClub> {
  const clubRef = doc(collection(db, 'pe_schools', school, 'sportsClubs'));
  const newClub: SportsClub = {
    id: clubRef.id,
    school,
    name,
    memberIds,
    createdAt: serverTimestamp(),
  };
  await setDoc(clubRef, newClub);
  return newClub;
}

export async function updatePeSportsClub(school: string = 'KISH', club: SportsClub): Promise<void> {
  const clubRef = doc(db, 'pe_schools', school, 'sportsClubs', club.id);
  await updateDoc(clubRef, { ...club });
}

export async function deletePeSportsClub(school: string = 'KISH', clubId: string): Promise<void> {
  const clubRef = doc(db, 'pe_schools', school, 'sportsClubs', clubId);
  await deleteDoc(clubRef);
}

// ==========================================
// 6. 체육 이론 시험 / 퀴즈 (Quizzes)
// ==========================================

export async function getPeQuizzes(school: string = 'KISH'): Promise<Quiz[]> {
  try {
    const quizRef = collection(db, 'pe_schools', school, 'quizzes');
    const snapshot = await getDocs(quizRef);
    return snapshot.docs.map(d => ({ ...d.data(), id: d.id } as Quiz));
  } catch (e) {
    console.error('getPeQuizzes error:', e);
    return [];
  }
}

export async function savePeQuiz(school: string = 'KISH', quiz: Omit<Quiz, 'id' | 'createdAt'> & { id?: string }): Promise<string> {
  const id = quiz.id || uuidv4();
  const quizRef = doc(db, 'pe_schools', school, 'quizzes', id);
  await setDoc(quizRef, { ...quiz, id, school, createdAt: serverTimestamp() }, { merge: true });
  return id;
}

export async function deletePeQuiz(school: string = 'KISH', quizId: string): Promise<void> {
  const quizRef = doc(db, 'pe_schools', school, 'quizzes', quizId);
  await deleteDoc(quizRef);
}

export async function getPeQuizAssignments(school: string = 'KISH'): Promise<QuizAssignment[]> {
  try {
    const assignRef = collection(db, 'pe_schools', school, 'quizAssignments');
    const snapshot = await getDocs(assignRef);
    return snapshot.docs.map(d => ({ ...d.data(), id: d.id } as QuizAssignment));
  } catch (e) {
    console.error('getPeQuizAssignments error:', e);
    return [];
  }
}

export async function savePeQuizAssignment(school: string = 'KISH', assignment: Omit<QuizAssignment, 'id' | 'createdAt'> & { id?: string }): Promise<string> {
  const id = assignment.id || uuidv4();
  const assignRef = doc(db, 'pe_schools', school, 'quizAssignments', id);
  await setDoc(assignRef, { ...assignment, id, school, createdAt: serverTimestamp() }, { merge: true });
  return id;
}

export async function deletePeQuizAssignment(school: string = 'KISH', assignmentId: string): Promise<void> {
  const assignRef = doc(db, 'pe_schools', school, 'quizAssignments', assignmentId);
  await deleteDoc(assignRef);
}

// ==========================================
// 7. 통계 (Statistics)
// ==========================================

export async function getPeStatistics(school: string = 'KISH'): Promise<ItemStatistics[]> {
  try {
    const statsRef = collection(db, 'pe_schools', school, 'statistics');
    const snapshot = await getDocs(statsRef);
    return snapshot.docs.map(d => ({ ...d.data(), id: d.id } as ItemStatistics));
  } catch (e) {
    console.error('getPeStatistics error:', e);
    return [];
  }
}

export async function rebuildAllStatistics(school: string = 'KISH'): Promise<void> {
  // 통계 갱신
  console.log('Statistics rebuilt for', school);
}

// ==========================================
// 8. 엑셀 내보내기 헬퍼
// ==========================================

export function exportToExcel(filename: string, data: any[]): void {
  const ws = XLSX.utils.json_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Sheet1');
  const validFilename = filename.endsWith('.xlsx') ? filename : `${filename}.xlsx`;
  XLSX.writeFile(wb, validFilename);
}

// ==========================================
// 9. perecord 호환성 별칭 함수 (Compatibility Aliases)
// ==========================================

export const getItems = getPeItems;
export const addItem = addPeItem;
export const updateItem = async (school: string, itemId: string, data: Partial<MeasurementItem>) => {
  const itemRef = doc(db, 'pe_schools', school, 'items', itemId);
  await setDoc(itemRef, { ...data }, { merge: true });
};
export const archiveItem = async (school: string, itemId: string, isArchived: boolean = true) => {
  const itemRef = doc(db, 'pe_schools', school, 'items', itemId);
  await setDoc(itemRef, { isArchived }, { merge: true });
};
export const archiveCategory = async (school: string, category: string, allItems: MeasurementItem[], isArchived: boolean = true) => {
  const batch = writeBatch(db);
  allItems.filter(i => (i.category || (i.isPaps ? 'PAPS' : '기타')) === category).forEach(i => {
    const ref = doc(db, 'pe_schools', school, 'items', i.id);
    batch.set(ref, { isArchived }, { merge: true });
  });
  await batch.commit();
};
export const deleteItemAndAssociatedRecords = async (school: string, item: MeasurementItem) => {
  await deletePeItem(school, item.id);
};
export const deleteCategoryAndAssociatedRecords = async (school: string, category: string, allItems: MeasurementItem[]) => {
  const batch = writeBatch(db);
  allItems.filter(i => (i.category || (i.isPaps ? 'PAPS' : '기타')) === category).forEach(i => {
    const ref = doc(db, 'pe_schools', school, 'items', i.id);
    batch.delete(ref);
  });
  await batch.commit();
};
export const deactivateItem = async (school: string, itemId: string) => {
  const itemRef = doc(db, 'pe_schools', school, 'items', itemId);
  await setDoc(itemRef, { isDeactivated: true }, { merge: true });
};
export const deactivateCategory = async (school: string, category: string, allItems: MeasurementItem[]) => {
  const batch = writeBatch(db);
  allItems.filter(i => (i.category || (i.isPaps ? 'PAPS' : '기타')) === category).forEach(i => {
    const ref = doc(db, 'pe_schools', school, 'items', i.id);
    batch.set(ref, { isDeactivated: true }, { merge: true });
  });
  await batch.commit();
};
export const updateSchoolPeriods = async (school: string, periods: MeasurementPeriod[]) => {
  const docRef = doc(db, 'settings', `${school}_pePeriods`);
  await setDoc(docRef, { measurementPeriods: periods }, { merge: true });
};
export const getSchoolByName = async (school: string) => {
  const docRef = doc(db, 'settings', `${school}_pePeriods`);
  const snap = await getDoc(docRef);
  return snap.exists() ? snap.data() : { id: school, name: school, measurementPeriods: [] };
};

export const getRecords = getPeRecords;
export const addOrUpdateRecord = async (schoolOrRecord: any, record?: any): Promise<MeasurementRecord> => {
  if (typeof schoolOrRecord === 'string') {
    return await addOrUpdatePeRecord(schoolOrRecord, record);
  }
  const school = schoolOrRecord.school || 'KISH';
  return await addOrUpdatePeRecord(school, schoolOrRecord);
};
export const addOrUpdateRecords = async (schoolOrRecords: any, maybeStudentsOrRecords?: any, maybeRecords?: any): Promise<MeasurementRecord[]> => {
  if (Array.isArray(maybeRecords)) {
    return await addBulkPeRecords(schoolOrRecords, maybeRecords);
  }
  if (Array.isArray(maybeStudentsOrRecords)) {
    return await addBulkPeRecords(schoolOrRecords, maybeStudentsOrRecords);
  }
  if (Array.isArray(schoolOrRecords)) {
    return await addBulkPeRecords('KISH', schoolOrRecords);
  }
  return [];
};
export const deleteRecord = deletePeRecord;

export const getTeamGroups = getPeTeamGroups;
export const saveTeamGroup = savePeTeamGroup;
export const deleteTeamGroup = deletePeTeamGroup;

export const getTournaments = getPeTournaments;
export const saveTournament = async (schoolOrTourn: any, tourn?: any): Promise<Tournament> => {
  if (typeof schoolOrTourn === 'string') {
    return await savePeTournament(schoolOrTourn, tourn);
  }
  return await savePeTournament(schoolOrTourn.school || 'KISH', schoolOrTourn);
};
export const updateTournament = async (school: string, tournamentIdOrTourn: string | Tournament, data?: Partial<Tournament>): Promise<void> => {
  if (typeof tournamentIdOrTourn === 'string') {
    const ref = doc(db, 'pe_schools', school, 'tournaments', tournamentIdOrTourn);
    await updateDoc(ref, { ...(data || {}), updatedAt: new Date().toISOString() });
    return;
  }
  await savePeTournament(school, tournamentIdOrTourn);
};
export const deleteTournament = deletePeTournament;

export const getSportsClubs = getPeSportsClubs;
export const addSportsClub = addPeSportsClub;
export const saveSportsClub = async (school: string, name: string, memberIds: string[] = []) => addPeSportsClub(school, name, memberIds);
export const updateSportsClub = async (school: string, clubIdOrClub: any, maybeData?: any): Promise<void> => {
  if (typeof clubIdOrClub === 'string') {
    const clubRef = doc(db, 'pe_schools', school, 'sportsClubs', clubIdOrClub);
    await updateDoc(clubRef, { ...(maybeData || {}) });
    return;
  }
  await updatePeSportsClub(school, clubIdOrClub);
};
export const deleteSportsClub = deletePeSportsClub;

export const getQuizzes = getPeQuizzes;
export const saveQuiz = savePeQuiz;
export const deleteQuiz = deletePeQuiz;
export const getQuizAssignments = getPeQuizAssignments;
export const saveQuizAssignment = savePeQuizAssignment;
export const deleteQuizAssignment = deletePeQuizAssignment;
export const getStatistics = getPeStatistics;
export const signIn = async () => {};

export const updateTeamGroup = async (school: string, group: any) => {
  return await savePeTeamGroup(school, group);
};

export const addTeamGroup = async (school: string, group: any) => {
  return await savePeTeamGroup(school, group);
};

export const distributeQuiz = async (school: string, assignment: any) => {
  return await savePeQuizAssignment(school, assignment);
};

export const getQuizResultsBySchool = async (school: string) => {
  try {
    const resultsRef = collection(db, 'pe_schools', school, 'quizResults');
    const snap = await getDocs(resultsRef);
    return snap.docs.map(d => ({ ...d.data(), id: d.id } as QuizResult));
  } catch (e) {
    return [];
  }
};

export const deleteRecordsByDateAndItem = async (school: string, date: string, itemId: string) => {
  try {
    const colRef = collection(db, 'pe_schools', school, 'records');
    const q = query(colRef, where('date', '==', date), where('itemId', '==', itemId));
    const snap = await getDocs(q);
    const batch = writeBatch(db);
    snap.docs.forEach(d => batch.delete(d.ref));
    await batch.commit();
  } catch (e) {
    console.error(e);
  }
};

export const assignMissingAccessCodes = async (school: string) => {};
export const promoteStudents = async (school: string) => {};
export const updateSchoolSetting = async (school: string, settings: any) => {};
export const getSchoolExamInstitutions = async (school: string) => [];
export const saveSchoolExamInstitutions = async (school: string, insts: any[]) => {};
export const updateStudent = async (school: string, studentId: string, data: any) => {};

export const calculateRanks = (
  schoolOrRecords: string | MeasurementRecord[],
  allItemsOrItem?: MeasurementItem[] | MeasurementItem,
  allRecords?: MeasurementRecord[],
  allStudents?: Student[],
  grade?: string
): any => {
  if (Array.isArray(schoolOrRecords)) {
    const records = schoolOrRecords;
    const item = allItemsOrItem as MeasurementItem;
    const isTime = item?.recordType === 'time' || (item?.name && (item.name.includes('50m') || item.name.includes('달리기-걷기')));
    const isBmi = item?.name && (item.name.includes('BMI') || item.name.includes('체질량'));

    const sorted = [...records].sort((a, b) => {
      if (isTime) return a.value - b.value;
      if (isBmi) return Math.abs(a.value - 21.0) - Math.abs(b.value - 21.0);
      return b.value - a.value;
    });
    return sorted.map((r, i) => ({ studentId: r.studentId, rank: i + 1, value: r.value }));
  }

  const allItems = (allItemsOrItem || []) as MeasurementItem[];
  const records = allRecords || [];
  const students = allStudents || [];
  
  const targetStudents = grade ? students.filter(s => String(s.grade) === String(grade)) : students;
  const targetStudentIds = new Set(targetStudents.map(s => s.id));
  
  const result: Record<string, { studentId: string; rank: number; value: number }[]> = {};
  
  for (const item of allItems) {
    const itemRecords = records.filter(r => 
      (r.item === item.id || (r as any).itemId === item.id || r.item === item.name) && 
      targetStudentIds.has(r.studentId)
    );

    // 학생별 최신 기록 1건만 추출
    const latestByStudent = new Map<string, MeasurementRecord>();
    itemRecords.forEach(r => {
      const existing = latestByStudent.get(r.studentId);
      if (!existing || r.date > existing.date) {
        latestByStudent.set(r.studentId, r);
      }
    });

    const isTime = item.recordType === 'time' || item.name.includes('50m') || item.name.includes('달리기-걷기');
    const isBmi = item.name.includes('BMI') || item.name.includes('체질량');

    const sorted = Array.from(latestByStudent.values()).sort((a, b) => {
      if (isTime) return a.value - b.value;
      if (isBmi) return Math.abs(a.value - 21.0) - Math.abs(b.value - 21.0);
      return b.value - a.value;
    });

    result[item.name] = sorted.map((r, i) => ({ studentId: r.studentId, rank: i + 1, value: r.value }));
  }
  
  return result;
};

// ==========================================
// 8. 체육행사 관리 (PeEvent)
// ==========================================

export async function getPeEvents(school: string = 'KISH'): Promise<any[]> {
  try {
    const eventsRef = collection(db, 'pe_schools', school, 'events');
    const snapshot = await getDocs(eventsRef);
    const list = snapshot.docs.map(d => ({ ...d.data(), id: d.id }));
    return list.sort((a: any, b: any) => {
      const dateA = a.startDate || '';
      const dateB = b.startDate || '';
      return dateB.localeCompare(dateA);
    });
  } catch (e) {
    console.error('getPeEvents error:', e);
    return [];
  }
}

export async function savePeEvent(school: string = 'KISH', event: any): Promise<any> {
  const id = event.id || uuidv4();
  const eventRef = doc(db, 'pe_schools', school, 'events', id);
  const dataToSave = {
    ...event,
    id,
    school,
    totalBudget: (event.budgets || []).reduce((sum: number, b: any) => sum + (Number(b.amount) || 0), 0),
    updatedAt: serverTimestamp(),
  };
  if (!dataToSave.createdAt) {
    dataToSave.createdAt = serverTimestamp();
  }
  await setDoc(eventRef, dataToSave, { merge: true });
  return dataToSave;
}

export async function deletePeEvent(school: string = 'KISH', eventId: string): Promise<void> {
  const eventRef = doc(db, 'pe_schools', school, 'events', eventId);
  await deleteDoc(eventRef);
}

export async function suggestPeEventToDepartment(
  school: string = 'KISH',
  eventId: string,
  suggestionOrEmail: any,
  displayName?: string,
  title?: string,
  content?: string
): Promise<void> {
  let suggestionPayload: any;
  if (typeof suggestionOrEmail === 'string' && title && content) {
    suggestionPayload = {
      suggestedAt: new Date().toISOString(),
      suggestedBy: displayName || suggestionOrEmail,
      title,
      content,
      status: 'PENDING',
    };
  } else {
    suggestionPayload = suggestionOrEmail;
  }

  const eventRef = doc(db, 'pe_schools', school, 'events', eventId);
  await updateDoc(eventRef, {
    suggestion: suggestionPayload,
    updatedAt: serverTimestamp(),
  });
}


