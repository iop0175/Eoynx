# EOYNX — Project Plan (MVP)

> Owner: 대장 (Las Vintkl)
> 
> Repo: `C:\git\Eoynx\eoynx-app`
> 
> Stack: Next.js (App Router) + Supabase (Postgres/Auth/Storage) + Vercel
> 
> Principle: **SEO-first** (public profiles/items) → viral (percentile/share) → native (Expo) later

## 0) North Star
Create a public-first luxury collection community where **profiles and items are indexable** and easy to share.

### Success signals (MVP)
- Public profile pages indexed and receiving organic impressions
- Public item pages indexed and receiving long-tail traffic
- Share links produce repeat visits (viral loop starts)

## 1) Scope

### MVP (now)
- Public pages:
  - Profile: `/u/[handle]`
  - Item: `/i/[id]`
  - Collections: `/u/[handle]/collections`, `/c/[id]`
  - Search: `/search` (People + Items sections)
- App pages (noindex):
  - Feed: `/feed` (public-only feed)
  - Add flow: `/add`, `/add/details` (photos-first, visibility segmented)
  - DM: `/dm`, `/dm/requests`, `/dm/[threadId]` (skeleton)
  - Settings: `/settings`
  - Auth entry: `/auth`
- Visibility:
  - `public` (SEO indexable)
  - `unlisted` (link-only; **noindex**)
  - `private` (owner-only)
- Value model (2-track):
  - Unverified value (self-reported)
  - Verified value (median + range + sources)

### Post-MVP
- Full auth UX (Google + email/password)
- Real DM system (threads/messages, requests gating)
- Comments (Public + Unlisted only)
- Percentiles / share cards generation (9:16)
- Push notifications (DM + comments + follow)
- Native app (Expo)

## 2) Product policies (canonical)
- Default item visibility: **Public** (SEO-first)
- Unlisted: page is accessible by link, but set `robots: noindex, nofollow`
- Private: only owner can access (RLS), and page should resolve as notFound
- Feed: **Public only**
- Collections:
  - Public collections indexable
  - Private collection visible to owner only

## 3) Information architecture (routes)

### Public/SEO
- `/` marketing landing (indexable)
- `/u/[handle]` public profile (indexable)
- `/i/[id]` item detail (indexable if public)
- `/u/[handle]/collections` (indexable)
- `/c/[id]` collection detail (indexable if collection public)
- `/search` (indexable or optional; currently indexable)

### App/noindex
- `/feed` home feed (noindex)
- `/add`, `/add/details` (noindex)
- `/dm`, `/dm/requests`, `/dm/[threadId]` (noindex)
- `/settings` (noindex)
- `/auth` (noindex)
- `/debug/supabase` (noindex)

## 4) Data model (Supabase)

### Tables (current “완전판” schema)
- `profiles` (id=auth.users.id, handle, display_name, bio, avatar_url, timestamps)
- `items` (owner_id, title, description, visibility, image_url, timestamps)
- `item_values` (track, currency, minor_unit, value_minor, verified_*_minor, sources)
- `verified_sources` (item_value_id, label, url)
- `collections` (owner_id, name, description, is_public)
- `collection_items` (collection_id, item_id, position)
- `followers` (follower_id, following_id, created_at) ← **NEW**

### Key implementation notes
- Money stored as **minor units** (bigint) + currency + minor_unit
- Handle auto-generated via `on_auth_user_created` trigger
- Followers table enables follow/following counts on profiles

## 5) Security / access control

### RLS rules (MVP)
- `profiles`: public select; owner update
- `items`: public/unlisted select for all; private select for owner; owner write
- `item_values` / `verified_sources`: visible if parent item visible
- `collections`: public select if `is_public`; owner select if private; owner write
- `collection_items`: visible if parent collection visible; owner write
- `followers`: public select; insert/delete only by follower (self)

### SEO robots rules (app-side)
- Unlisted items: `robots: { index:false, follow:false }`
- Private/missing: noindex + notFound
- Debug/auth/settings/add/dm/feed: noindex

## 6) Current implementation status (code)

### ✅ Build health
- `npm run lint` PASS
- `npm run build` PASS

### ✅ Core systems
- **i18n**: `next-intl` with Korean (ko) and English (en) support
  - Auto-detects browser language
  - Language switcher in Settings
  - Translation files: `messages/ko.json`, `messages/en.json`
- **Theme**: Dark/Light mode toggle (Tailwind v4)
  - Uses `@custom-variant dark` for class-based switching
  - Persists to localStorage
  - System preference detection

