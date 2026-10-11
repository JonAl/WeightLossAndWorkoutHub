# Weight Loss Hub

A private, offline-first Progressive Web App for tracking weight, body measurements, nutrition, workouts and health logs. It also gives transparent, rule-based coaching. Everything is stored **on your device** (IndexedDB). There is no account, no backend, no analytics and no third-party data transfer.

Greek is the default language, and English is fully supported.

---

## Quick start

Requirements: **Node.js 18+** (tested with Node 22) and npm.

```bash
npm install        # install dependencies
npm run dev        # development server → http://localhost:5173
npm run build      # type-check + production build into dist/
npm run preview    # serve the production build → http://localhost:4173
```

Quality scripts:

```bash
npm run typecheck  # TypeScript (tsc -b)
npm run lint       # ESLint
npm test           # Vitest unit + UI tests (jsdom, fake IndexedDB)
npm run icons      # regenerate PNG app icons from public/icons/favicon.svg
```

> The service worker is only active in the **production build** (`npm run build && npm run preview`). In `npm run dev` it is disabled on purpose, so you never get stale cached code during development.

---

## Publishing on GitHub Pages

The repository contains `.github/workflows/deploy.yml`. It tests and builds the app, then publishes `dist/` on every push to `main`.

1. Push or upload the whole project, **including the `.github` folder**.
2. Go to repo **Settings → Pages → Build and deployment → Source** and choose **GitHub Actions**. Do not choose "Deploy from a branch", because that serves the raw source and shows a blank page.
3. Open the **Actions** tab and wait for "Deploy to GitHub Pages" to turn green. You can re-run it with *Run workflow*.
4. The app is then live at `https://<user>.github.io/<repo>/`.

The workflow sets `BASE_PATH=/<repo>/` automatically, so assets, routing, the manifest and the service worker work under the sub-path. It also copies `index.html` to `404.html`, so reloading a page such as `/<repo>/progress` still works. To build for a sub-path yourself, run `BASE_PATH=/my-repo/ npm run build`.

## Installing on Android (Samsung or any Chromium browser)

PWA installation and offline mode **require HTTPS**, or `localhost` on the same machine. The app cannot be installed from a plain `http://192.168.x.x` address on your LAN, because browsers block service workers there.

Options:

1. **Deploy the `dist/` folder to any static HTTPS host.** Netlify, Cloudflare Pages, GitHub Pages and Vercel all work. Configure the host so unknown paths serve `index.html` (SPA fallback). Then open the URL in Chrome or Samsung Internet on your phone.
2. **Test from your PC over USB.** Run `npm run build && npm run preview`, connect the phone, open `chrome://inspect` → *Port forwarding* → `4173 → localhost:4173`, then open `http://localhost:4173` on the phone.

To install:
- **Chrome:** the app shows an *Install app* button in the sidebar/top bar or in *Settings → App & storage* when the browser offers it. You can also use menu **⋮ → Install app / Add to Home screen**.
- **Samsung Internet:** menu **≡ → Add page to → Home screen**.

After the first successful load, the app opens and works fully offline. When a new version is deployed, a notice appears with an **Update** button.

---

## Backup & restore (important)

Your data lives **only in this browser on this device**. You can lose it if you clear site data, uninstall the PWA, reset the browser, or if the device fails. Installing the app does **not** back up anything to the cloud.

- **Back up:** *Reports → Export & backup → Download backup*. This downloads a complete JSON file with all records, settings, custom foods, saved meals, templates, schedules and weekly reviews. Store it somewhere safe (cloud drive, PC). The coaching engine reminds you if you have no backup or your last one is more than 14 days old.
- **Restore / move to another device:** *Reports → Export & backup → Choose backup file*. The file is validated first. You then see a preview per dataset (records in the file, already present, invalid) and choose how to handle duplicates:
  - *Merge – keep existing*: adds only new records.
  - *Merge – replace existing*: records with the same ID are overwritten.
  - *Replace everything*: wipes the device first. This needs a confirmation step.
  
  Invalid records are skipped and counted. The import runs in a single transaction, so either everything is written or nothing is.
