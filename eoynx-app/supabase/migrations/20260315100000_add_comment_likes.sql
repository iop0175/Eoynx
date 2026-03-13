-- =====================================================
-- Comment Likes Table
-- =====================================================

DROP TABLE IF EXISTS comment_likes CASCADE;

CREATE TABLE comment_likes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  comment_id UUID NOT NULL REFERENCES comments(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  UNIQUE(comment_id, user_id)
);

-- Indexes for performance
CREATE INDEX idx_comment_likes_comment_id ON comment_likes(comment_id);
CREATE INDEX idx_comment_likes_user_id ON comment_likes(user_id);

-- =====================================================
-- RLS Policies
-- =====================================================

ALTER TABLE comment_likes ENABLE ROW LEVEL SECURITY;

-- Anyone can view comment likes
DROP POLICY IF EXISTS comment_likes_select_all ON comment_likes;
CREATE POLICY comment_likes_select_all ON comment_likes
  FOR SELECT USING (true);

-- Logged-in users can like comments
DROP POLICY IF EXISTS comment_likes_insert_auth ON comment_likes;
CREATE POLICY comment_likes_insert_auth ON comment_likes
  FOR INSERT WITH CHECK (user_id = auth.uid());

-- Users can unlike (delete their own likes)
DROP POLICY IF EXISTS comment_likes_delete_owner ON comment_likes;
CREATE POLICY comment_likes_delete_owner ON comment_likes
  FOR DELETE USING (user_id = auth.uid());
