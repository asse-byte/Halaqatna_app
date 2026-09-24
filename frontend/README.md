# Halaqtna — Web Client

React + Vite + Tailwind CSS. This is the `/web` client of the Week-0 plan and carries two of
the four interfaces named in §1, plus the teacher flow as a responsive web equivalent:

- **Student web dashboard** — UC19–UC23
- **Administration console** — UC1–UC8 (System Administrator and Circle Administrator)
- **Teacher flow** — UC9–UC12, working at 360px with no horizontal scrolling (NFR5)

**CPIT-499** · Abdoul Malick Cisse (2250954), Munthir Al-Farsi (2340042)
Supervisor: Dr. Ahmad Tayeb — King Abdulaziz University

## Setup

```bash
npm install
cp .env.example .env
npm run dev          # http://localhost:3000
```

The dev server proxies `/api` and `/p` to Laravel, so the SPA, the API and the public progress
card share one origin exactly as they do behind nginx in production. Point
`VITE_API_PROXY_TARGET` at the Laravel origin if it is not `http://127.0.0.1:8000`.

```bash
npm run build        # -> dist/, which the nginx container serves
```

## Layout

| Path | Purpose |
|---|---|
| `src/pages/StaffLogin.jsx` | FR1 — email + password |
| `src/pages/StudentLogin.jsx` | FR2 — access code. A **separate screen**, because `Student` is not a `User` |
| `src/pages/admin/` | UC1–UC3, UC8 — circles, circle admins, settings, audit trail |
| `src/pages/circle/` | UC5, UC6 — roster and term report |
| `src/pages/teacher/` | UC9–UC11 — roster, session logging, error tagging, share links |
| `src/pages/student/` | UC19–UC23 — dashboard, journey map, badges, challenges |
| `src/pages/shared/` | UC12, UC13, UC21 — performance and the four leaderboards |
| `src/lib/i18n.jsx` | FR17 / NFR6 — ar (RTL) and en (LTR), switched at run time |
| `src/lib/offline.js` | UC10 alternative flow 5a — queue locally, sync on reconnect |
| `src/lib/dates.js`, `src/lib/mastery.js`, `src/lib/surahs.js` | Plain helpers, shared with the mobile client |
| `src/locales/{ar,en}.json` | Every UI string, in both languages |

## Checks

```bash
npm run lint                                # ESLint
node ../scripts/check_locales.js            # NFR6: ar/en key parity, run in CI
node --test ../scripts/check_offline_queue.mjs
```

Arabic is the default and the document direction is set to RTL on first paint; the language
switch flips `dir` on `<html>` and swaps the font stack without a reload.
