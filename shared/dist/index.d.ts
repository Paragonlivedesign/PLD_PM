/** Shared types & DTOs — no business logic. */
export declare const SHARED_VERSION = "0.2.0";
export declare const EVENT_STATUSES: readonly ["draft", "bidding", "confirmed", "in_progress", "completed", "cancelled"];
export type EventStatus = (typeof EVENT_STATUSES)[number];
export declare const EVENT_PHASES: readonly ["planning", "pre_production", "production", "post_production", "closed"];
export type EventPhase = (typeof EVENT_PHASES)[number];
export type ApiErrorItem = {
    code: string;
    message: string;
    field?: string;
    details?: unknown;
};
export type ApiEnvelope<T> = {
    data: T | null;
    meta: Record<string, unknown> | null;
    errors: ApiErrorItem[] | null;
};
export type ClientResponse = {
    id: string;
    name: string;
    contact_name: string | null;
    contact_email: string | null;
    phone: string | null;
    notes: string | null;
    metadata: Record<string, unknown>;
    created_at: string;
    updated_at: string;
    deleted_at: string | null;
};
/** Polymorphic contacts parent (path implies type in nested APIs). */
export type ContactParentType = "client_organization" | "vendor_organization" | "venue";
/** Single email on a CRM contact person (JSONB in DB). */
export type ContactEmailEntry = {
    address: string;
    normalized: string;
    is_primary: boolean;
    label?: string;
};
/** Single phone on a CRM contact person (JSONB in DB). */
export type ContactPhoneEntry = {
    address: string;
    /** E.164 when normalized; null if not yet parsed */
    e164: string | null;
    is_primary: boolean;
    label?: string;
};
/** Canonical tenant-scoped person; `contacts` rows are memberships under orgs. */
export type ContactPersonResponse = {
    id: string;
    tenant_id: string;
    display_name: string;
    emails: ContactEmailEntry[];
    phones: ContactPhoneEntry[];
    primary_email_normalized: string | null;
    personnel_id: string | null;
    user_id: string | null;
    metadata: Record<string, unknown>;
    created_by_user_id: string | null;
    created_at: string;
    updated_at: string;
    deleted_at: string | null;
};
/** Roster row embedded on a contact when `personnel_id` is set; field visibility matches personnel list rules. */
export type ContactPersonnelEmbed = {
    id: string;
    first_name: string;
    last_name: string;
    email: string;
    role: string;
    phone: string | null;
    department_id: string | null;
    department_name: string | null;
    day_rate: number | null;
    per_diem: number | null;
    skills: string[];
    status: string;
    employment_type: string;
    emergency_contact: unknown;
    metadata: Record<string, unknown>;
    created_at: string;
    updated_at: string;
    deactivated_at: string | null;
    version: number;
};
export type ContactResponse = {
    id: string;
    parent_type: ContactParentType;
    parent_id: string;
    /** Canonical person when migrated / created via hub. */
    person_id: string | null;
    personnel_id: string | null;
    /** Present when `personnel_id` is set; rates/contact fields may be null per caller permissions. */
    personnel?: ContactPersonnelEmbed | null;
    name: string;
    email: string | null;
    phone: string | null;
    title: string | null;
    is_primary: boolean;
    metadata: Record<string, unknown>;
    /** Embedded person summary when requested by API. */
    person?: ContactPersonResponse | null;
    created_at: string;
    updated_at: string;
    deleted_at: string | null;
};
export type VendorResponse = {
    id: string;
    name: string;
    contact_name: string | null;
    contact_email: string | null;
    phone: string | null;
    notes: string | null;
    metadata: Record<string, unknown>;
    /** Same real-world company as this client, when linked. */
    linked_client_id: string | null;
    created_at: string;
    updated_at: string;
    deleted_at: string | null;
};
export type VenueResponse = {
    id: string;
    name: string;
    city: string | null;
    address: string | null;
    latitude: number | null;
    longitude: number | null;
    timezone: string | null;
    notes: string | null;
    metadata: Record<string, unknown>;
    created_at: string;
    updated_at: string;
    deleted_at: string | null;
};
export type EventResponse = {
    id: string;
    name: string;
    client_id: string;
    venue_id: string | null;
    /** Optional CRM contact (client or venue parent); validated against event client/venue. */
    primary_contact_id: string | null;
    start_date: string;
    end_date: string;
    load_in_date: string | null;
    load_out_date: string | null;
    status: EventStatus;
    phase: EventPhase;
    description: string | null;
    tags: string[];
    metadata: Record<string, unknown>;
    /** Tenant-defined custom field values (validated by Custom Fields module). */
    custom_fields: Record<string, unknown>;
    created_at: string;
    updated_at: string;
    deleted_at: string | null;
};
export type EventListMeta = {
    cursor: string | null;
    has_more: boolean;
    total_count: number;
};
/** Trucks module — aligned with contracts/trucks.contract.md */
export declare const TRUCK_TYPES: readonly ["box_truck", "semi_trailer", "sprinter_van", "flatbed", "refrigerated", "other"];
export type TruckType = (typeof TRUCK_TYPES)[number];
export declare const TRUCK_STATUSES: readonly ["available", "in_use", "maintenance", "retired"];
export type TruckStatus = (typeof TRUCK_STATUSES)[number];
export type TruckResponse = {
    id: string;
    name: string;
    type: TruckType;
    license_plate: string | null;
    vin: string | null;
    capacity_cubic_ft: string | null;
    capacity_lbs: string | null;
    home_base: string | null;
    status: TruckStatus;
    daily_rate: string | null;
    mileage_rate: string | null;
    current_mileage: number | null;
    insurance_expiry: string | null;
    inspection_expiry: string | null;
    notes: string | null;
    metadata: Record<string, unknown>;
    custom_fields: Record<string, unknown>;
    created_at: string;
    updated_at: string;
    retired_at: string | null;
};
export type TruckAssignmentResponse = {
    id: string;
    event_id: string;
    event_name: string;
    truck_id: string;
    truck_name: string;
    purpose: string | null;
    start_date: string;
    end_date: string;
    driver_id: string | null;
    driver_name: string | null;
    total_days: number;
    notes: string | null;
    status: "tentative" | "confirmed" | "cancelled";
    has_conflicts: boolean;
    created_at: string;
    updated_at: string;
};
/** CP2 scheduling conflict taxonomy (persisted on `scheduling_conflicts.conflict_kind`). */
export type SchedulingConflictKind = "double_booking" | "drive_time_infeasible" | "truck_double_booking";
export type ConflictSummary = {
    conflict_id: string;
    resource_type: "personnel" | "truck";
    resource_id: string;
    resource_name: string;
    severity: "hard" | "soft";
    overlap_dates: string;
    conflict_kind: SchedulingConflictKind;
};
export type TruckAssignmentListMeta = {
    cursor: string | null;
    has_more: boolean;
    total_count: number;
};
export type CrewAssignmentResponse = {
    id: string;
    event_id: string;
    event_name: string;
    personnel_id: string;
    personnel_name: string;
    role: string;
    department_id: string | null;
    department_name: string | null;
    start_date: string;
    end_date: string;
    start_time: string | null;
    end_time: string | null;
    day_rate: string;
    day_rate_override: string | null;
    per_diem: string;
    per_diem_override: string | null;
    total_days: number;
    total_cost: string;
    total_per_diem: string;
    notes: string | null;
    status: "tentative" | "confirmed" | "cancelled";
    has_conflicts: boolean;
    created_at: string;
    updated_at: string;
};
export type CrewAssignmentListMeta = {
    cursor: string | null;
    has_more: boolean;
    total_count: number;
};
export type ConflictAssignmentRef = {
    assignment_id: string;
    assignment_type: "crew" | "truck";
    event_id: string;
    event_name: string;
    start_date: string;
    end_date: string;
};
export type ConflictResponse = {
    id: string;
    resource_type: "personnel" | "truck";
    resource_id: string;
    resource_name: string;
    severity: "hard" | "soft";
    status: "active" | "resolved" | "dismissed";
    assignments: ConflictAssignmentRef[];
    overlap_start: string;
    overlap_end: string;
    detected_at: string;
    resolved_at: string | null;
    conflict_kind: SchedulingConflictKind;
};
export type ConflictListMeta = {
    cursor: string | null;
    has_more: boolean;
    total_count: number;
};
export type ScheduleAssignmentBlock = {
    assignment_id: string;
    assignment_type: "crew" | "truck";
    event_id: string;
    event_name: string;
    role: string | null;
    start_date: string;
    end_date: string;
    status: string;
    has_conflicts: boolean;
};
export type ScheduleResourceRow = {
    resource_type: "personnel" | "truck" | "event";
    resource_id: string;
    resource_name: string;
    assignments: ScheduleAssignmentBlock[];
};
export type ScheduleViewResponse = {
    view: string;
    range: {
        start: string;
        end: string;
    };
    resources: ScheduleResourceRow[];
};
export type ScheduleTruckRouteBlock = {
    route_id: string;
    event_id: string;
    event_name: string;
    truck_id: string;
    truck_name: string;
    departure_datetime: string;
    estimated_arrival: string;
    status: string;
    schedule_conflict_hint: string | null;
};
export type ScheduleViewMeta = {
    total_assignments: number;
    conflict_count: number;
    truck_route_blocks: ScheduleTruckRouteBlock[];
};
export type BulkSkippedItem = {
    index: number;
    reason: string;
    conflicts: ConflictSummary[];
};
export type BulkAssignmentResult = {
    created: (CrewAssignmentResponse | TruckAssignmentResponse)[];
    skipped: BulkSkippedItem[];
};
/** Structured route endpoint (contract: trucks 1.1). */
export type RouteLocationRef = {
    kind: "address";
    text: string;
} | {
    kind: "coordinates";
    latitude: number;
    longitude: number;
    label?: string | null;
} | {
    kind: "venue";
    venue_id: string;
} | {
    kind: "contact";
    contact_id: string;
    use?: "primary" | "custom";
    custom_address?: string | null;
};
export type RouteLegSummary = {
    distance_miles: string;
    duration_seconds: number;
    start_index: number;
    end_index: number;
};
export type RouteGeometryResponse = {
    encoded_polyline?: string;
    geojson?: {
        type: "LineString";
        coordinates: [number, number][];
    };
    provider: string;
    computed_at: string;
    legs?: RouteLegSummary[];
    traffic_aware?: boolean;
};
export type RouteWaypointResponse = {
    location: string;
    location_ref: Record<string, unknown>;
    purpose: string | null;
    estimated_arrival: string | null;
    estimated_departure: string | null;
    actual_arrival: string | null;
    actual_departure: string | null;
    order: number;
};
export type TruckRouteResponse = {
    id: string;
    event_id: string;
    event_name: string;
    truck_id: string;
    truck_name: string;
    assignment_id: string | null;
    driver_id: string | null;
    driver_name: string | null;
    origin: string;
    destination: string;
    origin_ref: Record<string, unknown>;
    destination_ref: Record<string, unknown>;
    waypoints: RouteWaypointResponse[];
    departure_datetime: string;
    estimated_arrival: string;
    actual_arrival: string | null;
    distance_miles: string | null;
    actual_distance_miles: string | null;
    estimated_fuel_cost: string | null;
    actual_fuel_cost: string | null;
    cargo_description: string | null;
    notes: string | null;
    metadata: Record<string, unknown>;
    route_geometry: RouteGeometryResponse | null;
    traffic_aware: boolean;
    provider_computed_at: string | null;
    driver_share_url: string | null;
    driver_share_expires_at: string | null;
    schedule_conflict_hint: string | null;
    status: "planned" | "in_transit" | "completed" | "cancelled";
    created_at: string;
    updated_at: string;
};
export type TruckRoutePublicResponse = {
    id: string;
    event_name: string;
    truck_name: string;
    origin: string;
    destination: string;
    waypoints: RouteWaypointResponse[];
    departure_datetime: string;
    estimated_arrival: string;
    route_geometry: RouteGeometryResponse | null;
    status: TruckRouteResponse["status"];
    driver_share_expires_at: string | null;
};
/** Tasks / roadmap — contracts/tasks.contract.md */
export declare const TASK_STATUSES: readonly ["open", "in_progress", "blocked", "done", "cancelled"];
export type TaskStatus = (typeof TASK_STATUSES)[number];
export declare const TASK_PRIORITIES: readonly ["low", "normal", "high", "urgent"];
export type TaskPriority = (typeof TASK_PRIORITIES)[number];
export declare const TASK_TYPES: readonly ["task", "milestone", "checklist"];
export type TaskTypeEnum = (typeof TASK_TYPES)[number];
export type TaskResponse = {
    id: string;
    title: string;
    description: string | null;
    status: TaskStatus;
    priority: TaskPriority;
    task_type: TaskTypeEnum;
    event_id: string | null;
    assignee_personnel_id: string | null;
    parent_task_id: string | null;
    start_at: string | null;
    due_at: string | null;
    completion_percent: number | null;
    tags: string[];
    sort_order: number;
    metadata: Record<string, unknown>;
    created_by: string | null;
    created_at: string;
    updated_at: string;
    deleted_at: string | null;
};
export type TaskListMeta = {
    cursor: string | null;
    has_more: boolean;
    total_count: number;
};
