# Domain Glossary (Ubiquitous Language)

Group 7 · MESW LES 2026-27

This glossary defines the canonical ubiquitous language for the place review and itinerary planning platform. All code, database schemas (`schema.prisma`), API endpoints, and team communications must strictly adhere to these definitions. The names match the [EventStorming board and domain model](design.md). Items marked _post-MVP_ are designed but not built in the MVP (see [mvp.md](mvp.md)).

---

## 1. Place Catalog & Discovery

### Place

- **Definition:** A physical location or establishment of interest (restaurant, museum, monument, park) loaded from OpenStreetMap by the import and seed scripts, discovered live on the map and saved when first reviewed (Stretch, built in the tracer bullet), or suggested by users (post-MVP, Dream).
- **Key Attributes:** `id`, `osmId`, `name`, `description`, `category` (PlaceCategory), `address`, `latitude`, `longitude`, `openingHours`, `priceLevel` (`FREE` | `€` | `€€` | `€€€`, may be unknown), `averageRating`, `reviewCount`, `source` (`IMPORTED` | `LAZY_OSM` | `SUGGESTED`). Its cost points (0..3) are derived from `priceLevel`.
- **Invariants & Policies:**
  - `averageRating` is a floating-point average [1.0, 5.0] calculated from all associated `Review` records.
  - `priceLevel`: places tagged `fee=no` in OpenStreetMap (parks, viewpoints, public landmarks) are `FREE` (0 cost points). OpenStreetMap has no other price data, so for every other place the `priceLevel` is the most common (mode) price level given in its reviews. A `FREE` place stays `FREE` until at least 2 reviews give a paid price (`PAID_REVIEWS_TO_LEAVE_FREE`, one review is not enough). A place with neither is **unknown**.
  - **A place enters the catalog in one of three ways** (see ADR-002): the _Import places_ command and the seed script (`source = IMPORTED`), on-the-fly saving when a user posts the first review for a place discovered live on the map (Stretch, `source = LAZY_OSM`), or an approved suggestion (post-MVP, `source = SUGGESTED`). In the committed MVP only the first one is used.
  - The place saved on the fly is created inside _Post review_. In the tracer bullet it is always assigned to the city Porto, which is a known limitation.
  - The map and the search call OpenStreetMap live (Stretch) to _discover_ places (see _Live Discovery_ in section 7). A discovered place is not in the catalog, and cannot be rated or planned, until it is saved.

### Import places

- **Definition:** The admin command that loads places from OpenStreetMap into PostgreSQL with `scripts/import-osm.ts`, one MVP city at a time (`npm run import:osm -- porto`, `paris` or `berlin`). A place is saved only if it has a name; its category comes from the OpenStreetMap tags (one mapping for the import, the search box and the live map, anything unknown is `OTHER`); its opening hours are the `opening_hours` tag, or unknown; its price level is `FREE` if the tag says `fee=no` and unknown otherwise, never guessed. If OpenStreetMap does not answer, nothing is saved. The seed script `prisma/seed.ts` creates the cities, their places, the demo users and the sample reviews. Its event is _Places imported_.

### City

- **Definition:** The geographical boundary containing places and serving as the destination for a trip.
- **Key Attributes:** `id`, `name`, `country`, `latitude`, `longitude`.

### PlaceCategory

- **Definition:** Fixed taxonomy of places used for filtering and generator constraints (`RESTAURANT`, `MUSEUM`, `MONUMENT`, `PARK`, `CAFE`, `BAR`, `OTHER`).

---

## 2. Reviews & Reputation

### Review

