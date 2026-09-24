# CPIT-499 — changes that must be carried into the report

Halaqtna · Abdoul Malick Cisse (2250954), Munthir Al-Farsi (2340042) · Supervisor: Dr. Ahmad Tayeb

This file is the working record for §11 ("Things that would change the report") and §12
("Scope change notice: FR21") of the build specification. Every entry below is a change the
CPIT-499 report must document, with the reason it was made.

---

## 1. Schema changes against the approved CPIT-498 design

| # | Change | Why | Report impact |
|---|---|---|---|
| 1 | `session.session_type ENUM('NEW','REVIEW','MIXED')` added | §3.7 defines review depth as reviewed pages ÷ newly memorised pages, and the approved schema had no way to tell the two apart. Decided in I2, as §3.7 instructs. | **Figure 4.7 must be updated.** Review depth is computed over the last 4 weeks; a `MIXED` session is split 50/50 between new and review. |
| 2 | `student.is_active` added | FR20 requires a Circle Administrator to *suspend* students, which the approved schema could not express. | Add the column to Figure 4.7 and note it against FR20. |
| 3 | `audit_log.actor_user_id` made nullable | Two audited actions have no staff actor: a login lockout (§5.1) and a progress-card view by a link holder (§2.13, UC26). §2.14 specifies a FK to `staff_user` but does not require NOT NULL, so this stays inside the spec. The payload carries `actor_student_id` for student self-service actions (UC23). | Note against FR18 that the trail records unauthenticated events with a null actor. |
| 4 | `audit_log.action` gains `VIEW` | §2.13 mandates "action `VIEW`, entity `progress_share_link`" for every card view, but the §2.14 enum lists only CREATE/UPDATE/DELETE/ADJUST. `VIEW` was added to satisfy §2.13. | Update the enum in Figure 4.7 and in the FR18 description. |
| 5 | `system_setting` table added | UC3 ("configure system settings") had no storage. It holds the provisional constants — `d_max`, `α`, the XP rates — so that P10 calibration does not require a code change. | Add the table to Figure 4.7 and cite it under UC3 and under "all constants are provisional". |
| 6 | `progress_share_link` table added | FR21 — see §3 below. | New table in Figure 4.7. |
| 7 | `cache` and `cache_locks` tables added | NFR3a. Laravel's rate limiter is cache-backed and the deployed store is `CACHE_STORE=database`, so without these tables the first call to either login endpoint fails with *"no such table: cache"* — **FR1 and FR2 are both dead on a fresh deployment.** The `database` driver is deliberate over `file`: §5.1 lockouts must be shared across API workers, and a file cache is per-container. | Infrastructure tables, not domain entities. Mention under NFR3a rather than adding them to Figure 4.7, which models the domain. |

**Not changed, deliberately.** `Student` still does **not** inherit from `User` (rule 2 / §11 item 4),
derived values are still never stored (rule 3), and `session_error` still has no `weight` column —
the weight lives once in `error_type` (rule 7, 3NF).

---

## 2. Provisional constants

All of the following are **provisional** and are calibrated in P10. None of them may be
presented as a measured result.

| Constant | Value | Where |
|---|---|---|
| `MEM_GAP` / `LNK_ERR` / `TAJ_ERR` / `SLF_CRT` weights | 0.85 / 0.50 / 0.25 / 0.05 | `error_type` seed |
| `d_max` (mastery normalising constant) | 3.0 | `system_setting` |
| `α` (momentum EWMA smoothing) | 0.4 | `system_setting` |
| XP per page / per session | 10 / 5 | `system_setting` |
| Pages per Juz | 20 | `AnalyticsEngine`, `ml/main.py` |

Changing any of these is expected (§11 item 3) and must be reported as calibration, with the
evidence that motivated the change.

---

## 3. FR21 — parent progress link (the scope change)

### 3.1 What the CPIT-498 report says today

- Figure 1.1 places **Parent outside the system boundary**, drawn as a dashed box.
- Section 1.4 lists **"direct parent accounts"** as out of scope for both semesters.
- Table 1.1: a parent *"receives exported PDF reports through the teacher or administrator.
  No account in the CPIT-498 scope."*
- Section 5.2.2 lists **"a parent portal with progress visibility"** as work *beyond* the project.

### 3.2 What must be written in the CPIT-499 report

