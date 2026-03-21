export type EmploymentType = "full_time" | "part_time" | "freelance" | "contractor";
export type PersonnelStatus = "active" | "inactive" | "on_leave";

export type EmergencyContact = {
  name: string;
  relationship: string;
  phone: string;
  email: string | null;
};

export type PersonnelResponse = {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string | null;
  department_id: string | null;
  department_name: string | null;
  role: string;
  employment_type: EmploymentType;
  day_rate: number | null;
  per_diem: number | null;
  skills: string[];
  status: PersonnelStatus;
  emergency_contact: EmergencyContact | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
  deactivated_at: string | null;
  /** Row version for optimistic locking on PUT (send last seen value as `version`). */
  version: number;
};

/** Alias — same shape as API row (includes `version`). */
export type PersonnelRowInternal = PersonnelResponse;

export type DepartmentResponse = {
  id: string;
  name: string;
  description: string | null;
  sort_order: number;
  is_active: boolean;
  head_id: string | null;
  head_name: string | null;
  color: string | null;
  personnel_count: number | null;
  created_at: string;
  updated_at: string;
};

export type InvitationResponse = {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  role: string;
  department_id: string | null;
  status: "pending" | "accepted" | "expired" | "revoked";
  invited_by: string;
  expires_at: string;
  accepted_at: string | null;
  created_at: string;
};

export type AvailabilityDay = {
  date: string;
  available: boolean;
  assignments: {
    assignment_id: string;
    event_id: string;
    event_name: string;
    role: string;
  }[];
};
