import bcrypt from "bcryptjs";

const SALT_ROUNDS = 12;

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, SALT_ROUNDS);
}

export async function verifyPassword(plain: string, stored: string): Promise<boolean> {
  return bcrypt.compare(plain, stored);
}

/** Minimal policy: length >= 8 (tenant policies can extend later). */
export function assertPasswordPolicy(pw: string): void {
  if (typeof pw !== "string" || pw.length < 8) {
    throw new Error("PASSWORD_POLICY");
  }
}
