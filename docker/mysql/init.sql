-- Executed once by the mysql image. Least-privilege users; table grants for the API are applied by scripts/db_grants.sql after migrations.
CREATE USER IF NOT EXISTS 'halaqtna_admin'@'%' IDENTIFIED BY 'change-me-admin';
GRANT ALL PRIVILEGES ON halaqtna.* TO 'halaqtna_admin'@'%';
CREATE USER IF NOT EXISTS 'halaqtna_api'@'%' IDENTIFIED BY 'change-me-api';
CREATE USER IF NOT EXISTS 'halaqtna_ml'@'%' IDENTIFIED BY 'change-me-ml';
GRANT SELECT ON halaqtna.* TO 'halaqtna_ml'@'%';
FLUSH PRIVILEGES;
