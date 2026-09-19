# Halaqtna — حلقتنا

**A Smart Quran Memorization Circle Management System**

CPIT-499 · King Abdulaziz University · Faculty of Computing and Information Technology

| | |
|---|---|
| **Team** | Abdoul Malick Cisse (2250954) · Munthir Al-Farsi (2340042) |
| **Supervisor** | Dr. Ahmad Tayeb |
| **Source of truth** | CPIT-498 Final Report (approved), restated as the CPIT-499 build specification |

---

## Mono-repo layout

| Path | Component | Stack |
|---|---|---|
| `/api` | Backend API — Auth & RBAC, Session Controller, Analytics, Gamification, Report, Audit | Laravel 11 · PHP 8 · MySQL 8 |
| `/ml` | Prediction service (FR10 only) — `/forecast`, `/train`, `/evaluate` | Python 3 · FastAPI · scikit-learn |
| `/frontend` | Student dashboard + administration console + responsive teacher flow (the `/web` client of the Week-0 plan) | React + Vite · Tailwind CSS |
| `/mobile` | Teacher client (UC9–UC12, offline queue) | React Native · Expo |
| `/docker` | `nginx`, `api`, `ml`, `db` + the named volume `storage` | Docker Compose |
| `/scripts` | `db_setup.sh`, `db_grants.sql`, `check_locales.js` (NFR6 CI), `check_offline_queue.mjs` | |
| `/docs` | `CPIT-499-report-changes.md` — every change the report must carry (§11, §12) | |

**Network rule (§1).** The only connection crossing into the server is `client → nginx` over
HTTPS (TLS 1.2+). `nginx→api`, `api→ml`, `api→db` and `ml→db` all sit on the internal Docker
bridge and are never published. Only the `nginx` service declares `ports:`.

---

## Running

### Production — Docker Compose

```bash
cd docker && docker compose up --build
```

Edit `api/.env.docker` and `docker/mysql/init.sql` first: both ship with placeholder secrets.
Set `DB_ROOT_PASSWORD` and `ML_DB_PASSWORD` in the environment Compose reads. Then create the
schema and apply the least-privilege grants:

```bash
DB_HOST=db GRANT_HOST='%' DB_ADMIN_PASSWORD=... API_DB_PASSWORD=... ML_DB_PASSWORD=... \
  bash scripts/db_setup.sh
```

### Development

```bash
# 1. API
cd api && composer install
cp .env.example .env && php artisan key:generate     # then set JWT_SECRET, DB_PASSWORD, SYS_ADMIN_*
php artisan serve --host=127.0.0.1 --port=8000

# 2. Database — migrate as admin, apply grants, seed
DB_ADMIN_PASSWORD=... API_DB_PASSWORD=... ML_DB_PASSWORD=... bash scripts/db_setup.sh

# 3. ML prediction service (never published; the API reaches it over internal HTTP)
cd ml && pip install -r requirements.txt
uvicorn main:app --host 127.0.0.1 --port 8000   # use a different port if the API holds 8000

# 4. Web client
cd frontend && npm install && cp .env.example .env && npm run dev    # http://localhost:3000

# 5. Teacher client
cd mobile && npm install && npx expo start       # set expo.extra.apiUrl in mobile/app.json
```

The Vite dev server proxies `/api` and `/p` to Laravel, so development uses the same single
origin as production and needs no CORS configuration. Expo-managed packages are pinned to the
SDK 52 versions — change them with `npx expo install`, never by hand, or the bundle breaks.

### Tests

```bash
cd api && php artisan test                   # 95 feature + unit tests, 509 assertions
cd api && php artisan test --coverage --min=70   # NFR9 — needs pcov or Xdebug
node scripts/check_locales.js                # NFR6: ar/en key parity
node --test scripts/check_offline_queue.mjs  # UC10 alternative flow 5a
```

**NFR9 is met — measured, not asserted:** **92.78% lines (578/623)** with pcov 1.0.12 on
PHP 8.3.33, and every backend module is at or above the 70% threshold. The per-module table is in
[docs/CPIT-499-report-changes.md](docs/CPIT-499-report-changes.md) §7. `--coverage` needs a
coverage driver installed (`pecl install pcov`, or the matching Windows DLL); without one it
silently reports nothing.

---

## Demo data

`php artisan db:seed` (run by `scripts/db_setup.sh`) creates two circles, five staff users and
ten students with roughly six weeks of synthetic sessions.

| Role | Identifier | Password |
|---|---|---|
| System Administrator | `SYS_ADMIN_EMAIL` from `api/.env` | `SYS_ADMIN_PASSWORD` from `api/.env` |
| Circle Administrator | `admin.nafi@halaqtna.sa` · `admin.kathir@halaqtna.sa` | `Pass#2026` |
| Teacher | `teacher.ahmad@halaqtna.sa` · `teacher.yousef@halaqtna.sa` · `teacher.saad@halaqtna.sa` | `Pass#2026` |
| Student (access code) | `STU1AB2C` … `STU8QR9S` (circle 1), `STU9ST2U` · `STUAUV3W` (circle 2) | — |

