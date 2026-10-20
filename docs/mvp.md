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

Each feature lists what the user can do, where it appears in the
[EventStorming](design/eventstorming.png), and when we plan to build it.
Planned iterations are targets and are re-planned at each sprint planning.

### Accounts

| ID | Feature | The user can… | EventStorming | Iteration |
|---|---|---|---|---|
| A1 | Register and log in | Create an account, log in and log out | Register user | 1 |

### Places and discovery

| ID | Feature | The user can… | EventStorming | Iteration |
|---|---|---|---|---|
| B1 | Place import | (Admin) import places for the MVP cities from OpenStreetMap | Import places, Add place to catalog | 1 |
| B2 | Demo data | (Team) load demo users and sample reviews so rankings work from day one | none (seed script) | 1, extended in 2 |
| B3 | City search and filters | Search a city, browse its places, filter by type, price level and rating, sort by rating | City search results | 1 basic, 2 filters |
| B4 | Place page | See details, opening hours (or "unknown"), rating, price level and reviews | Place detail | 1 |
| B5 | Map view | See a city's places as pins on a map, with clustering | none (UI) | 2 |
| B6 | Top-rated places | See the top-rated places per city and type | Top-rated places, Update top-rated places | 2 |

### Reviews

| ID | Feature | The user can… | EventStorming | Iteration |
|---|---|---|---|---|
| C1 | Post a review | Rate 1 to 5, write text, say how expensive it was (€ / €€ / €€€). The place is marked as visited and its rating updates | Post review, Mark place visited, Recalculate rating | 1 |
| C2 | Edit and delete a review | Change or remove own review; rating and top-rated update | Edit review, Delete review | 2 |
| C3 | Visited places | See a list of the places they have visited | Place marked as visited (view) | 2 |

### Saved places and lists

| ID | Feature | The user can… | EventStorming | Iteration |
|---|---|---|---|---|
| D1 | Wishlist and bookmarks | Add and remove places on the wishlist ("I want to go") or bookmarks ("remember this") | Wishlist place, Bookmark place, Delete wishlisted place, Delete bookmarked place | 2 |
| D2 | Custom lists | Create, rename and delete lists in the bookmarks section; add and remove places. A place can be in several lists | New: Create list, Rename list, Delete list, Add place to list, Remove place from list | 4 |

### Trips and itineraries

| ID | Feature | The user can… | EventStorming | Iteration |
|---|---|---|---|---|
| E1 | Create a trip | Choose a city, dates, budget level (€ / €€ / €€€, the target average price for the whole trip) and preferred types; days are created from the dates | Create trip, Add days | 2 |
| E2 | Change a trip | Edit the constraints; days are added or removed to match | Change trip constraints, Add days, Remove days, Remove day's places | 3 |
| E3 | Delete a trip | Delete a trip with its days, itinerary and stops | Delete trip, Delete itinerary | 3 |
| E4 | Manual itinerary | Create an itinerary, assign places to days, remove them, set visit times | Create itinerary, Assign place, Remove place, Set visit time | 3 |
| E5 | Nearby suggestions | While planning a stop, see the best-ranked places nearby (for example lunch after a landmark) | Nearby places (view) | 3 |
| E6 | Plan warnings | Get a warning when a visit time is outside the place's opening hours (only where hours are known), and see the trip's average price level next to the budget level, with a warning when it is above | none (rule) | 3 |
| E7 | Travel-time estimate | See "≈ N min walk" between consecutive stops, estimated from straight-line distance | none (rule) | 4 |
| E8 | Basic generator | Press "Generate itinerary": per day, top-rated places of the chosen types, grouped by distance, with a lunch place near the morning stop. It keeps the trip's average price at or near the budget level (see section 4) and always includes the user's wishlist places. The result can be edited like a manual one | Generate itinerary | 3, tuned in 4 |

### Platform

| ID | Feature | Detail | Iteration |
|---|---|---|---|
| P1 | Web app, no installation | Works in current desktop and mobile browsers, layout usable down to phone width | 1 onward |
| P2 | Dev and prod environments | Separate servers; changes go to dev first and reach prod at each sprint review | 1 |
| P3 | Attribution | "© OpenStreetMap contributors" visible on the map and wherever place data is shown | 1, 2 |

## 3. Not in the MVP

Everything marked Stretch or Dream in the [vision](vision.md). The designs
already cover some of it (suggestions and moderation, publishing and sharing,
reminders), but it is **not built** in the MVP.

If there is time left, the Stretch ideas we would take first, in this order:

1. Smart generator (opening hours, real travel times, finer budget balancing)
2. Real travel times from a routing service
3. Photos for landmarks
4. Publish and share itineraries
5. Visit reminders
6. Other conflict warnings, drag and drop, alternatives per stop

## 4. Data for the MVP

- **Cities:** a small number of cities, so that every city has enough places and
  demo reviews to rank well. The cities are still to be chosen (see open questions).
- **Places:** imported from OpenStreetMap once, by a script, and stored in our own
  database. The app never calls OpenStreetMap live for place data.
- **Opening hours:** taken from OpenStreetMap where mapped. Where they are missing
  the app says "unknown" and cannot warn.
- **Ratings and price levels:** OpenStreetMap has none, so they come from reviews.
  A seed script creates demo users and sample reviews, marked as demo data.
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

## 6. Demo scenario

The MVP is shown, at each sprint review from Iteration 2 on and at the final
release, with this scenario on the prod server:

1. Register and log in.
2. Search a city, filter restaurants by price level, open the map and a place page.
3. Post a review with a price level; see the rating and top-rated list change and
   the place appear in "visited".
4. Add a place to the wishlist and to a custom list.
5. Create a 3-day trip with a budget level and preferred types.
6. Generate an itinerary, then edit it: move a place, set a visit time outside
   opening hours and see the warning, check the travel-time estimates and the
   trip's average price against the budget level.
7. Change the trip dates and see the days update.
8. Delete the trip.

## 7. When is the MVP done?

When every feature in section 2 meets the [Definition of Done](definition-of-done.md)
and the demo scenario in section 6 runs on the prod server.
