ALTER TABLE users ADD COLUMN IF NOT EXISTS phone_hash TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS phone_encrypted TEXT;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'phone_number') THEN
    ALTER TABLE users ALTER COLUMN phone_number DROP NOT NULL;
  END IF;
END $$;
CREATE INDEX IF NOT EXISTS users_phone_hash_idx ON users(phone_hash);
