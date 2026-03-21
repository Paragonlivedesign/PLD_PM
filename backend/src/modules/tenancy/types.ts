export type TenantStatus = "active" | "suspended" | "deactivated";

export type TenantRow = {
  id: string;
  name: string;
  slug: string;
  status: TenantStatus;
  settings: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

export type TenantBranding = {
  company_name: string | null;
  logo_url: string | null;
  primary_color: string;
};

export type PasswordPolicy = {
  min_length: number;
  require_uppercase: boolean;
  require_number: boolean;
  require_special: boolean;
};

export type TenantSettingsResolved = {
  default_timezone: string;
  default_currency: string;
  date_format: string;
  time_format: "12h" | "24h";
  branding: TenantBranding;
  password_policy: PasswordPolicy;
  features: Record<string, unknown>;
};

export type TenantResponse = {
  id: string;
  name: string;
  slug: string;
  status: TenantStatus;
  settings: TenantSettingsResolved;
  created_at: string;
  updated_at: string;
};

export type DepartmentResponse = {
  id: string;
  name: string;
  description: string | null;
  sort_order: number;
  is_active: boolean;
  personnel_count: number | null;
  created_at: string;
  updated_at: string;
  /** Legacy fields retained for existing clients */
  head_id: string | null;
  head_name: string | null;
  color: string | null;
};
