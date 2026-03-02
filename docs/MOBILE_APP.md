# TeamDX – Mobile App (Android)

## Overview

- **Admin panel** = **Desktop only** (Next.js web app at `/admin` – workflows, tagging, users, sheet sync, etc.)
- **All other users** (Telecaller, Counselor, Team Lead, Branch Manager, etc.) = **Android app** (this Flutter project).

Same backend (Express + Supabase) serves both. Mobile app uses the same auth and API.

---

## Project location

- **Flutter app:** `mobile_app/`
- **Android build:** `mobile_app/android/`
- **Package:** `com.tvfdx.calltracker` (can be renamed to e.g. `com.thevisafox.dx` if needed)

---

## Features (mobile app)

- **Login** – Same credentials as web (`/api/auth/login`).
- **Calls** – Call log, device registration, WebSocket for live updates (existing home screen).
- **Leads** – List of leads assigned to the user, tap for detail.
- **Tasks** – My tasks list from `/api/tasks`.
- **Profile** – Current user info + Logout.

---

## Setup

### 1. Flutter

```bash
cd mobile_app
flutter pub get
```

### 2. API base URL

- **Local:** Backend on `http://localhost:5000`.  
  On device/emulator either use `adb reverse tcp:5000 tcp:5000` or set `AppConfig.apiBaseUrlOverride` / build with `--dart-define=API_BASE_URL=http://10.0.2.2:5000` (emulator) or your PC IP.
- **Production:** Set in `lib/utils/app_config.dart`:
  - `apiBaseUrlOverride = 'https://tvf-dx-api.onrender.com';`  
  or build with:
  - `flutter build apk --dart-define=API_BASE_URL=https://tvf-dx-api.onrender.com`

### 3. Run

```bash
cd mobile_app
flutter run
```

### 4. Build APK (release)

```bash
cd mobile_app
flutter build apk --dart-define=API_BASE_URL=https://YOUR_BACKEND_URL
```

APK: `build/app/outputs/flutter-apk/app-release.apk`

---

## Architecture

| Part            | Tech        | Use case                          |
|----------------|-------------|------------------------------------|
| Admin panel    | Next.js     | Desktop only – admin/settings      |
| User app       | Flutter     | Android (and optionally iOS later) |
| Backend        | Express     | Same API for web + mobile         |
| Auth / DB      | Supabase    | Same users, roles, data            |

---

## Notes

- Admin users can use the **web app** (desktop) for admin features; they can also use the mobile app for leads/tasks/calls if needed.
- For **production**, set the backend URL in app config or via `--dart-define=API_BASE_URL=...` when building the APK.
