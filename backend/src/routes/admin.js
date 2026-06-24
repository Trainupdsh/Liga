import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import multer from 'multer';
import { createClient } from '@supabase/supabase-js';
import { query, getLeagueId } from '../db.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

// Multer in-memory storage for file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'), false);
    }
  },
});

function getSupabaseClient() {
  return createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY
  );
}

async function uploadImageToSupabase(file, folder) {
  const supabase = getSupabaseClient();
  const ext = file.originalname.split('.').pop();
  const fileName = `${folder}/${Date.now()}-${Math.random().toString(36).substring(7)}.${ext}`;

  const { data, error } = await supabase.storage
    .from('images')
    .upload(fileName, file.buffer, {
      contentType: file.mimetype,
      upsert: false,
    });

  if (error) {
    throw new Error(`Image upload failed: ${error.message}`);
  }

  const { data: urlData } = supabase.storage
    .from('images')
    .getPublicUrl(fileName);

  return urlData.publicUrl;
}

// ===== AUTH ROUTES =====

// POST /api/admin/auth/login
router.post('/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const result = await query(
      `SELECT au.id, au.email, au.password_hash, au.name, au.league_id
       FROM admin_users au
       WHERE au.email = $1`,
      [email.toLowerCase().trim()]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const user = result.rows[0];
    const isValid = await bcrypt.compare(password, user.password_hash);

    if (!isValid) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const token = jwt.sign(
      {
        id: user.id,
        email: user.email,
        name: user.name,
        league_id: user.league_id,
      },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        league_id: user.league_id,
      },
    });
  } catch (err) {
    console.error('POST /auth/login error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/admin/me
router.get('/me', authenticateToken, async (req, res) => {
  try {
    const result = await query(
      `SELECT id, email, name, league_id, created_at
       FROM admin_users
       WHERE id = $1`,
      [req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error('GET /me error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ===== UPLOAD ROUTE =====

// POST /api/admin/upload
router.post('/upload', authenticateToken, upload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No image file provided' });
    }

    const folder = req.body.folder || 'general';
    const url = await uploadImageToSupabase(req.file, folder);

    res.json({ url });
  } catch (err) {
    console.error('POST /upload error:', err);
    res.status(500).json({ error: err.message || 'Upload failed' });
  }
});

// ===== TEAMS ROUTES =====

// GET /api/admin/teams
router.get('/teams', authenticateToken, async (req, res) => {
  try {
    const leagueId = await getLeagueId();
    const result = await query(
      `SELECT t.id, t.name, t.short_name, t.shield_url, t.created_at,
              COUNT(p.id) AS player_count
       FROM teams t
       LEFT JOIN players p ON p.team_id = t.id AND p.active = true
       WHERE t.league_id = $1
       GROUP BY t.id, t.name, t.short_name, t.shield_url, t.created_at
       ORDER BY t.name ASC`,
      [leagueId]
    );

    res.json(result.rows);
  } catch (err) {
    console.error('GET /teams error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/admin/teams
router.post('/teams', authenticateToken, upload.single('shield'), async (req, res) => {
  try {
    const leagueId = await getLeagueId();
    const { name, short_name } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'Team name is required' });
    }

    let shield_url = null;
    if (req.file) {
      shield_url = await uploadImageToSupabase(req.file, 'shields');
    }

    const result = await query(
      `INSERT INTO teams (league_id, name, short_name, shield_url)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [leagueId, name.trim(), short_name?.trim()?.toUpperCase() || null, shield_url]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('POST /teams error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /api/admin/teams/:id
router.put('/teams/:id', authenticateToken, upload.single('shield'), async (req, res) => {
  try {
    const { id } = req.params;
    const leagueId = await getLeagueId();
    const { name, short_name } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'Team name is required' });
    }

    // Check team exists and belongs to league
    const existing = await query(
      'SELECT * FROM teams WHERE id = $1 AND league_id = $2',
      [id, leagueId]
    );

    if (existing.rows.length === 0) {
      return res.status(404).json({ error: 'Team not found' });
    }

    let shield_url = existing.rows[0].shield_url;
    if (req.file) {
      shield_url = await uploadImageToSupabase(req.file, 'shields');
    } else if (req.body.remove_shield === 'true') {
      shield_url = null;
    }

    const result = await query(
      `UPDATE teams
       SET name = $1, short_name = $2, shield_url = $3
       WHERE id = $4 AND league_id = $5
       RETURNING *`,
      [name.trim(), short_name?.trim()?.toUpperCase() || null, shield_url, id, leagueId]
    );

    res.json(result.rows[0]);
  } catch (err) {
    console.error('PUT /teams/:id error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/admin/teams/:id
router.delete('/teams/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const leagueId = await getLeagueId();

    const result = await query(
      'DELETE FROM teams WHERE id = $1 AND league_id = $2 RETURNING id',
      [id, leagueId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Team not found' });
    }

    res.json({ message: 'Team deleted successfully' });
  } catch (err) {
    console.error('DELETE /teams/:id error:', err);
    if (err.code === '23503') {
      return res.status(409).json({ error: 'Cannot delete team with existing players or matches' });
    }
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ===== PLAYERS ROUTES =====

// GET /api/admin/players
router.get('/players', authenticateToken, async (req, res) => {
  try {
    const leagueId = await getLeagueId();
    const { team_id } = req.query;

    let queryText = `
      SELECT p.id, p.name, p.jersey_number, p.photo_url, p.active, p.created_at,
             t.id AS team_id, t.name AS team_name, t.short_name AS team_short_name,
             t.shield_url AS team_shield_url
      FROM players p
      JOIN teams t ON t.id = p.team_id
      WHERE p.league_id = $1`;

    const params = [leagueId];

    if (team_id) {
      params.push(team_id);
      queryText += ` AND p.team_id = $${params.length}`;
    }

    queryText += ' ORDER BY t.name ASC, p.name ASC';

    const result = await query(queryText, params);
    res.json(result.rows);
  } catch (err) {
    console.error('GET /players error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/admin/players
router.post('/players', authenticateToken, upload.single('photo'), async (req, res) => {
  try {
    const leagueId = await getLeagueId();
    const { name, team_id, jersey_number, active } = req.body;

    if (!name || !team_id) {
      return res.status(400).json({ error: 'Name and team are required' });
    }

    // Verify team belongs to league
    const teamCheck = await query(
      'SELECT id FROM teams WHERE id = $1 AND league_id = $2',
      [team_id, leagueId]
    );

    if (teamCheck.rows.length === 0) {
      return res.status(400).json({ error: 'Invalid team' });
    }

    let photo_url = null;
    if (req.file) {
      photo_url = await uploadImageToSupabase(req.file, 'players');
    }

    const result = await query(
      `INSERT INTO players (league_id, team_id, name, jersey_number, photo_url, active)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [
        leagueId,
        team_id,
        name.trim(),
        jersey_number ? parseInt(jersey_number) : null,
        photo_url,
        active !== 'false',
      ]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('POST /players error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /api/admin/players/:id
router.put('/players/:id', authenticateToken, upload.single('photo'), async (req, res) => {
  try {
    const { id } = req.params;
    const leagueId = await getLeagueId();
    const { name, team_id, jersey_number, active } = req.body;

    if (!name || !team_id) {
      return res.status(400).json({ error: 'Name and team are required' });
    }

    const existing = await query(
      'SELECT * FROM players WHERE id = $1 AND league_id = $2',
      [id, leagueId]
    );

    if (existing.rows.length === 0) {
      return res.status(404).json({ error: 'Player not found' });
    }

    let photo_url = existing.rows[0].photo_url;
    if (req.file) {
      photo_url = await uploadImageToSupabase(req.file, 'players');
    } else if (req.body.remove_photo === 'true') {
      photo_url = null;
    }

    const result = await query(
      `UPDATE players
       SET name = $1, team_id = $2, jersey_number = $3, photo_url = $4, active = $5
       WHERE id = $6 AND league_id = $7
       RETURNING *`,
      [
        name.trim(),
        team_id,
        jersey_number ? parseInt(jersey_number) : null,
        photo_url,
        active !== 'false',
        id,
        leagueId,
      ]
    );

    res.json(result.rows[0]);
  } catch (err) {
    console.error('PUT /players/:id error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/admin/players/:id
router.delete('/players/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const leagueId = await getLeagueId();

    const result = await query(
      'DELETE FROM players WHERE id = $1 AND league_id = $2 RETURNING id',
      [id, leagueId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Player not found' });
    }

    res.json({ message: 'Player deleted successfully' });
  } catch (err) {
    console.error('DELETE /players/:id error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ===== MATCHES ROUTES =====

// GET /api/admin/matches
router.get('/matches', authenticateToken, async (req, res) => {
  try {
    const leagueId = await getLeagueId();
    const result = await query(
      `SELECT m.id, m.round, m.scheduled_at, m.venue, m.status,
              m.home_score, m.away_score, m.played_at, m.created_at,
              ht.id AS home_team_id, ht.name AS home_team_name,
              ht.short_name AS home_team_short_name, ht.shield_url AS home_team_shield_url,
              at.id AS away_team_id, at.name AS away_team_name,
              at.short_name AS away_team_short_name, at.shield_url AS away_team_shield_url
       FROM matches m
       JOIN teams ht ON ht.id = m.home_team_id
       JOIN teams at ON at.id = m.away_team_id
       WHERE m.league_id = $1
       ORDER BY m.round ASC NULLS LAST, m.scheduled_at ASC NULLS LAST`,
      [leagueId]
    );

    res.json(result.rows);
  } catch (err) {
    console.error('GET /matches error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/admin/matches
router.post('/matches', authenticateToken, async (req, res) => {
  try {
    const leagueId = await getLeagueId();
    const { home_team_id, away_team_id, round, scheduled_at, venue } = req.body;

    if (!home_team_id || !away_team_id) {
      return res.status(400).json({ error: 'Home and away teams are required' });
    }

    if (home_team_id === away_team_id) {
      return res.status(400).json({ error: 'Home and away teams must be different' });
    }

    const result = await query(
      `INSERT INTO matches (league_id, home_team_id, away_team_id, round, scheduled_at, venue)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [
        leagueId,
        home_team_id,
        away_team_id,
        round ? parseInt(round) : null,
        scheduled_at || null,
        venue?.trim() || null,
      ]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('POST /matches error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /api/admin/matches/:id
router.put('/matches/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const leagueId = await getLeagueId();
    const { home_team_id, away_team_id, round, scheduled_at, venue, status } = req.body;

    const existing = await query(
      'SELECT * FROM matches WHERE id = $1 AND league_id = $2',
      [id, leagueId]
    );

    if (existing.rows.length === 0) {
      return res.status(404).json({ error: 'Match not found' });
    }

    const result = await query(
      `UPDATE matches
       SET home_team_id = COALESCE($1, home_team_id),
           away_team_id = COALESCE($2, away_team_id),
           round = $3,
           scheduled_at = $4,
           venue = $5,
           status = COALESCE($6, status)
       WHERE id = $7 AND league_id = $8
       RETURNING *`,
      [
        home_team_id || null,
        away_team_id || null,
        round ? parseInt(round) : existing.rows[0].round,
        scheduled_at !== undefined ? scheduled_at || null : existing.rows[0].scheduled_at,
        venue !== undefined ? venue?.trim() || null : existing.rows[0].venue,
        status || null,
        id,
        leagueId,
      ]
    );

    res.json(result.rows[0]);
  } catch (err) {
    console.error('PUT /matches/:id error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/admin/matches/:id
router.delete('/matches/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const leagueId = await getLeagueId();

    const result = await query(
      'DELETE FROM matches WHERE id = $1 AND league_id = $2 RETURNING id',
      [id, leagueId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Match not found' });
    }

    res.json({ message: 'Match deleted successfully' });
  } catch (err) {
    console.error('DELETE /matches/:id error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/admin/matches/:id/result — set score + status=finished
router.post('/matches/:id/result', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const leagueId = await getLeagueId();
    const { home_score, away_score, played_at } = req.body;

    if (home_score === undefined || away_score === undefined) {
      return res.status(400).json({ error: 'Home score and away score are required' });
    }

    const existing = await query(
      'SELECT * FROM matches WHERE id = $1 AND league_id = $2',
      [id, leagueId]
    );

    if (existing.rows.length === 0) {
      return res.status(404).json({ error: 'Match not found' });
    }

    const result = await query(
      `UPDATE matches
       SET home_score = $1, away_score = $2, status = 'finished',
           played_at = COALESCE($3, NOW())
       WHERE id = $4 AND league_id = $5
       RETURNING *`,
      [
        parseInt(home_score),
        parseInt(away_score),
        played_at || null,
        id,
        leagueId,
      ]
    );

    res.json(result.rows[0]);
  } catch (err) {
    console.error('POST /matches/:id/result error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/admin/matches/:id/events
router.get('/matches/:id/events', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const leagueId = await getLeagueId();

    // Verify match belongs to league
    const matchCheck = await query(
      'SELECT id FROM matches WHERE id = $1 AND league_id = $2',
      [id, leagueId]
    );

    if (matchCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Match not found' });
    }

    const result = await query(
      `SELECT pe.id, pe.event_type, pe.value, pe.created_at,
              p.id AS player_id, p.name AS player_name, p.jersey_number,
              t.id AS team_id, t.name AS team_name
       FROM player_events pe
       JOIN players p ON p.id = pe.player_id
       JOIN teams t ON t.id = pe.team_id
       WHERE pe.match_id = $1
       ORDER BY pe.created_at ASC`,
      [id]
    );

    res.json(result.rows);
  } catch (err) {
    console.error('GET /matches/:id/events error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/admin/matches/:id/events — add goal event
router.post('/matches/:id/events', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const leagueId = await getLeagueId();
    const { player_id, team_id, event_type = 'goal', value = 1 } = req.body;

    if (!player_id || !team_id) {
      return res.status(400).json({ error: 'Player and team are required' });
    }

    // Verify match belongs to league
    const matchCheck = await query(
      'SELECT id FROM matches WHERE id = $1 AND league_id = $2',
      [id, leagueId]
    );

    if (matchCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Match not found' });
    }

    const result = await query(
      `INSERT INTO player_events (match_id, player_id, team_id, event_type, value)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [id, player_id, team_id, event_type, value]
    );

    // Return with player info
    const eventRes = await query(
      `SELECT pe.id, pe.event_type, pe.value, pe.created_at,
              p.id AS player_id, p.name AS player_name, p.jersey_number,
              t.id AS team_id, t.name AS team_name
       FROM player_events pe
       JOIN players p ON p.id = pe.player_id
       JOIN teams t ON t.id = pe.team_id
       WHERE pe.id = $1`,
      [result.rows[0].id]
    );

    res.status(201).json(eventRes.rows[0]);
  } catch (err) {
    console.error('POST /matches/:id/events error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/admin/matches/:id/events/:eventId
router.delete('/matches/:id/events/:eventId', authenticateToken, async (req, res) => {
  try {
    const { id, eventId } = req.params;
    const leagueId = await getLeagueId();

    // Verify match belongs to league
    const matchCheck = await query(
      'SELECT id FROM matches WHERE id = $1 AND league_id = $2',
      [id, leagueId]
    );

    if (matchCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Match not found' });
    }

    const result = await query(
      'DELETE FROM player_events WHERE id = $1 AND match_id = $2 RETURNING id',
      [eventId, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Event not found' });
    }

    res.json({ message: 'Event deleted successfully' });
  } catch (err) {
    console.error('DELETE /matches/:id/events/:eventId error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/admin/dashboard — stats
router.get('/dashboard', authenticateToken, async (req, res) => {
  try {
    const leagueId = await getLeagueId();

    const [teamsRes, playersRes, matchesRes] = await Promise.all([
      query('SELECT COUNT(*) AS count FROM teams WHERE league_id = $1', [leagueId]),
      query('SELECT COUNT(*) AS count FROM players WHERE league_id = $1 AND active = true', [leagueId]),
      query(
        `SELECT
           COUNT(*) FILTER (WHERE status = 'finished') AS played,
           COUNT(*) FILTER (WHERE status = 'scheduled') AS pending,
           COUNT(*) FILTER (WHERE status = 'cancelled') AS cancelled
         FROM matches WHERE league_id = $1`,
        [leagueId]
      ),
    ]);

    res.json({
      teams: parseInt(teamsRes.rows[0].count),
      players: parseInt(playersRes.rows[0].count),
      matches_played: parseInt(matchesRes.rows[0].played),
      matches_pending: parseInt(matchesRes.rows[0].pending),
      matches_cancelled: parseInt(matchesRes.rows[0].cancelled),
    });
  } catch (err) {
    console.error('GET /dashboard error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
