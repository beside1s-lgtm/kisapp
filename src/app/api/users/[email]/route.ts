'use server';
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
        
        const data = snap.data() as Omit<UserProfile, 'uid' | 'email'>;

        // Safely construct the profile object.
        const profile: UserProfile = {
            name: data.name,
            role: data.role,
            signature: data.signature || '',
            // Safely access uid, default to the doc id (email) if it doesn't exist.
            uid: (data as any).uid || snap.id,
            email: snap.id, // Email is the document ID.
            isAdmin: data.isAdmin || false,
        };

        return NextResponse.json(profile);

    } catch (error) {
       console.error(`[API] getUserProfileByEmail failed for ${email}:`, error);
       // Provide a more informative error message in the response body.
       return NextResponse.json({ error: 'Internal Server Error', details: (error as Error).message }, { status: 500 });
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
      // Use a transaction or merge to prevent data loss
      await setDoc(userProfileRef, { ...profileData, email, uid }, { merge: true });
      
      const newProfileSnap = await getDoc(userProfileRef);
      if (!newProfileSnap.exists()) {
          throw new Error("Failed to retrieve profile after saving.");
      }
      
      const savedData = newProfileSnap.data() as UserProfile;
      
      const newProfile: UserProfile = {
          ...savedData,
          email: newProfileSnap.id,
          uid: savedData.uid || uid, // Ensure UID is consistent
      };

      return NextResponse.json({ success: true, profile: newProfile });

  } catch (error: any) {
      console.error(`[API] saveUserProfile failed for ${email}:`, error);
      return NextResponse.json({ success: false, error: `프로필 저장 실패: ${error.message}` }, { status: 500 });
  }
}
