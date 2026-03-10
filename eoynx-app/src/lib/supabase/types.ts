// =====================================================
// Eoynx Supabase 데이터베이스 타입 정의
// 참고: supabase gen types 명령어로 자동 생성 가능
// =====================================================

// ENUMS
export type Visibility = 'public' | 'unlisted' | 'private';
export type ValueTrack = 'unverified' | 'verified';

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          handle: string;
          display_name: string | null;
          bio: string | null;
          avatar_url: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          handle: string;
          display_name?: string | null;
          bio?: string | null;
          avatar_url?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          handle?: string;
          display_name?: string | null;
          bio?: string | null;
          avatar_url?: string | null;
          updated_at?: string;
        };
      };
      items: {
        Row: {
          id: string;
          owner_id: string;
          title: string;
          description: string | null;
          visibility: Visibility;
          image_url: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          owner_id: string;
          title: string;
          description?: string | null;
          visibility?: Visibility;
          image_url?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          owner_id?: string;
          title?: string;
          description?: string | null;
          visibility?: Visibility;
          image_url?: string | null;
          updated_at?: string;
        };
      };
      item_values: {
        Row: {
          id: string;
          item_id: string;
          track: ValueTrack;
          currency: string;
          minor_unit: number;
          value_minor: number | null;
          verified_median_minor: number | null;
          verified_min_minor: number | null;
          verified_max_minor: number | null;
          note: string | null;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          item_id: string;
          track: ValueTrack;
          currency?: string;
          minor_unit?: number;
          value_minor?: number | null;
          verified_median_minor?: number | null;
          verified_min_minor?: number | null;
          verified_max_minor?: number | null;
          note?: string | null;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          item_id?: string;
          track?: ValueTrack;
          currency?: string;
          minor_unit?: number;
          value_minor?: number | null;
          verified_median_minor?: number | null;
          verified_min_minor?: number | null;
          verified_max_minor?: number | null;
          note?: string | null;
          created_by?: string | null;
          updated_at?: string;
        };
      };
      verified_sources: {
        Row: {
          id: string;
          item_value_id: string;
          label: string;
          url: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          item_value_id: string;
          label: string;
          url?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          item_value_id?: string;
          label?: string;
          url?: string | null;
        };
      };
      collections: {
        Row: {
          id: string;
          owner_id: string;
          name: string;
          description: string | null;
          is_public: boolean;
          cover_image_url: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          owner_id: string;
          name: string;
          description?: string | null;
          is_public?: boolean;
          cover_image_url?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          owner_id?: string;
          name?: string;
          description?: string | null;
          is_public?: boolean;
          cover_image_url?: string | null;
          updated_at?: string;
        };
      };
      collection_items: {
        Row: {
          id: string;
          collection_id: string;
          item_id: string;
          position: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          collection_id: string;
          item_id: string;
          position?: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          collection_id?: string;
          item_id?: string;
          position?: number;
        };
      };
    };
    Enums: {
      visibility: Visibility;
      value_track: ValueTrack;
    };
  };
}

// 편의를 위한 타입 별칭
export type Profile = Database['public']['Tables']['profiles']['Row'];
export type ProfileInsert = Database['public']['Tables']['profiles']['Insert'];
export type ProfileUpdate = Database['public']['Tables']['profiles']['Update'];

export type Item = Database['public']['Tables']['items']['Row'];
export type ItemInsert = Database['public']['Tables']['items']['Insert'];
export type ItemUpdate = Database['public']['Tables']['items']['Update'];

export type ItemValue = Database['public']['Tables']['item_values']['Row'];
export type ItemValueInsert = Database['public']['Tables']['item_values']['Insert'];
export type ItemValueUpdate = Database['public']['Tables']['item_values']['Update'];

export type VerifiedSource = Database['public']['Tables']['verified_sources']['Row'];
export type VerifiedSourceInsert = Database['public']['Tables']['verified_sources']['Insert'];
export type VerifiedSourceUpdate = Database['public']['Tables']['verified_sources']['Update'];

export type Collection = Database['public']['Tables']['collections']['Row'];
export type CollectionInsert = Database['public']['Tables']['collections']['Insert'];
export type CollectionUpdate = Database['public']['Tables']['collections']['Update'];

export type CollectionItem = Database['public']['Tables']['collection_items']['Row'];
export type CollectionItemInsert = Database['public']['Tables']['collection_items']['Insert'];
export type CollectionItemUpdate = Database['public']['Tables']['collection_items']['Update'];

// 관계가 포함된 타입
export type ItemWithOwner = Item & {
  profiles: Profile;
};

export type ItemWithValues = Item & {
  item_values: ItemValue[];
};

export type ItemFull = Item & {
  profiles: Profile;
  item_values: (ItemValue & {
    verified_sources: VerifiedSource[];
  })[];
};

export type CollectionWithItems = Collection & {
  collection_items: (CollectionItem & {
    items: Item;
  })[];
};
