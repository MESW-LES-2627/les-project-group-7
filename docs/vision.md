# Vision

Group 7 · MESW LES 2026-27 · Iteration 0

This is the **maximum vision**: everything we would like the product to be if time
and budget were unlimited. Most of it will not be built. The part we commit to is
in the [MVP](mvp.md). Each idea is tagged:

- **MVP**: committed for the semester, see [mvp.md](mvp.md).
- **Stretch**: realistic if the MVP goes well.
- **Dream**: the "wildest dreams" list. Not planned.

---

## 1. Vision statement

> For travellers who want to spend their time in a city on the places that are
> actually worth it, the app is a **place review and ranking platform that turns
> the community's reviews into a ready-to-use, day-by-day trip plan**. Unlike
> review sites that stop at a ranked list, and planners that ignore what people
> think of a place, our rankings feed the plan directly.

## 2. The problem

- Finding the best places in a city means reading many sites and comparing
  conflicting opinions.
- Turning a list of places into a realistic plan (what first, what is nearby,
  where to have lunch, what is open, what fits the budget) is manual and slow.
- Review sites and trip planners are separate tools, so the reviews never help to
  build the plan.

## 3. Who it is for

| User | What they want |
|---|---|
| **Planner** (main user) | Tell the app a city, a number of days and a budget, and get a good plan they can adjust |
| **Explorer / reviewer** | Keep a diary of places visited, rate them, save places for later |
| **Curator** (admin) | Keep the place catalog accurate and the content trustworthy |

## 4. Principles

1. **Rankings drive plans.** Reviews are not decoration, they decide what the
   generator suggests.
2. **The user stays in control.** A generated plan is a starting point that can be
   edited freely.
3. **Plans respect reality.** Opening hours, distances and budget shape the plan.
4. **Trustworthy reviews.** Ratings should be hard to game and clearly tied to
   people who went there.
5. **Zero friction.** Works in the browser, no installation.

## 5. Where the data comes from

- **Places** are imported from OpenStreetMap: name, type, coordinates and, where
  mapped, opening hours. We show "© OpenStreetMap contributors".
- **Ratings, reviews and price levels** are ours. OpenStreetMap has no ratings,
  and almost no price information, so the community fills that gap. Until real
  reviews arrive, demo users and sample reviews keep the rankings meaningful.
- **Photos** are not part of OpenStreetMap. Landmarks can borrow a photo from
  Wikimedia Commons later; everything else shows an icon.

---

## 6. Feature themes

### 6.1 Discover and rank places

| Idea | Tier |
|---|---|
| Search a city and browse its places | MVP |
| Filter by type (restaurant, museum, monument, garden), price level and rating | MVP |
| Top-rated places per city and per type | MVP |
| Place detail page with description, address, rating and reviews | MVP |
| **Map view with pins and clustering** | MVP |
| **Opening hours shown on the place page** (when known) | MVP |
| Photos for places (landmarks from Wikimedia Commons, icon otherwise) | Stretch |
| Ticket prices where OpenStreetMap has them | Stretch |
| Ratings split by aspect (food, service, value, atmosphere) | Dream |
| Multi-language place descriptions | Dream |
| "Hidden gems": good ratings but few visitors | Dream |

### 6.2 Reviews and reputation

| Idea | Tier |
|---|---|
| Write, edit and delete a review with a 1 to 5 rating | MVP |
| Reviewer says how expensive the place was (€ / €€ / €€€), which gives the place its price level | MVP |
| Place rating and top-rated list recalculated from reviews | MVP |
| Posting a review marks the place as visited | MVP |
| "Helpful" votes and sorting by most helpful | Stretch |
| Review photos | Dream |
| Reviewer badges and levels | Dream |
| Spam and fake-review detection | Dream |
| Owner replies to reviews | Dream |

### 6.3 My places

| Idea | Tier |
|---|---|
| Wishlist ("I want to go there") and bookmarks ("remember this") | MVP |
| Visited places diary | MVP |
| Custom lists inside bookmarks: user-made named collections such as "Best cafés in Lisbon" | MVP |
| Personal stats (places per city and type) and a map of everywhere I have been | Stretch |

### 6.4 Trip planning

| Idea | Tier |
|---|---|
| Create a trip with city, dates, budget level and preferred place types | MVP |
| Days created automatically from the dates and kept in sync when they change | MVP |
| Build an itinerary manually: assign places to days, set visit times | MVP |
| **Basic itinerary generator**: per day, top-rated places of the chosen types, grouped by distance, with a lunch place near the morning stop | MVP |
| Suggest the best-ranked places nearby (for example lunch after the Eiffel Tower) | MVP |
| Warn when a planned visit time is outside the place's opening hours | MVP |
| Estimated travel time between stops ("≈ 12 min walk", from straight-line distance) | MVP |
| **Smart generator**: also uses opening hours, travel times, budget and the wishlist | Stretch |
| Real walking and driving times from a routing service | Stretch |
| Other conflict warnings (overlapping visits, too much walking) | Stretch |
| Drag and drop reordering | Stretch |
| Alternatives per stop ("swap this restaurant") | Stretch |
| Multi-city trips | Stretch |
| Public transit travel times | Dream |
| Weather-aware plans (indoor places on rainy days) | Dream |
| Real-time re-planning during the trip | Dream |
| Budget tracking with real expenses | Dream |

### 6.5 Sharing and community

| Idea | Tier |
|---|---|
| Publish an itinerary and share it with a link | Stretch |
| Bookmark other users' published itineraries | Stretch |
| Copy a published itinerary into my own trip | Stretch |
| Follow users and see their reviews | Dream |
| Collaborative trips with friends, with voting on places | Dream |
| Comments on itineraries | Dream |

### 6.6 Catalog and moderation

| Idea | Tier |
|---|---|
| Import places from OpenStreetMap | MVP |
| Demo users and sample reviews so rankings work from day one | MVP |
| Users suggest places, moderators approve or reject | Dream |
| Duplicate detection and merging | Dream |
| Business owners claim and edit their place | Dream |
| Community editing of place details | Dream |

### 6.7 Notifications

| Idea | Tier |
|---|---|
| Visit reminders before a planned visit | Stretch |
| Trip summary e-mail | Stretch |
| Push notifications on mobile | Stretch |

### 6.8 Platform

| Idea | Tier |
|---|---|
| Web app, responsive, no installation | MVP |
| Separate dev and prod environments | MVP |
| Export an itinerary to PDF or calendar | Stretch |
| Installable web app (PWA) with offline itinerary | Stretch |
| Native mobile apps | Dream |
| Public API | Dream |
| Booking and ticket integrations | Dream |
| AI assistant: "plan me a romantic weekend in Porto under 300 euros" | Dream |
| Multi-language interface | Dream |

---

## 7. Boundaries

Even in the dream version, the app is **not** a booking engine, a payment
platform or a general social network. Those would pull the product away from its
core: *trustworthy rankings that build good plans*.

## 8. What success looks like

- A planner can go from "3 days in Lisbon, mid budget" to a plan they are happy
  with in **under five minutes**.
- Reviews visibly change what the app recommends.
- A teacher can open the URL, create an account and try the whole flow without
  installing anything.