- **Definition:** User-authored evaluation of an experience at a specific `Place`.
- **Key Attributes:** `id`, `userId`, `placeId`, `rating` (integer 1..5), `priceLevel` (how expensive it was, `FREE` | `€` | `€€` | `€€€`; required when a review is posted; a review written before the form required it may have none), `text`, `createdAt`, `updatedAt`.
- **Lifecycle & Rules:**
  - **A review needs a rating, a price level and a text.** The form has no preselected rating or price level, and Submit stays disabled until the reviewer has chosen both and written at least one character (spaces alone do not count). The endpoint answers 400, naming the fields, and saves nothing when one is missing or invalid.
  - Posting a review triggers two policies on `Place`: **Mark place visited** and **Recalculate rating and price level**.
  - Editing or deleting a review triggers **Recalculate rating and price level**.
  - **A user can review a given place only once.** To change an opinion the user edits the review, and after deleting it can post a new one. Different users can each review the same place.
  - Deleting a review does **not** delete the corresponding `Visit`.

### Visit

- **Definition:** Record confirming that a user has physically or personally visited a `Place`. It belongs to the `Place` aggregate.
- **Key Attributes:** `userId`, `placeId`, `visitedAt`.
- **Invariants:**
  - One unique entry per `(User, Place)` pair.
  - In MVP, created strictly via the policy triggered when a user posts a `Review` (no standalone "mark visited" button).
  - Survives review deletion.

### Rating Score (Weighted Rating)

- **Definition:** The number used to **rank** places, instead of the plain `averageRating`, so that one review cannot outrank many (see ADR-008). It is a Bayesian average: `score = (n / (n + m)) × averageRating + (m / (n + m)) × C`, with `n` = `reviewCount`, `m = 3` and `C = 4.0` (named constants), rounded to 2 decimals.
- **Rules:**
  - A place with no reviews has no score and is ranked after all rated places.
  - Ties are broken by `reviewCount`, then by name.
  - Every list sorted by rating (the ranking, the top-rated list, the sort in search) uses this score. The place still shows its plain `averageRating` and `reviewCount`.
  - The "minimum rating" filter uses the plain `averageRating`.
  - Examples: 1 review of 5 gives 4.25, 3 reviews of 5 give 4.50, 50 reviews averaging 4.8 give 4.75.

---

## 3. Saved Places & Lists

### SavedPlace (aggregate: Saved places)

- **Definition:** A direct relation linking a `User` to a `Place`, categorized by intent.
- **Key Attributes:** `id`, `userId`, `placeId`, `type` (`WISHLIST` | `BOOKMARK`), `savedAt`.
- **Distinctions:**
  - **`WISHLIST`**: Expresses explicit user intent to visit the place soon. Feeds the `ItineraryGenerator` as high-priority candidate stops (the generator reads it, there is no event).
  - **`BOOKMARK`**: Generic bookmark ("remember this for later"). Does not influence generator scoring. Bookmarks are what custom lists are made of.
- **Commands:** _Wishlist place_, _Bookmark place_, _Remove saved place_.

### SavedList (aggregate: List)

- **Definition:** A user-defined named collection of **bookmarked** places (e.g., "Best Bakeries in Porto", "Architecture Tour"). MVP.
- **Key Attributes:** `id`, `userId`, `name`, `createdAt`.
- **ListEntry:**
  - Join entity linking `SavedList` to a `Place` with `addedAt` (in the schema it references `Place`, not `SavedPlace`).
  - **Consistency Rule:** a list only holds bookmarked places. When a bookmark is removed, a policy removes that place from all the user's lists. One place can be in several lists. The application enforces this rule, not the database: in the schema `ListEntry` references `Place`.
- **Commands:** _Create list_, _Change list_ (rename or delete), _Add or remove place_.

---

## 4. Trips & Itineraries

### Trip

- **Definition:** A planning aggregate representing a planned travel experience to a specific destination `City`. `Day` and `Itinerary` are part of it, not separate aggregates.
- **Key Attributes:** `id`, `userId`, `cityId`, `name`, `createdAt`.
- **Associations:** Owns `1 TripConstraints`, `* Day`s, and `0..1 Itinerary`.
- **Commands:** _Create trip_, _Change trip constraints_, _Generate itinerary_, _Edit itinerary_ (assign or remove a place, set a visit time), _Delete trip_. Deleting a trip removes its days, itinerary and assigned places.

