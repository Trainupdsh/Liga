-- Sports League Management Platform
-- Initial Schema Migration
-- Run this against your Supabase/PostgreSQL database

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- =============================================
-- SPORTS CATALOG
-- =============================================
CREATE TABLE IF NOT EXISTS sports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR NOT NULL,                          -- 'handball'
  display_name VARCHAR NOT NULL,                  -- 'Handball'
  scoring_unit VARCHAR NOT NULL,                  -- 'gol'
  standings_type VARCHAR NOT NULL,                -- 'points_3_1_0'
  allows_draw BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- =============================================
-- LEAGUES
-- =============================================
CREATE TABLE IF NOT EXISTS leagues (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sport_id UUID REFERENCES sports(id),
  name VARCHAR NOT NULL,
  slug VARCHAR UNIQUE NOT NULL,                   -- URL-friendly identifier
  season VARCHAR NOT NULL,
  logo_url VARCHAR,
  status VARCHAR DEFAULT 'active',                -- draft | active | finished
  settings JSONB DEFAULT '{"points_win":3,"points_draw":1,"points_loss":0}',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- =============================================
-- ADMIN USERS (one per league for MVP)
-- =============================================
CREATE TABLE IF NOT EXISTS admin_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  league_id UUID REFERENCES leagues(id),
  email VARCHAR UNIQUE NOT NULL,
  password_hash VARCHAR NOT NULL,
  name VARCHAR NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- =============================================
-- TEAMS
-- =============================================
CREATE TABLE IF NOT EXISTS teams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  league_id UUID REFERENCES leagues(id),
  name VARCHAR NOT NULL,
  short_name VARCHAR(4),
  shield_url VARCHAR,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- =============================================
-- PLAYERS
-- =============================================
CREATE TABLE IF NOT EXISTS players (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  league_id UUID REFERENCES leagues(id),
  team_id UUID REFERENCES teams(id),
  name VARCHAR NOT NULL,
  jersey_number INT,
  photo_url VARCHAR,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- =============================================
-- MATCHES (FIXTURE)
-- =============================================
CREATE TABLE IF NOT EXISTS matches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  league_id UUID REFERENCES leagues(id),
  home_team_id UUID REFERENCES teams(id),
  away_team_id UUID REFERENCES teams(id),
  round INT,
  scheduled_at TIMESTAMPTZ,
  venue VARCHAR,
  status VARCHAR DEFAULT 'scheduled',             -- scheduled | finished | cancelled
  home_score INT,
  away_score INT,
  played_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- =============================================
-- PLAYER EVENTS (goals, extensible for cards/assists)
-- =============================================
CREATE TABLE IF NOT EXISTS player_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id UUID REFERENCES matches(id) ON DELETE CASCADE,
  player_id UUID REFERENCES players(id),
  team_id UUID REFERENCES teams(id),
  event_type VARCHAR NOT NULL,                    -- 'goal'
  value NUMERIC DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- =============================================
-- INDEXES FOR PERFORMANCE
-- =============================================
CREATE INDEX IF NOT EXISTS idx_teams_league_id ON teams(league_id);
CREATE INDEX IF NOT EXISTS idx_players_league_id ON players(league_id);
CREATE INDEX IF NOT EXISTS idx_players_team_id ON players(team_id);
CREATE INDEX IF NOT EXISTS idx_matches_league_id ON matches(league_id);
CREATE INDEX IF NOT EXISTS idx_matches_status ON matches(status);
CREATE INDEX IF NOT EXISTS idx_matches_scheduled_at ON matches(scheduled_at);
CREATE INDEX IF NOT EXISTS idx_player_events_match_id ON player_events(match_id);
CREATE INDEX IF NOT EXISTS idx_player_events_player_id ON player_events(player_id);
CREATE INDEX IF NOT EXISTS idx_player_events_event_type ON player_events(event_type);

-- =============================================
-- SEED DATA: HANDBALL SPORT
-- =============================================
INSERT INTO sports (name, display_name, scoring_unit, standings_type, allows_draw)
VALUES ('handball', 'Handball', 'gol', 'points_3_1_0', true)
ON CONFLICT DO NOTHING;

-- =============================================
-- SEED DATA: EXAMPLE LEAGUE
-- Uncomment and modify to create your league
-- =============================================
-- DO $$
-- DECLARE
--   sport_uuid UUID;
--   league_uuid UUID;
-- BEGIN
--   SELECT id INTO sport_uuid FROM sports WHERE name = 'handball' LIMIT 1;
--
--   INSERT INTO leagues (sport_id, name, slug, season, status)
--   VALUES (sport_uuid, 'Liga Municipal de Handball', 'liga-municipal-handball', '2024', 'active')
--   RETURNING id INTO league_uuid;
--
--   -- Create admin user (password: 'admin123' - CHANGE THIS!)
--   INSERT INTO admin_users (league_id, email, password_hash, name)
--   VALUES (
--     league_uuid,
--     'admin@liga.com',
--     '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', -- password
--     'Administrador'
--   );
-- END $$;

-- =============================================
-- SUPABASE STORAGE SETUP
-- Run this in Supabase SQL editor or via API:
-- =============================================
-- Create 'images' bucket (do this in Supabase dashboard or via API)
-- The bucket should be public for image serving

-- =============================================
-- ROW LEVEL SECURITY (optional, if using Supabase RLS)
-- For this MVP we use service role key, so RLS is bypassed
-- =============================================
