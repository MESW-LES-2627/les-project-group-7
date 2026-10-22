# Place Reviews & Trip Planning

> Group 7 · MESW LES / DOO 2026-27 · FEUP

A web application that combines place reviews and community rankings (TripAdvisor / Letterboxd style) with automated, day-by-day trip itinerary planning. Users choose a city, dates, and budget, and receive a customized itinerary generated from top-rated places, which can then be freely adjusted.

---

## Documentation & Architecture

All Iteration 0 design deliverables and domain specifications are stored in this repository:

- **[Vision](docs/vision.md):** The long-term product vision and feature roadmap.
- **[MVP Specification](docs/mvp.md):** Target scope committed for release by 18 Dec 2026.
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
| **ORM & Database**  | Prisma ORM + PostgreSQL (16 in Docker, Neon in the cloud) | Relational persistence, migrations, and type-safe queries |
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
│   ├── seed.ts             # Seed: the 7 MVP cities, their places, demo users and sample reviews
│   ├── data/               # JSON data used by the seed
│   └── migrations/         # Prisma migration history (never edit an applied migration)
├── scripts/
│   ├── import-osm.ts       # Imports Porto places from OpenStreetMap
│   └── validate-docs.ts    # Checks the links and anchors in docs/ (npm run lint:docs)
└── src/
    ├── app/                # Next.js App Router (pages and API routes)
    │   ├── api/places/     # GET /api/places
    │   ├── api/reviews/    # GET & POST /api/reviews
    │   ├── api/osm/        # GET /api/osm (live discovery) and /api/osm/search (Nominatim search)
    │   ├── api/health/     # GET /api/health
    │   └── page.tsx        # Main tracer bullet UI
    ├── components/         # MapComponent, MapWrapper, PlaceExplorer, ui/ (Shadcn)
    ├── domain/             # Pure domain logic & tests (rating, geo, itinerary, osm, catalog)
    ├── hooks/              # React hooks (place filtering, place reviews)
    ├── lib/                # Prisma client singleton & cn utility (clsx + twMerge)
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

# Copy environment variables
cp .env.example .env

# Start local PostgreSQL container
docker compose up -d

# Apply database migrations and seed data (7 cities, their places, demo users and sample reviews)
npm run prisma:generate
npm run prisma:migrate
npm run seed
```

`npm run import:osm` additionally imports Porto places from OpenStreetMap (optional).

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
| `npm run import:osm`                    | Imports Porto places from OpenStreetMap                         |
| `npm run format` / `format:check`       | Prettier on `src/` (write / check only)                         |
| `npm run lint:docs` / `format:docs`     | Checks the links and anchors in `docs/` / formats `docs/*.md`   |
| `npm run knip`                          | Finds unused files, exports and dependencies                    |
| `npm run analyze`                       | Production build with the bundle analyzer                       |
| `npm run ui:detect`                     | Runs the `impeccable` UI checks on `src/`                       |

---

## Key Features in Tracer Bullet

- **Interactive Rating System:** Submit 1–5 star ratings and comments for any spot with instant UI updates.
- **Dummy User Session:** Active switchable demo accounts (`@viajante_porto` and `@ana_exploradora`) persisting reviews and visit markers to PostgreSQL. Real registration, login and per-user permissions are not implemented yet (planned for Iteration 1).
- **Dynamic Rating Recalculation:** Real-time arithmetic mean rating updates and visit tracking in PostgreSQL.
- **OpenStreetMap Places:** Interactive Leaflet map with places loaded into PostgreSQL by the seed and import scripts, plus places discovered live from OpenStreetMap, which are saved when first reviewed.
- **Local POI Search & Filter:** Instant text search and category filtering over the local PostgreSQL points of interest.