1. **State that FR21 was added during CPIT-499, and why.** Teachers asked for a way to keep
   parents informed between term reports: the FR15 PDF is produced on demand and is stale the
   moment it is sent, so teachers were re-exporting the same student weekly by hand. FR21
   replaces that manual loop with one link the teacher issues once and can revoke.
2. **Update Figure 1.1, or add a note to it.** The parent still sits **outside** the boundary.
   A share link is not an account: there is no registration, no credential the parent chooses,
   no login, and no parent record in the database. It is the FR15 pattern — the teacher produces
   an artifact and hands it over — with a live web page in place of a file. The four-actor model
   is intact: **the viewer is a link holder, not a system actor**, which is why UC26 is marked
   "not a system actor" in §7.
3. **Add FR21 to the requirements table and to both traceability matrices** (Table 3.6 and
   Table 4.2), with **UC25** (teacher shares / revokes) and **UC26** (link holder views the card).
4. **Say plainly that this is a *narrow* step toward the parent portal of Section 5.2.2, not the
   portal itself.** The card is read-only, carries a fixed minimum of data, expires, and can be
   revoked. It does not give a parent an identity in the system.

### 3.3 The I5 decision §12 asks to be recorded

§12 offers an alternative: require the parent to enter the student's date of birth (or another
shared secret the teacher already knows) before the card renders, so the link is not open to
"anyone with the URL".

**Decision: the link is open — no second factor — with every hardening measure of §2.13 in force.**

Reasons:

- The database holds no date of birth, so the alternative would require collecting a new personal
  attribute for every student purely to gate a page. Collecting more data about a minor in order
  to protect data about that minor is the wrong trade.
- A shared secret a teacher already knows is a secret many people know; it would add friction for
  the parent without adding real strength.
- The exposure is bounded by design rather than by a gate: 32 random bytes (2²⁵⁶ token space),
  30-day expiry, revocation at any time, and a card that carries a **band** rather than a score
  and no ranking, no comparison and no error detail.

**This decision is revisited if the pilot shows links being forwarded beyond the family.** The
first step then is the date-of-birth gate, not weakening anything in §2.13.

### 3.4 What was built, against §2.13

| §2.13 rule | Implementation |
|---|---|
| Token is the only credential, ≥ 32 random bytes, never sequential, never derived from `student_id` | `AuthRbacService::shareToken()` — `random_bytes(32)`, base64url, 43 characters |
| Default expiry 30 days | `ShareController::issue()` |
| Expired or revoked → **404, not 403** | `AuthRbacService::resolveShareToken()` — unknown, expired and revoked are indistinguishable |
| The creating teacher can revoke at any time | `DELETE /api/share-links/{link_id}` |
| Minimum data only: first name, pages this week, attendance this week, current Juz, **Mastery band (not the raw score)**, ETA date | `ShareController::card()` builds exactly these seven values; `masteryBand()` maps the score to one of five bands |
| No leaderboard position, no comparison, no error detail, no access code | Nothing else is passed to the view; asserted in `ShareLinkTest::test_card_exposes_only_the_permitted_fields` |
| `noindex` header **and** `<meta name="robots" content="noindex">` | `X-Robots-Tag` response header, nginx `add_header`, and the meta tag in `resources/views/share/card.blade.php` |
| Every view writes an `audit_log` row (action `VIEW`, entity `progress_share_link`) | `ShareController::card()` via `AuditLogger::anonymous()`; `view_count` and `last_viewed_at` are also updated |

The card is rendered server-side by Laravel at `GET /p/{token}` rather than by the React SPA, so
that the page carries its own `noindex` meta tag and so that a dead token produces a real 404
instead of an empty SPA shell.

---

## 4. NFR3a — login rate limiting (§5.1)

Not in the approved report; it strengthens NFR3, which is already there.

- Staff login is keyed on **email + IP**. Keying on the email alone would let an attacker lock a
  real teacher out of their own account from anywhere.
- Student login is keyed on **IP only, never on the access code**. A code is eight characters and
  is the student's sole credential; keying the lockout on it would let anyone who knows a code —
  or who guesses codes in bulk — permanently deny that student access. Lock the source, not the victim.
