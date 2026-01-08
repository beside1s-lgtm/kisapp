import { getDb } from '@/lib/firebase-admin';
import { NextRequest, NextResponse } from 'next/server';
import { doc, getDoc, setDoc } from 'firebase-admin/firestore';
import { UserProfile } from '@/lib/types';


export async function GET(
  request: NextRequest,
  { params }: { params: { email: string } }
) {
    const db = getDb();
    const email = params.email;
    if (!email) {
        return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
    }
    
    try {
        const userDocRef = doc(db, 'users', email);
        const snap = await getDoc(userDocRef);
        
        if (!snap.exists()) {
            return NextResponse.json({ error: 'User not found' }, { status: 404 });
        }
        const data = snap.data() as Omit<UserProfile, 'uid'> & { uid?: string };
        const profile = {
            ...data,
            email: snap.id,
            uid: data.uid || '',
        } as UserProfile;

        return NextResponse.json(profile);

    } catch (error) {
       console.error(`[API] getUserProfileByEmail failed for ${email}:`, error);
       return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}


export async function POST(
  request: NextRequest,
  { params }: { params: { email: string } }
) {
  const db = getDb();
  const email = params.email;
  const { uid, profileData } = await request.json();

  if (!email || !uid || !profileData) {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const userProfileRef = doc(db, 'users', email);
  
  try {
      const docSnap = await getDoc(userProfileRef);
      const existingData = docSnap.exists() ? docSnap.data() : {};
      
      const dataToSave = { 
        ...existingData, 
        ...profileData,
        email: email, 
        uid: uid,
      };
      
      await setDoc(userProfileRef, dataToSave, { merge: true });
      
      const newProfile = (await getDoc(userProfileRef)).data() as UserProfile;
      return NextResponse.json({ success: true, profile: newProfile });

  } catch (error: any) {
      console.error(`[API] saveUserProfile failed for ${email}:`, error);
      return NextResponse.json({ success: false, error: `프로필 저장 실패: ${error.message}` }, { status: 500 });
  }
}
