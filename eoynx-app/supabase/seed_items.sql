-- =====================================================
-- 더미 아이템 데이터 (20개)
-- Supabase Dashboard -> SQL Editor에서 실행하세요.
-- =====================================================

-- 1. 먼저 사용할 owner_id 확인
-- SELECT id, handle FROM profiles LIMIT 5;

-- 2. 아래 쿼리에서 @OWNER_ID@ 를 실제 프로필 ID로 교체 후 실행
-- 예: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'

-- =====================================================
-- 방법 A: 특정 owner_id로 직접 삽입 (추천)
-- =====================================================
/*
INSERT INTO items (owner_id, title, description, visibility, image_url, category, brand) VALUES
-- Luxury (5개)
('@OWNER_ID@', 'Rolex Submariner Date', '2024년형 블랙 세라믹 베젤, 오이스터 브레이슬릿', 'public', 'https://images.unsplash.com/photo-1547996160-81dfa63595aa?w=800', 'Luxury', 'Rolex'),
('@OWNER_ID@', 'Patek Philippe Nautilus 5711', '플래티넘 다이얼, 한정판 모델', 'public', 'https://images.unsplash.com/photo-1523170335258-f5ed11844a49?w=800', 'Luxury', 'Patek Philippe'),
('@OWNER_ID@', 'Hermès Birkin 30', '토고 레더 블랙, 골드 하드웨어', 'public', 'https://images.unsplash.com/photo-1584917865442-de89df76afd3?w=800', 'Luxury', 'Hermès'),
('@OWNER_ID@', 'Louis Vuitton Keepall 55', '모노그램 캔버스, 트래블 백', 'public', 'https://images.unsplash.com/photo-1548036328-c9fa89d128fa?w=800', 'Luxury', 'Louis Vuitton'),
('@OWNER_ID@', 'Chanel Classic Flap Medium', '캐비어 레더, 실버 하드웨어', 'public', 'https://images.unsplash.com/photo-1600857062241-98e5dba7f214?w=800', 'Luxury', 'Chanel'),
-- Accessories (5개)
('@OWNER_ID@', 'Ray-Ban Aviator Classic', '골드 프레임, 그린 G-15 렌즈', 'public', 'https://images.unsplash.com/photo-1572635196237-14b3f281503f?w=800', 'Accessories', 'Ray-Ban'),
('@OWNER_ID@', 'Cartier Love Bracelet', '18K 옐로우 골드, 다이아몬드', 'public', 'https://images.unsplash.com/photo-1611652022419-a9419f74343d?w=800', 'Accessories', 'Cartier'),
('@OWNER_ID@', 'Gucci Horsebit 1955', '레더 숄더백, 베이지/에보니', 'public', 'https://images.unsplash.com/photo-1566150905458-1bf1fc113f0d?w=800', 'Accessories', 'Gucci'),
('@OWNER_ID@', 'Tom Ford Tie', '100% 실크, 클래식 네이비', 'public', 'https://images.unsplash.com/photo-1598033129183-c4f50c736f10?w=800', 'Accessories', 'Tom Ford'),
('@OWNER_ID@', 'Montblanc Meisterstück Wallet', '풀 그레인 레더, 블랙', 'public', 'https://images.unsplash.com/photo-1627123424574-724758594e93?w=800', 'Accessories', 'Montblanc'),
-- Cars (5개)
('@OWNER_ID@', 'Porsche 911 GT3 RS', '2024 Weissach Package, 미아미 블루', 'public', 'https://images.unsplash.com/photo-1544636331-e26879cd4d9b?w=800', 'Cars', 'Porsche'),
('@OWNER_ID@', 'Ferrari SF90 Stradale', '하이브리드 1000마력, 로소 코르사', 'public', 'https://images.unsplash.com/photo-1583121274602-3e2820c69888?w=800', 'Cars', 'Ferrari'),
('@OWNER_ID@', 'Lamborghini Urus', '풀 옵션, 네로 닉타', 'public', 'https://images.unsplash.com/photo-1544829099-b9a0c07fad1a?w=800', 'Cars', 'Lamborghini'),
('@OWNER_ID@', 'Mercedes-AMG G63', '매트 블랙, 브라부스 튜닝', 'public', 'https://images.unsplash.com/photo-1520031441872-265e4ff70366?w=800', 'Cars', 'Mercedes-Benz'),
('@OWNER_ID@', 'Bentley Continental GT', 'W12 Mulliner, 로즈 골드', 'public', 'https://images.unsplash.com/photo-1563720223185-11003d516935?w=800', 'Cars', 'Bentley'),
-- Real Estate (5개)
('@OWNER_ID@', 'Penthouse in Gangnam', '강남구 청담동 300평 펜트하우스, 한강뷰', 'public', 'https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=800', 'Real-Estate', NULL),
('@OWNER_ID@', 'Manhattan Condo', '뉴욕 맨하탄 허드슨야드, 2BR', 'public', 'https://images.unsplash.com/photo-1512917774080-9991f1c4c750?w=800', 'Real-Estate', NULL),
('@OWNER_ID@', 'Beverly Hills Villa', 'LA 비버리힐스 전원주택, 수영장 포함', 'public', 'https://images.unsplash.com/photo-1580587771525-78b9dba3b914?w=800', 'Real-Estate', NULL),
('@OWNER_ID@', 'Dubai Marina Apt', '두바이 마리나 오션뷰, 3BR', 'public', 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=800', 'Real-Estate', NULL),
('@OWNER_ID@', 'Tokyo Tower View', '도쿄 미나토구 아자부, 타워뷰', 'public', 'https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?w=800', 'Real-Estate', NULL);
*/