- Five failures, then a 15-minute lockout, on both endpoints. A secondary limit of 100 failed
  attempts per hour per IP, also on both endpoints, blunts bulk guessing spread across many
  students and password spraying across many staff accounts (the staff half was added in §10).
- Both endpoints return an **identical message and status** whether or not the identifier exists.
  This is why a *suspended* account also returns the generic 401: a distinct 403 would confirm both
  that the email is real and that the password was correct.
- Every lockout writes an `audit_log` row (`CREATE` / `auth_lockout`), so repeated attempts are
  visible to a System Administrator (FR18, UC8).

> The access-code design stands on this. If the pilot shows abuse, the next step is a longer code
> or teacher approval of a first-time device — **not** removing the limit.

---

## 5. NFR10 — the forecast evaluation (P10)

Section 5.2.1 of the CPIT-498 report commits to comparing linear regression against at least one
alternative. `ml/evaluation.py` is that deliverable and follows §9 literally:

- **Split by student, never by row.** Every row of a student is entirely in train or entirely in
  test. A random split by row leaks a student's own history into their own test prediction and
  inflates the result. Default 70/30 by student.
- **A naïve baseline is always included**: remaining pages ÷ average pages per week to date, no
  model at all. If neither model beats it, that is reported as the finding.
- **One alternative**, chosen by sample size and recorded with its reason: Ridge when the training
  split is small, RandomForestRegressor when there is enough data.
- **Four metrics per model**: % within ±2 weeks, MAE in days, RMSE in days, and bias (mean signed
  error), together with the split description and the number of students, rows and sessions in each split.
- If the dataset is too small for a meaningful held-out split, the run **refuses** and says so,
  rather than reporting an unreliable percentage.
- `model_version` is recorded on every `prediction` row so a result can be traced to the model
  that produced it.

**NFR10 has not been measured on real data.** The demo data is synthetic. No figure from a
synthetic run may be presented as a result, and the target must not be adjusted after seeing one.

No trained model ships in the repository. `ml/main.py` serves the documented `baseline-0.1`
heuristic until `/train` is run, so a forecast can never be stamped with a model version that
traces back to synthetic seed data.

---

## 6. Where the §2 constraints are enforced

Two constraints in §2 cannot be expressed as MySQL `CHECK` constraints, because a `CHECK` may
not read another table. Both are enforced in the application instead, and the report should say
so rather than implying a database-level guarantee.

| Constraint | Enforced in | How |
|---|---|---|
| §2.3 — `staff_user.circle_id` MUST be NULL when the role is `SYS_ADMIN` | `app/Models/StaffUser.php` (`saving` hook) | §6 makes the Eloquent DAL the single path to the database, so controllers, seeders and tinker all pass through the hook. A System Administrator is deliberately circle-less: `requireCircleAccess` lets that role reach any circle, so a stored `circle_id` would misrepresent the scope the token carries. Covered by `DataIntegrityTest`. |
| §2.5 — the `staff_user` referenced by `student_teacher` MUST hold role `TEACHER` | `app/Http/Controllers/StudentController::assignTeachers` | The only write path to the junction. It also refuses a teacher from another circle, which the schema cannot express either. Covered by `DataIntegrityTest`. |

Everything else in §2 is enforced by the schema itself: `UNIQUE (student_id, session_date)`,
the composite primary keys on `student_badge` and `student_challenge`, the `CASCADE` / `RESTRICT`
/ `SET NULL` foreign-key actions, and the `CHECK` constraints on `current_juz`, `weight`,
`pages_memorized`, `eta_days`, `condition_value`, `xp_reward` and `progress`.

**Append-only enforcement (rule 4)** is a database grant, not application code:
`scripts/db_grants.sql` gives `halaqtna_api` `SELECT, INSERT` and never `UPDATE` or `DELETE` on
`audit_log` or `xp_ledger`. The grant host is substituted per environment (`127.0.0.1` locally,
`%` under Docker Compose) and `scripts/db_setup.sh` verifies the result and fails the setup if
either privilege is present. The API therefore serves traffic as `halaqtna_api`, never as
`halaqtna_admin` — pointing it at the admin account would silently void the guarantee.

---

## 7. NFR9 — measured line coverage

**NFR9 is met.** Measured with pcov 1.0.12 on PHP 8.3.33, 2026-09-19:

```
php -d pcov.enabled=1 -d pcov.directory=app vendor/bin/phpunit --coverage-text
```

