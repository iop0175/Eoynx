export type Item = {
  id: string;
  title: string;
  description: string | null;
  image_url: string | null;
  image_urls?: string[] | null;
  brand: string | null;
  category: string | null;
  visibility: "public" | "unlisted" | "private";
  owner_id: string;
  owner: {
    handle: string;
    display_name: string | null;
    avatar_url: string | null;
  };
  created_at: string | null;
  liked?: boolean;
  bookmarked?: boolean;
  like_count?: number;
  comment_count?: number;
  comment_preview?: Array<{
    id: string;
    content: string;
    user_handle: string;
    user_display_name: string | null;
  }>;
};
