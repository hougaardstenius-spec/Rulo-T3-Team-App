# 🏓 Padelhold App

PWA-app til padelhold med spillerkort, afstemning, rangliste og kampprogram.

---

## Opsætning — trin for trin

### 1. Opret Supabase-projekt (5 min)

1. Gå til [supabase.com](https://supabase.com) og opret en **gratis konto**
2. Klik **New project** — vælg et navn (fx "padel-hold")
3. Gå til **SQL Editor → New query**
4. Kopiér hele indholdet af `supabase-schema.sql` og kør det (▶ Run)
5. Gå til **Settings → API** og kopiér:
   - **Project URL** (ligner `https://abcdefg.supabase.co`)
   - **anon / public** nøglen

---

### 2. Opret GitHub-repository (2 min)

1. Gå til [github.com/new](https://github.com/new)
2. Navngiv det fx `padel-hold` — sæt til **Public**
3. Klik **Create repository**
4. Upload alle filer fra denne mappe:
   ```
   git init
   git add .
   git commit -m "Første version"
   git branch -M main
   git remote add origin https://github.com/DIT-NAVN/padel-hold.git
   git push -u origin main
   ```

---

### 3. Tilføj Supabase-nøgler til GitHub (2 min)

1. I dit GitHub-repo: **Settings → Secrets and variables → Actions**
2. Klik **New repository secret** to gange:
   - Navn: `REACT_APP_SUPABASE_URL` — Værdi: din Project URL
   - Navn: `REACT_APP_SUPABASE_ANON_KEY` — Værdi: din anon-nøgle

---

### 4. Aktiver GitHub Pages (1 min)

1. I dit repo: **Settings → Pages**
2. Under **Source**: vælg **GitHub Actions**
3. Klik **Save**

GitHub deployer nu automatisk — vent 2 min, så er appen live på:
`https://DIT-NAVN.github.io/padel-hold`

---

### 5. Del linket med holdet

Spillerne åbner linket i Safari (iOS) eller Chrome (Android) og trykker:
- **iOS**: Del-knappen → "Føj til hjemmeskærm"
- **Android**: Menu → "Installer app" eller "Føj til startskærm"

Appen opfører sig herefter som en rigtig app.

---

## Fremtidige opdateringer

Når du vil ændre noget i appen, redigér koden og kør:
```
git add .
git commit -m "Beskrivelse af ændring"
git push
```
GitHub Pages deployer automatisk inden for 2 minutter.

---

## Tilføj spillere

Brug Supabase **Table Editor** → `players` til at tilføje/redigere spillere.
Alternativt kan vi bygge en admin-side i appen.

## Point-system (rangliste)

Point tildeles via Supabase **Table Editor** → `ranking` efter hver kamp.
Standardforslag: 3 point for sejr, 1 for uafgjort, 0 for tab.
Vi kan automatisere dette når i er klar.
