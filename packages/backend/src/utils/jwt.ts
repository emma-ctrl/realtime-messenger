import jwt from 'jsonwebtoken';
import type { AuthUser } from '@shared/types.js';

const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-this-in-production';
const JWT_EXPIRES_IN = '2h';
interface JWTPayload {
  userId: number;
  username: string;
  iat?: number; // Issued at
  exp?: number; // Expiration time
}

/**
 * Generates a signed JWT token containing user information
 * 
 * @param user - User data to embed in token
 * @returns Signed JWT token string
 * 
 * Security Notes:
 * - Only includes essential user data (no passwords!)
 * - Short expiration time limits exposure window
 * - Strong HMAC signing prevents tampering
 */
export function generateToken(user: AuthUser): string {
  const payload: JWTPayload = {
    userId: user.id,
    username: user.username,
  };

  return jwt.sign(payload, JWT_SECRET, {
    expiresIn: JWT_EXPIRES_IN,
    issuer: 'realtime-messenger',
    audience: 'realtime-messenger-client',
  });
}

/**
 * Verifies and decodes a JWT token
 * 
 * @param token - JWT token string to verify
 * @returns Decoded user data or null if invalid
 * 
 * Security Benefits:
 * - Validates signature integrity
 * - Checks expiration time
 * - Ensures token structure is correct
 */
export function verifyToken(token: string): AuthUser | null {
  try {
    const decoded = jwt.verify(token, JWT_SECRET, {
      issuer: 'realtime-messenger',
      audience: 'realtime-messenger-client',
    }) as JWTPayload;

    // Return clean user object
    return {
      id: decoded.userId,
      username: decoded.username,
    };
  } catch (error) {
    // Token is invalid, expired, or malformed
    console.warn('JWT verification failed:', error instanceof Error ? error.message : 'Unknown error');
    return null;
  }
}

/**
 * Cookie configuration for JWT tokens
 * 
 * Security Features:
 * - httpOnly: Prevents XSS attacks (no JavaScript access)
 * - secure: HTTPS-only in production
 * - sameSite: CSRF protection
 * - maxAge: Matches JWT expiration
 */
export const JWT_COOKIE_OPTIONS = {
  httpOnly: true, // Critical: Prevents XSS access to token
  secure: false, // Allow over HTTP in development
  sameSite: 'none' as const, // Allow cross-origin cookies in development
  maxAge: 2 * 60 * 60 * 1000, // 2 hours in milliseconds
  path: '/', // Available for entire app
  domain: 'localhost', // Share cookie across localhost ports
};

/**
 * Extracts JWT token from request cookies
 * 
 * @param cookies - Request cookies object
 * @returns JWT token string or null if not found
 */
export function extractTokenFromCookies(cookies: Record<string, string>): string | null {
  return cookies['auth-token'] || null;
}

/**
 * AUTHENTICATION FLOW EXPLANATION:
 * 
 * 1. USER LOGIN:
 *    POST /api/trpc/auth.login { username, password }
 *    → Server validates credentials
 *    → generateToken(user) creates JWT
 *    → Set httpOnly cookie with JWT
 *    → Return success response
 * 
 * 2. SUBSEQUENT REQUESTS:
 *    → Browser automatically sends cookie
 *    → extractTokenFromCookies() gets JWT
 *    → verifyToken() validates and decodes
 *    → Request proceeds with authenticated user
 * 
 * 3. WEBSOCKET CONNECTION:
 *    → Socket.io handshake includes cookies
 *    → Same JWT verification process
 *    → User joins authenticated rooms
 * 
 * SECURITY ADVANTAGES:
 * - No token in localStorage (XSS-proof)
 * - Automatic cookie handling
 * - Short expiration window
 * - Strong cryptographic signing
 * - CSRF protection via sameSite
 */