### TripConstraints (Value Object)

- **Definition:** The parameters that bound and shape a trip plan.
- **Attributes:** `startDate`, `endDate`, `budgetLevel` (`€` | `€€` | `€€€`), `allowedCategories` (Set of PlaceCategory), `dayStart` and `dayEnd` (HH:mm, the hours of the day).
- **Rules:**
  - `dayStart` and `dayEnd` default to 09:00 and 20:00. `dayStart` is 08:00 or later, `dayEnd` is 23:00 or earlier, and `dayStart` is before `dayEnd`. The generator keeps every stop inside them; manual planning is not restricted.
  - Modifying `startDate` or `endDate` triggers `syncDays()` on the `Trip`. The result is the events _Days added_ or _Days removed_.

### Day

- **Definition:** A single calendar day within a `Trip`, owned by the trip.
- **Attributes:** `id`, `tripId`, `dayNumber` (1-based index: 1, 2, ... N), `date` (YYYY-MM-DD).
- **Invariants & Cascade:**
  - The number of days strictly equals `(endDate - startDate) + 1`.
  - If a trip is shortened, truncated `Day`s are deleted along with all their scheduled `ItineraryStop`s. This happens inside the `Trip` aggregate, it is not a policy.

### Itinerary

- **Definition:** The concrete schedule of visits for a `Trip`.
- **Key Attributes:** `id`, `tripId`, `mode` (`MANUAL` | `GENERATED`), `createdAt`.
- **Cardinality:** Exactly `0..1` per `Trip` in the MVP.
- **Behavior:**
  - _Generate itinerary_ populates `ItineraryStop`s. A manual itinerary is built with _Edit itinerary_.
  - Once generated, the itinerary is freely editable (stops can be moved, deleted, or added manually).

### ItineraryStop

- **Definition:** A planned visit to a `Place` assigned to a specific `Day` in an `Itinerary`.
- **Key Attributes:** `id`, `itineraryId`, `dayId`, `placeId`, `visitTime` (HH:mm, optional), `position` (integer order within the day). The schema also has a `reminderSent` flag, kept as a placeholder until the _Reminder_ aggregate (Stretch) exists.
- **Rules:**
  - A stop calculates `isOutsideOpeningHours()` against `Place.openingHours` when `visitTime` is specified, and the plan raises a _Plan warning_ when it is outside (only where hours are known).
  - Straight-line travel time is computed between consecutive stops on the same `Day`.

---

## 5. Calculations, Cost Points & Budgets

### Cost Points Scale

Places map to numeric **cost points** for algorithmic evaluation:

- `FREE` = 0 points (parks, viewpoints, public monuments tagged `fee=no` in OpenStreetMap)
- `€` = 1 point (budget / inexpensive)
- `€€` = 2 points (moderate)
- `€€€` = 3 points (expensive)
- **Unknown** = no `fee=no` tag and no price in reviews. It is shown as "price unknown" and **not counted** in any average.

### Target Average Budget Heuristic (Soft Filter)

The trip's `budgetLevel` is a **soft target for the average cost points of the whole trip**. It is not a limit per day or per place, and it is not an amount in euros:

- A `€` budget trip targets an average of about **1.0**.
- A `€€` budget trip targets an average of about **2.0**.
- A `€€€` budget trip targets an average of about **3.0**.
- The trip's average is the mean of the cost points of its stops that have a known price. The planner shows it next to the budget level and warns when it is above.

### Generator Rules with Cost Points:

1. **Wishlist Priority:** Wishlist places are always included, count toward the trip's average, and the remaining stops adapt around them.
2. **Compensation:** Free places (0 cost points) pull the trip's average down, allowing higher-rated `€€` or `€€€` stops (e.g. a nice dinner) while keeping the average near the budget level.
3. **Soft Degradation / Fallback:** If the trip cannot meet the target because the city lacks cheaper options, the generator selects the closest fit rather than leaving an empty slot, and the plan shows the average as a warning.
4. **Hours of the Day and Opening Hours:** Every generated stop gets a visit time inside the trip's `dayStart` and `dayEnd`. A place whose `openingHours` are known is never given a time when it is closed; a place with unknown hours can be given any time.