| | Result |
|---|---|
| Tests | 96 passing, 512 assertions |
| **Lines** | **92.78% (578 / 623)** |
| Methods | 90.08% (109 / 121) |

Per backend module, which is what NFR9 actually asks for — **every module is at or above the
70% threshold**:

| Module | Lines | | Module | Lines |
|---|---|---|---|---|
| `SessionController` | 100% | | `AuthRbacService` | 96.55% |
| `ReportService` | 100% | | `CircleController` | 92.31% |
| `AuditLogger` | 100% | | `MlClient` | 85.71% |
| `StaffController` | 100% | | `ShareController` | 82.26% |
| `AuditController` | 100% | | `AuthController` | 75.00% |
| `JwtAuthenticate` | 100% | | `GamificationEngine` | 71.93% |
| `StudentController` | 98.68% | | | |
| `AnalyticsEngine` | 97.18% | | | |

The figure is a **measurement, not a target restated**. Reproduce it with the command above;
`--min=70` makes the threshold fail the build rather than being checked by eye.

**How it was reached.** The I1 RBAC suite alone gave 74.44% overall but left four modules short,
exactly as §9 warns: `ReportService` at 2.44% (FR14/FR15 had no test at all), `MlClient` at
47.62%, `CircleController` at 47.69% and `StudentController` at 63.16%. Three suites were added
to close them — `ReportingTest` (FR14/FR15, including that the Report Service is the only writer
to file storage), `PredictionTest` (FR10 both sides of the internal HTTP boundary, and the UC13
fallback) and `AdministrationTest` (FR19/FR20, FR3, and the UC19–UC23 student reads).

One dead file was removed rather than tested: `app/Http/Middleware/RequireRole.php` was
registered as a `role:` alias that no route ever used. Every authorization decision already goes
through `AuthRbacService` from the controller that needs it, because most checks depend on the
resource (*this* circle, *this* student) and a route alias cannot express that. Rule 5 is
unaffected — the decisions were never in the middleware.

---

## 8. Two defects the test suite could not have found

Both were found by **running the assembled system**, not by testing it, and both are worth a
sentence in the evaluation chapter as evidence for why a deployment rehearsal is part of P9.

### 8.1 The login endpoints were dead on a fresh deployment

`CACHE_STORE=database` backs the §5.1 rate limiter, but no migration created the `cache` table.
The first request to `POST /api/auth/login` or `/api/auth/student-login` returned **500**, so
FR1 and FR2 were both unreachable on any newly provisioned database.

The suite could not see it: `phpunit.xml` sets `CACHE_STORE=array`, which needs no table. Every
one of the rate-limiting tests passed against a store that does not exist in production. Fixed by
the migration in §1 item 7, plus a test that asserts the tables exist **and** that the `database`
store round-trips a value — written deliberately against the driver the suite does *not* use.

**The lesson for the report:** a test environment that differs from the deployment environment
can only prove things about the test environment. Where they differ, assert the difference.

### 8.2 A `#` in an environment value silently truncated the administrator password

`SYS_ADMIN_PASSWORD=Admin#2026` in `api/.env`. Unquoted, dotenv reads `#` as the start of a
comment, so the seeded value was **`Admin`** — a five-character password on the System
Administrator account, the one role that can reach every circle and the audit trail.

Nothing failed loudly. The seeder ran, the account existed, and `bcrypt` hashed the truncated
string perfectly happily; the only symptom was that the documented password did not work. Fixed by
quoting the value and warning about it in all three env templates.

**The lesson for the report:** silent truncation of a secret is worse than a crash. A credential
that is weaker than it looks gives false assurance, and NFR3 ("bcrypt hashes; signed JWTs") is
satisfied on paper while the actual protection is five characters.

---

## 9. Second review round — role boundary, plain language, Arabic PDF

A walkthrough of the working system produced a second set of changes. The full Arabic
analysis, mapping each one to the requirement it touches, is in
`docs/مطابقة-التعديلات-للتقرير.md`; this section is the English summary for the report.

### 9.1 Three places where the code was wider than the report