- **CSV:** per-dataset CSV exports (weights, meals, workouts with one row per set, health, water, steps) for spreadsheets. Units are kg, cm, g, ml, km and minutes, and files include a UTF-8 BOM so Greek text opens correctly in Excel.
- *Settings → App & storage → Request persistent storage* asks the browser not to evict the database automatically.

---

## What's new in 1.1 — GymApp (another app made by me for local use) merged in

GymApp 0.2.0 (Android prototype with fixed sample data) has been merged into this app as working, saved features:

| From GymApp | Now in Weight Loss Hub |
|---|---|
| Home "Today's workout" | **Today's workout** card on the dashboard, driven by the weekly plan (start / resume / rest day / next session) |
| Exercise library + detail | **44 exercises** (GR/EN cues, muscles, equipment, sets × rep range, rest), category chips, search by name or muscle, **animated SVG figures**, your last session & PR, add to the current workout or a template, **custom exercises** |
| Live workout (Set X of Y, big steppers, rest countdown) | **Focus mode** in the logger + an app-wide **rest timer** that starts after each set (±15 s, skip, sound, vibration; survives page changes) |
| Weekly meal plan + shopping list | **Meal plan** from your saved meals per weekday, planned protein/kcal, "log today's plan", and a real **shopping list** (summed, tick-off, copy) |
| — (selected extras) | **Weekly training plan + calendar**, **progression helpers** ("last time…", double-progression suggestion, pre-filled sets), **plate calculator** and **warm-up sets**, training settings (rest, bar, plates) |

Existing data is kept: IndexedDB schema v3 only *adds* tables (`exercises`, `programs`, `mealPlan`); old JSON backups import unchanged. Smart workout reminder preferences are stored locally and do not change the database or backup format. Reliable scheduled push alerts with the app closed need a push service/backend — see *Known limitations*.

## Features

