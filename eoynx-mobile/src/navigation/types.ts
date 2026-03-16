import type { Item } from "../types/item";

export type RootStackParamList = {
  Auth: undefined;
  MainTabs: undefined;
};

export type MainTabParamList = {
  Feed: undefined;
  Search: undefined;
  Add: undefined;
  Profile: undefined;
};

export type FeedStackParamList = {
  FeedList: undefined;
  FeedItemDetail: { item: Item };
  UserProfile: { ownerId: string; handle: string };
  DMInbox:
    | {
        shareText?: string;
      }
    | undefined;
  DMThread: {
    threadId: string;
    otherHandle: string;
    otherName?: string | null;
    otherAvatarUrl?: string | null;
    prefillText?: string;
  };
  DMRequests: undefined;
  NotificationsHome: undefined;
};

export type SearchStackParamList = {
  SearchHome: undefined;
  SearchUserProfile: { ownerId: string; handle: string };
};

export type AddStackParamList = {
  AddItemHome: { editItem?: Item } | undefined;
  FeedItemDetail: { item: Item };
};

export type ProfileStackParamList = {
  ProfileOverview: undefined;
  ProfileEdit: undefined;
  FeedItemDetail: { item: Item };
  SettingsHome: undefined;
};
