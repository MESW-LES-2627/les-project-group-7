# Domain Glossary (Ubiquitous Language)

Group 7 · MESW LES 2026-27

This glossary defines the canonical ubiquitous language for the place review and itinerary planning platform. All code, database schemas (`schema.prisma`), API endpoints, and team communications must strictly adhere to these definitions.

---

## 1. Place Catalog & Discovery

### Place
- **Definition:** A physical location or establishment of interest (restaurant, museum, monument, park) imported from OpenStreetMap or suggested by users (post-MVP).
- **Key Attributes:** `id`, `osmId`, `name`, `category` (PlaceCategory), `address`, `latitude`, `longitude`, `openingHours`, `priceLevel` (`FREE` | `€` | `€€` | `€€€`), `costPoints` (0..3), `averageRating`, `reviewCount`, `source`.
- **Invariants & Policies:** 
  - `averageRating` is a floating-point average [1.0, 5.0] calculated from all associated active `Review` records.
  - `priceLevel` is an intrinsic property of a place imported from OpenStreetMap metadata: places with `fee=no` (parks, viewpoints, public landmarks) map to `FREE` (0 cost points), while commercial or ticketed attractions map to `€`, `€€`, or `€€€`.
  - **On-the-Fly Place Ingestion:** When a user reviews a live OpenStreetMap point of interest that is not yet saved in PostgreSQL, the place is automatically ingested and persisted into the `Place` table before linking the `Review`.
  - **Quantized Bounding Box Cache:** Live Overpass map queries round bounding-box coordinates to ~100m grid precision (3 decimal places) with an in-memory LRU cache to prevent redundant external API hits.

### City
- **Definition:** The geographical boundary containing places and serving as the destination for a trip.
- **Key Attributes:** `id`, `name`, `country`, `latitude`, `longitude`.

### PlaceCategory
- **Definition:** Fixed taxonomy of places used for filtering and generator constraints (`RESTAURANT`, `MUSEUM`, `MONUMENT`, `PARK`, `CAFE`, `BAR`, `OTHER`).

---

## 2. Reviews & Reputation

### Review
- **Definition:** User-authored evaluation of an experience at a specific `Place`.
- **Key Attributes:** `id`, `userId`, `placeId`, `rating` (integer 1..5), `text`, `createdAt`, `updatedAt`.
- **Lifecycle & Rules:**
  - Posting a review triggers the policy: **Mark place as visited** and **Recalculate place averageRating**.
  - Editing or deleting a review triggers recalculation of `averageRating`.
  - Deleting a review does **not** delete the corresponding `Visit`.

### Visit
- **Definition:** Record confirming that a user has physically or personally visited a `Place`.
- **Key Attributes:** `userId`, `placeId`, `visitedAt`.
- **Invariants:**
  - One unique entry per `(User, Place)` pair.
  - In MVP, created strictly via the policy triggered when a user submits a `Review` (no standalone "mark visited" button).
  - Survives review deletion.

---

## 3. Saved Places & Lists

### SavedPlace
- **Definition:** A direct relation linking a `User` to a `Place`, categorized by intent.
- **Key Attributes:** `id`, `userId`, `placeId`, `type` (`WISHLIST` | `BOOKMARK`), `savedAt`.
- **Distinctions:**
  - **`WISHLIST`**: Expresses explicit user intent to visit the place soon. Feeds the `ItineraryGenerator` as high-priority candidate stops.
  - **`BOOKMARK`**: Generic bookmark ("remember this for later"). Does not automatically influence generator scoring.

### SavedList (Custom List)
- **Definition:** An independent, user-defined named collection of places (e.g., "Best Bakeries in Porto", "Architecture Tour").
- **Key Attributes:** `id`, `userId`, `name`, `createdAt`.
- **ListEntry:**
  - Join entity linking `SavedList` to `Place` with `addedAt`.
  - **Decoupling Rule:** `SavedList` references `Place` directly, not `SavedPlace`. Adding/removing bookmarks does **not** affect items in custom lists, and vice-versa.

---

## 4. Trips & Itineraries

### Trip
- **Definition:** A planning aggregate representing a planned travel experience to a specific destination `City`.
- **Key Attributes:** `id`, `userId`, `cityId`, `name`, `createdAt`.
- **Associations:** Owns `1 TripConstraints`, `* Day`s, and `0..1 Itinerary`.

### TripConstraints (Value Object)
- **Definition:** The parameters that bound and shape a trip plan.
- **Attributes:** `startDate`, `endDate`, `budgetLevel` (`€` | `€€` | `€€€`), `allowedCategories` (Set of PlaceCategory).
- **Rules:**
  - Modifying `startDate` or `endDate` triggers `syncDays()` on the `Trip`.

### Day
- **Definition:** A single calendar day within a `Trip`, owned by the trip.
- **Attributes:** `id`, `tripId`, `dayNumber` (1-based index: 1, 2, ... N), `date` (YYYY-MM-DD).
- **Invariants & Cascade:**
  - The number of days strictly equals `(endDate - startDate) + 1`.
  - If a trip is shortened, truncated `Day`s are deleted along with all their scheduled `ItineraryStop`s.

### Itinerary
- **Definition:** The concrete schedule of visits for a `Trip`.
- **Key Attributes:** `id`, `tripId`, `mode` (`MANUAL` | `GENERATED`), `createdAt`.
- **Cardinality:** Exactly `0..1` per `Trip` in the MVP.
- **Behavior:**
  - A generated itinerary populates `ItineraryStop`s.
  - Once generated, the itinerary is freely editable (stops can be moved, deleted, or added manually).

### ItineraryStop
- **Definition:** A planned visit to a `Place` assigned to a specific `Day` in an `Itinerary`.
- **Key Attributes:** `id`, `itineraryId`, `dayId`, `placeId`, `visitTime` (HH:mm, optional), `position` (integer order within the day), `reminderSent` (boolean).
- **Rules:**
  - A stop calculates `isOutsideOpeningHours()` against `Place.openingHours` when `visitTime` is specified.
  - Straight-line travel time is computed between consecutive stops on the same `Day`.

---

## 5. Calculations, Cost Points & Budgets

### Cost Points Scale
Places map to numeric **cost points** for algorithmic evaluation:
- `FREE` = 0 points (parks, viewpoints, public monuments imported with `fee=no` from OpenStreetMap)
- `€` = 1 point (budget / inexpensive)
- `€€` = 2 points (moderate)
- `€€€` = 3 points (expensive)
- `UNKNOWN` = unreviewed place without fee tags (treated as neutral in averages; not penalized)

### Target Average Budget Heuristic (Soft Filter)
The trip's `budgetLevel` acts as a **target average cost point** for each planned day:
- A `€` budget trip targets a daily average of **$\le 1.0$**.
- A `€€` budget trip targets a daily average of **$\le 2.0$**.
- A `€€€` budget trip targets a daily average of **$\le 3.0$**.

### Generator Rules with Cost Points:
1. **Wishlist Priority:** Wishlist places are inserted first, count toward the day's average, and remaining stops adapt around them.
2. **Compensation:** Free places (0 cost points) pull the day's average down, allowing higher-rated `€€` or `€€€` stops (e.g. a nice dinner) while keeping the daily average within the budget tier.
3. **Soft Degradation / Fallback:** If a day cannot meet the strict budget target because the city lacks cheaper options, the generator selects the closest fit rather than leaving an empty slot.
