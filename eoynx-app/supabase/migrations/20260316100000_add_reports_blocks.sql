-- =====================================================
-- Reports Table
-- =====================================================

DROP TABLE IF EXISTS reports CASCADE;

CREATE TABLE reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reported_user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  reported_item_id UUID REFERENCES items(id) ON DELETE CASCADE,
  reported_comment_id UUID REFERENCES comments(id) ON DELETE CASCADE,
  reason TEXT NOT NULL,
  description TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'reviewed', 'resolved', 'dismissed')),
  created_at TIMESTAMPTZ DEFAULT now(),
  reviewed_at TIMESTAMPTZ,
  reviewed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  
  -- At least one of the reported entities must be set
  CONSTRAINT report_target_check CHECK (
    reported_user_id IS NOT NULL OR 
    reported_item_id IS NOT NULL OR 
    reported_comment_id IS NOT NULL
  )
);

-- Index for querying reports
CREATE INDEX idx_reports_reporter ON reports(reporter_id);
CREATE INDEX idx_reports_status ON reports(status);
CREATE INDEX idx_reports_created ON reports(created_at DESC);

-- =====================================================
-- Blocks Table
-- =====================================================

DROP TABLE IF EXISTS blocks CASCADE;

CREATE TABLE blocks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  blocker_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  blocked_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  
  UNIQUE(blocker_id, blocked_id)
);

-- Index for checking if user is blocked
CREATE INDEX idx_blocks_blocker ON blocks(blocker_id);
CREATE INDEX idx_blocks_blocked ON blocks(blocked_id);

-- =====================================================
-- RLS Policies
-- =====================================================

ALTER TABLE reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE blocks ENABLE ROW LEVEL SECURITY;

-- Reports: Users can only create reports, admins can view all
DROP POLICY IF EXISTS reports_insert_auth ON reports;
CREATE POLICY reports_insert_auth ON reports 
  FOR INSERT 
  WITH CHECK (auth.uid() = reporter_id);

DROP POLICY IF EXISTS reports_select_own ON reports;
CREATE POLICY reports_select_own ON reports 
  FOR SELECT 
  USING (auth.uid() = reporter_id);

-- Blocks: Users can manage their own blocks
DROP POLICY IF EXISTS blocks_insert_owner ON blocks;
CREATE POLICY blocks_insert_owner ON blocks 
  FOR INSERT 
  WITH CHECK (auth.uid() = blocker_id);

DROP POLICY IF EXISTS blocks_select_owner ON blocks;
CREATE POLICY blocks_select_owner ON blocks 
  FOR SELECT 
  USING (auth.uid() = blocker_id OR auth.uid() = blocked_id);

DROP POLICY IF EXISTS blocks_delete_owner ON blocks;
CREATE POLICY blocks_delete_owner ON blocks 
  FOR DELETE 
  USING (auth.uid() = blocker_id);
