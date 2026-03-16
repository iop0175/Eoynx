-- Link the 20 PERF DEMO items into a real collection (idempotent)
DO $$
DECLARE
  v_owner_id uuid;
  v_collection_id uuid;
BEGIN
  SELECT owner_id
    INTO v_owner_id
  FROM public.items
  WHERE title LIKE '[PERF DEMO] %'
  ORDER BY created_at ASC, id ASC
  LIMIT 1;

  IF v_owner_id IS NULL THEN
    RAISE NOTICE 'No PERF DEMO items found. Skip collection linkage.';
    RETURN;
  END IF;

  SELECT id
    INTO v_collection_id
  FROM public.collections
  WHERE owner_id = v_owner_id
    AND name = 'PERF DEMO Collection'
  LIMIT 1;

  IF v_collection_id IS NULL THEN
    INSERT INTO public.collections (owner_id, name, description, is_public)
    VALUES (
      v_owner_id,
      'PERF DEMO Collection',
      'Collection for performance benchmarking items.',
      true
    )
    RETURNING id INTO v_collection_id;
  END IF;

  INSERT INTO public.collection_items (collection_id, item_id, position)
  SELECT
    v_collection_id,
    i.id,
    ROW_NUMBER() OVER (ORDER BY i.created_at ASC, i.id ASC) - 1
  FROM public.items i
  WHERE i.owner_id = v_owner_id
    AND i.title LIKE '[PERF DEMO] %'
  ON CONFLICT (collection_id, item_id) DO NOTHING;

  RAISE NOTICE 'Linked PERF DEMO items to collection_id: %', v_collection_id;
END $$;
