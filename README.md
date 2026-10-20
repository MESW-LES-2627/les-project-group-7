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
- **[Task Distribution & Outcomes](docs/user-stories.md):** Tracer bullet task breakdown across the 4 dev roles.

---

## Technology Stack

| Layer | Technology | Purpose |
|---|---|---|
| **Framework & App** | Next.js 15 (App Router) + React 19 + TypeScript | Full-stack architecture, SSR & Client components |
| **Styling** | Tailwind CSS + Lucide Icons | Responsive modern UI |
| **ORM & Database** | Prisma ORM + PostgreSQL 16 (Docker) | Relational persistence, migrations, and type-safe queries |
| **Testing** | Vitest | Fast unit testing for domain algorithms (`/tdd`) |
| **Mapping** | Leaflet (`react-leaflet`) + OpenStreetMap tiles | Interactive city map with markers, popups, and rating trigger |

---

## Project Structure

```
.
├── docker-compose.yml      # Local PostgreSQL container definition
├── docs/                   # Vision, MVP, EventStorming, UML diagrams, GLOSSARY.md
│   ├── adr/                # Architecture Decision Records
│   ├── design/             # UML diagrams and EventStorming artifacts
│   ├── GLOSSARY.md         # Ubiquitous Language definition
│   └── user-stories.md     # Task breakdown for tracer bullet prototype
├── prisma/
│   ├── schema.prisma       # Relational PostgreSQL database schema
│   ├── seed.ts             # Pilot data seed script (Porto OSM & demo users)
│   └── migrations/         # Prisma migration history
└── src/
    ├── app/                # Next.js App Router (pages and API routes)
    │   ├── api/places/     # GET /api/places
    │   ├── api/reviews/    # GET & POST /api/reviews
    │   ├── api/health/     # GET /api/health
    │   └── page.tsx        # Main tracer bullet UI
    ├── components/         # MapComponent, MapWrapper, PlaceExplorer
    ├── domain/             # Pure domain logic & tests (rating, geo, itinerary)
    └── lib/                # Prisma client singleton
```

---

## Quickstart Guide

### Prerequisites
- [Node.js](https://nodejs.org/) (v20.x or higher)
- [Docker & Docker Compose](https://www.docker.com/)

### 1. Setup Database & Dependencies
```bash
# Clone the repository and install dependencies
npm install

# Copy environment variables
cp .env.example .env

# Start local PostgreSQL container
docker compose up -d

# Apply database migrations and seed data (Porto OSM spots + demo users)
npm run prisma:generate
npm run prisma:migrate
npm run seed
```

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

---

## Key Features in Tracer Bullet

- **Interactive Rating System:** Submit 1–5 star ratings and comments for any spot with instant UI updates.
- **Dummy User Session:** Active switchable demo accounts (`@viajante_porto` and `@ana_exploradora`) persisting reviews and visit markers to PostgreSQL.
- **Dynamic Rating Recalculation:** Real-time arithmetic mean rating updates and visit tracking in PostgreSQL.
- **OpenStreetMap Local POIs:** Interactive Leaflet map with real Porto landmarks imported from OpenStreetMap and cached locally.
- **Local POI Search & Filter:** Instant text search and category filtering over the local PostgreSQL points of interest.
