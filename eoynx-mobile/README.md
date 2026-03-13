# eoynx-mobile

Expo(React Native) starter app connected to the existing Supabase backend.

## 1) Install

```bash
npm install
```

## 2) Configure environment

Create `.env` in this folder (`eoynx-mobile`) from `.env.example`.

```bash
Copy-Item .env.example .env
```

Set:

- `EXPO_PUBLIC_SUPABASE_URL`
- `EXPO_PUBLIC_SUPABASE_ANON_KEY`
- `EXPO_PUBLIC_SUPABASE_REDIRECT_URL` (optional, for OAuth redirect override)

Use the same values from your web app (`eoynx-app`).

## 3) Run

```bash
npm run start
```

Then open Android/iOS simulator or Expo Go.

## Google login setup

`AuthScreen` includes `Continue with Google` using Supabase OAuth.

Required config:

- In Supabase Dashboard > Authentication > Providers > Google: enable Google provider
- In Supabase Dashboard > Authentication > URL Configuration: add redirect URL
  - `eoynxmobile://auth/callback`

Notes:

- This app uses Expo Linking scheme `eoynxmobile` (`app.json`).
- If you run inside Expo Go, redirect behavior can differ by runtime URL. A dev build is more stable for OAuth testing.

## Current scope

- Email/password sign-in and sign-up with Supabase Auth
- Google sign-in via Supabase OAuth (mobile callback flow)
- Persistent mobile session using `expo-secure-store`
- `react-navigation` 루트 스택 (`Auth`, `MainTabs`)
- `react-navigation` 하단 탭 (`Feed`, `Profile`, `Settings`)
- `Feed` 탭 내부 스택 (`FeedList` -> `FeedItemDetail`)
- `Profile` 탭 내부 스택 (`ProfileOverview` -> `ProfileEdit`)
- `Feed` tab fetches latest 30 rows from `items`
- `FeedItemDetail` supports like/bookmark toggles
- `FeedItemDetail` supports comment create/delete
- `ProfileEdit` updates `profiles` (`handle`, `display_name`, `bio`, `dm_open`)
- `Settings` tab includes sign out

## Next recommended steps

- Move shared domain logic/types into a common package
- Add Apple sign-in mobile flow
- Add deep-link routes and per-tab detail stacks
