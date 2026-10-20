# Place Reviews & Trip Planning

> Group 7 · MESW LES / DOO 2026-27 · FEUP

A web application that combines place reviews and community rankings (TripAdvisor / Letterboxd style) with automated, day-by-day trip itinerary planning. Users choose a city, dates, and budget, and receive a customized itinerary generated from top-rated places, which can then be freely adjusted.

---

## Documentation & Architecture

All Iteration 0 design deliverables and domain specifications are stored in this repository:

- **[Vision](docs/vision.md):** The long-term product vision and feature roadmap.
- **[MVP Specification](docs/mvp.md):** Target scope committed for release by 18 Dec 2026.
- **[Design & Architecture](docs/design.md):** Overview of EventStorming, Domain Model, and Component Diagram.
- **[Domain Glossary (Ubiquitous Language)](GLOSSARY.md):** Canonical definitions of `Place`, `Review`, `Visit`, `Wishlist`, `Bookmark`, `Trip`, `Itinerary`, and budget calculations.
- **[Architecture Decision Records (ADRs)](docs/adr/):**
  - [ADR 0001: Core Domain Rules, Trip Cardinality, and Cascade Lifecycles](docs/adr/0001-core-domain-rules-and-aggregates.md)

---

## Technology Stack

| Layer | Technology | Purpose |
|---|---|---|
| **Backend** | Node.js (v20+) + Express + TypeScript | Modular REST API and business logic |
| **ORM & Database** | Prisma ORM with SQLite (dev) / PostgreSQL (prod) | Type-safe persistence and automatic schema migrations |
| **Testing** | Vitest | High-speed unit testing for domain algorithms (`/tdd`) |
| **Frontend** | React 19 + Vite + TypeScript | Responsive, modern Single Page Application |
| **Mapping** | Leaflet (`react-leaflet`) + OpenStreetMap tiles | Interactive city map with pins and clustering |

---

## Project Structure

```
.
├── GLOSSARY.md             # Ubiquitous Language definition
├── README.md               # This documentation
├── docs/                   # Vision, MVP, EventStorming, UML, ADRs
│   ├── adr/                # Architecture Decision Records
│   └── design/             # UML diagrams and EventStorming artifacts
├── backend/                # Express & Prisma backend service
│   ├── prisma/
│   │   ├── schema.prisma   # Declarative database schema
│   │   └── seed.ts         # Initial pilot data seed script
│   └── src/
│       ├── db.ts           # Prisma client singleton
│       ├── domain/         # Pure domain logic (rating, geo, opening-hours)
│       └── server.ts       # Express bootstrap & API endpoints
└── frontend/               # React + Vite frontend application
    └── src/
        ├── App.tsx         # Main application shell
        └── main.tsx        # React entrypoint
```

---

## Quickstart Guide

### Prerequisites
- [Node.js](https://nodejs.org/) (v20.x or higher)
- [npm](https://www.npmjs.com/) (v10.x or higher)

### 1. Setup & Installation
Clone the repository and install dependencies for both packages:

```bash
# Backend setup
cd backend
npm install
cp .env.example .env

# Generate Prisma client and initialize database
npx prisma migrate dev --name init
npm run seed

# Frontend setup
cd ../frontend
npm install
```

### 2. Running Tests
Run unit tests for domain services (pure functions):

```bash
# From project root:
npm test

# Or directly in backend:
cd backend && npm test
```

### 3. Running Development Servers
Start both backend and frontend concurrently:

```bash
# From project root:
npm run dev:backend    # Runs Express API at http://localhost:3001
npm run dev:frontend   # Runs React App at http://localhost:3000
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## Iteration 0 Team Task Distribution

| Module / Area | Focus & Responsibilities | Key Files |
|---|---|---|
| **Domain Services (`/tdd`)** | Pure calculation functions: rating averages, price level mode, geo-distance, walking time, opening-hours checks | `backend/src/domain/` |
| **Catalog & Seed Data** | OSM place importer, seed script for Porto & Lisbon pilot data, demo reviews | `backend/prisma/` |
| **API & Identity** | Authentication (`/api/auth`), Place search & filter (`/api/places`), Reviews (`/api/reviews`) | `backend/src/routes/` |
| **Frontend & Map UI** | React navigation shell, Leaflet map with OSM pins, Place Detail view, Wishlist screen | `frontend/src/` |
