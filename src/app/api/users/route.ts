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
            uid: data.uid || d.id, // Ensure uid is always populated, defaulting to email if missing.
        } as UserProfile
    });
    
    // The previous implementation already handled uniqueness, this is good.
    const uniqueUsers = Array.from(new Map(users.map(user => [user.email, user])).values());
    return NextResponse.json(uniqueUsers);

  } catch (error) {
    console.error("[API] getUsersDirectory failed:", error);
    // Return a more informative error response
    return NextResponse.json({ error: 'Failed to retrieve users' }, { status: 500 });
  }
}
