create or replace function public.delete_my_account()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  target_user_id uuid;
begin
  target_user_id := auth.uid();

  if target_user_id is null then
    raise exception 'not_authenticated';
  end if;

  if to_regprocedure('auth.admin_delete_user(uuid)') is not null then
    perform auth.admin_delete_user(target_user_id);
    return;
  end if;

  if to_regclass('auth.sessions') is not null then
    execute 'delete from auth.sessions where user_id = $1' using target_user_id;
  end if;

  if to_regclass('auth.identities') is not null then
    execute 'delete from auth.identities where user_id = $1' using target_user_id;
  end if;

  delete from auth.users
  where id = target_user_id;

  if not found then
    raise exception 'delete_failed';
  end if;
end;
$$;

revoke all on function public.delete_my_account() from public;
grant execute on function public.delete_my_account() to authenticated;
