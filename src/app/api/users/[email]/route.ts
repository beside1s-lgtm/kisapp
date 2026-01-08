import { getDb } from '@/lib/firebase-admin';
import { NextRequest, NextResponse } from 'next/server';
import { doc, getDoc } from 'firebase-admin/firestore';
import { UserProfile } from '@/lib/types';
import { saveUserProfile as saveProfileToDb } from '@/app/actions';

export async function GET(
  request: NextRequest,
  { params }: { params: { email: string } }
) {
    const db = getDb();
    const email = params.email;
    if (!db || !email) {
        return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
    }
    
    try {
        const userDocRef = doc(db, 'users', email);
        const snap = await getDoc(userDocRef);
        
        if (!snap.exists()) {
            return NextResponse.json(null);
        }
        const data = snap.data() as Omit<UserProfile, 'uid'> & { uid?: string };
        const profile = {
            ...data,
            email: snap.id,
            uid: data.uid || snap.id
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
  const email = params.email;
  const { uid, profileData } = await request.json();

  if (!email || !uid || !profileData) {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const result = await saveProfileToDb(uid, email, profileData);

  if (result.success) {
    return NextResponse.json(result);
  } else {
    return NextResponse.json({ error: result.error }, { status: 500 });
  }
}
