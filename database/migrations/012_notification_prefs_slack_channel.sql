-- Allow Slack channel in notification_preferences (persisted; outbound delivery is a future worker).
ALTER TABLE notification_preferences
  DROP CONSTRAINT IF EXISTS notification_preferences_channel_check;

ALTER TABLE notification_preferences
  ADD CONSTRAINT notification_preferences_channel_check
  CHECK (channel IN ('in_app', 'email', 'slack'));
