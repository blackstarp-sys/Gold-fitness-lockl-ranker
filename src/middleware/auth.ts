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
  let decodedToken: DecodedIdToken;
  try {
    decodedToken = await adminAuth.verifyIdToken(token);
    req.user = decodedToken;
  } catch (error) {
    console.error('Error verifying Firebase ID token:', error);
    return res.status(401).json({ error: 'Unauthorized: Invalid token' });
  }

  try {
    const verifiedEmail = (decodedToken.email || '').trim().toLowerCase();
    const ownerEmail = (process.env.OWNER_EMAIL || 'dhanusgoldfitness@gmail.com').trim().toLowerCase();
    const isOwner = Boolean(verifiedEmail && verifiedEmail === ownerEmail);

    if (!isOwner) {
      console.warn(`[AUTH] Access rejected for email: ${verifiedEmail}. Only ${ownerEmail} is allowed.`);
      return res.status(403).json({ 
        error: 'Forbidden: Unauthorized account. Only the owner account dhanusgoldfitness@gmail.com is allowed.',
        code: 'UNAUTHORIZED_ACCOUNT'
      });
    }

    const roleToAssign = 'owner';

    // 1. Check if user exists by Firebase UID
    let userRecords = await db.select().from(users).where(eq(users.uid, decodedToken.uid));
    
    // 2. If not found by UID, check by verified lowercase email
    if (userRecords.length === 0 && verifiedEmail) {
      const byEmail = await db.select().from(users).where(eq(users.email, verifiedEmail)).limit(1);
      if (byEmail.length > 0) {
        // Link firebase UID to existing DB user and ensure owner role
        await db.update(users).set({
          uid: decodedToken.uid,
          email: verifiedEmail,
          name: decodedToken.name || byEmail[0].name,
          role: isOwner ? 'owner' : (byEmail[0].role || 'user'),
        }).where(eq(users.id, byEmail[0].id));
        byEmail[0].uid = decodedToken.uid;
        byEmail[0].email = verifiedEmail;
        byEmail[0].role = isOwner ? 'owner' : (byEmail[0].role || 'user');
        userRecords = byEmail;
      }
    }

    if (userRecords.length > 0) {
      // Update existing record with verified email and ensure owner role if matched
      if (isOwner && userRecords[0].role !== 'owner') {
        await db.update(users).set({ role: 'owner' }).where(eq(users.id, userRecords[0].id));
        userRecords[0].role = 'owner';
      }
      req.dbUser = userRecords[0];
    } else {
      // 3. Upsert new user
      const newUser = await db.insert(users).values({
        uid: decodedToken.uid,
        email: verifiedEmail,
        name: decodedToken.name || '',
        role: roleToAssign,
      }).onConflictDoUpdate({
        target: users.uid,
        set: {
          email: verifiedEmail,
          name: decodedToken.name || '',
          role: roleToAssign,
        }
      }).returning();
      req.dbUser = newUser[0];
    }
    
    next();
  } catch (dbError: any) {
    console.error('[AUTH MIDDLEWARE] Database query failed:', dbError?.message);
    return res.status(503).json({
      success: false,
      code: 'DATABASE_UNAVAILABLE',
      message: 'Database query failed or connection lost.'
    });
  }
};

export const optionalAuth = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return next();
  }

  const token = authHeader.split('Bearer ')[1];
  let decodedToken: DecodedIdToken;
  try {
    decodedToken = await adminAuth.verifyIdToken(token);
    req.user = decodedToken;
  } catch {
    return next();
  }

  try {
    const verifiedEmail = (decodedToken.email || '').trim().toLowerCase();
    const ownerEmail = (process.env.OWNER_EMAIL || 'dhanusgoldfitness@gmail.com').trim().toLowerCase();
    const isOwner = Boolean(verifiedEmail && verifiedEmail === ownerEmail);
    if (!isOwner) {
      return next();
    }
    const roleToAssign = 'owner';

    let userRecords = await db.select().from(users).where(eq(users.uid, decodedToken.uid));
    if (userRecords.length === 0 && verifiedEmail) {
      const byEmail = await db.select().from(users).where(eq(users.email, verifiedEmail)).limit(1);
      if (byEmail.length > 0) {
        await db.update(users).set({
          uid: decodedToken.uid,
          email: verifiedEmail,
          name: decodedToken.name || byEmail[0].name,
          role: isOwner ? 'owner' : (byEmail[0].role || 'user'),
        }).where(eq(users.id, byEmail[0].id));
        byEmail[0].uid = decodedToken.uid;
        byEmail[0].email = verifiedEmail;
        byEmail[0].role = isOwner ? 'owner' : (byEmail[0].role || 'user');
        userRecords = byEmail;
      }
    }

    if (userRecords.length > 0) {
      if (isOwner && userRecords[0].role !== 'owner') {
        await db.update(users).set({ role: 'owner' }).where(eq(users.id, userRecords[0].id));
        userRecords[0].role = 'owner';
      }
      req.dbUser = userRecords[0];
    } else {
      const newUser = await db.insert(users).values({
        uid: decodedToken.uid,
        email: verifiedEmail,
        name: decodedToken.name || '',
        role: roleToAssign,
      }).onConflictDoUpdate({
        target: users.uid,
        set: {
          email: verifiedEmail,
          name: decodedToken.name || '',
          role: roleToAssign,
        }
      }).returning();
      req.dbUser = newUser[0];
    }
    next();
  } catch (dbError: any) {
    console.error('[AUTH MIDDLEWARE] Optional DB query failed:', dbError?.message);
    return res.status(503).json({
      success: false,
      code: 'DATABASE_UNAVAILABLE',
      message: 'Database query failed or connection lost.'
    });
  }
};
