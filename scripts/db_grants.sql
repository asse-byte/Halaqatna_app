-- Halaqtna (CPIT-499) — least-privilege grants for the Laravel and ML database users.
-- Run as the DB admin AFTER migrations, because the grants are per table.
--
-- Non-negotiable rule 4: `audit_log` and `xp_ledger` are APPEND-ONLY. The API user is
-- granted SELECT + INSERT on both and NEVER receives UPDATE or DELETE. Do not add them.
--
-- __HOST__ is substituted by scripts/db_setup.sh before this file reaches the server:
--   local (host MySQL on the loopback) -> 127.0.0.1
--   Docker Compose (api and ml are other containers) -> %
-- Run it through the script rather than by hand, or the grants land on a user that does
-- not exist and the append-only guarantee is silently not applied.

GRANT SELECT, INSERT, UPDATE, DELETE ON halaqtna.role TO 'halaqtna_api'@'__HOST__';
GRANT SELECT, INSERT, UPDATE, DELETE ON halaqtna.circle TO 'halaqtna_api'@'__HOST__';
GRANT SELECT, INSERT, UPDATE, DELETE ON halaqtna.staff_user TO 'halaqtna_api'@'__HOST__';
GRANT SELECT, INSERT, UPDATE, DELETE ON halaqtna.student TO 'halaqtna_api'@'__HOST__';
GRANT SELECT, INSERT, UPDATE, DELETE ON halaqtna.student_teacher TO 'halaqtna_api'@'__HOST__';
GRANT SELECT, INSERT, UPDATE, DELETE ON halaqtna.error_type TO 'halaqtna_api'@'__HOST__';
GRANT SELECT, INSERT, UPDATE, DELETE ON halaqtna.session TO 'halaqtna_api'@'__HOST__';
GRANT SELECT, INSERT, UPDATE, DELETE ON halaqtna.session_error TO 'halaqtna_api'@'__HOST__';
-- §2.9 predictions are never overwritten: new rows only.
GRANT SELECT, INSERT ON halaqtna.prediction TO 'halaqtna_api'@'__HOST__';
GRANT SELECT, INSERT, UPDATE, DELETE ON halaqtna.badge TO 'halaqtna_api'@'__HOST__';
GRANT SELECT, INSERT, UPDATE, DELETE ON halaqtna.student_badge TO 'halaqtna_api'@'__HOST__';
GRANT SELECT, INSERT, UPDATE, DELETE ON halaqtna.challenge TO 'halaqtna_api'@'__HOST__';
GRANT SELECT, INSERT, UPDATE, DELETE ON halaqtna.student_challenge TO 'halaqtna_api'@'__HOST__';
-- APPEND ONLY (rule 4) — no UPDATE, no DELETE.
GRANT SELECT, INSERT ON halaqtna.xp_ledger TO 'halaqtna_api'@'__HOST__';
GRANT SELECT, INSERT ON halaqtna.audit_log TO 'halaqtna_api'@'__HOST__';
-- progress_share_link: UPDATE is needed for revoked_at, view_count and last_viewed_at (§2.13).
GRANT SELECT, INSERT, UPDATE ON halaqtna.progress_share_link TO 'halaqtna_api'@'__HOST__';
GRANT SELECT, INSERT, UPDATE, DELETE ON halaqtna.system_setting TO 'halaqtna_api'@'__HOST__';
GRANT SELECT ON halaqtna.migrations TO 'halaqtna_api'@'__HOST__';

-- ML Prediction Service (FR10): read-only. It trains from the database and returns a
-- forecast over internal HTTP; Laravel is what writes the `prediction` row.
GRANT SELECT ON halaqtna.* TO 'halaqtna_ml'@'__HOST__';

FLUSH PRIVILEGES;
