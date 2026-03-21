/** Canonical notification types (Settings UI + prefs + notifications.type). */
export const NOTIFICATION_TYPES = [
  "phase_transition",
  "scheduling_conflict",
  "budget_alert",
  "crew_assignment",
  "travel_update",
  "document_generated",
  "comment",
] as const;

export type NotificationType = (typeof NOTIFICATION_TYPES)[number];

export type NotificationChannel = "in_app" | "email" | "slack";

type ChannelDefaults = Record<NotificationChannel, boolean>;

/** Defaults aligned with legacy Settings UI matrix. */
export const DEFAULT_PREF_MATRIX: Record<NotificationType, ChannelDefaults> = {
  phase_transition: { in_app: true, email: true, slack: false },
  scheduling_conflict: { in_app: true, email: true, slack: true },
  budget_alert: { in_app: false, email: true, slack: false },
  crew_assignment: { in_app: true, email: false, slack: false },
  travel_update: { in_app: true, email: true, slack: false },
  document_generated: { in_app: true, email: false, slack: true },
  comment: { in_app: true, email: false, slack: true },
};

export function isNotificationType(s: string): s is NotificationType {
  return (NOTIFICATION_TYPES as readonly string[]).includes(s);
}

export function defaultPreferenceRows(): {
  notification_type: NotificationType;
  channel: NotificationChannel;
  enabled: boolean;
}[] {
  const out: {
    notification_type: NotificationType;
    channel: NotificationChannel;
    enabled: boolean;
  }[] = [];
  for (const t of NOTIFICATION_TYPES) {
    const d = DEFAULT_PREF_MATRIX[t];
    (["in_app", "email", "slack"] as const).forEach((c) => {
      out.push({
        notification_type: t,
        channel: c,
        enabled: d[c],
      });
    });
  }
  return out;
}
