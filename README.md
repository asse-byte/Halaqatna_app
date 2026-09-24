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
| `/scripts` | `dev_up.sh`, `db_setup.sh`, `docker_setup.sh`, `db_grants.sql`, `make_dev_certs.sh`, `check_locales.js` (NFR6 CI), `check_offline_queue.mjs` | |
| `/docs` | `CPIT-499-report-changes.md` — every change the report must carry (§11, §12) | |

**Network rule (§1).** The only connection crossing into the server is `client → nginx` over
HTTPS (TLS 1.2+). `nginx→api`, `api→ml`, `api→db` and `ml→db` all sit on the internal Docker
bridge and are never published. Only the `nginx` service declares `ports:`.

---

## Running

### Just show me the system — one command

```bash
bash scripts/dev_up.sh          # then open http://localhost:3000
```

Needs only **PHP 8.2+, Composer and Node 18+**. It installs what is missing, writes
`api/.env` for you, creates a SQLite database, seeds the demo circles, and starts both
servers. Ctrl-C stops them. The sign-in details are printed on screen.

This path deliberately skips MySQL, Docker and the Python service, because none of them are
worth installing to look at the system. The one thing it cannot show is the live forecast
(FR10): without the ML container the API behaves exactly as UC13 specifies — it keeps working
and shows the last stored forecast with a staleness notice. Everything else runs in full.

### Production — Docker Compose

nginx listens on 443 only (NFR4), so it will not start without a certificate. Edit
`api/.env.docker` and `docker/mysql/init.sql` first — both ship with placeholder secrets —
then generate a self-signed certificate, build the web client, and run the setup script:

```bash
bash scripts/make_dev_certs.sh        # writes docker/nginx/certs/ — development only
cd frontend && npm install && npm run build && cd ..
DB_ROOT_PASSWORD=... DB_ADMIN_PASSWORD=... ML_DB_PASSWORD=... bash scripts/docker_setup.sh
```

`docker_setup.sh` starts MySQL, runs the migrations as `halaqtna_admin` in a one-off `api`
container, applies the least-privilege grants, seeds, verifies that `audit_log` and
`xp_ledger` are still append-only, and brings the whole stack up. It is safe to run again;
only `FRESH=1` drops data. (The `api` container itself never migrates: it connects as
`halaqtna_api`, which by design cannot alter the schema.)

Open `https://localhost`. The browser will warn that the certificate is not trusted — that is
what self-signed means, and it is expected. Replace the two files in `docker/nginx/certs/`
with a real certificate for anything a real user can reach.

### Development — each piece by hand

```bash
# 1. API
cd api && composer install
cp .env.example .env && php artisan key:generate     # then set JWT_SECRET, DB_PASSWORD, SYS_ADMIN_*
php artisan serve --host=127.0.0.1 --port=8000

# 2. Database — migrate as admin, apply grants, seed (FRESH=1 to start from empty)
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
cd api && php artisan test                   # 140 feature + unit tests, 930 assertions
cd api && php artisan test --coverage --min=70   # NFR9 — needs pcov or Xdebug
cd frontend && npm run lint                  # ESLint over the web client
node scripts/check_locales.js                # NFR6: ar/en key parity, and every key the clients use exists
node --test scripts/check_offline_queue.mjs  # UC10 alternative flow 5a
```

The API suite needs an `api/.env` to exist (`cp .env.example .env`); `phpunit.xml` overrides
everything the tests depend on.

**NFR9 was met — measured, not asserted:** **92.78% lines (578/623)** with pcov 1.0.12 on
PHP 8.3.33, and every backend module was at or above the 70% threshold. That measurement
predates the third review round (docs §10), which added tests alongside every fix; re-run the
coverage command above to refresh the figure before quoting it. The per-module table is in
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
| Circle Administrator (shown in Arabic as مشرف الحلقة) | `admin.nafi@halaqtna.sa` · `admin.kathir@halaqtna.sa` | `Pass#2026` |
| Teacher | `teacher.ahmad@halaqtna.sa` · `teacher.yousef@halaqtna.sa` · `teacher.saad@halaqtna.sa` | `Pass#2026` |
| Student (access code) | `NUR482` `HDY365` `FLH927` `RSD634` `TQW258` `BRK743` `SKN519` `YSR386` (circle 1), `MJD472` · `WLD638` (circle 2) | — |

> These are **development fixtures with published passwords.** Never seed them into a
> deployment reachable by a real user. The seeded session data is **synthetic**: no figure
> derived from it may be presented as a measured result (rule 8, NFR10).

---

## Non-negotiable rules — how each one is enforced

