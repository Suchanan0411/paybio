-- ธีมหน้าร้าน: { palette, font, custom_color } (Pro: palette + font, Business: + custom_color)
alter table public.profiles
  add column if not exists theme jsonb not null default '{}'::jsonb;

notify pgrst, 'reload schema';
