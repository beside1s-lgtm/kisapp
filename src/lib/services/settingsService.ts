import { doc, getDoc, setDoc, collection } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { DocConfig } from '@/lib/types';

const getSettingsCol = () => collection(db, 'settings');

export async function getDocConfig(): Promise<Partial<DocConfig>> {
  try {
    const snap = await getDoc(doc(getSettingsCol(), 'docConfig'));
    return snap.exists() ? (snap.data() as DocConfig) : {};
  } catch (e) {
    console.error("[SettingsService] getDocConfig error:", e);
    return {};
  }
}

export async function saveDocConfig(payload: Partial<DocConfig>) {
  try {
    await setDoc(doc(getSettingsCol(), 'docConfig'), payload, { merge: true });
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function getOrgStructure(): Promise<Partial<import('@/lib/types').OrgStructure>> {
  try {
    const snap = await getDoc(doc(getSettingsCol(), 'orgStructure'));
    return snap.exists() ? (snap.data() as import('@/lib/types').OrgStructure) : {};
  } catch (e) {
    console.error("[SettingsService] getOrgStructure error:", e);
    return {};
  }
}

export async function saveOrgStructure(payload: Partial<import('@/lib/types').OrgStructure>) {
  try {
    await setDoc(doc(getSettingsCol(), 'orgStructure'), payload, { merge: true });
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function getDelegationRules(): Promise<import('@/lib/types').DelegationRule[]> {
  try {
    const snap = await getDoc(doc(getSettingsCol(), 'delegationRules'));
    return snap.exists() ? (snap.data().rules as import('@/lib/types').DelegationRule[] || []) : [];
  } catch (e) {
    console.error("[SettingsService] getDelegationRules error:", e);
    return [];
  }
}

export async function saveDelegationRules(rules: import('@/lib/types').DelegationRule[]) {
  try {
    await setDoc(doc(getSettingsCol(), 'delegationRules'), { rules }, { merge: true });
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}
