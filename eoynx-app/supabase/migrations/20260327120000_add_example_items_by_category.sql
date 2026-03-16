-- Add one example item per category for the first profile (idempotent)
DO $$
DECLARE
  v_owner_id uuid;
BEGIN
  SELECT id INTO v_owner_id FROM profiles ORDER BY created_at ASC LIMIT 1;

  IF v_owner_id IS NULL THEN
    RAISE NOTICE 'No profile found. Skip example item insertion.';
    RETURN;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM items WHERE owner_id = v_owner_id AND title = 'EOYNX Example Item'
  ) THEN
    INSERT INTO items (owner_id, title, description, visibility, image_url, category, brand)
    VALUES (
      v_owner_id,
      'EOYNX Example Item',
      '검색/공유/SEO 테스트용 예시 아이템입니다.',
      'public',
      'https://images.unsplash.com/photo-1523170335258-f5ed11844a49?w=1200',
      'Luxury',
      'EOYNX'
    );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM items WHERE owner_id = v_owner_id AND title = 'EOYNX Example Accessories'
  ) THEN
    INSERT INTO items (owner_id, title, description, visibility, image_url, category, brand)
    VALUES (
      v_owner_id,
      'EOYNX Example Accessories',
      '액세서리 카테고리 예시 아이템입니다.',
      'public',
      'https://images.unsplash.com/photo-1572635196237-14b3f281503f?w=1200',
      'Accessories',
      'EOYNX'
    );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM items WHERE owner_id = v_owner_id AND title = 'EOYNX Example Cars'
  ) THEN
    INSERT INTO items (owner_id, title, description, visibility, image_url, category, brand)
    VALUES (
      v_owner_id,
      'EOYNX Example Cars',
      '차량 카테고리 예시 아이템입니다.',
      'public',
      'https://images.unsplash.com/photo-1544636331-e26879cd4d9b?w=1200',
      'Cars',
      'EOYNX'
    );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM items WHERE owner_id = v_owner_id AND title = 'EOYNX Example Real-Estate'
  ) THEN
    INSERT INTO items (owner_id, title, description, visibility, image_url, category, brand)
    VALUES (
      v_owner_id,
      'EOYNX Example Real-Estate',
      '부동산 카테고리 예시 아이템입니다.',
      'public',
      'https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=1200',
      'Real-Estate',
      'EOYNX'
    );
  END IF;
END $$;