| # | What the code did | What the report says | Fix |
|---|---|---|---|
| 1 | A System Administrator could read every circle's roster, every student's metrics and every circle report (`scopeCircleId` returned `null` for the role). | Table 1.1 gives that role circles, circle administrators, system settings and the audit trail. FR19 says the same. Rosters, students and performance data are FR20 and FR14 — the Circle Administrator's. | `requireCircleAccess` now refuses `SYS_ADMIN` outright, and `requireDeploymentAdmin` carries FR19. The two remits are disjoint rather than nested. Pinned by `RbacTest::test_sys_admin_manages_circles_and_supervisors_but_never_circle_data`. |
| 2 | `StudentController::store` accepted `TEACHER`. | FR20 gives student creation to the Circle Administrator. Table 1.1's teacher row does not mention it. | Restricted to `CIRCLE_ADMIN`. A teacher who also supervises the circle signs in with that role; the grant follows the role, not the person. |
| 3 | The Arabic PDF was produced by DomPDF, which performs no Arabic shaping and no bidi reordering — every Arabic report came out as isolated letters running left to right. | NFR6: every string exists in both languages and no untranslated string reaches production. FR14, FR15. | Replaced with mPDF, which joins the letters, applies the bidi algorithm and embeds XB Riyaz. `ArabicPdfTest` asserts the embedded composite font rather than a `%PDF-` header — the old header check passed on the broken output, which is how the defect survived. |

### 9.2 Additive schema changes (Figure 4.7)

| Column | Why | Report impact |
|---|---|---|
| `staff_user.phone`, `staff_user.address` | FR20: the Circle Administrator records a teacher's full contact details at registration. | Add to Figure 4.7; note under FR20. Both describe the staff user only — 3NF unaffected. |
| `student.guardian_phone`, `student.address`, `student.age` | `guardian_phone` is what makes FR15 deliverable: the teacher hands the exported report to the parent over WhatsApp. The parent still has no account and stays outside the boundary of Figure 1.1. | Add to Figure 4.7; note `guardian_phone` under FR15. |
| `student.access_code_issued_at` | Supports "one memorable code per month" (FR3). The code stays single-purpose and revocable (NFR3); this only records when it was last rotated so the UI can show a validity date instead of inviting a fresh code at every visit. | Note under FR3. |

### 9.3 Vocabulary changes — presentation only

FR7–FR9 still compute Mastery, momentum, precision, consistency and review depth with the
formulas of Table 3.4, and those names are unchanged in the API, the schema and this report.
What changed is the label a user reads and the one-line explanation under it (`ReportWords`
for the PDFs, the locale files for the clients). FR11's four independent rankings are intact.

Removed from user-facing screens, not from the system: the weighted error load `E(s)`,
`d_max`, `α`, the per-error-type weights, the prediction `model_version`, and raw enum codes
such as `PAGES_TOTAL`. Each session row now shows the count of notes and an accuracy
percentage, both derived from the same formulas.

**English was not removed.** FR17, O6 and NFR6 require both languages. What was fixed is
English leaking into the Arabic interface.

### 9.4 Attendance, session type and the recitation range

| Change | Report position | Status |
|---|---|---|
| Attendance taken on its own screen for the whole circle (`GET`/`POST /api/attendance`) | FR4 requires an attendance status per student per session; it does not say where. Separating it serves NFR5 — recording an absence no longer means opening a full recitation form. | Compliant |
| "Late" removed from the register | Table 4.1 lists `attendance_status in (P, A, L, E)`. **The column is unchanged and still accepts all four**, so legacy rows display correctly; only the UI stopped offering it. Every teacher interviewed treated a late arrival as present, and no formula in the report distinguished them (`consistency` counts P and L alike). | Implementation decision; note against Table 4.1 |
| `MIXED` removed from `session_type` | `session_type` is not in the CPIT-498 report at all — it is the I2 decision recorded in §1 item 1 above. | Moves the code back toward the report |
| Surah chosen by name | §4.7 requires the range in four numeric columns for 1NF. **Storage is unchanged**; only the input control did. The server now also bounds the ayah by the Surah actually chosen, which tightens validation rather than relaxing it. | Compliant |

### 9.5 Additions that need a line in the report

1. **Teacher self-service** (`/api/me/profile`, `/api/me/password`) — no FR covers it.
   Proposed as **FR22** under M1. The edit lands on the same `staff_user` row the Circle
   Administrator reads, so there is no second copy of a teacher's profile, and every change
   writes an audit row (FR18). Role, circle and `is_active` stay with FR19/FR20.
