import { getDb } from '@/lib/firebase-admin';
import { NextRequest, NextResponse } from 'next/server';
import { UserProfile } from '@/lib/types';

// [중요] firebase-admin은 'doc', 'getDoc' 같은 모듈식 함수를 쓰지 않고
// db.collection('users').doc('id') 방식을 사용합니다.

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ email: string }> } // Next.js 15: params는 Promise
) {
    try {
        const { email } = await params; // await 필수
        const decodedEmail = decodeURIComponent(email); // URL 인코딩 문자(@ 등) 처리

        if (!decodedEmail) {
            return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
        }

        const db = getDb();
        // [수정] Admin SDK 문법으로 변경
        const userDocRef = db.collection('users').doc(decodedEmail);
        const snap = await userDocRef.get();
        
        if (!snap.exists) {
            return NextResponse.json({ error: 'User not found' }, { status: 404 });
        }
        
        const data = snap.data();
        if (!data) {
            return NextResponse.json({ error: 'User data is empty' }, { status: 404 });
        }

        const profile: UserProfile = {
            name: data.name || '',
            role: data.role || '',
            signature: data.signature || '',
            uid: data.uid || snap.id,
            email: snap.id,
            isAdmin: data.isAdmin || false,
        };

        return NextResponse.json(profile);

    } catch (error) {
       console.error(`[API] getUserProfileByEmail failed:`, error);
       return NextResponse.json({ error: 'Internal Server Error', details: (error as Error).message }, { status: 500 });
    }
}


export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ email: string }> }
) {
  try {
      const { email } = await params;
      const decodedEmail = decodeURIComponent(email);
      const { uid, profileData } = await request.json();
      const db = getDb();

      if (!decodedEmail || !profileData) {
        return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
      }

      const userProfileRef = db.collection('users').doc(decodedEmail);
      const docSnap = await userProfileRef.get();

      if (docSnap.exists) {
          await userProfileRef.set({
             ...profileData,
             ...(uid ? { uid } : {}),
             updatedAt: new Date().toISOString() 
          }, { merge: true });
      } else {
          await userProfileRef.set({
              email: decodedEmail,
              uid: uid || '',
              ...profileData,
              createdAt: new Date().toISOString()
          });
      }
      
      const newProfile: UserProfile = {
          name: profileData.name || '',
          role: profileData.role || '',
          signature: profileData.signature || '',
          email: decodedEmail,
          uid: uid || '',
          isAdmin: profileData.isAdmin || false,
      };

      return NextResponse.json({ success: true, profile: newProfile });

  } catch (error: any) {
      console.error(`[API] saveUserProfile failed:`, error);
      return NextResponse.json({ success: false, error: `프로필 저장 실패: ${error.message}` }, { status: 500 });
  }
}