-- =====================================================
-- 방법 B: 첫 번째 프로필에 자동 삽입 (PL/pgSQL)
-- =====================================================
DO $$
DECLARE
  v_owner_id uuid;
BEGIN
  SELECT id INTO v_owner_id FROM profiles LIMIT 1;
  
  IF v_owner_id IS NULL THEN
    RAISE EXCEPTION '프로필이 없습니다. 먼저 계정을 생성하세요.';
  END IF;

  -- Luxury (5개)
  INSERT INTO items (owner_id, title, description, visibility, image_url, category, brand) VALUES
  (v_owner_id, 'Rolex Submariner Date', '2024년형 블랙 세라믹 베젤, 오이스터 브레이슬릿', 'public', 'https://images.unsplash.com/photo-1547996160-81dfa63595aa?w=800', 'Luxury', 'Rolex'),
  (v_owner_id, 'Patek Philippe Nautilus 5711', '플래티넘 다이얼, 한정판 모델', 'public', 'https://images.unsplash.com/photo-1523170335258-f5ed11844a49?w=800', 'Luxury', 'Patek Philippe'),
  (v_owner_id, 'Hermès Birkin 30', '토고 레더 블랙, 골드 하드웨어', 'public', 'https://images.unsplash.com/photo-1584917865442-de89df76afd3?w=800', 'Luxury', 'Hermès'),
  (v_owner_id, 'Louis Vuitton Keepall 55', '모노그램 캔버스, 트래블 백', 'public', 'https://images.unsplash.com/photo-1548036328-c9fa89d128fa?w=800', 'Luxury', 'Louis Vuitton'),
  (v_owner_id, 'Chanel Classic Flap Medium', '캐비어 레더, 실버 하드웨어', 'public', 'https://images.unsplash.com/photo-1600857062241-98e5dba7f214?w=800', 'Luxury', 'Chanel');

  -- Accessories (5개)
  INSERT INTO items (owner_id, title, description, visibility, image_url, category, brand) VALUES
  (v_owner_id, 'Ray-Ban Aviator Classic', '골드 프레임, 그린 G-15 렌즈', 'public', 'https://images.unsplash.com/photo-1572635196237-14b3f281503f?w=800', 'Accessories', 'Ray-Ban'),
  (v_owner_id, 'Cartier Love Bracelet', '18K 옐로우 골드, 다이아몬드', 'public', 'https://images.unsplash.com/photo-1611652022419-a9419f74343d?w=800', 'Accessories', 'Cartier'),
  (v_owner_id, 'Gucci Horsebit 1955', '레더 숄더백, 베이지/에보니', 'public', 'https://images.unsplash.com/photo-1566150905458-1bf1fc113f0d?w=800', 'Accessories', 'Gucci'),
  (v_owner_id, 'Tom Ford Tie', '100% 실크, 클래식 네이비', 'public', 'https://images.unsplash.com/photo-1598033129183-c4f50c736f10?w=800', 'Accessories', 'Tom Ford'),
  (v_owner_id, 'Montblanc Meisterstück Wallet', '풀 그레인 레더, 블랙', 'public', 'https://images.unsplash.com/photo-1627123424574-724758594e93?w=800', 'Accessories', 'Montblanc');

  -- Cars (5개)
  INSERT INTO items (owner_id, title, description, visibility, image_url, category, brand) VALUES
  (v_owner_id, 'Porsche 911 GT3 RS', '2024 Weissach Package, 미아미 블루', 'public', 'https://images.unsplash.com/photo-1544636331-e26879cd4d9b?w=800', 'Cars', 'Porsche'),
  (v_owner_id, 'Ferrari SF90 Stradale', '하이브리드 1000마력, 로소 코르사', 'public', 'https://images.unsplash.com/photo-1583121274602-3e2820c69888?w=800', 'Cars', 'Ferrari'),
  (v_owner_id, 'Lamborghini Urus', '풀 옵션, 네로 닉타', 'public', 'https://images.unsplash.com/photo-1544829099-b9a0c07fad1a?w=800', 'Cars', 'Lamborghini'),
  (v_owner_id, 'Mercedes-AMG G63', '매트 블랙, 브라부스 튜닝', 'public', 'https://images.unsplash.com/photo-1520031441872-265e4ff70366?w=800', 'Cars', 'Mercedes-Benz'),
  (v_owner_id, 'Bentley Continental GT', 'W12 Mulliner, 로즈 골드', 'public', 'https://images.unsplash.com/photo-1563720223185-11003d516935?w=800', 'Cars', 'Bentley');

  -- Real Estate (5개)
  INSERT INTO items (owner_id, title, description, visibility, image_url, category, brand) VALUES
  (v_owner_id, 'Penthouse in Gangnam', '강남구 청담동 300평 펜트하우스, 한강뷰', 'public', 'https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=800', 'Real-Estate', NULL),
  (v_owner_id, 'Manhattan Condo', '뉴욕 맨하탄 허드슨야드, 2BR', 'public', 'https://images.unsplash.com/photo-1512917774080-9991f1c4c750?w=800', 'Real-Estate', NULL),
  (v_owner_id, 'Beverly Hills Villa', 'LA 비버리힐스 전원주택, 수영장 포함', 'public', 'https://images.unsplash.com/photo-1580587771525-78b9dba3b914?w=800', 'Real-Estate', NULL),
  (v_owner_id, 'Dubai Marina Apt', '두바이 마리나 오션뷰, 3BR', 'public', 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=800', 'Real-Estate', NULL),
  (v_owner_id, 'Tokyo Tower View', '도쿄 미나토구 아자부, 타워뷰', 'public', 'https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?w=800', 'Real-Estate', NULL);

  RAISE NOTICE '20개의 더미 아이템이 생성되었습니다. owner_id: %', v_owner_id;
END $$;

-- =====================================================
-- 방법 C: Example Item 1개만 추가
-- =====================================================
DO $$
DECLARE
  v_owner_id uuid;
BEGIN
  SELECT id INTO v_owner_id FROM profiles LIMIT 1;

  IF v_owner_id IS NULL THEN
    RAISE EXCEPTION '프로필이 없습니다. 먼저 계정을 생성하세요.';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM items
    WHERE owner_id = v_owner_id
      AND title = 'EOYNX Example Item'
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

    RAISE NOTICE 'Example item 생성 완료. owner_id: %', v_owner_id;
  ELSE
    RAISE NOTICE 'Example item이 이미 존재합니다. owner_id: %', v_owner_id;
  END IF;
END $$;
