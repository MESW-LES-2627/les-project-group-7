# Place Reviews & Trip Planning

> Group 7 · MESW LES / DOO 2026-27 · FEUP

A web application that combines place reviews and community rankings (TripAdvisor / Letterboxd style) with automated, day-by-day trip itinerary planning. Users choose a city, dates, and budget, and receive a customized itinerary generated from top-rated places, which can then be freely adjusted.

---

## Documentation & Architecture

All Iteration 0 design deliverables and domain specifications are stored in this repository:

- **[Vision](docs/vision.md):** The long-term product vision and feature roadmap.
- **[MVP Specification](docs/mvp.md):** Target scope committed for release by 18 Dec 2026.
- **[User stories](docs/user-stories.md):** One user story per MVP and Stretch feature, with acceptance criteria and the issues each is split into.
- **[Design & Architecture](docs/design.md):** Overview of EventStorming, Domain Model, and Component Diagram.
- **[Domain Glossary & Rules (Ubiquitous Language)](docs/GLOSSARY.md):** Canonical definitions of `Place`, `Review`, `Visit`, `Wishlist`, `Bookmark`, `Trip`, `Itinerary`, cost points, and budget calculations.
- **[Deployment](docs/deployment.md):** How the app reaches the two sites (Vercel and Neon), the backup steps before a release and the known problems.

---

## Live Sites

