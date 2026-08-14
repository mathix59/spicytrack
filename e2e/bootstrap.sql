INSERT INTO instance_settings (
  id,
  registrations_enabled,
  smtp_host,
  smtp_port,
  smtp_from,
  updated_at
)
VALUES (
  true,
  true,
  'mailpit',
  1025,
  'noreply@spicytrack.local',
  NOW()
)
ON CONFLICT (id) DO UPDATE SET
  registrations_enabled = EXCLUDED.registrations_enabled,
  smtp_host = EXCLUDED.smtp_host,
  smtp_port = EXCLUDED.smtp_port,
  smtp_from = EXCLUDED.smtp_from,
  updated_at = NOW();
