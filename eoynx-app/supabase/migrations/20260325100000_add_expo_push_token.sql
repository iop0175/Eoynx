-- Add Expo push token field for mobile background notifications
alter table public.profiles
  add column if not exists expo_push_token text;

comment on column public.profiles.expo_push_token is 'Expo push token for mobile push notifications';
