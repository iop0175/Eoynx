-- =========================================================
-- Drop legacy dm_threads.room_key after encrypted-key migration
-- =========================================================

-- Safety guard 1: room_key must already be null for all rows.
do $$
declare
  v_room_key_remaining bigint;
  v_missing_encrypted_keys bigint;
begin
  select count(*)
    into v_room_key_remaining
  from public.dm_threads
  where room_key is not null;

  if v_room_key_remaining > 0 then
    raise exception 'Cannot drop room_key: % rows still have room_key.', v_room_key_remaining;
  end if;

  select count(*)
    into v_missing_encrypted_keys
  from public.dm_threads
  where encrypted_key_for_p1 is null or encrypted_key_for_p2 is null;

  if v_missing_encrypted_keys > 0 then
    raise exception 'Cannot drop room_key: % rows missing encrypted_key_for_p1/p2.', v_missing_encrypted_keys;
  end if;
end $$;

alter table public.dm_threads
drop column if exists room_key;