| Area | What is implemented |
|---|---|
| **Onboarding & profile** | 4-step wizard (language/units → basics → weights → targets). The values from the brief (37 y, 182 cm, 155 kg start, ~145 kg current, 5+ sessions/week, 3 meals, whey isolate) are prefilled but marked **unconfirmed** until you confirm or edit them. Full editable profile: DOB/age, sex (only for the calorie equation), height, start weight/date, goal weight, target date, experience, schedule, activity, diet notes, supplements, units (kg/cm or lb/in). |
| **Dashboard** | Smart workout reminder card with remaining weekly sessions and optional adaptive morning browser notifications (while the app is open). Current/start/goal weight, total lost (kg and %), remaining, 28-day regression rate, BMI (labelled as a screening measure), waist change, streaks, today's protein/calorie/water/steps against targets, workouts this week, 7/30-day trend chart, quick-add for weight, meal, workout and health, daily and weekly summaries, and an empty state for onboarding. |
| **Weight & body** | Add/edit/delete entries with date-time, weight, waist/hip/chest/arm/thigh/neck and body-fat %. A duplicate warning appears for the same weight within 10 minutes, and you can still save it. Range filter (7/30/90/365/all), daily records and weekly averages, 7/30/90/365-day comparisons (absolute and %), measurement charts, CSV export. |
| **Nutrition** | Meals with date-time, category, food, quantity and unit, calories/protein/carbs/fat/fiber and notes. Blank fields mean *unknown*, not zero. Custom foods with an explicit reference amount, and nutrients are scaled automatically (e.g. 50 g whey from a "per 25 g" food). Conversions that can't be done reliably are refused with a warning. You can save a meal group as a favourite, log saved meals in one tap, re-log a previous entry, track water, see day totals and remaining targets, view 7-day tables, and get answers to the nutrition questions in the brief. |
| **Targets & estimates** | Independent protein and calorie targets. Protein estimate: 1.6–2.2 g/kg of a **reference weight** (goal weight, or BMI-25 weight), not total body weight. Calorie estimate: Mifflin–St Jeor × activity factor, with a deficit of at most 500 kcal or 20 %, and never below 1500/1200 kcal. Everything is labelled as an estimate. |
| **Workouts** | Starter Push/Pull/Legs templates (structure only), custom templates, start from a template, repeat the last workout or start an empty one. Phone-first logger: reps/kg/RPE/rest per set, done toggles, add/remove sets and exercises, cardio (activity, minutes, km), notes, timer, save as template. **Changes save automatically**, so leaving the page never loses input. History, duplicate, delete, personal records (heaviest set, Epley e1RM, best session volume), progression charts, weekly frequency against target. Volume counts weighted sets only; bodyweight and cardio are tracked separately. |
| **Health log** | Glucose, blood pressure, resting HR, sleep, energy and hunger (1–5), digestive symptoms, medications and supplements (name, dose, side effects, notes). User-configured dose schedules with "log now". Each category can be turned off. Trend charts use daily means. A clear disclaimer is shown. |
| **Analytics** | Total and % lost, regression rate over the selected period and over 14/28/56/84 days, rolling average, projection **range** with stated assumptions, protein/calorie/workout adherence, weigh-in and meal coverage, nutrition averages with sample sizes, measurement changes, weekly volume, exercise progression, and same-day correlations (needs n ≥ 10, with a "correlation ≠ causation" note). |
| **Coaching** | 15 documented rules in `src/coaching/rules.ts` (trends, not single days). At most 3 prioritized recommendations, each with its supporting evidence. Dismiss, mark done or restore. Positive and neutral observations. A weekly review (improved / stable / needs attention / insufficient data / priorities), with history saved locally. A `CoachingProvider` interface allows an optional AI provider in the future. It never gives medication advice. |
| **Reports** | Weekly and monthly reports for weight, nutrition, workouts, measurements and health, plus print / save-as-PDF. |
| **PWA** | Manifest (Weight Loss Hub / Weight Hub, standalone, navy theme), 192/512/maskable/apple icons, Workbox service worker precaching the app shell only (no third-party or runtime caching), offline indicator, install prompt with a manual fallback, update notification. |
| **i18n** | All UI text comes from `src/i18n/el.ts` and `src/i18n/en.ts` (≈700 keys, checked to have identical keys and placeholders). Dates and numbers use `el-GR` or `en-GB`, and weights/lengths are converted to the chosen units. The selected language survives refresh. |
| **Storage & privacy** | Dexie/IndexedDB with versioned schema migrations (`src/db/migrations.ts`). Error screen with retry/reset if storage is unavailable or corrupted. "Delete all data" with a double confirmation. No passwords and no network calls. |
| **UI** | Mobile-first: bottom nav plus a *More* sheet on phones, sidebar on desktop. Light/dark/system theme, 44 px touch targets, focus-trapped dialogs, skip link, keyboard navigation, a table view for every chart, and reduced-motion support. Chart colours were validated for colour-blind separation and contrast. |

### Analytics methods (documented)

- **Trend:** multiple weigh-ins on one day are averaged. The trend is the mean of observed days in a trailing 7-day calendar window, and each point carries `n`. Days without data are skipped.
- **Rate:** least-squares regression slope × 7. This needs ≥ 4 weigh-in days over ≥ 7 days.
- **Projection:** 28-day regression. It needs ≥ 10 days over ≥ 21 days. The band is ±max(2·SE, 0.25 kg/wk). Beyond 8 weeks the slower bound is reduced by 25 %, results are clamped at the goal weight, and no time-to-goal is shown if the band includes gaining.
- **Adherence:** only days with data count. Protein is "met" at ≥ target. Calories count as within range at 85–105 % of target.

---

## Project structure

