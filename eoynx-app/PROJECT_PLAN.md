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

### Priority 1 — Social Features
- [ ] Follow/Unfollow functionality (insert/delete followers)
- [ ] Like functionality (items)
- [ ] Bookmark/Save functionality (items)
- [ ] Follower/Following counts update in real-time

### Priority 2 — SEO & Marketing
- [ ] OG images for profiles and items
- [ ] Proper meta tags and descriptions
- [ ] sitemap.xml generation
- [ ] robots.txt configuration
- [ ] Landing page (/) design

### Priority 3 — Collections
- [ ] Create collection flow
- [ ] Add item to collection
- [ ] Collection detail page with items
- [ ] Public/Private collection toggle

### Priority 4 — Comments ✅
- [x] Comment model in database
- [x] Comment list on item detail
- [x] Add comment functionality
- [x] Comment count display

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

### Future (Post-MVP)
- [ ] Percentile ranking system
- [ ] Share cards (9:16 format)
- [ ] Push notifications
- [ ] Native app (Expo)
- [ ] Verified value system with sources

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
