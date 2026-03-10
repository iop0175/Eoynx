-- =====================================================
-- Storage Buckets 생성
-- =====================================================

-- items 버킷 (아이템 이미지)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'items',
  'items',
  true,
  5242880, -- 5MB
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
on conflict (id) do nothing;

-- avatars 버킷 (프로필 이미지)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'avatars',
  'avatars',
  true,
  2097152, -- 2MB
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do nothing;

-- =====================================================
-- Storage RLS Policies
-- =====================================================

-- items 버킷: 모든 사용자가 읽기 가능
drop policy if exists "items_public_read" on storage.objects;
create policy "items_public_read"
on storage.objects for select
to anon, authenticated
using (bucket_id = 'items');

-- items 버킷: 인증된 사용자만 업로드 가능 (자신의 폴더에만)
drop policy if exists "items_auth_insert" on storage.objects;
create policy "items_auth_insert"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'items'
  and (storage.foldername(name))[1] = auth.uid()::text
);

-- items 버킷: 자신이 업로드한 파일만 삭제 가능
drop policy if exists "items_auth_delete" on storage.objects;
create policy "items_auth_delete"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'items'
  and (storage.foldername(name))[1] = auth.uid()::text
);

-- avatars 버킷: 모든 사용자가 읽기 가능
drop policy if exists "avatars_public_read" on storage.objects;
create policy "avatars_public_read"
on storage.objects for select
to anon, authenticated
using (bucket_id = 'avatars');

-- avatars 버킷: 인증된 사용자만 자신의 아바타 업로드
drop policy if exists "avatars_auth_insert" on storage.objects;
create policy "avatars_auth_insert"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'avatars'
  and (storage.foldername(name))[1] = auth.uid()::text
);

-- avatars 버킷: 자신의 아바타만 삭제
drop policy if exists "avatars_auth_delete" on storage.objects;
create policy "avatars_auth_delete"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'avatars'
  and (storage.foldername(name))[1] = auth.uid()::text
);