```
src/
  app/            App shell, routing, layout/navigation, quick-add sheets, PWA update prompt
  components/     UI primitives, Modal, toasts/confirm, charts, date-range selector
  features/       dashboard, progress (+analytics), nutrition, workouts, health, coaching, reports, settings, onboarding
  db/             schema.ts, migrations.ts, defaults.ts, backup.ts (validation), repositories/
  analytics/      weight, nutrition, workouts, adherence, projections, correlations (pure functions)
  coaching/       context, rules, weeklyReview, provider interface
  i18n/           el.ts, en.ts, provider + formatters
  hooks/ utils/ types/ tests/
public/icons/     SVG source + generated PNG icons
scripts/          icon generator
```

Business logic (`analytics/`, `coaching/`, `db/backup.ts`) is pure TypeScript with no React, so it can be unit-tested and reused.

**Adding a DB field or table:** append a new entry to `SCHEMA_VERSIONS` in `src/db/migrations.ts`. Never edit existing entries. If the backup format changes, bump `BACKUP_SCHEMA_VERSION` and add a transform in `migrateBackup()`.

---

## Test results (actual execution, 10 Oct 2026)

| Check | Result |
|---|---|
| `npm run typecheck` | ✅ 0 errors |
| `npm run lint` | ✅ 0 problems |
| `npm test` | ✅ 9 files, **74 tests passed** |
| `npm run build` | ✅ built; PWA precache of 18 entries; no chunk warnings |

Unit tests cover weight trends, rates, period changes, BMI, measurements, protein and calorie adherence (missing ≠ zero), protein/calorie estimates, serving conversions, volume, weekly workout counts, PRs/e1RM, streaks, coverage, projections, correlations, backup validation, import preview/modes, the IndexedDB round trip, duplicate detection, coaching rules (max 3, dismiss, disabled categories, no medication rules), the weekly review, and i18n completeness and formatting. One UI test drives onboarding → dashboard → add weight → validation → remount persistence → English.

**Browser verification (Playwright + Chromium against `vite preview`):** the following flows were run and passed with **no console errors**:
- Greek onboarding.
- Service worker active and manifest linked.
- JSON import with preview, including a deliberately invalid record that was skipped.
- JSON backup download (all tables present) and CSV download.
- Editing and deleting a weight.
- A meal from a custom food with auto-scaled protein.
- Workout logging, where input persisted across navigation, then completion and PRs.
- Health and coaching pages (3 recommendations shown).
- Switching to English and dark mode, both persisting after reload.
- **Reloading while offline**, with the offline badge shown and a weight logged offline.
- Layouts at 360 px, 412 px and 1366–1440 px with no horizontal overflow.

---

## Known limitations

- Rest-timer sound/vibration only fire while the app is open.
- Smart workout reminders are shown on the dashboard and can optionally use browser notifications during the 07:00–11:00 local morning window while the app is open. Cadence adapts to remaining workouts (daily with 3+ remaining, every other day with 1–2) and stops when the weekly target is reached. Reliable push notifications while the app is fully closed require a push service/backend and are not included in this static GitHub Pages build.
- Exercise illustrations are simplified animated stick figures per movement type, not per-exercise videos.

- No built-in food database. Nutrition values come only from your entries or labels (by design, so no unverified values are shown).
- Data is per browser and per device. Moving data between devices is manual (JSON export/import). There is no sync.
- The install prompt depends on the browser. iOS Safari works as "Add to Home Screen" but was not tested here.
- Glucose is entered in mg/dL only (mmol/L × 18 = mg/dL).
- Calorie estimates need age and sex in the profile. All estimates are population equations, not measurements.
- "Saved meal" naming uses the browser's prompt dialog.
- The PDF report uses the browser's print dialog.
- There are no automatic reminders or notifications for medication schedules. Schedules are only for logging convenience.

## Remaining issues / ideas

- Code-split rarely used pages to reduce first-load size (~300 kB gzip total today).
- Optional encrypted backup files.
- Optional AI coaching provider through `CoachingProvider` (explicit opt-in only).
- A food database import (e.g. Open Food Facts) with clearly labelled sources.
