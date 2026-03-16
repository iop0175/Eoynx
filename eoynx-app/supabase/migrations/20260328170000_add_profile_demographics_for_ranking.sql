-- Add profile demographics used for age/country percentile ranking
alter table public.profiles
  add column if not exists birth_date date,
  add column if not exists country_code text;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'profiles_country_code_format'
  ) then
    alter table public.profiles
      add constraint profiles_country_code_format
      check (country_code is null or country_code ~ '^[A-Z]{2}$');
  end if;
end $$;

create index if not exists idx_profiles_birth_date on public.profiles(birth_date);
create index if not exists idx_profiles_country_code on public.profiles(country_code);

-- Keep trigger behavior aligned with sign-up metadata
create or replace function public.handle_new_user()
returns trigger as $$
declare
  v_birth_date date;
  v_country text;
begin
  begin
    v_birth_date := nullif(new.raw_user_meta_data->>'birth_date', '')::date;
  exception when others then
    v_birth_date := null;
  end;

  v_country := upper(nullif(trim(new.raw_user_meta_data->>'country_code'), ''));
  if v_country !~ '^[A-Z]{2}$' then
    v_country := null;
  end if;

  insert into public.profiles (id, handle, display_name, birth_date, country_code)
  values (
    new.id,
    lower(split_part(new.email, '@', 1)) || '_' || substr(new.id::text, 1, 8),
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    v_birth_date,
    v_country
  );
  return new;
end;
$$ language plpgsql security definer;
