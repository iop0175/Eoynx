-- =========================================================
-- Fix: allow DM participants to update read_at
-- =========================================================

alter table public.dm_messages enable row level security;

drop policy if exists "dm_messages_update_participant" on public.dm_messages;
create policy "dm_messages_update_participant"
on public.dm_messages for update
using (
  exists (
    select 1
    from public.dm_threads
    where dm_threads.id = dm_messages.thread_id
      and (dm_threads.participant1_id = auth.uid() or dm_threads.participant2_id = auth.uid())
  )
)
with check (
  exists (
    select 1
    from public.dm_threads
    where dm_threads.id = dm_messages.thread_id
      and (dm_threads.participant1_id = auth.uid() or dm_threads.participant2_id = auth.uid())
  )
);
