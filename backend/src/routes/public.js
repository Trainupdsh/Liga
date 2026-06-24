import express from 'express';
import { query, getLeagueId } from '../db.js';
import { calculateStandings } from '../services/standings.js';

const router = express.Router();

// GET /api/public/league — league info
router.get('/league', async (req, res) => {
  try {
    const leagueId = await getLeagueId();
    const result = await query(
      `SELECT l.id, l.name, l.slug, l.season, l.logo_url, l.status, l.settings,
              s.name AS sport_name, s.display_name AS sport_display_name,
              s.scoring_unit, s.allows_draw
       FROM leagues l
       JOIN sports s ON s.id = l.sport_id
       WHERE l.id = $1`,
      [leagueId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'League not found' });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error('GET /league error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/public/standings — calculated standings table
router.get('/standings', async (req, res) => {
  try {
    const leagueId = await getLeagueId();
    const standings = await calculateStandings(leagueId);
    res.json(standings);
  } catch (err) {
    console.error('GET /standings error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/public/scorers — player ranking by total goals
router.get('/scorers', async (req, res) => {
  try {
    const leagueId = await getLeagueId();
    const result = await query(
      `SELECT p.id, p.name, p.photo_url, p.jersey_number,
              t.id AS team_id, t.name AS team_name, t.short_name AS team_short_name,
              t.shield_url AS team_shield_url,
              SUM(pe.value) AS goals
       FROM player_events pe
       JOIN players p ON p.id = pe.player_id
       JOIN teams t ON t.id = pe.team_id
       JOIN matches m ON m.id = pe.match_id
       WHERE pe.event_type = 'goal'
         AND m.league_id = $1
         AND m.status = 'finished'
       GROUP BY p.id, p.name, p.photo_url, p.jersey_number,
                t.id, t.name, t.short_name, t.shield_url
       ORDER BY goals DESC, p.name ASC`,
      [leagueId]
    );

    res.json(result.rows);
  } catch (err) {
    console.error('GET /scorers error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/public/fixtures — upcoming matches (status=scheduled)
router.get('/fixtures', async (req, res) => {
  try {
    const leagueId = await getLeagueId();
    const result = await query(
      `SELECT m.id, m.round, m.scheduled_at, m.venue, m.status,
              ht.id AS home_team_id, ht.name AS home_team_name,
              ht.short_name AS home_team_short_name, ht.shield_url AS home_team_shield_url,
              at.id AS away_team_id, at.name AS away_team_name,
              at.short_name AS away_team_short_name, at.shield_url AS away_team_shield_url
       FROM matches m
       JOIN teams ht ON ht.id = m.home_team_id
       JOIN teams at ON at.id = m.away_team_id
       WHERE m.league_id = $1
         AND m.status = 'scheduled'
       ORDER BY m.scheduled_at ASC NULLS LAST, m.round ASC`,
      [leagueId]
    );

    res.json(result.rows);
  } catch (err) {
    console.error('GET /fixtures error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/public/results — last 10 finished matches
router.get('/results', async (req, res) => {
  try {
    const leagueId = await getLeagueId();
    const result = await query(
      `SELECT m.id, m.round, m.scheduled_at, m.played_at, m.venue,
              m.home_score, m.away_score, m.status,
              ht.id AS home_team_id, ht.name AS home_team_name,
              ht.short_name AS home_team_short_name, ht.shield_url AS home_team_shield_url,
              at.id AS away_team_id, at.name AS away_team_name,
              at.short_name AS away_team_short_name, at.shield_url AS away_team_shield_url
       FROM matches m
       JOIN teams ht ON ht.id = m.home_team_id
       JOIN teams at ON at.id = m.away_team_id
       WHERE m.league_id = $1
         AND m.status = 'finished'
       ORDER BY m.played_at DESC NULLS LAST, m.scheduled_at DESC
       LIMIT 10`,
      [leagueId]
    );

    // For each match, fetch scorers
    const matchIds = result.rows.map((r) => r.id);
    let events = [];
    if (matchIds.length > 0) {
      const eventsRes = await query(
        `SELECT pe.match_id, pe.event_type, pe.value,
                p.id AS player_id, p.name AS player_name,
                t.id AS team_id, t.name AS team_name
         FROM player_events pe
         JOIN players p ON p.id = pe.player_id
         JOIN teams t ON t.id = pe.team_id
         WHERE pe.match_id = ANY($1)
           AND pe.event_type = 'goal'
         ORDER BY pe.created_at ASC`,
        [matchIds]
      );
      events = eventsRes.rows;
    }

    // Group events by match
    const eventsByMatch = {};
    for (const ev of events) {
      if (!eventsByMatch[ev.match_id]) {
        eventsByMatch[ev.match_id] = [];
      }
      eventsByMatch[ev.match_id].push(ev);
    }

    const matches = result.rows.map((m) => ({
      ...m,
      scorers: eventsByMatch[m.id] || [],
    }));

    res.json(matches);
  } catch (err) {
    console.error('GET /results error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/public/players/search?q=name — search players by name
router.get('/players/search', async (req, res) => {
  try {
    const { q } = req.query;

    if (!q || q.trim().length < 2) {
      return res.status(400).json({ error: 'Search query must be at least 2 characters' });
    }

    const leagueId = await getLeagueId();
    const searchTerm = `%${q.trim()}%`;

    const result = await query(
      `SELECT p.id, p.name, p.photo_url, p.jersey_number, p.active,
              t.id AS team_id, t.name AS team_name, t.short_name AS team_short_name,
              t.shield_url AS team_shield_url
       FROM players p
       JOIN teams t ON t.id = p.team_id
       WHERE p.league_id = $1
         AND p.name ILIKE $2
       ORDER BY p.name ASC
       LIMIT 20`,
      [leagueId, searchTerm]
    );

    res.json(result.rows);
  } catch (err) {
    console.error('GET /players/search error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/public/players/:id — player profile with stats
router.get('/players/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const leagueId = await getLeagueId();

    const playerRes = await query(
      `SELECT p.id, p.name, p.photo_url, p.jersey_number, p.active,
              t.id AS team_id, t.name AS team_name, t.short_name AS team_short_name,
              t.shield_url AS team_shield_url
       FROM players p
       JOIN teams t ON t.id = p.team_id
       WHERE p.id = $1
         AND p.league_id = $2`,
      [id, leagueId]
    );

    if (playerRes.rows.length === 0) {
      return res.status(404).json({ error: 'Player not found' });
    }

    const player = playerRes.rows[0];

    // Get player stats
    const statsRes = await query(
      `SELECT SUM(pe.value) AS total_goals,
              COUNT(DISTINCT pe.match_id) AS matches_scored
       FROM player_events pe
       JOIN matches m ON m.id = pe.match_id
       WHERE pe.player_id = $1
         AND pe.event_type = 'goal'
         AND m.status = 'finished'`,
      [id]
    );

    const stats = statsRes.rows[0];

    // Get recent goals
    const recentGoalsRes = await query(
      `SELECT pe.match_id, pe.value, pe.created_at,
              m.scheduled_at, m.played_at, m.round,
              m.home_score, m.away_score,
              ht.name AS home_team_name, at.name AS away_team_name
       FROM player_events pe
       JOIN matches m ON m.id = pe.match_id
       JOIN teams ht ON ht.id = m.home_team_id
       JOIN teams at ON at.id = m.away_team_id
       WHERE pe.player_id = $1
         AND pe.event_type = 'goal'
         AND m.status = 'finished'
       ORDER BY m.played_at DESC NULLS LAST
       LIMIT 5`,
      [id]
    );

    res.json({
      ...player,
      stats: {
        total_goals: parseInt(stats.total_goals) || 0,
        matches_scored: parseInt(stats.matches_scored) || 0,
      },
      recent_goals: recentGoalsRes.rows,
    });
  } catch (err) {
    console.error('GET /players/:id error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
