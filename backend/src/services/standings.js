import { query, getLeagueId } from '../db.js';

/**
 * Calculate standings for the league.
 * For each team: PJ, PG, PE, PP, GF, GC, DIF, PTS
 * Win = settings.points_win (default 3)
 * Draw = settings.points_draw (default 1)
 * Loss = settings.points_loss (default 0)
 * Order: PTS desc, DIF desc, GF desc, name asc
 */
export async function calculateStandings(leagueId) {
  // Get league settings
  const leagueRes = await query(
    'SELECT settings FROM leagues WHERE id = $1',
    [leagueId]
  );

  if (leagueRes.rows.length === 0) {
    throw new Error('League not found');
  }

  const settings = leagueRes.rows[0].settings || {
    points_win: 3,
    points_draw: 1,
    points_loss: 0,
  };

  const pointsWin = settings.points_win ?? 3;
  const pointsDraw = settings.points_draw ?? 1;
  const pointsLoss = settings.points_loss ?? 0;

  // Get all teams in the league
  const teamsRes = await query(
    `SELECT id, name, short_name, shield_url
     FROM teams
     WHERE league_id = $1
     ORDER BY name ASC`,
    [leagueId]
  );

  const teams = teamsRes.rows;

  // Get all finished matches
  const matchesRes = await query(
    `SELECT id, home_team_id, away_team_id, home_score, away_score
     FROM matches
     WHERE league_id = $1
       AND status = 'finished'
       AND home_score IS NOT NULL
       AND away_score IS NOT NULL`,
    [leagueId]
  );

  const matches = matchesRes.rows;

  // Build standings map
  const standingsMap = {};

  for (const team of teams) {
    standingsMap[team.id] = {
      team_id: team.id,
      name: team.name,
      short_name: team.short_name,
      shield_url: team.shield_url,
      pj: 0, // played
      pg: 0, // wins
      pe: 0, // draws
      pp: 0, // losses
      gf: 0, // goals for
      gc: 0, // goals against
      dif: 0, // goal difference
      pts: 0, // points
    };
  }

  // Process each match
  for (const match of matches) {
    const home = standingsMap[match.home_team_id];
    const away = standingsMap[match.away_team_id];

    if (!home || !away) continue;

    const homeScore = parseInt(match.home_score, 10);
    const awayScore = parseInt(match.away_score, 10);

    // Update played
    home.pj += 1;
    away.pj += 1;

    // Update goals
    home.gf += homeScore;
    home.gc += awayScore;
    away.gf += awayScore;
    away.gc += homeScore;

    // Determine result
    if (homeScore > awayScore) {
      // Home wins
      home.pg += 1;
      home.pts += pointsWin;
      away.pp += 1;
      away.pts += pointsLoss;
    } else if (awayScore > homeScore) {
      // Away wins
      away.pg += 1;
      away.pts += pointsWin;
      home.pp += 1;
      home.pts += pointsLoss;
    } else {
      // Draw
      home.pe += 1;
      home.pts += pointsDraw;
      away.pe += 1;
      away.pts += pointsDraw;
    }
  }

  // Calculate goal difference
  for (const teamId in standingsMap) {
    const team = standingsMap[teamId];
    team.dif = team.gf - team.gc;
  }

  // Sort: PTS desc, DIF desc, GF desc, name asc
  const standings = Object.values(standingsMap).sort((a, b) => {
    if (b.pts !== a.pts) return b.pts - a.pts;
    if (b.dif !== a.dif) return b.dif - a.dif;
    if (b.gf !== a.gf) return b.gf - a.gf;
    return a.name.localeCompare(b.name);
  });

  // Add position
  return standings.map((team, index) => ({
    pos: index + 1,
    ...team,
  }));
}
