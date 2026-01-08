import { getDb } from '@/lib/firebase-admin';
import { UserProfile } from '@/lib/types';
import { NextResponse } from 'next/server';

export async function GET() {
  const db = getDb();
  
  if (!db) {
    return NextResponse.json({error: 'DB not init'}, { status: 500});
  }

  try {
    // [수정 포인트]
    // 클라이언트 SDK 방식: await getDocs(collection(db, 'users')); (X)
    // Admin SDK 방식: await db.collection('users').get(); (O)
    
    const snapshot = await db.collection('users').get();

    if (snapshot.empty) {
      return NextResponse.json([]);
    }
    
    const users = snapshot.docs.map(d => {
        const data = d.data();
        
        // 데이터 매핑
        return {
            name: data.name || '',
            role: data.role || '',
            signature: data.signature || '',
            isAdmin: data.isAdmin || false,
            email: d.id, // 문서 ID를 이메일로 사용
            uid: data.uid || '', 
        } as UserProfile
    });
    
    // 이메일 기준 중복 제거 (필요하다면 유지, 보통 문서 ID가 키라면 중복될 일은 없음)
    const uniqueUsers = Array.from(new Map(users.map(user => [user.email, user])).values());
    
    return NextResponse.json(uniqueUsers);

  } catch (error) {
    console.error("[API] getUsersDirectory failed:", error);
    return NextResponse.json({ error: 'Failed to retrieve users' }, { status: 500 });
  }
}