| # | Rule | Enforcement |
|---|---|---|
| 1 | Four actors | `role` enum (`SYS_ADMIN`, `CIRCLE_ADMIN`, `TEACHER`) + the separate student path. `CIRCLE_ADMIN` reads **مشرف الحلقة** in Arabic; the English name and the stored code are unchanged |
| 2 | Two auth paths; `Student` is **not** a subclass of `User` | `AuthRbacService::staffLogin` (bcrypt + JWT) and `studentLogin` (access code). `student` has no email and no `password_hash` |
| 3 | Derived values are never stored | computed on read in `AnalyticsEngine`; total XP is `SUM(xp_ledger.points)` |
| 4 | `audit_log` and `xp_ledger` are append-only | `scripts/db_grants.sql` grants the API user SELECT + INSERT only; `db_setup.sh` verifies it and fails if UPDATE or DELETE is present |
| 5 | One component makes every authorization decision | `app/Services/AuthRbacService.php`; middleware and controllers only call it. Per Table 1.1 the System Administrator's remit (circles, supervisors, settings, audit) and the Circle Supervisor's (teachers, students, sessions, reports) are **disjoint**: `requireCircleAccess` refuses `SYS_ADMIN` outright |
| 6 | The ML service is a separate container, internal HTTP only | `MlClient`, with the UC13 fallback on timeout; `ml` declares no `ports:` |
| 7 | Schema stays in 3NF | the error weight lives once, in `error_type`; `session_error` has no weight column |
| 8 | All numeric constants are provisional | stored in `system_setting` (UC3), calibrated in P10, never presented as results |

---

## Public API surface (§8)

```
POST   /api/auth/login                 FR1    staff email+password → JWT
POST   /api/auth/student-login         FR2    {access_code} → student token
POST   /api/students/{id}/access-code  FR3    rotate (teacher / circle supervisor)

GET    /api/me/profile                 FR22   staff self-service: own details
PATCH  /api/me/profile                 FR22   audited (FR18); role, circle and status are not editable here
POST   /api/me/password                FR22   requires the current password; signs out other devices and returns a fresh token

GET    /api/circles                    FR19   deployment administration
POST   /api/circles                    FR19
DELETE /api/circles/{id}               FR19   refused while the circle still has people in it
POST   /api/circle-admins              FR19   the only people the System Administrator deals with

GET    /api/circles/{id}/roster        FR20   circle supervisor and teachers only
GET    /api/circles/{id}/dashboard     FR14   the circle at a glance; scoped to the caller
POST   /api/teachers                   FR20   circle supervisor only
POST   /api/students                   FR20   circle supervisor only — a teacher cannot enrol
DELETE /api/students/{id}              FR20   refused once the student has recorded sessions

GET    /api/attendance?session_date=   FR4    the register for one day
POST   /api/attendance                 FR4    several students at once; P / A / E
GET    /api/surahs                     FR5    114 Surahs with names and ayah counts
POST   /api/sessions                   FR4, FR5, FR6   body includes errors[]
PUT    /api/sessions/{id}              FR5, FR6, FR18  correct a session; XP settled by an ADJUST entry
GET    /api/students/{id}/metrics      FR7, FR8, FR9
GET    /api/students/{id}/prediction   FR10
GET    /api/circles/{id}/leaderboard?criterion=momentum|precision|consistency|review_depth   FR11
GET    /api/students/{id}/badges       FR12
GET    /api/students/{id}/xp           FR13
GET    /api/circles/{id}/report        FR14
GET    /api/students/{id}/report.pdf   FR15
GET    /api/audit                      FR18   (System Administrator only)

POST   /api/students/{id}/share-link   FR21   create (teacher / supervisor), optional days 1–30 → {link_id, url, report_url, guardian_phone, expires_at}
DELETE /api/share-links/{link_id}      FR21   revoke
GET    /p/{token}                      FR21   public read-only card; no auth; 404 if unknown/expired/revoked
GET    /p/{token}/report.pdf           FR15   the full report for the guardian, behind the same token
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
| — | The System Administrator reaches no circle data; a teacher cannot enrol a student | `api/tests/Feature/RbacTest.php` |
| — | The register is P/A/E only; a session can be corrected and its XP settled by an ADJUST entry | `api/tests/Feature/AttendanceAndCorrectionTest.php` |
| — | The Arabic PDF embeds a composite Arabic font and names the Surah rather than printing its number | `api/tests/Feature/ArabicPdfTest.php` |

---

## Changes the CPIT-499 report must carry

See **[docs/CPIT-499-report-changes.md](docs/CPIT-499-report-changes.md)** — the §11 schema
changes (including `session_type`, which changes Figure 4.7), the provisional constants, the
FR21 scope change of §12 with the recorded I5 decision, the §5.1 rate-limiting rationale, and
the NFR10 evaluation protocol.

For the third review round — a full audit of the code that fixed credential revocation, the
rate limiter behind nginx, the MySQL grants, XP consistency and the offline queue — see §10.

For the second review round — the System Administrator / Circle Supervisor boundary, the plain
-language vocabulary, the Arabic PDF fix, the register, the short access codes and the guardian's
WhatsApp delivery — see §9 of that file, and
**[docs/مطابقة-التعديلات-للتقرير.md](docs/مطابقة-التعديلات-للتقرير.md)**, which maps every one of
those changes to the requirement it touches and states, in Arabic, whether it is compliant with
CPIT-498, a correction of code that had drifted wider than the report, or an addition that needs a
new line in it.
