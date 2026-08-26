import { Request, Response, NextFunction } from 'express';
import { adminAuth } from '../lib/firebase-admin.ts';
import { DecodedIdToken } from 'firebase-admin/auth';
import { db } from '../db/index.ts';
import { users } from '../db/schema.ts';
import { eq } from 'drizzle-orm';

export interface AuthRequest extends Request {
  user?: DecodedIdToken;
  dbUser?: any;
}

export const requireAuth = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized: Missing token' });
  }

  const token = authHeader.split('Bearer ')[1];
  try {
    const decodedToken = await adminAuth.verifyIdToken(token);
    req.user = decodedToken;
    
    // Get user from DB
    let userRecords = await db.select().from(users).where(eq(users.uid, decodedToken.uid));
    
    if (userRecords.length === 0 && decodedToken.email) {
      // Check if user exists by email (e.g. from OAuth or seed)
      const byEmail = await db.select().from(users).where(eq(users.email, decodedToken.email)).limit(1);
      if (byEmail.length > 0) {
        // Link firebase UID to existing DB user
        await db.update(users).set({ uid: decodedToken.uid }).where(eq(users.id, byEmail[0].id));
        userRecords = byEmail;
      }
    }

    if (userRecords.length > 0) {
      req.dbUser = userRecords[0];
    } else {
      // Upsert
      const newUser = await db.insert(users).values({
        uid: decodedToken.uid,
        email: decodedToken.email || '',
        name: decodedToken.name || '',
      }).onConflictDoUpdate({
        target: users.uid,
        set: {
          email: decodedToken.email || '',
          name: decodedToken.name || '',
        }
      }).returning();
      req.dbUser = newUser[0];
    }
    
    next();
  } catch (error) {
    console.error('Error verifying Firebase ID token:', error);
    return res.status(401).json({ error: 'Unauthorized: Invalid token' });
  }
};