---

## 6. Map & Spatial Performance

### Spatial Grid Clustering

- **Definition:** An $O(N)$ client-side aggregation algorithm that discretizes coordinates into a dynamic geographical grid based on map zoom levels ($<14$).
- **Behavior:**
  - When `zoom < 14`, proximal places within the same grid cell are collapsed into a single `MapClusterMarker` showing the count of places and bounding center.
  - Clicking a cluster zooms the map directly into its constituent coordinates.
  - At `zoom >= 14`, clustering is disabled to allow individual inspection of places.

### Viewport Culling & Canvas Rendering

- **Definition:** Performance optimization reducing DOM overhead for hundreds of geographic points.
- **Behavior:** Only places lying within the active map viewport (with a 15% safety buffer) are mounted to Leaflet, rendered using HTML5 Canvas (`preferCanvas={true}`) for smooth 60fps panning and zooming.

---

## 7. Search & Symbolic Representation

### Catalog Search (MVP)

- **Definition:** Searching a city, browsing its places, filtering by type, price level and rating, and sorting by rating. It runs on our own PostgreSQL data only.
- **Behavior:**
  - **City search:** typing part of a city name filters the city buttons, ignoring case and accents (`ß` is read as `ss`), with a message when no city matches. Choosing a city lists only its places and flies the map to zoom 13, so the whole city is in view.
  - **Place search:** a place matches when its name or address contains the text, with the same rule (case, accents, `ß`). The list, the map pins and the search popup use the same rule.
  - **Choosing a place in the search popup** does not open the review dialog: the map flies to the place (zoom 16) and its name fills the search box. Its pin stays visible whatever the filters say, until the user types again, chooses another place or city, or rates it. Rating stays reachable from the pin.
  - **Filters and order:** type, price level and minimum rating combine with AND. The list is always sorted by rating score (there is no sort control yet) and shows the places inside the visible map area.

### Place Page (MVP)

- **Definition:** The page `/places/[id]` of a place of the catalog: name, type, address with city and country, description (or a placeholder), average rating, number of reviews, price level (or "Price unknown") and its reviews, newest first, with author, rating, date, price level and text. A place without reviews says "No reviews yet" and offers "Write the first review". An unknown id shows a not-found page. The opening hours are not shown yet.
- **Behavior:** the names in the ranking table and the cards link to it. A place discovered live and not yet saved has no page, so it is not linked. The OpenStreetMap attribution is shown on the page.

### Live Discovery (Stretch, built in the tracer bullet)

- **Definition:** Showing OpenStreetMap places that are not in the catalog yet. When the map moves, the app asks the Overpass service for the places inside the visible area (small areas only, at most 40 places, cached for 15 minutes, with three mirrors as failover). If OpenStreetMap does not answer, the map shows the places already in PostgreSQL. Discovered places show the community rating when the place is already in the catalog.
- **Behavior:** a discovered place is saved to the catalog (`source = LAZY_OSM`) when a user posts the first review for it (see ADR-002).

### Search Outside the Catalog (built in the tracer bullet, outside the committed MVP)

- **Definition:** Geocoding search that queries OpenStreetMap's Nominatim service for places not in our catalog (see ADR-004).
- **Behavior:**
  - Runs only when the user submits the search, never while typing, because the Nominatim usage policy forbids autocomplete. At most 1 request per second for the whole app, cached, with an identifying `User-Agent`.
  - Shows results in two groups: the local catalog and what was found on OpenStreetMap.
  - A place found this way is saved to the catalog when it is first reviewed, like any discovered place.
  - Choosing an OpenStreetMap result focuses the place on the map and adds it to the list, like a place of the catalog, instead of opening the review dialog.

### Honest Symbolic Category Representation & Ranking DataTable

