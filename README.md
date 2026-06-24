# Liga Deportiva — Sports League Management Platform

A complete web platform for managing amateur sports leagues (handball and more).

## Features

- **Public site**: standings table, scorer rankings, fixture, results, player profiles and search
- **Admin panel**: manage teams, players, matches, results, and goal events
- Mobile-first responsive design with bottom tab bar on mobile
- JWT authentication for admin
- Image upload to Supabase Storage

## Tech Stack

- **Frontend**: React + Vite + TailwindCSS + React Router
- **Backend**: Node.js + Express + node-postgres (pg)
- **Database**: PostgreSQL (Supabase)
- **Storage**: Supabase Storage
- **Auth**: JWT (jsonwebtoken + bcryptjs)
- **Deploy**: Vercel (frontend) + Railway (backend)

## Project Structure

```
Liga/
├── backend/          # Node.js Express API
├── frontend/         # React + Vite app
└── database/
    └── migrations/   # SQL schema files
```

## Quick Start

### 1. Database setup

Run `database/migrations/001_initial.sql` in your Supabase SQL editor.

Create a Supabase Storage bucket named `images` (set to public).

Then create your league and admin user. You can use the commented-out seed in the migration, or run manually:

```sql
-- 1. Get the handball sport ID
SELECT id FROM sports WHERE name = 'handball';

-- 2. Create your league
INSERT INTO leagues (sport_id, name, slug, season)
VALUES ('<sport-id>', 'Mi Liga de Handball', 'mi-liga', '2024');

-- 3. Create admin user (use bcrypt to hash your password)
-- Password hash below is for 'admin123' — CHANGE IT
INSERT INTO admin_users (league_id, email, password_hash, name)
VALUES ('<league-id>', 'admin@miliga.com', '$2a$10$...', 'Administrador');
```

To generate a bcrypt hash for your password:
```bash
node -e "const b=require('bcryptjs'); b.hash('yourpassword', 10).then(h=>console.log(h))"
```

### 2. Backend setup

```bash
cd backend
npm install
cp .env.example .env
# Edit .env with your values
npm run dev
```

Backend env vars:
```env
DATABASE_URL=postgresql://user:password@host:5432/dbname
JWT_SECRET=your-super-secret-key
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_KEY=your-service-role-key
PORT=3001
FRONTEND_URL=http://localhost:5173
LEAGUE_ID=          # optional, auto-detected from DB
```

### 3. Frontend setup

```bash
cd frontend
npm install
cp .env.example .env
# Edit .env if needed
npm run dev
```

Frontend env vars:
```env
VITE_API_URL=http://localhost:3001/api
```

The frontend dev server proxies `/api` to `localhost:3001` automatically.

## API Reference

### Public endpoints (no auth)

| Method | Path | Description |
|--------|------|-------------|
| GET | /api/public/league | League info |
| GET | /api/public/standings | Standings table |
| GET | /api/public/scorers | Goal scorer ranking |
| GET | /api/public/fixtures | Upcoming matches |
| GET | /api/public/results | Last 10 results |
| GET | /api/public/players/search?q= | Search players |
| GET | /api/public/players/:id | Player profile |

### Admin endpoints (Bearer JWT required)

| Method | Path | Description |
|--------|------|-------------|
| POST | /api/admin/auth/login | Get JWT token |
| GET | /api/admin/me | Current user |
| GET | /api/admin/dashboard | Summary stats |
| CRUD | /api/admin/teams | Teams management |
| CRUD | /api/admin/players | Players management |
| CRUD | /api/admin/matches | Matches management |
| POST | /api/admin/matches/:id/result | Set match score |
| CRUD | /api/admin/matches/:id/events | Goal events |
| POST | /api/admin/upload | Upload image |

## Deployment

### Backend (Railway)

Set all environment variables in Railway dashboard. The `start` script runs `node src/index.js`.

### Frontend (Vercel)

Set `VITE_API_URL` to your Railway backend URL. Add a `vercel.json` for SPA routing:

```json
{
  "rewrites": [{ "source": "/(.*)", "destination": "/" }]
}
```

## Standings Calculation

Points: Win=3, Draw=1, Loss=0 (configurable per league via `settings` JSONB).

Sort order: PTS desc → Goal difference desc → Goals for desc → Name asc.
