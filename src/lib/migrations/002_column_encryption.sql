-- 002_column_encryption.sql
-- PostgreSQL column-level encryption for personal data fields
-- Implements: Requirement 11.1 (encrypted at rest), Requirement 11.2 (TLS 1.2+)
--
-- Prerequisites:
--   1. PostgreSQL ssl = on in postgresql.conf with TLS 1.2+ (ssl_min_protocol_version = 'TLSv1.2')
--   2. ENCRYPTION_KEY set as a server-side application secret (64-char hex / 32 bytes)
--
-- Strategy:
--   Use pgcrypto's pgp_sym_encrypt / pgp_sym_decrypt for column-level encryption
--   of personal data fields. The symmetric key is supplied by the application at
--   query time and never stored in the database.

-- Enable pgcrypto (already enabled in 001 for gen_random_uuid, but explicit here)
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Encrypted columns in the Booking table:
--   - name       (attendee name)
--   - email      (attendee email)
--   - role       (attendee role)
--   - pf         (performance factor)
--
-- Alter columns from VARCHAR to BYTEA to hold encrypted data:
ALTER TABLE booking
  ALTER COLUMN name  TYPE BYTEA USING pgp_sym_encrypt(name,  current_setting('app.encryption_key'))::BYTEA,
  ALTER COLUMN email TYPE BYTEA USING pgp_sym_encrypt(email, current_setting('app.encryption_key'))::BYTEA,
  ALTER COLUMN role  TYPE BYTEA USING pgp_sym_encrypt(role,  current_setting('app.encryption_key'))::BYTEA,
  ALTER COLUMN pf    TYPE BYTEA USING pgp_sym_encrypt(pf,    current_setting('app.encryption_key'))::BYTEA;

-- Encrypted columns in the WaitlistEntry table:
--   - name       (attendee name)
--   - email      (attendee email)
--   - role       (attendee role)
--   - pf         (performance factor)
--
ALTER TABLE waitlist_entry
  ALTER COLUMN name  TYPE BYTEA USING pgp_sym_encrypt(name,  current_setting('app.encryption_key'))::BYTEA,
  ALTER COLUMN email TYPE BYTEA USING pgp_sym_encrypt(email, current_setting('app.encryption_key'))::BYTEA,
  ALTER COLUMN role  TYPE BYTEA USING pgp_sym_encrypt(role,  current_setting('app.encryption_key'))::BYTEA,
  ALTER COLUMN pf    TYPE BYTEA USING pgp_sym_encrypt(pf,    current_setting('app.encryption_key'))::BYTEA;

-- Example: inserting encrypted data
-- INSERT INTO booking (session_id, name, email, role, pf, reference_code)
-- VALUES (
--   '...',
--   pgp_sym_encrypt('John Doe',          current_setting('app.encryption_key')),
--   pgp_sym_encrypt('john@example.com',  current_setting('app.encryption_key')),
--   pgp_sym_encrypt('Engineer',          current_setting('app.encryption_key')),
--   pgp_sym_encrypt('PF-1234',           current_setting('app.encryption_key')),
--   'REF-ABC123'
-- );
--
-- Example: reading decrypted data
-- SELECT
--   pgp_sym_decrypt(name,  current_setting('app.encryption_key')) AS name,
--   pgp_sym_decrypt(email, current_setting('app.encryption_key')) AS email
-- FROM booking
-- WHERE id = '...';
