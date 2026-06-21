-- ============================================================
-- PADEL APP — Supabase database schema
-- Kør dette i Supabase → SQL Editor → New query
-- ============================================================

-- Spillere
create table players (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  initials text not null,
  color text not null default '#1a7a4a',
  position text not null default 'HØ',
  created_at timestamptz default now()
);

-- Skill ratings (én række per spiller, opdateres løbende)
create table player_stats (
  id uuid primary key default gen_random_uuid(),
  player_id uuid references players(id) on delete cascade,
  -- Grundslag
  forhånd int default 50,
  baghånd int default 50,
  -- Overheads
  bandeja int default 50,
  vibora int default 50,
  rulo int default 50,
  gancho int default 50,
  smash int default 50,
  -- Volleys
  volley_forhånd int default 50,
  volley_baghånd int default 50,
  plano int default 50,
  -- Omstillingsslag
  chiquita int default 50,
  lob int default 50,
  -- Øvrige
  glasspil int default 50,
  spilforstaelse int default 50,
  bevaegelse int default 50,
  kommunikation int default 50,
  updated_at timestamptz default now(),
  unique(player_id)
);

-- Kampe
create table matches (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  match_date date not null,
  location text,
  match_type text not null check (match_type in ('training', 'official')),
  score_us text,
  score_them text,
  opponent text,
  voting_open bool default false,
  created_at timestamptz default now()
);

-- Afstemninger (én per spiller per kamp)
create table votes (
  id uuid primary key default gen_random_uuid(),
  match_id uuid references matches(id) on delete cascade,
  voter_id uuid references players(id) on delete cascade,
  spiller_id uuid references players(id),
  flop_id uuid references players(id),
  detalje_id uuid references players(id),
  bommert_id uuid references players(id),
  created_at timestamptz default now(),
  unique(match_id, voter_id)
);

-- Ranglistepunkter (opdateres efter hver kamp)
create table ranking (
  id uuid primary key default gen_random_uuid(),
  player_id uuid references players(id) on delete cascade,
  season text not null default '2026',
  points int default 0,
  wins int default 0,
  losses int default 0,
  updated_at timestamptz default now(),
  unique(player_id, season)
);

-- Hæder / awards (tildeles automatisk fra afstemning)
create table awards (
  id uuid primary key default gen_random_uuid(),
  match_id uuid references matches(id) on delete cascade,
  player_id uuid references players(id) on delete cascade,
  award_type text not null check (award_type in ('spiller', 'flop', 'detalje', 'bommert')),
  created_at timestamptz default now()
);

-- Row Level Security: alle kan læse, kun autentificerede kan skrive
alter table players enable row level security;
alter table player_stats enable row level security;
alter table matches enable row level security;
alter table votes enable row level security;
alter table ranking enable row level security;
alter table awards enable row level security;

create policy "Alle kan læse spillere" on players for select using (true);
create policy "Alle kan læse stats" on player_stats for select using (true);
create policy "Alle kan læse kampe" on matches for select using (true);
create policy "Alle kan læse stemmer" on votes for select using (true);
create policy "Alle kan læse rangliste" on ranking for select using (true);
create policy "Alle kan læse hæder" on awards for select using (true);

create policy "Alle kan indsætte stemmer" on votes for insert with check (true);
create policy "Alle kan opdatere stemmer" on votes for update using (true);

-- Admin-politikker (brug Supabase service key til admin-handlinger)
create policy "Alle kan indsætte spillere" on players for insert with check (true);
create policy "Alle kan opdatere spillere" on players for update using (true);
create policy "Alle kan indsætte stats" on player_stats for insert with check (true);
create policy "Alle kan opdatere stats" on player_stats for update using (true);
create policy "Alle kan indsætte kampe" on matches for insert with check (true);
create policy "Alle kan opdatere kampe" on matches for update using (true);
create policy "Alle kan indsætte rangliste" on ranking for insert with check (true);
create policy "Alle kan opdatere rangliste" on ranking for update using (true);
create policy "Alle kan indsætte hæder" on awards for insert with check (true);

-- Eksempeldata — slet hvis du vil starte fra bunden
insert into players (name, initials, color, position) values
  ('Marcus K.', 'MK', '#1a7a4a', 'HØ'),
  ('Søren L.', 'SL', '#185fa5', 'VN'),
  ('Thomas B.', 'TB', '#854f0b', 'HØ'),
  ('Jakob R.', 'JR', '#722439', 'VN'),
  ('Mikkel H.', 'MH', '#534ab7', 'HØ'),
  ('Peter A.', 'PA', '#0f6e56', 'VN'),
  ('Rasmus T.', 'RT', '#993c1d', 'HØ'),
  ('Anders M.', 'AM', '#5f5e5a', 'VN');