| Environment | Branch | Address                                                 |
| ----------- | ------ | ------------------------------------------------------- |
| Dev         | `dev`  | [les-group7-dev.vercel.app](https://les-group7-dev.vercel.app) |
| Prod        | `main` | [les-group7.vercel.app](https://les-group7.vercel.app)         |

Every push to `dev` or `main` deploys through GitHub Actions (see [deployment](docs/deployment.md)). Prod is merged from `dev` the day before each review.

---

## Technology Stack

| Layer               | Technology                                      | Purpose                                                       |
| ------------------- | ----------------------------------------------- | ------------------------------------------------------------- |
| **Framework & App** | Next.js 15 (App Router) + React 19 + TypeScript | Full-stack architecture, SSR & Client components              |
| **Styling & UI**    | Tailwind CSS + Shadcn UI + Lucide Icons         | Accessible, responsive component design system                |
| **ORM & Database**  | Prisma ORM + PostgreSQL 18 (Docker locally, Neon in the cloud) | Relational persistence, migrations, and type-safe queries |
| **Authentication**  | Better Auth (e-mail and password, username, database sessions) | Accounts, login, sessions and login rate limiting (ADR-009) |
| **Testing**         | Vitest                                          | Fast unit testing for domain algorithms (`/tdd`)              |
| **Mapping**         | Leaflet (`react-leaflet`) + OpenStreetMap tiles | Interactive city map with markers, popups, and rating trigger |

---

## Project Structure

```
.
├── .github/workflows/      # deploy.yml: GitHub Action that deploys dev and main
├── docker-compose.yml      # Local PostgreSQL container definition
├── docs/                   # Vision, MVP, design (with the ADRs), glossary, deployment
│   └── design/             # UML diagrams and EventStorming artifacts
├── prisma/
│   ├── schema.prisma       # Relational PostgreSQL database schema
│   ├── seed.ts             # Seed: the cities, their places, demo users and sample reviews
│   ├── data/               # JSON data used by the seed
│   └── migrations/         # Prisma migration history (never edit an applied migration)
├── scripts/
│   ├── import-osm.ts       # Imports the places of one MVP city (Porto, Paris, Berlin) from OpenStreetMap
│   └── validate-docs.ts    # Checks the links and anchors in docs/ (npm run lint:docs)
└── src/
    ├── app/                # Next.js App Router (pages and API routes)
    │   ├── api/places/     # GET /api/places
    │   ├── api/reviews/    # GET & POST /api/reviews
    │   ├── api/register/   # POST /api/register (creates the account and logs the person in)
    │   ├── api/auth/       # Better Auth routes: sign in, sign out, get-session (ADR-009)
    │   ├── api/osm/        # GET /api/osm (live discovery) and /api/osm/search (Nominatim search)
    │   ├── api/health/     # GET /api/health
    │   ├── places/[id]/    # Place page (details and reviews)
    │   ├── register/       # Registration page
    │   ├── login/          # Login page
    │   ├── layout.tsx      # Page shell: top bar (SiteHeader) and theme
    │   └── page.tsx        # Main tracer bullet UI
    ├── components/         # Map and place explorer (PlaceExplorer, ReviewModal, ...), SiteHeader, LogoutButton, ThemeToggle, ui/ (Shadcn)
    ├── domain/             # Pure domain logic & tests (rating, geo, itinerary, osm, catalog, identity)
    ├── hooks/              # React hooks (place filtering, place reviews)
    ├── lib/                # Prisma client singleton, Better Auth setup (auth.ts), the write-endpoint guard (guard.ts), registration rate limit & cn utility
    └── types/              # Shared TypeScript types
```

---

## Quickstart Guide

### Prerequisites

- [Node.js](https://nodejs.org/) (v22.x or higher; the deploy workflow uses 22)
- [Docker & Docker Compose](https://www.docker.com/)

### 1. Setup Database & Dependencies

```bash
# Clone the repository and install dependencies
npm install

# Copy environment variables, then set BETTER_AUTH_SECRET in .env (for example with `openssl rand -base64 32`)
cp .env.example .env

# Start local PostgreSQL container
docker compose up -d

# Apply database migrations and seed data (the cities, their places, demo users and sample reviews)
npm run prisma:generate
npm run prisma:migrate
npm run seed
```

`npm run import:osm -- <city>` (`porto`, `paris` or `berlin`) additionally imports the places of one city from OpenStreetMap (optional). It saves them in the database and in `prisma/data/<city>-places.json`; `--dry-run` only shows what it would save, and `--landmarks-only` searches only the famous places of the city by name and adds them to the existing file, and `--grid` searches every tile of the city for each kind of place and adds the results to it, because a search by kind returns only 50 places, mostly central ones. Nothing is saved unless OpenStreetMap answered every request (a failed request is tried again 3 times first).

**Demo places and reviews.** The seed loads the places of the three cities from the snapshots in `prisma/data` (Porto 940, Paris 967, Berlin 989, all real OpenStreetMap places, spread over the whole of each city (Porto: the zone from Perafita in the north to Vilar do Paraíso in the south), with its football stadiums, train stations and airports that lie inside the city area) and writes sample reviews on 100 places of each city, about 10% of them, from 1 to 25 reviews per place, in `prisma/data/reviews-<city>.json` (Porto in Portuguese, Paris and Berlin in English). The places that have many reviews, a few, or only one let you see the rating score at work. The stored rating, review count and price level of each place are recalculated from its reviews at the end of the seed, with the same functions that the app uses.

**Demo users.** The seed creates 30 users that can log in like any other (`viajante_porto`, `ana_exploradora`, `rui_gastronomo` and so on; the list is in `prisma/data/demo-users.json`), all with the password `tripbook-demo`. Each sample review of a place is written by a different one of them, because nobody reviews a place twice. To use another password, run the seed with `DEMO_PASSWORD` set (8 to 128 characters), for example `DEMO_PASSWORD=another-password npm run seed`. The seed can be run again at any time: it does not duplicate anything, it puts the demo password back and it replaces only the sample reviews that it wrote itself (same place, demo user and text), so every other review is kept, also one written while logged in as a demo user.

### 2. Running Tests

Run unit tests for domain services (pure functions):

```bash
npm test
```

### 3. Running the Application

Start the development server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### 4. Other scripts

| Script                                  | What it does                                                    |
| --------------------------------------- | --------------------------------------------------------------- |
| `npm run build` / `npm start`           | Production build (runs `prisma generate` first) and server      |
| `npm run test:watch` / `test:report`    | Vitest in watch mode / verbose report                           |
| `npm run prisma:studio`                 | Opens Prisma Studio to browse the database                      |
| `npm run import:osm -- <city>`          | Imports the places of porto, paris or berlin from OpenStreetMap (`--landmarks-only`, `--grid`, `--dry-run`) |
| `npm run format` / `format:check`       | Prettier on `src/` (write / check only)                         |
| `npm run lint:docs` / `format:docs`     | Checks the links and anchors in `docs/` / formats `docs/*.md`   |
| `npm run knip`                          | Finds unused files, exports and dependencies                    |
| `npm run analyze`                       | Production build with the bundle analyzer                       |
| `npm run ui:detect`                     | Runs the `impeccable` UI checks on `src/`                       |

---

## Known issues

- E-mail addresses are only checked for their format and are never verified, and there is no password reset. Both are out of scope for the MVP (US-A1-01). A mistyped e-mail or a forgotten password cannot be recovered.
- The site sends no HTTP security headers yet (for example a Content-Security-Policy or protection against being embedded in another page).
- `npm audit` reports vulnerable packages in `next`, `prisma` and their dependencies that are not fixed yet.

---

## Key Features in Tracer Bullet

- **Interactive Rating System:** Submit a 1–5 star rating, a price level and a text for any spot, with instant UI updates. The form has no preselected rating or price level, and all three are required.
- **Accounts:** Registration (`/register`, `POST /api/register`), login by username or e-mail (`/login`) and logout, with Better Auth behind them. The top bar shows the logged-in username. The review form shows the logged-in username and asks logged-out visitors to log in. Posting a review needs a logged-in user, and the author is always the user of the session (the reviews endpoint ignores any `userId` sent by the client).
- **Dark mode:** The site opens in dark mode. The sun/moon button in the top bar switches the theme, and the choice is remembered in the browser. It has no user story of its own.
- **Rating Recalculation:** Posting a review recalculates the place's average rating and review count in PostgreSQL and records a visit for the author. The review form asks for a price level, and the place's price level is recalculated from its reviews (a free place needs 2 paid reviews to change). Not built yet: showing visited places after a page reload, and editing or deleting a review.
- **OpenStreetMap Places:** Interactive Leaflet map with places loaded into PostgreSQL by the seed and import scripts, plus places discovered live from OpenStreetMap, which are saved when first reviewed (built in the tracer bullet, outside the committed MVP).
- **Search & Filter:** A city search (ignoring case and accents) and a place search over the local PostgreSQL data, with filters for type, price level and minimum rating that combine, and a list sorted by rating score. Choosing a city or a searched place moves the map to it.
- **Place page:** `/places/[id]` shows a place's details, rating, price level and reviews, newest first, and lets a logged-in user write a review. The opening hours are not shown yet.
