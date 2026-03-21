export type UserRow = {
  id: string;
  tenant_id: string;
  email: string;
  password_hash: string;
  role_id: string;
  role_name: string;
  personnel_id: string | null;
  first_name: string;
  last_name: string;
  phone: string | null;
  preferences: Record<string, unknown>;
  is_active: boolean;
  failed_login_attempts: number;
  locked_until: Date | null;
  last_login_at: Date | null;
  created_at: Date;
  updated_at: Date;
};

export type JwtClaims = {
  sub: string;
  tid: string;
  role: string;
  pid: string | null;
};
