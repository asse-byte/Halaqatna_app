# Halaqtna — Backend API

Laravel 11 · PHP 8 · MySQL 8 — the `api` container of the Halaqtna mono-repo.

**CPIT-499** · Abdoul Malick Cisse (2250954), Munthir Al-Farsi (2340042)
Supervisor: Dr. Ahmad Tayeb — King Abdulaziz University

This module owns every component of §6 except the completion forecast, which lives in `/ml`.

## Component map (§6)

| Component | Files | Requirements |
|---|---|---|
| Auth & RBAC Service — **every** authorization decision | `app/Services/AuthRbacService.php` | FR1, FR2, FR3, FR16 |
| Session Controller — raw intake only | `app/Http/Controllers/SessionController.php` | FR4, FR5, FR6 |
| Analytics Engine — computed on read, never stored | `app/Services/AnalyticsEngine.php` | FR7, FR8, FR9 |
| ML client — internal HTTP, UC13 fallback | `app/Services/MlClient.php` | FR10 |
| Gamification Engine — XP, badges, four leaderboards | `app/Services/GamificationEngine.php` | FR11, FR12, FR13 |
| Report Service — the only writer to file storage | `app/Services/ReportService.php` | FR14, FR15 |
| Audit Logger — append-only | `app/Services/AuditLogger.php` | FR18 |

No controller decides access on its own: middleware (`JwtAuthenticate`, `RequireRole`) and
controllers both delegate to `AuthRbacService`.

## Setup

```bash
composer install
cp .env.example .env
php artisan key:generate
```

Then set `JWT_SECRET`, `DB_PASSWORD`, `SYS_ADMIN_EMAIL` and `SYS_ADMIN_PASSWORD` in `.env`.

Create the schema, apply the least-privilege grants and seed from the repository root:

```bash
bash scripts/db_setup.sh
```

The API serves requests as `halaqtna_api`, which holds **no UPDATE or DELETE grant** on
`audit_log` or `xp_ledger` (non-negotiable rule 4). Migrations run as `halaqtna_admin`;
never point `DB_USERNAME` at that account for serving traffic.

## Tests

```bash
php artisan test                      # 95 feature + unit tests, 509 assertions
php artisan test --coverage --min=70  # NFR9: >= 70% line coverage per module
```

**Measured: 92.78% lines (578/623)**, every module at or above 70% (pcov 1.0.12, PHP 8.3.33).

`--coverage` needs a coverage driver, which PHP does not ship with — without one it reports
nothing at all rather than failing loudly. Install **pcov** (fast, line coverage only, which is
what NFR9 asks for) or **Xdebug**:

```bash
pecl install pcov                     # then add extension=pcov to php.ini
```

On Windows, take the prebuilt DLL from `downloads.php.net/~windows/pecl/releases/pcov/` matching
your `php -v` line exactly — version, `ts`/`nts`, `vsNN` and architecture must all agree, or the
extension will not load. Keep `pcov.enabled=0` in `php.ini` so normal runs pay nothing, and turn
it on per run with `-d pcov.enabled=1 -d pcov.directory=app`.

Tests run on in-memory SQLite (`phpunit.xml`) and fake the ML service, so the suite passes
with the `ml` container stopped — which is itself the I4 exit test.

| File | Covers |
|---|---|
| `tests/Feature/RbacTest.php` | the §9 RBAC matrix, role × boundary |
| `tests/Feature/RateLimitTest.php` | NFR3a / §5.1 lockouts and identical failure responses |
| `tests/Feature/ShareLinkTest.php` | FR21 / §2.13 token, expiry, revocation, minimum data, noindex, audit |
| `tests/Feature/DataIntegrityTest.php` | §10 cascade, RESTRICT, uniqueness, composite PKs, XP sum, grants, the §2.3 and §2.5 constraints |
| `tests/Feature/ReportingTest.php` | FR14 term reports, FR15 PDF export, and that only this service writes files |
| `tests/Feature/PredictionTest.php` | FR10 across the internal HTTP boundary, §2.9 append-only rows, the UC13 fallback |
| `tests/Feature/AdministrationTest.php` | FR19, FR20, FR3, and the UC19–UC23 student reads |
| `tests/Unit/MasteryCalculationTest.php` | §3.3 worked examples — 87.8 / 75.0 / 93.0 |

## Notes

- **Derived values are never columns.** Mastery, momentum, precision, consistency, review
  depth and total XP are computed on read. Total XP is `SUM(xp_ledger.points)`.
- **All numeric constants are provisional** and are stored in `system_setting` so that P10
  calibration needs no code change. Never present them as measured results.
- The public progress card is served by Laravel at `GET /p/{token}` (`routes/web.php`), not by
  the SPA, so the page carries its own `noindex` meta tag and a dead token yields a real 404.
