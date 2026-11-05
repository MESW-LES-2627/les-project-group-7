# Design – Iteration 0

Group 7 · MESW LES / DOO 2026-27

This page is the entry point for the design deliverables of Iteration 0. Every
deliverable below is stored in this repository and linked from here.

| Deliverable                          | Status | Location                                                                     |
| ------------------------------------ | ------ | ---------------------------------------------------------------------------- |
| EventStorming model                  | Done   | [EventStorming](#1-eventstorming)                                            |
| UML domain model                     | Done   | [Domain model](#2-domain-model)                                              |
| UML component diagram                | Done   | [Component diagram](#3-component-diagram)                                    |
| Architecture Decision Records (ADRs) | Done   | [ADRs](#4-architecture-decision-records-adrs)                                |
| Domain glossary (ubiquitous language) | Done  | [GLOSSARY.md](GLOSSARY.md)                                                   |
| Deployment (Vercel and Neon)          | Done   | [ADR-007](#adr-007-deployment-on-vercel-and-neon) and [deployment.md](deployment.md) |

---

## 0. Product summary

A web app for reviewing and ranking places (Letterboxd / TripAdvisor style) with
built-in trip planning. The user gives a city and a number of days, and gets a
day-by-day itinerary, built manually or suggested automatically from rankings,
reviews, budget and place type.

---

## 1. EventStorming

- **Overview:** ![EventStorming overview](design/eventstorming.png)
- **Editable source:** [eventstorming.drft](design/eventstorming.drft) (draft.io)

The board follows the Process Modelling format from the DOO slides. Each cluster
reads left to right: actors, then commands, then the aggregate, then the events it
produces. Not every event has a command of its own (for example _Days added_ follows
_Create trip_). Policies are the only links between aggregates. The grey outlines
are subdomains. Dashed frames and grey "Post MVP" notes mark what is not in the MVP.

Legend: orange = event, blue = command, purple = policy, red = external system,
yellow (small) = actor, yellow (tall) = aggregate, pink = open issue, grey = note.

### Subdomains

| Subdomain         | Aggregates                                                      |
| ----------------- | --------------------------------------------------------------- |
| Trip planning     | Trip, Published itinerary (Stretch), Reminder (Stretch)         |
| Places and reviews | Place, Review, Place suggestion (Dream)                        |
| User space        | User, Saved places, List                                        |

### Aggregates

| Aggregate           | Commands                                                                                         | Events                                                                                                                                                                | Tier                                        |
| ------------------- | ------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------- |
| User                | Register user                                                                                    | User registered                                                                                                                                                       | MVP                                         |
| Trip                | Create trip, Change trip constraints, Generate itinerary, Edit itinerary (assign or remove a place, set a visit time), Delete trip | Trip created, Trip constraints changed, Days added, Days removed, Itinerary generated, Plan warning raised, Place assigned to day, Place removed from day, Visit time set, Trip deleted | MVP                                         |
| Place               | Import places, Mark place visited, Recalculate rating and price level, Add place to catalog      | Places imported, Place visited, Place rating and price level updated, Place added to catalog                                                                          | MVP (_Add place to catalog_ is Dream)       |
| Review              | Post review, Edit review, Delete review                                                          | Review posted, Review changed, Review deleted                                                                                                                         | MVP                                         |
| Saved places        | Wishlist place, Bookmark place, Remove saved place                                               | Place wishlisted, Place bookmarked, Place removed from wishlist, Place removed from bookmarks                                                                         | MVP                                         |
| List                | Add or remove place, Create list, Change list (rename or delete)                                 | Place added to list, Place removed from list, List created, List renamed, List deleted                                                                                | MVP                           |
| Published itinerary | Publish itinerary, Bookmark published itinerary, Remove itinerary bookmark                       | Itinerary published, Itinerary bookmarked, Itinerary bookmark removed                                                                                                 | Stretch                                     |
| Reminder            | Send a reminder                                                                                  | Visit reminder sent                                                                                                                                                   | Stretch                                     |
| Place suggestion    | Suggest place, Approve suggestion, Reject suggestion                                             | Place suggested, Suggestion approved, Suggestion rejected                                                                                                             | Dream                                       |

### Policies

| Policy                                                                                        | From aggregate   | To aggregate | Tier    |
| --------------------------------------------------------------------------------------------- | ---------------- | ------------ | ------- |
| Whenever a review is posted, mark the place as visited                                        | Review           | Place        | MVP     |
| Whenever a review is posted, changed or deleted, the rating and price level are recalculated  | Review           | Place        | MVP     |
| Whenever a place is removed from bookmarks, remove it from the user's lists                   | Saved places     | List         | MVP |
| When a visit time is near, send a reminder                                                    | Trip             | Reminder     | Stretch |
| Whenever a suggestion is approved, add the place to the catalog                               | Place suggestion | Place        | Dream   |

### External systems and actors

- **Places data source** (OpenStreetMap) feeds _Import places_, triggered by an admin.
- **Map tiles** (OpenStreetMap) are used by the web app to draw the map. They are not tied to a command.
- **Notification service** delivers visit reminders (Stretch). The trigger is a timer.
- **Routing service** provides real travel times on foot, by car and by public transport (Stretch). The provider is chosen later.
- **Moderator** (a user with the ADMIN role) approves or rejects place suggestions (Dream).
- **Geocoding service** (Nominatim) finds places outside the catalog (built, outside the committed MVP, see ADR-004).

### Key decisions

- The board is conceptual. A trip owns its days and its itinerary, so Day and
  Itinerary are not separate aggregates. The rules about days, assigned places,
  opening hours, the hours of the day and budget live inside Trip, so they are not policies.
- Places come from OpenStreetMap through the import and seed scripts for three cities
  (Porto, Paris and Berlin). Live discovery on the map, where a discovered place is
  saved to the catalog when it is first reviewed, is built in the tracer bullet but is
  Stretch (see ADR-002). The board does not show it yet: treat the saving as part of
  _Post review_ until the board is updated. User suggestions with moderation (Place
  suggestion) are designed but not in the MVP.
- Posting a review is the only way a place is marked as visited. Deleting the
  review does not unmark it.
- A user can review a given place only once; to change an opinion they edit the
  review. Different users can each review the same place.
- Days follow the trip date range: _Days added_ and _Days removed_ are events of
  _Create trip_ and _Change trip constraints_, with no command of their own.
- An itinerary is either generated by the system (_Generate itinerary_) or built by
  hand (_Edit itinerary_). The MVP generator is a basic one; a smarter one is Stretch.
- Deleting a day removes its assigned places. Deleting a trip removes its days,
  itinerary and assigned places.
- The rating and price level are recalculated whenever a review is posted, changed
  or deleted. _Top-rated places_ is a query, not an event.
- Wishlist and bookmark are kept separate. The wishlist feeds the itinerary
  generator (it reads it, no event). Lists are made of bookmarked places, so
  removing a bookmark removes the place from the lists.
- OpenStreetMap has no ratings or price levels, so reviewers provide the price level
  and the seed script creates demo users and reviews, so that rankings work from day one.
  A place's price level is the most common (mode) price level of its reviews, but a place
  that OpenStreetMap tags `fee=no` is free and stays free until at least 2 reviews give a paid price.
- Opening hours come from OpenStreetMap when mapped. Where they are missing the app
  shows "unknown" and cannot warn.
- Travel time between stops is estimated from straight-line distance in the MVP.
  Real routing is Stretch.
- The budget level is a soft target for the average price of the whole trip. Places
  have cost points (free 0, € 1, €€ 2, €€€ 3). The generator keeps the running average
  near the budget level and always includes wishlist places; the planner shows the
  average and warns when it is above. There is no euro amount. See [mvp.md](mvp.md#4-data-for-the-mvp).
- A place can be in several lists, and a list can hold any bookmarked place.
- A published itinerary is a copy, so it survives the deletion of the original trip.

What is in the MVP and what is not: see [mvp.md](mvp.md) and [vision.md](vision.md).

---

## 2. Domain model

- **Diagram:** ![Domain model](design/domain-model.png)
- **Source:** [domain-model.puml](design/domain-model.puml) (PlantUML)

The domain model **defines the problem**: the concepts of the business, their data and
how they relate. It has no technical ids and no behaviour. How the problem is solved
(components, patterns, technology) is in the [component diagram](#3-component-diagram).
Terms are defined in the [glossary](GLOSSARY.md).

**How to read the diagram** (the same legend is inside the diagram):

| Notation                          | Meaning                                                                                              |
| --------------------------------- | ---------------------------------------------------------------------------------------------------- |
| Box colour                        | Aggregate, as on the EventStorming board: the classes that change together                            |
| Line with a filled diamond        | Composition: the part cannot exist without the whole and is deleted with it                         |
| `/attribute`                      | Derived: calculated from other data, not typed in                                                    |
| `attribute [0..1]`                | Optional: may be unknown                                                                             |
| `<<value object>>`                | Has no identity of its own, defined only by its values                                               |
| `<<enumeration>>`                 | Fixed set of allowed values, shared by several classes                                               |
| `<<post-MVP>>`                    | Designed, not in the MVP                                                                             |

| Class                          | Aggregate           | Key attributes                                                                               | Main associations                                                                         |
| ------------------------------ | ------------------- | -------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| User                           | User                | username, email, role (USER / ADMIN)                                                         | writes Reviews, makes Visits, saves Places, owns Lists, plans Trips. An ADMIN is also the moderator of suggestions |
| City                           | Place               | name, country, latitude, longitude                                                           | contains Places, destination of Trips                                                     |
| Place                          | Place               | name, description, category, address, latitude, longitude, openingHours (optional), /priceLevel, /averageRating, /reviewCount | belongs to a City, has Reviews and Visits                       |
| Visit                          | Place               | visitedAt                                                                                    | links a User to a Place (at most one per pair); created when the user posts a review      |
| PlaceSuggestion (post-MVP)     | Place suggestion    | proposedName, proposedCategory, proposedAddress, status, suggestedAt, decidedAt (optional)   | suggested by a User, decided by a moderator (ADMIN), proposed in a City, approved as a Place |
| Review                         | Review              | rating (1..5), priceLevel (optional: €, €€ or €€€), text, createdAt                                        | written by a User about a Place (a user reviews a given place at most once)               |
| SavedPlace                     | Saved places        | type (WISHLIST / BOOKMARK)                                                                   | a User saves a Place                                                                      |
| SavedList                      | List                | name                                                                                         | owned by a User, contains bookmarked SavedPlaces                                          |
| Trip                           | Trip                | name, /averageCostPoints                                                                     | owned by a User, goes to a City, has TripConstraints, Days and an Itinerary               |
| TripConstraints (value object) | Trip                | startDate, endDate, budgetLevel (€, €€ or €€€: target average price of the whole trip), allowedCategories, dayStart, dayEnd (hours of the day) | part of a Trip                                                  |
| Day                            | Trip                | dayNumber, date                                                                              | part of a Trip, one per date between the start and end date                               |
| Itinerary                      | Trip                | mode (MANUAL / GENERATED)                                                                    | part of a Trip (0..1), schedules ItineraryStops                                           |
| ItineraryStop                  | Trip                | visitTime (optional), position, /outsideOpeningHours, /travelTimeFromPreviousStop            | on a Day, visits a Place                                                                  |
| Reminder (post-MVP)            | Reminder            | sentAt                                                                                       | reminds of an ItineraryStop; created when the visit time is near                          |
| PublishedItinerary (post-MVP)  | Published itinerary | title, publishedAt                                                                           | published by a User, bookmarked by Users, has PublishedStops (a copy of an itinerary)     |
| PublishedStop (post-MVP)       | Published itinerary | dayNumber, visitTime (optional), position                                                    | visits a Place                                                                            |
| PriceLevel (enumeration)       | shared              | FREE = 0, € = 1, €€ = 2, €€€ = 3 (cost points)                                               | used by Place (all four values) and Review (€ to €€€ only); the trip budget level also uses € to €€€; unknown is not counted                         |
| PlaceCategory (enumeration)    | shared              | RESTAURANT, MUSEUM, MONUMENT, PARK, CAFE, BAR, OTHER                                         | used by Place, PlaceSuggestion and TripConstraints                                        |

Design notes:

- The model leaves out on purpose what belongs to the solution: technical ids, the
  stored password hash (kept by the authentication library, ADR-009), the share token, the OpenStreetMap id and the origin of a
  place, and all operations. The database schema and the components add them.
- Wishlist and bookmark are one class with a type, because they behave the same.
  Only the wishlist feeds the itinerary generator.
- A list is its own aggregate and holds bookmarked places only. A policy removes a
  place from the lists when its bookmark is removed, and one place can be in several
  lists.
- Days are part of the Trip and follow its date range. Deleting a Trip deletes its
  Days, Itinerary and stops. This is inside the aggregate, not a policy.
- A published itinerary is a copy, so it survives the deletion of the original trip.
- _Top-rated places_ is a read model (a query), not a class. `/averageRating`,
  `/reviewCount` and `/priceLevel` are derived from the reviews of the place (the
  price level is free when OpenStreetMap says there is no fee, otherwise the most
  common price level in the reviews).
- Visit belongs to the Place aggregate, as on the EventStorming board. The Review
  aggregate only triggers it through a policy, so deleting a review does not remove
  the Visit.
- Place suggestion is its own aggregate (Dream). When a suggestion is approved, a
  policy adds a Place to the catalog in the city it was proposed in.

---

## 3. Component diagram

- **Diagram:** ![Component diagram](design/component-diagram.png)
- **Source:** [component-diagram.puml](design/component-diagram.puml) (PlantUML)

The component diagram is **the solution**: how the system is built to solve the problem
described by the [domain model](#2-domain-model). Grey components are Stretch:
designed, not in the MVP.

**How to read the diagram** (the same legend is inside the diagram):

| Notation                         | Meaning                                                                          |
| -------------------------------- | -------------------------------------------------------------------------------- |
| Box with the component icon      | A component: a module with one responsibility                                    |
| Dashed arrow                     | Depends on: the component at the tail calls the one at the arrow                 |
| Solid arrow                      | Connects to a person, the database or an external system                         |
| Lollipop (REST API)              | An interface that the backend offers to the Web App                              |
| Plain line from the REST API     | The component is reachable through the API                                       |
| Box "Backend"                    | The server side of the one Next.js app. Each component inside is a module        |
| Pink cloud                       | External system we do not build                                                  |
| Cylinder                         | The database                                                                     |

| Component            | Responsibility                                                                                                                                                               | Depends on                                                              |
| -------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| Web App              | Browser UI for users and admins, including the map                                                                                                                           | Backend REST API, Map tiles (external)                                  |
| Identity             | Users, authentication (Better Auth, see ADR-009), roles                                                                                                                                                 | Database                                                                |
| Place Catalog        | The whole Place aggregate: places, city search, import, opening hours, visited marker, rating recalculation and the top-rated list (live discovery of places and search outside the catalog are built but outside the committed MVP; suggestions and moderation are post-MVP) | Database, Places data source (external), Geocoding service (external) |
| Reviews              | Post, edit and delete reviews, including the price level. Triggers _mark place visited_ and _recalculate rating_ in Place Catalog                                            | Place Catalog                                                           |
| Saved Places         | Wishlist, bookmarks and custom lists                                                                                                                                         | Place Catalog                                                           |
| Trip Planner         | Trips, days, itineraries, visit times, travel-time estimates, opening-hours and budget warnings                                                | Place Catalog, Itinerary Generator, Routing service (external, Stretch) |
| Itinerary Generator  | Builds a basic itinerary from top-rated places, type filters, distance, the budget average, the wishlist, the hours of the day and known opening hours.                           | Place Catalog, Saved Places                                             |
| Publishing (Stretch) | Published itineraries, sharing, bookmarks                                                                                                                                    | Trip Planner                                                            |
| Reminders (Stretch)  | Scheduler that sends visit reminders                                                                                                                                         | Trip Planner, Notification service (external)                           |

External systems:

- **Places data source** (OpenStreetMap), used by Place Catalog to import places and, outside the committed MVP, to discover places live on the map (see ADR-002).
- **Map tiles** (OpenStreetMap), used by the Web App to draw the map.
- **Routing service** (Stretch, provider chosen later), used by Trip Planner for real travel times.
- **Geocoding service** (Nominatim, built but outside the committed MVP), used by Place Catalog to search outside the catalog (see ADR-004).
- **Notification service** (e-mail or push, Stretch), used by Reminders.

Each component matches aggregates from the EventStorming (Identity = User, Place
Catalog = Place and Place suggestion, Reviews = Review, Saved Places = Saved places
and List, Trip Planner = Trip, Publishing = Published itinerary, Reminders =
Reminder). The Itinerary Generator is the domain service. The policies on the board
are the calls between components: Reviews to Place Catalog (visited and rating),
Saved Places to itself (lists), Trip Planner to Reminders.

**Technology.** The app is one Next.js project: the React UI and the server side
(route handlers) live in the same codebase, and each backend component above is a
module of it. Data is stored in PostgreSQL through Prisma, with versioned Prisma
migrations. The target setup is development in VS Code inside a dev container, with
one container for the app and one for the database (planned; today
Docker Compose runs only the database and the app runs on the developer's machine).
The MVP is one deployable app plus one database.

---

## 4. Architecture decision records (ADRs)

The structuring architecture decisions of the project are kept in this section, so
there are no separate files to keep in sync. This section is the single source of
truth. Domain policies are on the EventStorming board and in section 1.

| ADR     | Decision                                                  | Status                |
| ------- | --------------------------------------------------------- | --------------------- |
| ADR-001 | Full-stack architecture with Next.js 15 App Router       | Accepted              |
| ADR-002 | Places come from import and seed scripts and live discovery (OpenStreetMap) | Accepted (live discovery built, outside the committed MVP) |
| ADR-003 | Soft budget metric based on cost points                   | Accepted              |
| ADR-004 | Search outside the catalog with Nominatim                 | Accepted (built, outside the committed MVP) |
| ADR-005 | Honest symbolic places and a Ranking DataTable            | Accepted              |
| ADR-006 | Data and development environment                          | Accepted              |
| ADR-007 | Deployment on Vercel and Neon                             | Accepted (tested on dev and prod) |
| ADR-008 | Rank places by a weighted rating                          | Accepted              |
| ADR-009 | Authentication with Better Auth                           | Accepted (confirmed in a spike) |

### ADR-001: Full-stack architecture with Next.js 15 App Router

- **Status:** Accepted
- **Context:** The initial split into two repositories (a React SPA and an Express.js backend) added needless operational friction: duplicated TypeScript interfaces, CORS problems in development and duplicated Docker containers.
- **Decision:** Unify the stack in **Next.js 15 with the App Router**:
  - _Frontend:_ React Server Components (RSC) for the initial render and static pages. Client Components (`"use client"`) for the interactive Leaflet map and modals.
  - _Backend:_ native Next.js Route Handlers (`src/app/api/`) for the REST endpoints (for example `/api/places` and `/api/reviews`).
  - _Persistence:_ Prisma Client, generated and instantiated as a shared singleton (`src/lib/prisma.ts`).
- **Consequences:**
  - _Positive:_ one process and one port (`3000`). Prisma types and pure domain modules (`src/domain/`) are shared directly between frontend and backend.
  - _Trade-offs:_ the HTTP routes are coupled to the Next.js runtime. Components that depend on the browser DOM (`window`) need dynamic wrappers (`ssr: false`).

### ADR-002: Places come from import and seed scripts and live discovery (OpenStreetMap)

- **Status:** Accepted. This replaces the first version of the ADR, which said all places come from an import script and the app never calls OpenStreetMap live. The tracer bullet was built with live discovery, so the ADR describes what the code does. Live discovery is outside the committed MVP (Stretch S19, see [mvp.md](mvp.md)): in the MVP the catalog comes from the scripts only, for three cities.
- **Context:** Reviews (`Review`), visits (`Visit`) and itinerary stops (`ItineraryStop`) need referential integrity with `Place.id` in the relational database. The public Overpass API servers have strict rate limits (HTTP 429), unpredictable latency (3 s to 60 s) and frequent failures (HTTP 502), so the app must keep working when they do not answer.
- **Decision:** The catalog is the `Place` table in PostgreSQL. Places enter it in three ways:
  - _Scripts (`source = IMPORTED`):_ `scripts/import-osm.ts` is the _Import places_ command and loads the places of one MVP city (`npm run import:osm -- porto`, `paris` or `berlin`) from OpenStreetMap (Nominatim); only Porto's snapshot is loaded by the seed today. `prisma/seed.ts` creates the MVP cities (Porto, Paris and Berlin), their places, the demo users and the sample reviews. The demo data is not marked in the schema.
  - _Live discovery (`source = LAZY_OSM`, Stretch):_ when the map moves, `GET /api/osm` asks Overpass for the places in the visible area (small areas only, at most 40 places, three mirrors tried in turn with a 2 s timeout, 15 minute in-memory cache). If Overpass does not answer, the map shows the places already in PostgreSQL. A discovered place is saved to PostgreSQL by `POST /api/reviews` when a user posts the first review for it.
  - _Suggestions (`source = SUGGESTED`):_ approved place suggestions, once they exist (Dream).
- **Alternatives considered:** only the import script, with no live calls. It was the first version of this decision: the demos then need no external network, but a place that was not imported cannot be reviewed.
- **Consequences:**
  - _Positive:_ with live discovery any place on the map can be reviewed, the catalog still works when Overpass is down (it falls back to the database), and relational integrity is kept for all reviews and trips because only saved places can be reviewed.
  - _Trade-offs:_ the map depends on public Overpass servers for places that are not yet saved, and they can be slow or rate-limited. In the tracer bullet a place saved on the fly is always assigned to the city Porto, so this must be fixed before live discovery is used in other cities. The EventStorming board does not show the on-the-fly saving yet.

### ADR-003: Soft budget metric based on cost points

- **Status:** Accepted
- **Context:** OpenStreetMap does not provide exact ticket or meal prices. Collecting exact euro amounts would produce false or incomplete data and make the itinerary generator rigid and fragile.
- **Decision:** A discrete cost-point model with a soft target:
  - Cost points by level: `FREE = 0`, `€ = 1`, `€€ = 2`, `€€€ = 3`.
  - Public places without a ticket (for example OpenStreetMap `fee=no`) automatically get `FREE` (0 points). Other places get the statistical **mode** of the price levels that users give in their reviews. A `FREE` place only changes when at least 2 reviews give a paid price.
  - A `Trip` has a `budgetLevel`, the target for the average of the whole trip. The generator and the planner keep the running average close to that value and warn when it is exceeded, without blocking the user's choices. Places with an unknown price are not counted.
- **Consequences:**
  - _Positive:_ a deterministic, resilient generator that is easy to test with TDD (`src/domain/itinerary/itinerary.ts`). The user can mix free and paid attractions.
  - _Trade-offs:_ it does not compute an absolute monetary budget in euros.

### ADR-004: Search outside the catalog with Nominatim

- **Status:** Accepted. Built in the tracer bullet (`/api/osm/search` and the search box on the map), outside the committed MVP scope (see [mvp.md](mvp.md)). The search box runs on submit only, and the server enforces the limit of 1 request per second (per server instance, see below).
- **Context:** Text search over the PostgreSQL catalog cannot find a place that is not in our database. The MVP search (city, filters, sort) runs on the catalog only. The public Nominatim service has a strict usage policy: it forbids autocomplete (search as you type), allows at most 1 request per second for the whole application, asks for caching and requires a User-Agent that identifies the application.
- **Decision:** Use the OpenStreetMap geocoding service (**Nominatim API**) through a dedicated backend endpoint (`/api/osm/search`), within the policy:
  - Search runs only when the user submits (Enter), never while typing.
  - At most 1 request per second in total (the endpoint answers HTTP 429 with `Retry-After: 1` to the extra requests, and answers from the cache do not count), results cached on our side (15 min TTL), a defensive timeout of 3 seconds and an identifying `User-Agent`. The counter is in the memory of one server instance, so on Vercel, where several instances can run, the limit is per instance. That is enough for the expected traffic, and a shared counter (for example in the database) would be needed to make it exact.
  - Results are shown in two groups: _Local catalog_ and _Found on OpenStreetMap_.
- **Consequences:**
  - _Positive:_ any public place in the world can be found and shown on the map.
  - _Trade-offs:_ it adds a Geocoding service to the external systems and depends on the network outside the catalog. A place found this way is saved to the catalog when it is first reviewed (see ADR-002).

### ADR-005: Honest symbolic places and a Ranking DataTable

- **Status:** Accepted (supersedes an earlier attempt with external stock photography)
- **Context:** Generic stock photography caused visual identity problems (for example local monuments and restaurants shown with photos from other European capitals) and generated needless network traffic.
- **Decision:** No external stock photos. Use canonical symbolic representation ([`src/domain/catalog/categories.ts`](../src/domain/catalog/categories.ts)) together with a Ranking DataTable view:
  1. _Canonical symbolic identity:_ each category (`PlaceCategory`) has consistent semantic iconography (`Lucide`), themed badges and a dedicated pastel palette.
  2. _Ranking DataTable:_ a Letterboxd/TripAdvisor-style table, ordered by `averageRating` descending (ties broken by review count), showing rank, category, price level and quick actions ("Map" and "Rate").
  3. _View toggle:_ a smooth, responsive switch between "Table" and "Cards" that keeps filters and pagination.
  4. _Photos in later tiers:_ landmark photos from Wikimedia Commons are Stretch and photos uploaded with reviews are Dream (see [vision.md](vision.md)).
- **Consequences:**
  - _Positive:_ fully honest visuals (no risk of wrong or unrelated photos), instant loading with no external CDN calls, no layout shifts and a more readable ranking.
  - _Trade-offs:_ no illustrative photos in the MVP.

### ADR-006: Data and development environment

- **Status:** Accepted
- **Context:** Four people must work on the same stack with the same results, and teachers must not need to install anything to see the product.
- **Decision:**
  - _Database:_ PostgreSQL, accessed through Prisma. The schema changes only through versioned Prisma migrations stored in the repository. A migration that was already applied is never edited or squashed: a change is always a new, incremental migration.
  - _Development:_ VS Code inside a dev container. One `docker-compose.yml` defines two containers: the app and the database. This is planned. Today `docker-compose.yml` runs only the database (PostgreSQL 18, the same major version as Neon) and the app runs on the developer's machine with `npm run dev`.
  - Docker is used only for local work. Deployment does not use it (see ADR-007).
- **Consequences:**
  - _Positive:_ every member has the same environment (once the dev container exists), reproducible migrations and the same database engine (PostgreSQL) locally and in the cloud.
  - _Trade-offs:_ every member needs Docker installed. Local data and the cloud data are separate, so the seed script must be run in each environment. Docker and Neon both run PostgreSQL 18, so a migration that works locally behaves the same in the cloud.

### ADR-007: Deployment on Vercel and Neon

- **Status:** Accepted. The dev path was tested on 21 Oct 2026, first with a hello-world app and then with the real skeleton, including the Prisma migration step on the dev database. The `main` (prod) path ran on 22 Oct 2026: the migrations were applied, the deploy succeeded and the site answers. Not yet proven: a deploy of a commit pushed by a teammate (see the Hobby plan note below).
- **Context:** The project needs two separate environments (dev and prod) that teachers can open, at no cost. The repository is private in the course organisation, and Vercel's free plan cannot connect to private organisation repositories.
- **Decision:**
  - _App hosting:_ Vercel Hobby (non-commercial use), with two projects: `les-group7-dev` (branch `dev`, address `les-group7-dev.vercel.app`) and `les-group7` (branch `main`, address `les-group7.vercel.app`). Both are deployed to their own production environment, which gives each a fixed public address.
  - _Database:_ Neon Free, with two projects: `les-g7-dev` and `les-g7-prod`. The app uses the pooled connection string (`DATABASE_URL`) and migrations use the direct one.
  - _Pipeline:_ a GitHub Action (`.github/workflows/deploy.yml`) runs on every push to `dev` or `main`: install, lint and tests, build, `prisma migrate deploy` and upload with the Vercel command line tool. Vercel never connects to the repository.
  - _Prisma on Vercel:_ `prisma/schema.prisma` generates the query engine for two targets, `native` (the CI runner) and `rhel-openssl-3.0.x` (the system Vercel Functions run on). With only the first one the pages fail with "could not locate the Query Engine".
  - _Secrets:_ stored only in GitHub secrets and Vercel environment settings, never in the repository or in chat.
  - _Releases:_ `dev` is merged into `main` the day before each review, after backing up the prod database.
  - Full steps: [deployment.md](deployment.md).
- **Alternatives rejected:** Render (its free PostgreSQL expires after 30 days) and Supabase (free projects pause after one week of inactivity).
- **Consequences:**
  - _Positive:_ free, two fixed public addresses, a deployment that is repeatable and visible in GitHub.
  - _Trade-offs:_ Neon suspends the database after 5 minutes without use, so the first request is slower. Free limits apply (Neon: 1 GB and 100 compute-hours per month per project). Both Vercel projects belong to one person's account.
  - _Hobby plan:_ it only deploys commits authored by the account owner and blocks the rest (the deployment stays in the state `BLOCKED` and the upload waits). The workflow hides `.git` while it uploads so that the upload carries no commit author. This worked for the owner's commits on dev and prod, and has not been tested with a teammate's commit. If it fails, only the account owner can deploy until the plan changes. Which commit was deployed is visible in the GitHub Action run, not in Vercel.
  - _Data history:_ Neon Free keeps only 6 hours of history, so a prod backup must be taken before each release (see [deployment.md](deployment.md)).

### ADR-008: Rank places by a weighted rating

- **Status:** Accepted
- **Context:** Ranking by the plain average puts a place with one 5-star review above a place with fifty reviews averaging 4.8. One opinion is weaker evidence than fifty. Our data is also sparse: most places have 0 to 2 reviews, so a rule such as "at least 3 reviews to appear" would leave the top-rated list almost empty.
- **Decision:** Rank by a weighted rating, a Bayesian average (the method IMDb uses for its Top 250): `score = (n / (n + m)) × average + (m / (n + m)) × C`, where `n` is the number of reviews of the place, `average` is its plain average, `m = 3` and `C = 4.0`. These are named constants. Places without reviews have no score and come last. Ties are broken by number of reviews, then by name. The same score sorts every list by rating (the ranking, the top-rated list and the sort in search). The plain average and the number of reviews are still shown. The "minimum rating" filter uses the plain average. The score is computed when ranking from `averageRating` and `reviewCount`, so the schema does not change.
- **Alternatives considered:** the plain average (simple, but one review can win); a minimum number of reviews (simple, but it hides most places while the data is sparse); the Wilson score, which suits up and down votes and not 1 to 5 stars.
- **Consequences:**
  - _Positive:_ one review cannot outrank many, a place moves smoothly as it gets reviews, and the rule is one small pure function that is easy to unit test.
  - _Trade-offs:_ two constants (`m` and `C`) to explain. The order can differ from the order of the displayed averages, so the page shows the number of reviews next to the average. If the catalog gets many more reviews, `C` can become the real average of all reviews.
  - _Revisit:_ `m = 3` and `C = 4.0` fit today's data, where most places have 0 to 2 reviews. When the seed or real use adds many more users and reviews, check them again: `m` should be about the number of reviews that a typical reviewed place has, and `C` the average of all the reviews of the catalog. Reviews that we write in the seed do not count for `C`, because we chose their ratings. Changing them means changing the constants in `src/domain/reviews/rating.ts`, the expected numbers in `rating.test.ts`, and the values and examples (1 review of 5 gives 4.25, and so on) in this ADR, [GLOSSARY.md](GLOSSARY.md), [mvp.md](mvp.md) and [user-stories.md](user-stories.md) (US-B6-01).

### ADR-009: Authentication with Better Auth

- **Status:** Accepted. Confirmed by a spike on 31 Oct 2026 (a throwaway local branch, Postgres 18, Prisma 6.19, Next 15; see the end of this ADR).
- **Context:** The MVP needs registration, login, logout, and "every write action requires login, users can only change their own data" (see [mvp.md](mvp.md)). The prototype has none of it: the user is chosen with buttons and the review endpoint trusts a `userId` from the request body. Security code (password hashing, sessions, rate limiting) is easy to get wrong, so we prefer a maintained library to our own.
- **Decision:** Use **Better Auth** (npm `better-auth`, pinned to an exact version, 1.7.x at the time of writing) with the Prisma adapter, e-mail and password, and the `username` plugin.
  - _Where:_ the server instance in `src/lib/auth.ts`, the library's routes under `src/app/api/auth/[...all]/route.ts`, and our own `POST /api/register`. There is no browser client of the library: the login and logout buttons call its endpoints (`/api/auth/sign-in/email`, `/api/auth/sign-in/username`, `/api/auth/sign-out`) with `fetch`, and `buildLoginRequest` and `loginErrorMessage` (`src/domain/identity/login.ts`) hold the rules of the login form.
  - _Passwords:_ hashed by the library (scrypt by default) and stored in its `Account` table. The old `User.passwordHash` column was dropped by the migration `20261102180000_drop_user_password_hash` (#19), once nothing wrote it any more. Minimum length 8, maximum 128.
  - _Usernames:_ 3 to 30 characters, letters, numbers, underscores and dots, stored in lower case (the plugin's defaults).
  - _Sessions:_ kept in the database (table `Session`), valid for 7 days, and revocable on the server. Logging out ends the session.
  - _Protecting endpoints:_ every handler that writes data reads the user with `auth.api.getSession({ headers })` and answers 401 without one. The user id always comes from the session. We do not rely on middleware alone, as the library's own docs advise. Against cross-site requests the cookie is `SameSite=Lax`, and our endpoints also check that the `Origin` header is this site (`isAllowedOrigin`, `src/domain/identity/origin.ts`): `POST /api/register` does it now, and the guard of the write endpoints does it for the rest.
  - _Registration:_ the form posts to `POST /api/register` with `{ username, email, password }`, and this is the only way to create an account (the library's own sign-up path and its username probe are switched off with `disabledPaths`, so the checks below cannot be skipped). The body must be JSON (415) and the `Origin` must be this site (403). Our own validation answers 400 with `{ errors: { username?, email?, password? } }`, one message per wrong field. A taken username or e-mail answers 409 with the same shape and names every taken field. Success answers 201 with the session cookie. Every well-formed attempt counts towards a limit of 20 per 10 minutes per address, then 429 with `Retry-After`; a form with a typo is free. The counter is a row of the `RateLimit` table with its own key.
  - _Login:_ with e-mail or username (two library calls, chosen by the presence of "@"). The error never says whether the user exists.
  - _Login rate limit:_ enabled in every environment, not only in production, so that what we test locally is what runs live: 3 sign-in attempts by e-mail per 10 seconds, and 100 requests per 10 seconds for the other endpoints. Memory storage does not suit serverless, so the counters are stored in the database (table `RateLimit`).
  - _Environment:_ `BETTER_AUTH_SECRET` (at least 32 characters, a different value for dev and prod) and `BETTER_AUTH_URL`, set in each Vercel project. Values are never committed.
  - _Not in the MVP:_ e-mail verification, password reset, social login, two-factor authentication.
- **Alternatives considered:**
  - _Our own signed cookie_ (HMAC): little code, but we would own the cryptography and the session handling, and could not revoke a session.
  - _Auth.js v5_ (NextAuth): still a beta (5.0.0-beta.32) and in maintenance mode since September 2025, when the Better Auth team took over its maintenance. Its Credentials provider has no registration, hashing or rate limiting, and its sessions are JWTs that cannot be revoked.
  - _Hosted services_ (Clerk, WorkOS): user data lives on third-party servers, and graders would need accounts there.
- **Consequences:**
  - _Positive:_ a maintained, widely used library, revocable database sessions, hashing and rate limiting that we do not write ourselves, and less security code to defend.
  - _Trade-offs:_ new tables (`Session`, `Account`, `Verification`, `RateLimit`) and new `User` columns (the library requires a `name`, which we set to the username, and `emailVerified`), through incremental migrations. The seed must create users through the library's hashing. The library is a young 1.x package, so we pin the version and upgrade deliberately.
- **Confirmed in the spike (31 Oct 2026):**
  - _Works with our stack:_ Better Auth 1.7.14 with the Prisma adapter, Prisma 6.19 and Next 15. 16 checks passed against a running server: registration, login by username and by e-mail, logout, the guard, duplicates, validation errors, the origin check and the rate limit.
  - _Cookie:_ `better-auth.session_token`, `HttpOnly`, `SameSite=Lax`, 7 days, and with an https site URL `__Secure-` plus `Secure`. A request that carries the cookie is refused (403) when its `Origin` is foreign or missing, which is the protection against cross-site posts.
  - _Data:_ e-mails and usernames are stored in lower case (the original username is kept in `displayUsername`). The password hash is in `Account.password` (scrypt, provider `credential`). A `role` sent in the sign-up body is ignored and the stored role is `USER`, so our `Role` enum works with the library's `role` field. The library creates its own string ids for new users, and the ids of existing users do not change.
  - _Errors:_ a wrong password and an unknown user give the same answer. The library reports one error at a time, so our own validation runs first to give one message per field (a user who is wrong on two fields is told about both).
  - _Rate limit:_ with database storage, the 4th sign-in within 10 seconds answers 429 and the counter recovers after the window. The counter is keyed by the address in `x-forwarded-for`, which Vercel sets.
  - _Telemetry:_ off by default (it needs an explicit setting or `BETTER_AUTH_TELEMETRY`), and we also set it off in the config.
  - _Seed:_ `hashPassword` from `better-auth/crypto` plus an `Account` row lets a demo user log in with a known password, and the old fake hash no longer works.
- **Things the spike found that the plan must respect:**
  - The migration cannot be the generated one. The library needs a required `name` and `updatedAt` on `User`, and the dev and prod databases already have users, so the generated SQL fails ("column contains null values"). The migration adds the columns as nullable, fills them for existing users (`name` = username) and then makes them required.
  - The CLI wants to rename our tables (`@@map("user")`) and add a second `createdAt`. We keep our table names and map the library's `createdAt` to our `registeredAt` (`user.fields`), so no existing column or table changes name.
  - `auth.api.signUpEmail` reports some failures by returning an error Response and others (for example the username checks) by throwing `APIError`. The `POST /api/register` wrapper handles both. The library answers a successful sign-up with 200, and the wrapper answers 201.
  - The library never writes the old `passwordHash` column, which is required in the old schema, so the migration makes it optional. The seed and the reviews endpoint (which created demo users) still wrote it at first and only got the new required `name`; #14 removed the endpoint's demo users and #19 gave the seed real accounts. The column was dropped afterwards, in a new migration, so that no deploy broke code that still wrote it.
- **Verified on the real database (31 Oct 2026):** the migration was applied through the direct connection to a copy of the dev database (a temporary Neon branch). The two demo users got their new columns, all 535 places and 94 reviews were intact, and the four new tables existed. The app then ran through Neon's pooled connection, which is what Vercel uses, and the 35 curl checks passed there, including the rate limit counters in the database. The procedure is in [deployment.md](deployment.md).
- **Security review (31 Oct 2026):**
  - _Found and fixed:_ `POST /api/register` accepted a cross-site request (a foreign `Origin` and a `text/plain` body registered an account and set the cookie), because calling the library from server code skips its own origin check. It now requires a JSON body and the site's own `Origin`. Sign-up had no rate limit, and the library's own public sign-up path would have bypassed one, so that path is switched off and the registration route carries the limit.
  - _Checked and fine:_ a `role` sent at sign-up or through `update-user` is ignored; `delete-user` and `change-email` are not exposed; a wrong password and an unknown user answer the same and take the same time (about 370 ms each); the cookie is `HttpOnly` and `SameSite=Lax`, and `Secure` over https.
  - _Known and accepted:_ registration tells which username or e-mail is taken (the story requires it), e-mails are not verified, and the password policy is length only.
  - _Not done yet:_ HTTP security headers (clickjacking and content type protection) and the dependency updates that `npm audit` suggests. Both are separate tickets.
