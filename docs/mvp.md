# MVP

Group 7 · MESW LES 2026-27 · Iteration 0

The MVP is the smallest version of the product that we **commit to finish and
release by 18 Dec 2026**. Everything else in the [vision](vision.md) is Stretch
(only if the MVP is done) or Dream (not planned).

## 1. MVP statement

> A signed-in user can **find places in a city, read and write reviews, see what
> is top-rated and where it is on a map, save places, and plan a trip to that city
> for a number of days**, building the day-by-day itinerary by hand or letting the
> app generate a basic one from the rankings.

## 2. In the MVP

Each feature lists what the user can do. The features are not tied to a specific
iteration: the order is decided at each sprint planning.

### Accounts

| ID | Feature | The user can… |
|---|---|---|
| A1 | Register and log in | Create an account, log in and log out |

### Places and discovery

| ID | Feature | The user can… |
|---|---|---|
| B1 | Place import | (Admin) import places from OpenStreetMap with the import script, for each MVP city (Porto, Paris and Berlin) |
| B2 | Demo data | (Team) load the cities, demo users and sample reviews so rankings work from day one |
| B3 | City search and filters | Search a city, browse its places, filter by type, price level and rating, sort by rating |
| B4 | Place page | See details, opening hours (or "unknown"), rating, price level and reviews |
| B5 | Map view | See a city's places as pins on a map, with clustering |
| B6 | Top-rated places | See the top-rated places per city and type |

### Reviews

| ID | Feature | The user can… |
|---|---|---|
| C1 | Post a review | Rate 1 to 5, write text, say how expensive it was (€ / €€ / €€€). A user can review a place only once (edit it to change it). The place is marked as visited and its rating updates |
| C2 | Edit and delete a review | Change or remove own review; rating and top-rated update |
| C3 | Visited places | See a list of the places they have visited |

### Saved places and lists

| ID | Feature | The user can… |
|---|---|---|
| D1 | Wishlist and bookmarks | Add and remove places on the wishlist ("I want to go") or bookmarks ("remember this") |
| D2 | Custom lists | Create, rename and delete lists in the bookmarks section; add and remove bookmarked places. A place can be in several lists, and removing a bookmark removes the place from the lists |

### Trips and itineraries

| ID | Feature | The user can… |
|---|---|---|
| E1 | Create a trip | Choose a city, dates, budget level (€ / €€ / €€€, the target average price for the whole trip), preferred types and the hours of the day (when the day starts and ends); days are created from the dates |
| E2 | Change a trip | Edit the constraints (including the hours of the day); days are added or removed to match |
| E3 | Delete a trip | Delete a trip with its days, itinerary and stops |
| E4 | Manual itinerary | Build an itinerary by hand: assign places to days, remove them, set visit times (any time, also outside the hours of the day) |
| E5 | Nearby suggestions | While planning a stop, see the best-ranked places nearby (for example lunch after a landmark) |
| E6 | Plan warnings | Get a warning when a visit time is outside the place's opening hours (only where hours are known), and see the trip's average price level next to the budget level, with a warning when it is above |
| E7 | Travel-time estimate | See "≈ N min walk" between consecutive stops, estimated from straight-line distance |
| E8 | Basic generator | Press "Generate itinerary": per day, top-rated places of the chosen types, grouped by distance, with a lunch place near the morning stop. Each stop gets a visit time inside the hours of the day, and a place whose opening hours are known is never given a time when it is closed (places with unknown hours can go anywhere). It keeps the trip's average price at or near the budget level (see section 4) and always includes the user's wishlist places. The result can be edited like a manual one |

### Platform

| ID | Feature | Detail |
|---|---|---|
| P1 | Web app, no installation | Works in current desktop and mobile browsers, layout usable down to phone width |
| P2 | Dev and prod environments | Separate servers; changes go to dev first and reach prod at each sprint review |
| P3 | Attribution | "© OpenStreetMap contributors" visible on the map and wherever place data is shown |

## 3. Not in the MVP

Everything marked Stretch or Dream in the [vision](vision.md). The designs
already cover some of it (suggestions and moderation, publishing and sharing,
reminders), but it is **not built** in the MVP.

If there is time left, we take the Stretch ideas below, in this order. Each has an ID
so that its user story can name it (see [user-stories.md](user-stories.md)).