2. **The guardian's PDF behind the share token** (`GET /p/{token}/report.pdf`) — §2.13 limits
   the public card to minimum data. The full report is what FR15 already authorises the
   teacher to hand a parent; the link is the delivery. All §2.13 controls are kept: expiry,
   revocation, flat 404 for unknown or retired tokens, and an audit row per download.
3. **Access code length: 8 → 6** (three letters, three digits). NFR3's requirements —
   single-purpose, revocable — both hold, and the report states no length. The trade must be
   stated explicitly: ~9.3 million combinations, held by the NFR3a throttles (five failures
   then a fifteen-minute lockout; 100 attempts per hour per IP), granting nothing but one
   student's own read-only dashboard (FR16). The eight-character codes were being regenerated
   at almost every sign-in because nobody could retain them, which defeated FR2 in practice.
4. **The progress trend chart.** No new coefficient was introduced, deliberately: the bars are
   weekly pages (FR8's raw input) and the line is the §3.3 Mastery formula evaluated at the
   end of each week. A new weighting would have needed its own row in Table 3.4 and its own
   justification. The verbal direction compares the last four weeks with the previous four and
   reports "steady" unless the change exceeds three points of level or a quarter page a week.
5. **XP correction entries.** Editing or deleting a session posts a compensating `ADJUST` row
   rather than rewriting `xp_ledger`, which Table 4.1 makes insert-only. Deletion previously
   left the points behind, because `xp_ledger.session_id` is `SET NULL` on delete.

---

## 10. Third review round — a full audit of the code

A file-by-file review of the API, both clients, the ML service and the deployment files.
Every backend defect below is pinned by a test in `api/tests/Feature/HardeningTest.php` (or
`DataIntegrityTest`), and each of those tests was run against the code **before** the fix to
confirm that it fails there. None of these changes alters a formula, a requirement or the
schema; most of them are the code being brought back in line with what the report already says.

### 10.1 Security (NFR3, NFR3a, FR21)

| # | Defect | Fix |
|---|---|---|
| 1 | **Revoking a credential did not revoke its tokens.** Rotating a leaked access code, or changing a password, left every token already issued valid for its full 12 hours. NFR3 calls the code "revocable"; in practice it was not. | Each token carries a keyed fingerprint of the credential it was issued against (the password hash or the access code). A password change, a supervisor's reset or a code rotation signs out every device at once. The device that changed its own password receives a fresh token. |
| 2 | **Behind nginx every request came from one address.** Laravel trusted no proxy, so it saw the nginx container as the client: five wrong codes from anyone locked **every** student out for fifteen minutes, and share links were built as `http://` — the parent's first request carried the token in clear text. | `TRUSTED_PROXIES` (set to `*` under Compose, where the API is unreachable except through nginx), and nginx now **overwrites** `X-Forwarded-For` rather than appending to it, so a client cannot choose its own IP. |
| 3 | **No limit on password spraying.** Staff sign-in was throttled per email + IP only, so one address could try five passwords against every account in turn. | The same 100-per-hour-per-IP ceiling students already had now applies to staff sign-in too. §4 above should read "a secondary limit of 100 failed attempts per hour per IP on **both** endpoints". |
| 4 | Sign-in response time revealed whether an email belonged to a staff member (no bcrypt round for an unknown email or a suspended account). | The hash is always checked, against a dummy hash when the email is unknown. |
| 5 | A share link could be issued for any number of days (`days=36500`). | `days` is 1–30; §2.13's thirty days is now a ceiling, not only a default. |
| 6 | The student's own report (and the guardian's PDF) serialised the full teacher records — email, phone, home address. | Teachers are listed by name only. |
| 7 | `JWT_SECRET`, the ML address and the seeded admin were read with `env()` at run time, which returns `null` once `config:cache` is used. An empty or short secret surfaced as an opaque 500. | All read through `config/halaqtna.php`; a secret under 32 characters fails with a message saying so. |
| 8 | Passwords set by an administrator could be 6 characters; self-service required 8. | One rule everywhere: 8–72 characters (bcrypt ignores anything past 72 bytes). |

### 10.2 Deployment (rule 4, rule 6)