### ✅ Database integration
- Profile page: Stats (Items/Followers/Following) connected to real data
- Profile page: Items list from DB
- Item detail: Verified value + sources
- Search: Real-time people + items search
- Feed: Public items feed
- Collections: List + detail pages

### ✅ Real-time synchronization (new)
- WEB DM thread: receive new message INSERT events immediately and refresh the thread UI
- DM Inbox: detect thread/message changes in real time and update list + unread counts
- Feed likes: update per-card like count and "liked by me" state immediately on `likes` table changes
- Notifications: keep existing real-time subscription behavior (no regression)

### ✅ Item CRUD (Full)
- **Create**: Single-form add page with multi-image upload (primary + sub images)
- **Read**: Item detail page with image slider
- **Update**: Edit form with image management
- **Delete**: Delete confirmation and removal

### ✅ Feed & Search UI
- Feed: Category tabs (For you, Luxury, Accessories, Cars, Real Estate)
- Feed: FeedCard with user header, image slider, Like/Comment/Share/Bookmark buttons
- Search: Shows items in Feed style using FeedCard

### ✅ Profile System
- Profile page: Avatar, display name, bio, Follow/Message buttons
- Profile page: "Top X%" stats display
- Profile page: Category tabs (Overall, Luxury, Accessories, Cars)
- Profile page: 2-column item grid with likes/share
- Profile Settings: Avatar upload/remove, display name edit, bio edit (160 char)
- Navigation: Dynamic profile link based on logged-in user

### ✅ Image Management
- Multi-image upload with preview
- Image slider (ChevronLeft/ChevronRight navigation)
- Primary image + sub-images support
- Storage bucket: `items` (5MB limit per image)
- Avatar storage: `avatars` bucket (2MB limit)

### ✅ UI skeleton coverage (Figma-aligned)
- Top bar: icon-only (Feed/Search/Add/DM/Settings/Profile)
- Search: People + Items sections (now with FeedCard)
- Collections: list + detail
- Item: visibility badge + verified value block + sources chips
- DM: inbox/requests/thread skeleton
- Add: Single-form (unified photos + details)

## 7) To-Do List (해야 할 일)

### Priority 1 — Social Features ✅
- [x] Follow/Unfollow functionality (insert/delete followers)
- [x] Like functionality (items)
- [x] Bookmark/Save functionality (items)
- [x] Follower/Following counts update in real-time

### Priority 2 — SEO & Marketing ✅
- [x] OG images for profiles and items
- [x] Proper meta tags and descriptions
- [x] sitemap.xml generation
- [x] robots.txt configuration
- [ ] Landing page (/) design (optional)

### Priority 3 — Collections ✅
- [x] Create collection flow
- [x] Add item to collection
- [x] Collection detail page with items
- [x] Public/Private collection toggle

### Priority 4 — Comments ✅
- [x] Comment model in database
- [x] Comment list on item detail
- [x] Add comment functionality
- [x] Comment count display
- [x] Comment likes with like count

### Priority 5 — DM System ✅
- [x] Real message threads (not skeleton)
- [x] Send/receive messages
- [x] DM requests for non-followers
- [x] Unread message indicators

### Priority 6 — Notifications ✅
- [x] Notification system design
- [x] New follower notifications
- [x] Like/comment notifications
- [x] DM notifications
- [x] Notification badge in navbar

### Priority 7 — Profile Customization ✅
- [x] Handle (username) can be changed with uniqueness check
- [x] Display name editable (allows duplicates)
- [x] Real-time handle availability check

### Priority 8 — Feed Enhancements ✅
- [x] Feed card dropdown for item details (description, brand, category)
- [x] Inline comments in feed card
- [x] Top 3 comments preview (sorted by likes)
- [x] Comment like/unlike directly in feed

### Priority 9 — Percentile System ✅
- [x] Percentile calculation logic based on collection value
- [x] Category-specific percentiles (Luxury, Accessories, Cars)
- [x] Profile page percentile display with category switching
- [x] Fallback to item count when no values

### Priority 10 — Real-time updates ✅
- [x] WEB DM thread: immediate UI refresh on new message INSERT
- [x] DM Inbox: real-time thread/message detection for list + unread updates
- [x] Feed likes: immediate like count / my-like state sync from `likes` changes
- [x] Notifications: preserve existing real-time subscription behavior

### Priority 11 — Report / Block ✅
- [x] User report flow (ReportModal)
- [x] Block/unblock users
- [x] Blocked users list (`/settings/blocked`)
- [x] Hide blocked users from feed/comments

### Priority 12 — Followers / Following Pages ✅
- [x] Followers page (`/u/[handle]/followers`)
- [x] Following page (`/u/[handle]/following`)
- [x] Unfollow action from following page