> These are **development fixtures with published passwords.** Never seed them into a
> deployment reachable by a real user. The seeded session data is **synthetic**: no figure
> derived from it may be presented as a measured result (rule 8, NFR10).

---

## Non-negotiable rules — how each one is enforced

| # | Rule | Enforcement |
|---|---|---|
| 1 | Four actors | `role` enum (`SYS_ADMIN`, `CIRCLE_ADMIN`, `TEACHER`) + the separate student path |
| 2 | Two auth paths; `Student` is **not** a subclass of `User` | `AuthRbacService::staffLogin` (bcrypt + JWT) and `studentLogin` (access code). `student` has no email and no `password_hash` |
| 3 | Derived values are never stored | computed on read in `AnalyticsEngine`; total XP is `SUM(xp_ledger.points)` |
| 4 | `audit_log` and `xp_ledger` are append-only | `scripts/db_grants.sql` grants the API user SELECT + INSERT only; `db_setup.sh` verifies it and fails if UPDATE or DELETE is present |
| 5 | One component makes every authorization decision | `app/Services/AuthRbacService.php`; middleware and controllers only call it |
| 6 | The ML service is a separate container, internal HTTP only | `MlClient`, with the UC13 fallback on timeout; `ml` declares no `ports:` |
| 7 | Schema stays in 3NF | the error weight lives once, in `error_type`; `session_error` has no weight column |
| 8 | All numeric constants are provisional | stored in `system_setting` (UC3), calibrated in P10, never presented as results |

---

## Public API surface (§8)

```
POST   /api/auth/login                 FR1    staff email+password → JWT
POST   /api/auth/student-login         FR2    {access_code} → student token
POST   /api/students/{id}/access-code  FR3    regenerate (teacher only)

GET    /api/circles                    FR19
POST   /api/circles                    FR19
GET    /api/circles/{id}/roster        FR20
POST   /api/teachers                   FR20
POST   /api/students                   FR20

POST   /api/sessions                   FR4, FR5, FR6   body includes errors[]
GET    /api/students/{id}/metrics      FR7, FR8, FR9
GET    /api/students/{id}/prediction   FR10
GET    /api/circles/{id}/leaderboard?criterion=momentum|precision|consistency|review_depth   FR11
GET    /api/students/{id}/badges       FR12
GET    /api/students/{id}/xp           FR13
GET    /api/circles/{id}/report        FR14
GET    /api/students/{id}/report.pdf   FR15
GET    /api/audit                      FR18   (System Administrator only)

POST   /api/students/{id}/share-link   FR21   create (teacher only) → {link_id, url, expires_at}
DELETE /api/share-links/{link_id}      FR21   revoke
GET    /p/{token}                      FR21   public read-only card; no auth; 404 if unknown/expired/revoked
```

**Internal only, never published:**

```
POST   http://ml:8000/forecast    {student_id, momentum, error_density, attendance_rate}
                               → {predicted_completion_date, eta_days, model_version}
POST   http://ml:8000/train       retrain from the database (read-only connection)
POST   http://ml:8000/evaluate    NFR10 held-out evaluation, split by student
```

---

## Exit tests

| Iteration | Exit test | Where |
|---|---|---|
| I1 | A Circle Admin token is refused another circle's roster (403); the 6th failed login is locked out and an audit row is written | `api/tests/Feature/RbacTest.php`, `RateLimitTest.php` |
| I2 | Saving a session writes `session` + `session_error` + `audit_log` atomically | `SessionController::store`, `RbacTest` |
| I3 | The §3.3 worked examples return 87.8 / 75.0 / 93.0 | `api/tests/Unit/MasteryCalculationTest.php` |
| I4 | Stopping the `ml` container does not prevent logging a session; the last forecast is shown with its `generated_at` and a staleness notice | `RbacTest`, `MlClient` |
| I5 | Four independent leaderboards; expired **and** revoked tokens both 404; the card leaks nothing; every view is audited | `DataIntegrityTest.php`, `ShareLinkTest.php` |
| I6 | ar/en parity, no untranslated string | `node scripts/check_locales.js` |

---

## Changes the CPIT-499 report must carry

See **[docs/CPIT-499-report-changes.md](docs/CPIT-499-report-changes.md)** — the §11 schema
changes (including `session_type`, which changes Figure 4.7), the provisional constants, the
FR21 scope change of §12 with the recorded I5 decision, the §5.1 rate-limiting rationale, and
the NFR10 evaluation protocol.
