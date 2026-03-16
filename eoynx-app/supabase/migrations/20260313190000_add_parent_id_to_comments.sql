-- Enable nested replies for comments
ALTER TABLE public.comments
ADD COLUMN IF NOT EXISTS parent_id uuid NULL REFERENCES public.comments(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_comments_parent_id ON public.comments(parent_id);
