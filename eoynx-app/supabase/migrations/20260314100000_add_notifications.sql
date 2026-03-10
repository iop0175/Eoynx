-- =====================================================
-- Notifications Table
-- =====================================================

DROP TABLE IF EXISTS notifications CASCADE;

CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('follow', 'like', 'comment', 'dm', 'dm_request')),
  
  -- Actor who triggered the notification
  actor_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  
  -- Related entities (nullable based on type)
  item_id UUID REFERENCES items(id) ON DELETE CASCADE,
  comment_id UUID REFERENCES comments(id) ON DELETE CASCADE,
  thread_id UUID REFERENCES dm_threads(id) ON DELETE CASCADE,
  
  -- Content preview (for comments/messages)
  preview TEXT,
  
  -- Read status
  read_at TIMESTAMP WITH TIME ZONE,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- Indexes for performance
CREATE INDEX idx_notifications_user_id ON notifications(user_id);
CREATE INDEX idx_notifications_user_unread ON notifications(user_id) WHERE read_at IS NULL;
CREATE INDEX idx_notifications_created_at ON notifications(created_at DESC);

-- =====================================================
-- RLS Policies
-- =====================================================

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Users can only see their own notifications
DROP POLICY IF EXISTS notifications_select_owner ON notifications;
CREATE POLICY notifications_select_owner ON notifications
  FOR SELECT USING (user_id = auth.uid());

-- Users can update their own notifications (mark as read)
DROP POLICY IF EXISTS notifications_update_owner ON notifications;
CREATE POLICY notifications_update_owner ON notifications
  FOR UPDATE USING (user_id = auth.uid());

-- Users can delete their own notifications
DROP POLICY IF EXISTS notifications_delete_owner ON notifications;
CREATE POLICY notifications_delete_owner ON notifications
  FOR DELETE USING (user_id = auth.uid());

-- Service role can insert notifications (via server actions)
DROP POLICY IF EXISTS notifications_insert_service ON notifications;
CREATE POLICY notifications_insert_service ON notifications
  FOR INSERT WITH CHECK (true);
