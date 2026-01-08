import { getDb } from '@/lib/firebase-admin';
import { DocConfig } from '@/lib/types';
import { doc, getDoc, setDoc } from 'firebase-admin/firestore';
import { revalidatePath } from 'next/cache';
import { NextRequest, NextResponse } from 'next/server';

export async function GET() {
  const db = getDb();
  if (!db) return NextResponse.json({}, { status: 500 });
  const settingsRef = doc(db, 'settings', 'docConfig');
  try {
    const snap = await getDoc(settingsRef);
    return NextResponse.json(snap.exists() ? (snap.data() as DocConfig) : {});
  } catch(error) {
    console.error("[API] getDocConfig failed:", error);
    return NextResponse.json({}, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
    const db = getDb();
    if (!db) return NextResponse.json({ success: false, error: "Database not initialized." }, { status: 500 });
    
    const payload: DocConfig = await request.json();
    const settingsRef = doc(db, 'settings', 'docConfig');
    
    try {
        await setDoc(settingsRef, payload, { merge: true });
        revalidatePath('/');
        return NextResponse.json({ success: true });
    } catch (error: any) {
        console.error("saveDocConfig failed:", error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
