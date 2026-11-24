CREATE TABLE IF NOT EXISTS public.home_hero_settings (
  id SMALLINT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  image_url TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

ALTER TABLE public.home_hero_settings ENABLE ROW LEVEL SECURITY;

-- Access is handled through the server-side service-role client.
-- No direct browser access policies are intentionally created.