### Priority 13 — DM Settings ✅
- [x] `dm_open` profile setting (Open / Request Required)
- [x] DM mode switch in Settings page

### Priority 14 — Infinite Scroll ✅
- [x] Infinite scroll in feed
- [x] Infinite scroll for search items
- [x] Infinite scroll for followers list
- [x] Infinite scroll for following list

### Priority 15 — Developer Environment ✅
- [x] Seed item data (`supabase/seed_items.sql`)
- [x] Unsplash image domain config (`next.config.ts`)

### Priority 16 — Search Improvements ✅
- [x] Sort options (newest / oldest / most liked)
- [x] Category filters (All / Luxury / Accessories / Cars / Real Estate)
- [x] Include brand in search
- [x] Filter panel UI

### Priority 17 — Profile Item Sorting ✅
- [x] Sort options (newest / oldest / most liked)
- [x] Sort dropdown UI
- [x] Item query API including like counts

### Priority 18 — Remove Follower Feature ✅
- [x] `removeFollower` server action (`social.ts`)
- [x] Show X button for owner on followers page
- [x] Confirm dialog + loading state UI
- [x] i18n translations (ko/en)

### Priority 19 — Image Optimization ✅
- [x] `image-slider.tsx`: raw `<img>` to `next/image` (WebP/AVIF, lazy loading, sizes)
- [x] `item-card.tsx`: raw `<img>` to `next/image` (explicit width/height)
- [x] `navbar.tsx`: avatar `<img>` to `Avatar` component (desktop/mobile)
- [x] `comments.tsx`: avatar `<img>` to `Avatar` component
- [x] `blocked-client.tsx`: avatar `<img>` to `Avatar` component
- [x] `dm-inbox-client.tsx`: avatar `<img>` to `Avatar` component
- [x] `dm-thread-client.tsx`: direct `Image` usage to `Avatar` component
- [x] `dm-requests-client.tsx`: direct `Image` usage to `Avatar` component
- [x] `notifications-client.tsx`: avatar to `Avatar`, item thumbnail `sizes` added

### Priority 20 — Error Boundaries & 404 ✅
- [x] Shared ErrorFallback component (`error-fallback.tsx`)
- [x] Global `error.tsx` (root boundary)
- [x] Global `not-found.tsx` (404 page)
- [x] Route-level `error.tsx` (feed, search, dm, notifications, profile, item, settings)
- [x] i18n translation keys (`error` / `notFound`)

### Priority 21 — Skeleton Loaders ✅
- [x] Shared skeleton components (`skeleton.tsx`: SkeletonBox, SkeletonCircle, SkeletonText, FeedCardSkeleton, ProfileItemSkeleton, DMThreadSkeleton, NotificationSkeleton, PillTabsSkeleton)
- [x] Route-level `loading.tsx` (feed, search, dm, notifications, profile, item, settings)

### Remaining Tasks (남은 작업)
- [ ] **Landing Page**: Marketing landing page design (/)
- [ ] **Share Cards**: Generate 9:16 share cards for social media
- [ ] **Push Notifications**: Real-time push via FCM/APNs

### Future (Post-MVP)
- [ ] Share cards (9:16 format)
- [ ] Push notifications (FCM/APNs)
- [ ] Native app (Expo)
- [ ] Verified value system with sources
- [ ] Admin dashboard
- [ ] Analytics integration
- [ ] Real-time chat with WebSocket
- [ ] Image CDN integration

## 8) Milestones (suggested)

### M1 — Public SEO loop
- Stabilize `/u/[handle]`, `/i/[id]`, `/search` for real data
- OG images + metadata finalized
- Sitemap + robots.txt

### M2 — Create flow
- Implement real create item flow (Storage + insert into `items`)
- Edit item visibility

### M3 — Social primitives
- Collections save flow
- Likes/bookmarks primitives

### M4 — DM + notifications
- Real threads/messages + requests gating
- Push notifications

## 8) Risks / guardrails
- Keep tokens out of repo (`.env.local`, Vercel secrets)
- Maintain RLS correctness (private must never leak)
- Rate limiting + abuse controls (block/report)

## 9) Deployment
- Vercel (web)
- Domain:
  - `eoynx.com` for marketing/SEO
  - `app.eoynx.com` for app shell (later)

---

## Appendix — Figma reference node set
Figma file: `2xEA9d6UMcgA1UyHWKZQWl`
- Mobile screens: Profile/Item/Search/DM/Collections/Add (v20260309-1649)
- Web screens: Profile/Item/Search/DM/Collections/Add (v20260309-1649)
