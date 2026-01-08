import { getDb } from '@/lib/firebase-admin';
import { UserProfile } from '@/lib/types';
import { collection, getDocs } from 'firebase-admin/firestore';
import { NextResponse } from 'next/server';

export async function GET() {
  const db = getDb();
  if (!db) {
    return NextResponse.json({error: 'DB not init'}, { status: 500});
  }
  try {
    const usersDirCol = collection(db, 'users');
    const snapshot = await getDocs(usersDirCol);
    if (snapshot.empty) {
      return NextResponse.json([]);
    }
    
    const users = snapshot.docs.map(d => {
        const data = d.data() as Omit<UserProfile, 'uid'> & { uid?: string };
        return {
            ...data,
            email: d.id,
            uid: data.uid || d.id, 
        } as UserProfile
    });
    const uniqueUsers = Array.from(new Map(users.map(user => [user.email, user])).values());
    return NextResponse.json(uniqueUsers);

  } catch (error) {
    console.error("[API] getUsersDirectory failed:", error);
    return NextResponse.json([]);
  }
}
