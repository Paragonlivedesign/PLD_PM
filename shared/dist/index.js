/** Shared types & DTOs — no business logic. */
export const SHARED_VERSION = "0.2.0";
export const EVENT_STATUSES = [
    "draft",
    "bidding",
    "confirmed",
    "in_progress",
    "completed",
    "cancelled",
];
export const EVENT_PHASES = [
    "planning",
    "pre_production",
    "production",
    "post_production",
    "closed",
];
/** Trucks module — aligned with contracts/trucks.contract.md */
export const TRUCK_TYPES = [
    "box_truck",
    "semi_trailer",
    "sprinter_van",
    "flatbed",
    "refrigerated",
    "other",
];
export const TRUCK_STATUSES = [
    "available",
    "in_use",
    "maintenance",
    "retired",
];
/** Tasks / roadmap — contracts/tasks.contract.md */
export const TASK_STATUSES = [
    "open",
    "in_progress",
    "blocked",
    "done",
    "cancelled",
];
export const TASK_PRIORITIES = ["low", "normal", "high", "urgent"];
export const TASK_TYPES = ["task", "milestone", "checklist"];
