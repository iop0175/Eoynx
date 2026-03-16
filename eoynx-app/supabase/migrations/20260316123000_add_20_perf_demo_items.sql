-- Insert 20 performance demo items for search benchmarking (idempotent)
DO $$
DECLARE
  v_owner_id uuid;
BEGIN
  SELECT id INTO v_owner_id FROM public.profiles ORDER BY created_at ASC NULLS LAST, id ASC LIMIT 1;

  IF v_owner_id IS NULL THEN
    RAISE NOTICE 'No profile found. Skip demo item insertion.';
    RETURN;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.items
    WHERE owner_id = v_owner_id
      AND title LIKE '[PERF DEMO] %'
  ) THEN
    RAISE NOTICE 'Perf demo items already exist for owner_id: %', v_owner_id;
    RETURN;
  END IF;

  INSERT INTO public.items (owner_id, title, description, visibility, image_url, category, brand)
  VALUES
    (v_owner_id, '[PERF DEMO] Rolex Submariner Date', 'Performance benchmark seed item 1', 'public', 'https://images.unsplash.com/photo-1547996160-81dfa63595aa?w=1200', 'Luxury', 'Rolex'),
    (v_owner_id, '[PERF DEMO] Patek Philippe Nautilus', 'Performance benchmark seed item 2', 'public', 'https://images.unsplash.com/photo-1523170335258-f5ed11844a49?w=1200', 'Luxury', 'Patek Philippe'),
    (v_owner_id, '[PERF DEMO] Hermes Birkin 30', 'Performance benchmark seed item 3', 'public', 'https://images.unsplash.com/photo-1584917865442-de89df76afd3?w=1200', 'Luxury', 'Hermes'),
    (v_owner_id, '[PERF DEMO] Louis Vuitton Keepall 55', 'Performance benchmark seed item 4', 'public', 'https://images.unsplash.com/photo-1548036328-c9fa89d128fa?w=1200', 'Luxury', 'Louis Vuitton'),
    (v_owner_id, '[PERF DEMO] Chanel Classic Flap', 'Performance benchmark seed item 5', 'public', 'https://images.unsplash.com/photo-1600857062241-98e5dba7f214?w=1200', 'Luxury', 'Chanel'),
    (v_owner_id, '[PERF DEMO] Ray-Ban Aviator', 'Performance benchmark seed item 6', 'public', 'https://images.unsplash.com/photo-1572635196237-14b3f281503f?w=1200', 'Accessories', 'Ray-Ban'),
    (v_owner_id, '[PERF DEMO] Cartier Love Bracelet', 'Performance benchmark seed item 7', 'public', 'https://images.unsplash.com/photo-1611652022419-a9419f74343d?w=1200', 'Accessories', 'Cartier'),
    (v_owner_id, '[PERF DEMO] Gucci Horsebit 1955', 'Performance benchmark seed item 8', 'public', 'https://images.unsplash.com/photo-1566150905458-1bf1fc113f0d?w=1200', 'Accessories', 'Gucci'),
    (v_owner_id, '[PERF DEMO] Tom Ford Tie', 'Performance benchmark seed item 9', 'public', 'https://images.unsplash.com/photo-1598033129183-c4f50c736f10?w=1200', 'Accessories', 'Tom Ford'),
    (v_owner_id, '[PERF DEMO] Montblanc Wallet', 'Performance benchmark seed item 10', 'public', 'https://images.unsplash.com/photo-1627123424574-724758594e93?w=1200', 'Accessories', 'Montblanc'),
    (v_owner_id, '[PERF DEMO] Porsche 911 GT3 RS', 'Performance benchmark seed item 11', 'public', 'https://images.unsplash.com/photo-1544636331-e26879cd4d9b?w=1200', 'Cars', 'Porsche'),
    (v_owner_id, '[PERF DEMO] Ferrari SF90 Stradale', 'Performance benchmark seed item 12', 'public', 'https://images.unsplash.com/photo-1583121274602-3e2820c69888?w=1200', 'Cars', 'Ferrari'),
    (v_owner_id, '[PERF DEMO] Lamborghini Urus', 'Performance benchmark seed item 13', 'public', 'https://images.unsplash.com/photo-1544829099-b9a0c07fad1a?w=1200', 'Cars', 'Lamborghini'),
    (v_owner_id, '[PERF DEMO] Mercedes-AMG G63', 'Performance benchmark seed item 14', 'public', 'https://images.unsplash.com/photo-1520031441872-265e4ff70366?w=1200', 'Cars', 'Mercedes-Benz'),
    (v_owner_id, '[PERF DEMO] Bentley Continental GT', 'Performance benchmark seed item 15', 'public', 'https://images.unsplash.com/photo-1563720223185-11003d516935?w=1200', 'Cars', 'Bentley'),
    (v_owner_id, '[PERF DEMO] Penthouse in Gangnam', 'Performance benchmark seed item 16', 'public', 'https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=1200', 'Real-Estate', NULL),
    (v_owner_id, '[PERF DEMO] Manhattan Condo', 'Performance benchmark seed item 17', 'public', 'https://images.unsplash.com/photo-1512917774080-9991f1c4c750?w=1200', 'Real-Estate', NULL),
    (v_owner_id, '[PERF DEMO] Beverly Hills Villa', 'Performance benchmark seed item 18', 'public', 'https://images.unsplash.com/photo-1580587771525-78b9dba3b914?w=1200', 'Real-Estate', NULL),
    (v_owner_id, '[PERF DEMO] Dubai Marina Apt', 'Performance benchmark seed item 19', 'public', 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=1200', 'Real-Estate', NULL),
    (v_owner_id, '[PERF DEMO] Tokyo Tower View', 'Performance benchmark seed item 20', 'public', 'https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?w=1200', 'Real-Estate', NULL);

  RAISE NOTICE 'Inserted 20 perf demo items for owner_id: %', v_owner_id;
END $$;
