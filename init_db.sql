-- PostgreSQL Database Schema for Poker Profiles
-- This replaces SQL Server with PostgreSQL

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- App Users Table
CREATE TABLE IF NOT EXISTS app_user (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Player Profiles Table
CREATE TABLE IF NOT EXISTS player (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES app_user(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  table_image VARCHAR(100),
  confidence SMALLINT DEFAULT 0 CHECK (confidence >= 0 AND confidence <= 5),
  zones_json TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_player_user ON player(user_id);
CREATE INDEX IF NOT EXISTS idx_player_updated ON player(updated_at DESC);

-- Notes Table
CREATE TABLE IF NOT EXISTS note (
  id SERIAL PRIMARY KEY,
  player_id UUID NOT NULL REFERENCES player(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES app_user(id) ON DELETE CASCADE,
  body TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_note_player ON note(player_id, created_at DESC);

-- Cues Table (for Quick Tap feature)
CREATE TABLE IF NOT EXISTS cue (
  id SERIAL PRIMARY KEY,
  zone VARCHAR(40) NOT NULL,
  label VARCHAR(100) NOT NULL,
  is_active BOOLEAN DEFAULT TRUE
);

-- Observations Table (Quick Tap tracking)
CREATE TABLE IF NOT EXISTS observation (
  id BIGSERIAL PRIMARY KEY,
  player_id UUID NOT NULL REFERENCES player(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES app_user(id) ON DELETE CASCADE,
  bucket SMALLINT NOT NULL CHECK (bucket IN (1, 2, 3, 4)),
  cue_id INTEGER REFERENCES cue(id) ON DELETE SET NULL,
  free_text VARCHAR(400),
  hand_outcome SMALLINT CHECK (hand_outcome IN (0, 1, 2, 3)),
  tilt_state SMALLINT CHECK (tilt_state IN (0, 1, 2, 3)),
  stack_situation SMALLINT CHECK (stack_situation IN (0, 1, 2, 3)),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_obs_player_time ON observation(player_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_obs_player_bucket ON observation(player_id, bucket, created_at DESC);

-- Seed Cue Data
INSERT INTO cue (zone, label) VALUES
  ('hands', 'Chip fumble'),
  ('hands', 'Fast grab/throw'),
  ('voice', 'Overtalking'),
  ('voice', 'Flat/quiet'),
  ('eyes', 'Locked stare'),
  ('eyes', 'Looks away'),
  ('face', 'Jaw relax'),
  ('face', 'Lips press'),
  ('posture', 'Leans in'),
  ('posture', 'Freezes up'),
  ('breathing', 'Breath spike'),
  ('timing', 'Instant bet'),
  ('timing', 'Long tank')
ON CONFLICT DO NOTHING;

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for player table
DROP TRIGGER IF EXISTS update_player_updated_at ON player;
CREATE TRIGGER update_player_updated_at
  BEFORE UPDATE ON player
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Success message
DO $$
BEGIN
  RAISE NOTICE '✅ PostgreSQL database schema created successfully!';
END $$;
