-- ============================================================
-- BØDEKASSE — Supabase migration
-- Kør dette i Supabase → SQL Editor → New query
-- ============================================================

-- Bødemester-PIN per hold (adskilt fra kaptajn-PIN, deles af 2-3 bødemestre)
alter table clubs add column if not exists fine_master_pin text;

-- Sikrer at Master kan gemme bødemester-PIN fra Admin → Hold
-- (idempotent — dropper først hvis en tidligere version af policyen findes)
drop policy if exists "Alle kan opdatere hold" on clubs;
create policy "Alle kan opdatere hold" on clubs for update using (true);

-- Bødekategorier — fast katalog, styres af Master i appen (Admin → Bøder)
create table if not exists fine_categories (
  id uuid primary key default gen_random_uuid(),
  label text not null,
  amount numeric(10,2) not null default 0,
  active bool not null default true,
  sort_order int not null default 0,
  created_at timestamptz default now()
);

-- Bøder — selve bødekassens ledger
create table if not exists fines (
  id uuid primary key default gen_random_uuid(),
  player_id uuid references players(id) on delete cascade,
  club_id uuid references clubs(id) on delete set null,
  category_id uuid references fine_categories(id) on delete set null,
  custom_label text, -- bruges når bøden er fritekst (category_id er null)
  amount numeric(10,2) not null,
  note text,
  paid bool not null default false,
  paid_at timestamptz,
  created_at timestamptz default now()
);

alter table fine_categories enable row level security;
alter table fines enable row level security;

create policy "Alle kan læse bødekategorier" on fine_categories for select using (true);
create policy "Alle kan indsætte bødekategorier" on fine_categories for insert with check (true);
create policy "Alle kan opdatere bødekategorier" on fine_categories for update using (true);

create policy "Alle kan læse bøder" on fines for select using (true);
create policy "Alle kan indsætte bøder" on fines for insert with check (true);
create policy "Alle kan opdatere bøder" on fines for update using (true);

-- Eksempelkategorier — rediger/slet/tilføj frit via Admin → Bøder
insert into fine_categories (label, amount, sort_order) values
  ('Sent til kamp/træning', 20, 1),
  ('Glemt bold/udstyr', 10, 2),
  ('Udeblivelse uden afbud', 50, 3);