- **Definition:** Visual identity and ranking architecture ensuring zero misleading visuals by replacing external stock photography with canonical Lucide symbols and a rating-ordered ranking DataTable.
- **Behavior:**
  - Categorical metadata defined in `src/domain/catalog/categories.ts` assigns dedicated icons, pastel backgrounds, and labels to every `PlaceCategory`.
  - Places are presented in a Letterboxd/TripAdvisor-style ranking table ordered by rating score (the weighted rating, see _Rating Score_ and ADR-008) descending, with direct toggles to symbolic card grid views.
  - Landmark photos from Wikimedia Commons are Stretch, photos uploaded with reviews are Dream.

---

## 8. Post-MVP Terms

### PlaceSuggestion (Dream)

- **Definition:** A place proposed by a user and not yet in the catalog. Its own aggregate, _Place suggestion_.
- **Key Attributes:** `id`, proposed name, category and address, `status` (`PENDING` | `APPROVED` | `REJECTED`), `suggestedAt`, `decidedAt`.
- **Policy:** whenever a suggestion is approved, the place is added to the catalog (`source = SUGGESTED`).

### Moderator (Dream)

- **Definition:** A `User` with the `ADMIN` role who approves or rejects place suggestions.

### PublishedItinerary and ItineraryBookmark (Stretch)

- **Definition:** A published itinerary is a **copy** of a trip's itinerary that can be shared with a link (`shareToken`), so it survives the deletion of the original trip. An `ItineraryBookmark` is another user's bookmark of it. Aggregate: _Published itinerary_.

### Reminder (Stretch)

- **Definition:** A visit reminder sent for an `ItineraryStop`. Its own aggregate, _Reminder_, created by the policy "when a visit time is near, send a reminder". It will replace the `reminderSent` flag on the stop, which stays in the schema until then.

---

## 9. EventStorming Vocabulary

- **Event:** the state of one domain object has changed (orange). Named in the past tense, e.g. _Review posted_.
- **Command:** an intent to change the state of the system (blue), e.g. _Post review_. Not every event has a command of its own.
- **Policy:** a business rule that links one aggregate to another: "whenever this event happens, do this command" (purple).
- **Aggregate:** a cluster of objects that change together, with one root. The aggregates are User, Trip, Place, Review, Saved places, List, Published itinerary, Reminder and Place suggestion.
- **Read model / query:** something the user sees that is not an event, for example _top-rated places_.

---

## 10. Identity & Access (ADR-009)

### User

- **Definition:** A person with an account.
- **Key Attributes:** `id`, `username` (3 to 30 characters, letters, numbers, underscores and dots; stored in lower case and unique), `displayUsername` (what the person typed, shown in the app), `email` (stored in lower case and unique), `role` (`USER` | `ADMIN`), `registeredAt`. The table also has `name` (always the username) and `emailVerified` (always false in the MVP), which the authentication library needs.
- **Rules:** a user can only change their own data. A `role` cannot be set by the user.

### Registration

- **Definition:** The command that creates an account and logs the person in (`POST /api/register`). Its event is _User registered_.
- **Rules:** the password has 8 to 128 characters and is never trimmed; the e-mail must look like an e-mail (it is not verified); every wrong field gets its own message; a taken username or e-mail is named, and all taken fields are reported together; only the site's own pages may call it (JSON body, same `Origin`); at most 20 well-formed attempts per 10 minutes per address.
- **Out of scope:** e-mail verification, password reset, social login, two-factor authentication.

### Account and Session

- **Definition:** The authentication library keeps two kinds of rows that are not part of the domain model. An _Account_ holds the password of a user as a salted scrypt hash (`providerId` `credential`). A _Session_ is a login: a random token valid for 7 days, stored in the database, sent to the browser in an `HttpOnly` cookie, and ended by logging out.
- **Rules:** the current user is the one the session belongs to, and the guard of every write endpoint reads it from the session, never from the request body. Signing in is limited to 3 attempts by e-mail per 10 seconds. A wrong password and an unknown user get the same answer.