| # | Defect | Fix |
|---|---|---|
| 1 | **Sign-in was dead on MySQL.** `scripts/db_grants.sql` granted `halaqtna_api` nothing on the `cache` and `cache_locks` tables that the rate limiter uses, so every login failed with *SELECT command denied* — the §8.1 defect again, on the least-privilege deployment this time. SQLite has no grants, which is why the suite never saw it. | Grants added, and a test now checks that **every** migrated table has a grant line. |
| 2 | The `api` container ran `migrate` at start-up as `halaqtna_api`, which cannot create tables — so on a fresh stack the container exited, and the documented `DB_HOST=db bash scripts/db_setup.sh` could not reach the unpublished `db` service from the host at all. | The container only serves. `scripts/docker_setup.sh` migrates as `halaqtna_admin` in a one-off container, applies the grants through the `db` container's client, seeds and verifies the append-only guarantee. |
| 3 | `scripts/db_setup.sh` ran `migrate:fresh` — run against a live database it would erase every student's history. | Plain `migrate` by default; `FRESH=1` to reset. |
| 4 | No `.dockerignore`: a developer's `api/.env`, local SQLite file and `vendor/` were copied into the image. | `.dockerignore` for `api/` and `ml/`. |
| 5 | nginx sent no security headers. | HSTS, `nosniff`, `X-Frame-Options: DENY`, a referrer policy and a permissions policy on every response. |
| 6 | Every PDF export — including every tap on a guardian's public link — wrote a new file that was never deleted. | One stored copy per report and language, overwritten; the response is served from memory. |

### 10.3 Correctness (FR4, FR5, FR7–FR9, FR12, FR13)

| # | Defect | Fix |
|---|---|---|
| 1 | **XP depended on the order of register and recitation.** The register awarded nothing for attending, a later correction of the same row did; and re-marking a student absent after a recitation left the page XP in place. | One routine brings a session's ledger in line with the session as it stands, from every path (register, recitation, correction). The first award keeps its own reason; later differences are one `ADJUST` entry — the append-only rule is unchanged. |
| 2 | An absence could keep a passage, pages and notes (and the SPA's editor wrote "Al-Fatihah 1" onto rows that had none). | An absence carries none of them, whichever screen records it. |
| 3 | Sessions could be dated in the future, creating weeks that have not happened in every weekly figure. | `session_date` must be today or earlier. |
| 4 | "The last eight sessions" (Mastery, §3.3; consistency, §3.6) were chosen by insertion order, so a register typed in late for last month counted as the most recent. | Chosen by date. The §3.3 worked examples still return 87.8 / 75.0 / 93.0. |
| 5 | A `d_max` of 0 saved in UC3 divided by zero in every Mastery figure; alpha and the XP rates were unbounded. | Each setting has a range; unknown keys are refused. |
| 6 | The register awarded no attendance badges (FR12). | Badges are evaluated after the register is saved. |
| 7 | Unique and foreign-key violations were recognised by MySQL's wording only, so on SQLite (the demo path) they were 500s; a 404 named the internal model class. | Driver-independent handling; a plain "Not found". |
| 8 | A refusal from the forecast evaluation ("dataset too small", §9's honest answer) reached the screen as "Something went wrong". | The ML service's reason is passed through. |
| 9 | The demo seed contained ayah ranges past the end of the Surah, which the API itself refuses. | Bounded by the Surah's length. |

### 10.4 Clients

- **Offline queue (UC10 5a), web and mobile.** A session was dropped on *any* server answer — so a teacher whose token had expired while offline lost every queued session to a 401 — and a session queued while a sync was running could be overwritten. Sessions now stay queued on 401/408/429/5xx, only one sync runs at a time, and the queue is re-read before it is written. On the phone, the queue also no longer syncs before the saved sign-in has been read back.
- **Dates.** "Today" was the UTC date, which in Jeddah is still yesterday until 03:00. Both clients now use the local date.
- **Renewing an access code asks first**, because it signs the student out everywhere.
- **The System Administrator can reach My Account** (FR22) to change the seeded password.
- **Clean-up.** 46 unused UI scaffolding components (with their hook, helper and generator config) and 52 unused packages were removed from the web client; two dependencies with published high-severity advisories were upgraded (`npm audit`: 0); ESLint is configured and clean; the locale check now also fails when a client uses a key that exists in neither language.