| ID | Stretch idea |
|---|---|
| S1 | Smart generator (real travel times, finer budget balancing) |
| S2 | Real travel times from a routing service (on foot, by car and by public transport where the service has the data) |
| S3 | Photos for landmarks |
| S4 | Publish and share itineraries (publish with a link, bookmark, copy into my own trip) |
| S5 | Visit reminders |
| S6 | Other conflict warnings (overlapping visits, too much walking) |
| S7 | Drag and drop reordering |
| S8 | Alternatives per stop |
| S9 | "Helpful" votes on reviews |
| S10 | Personal stats and a map of visited places |
| S11 | Ticket prices where OpenStreetMap has them |
| S12 | Optional budget in euros per day |
| S13 | Multi-city trips |
| S14 | Trip summary e-mail |
| S15 | Push notifications on mobile |
| S16 | Export an itinerary to PDF or calendar |
| S17 | Installable web app (PWA) with offline itinerary |
| S18 | Search outside the catalog with Nominatim (already built, see ADR-004) |
| S19 | Discover places on the map: OpenStreetMap places that are not in the catalog yet, saved when first reviewed (was B7; already built in the tracer bullet, see ADR-002) |

## 4. Data for the MVP

- **Cities:** three cities: Porto, Paris and Berlin (decided in ADR-002 in
  [design.md](design.md)). Every city needs enough places and demo reviews to rank well.
  The data is small (the prototype's dev database, with 535 places and 94 reviews, uses
  9 MB of the 1 GB free limit), so the limit is the work of preparing the data for each
  city, not storage.
- **Places:** loaded from OpenStreetMap by the import script (all three cities) and the
  seed script into our own database (see ADR-002). Only places in the catalog can be
  reviewed and planned. Discovering other places live on the map is Stretch (S19).
- **Opening hours:** taken from OpenStreetMap where mapped. Where they are missing
  the app says "unknown" and cannot warn.
- **Ratings and price levels:** OpenStreetMap has none, so they come from reviews.
  The seed script creates demo users and sample reviews (the schema does not mark
  them as demo data).
  A place's price level is the most common (mode) price level given in its reviews.
- **Hours of the day:** every trip has a time when the day starts and a time when it
  ends (default 09:00 to 20:00; the earliest start is 08:00 and the latest end is
  23:00). The generator keeps every stop inside these hours. When the user plans by
  hand, any visit time is allowed.
- **Budget level:** it is a soft target for the **whole trip**, not a limit per place
  or per day, and not an amount in euros (we have no real prices, and a trip total
  would include flights and hotels, which the app does not model).
  - Each place has a cost point: free = 0 (including places that OpenStreetMap
    tags `fee=no`), € = 1, €€ = 2, €€€ = 3. The budget level has the same points.
  - The trip's average is the mean of the cost points of the stops that have a
    known price. Places with an unknown price are shown as "price unknown" and
    do not count.
  - The generator picks the best-ranked places as usual, and skips or replaces a
    pick that would push the running average above the budget level. Wishlist places
    are always included and count towards the average, so the other stops adjust.
  - It is soft: if a city has too few cheap places the generator still fills the
    days with the closest fit, and the plan shows the average as a warning.

## 5. Non-functional requirements

| Area | Requirement |
|---|---|
| Access | Browser only. A teacher can use the whole app from the URL with no installation |
| Environments | Separate dev and prod servers |
| Security | Passwords stored hashed, every write action requires login, users can only change their own data, input is validated |
| Compatibility | Latest Chrome, Firefox, Edge and Safari; usable on a phone-width screen |
| Map | Follows the OpenStreetMap tile usage policy (attribution, no bulk or offline use), or uses a provider that allows our usage |
| Licensing | OpenStreetMap attribution shown |
| Tech stack | One Next.js app (React UI and server side in the same project), PostgreSQL accessed through Prisma |
| Development setup | Target: developed in VS Code inside a dev container, with one container for the app and one for the database, started together (planned, not built yet). Today: Docker Compose runs the database and the app runs on the developer's machine |
| Understandability | Every team member can explain the design and code, including anything written with AI help |

## 6. Demo scenario

The MVP is shown, at each sprint review and at the final release, with this scenario on the prod server:

1. Register and log in.
2. Search a city, filter restaurants by price level, open the map and a place page.
3. Post a review with a price level; see the rating and top-rated list change and
   the place appear in "visited".
4. Add a place to the wishlist and to a custom list.
5. Create a 3-day trip to Paris with a budget level, preferred types and the hours of the day.
6. Generate an itinerary, then edit it: move a place, set a visit time outside
   opening hours and see the warning, check the travel-time estimates and the
   trip's average price against the budget level.
7. Change the trip dates and see the days update.
8. Delete the trip.

## 7. When is the MVP done?

When every feature in section 2 meets the [Definition of Done](definition-of-done.md)
and the demo scenario in section 6 runs on the prod server.
