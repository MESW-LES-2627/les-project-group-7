# User stories

Group 7 · MESW LES 2026-27

One user story (an **epic**) for every feature in [mvp.md](mvp.md), and one for every
Stretch idea. They follow the [user story template](../.github/ISSUE_TEMPLATE/user-story.yml),
and the **Issues** under each MVP story follow the
[issue template](../.github/ISSUE_TEMPLATE/issue.yml). How a story becomes work is in
[templates/README.md](templates/README.md).

This file is the draft that the GitHub issues are created from. Once the issues exist,
**the issue is the source of truth** and this file is only the overview.

## How to read this file

- **Story ID** is `US-<feature>-<nn>`. The feature is the ID in [mvp.md](mvp.md)
  (`A1`, `E4`, ...). Stretch features have IDs `S1` to `S19`, also in
  [mvp.md](mvp.md).
- Nothing is built yet. The first prototype (the tracer bullet) does not count: every
  story is open and its issues cover the whole story. Where the prototype has code worth
  reusing, or a known problem to fix, the story's **Notes** say so.
- Acceptance criteria (**AC**) are numbered and every one can be checked by a person on
  the dev server. Issues refer to these numbers.
- **Business rules** are the rules that need automated unit tests (Definition of Done).
- MVP stories list their **Issues**. Stretch stories do not: they are split into issues
  only when the team decides to take them.
- Priority, size, estimate and iteration are fields on the board. They are not written here.

## Roles

| Role                | Who                                        |
| ------------------- | ------------------------------------------ |
| Planner             | Plans a trip to a city                     |
| Explorer / reviewer | Browses, rates and saves places            |
| Curator (admin)     | Keeps the place catalog loaded and correct |

## Overview

| Feature                      | Stories            |
| ---------------------------- | ------------------ |
| A1 Register and log in       | US-A1-01, US-A1-02 |
| B1 Place import              | US-B1-01           |
| B2 Demo data                 | US-B2-01           |
| B3 City search and filters   | US-B3-01, US-B3-02 |
| B4 Place page                | US-B4-01           |
| B5 Map view                  | US-B5-01           |
| B6 Top-rated places          | US-B6-01           |
| C1 Post a review             | US-C1-01           |
| C2 Edit and delete a review  | US-C2-01           |
| C3 Visited places            | US-C3-01           |
| D1 Wishlist and bookmarks    | US-D1-01           |
| D2 Custom lists              | US-D2-01, US-D2-02 |
| E1 Create a trip             | US-E1-01           |
| E2 Change a trip             | US-E2-01           |
| E3 Delete a trip             | US-E3-01           |
| E4 Manual itinerary          | US-E4-01           |
| E5 Nearby suggestions        | US-E5-01           |
| E6 Plan warnings             | US-E6-01, US-E6-02 |
| E7 Travel-time estimate      | US-E7-01           |
| E8 Basic generator           | US-E8-01           |
| P1 Web app, no installation  | US-P1-01           |
| P2 Dev and prod environments | US-P2-01           |
| P3 Attribution               | US-P3-01           |
| S1 to S19 Stretch            | 21 stories         |

---

# MVP stories

## A1 Register and log in

### US-A1-01 Register

- **MVP feature:** A1 Register and log in
- **As a:** Explorer / reviewer

**I want** to create an account with a username, an e-mail and a password,

**So that** my reviews, saved places and trips belong to me.

**Acceptance criteria**

1. **Given** I have no account, **when** I send a valid username, e-mail and password, **then** the account is created and I am logged in.
2. **Given** a username or an e-mail is already taken, **when** I register with it, **then** I see which field is taken and no account is created.
3. **Given** the username is empty, the e-mail is not an e-mail, or the password is shorter than 8 characters, **when** I send the form, **then** I see an error under each wrong field and nothing is saved.

**Business rules**

- The password is stored only as a salted hash, never as plain text, and never returned by any endpoint.
- Username and e-mail are unique; the e-mail is compared in lower case.
- Password minimum length is 8 characters. Username 3 to 30 characters.
- The checks run on the server. The form checks are only a convenience.

**Out of scope**

- E-mail verification, password reset, "remember me". Not in the MVP.

**Notes**

- Open question for the team: which library handles sessions (Auth.js or a small own implementation). Decide in the first issue.
- `User.passwordHash` already exists in the schema.

**Issues**

1. **Registration API** · covers AC1, AC2, AC3 · depends on: none
   - Validation and unit tests for the rules above (username, e-mail, password)
   - Password hashing helper
   - `POST` endpoint that creates the user and starts a session
2. **Registration page** · covers AC1, AC2, AC3 · depends on: Registration API
   - Form with field errors from the API

### US-A1-02 Log in and log out

- **MVP feature:** A1 Register and log in
- **As a:** Explorer / reviewer

**I want** to log in with my e-mail or username and my password, and log out,

**So that** only I can change my data.

**Acceptance criteria**

1. **Given** I have an account, **when** I log in with the right credentials, **then** I am logged in and the page shows my username.
2. **Given** I enter a wrong password or an unknown user, **when** I log in, **then** I see the same generic error in both cases.
3. **Given** I am logged in, **when** I log out, **then** the session ends and the page shows the log in button.
4. **Given** I am not logged in, **when** I try any action that writes data (post a review, save a place, create a trip), **then** I am asked to log in and nothing is saved.
5. **Given** I am logged in as a user, **when** I try to change another user's review, list or trip, **then** the server refuses.

**Business rules**

- Every write endpoint requires a session on the server, and the user id always comes from the session, never from the request body.
- The login error does not say whether the user exists.
- A user can only change their own data.

**Out of scope**

- Social login, two-factor authentication.

**Notes**

- The current demo user bar must go away. The seed users have a fake hash (`hash_demo_12345`), so they cannot log in. The seed must create them with a real hash (see US-B2-01).
- The reviews endpoint today takes the user id from the request body, and creates the demo users on the fly. Both must change.

**Issues**

1. **Session and write-endpoint guard** · covers AC4, AC5 · depends on: Registration API
   - Session creation and reading on the server
   - Helper that returns the current user or 401
   - Move the reviews endpoint to the session user and remove the on-the-fly demo user creation
   - Unit tests for the ownership rule
2. **Login and logout API and UI** · covers AC1, AC2, AC3 · depends on: Session and write-endpoint guard
   - Login and logout endpoints
   - Login page, username in the header, log out button
   - Replace the demo user bar

## B1 Place import

### US-B1-01 Import places from OpenStreetMap

- **MVP feature:** B1 Place import
- **As a:** Curator (admin)

**I want** to run an import script that loads a city's places from OpenStreetMap into the database,

**So that** every MVP city has a catalog without typing places by hand.

**Acceptance criteria**

1. **Given** a city exists in the database, **when** I run the import for it, **then** its places are saved with name, category, coordinates and address, and with the opening hours where OpenStreetMap has them.
2. **Given** I run the import a second time, **when** it finishes, **then** no place is duplicated (same OpenStreetMap id).
3. **Given** OpenStreetMap does not answer, **when** the import runs, **then** it prints a clear error and the places already in the database are unchanged.
4. **Given** the import finished, **when** I look at the places, **then** each one has a category from the app's list and places without a name are not saved.
5. **Given** the import finished, **when** I look at the price levels, **then** a place has `FREE` only if OpenStreetMap says `fee=no`, and every other place has no price level (unknown) until a review gives one.

**Business rules**

- The OpenStreetMap tags map to one `PlaceCategory`; anything unknown becomes `OTHER`.
- `fee=no` gives price level `FREE`. Every other place has no price level until a review gives one. The import never guesses a price level, for example from the category.
- OpenStreetMap id is unique per place.
- Rate limit of the services is respected (1 request per second to Nominatim).

**Out of scope**

- Live discovery on the map (S19), suggestions by users (Dream).

**Notes**

- Decision: a place is `FREE` only when OpenStreetMap says `fee=no`; otherwise its price level comes only from reviews. This is what [mvp.md](mvp.md) section 4 and the glossary already say.
- The prototype breaks it twice: the import script (`inferPriceLevel`) guesses a level from the category, and the curated Porto file (`prisma/data/porto-places.json`) has a level for all 501 places (241 `FREE`, 166 `€`, 94 `€€`), also guessed from the category. Both must stop, and the price levels already in the dev and prod databases must be cleaned (prod needs the team's approval).
- Opening hours are not read by the current script.

**Issues**

1. **Import the three MVP cities** · covers AC1, AC2, AC3, AC4, AC5 · depends on: none
   - Make the city a parameter of the script
   - Read opening hours and the `fee` tag from OpenStreetMap
   - Remove the guessed price level: only `fee=no` gives `FREE`, all others stay unknown
   - Remove the price levels from the curated Porto file and clean the databases
   - Unit tests for the tag-to-category and `fee=no` rules

## B2 Demo data

### US-B2-01 Load demo data

- **MVP feature:** B2 Demo data
- **As a:** Curator (admin)

**I want** one command that loads the cities, demo users and sample reviews,

**So that** the rankings work on dev and prod from day one.

**Acceptance criteria**

1. **Given** an empty migrated database, **when** I run the seed, **then** the three cities exist (Porto, Paris and Berlin).
2. **Given** the seed finished, **when** I open the ranking of any city, **then** it shows places with ratings, and the ratings match the sample reviews.
3. **Given** the seed finished, **when** I log in with a demo user and its documented password, **then** I am logged in.
4. **Given** I run the seed twice, **when** it finishes, **then** nothing is duplicated.

**Business rules**

- Each place's `averageRating`, `reviewCount` and `priceLevel` are calculated from its reviews with the same functions the app uses.
- Seed passwords are hashed with the same helper as registration.
- No user reviews the same place twice (the rule of US-C1-01), so the seed needs at least as many demo users as the most-reviewed place has reviews.

**Out of scope**

- Anything on the prod database without the team's agreement.

**Notes**

- The demo password goes in the README, not in the code of the app.
- Every city needs enough places and reviews to rank well ([mvp.md](mvp.md) section 4).
- The prototype seed breaks the one-review rule: it has 2 demo users and up to 9 reviews on one place. On the dev database 20 user and place pairs have more than one review (70 reviews). The unique constraint of US-C1-01 cannot be added until the seed has enough demo users and the databases are cleaned. Prod was seeded with the same script, so it is very likely the same (not checked).
- The prototype seed also creates Lisbon, Madrid, Rome and London (4 landmarks each, on dev and prod). Remove them from the seed and decide what to do with the rows already in the databases (prod needs the team's approval).

**Issues**

1. **Seed with real hashes and rerunnable** · covers AC3, AC4 · depends on: Registration API
2. **Enough reviews for every city** · covers AC1, AC2 · depends on: Import the three MVP cities
3. **Demo users and reviews without duplicates** · covers AC2 · depends on: none
   - More demo users, each reviewing a place at most once
   - Clean the existing duplicate reviews on dev and prod (prod needs the team's approval), then recalculate the ratings

## B3 City search and filters

### US-B3-01 Find a city and browse its places

- **MVP feature:** B3 City search and filters
- **As a:** Planner

**I want** to search a city and browse its places,

**So that** I can see what there is to visit.

**Acceptance criteria**

1. **Given** I am on the home page, **when** I type part of a city name, **then** I see the matching cities and can choose one.
2. **Given** I chose a city, **when** the page loads, **then** I see only that city's places, and the map is centred on it.
3. **Given** I type in the place search, **when** a name or address matches, **then** only those places are listed.
4. **Given** nothing matches, **when** the list is empty, **then** I see a message that says so.

**Business rules**

- Search ignores case and accents.

**Out of scope**

- Searching places outside the catalog (S18).

**Issues**

1. **City search and empty state** · covers AC1, AC2, AC4 · depends on: none
2. **Accent-insensitive place search with tests** · covers AC3 · depends on: none

### US-B3-02 Filter and sort places

- **MVP feature:** B3 City search and filters
- **As a:** Planner

**I want** to filter a city's places by type, price level and rating, and sort by rating,

**So that** I see only what suits me.

**Acceptance criteria**

1. **Given** a city is open, **when** I choose a type, **then** only places of that type are listed.
2. **Given** a city is open, **when** I choose a price level, **then** only places with that level are listed (places without a price level are listed only when no price filter is set).
3. **Given** a city is open, **when** I choose a minimum rating, **then** only places with at least that rating are listed.
4. **Given** several filters are set, **when** I look at the list, **then** all of them apply together, and I can clear them.
5. **Given** the list is shown, **when** I sort by rating, **then** the places are ordered by their rating score (US-B6-01), best first, and places without reviews are last. Each place still shows its plain average and number of reviews.

**Business rules**

- Filters combine with AND. The "minimum rating" filter uses the plain average.
- Sorting by rating uses the rating score (weighted rating) of US-B6-01, descending, unrated last, ties broken by number of reviews then name. Unit tested.

**Out of scope**

- Saved filters.

**Issues**

1. **Filter functions with unit tests** · covers AC1, AC2, AC3, AC4, AC5 · depends on: Rating score (weighted rating) with unit tests (US-B6-01)
2. **Filter controls on the explorer** · covers AC1, AC2, AC3, AC4, AC5 · depends on: Filter functions with unit tests

## B4 Place page

### US-B4-01 See a place's details

- **MVP feature:** B4 Place page
- **As a:** Explorer / reviewer

**I want** a page for a place with its details and reviews,

**So that** I can decide whether to go there.

**Acceptance criteria**

1. **Given** a place in the catalog, **when** I open its page, **then** I see name, type, address, description, average rating, number of reviews and price level.
2. **Given** the place has opening hours, **when** I open its page, **then** I see them in a readable form; **otherwise** I see "unknown".
3. **Given** the place has reviews, **when** I open its page, **then** I see them newest first, with author, rating, price level and text.
4. **Given** the place has no reviews, **when** I open its page, **then** I see "no reviews yet" and a way to write the first one.
5. **Given** a place id that does not exist, **when** I open the page, **then** I see a not-found page.

**Business rules**

- The price level shown is the most common price level in the reviews (mode), or `FREE` for `fee=no` places.

**Out of scope**

- Photos (S3), helpful votes (S9).

**Issues**

1. **Place page with details and reviews** · covers AC1, AC3, AC4, AC5 · depends on: none
2. **Opening hours display** · covers AC2 · depends on: Place page with details and reviews
   - Parse the OpenStreetMap `opening_hours` text for display
   - Unit tests for the parser (also used by US-E6-01)

## B5 Map view

### US-B5-01 See places on a map

- **MVP feature:** B5 Map view
- **As a:** Explorer / reviewer

**I want** to see a city's places as pins on a map, grouped when they are close,

**So that** I know where things are.

**Acceptance criteria**

1. **Given** a city is open, **when** the map loads, **then** its places are shown as pins.
2. **Given** pins are close together, **when** I zoom out, **then** they are grouped into a cluster showing a count, and zooming in splits it.
3. **Given** I click a pin, **when** it opens, **then** I can see the place and open its details.
4. **Given** a city has hundreds of places, **when** I move the map, **then** it stays responsive.

**Business rules**

- Clustering is by a spatial grid depending on the zoom (unit tests exist).

**Out of scope**

- Discovered places that are not yet in the catalog (S19).

**Notes**

- The prototype has pins, clustering and viewport filtering (`src/domain/catalog/clustering.ts` and the map components). The issues start from there and must meet the criteria above.

**Issues**

1. **Map with pins, clustering and popup** · covers AC1, AC2, AC3 · depends on: none
   - Leaflet map with OpenStreetMap tiles, pins from the catalog, clusters by zoom
   - Unit tests for the clustering rule
2. **Performance with hundreds of places** · covers AC4 · depends on: Map with pins, clustering and popup
   - Only draw the pins inside the visible area

## B6 Top-rated places

### US-B6-01 See the top-rated places

- **MVP feature:** B6 Top-rated places
- **As a:** Explorer / reviewer

**I want** to see the top-rated places of a city, and of a city and type,

**So that** I find the best ones quickly.

**Acceptance criteria**

1. **Given** a city is open, **when** I look at the ranking, **then** places are ordered by their rating score (the weighted rating of the business rules), best first.
2. **Given** a type is chosen, **when** I look at the ranking, **then** only that type is ranked.
3. **Given** a place has no reviews, **when** I look at the ranking, **then** it is listed after rated places and shows "no ratings".
4. **Given** a review is posted, edited or deleted, **when** I reload the ranking, **then** the order reflects it.
5. **Given** a place with one 5-star review and a place with 50 reviews averaging 4.8, **when** I look at the ranking, **then** the second one is ranked above the first, and each shows its own plain average and number of reviews.

**Business rules**

- Ranking method (decided, ADR-008): the **weighted rating** (a Bayesian average). `score = (n / (n + m)) × average + (m / (n + m)) × C`, where `n` is the number of reviews of the place, `average` is its plain average, `m = 3` and `C = 4.0` are named constants. Round to 2 decimals. Places without reviews have no score and are ranked last. Ties are broken by number of reviews, then by name.
- The same score is used everywhere a list is sorted by rating (US-B3-02). The plain average and the number of reviews are still displayed.
- Unit tests with these cases: 1 review of 5 gives 4.25; 3 reviews of 5 give 4.50; 50 reviews averaging 4.8 give 4.75; a place without reviews has no score.

**Out of scope**

- "Hidden gems" (Dream).

**Notes**

- **This weighted rating is the method we use to rank places.** A plain average would put one 5-star review above fifty reviews averaging 4.8. IMDb ranks its Top 250 this way. See ADR-008 in [design.md](design.md).
- The score is computed when ranking, from the stored `averageRating` and `reviewCount`. The schema does not change.

**Issues**

1. **Rating score (weighted rating) with unit tests** · covers AC5 · depends on: none
   - `ratingScore(average, count)` in `src/domain/reviews/rating.ts`, with `m = 3` and `C = 4.0` as named constants
   - Unit tests with the cases of the business rules, and the case without reviews
2. **Ranking by city and type, independent of the map** · covers AC1, AC2, AC3, AC4 · depends on: Rating score (weighted rating) with unit tests, Filter functions with unit tests (US-B3-02)

## C1 Post a review

### US-C1-01 Post a review

- **MVP feature:** C1 Post a review
- **As a:** Explorer / reviewer

**I want** to rate a place from 1 to 5, write text and say how expensive it was,

**So that** others can see what it is worth.

**Acceptance criteria**

1. **Given** I am logged in, **when** I send a rating, a text and a price level, **then** the review appears on the place and its average rating and price level change.
2. **Given** I post a review, **when** it is saved, **then** the place is marked as visited for me.
3. **Given** I already reviewed this place, **when** I try to post another, **then** I am told to edit mine instead.
4. **Given** the rating is not 1 to 5 or the text is empty, **when** I send, **then** I see an error and nothing is saved.
5. **Given** I am not logged in, **when** I try to post, **then** I am asked to log in.

**Business rules**

- Average rating = mean of all ratings, rounded to one decimal.
- Place price level = most common price level in its reviews; ties go to the lower level.
- A user can review a given place only once (to change an opinion the user edits the review). Different users can each review the same place.

**Out of scope**

- Review photos (Dream), aspect ratings (Dream).

**Issues**

1. **One review per user and place** · covers AC3 · depends on: Session and write-endpoint guard (US-A1-02), Demo users and reviews without duplicates (US-B2-01)
   - Migration for a unique constraint on user and place. It fails while the databases hold duplicate reviews, so the demo data must be fixed first (see the notes of US-B2-01)
2. **Review form validation and visited marker** · covers AC1, AC2, AC4, AC5 · depends on: Session and write-endpoint guard (US-A1-02)

## C2 Edit and delete a review

### US-C2-01 Edit and delete my review

- **MVP feature:** C2 Edit and delete a review
- **As a:** Explorer / reviewer

**I want** to change or remove my own review,

**So that** my opinion stays correct.

**Acceptance criteria**

1. **Given** I wrote a review, **when** I change its rating, price level or text, **then** the review is updated and the place's rating and price level are recalculated.
2. **Given** I wrote a review, **when** I delete it, **then** it disappears and the place's rating and price level are recalculated.
3. **Given** my review was the only review of the place, **when** I delete it, **then** the place shows "no reviews" and its rating and price level are empty.
4. **Given** a review written by someone else, **when** I look at it, **then** there are no edit or delete buttons.
5. **Given** I delete my review of a place, **when** it is deleted, **then** the place stays in my visited list.

**Business rules**

- Recalculation uses the same functions as US-C1-01.
- A visit survives the deletion of the review (glossary, _Visit_).

**Out of scope**

- History of edits.

**Issues**

1. **Update and delete review API** · covers AC1, AC2, AC3, AC4, AC5 · depends on: Session and write-endpoint guard (US-A1-02)
2. **Edit and delete controls** · covers AC1, AC2, AC4 · depends on: Update and delete review API

## C3 Visited places

### US-C3-01 See my visited places

- **MVP feature:** C3 Visited places
- **As a:** Explorer / reviewer

**I want** a list of the places I have visited,

**So that** I can see my diary.

**Acceptance criteria**

1. **Given** I reviewed places, **when** I open "Visited", **then** I see them, newest first, with the date and my rating.
2. **Given** I have no visits, **when** I open "Visited", **then** I see an empty message with a link to explore.
3. **Given** another user, **when** they open "Visited", **then** they see only their own.
4. **Given** I click a place in the list, **when** it opens, **then** I reach its page.

**Business rules**

- Visits are private to the user.

**Out of scope**

- Personal stats and map (S10).

**Issues**

1. **Visited list API and page** · covers AC1, AC2, AC3, AC4 · depends on: Session and write-endpoint guard (US-A1-02)

## D1 Wishlist and bookmarks

### US-D1-01 Save a place to the wishlist or bookmarks

- **MVP feature:** D1 Wishlist and bookmarks
- **As a:** Explorer / reviewer

**I want** to add and remove places on my wishlist ("I want to go") and my bookmarks ("remember this"),

**So that** I keep places for later.

**Acceptance criteria**

1. **Given** I am logged in, **when** I add a place to the wishlist, **then** it appears in my wishlist.
2. **Given** I am logged in, **when** I add a place to my bookmarks, **then** it appears in my bookmarks.
3. **Given** a place is saved, **when** I remove it, **then** it disappears from that section.
4. **Given** a place is on the wishlist and bookmarks, **when** I remove it from one, **then** it stays in the other.
5. **Given** a place is saved, **when** I look at it anywhere in the app, **then** its state is shown on the add button.
6. **Given** I am not logged in, **when** I try to save, **then** I am asked to log in.

**Business rules**

- A place can be saved once per type per user (database constraint). Saved places are private.
- The wishlist feeds the generator (US-E8-01).

**Out of scope**

- Sharing a wishlist.

**Issues**

1. **Saved places API** · covers AC1, AC2, AC3, AC4, AC6 · depends on: Session and write-endpoint guard (US-A1-02)
2. **Saved places UI and "My places" page** · covers AC1 to AC5 · depends on: Saved places API

## D2 Custom lists

### US-D2-01 Manage my lists

- **MVP feature:** D2 Custom lists
- **As a:** Explorer / reviewer

**I want** to create, rename and delete named lists in my bookmarks,

**So that** I can group places, like "Best cafés in Paris".

**Acceptance criteria**

1. **Given** I am logged in, **when** I create a list with a name, **then** it appears in my bookmarks section.
2. **Given** a list, **when** I rename it, **then** the new name is shown.
3. **Given** a list, **when** I delete it, **then** the list is gone and its places stay in my bookmarks.
4. **Given** an empty name, **when** I save, **then** I see an error.

**Business rules**

- List names are 1 to 60 characters and unique per user.
- Lists are private.

**Issues**

1. **Lists API (create, rename, delete)** · covers AC1 to AC4 · depends on: Session and write-endpoint guard (US-A1-02)
2. **Lists UI** · covers AC1 to AC4 · depends on: Lists API

### US-D2-02 Put places in lists

- **MVP feature:** D2 Custom lists
- **As a:** Explorer / reviewer

**I want** to add and remove bookmarked places in my lists,

**So that** a place can be in several groups.

**Acceptance criteria**

1. **Given** a bookmarked place and a list, **when** I add it to the list, **then** the list shows it.
2. **Given** a place in two lists, **when** I remove it from one, **then** it stays in the other and in my bookmarks.
3. **Given** a place in lists, **when** I remove its bookmark, **then** it leaves all my lists.
4. **Given** a place that is not bookmarked, **when** I try to add it to a list, **then** it is bookmarked first (or I am told to bookmark it).

**Business rules**

- A list entry exists only for a bookmarked place. A place appears once per list (database constraint).

**Issues**

1. **List entries API and bookmark cascade with unit tests** · covers AC1 to AC4 · depends on: Lists API (US-D2-01)
2. **"Add to list" UI** · covers AC1 to AC4 · depends on: List entries API and bookmark cascade with unit tests

## E1 Create a trip

### US-E1-01 Create a trip

- **MVP feature:** E1 Create a trip
- **As a:** Planner

**I want** to create a trip by choosing a city, dates, a budget level, preferred types and the hours of the day,

**So that** I can start planning what to visit each day.

**Acceptance criteria**

1. **Given** I am logged in, **when** I create a trip with a name, a city, start and end dates, a budget level and at least one place type, **then** the trip is saved with one day for each date from start to end.
2. **Given** a trip of 3 days, **when** I open it, **then** I see Day 1, Day 2 and Day 3 with their dates.
3. **Given** the end date is before the start date, **when** I send, **then** I see an error and nothing is saved.
4. **Given** I leave the hours of the day empty, **when** I create the trip, **then** the day starts at 09:00 and ends at 20:00.
5. **Given** the fields for the hours of the day, **when** the day start is before 08:00, the day end is after 23:00, or the start is not before the end, **then** I see an error and nothing is saved. This only limits these two fields; the visit time of a single stop is not limited (US-E4-01).
6. **Given** a trip, **when** I open "My trips", **then** it is in the list, and other users cannot see it.
7. **Given** the form is incomplete, **when** I send, **then** I see which fields are missing.

**Business rules**

- Number of days = number of dates from start to end, inclusive. Unit tested.
- Budget level is `€`, `€€` or `€€€`. It is the target average price for the **whole trip** ([mvp.md](mvp.md) section 4).
- Hours of the day: `dayStart` and `dayEnd` (HH:mm), default 09:00 and 20:00, earliest start 08:00, latest end 23:00, start before end. Unit tested.
- The hours of the day only limit the generator (US-E8-01). In a manual itinerary any visit time is allowed, also outside them (US-E4-01).
- A trip has a maximum length (the team decides, for example 14 days).
- Trips are private to their owner.

**Out of scope**

- Several cities in one trip (S13).
- Different hours for different days.

**Notes**

- The database columns `dayStart` and `dayEnd` already exist in the schema (migration `20261027120000_add_trip_day_hours`). Existing and new trips get the defaults.

**Issues**

1. **Trip creation API with day creation and hours of the day** · covers AC1, AC2, AC3, AC4, AC5, AC7 · depends on: Session and write-endpoint guard (US-A1-02)
   - Day-count function with unit tests
   - Validation of the hours of the day with unit tests
2. **Create trip form and trip page** · covers AC1 to AC5, AC7 · depends on: Trip creation API with day creation and hours of the day
3. **My trips list** · covers AC6 · depends on: Trip creation API with day creation and hours of the day

## E2 Change a trip

### US-E2-01 Change a trip's dates and constraints

- **MVP feature:** E2 Change a trip
- **As a:** Planner

**I want** to edit the dates, budget level, types and hours of the day of a trip,

**So that** I can adapt it when my plans change.

**Acceptance criteria**

1. **Given** a trip, **when** I extend the end date, **then** new empty days are added at the end.
2. **Given** a trip with stops on day 3, **when** I shorten it so day 3 disappears, **then** I am warned first and, if I accept, the day and its stops are removed.
3. **Given** I move the start date, **when** I save, **then** the dates of all days change and the stops stay on their day numbers.
4. **Given** I change the budget level, types or hours of the day, **when** I save, **then** the existing itinerary is unchanged until I generate again.
5. **Given** an invalid change, **when** I save, **then** I see an error and nothing changes.

**Business rules**

- `syncDays()`: the days always match start to end, inclusive. Days are added or removed at the end, never in the middle. Unit tested.
- The hours of the day follow the same rules as when the trip is created (US-E1-01).

**Issues**

1. **Day synchronisation with unit tests** · covers AC1, AC2, AC3 · depends on: Trip creation API (US-E1-01)
2. **Edit trip API and UI with confirmation** · covers AC1 to AC5 · depends on: Day synchronisation with unit tests

## E3 Delete a trip

### US-E3-01 Delete a trip

- **MVP feature:** E3 Delete a trip
- **As a:** Planner

**I want** to delete a trip,

**So that** my list only has trips I still want.

**Acceptance criteria**

1. **Given** a trip, **when** I delete it and confirm, **then** it is gone from "My trips".
2. **Given** the trip had days, an itinerary and stops, **when** it is deleted, **then** all of them are deleted too.
3. **Given** I cancel the confirmation, **when** I go back, **then** nothing changed.

**Business rules**

- Deleting a trip never deletes places, reviews or saved places.

**Issues**

1. **Delete trip API and confirmation dialog** · covers AC1 to AC3 · depends on: Trip creation API (US-E1-01)

## E4 Manual itinerary

### US-E4-01 Build an itinerary by hand

- **MVP feature:** E4 Manual itinerary
- **As a:** Planner

**I want** to assign places to the days of a trip, remove them and set visit times,

**So that** I plan exactly what I want.

**Acceptance criteria**

1. **Given** a trip day, **when** I add a place from the city, **then** it is a stop at the end of that day.
2. **Given** a stop, **when** I move it to another day or position, **then** the order is saved.
3. **Given** a stop, **when** I set a visit time (HH:mm), **then** it is shown and saved.
4. **Given** a stop, **when** I remove it, **then** the place is not in the day any more and the other stops keep their order.
5. **Given** the same place already on the trip, **when** I add it again, **then** I am told it is already planned.
6. **Given** a place from another city, **when** I try to add it, **then** it is refused.
7. **Given** the hours of the day are 09:00 to 20:00, **when** I set the visit time of a stop to 22:30 or 00:00, **then** it is accepted. The hours of the day only limit the generator.

**Business rules**

- Positions in a day are 1, 2, 3 without gaps after any change. Unit tested.
- A place appears at most once per trip.
- Any visit time is allowed in a manual itinerary. The hours of the day only limit the generator.
- A trip has at most one itinerary (`MANUAL` when built by hand).

**Out of scope**

- Drag and drop (S7).

**Issues**

1. **Stop ordering rules with unit tests** · covers AC2, AC4, AC5, AC6 · depends on: Trip creation API (US-E1-01)
2. **Stops API (add, move, set time, remove)** · covers AC1 to AC7 · depends on: Stop ordering rules with unit tests
3. **Itinerary editing UI (day columns, add place, buttons to move)** · covers AC1 to AC5 · depends on: Stops API

## E5 Nearby suggestions

### US-E5-01 See the best places nearby while planning

- **MVP feature:** E5 Nearby suggestions
- **As a:** Planner

**I want** to see the best-ranked places near a stop,

**So that** I can add lunch after a landmark.

**Acceptance criteria**

1. **Given** a stop on a day, **when** I ask for suggestions, **then** I see places of the same city near it, best rated first, each with its distance and walking time.
2. **Given** a type filter (for example restaurants), **when** I ask, **then** only that type is shown.
3. **Given** a suggestion, **when** I click add, **then** it becomes a stop on that day.
4. **Given** no place is near, **when** I ask, **then** I see a message instead of an empty list.
5. **Given** places already in the trip, **when** I ask, **then** they are not suggested.
6. **Given** fewer than 3 places within 1 km, **when** I ask, **then** the search widens to 2 km.

**Business rules**

- Distance is the straight-line (haversine) distance. Radius 1 km, widened to 2 km when fewer than 3 places are found (both are named constants). Ordering by rating then distance. Unit tested.

**Issues**

1. **Nearby ranking function with unit tests** · covers AC1, AC2, AC4, AC5, AC6 · depends on: none
2. **Suggestions panel on a stop** · covers AC1 to AC6 · depends on: Nearby ranking function, Stops API (US-E4-01)

## E6 Plan warnings

### US-E6-01 Warn when a visit is outside opening hours

- **MVP feature:** E6 Plan warnings
- **As a:** Planner

**I want** a warning when a visit time is outside the place's opening hours,

**So that** I do not arrive at a closed place.

**Acceptance criteria**

1. **Given** a place open 09:00-18:00, **when** I set the visit time to 20:00, **then** the stop shows a warning.
2. **Given** a place open 09:00-18:00, **when** I set 10:00, **then** there is no warning.
3. **Given** a place with unknown opening hours, **when** I set a time, **then** there is no warning and the stop says hours are unknown.
4. **Given** I change the time to a valid one, **when** I save, **then** the warning disappears.
5. **Given** opening hours that depend on the weekday, **when** I check, **then** the day of the visit is used.

**Business rules**

- `isOutsideOpeningHours(openingHours, date, time)`; unknown hours never warn. Unit tests with real OpenStreetMap `opening_hours` examples (weekdays, `24/7`, ranges that cross midnight, closed days).

**Out of scope**

- Blocking the user; the warning is only information.

**Issues**

1. **Opening-hours check with unit tests** · covers AC1 to AC5 · depends on: Opening hours display (US-B4-01)
2. **Warning on the stop** · covers AC1 to AC4 · depends on: Opening-hours check with unit tests, Stops API (US-E4-01)

### US-E6-02 Compare the trip's average price with the budget

- **MVP feature:** E6 Plan warnings
- **As a:** Planner

**I want** to see the trip's average price level next to the budget level,

**So that** I know whether the plan fits.

**Acceptance criteria**

1. **Given** a trip with stops, **when** I open it, **then** I see the average price level and the budget level together.
2. **Given** the average is above the budget level, **when** I look, **then** I see a warning.
3. **Given** some stops have no known price, **when** I look, **then** they are marked "price unknown" and not counted.
4. **Given** no stop has a known price, **when** I look, **then** the average shows as unknown.
5. **Given** I add or remove a stop, **when** it saves, **then** the average updates.

**Business rules**

- Cost points: free 0, € 1, €€ 2, €€€ 3. The average is the mean of the known points ([mvp.md](mvp.md) section 4, ADR-003). Warning when the average is above the budget points. Unit tested.

**Issues**

1. **Trip average with unit tests** · covers AC2, AC3, AC4 · depends on: none
2. **Average and warning in the trip view** · covers AC1 to AC5 · depends on: Trip average, Stops API (US-E4-01)

## E7 Travel-time estimate

### US-E7-01 See the walking time between stops

- **MVP feature:** E7 Travel-time estimate
- **As a:** Planner

**I want** to see "≈ N min walk" between consecutive stops,

**So that** I know if the day is realistic.

**Acceptance criteria**

1. **Given** two consecutive stops on a day, **when** I look at the day, **then** I see an estimate between them.
2. **Given** I reorder stops, **when** it saves, **then** the estimates are recalculated.
3. **Given** the first stop of a day, **when** I look, **then** there is no estimate before it.
4. **Given** the estimate, **when** I look at it, **then** it says it is approximate.

**Business rules**

- Estimate = straight-line distance at a fixed walking speed, rounded to whole minutes. Unit tested (exists).

**Out of scope**

- Real routes and times from a routing service (S2).

**Issues**

1. **Estimates in the day view** · covers AC1 to AC4 · depends on: Stops API (US-E4-01)

## E8 Basic generator

### US-E8-01 Generate an itinerary

- **MVP feature:** E8 Basic generator
- **As a:** Planner

**I want** to press "Generate itinerary" and get a plan,

**So that** I get a good starting point in a few seconds.

**Acceptance criteria**

1. **Given** a trip, **when** I press "Generate itinerary", **then** each day gets stops chosen from the top-rated places of the preferred types, and every stop has a visit time.
2. **Given** places are chosen, **when** a day is built, **then** its stops are grouped by distance and a lunch place is near the morning stop, at lunch time.
3. **Given** the trip has wishlist places in the city, **when** I generate, **then** all of them are included.
4. **Given** the budget level, **when** I generate, **then** the average price of the stops is at or near the level, and the plan shows the average (a warning if above).
5. **Given** the city has too few cheap places, **when** I generate, **then** the days are still filled with the closest fit.
6. **Given** a place with known opening hours, **when** I generate, **then** it is never given a visit time at which it is closed. A place with unknown hours can be given any time.
7. **Given** the hours of the day of the trip, **when** I generate, **then** every stop, with its visit and the walk to it, falls inside them.
8. **Given** a generated itinerary, **when** I edit it, **then** it behaves like a manual one.
9. **Given** a trip already has stops, **when** I generate again, **then** I am asked before they are replaced.

**Business rules**

- Picks the best-ranked places first; skips or replaces a pick that would push the running average above the budget level. Wishlist places are always included and count towards the average.
- The first stop starts at `dayStart`. A stop is placed only if its visit and the walk to it end by `dayEnd`. This replaces the prototype's `maxHoursPerDay`.
- Visit duration per category and the lunch time (for example 12:00 to 14:30) are named constants chosen by the team.
- If a place is known to be closed at a time, the generator tries another time or another place. If hours are unknown it does not check.
- The same input gives the same result (deterministic). Unit tested.

**Out of scope**

- Real travel times and finer budget balancing (S1).

**Notes**

- Change the existing function (`src/domain/itinerary/itinerary.ts`) from a per-day budget to the trip average, from `maxHoursPerDay` to the hours of the day, and add the opening-hours check from US-E6-01.

**Issues**

1. **Generator rules: trip-average budget, wishlist, lunch** · covers AC2, AC3, AC4, AC5 · depends on: Trip average (US-E6-02)
   - Adjust `itinerary.ts` and its tests
2. **Visit times inside the hours of the day and opening hours** · covers AC1, AC6, AC7 · depends on: Generator rules, Opening-hours check with unit tests (US-E6-01), Trip creation API with day creation and hours of the day (US-E1-01)
3. **Generate button, replace confirmation and saving** · covers AC1, AC8, AC9 · depends on: Generator rules, Stops API (US-E4-01)

## P1 to P3 Platform

### US-P1-01 Use the app on any browser and phone

- **MVP feature:** P1 Web app, no installation
- **As a:** Explorer / reviewer

**I want** to use every page in a current browser, also on a phone,

**So that** I do not install anything.

**Acceptance criteria**

1. **Given** the latest Chrome, Firefox, Edge or Safari, **when** I do the demo scenario in [mvp.md](mvp.md) section 6, **then** every step works.
2. **Given** a phone-width screen, **when** I use any page, **then** nothing needs horizontal scrolling and the buttons can be reached.
3. **Given** the map on a phone, **when** I use it, **then** I can pan, zoom and open a place.

**Business rules**

- None.

**Notes**

- Done when a checklist for the pages has been run by the team once per release. Not a single feature issue: it is checked at each story's pull request.

**Issues**

1. **Responsive check and fixes for the existing pages** · covers AC1, AC2, AC3 · depends on: none

### US-P2-01 Separate dev and prod environments

- **MVP feature:** P2 Dev and prod environments
- **As a:** Curator (admin)

**I want** separate dev and prod servers,

**So that** changes are tested on dev before teachers see them on prod.

**Acceptance criteria**

1. **Given** a merge to `dev`, **when** the workflow ends, **then** the dev site shows it and prod does not.
2. **Given** a merge to `main`, **when** the workflow ends, **then** prod shows it.
3. **Given** a schema change, **when** a branch is deployed, **then** migrations run on that environment's database only.

**Notes**

- Design is in ADR-007 and [deployment.md](deployment.md). The prototype's workflow is a starting point.

**Issues**

1. **Pipeline for dev and prod** · covers AC1, AC2 · depends on: none
   - GitHub Actions workflow: `dev` to the dev site, `main` to prod
   - Secrets and environment variables documented without values
2. **Migrations per environment** · covers AC3 · depends on: Pipeline for dev and prod
   - `prisma migrate deploy` in the workflow against the right database

### US-P3-01 Show the OpenStreetMap attribution

- **MVP feature:** P3 Attribution
- **As a:** Explorer / reviewer

**I want** "© OpenStreetMap contributors" wherever place data is shown,

**So that** the data is credited as its licence requires.

**Acceptance criteria**

1. **Given** the map, **when** it is shown, **then** the attribution is visible.
2. **Given** a place list, ranking or place page, **when** it is shown, **then** the attribution is visible, linking to the OpenStreetMap copyright page.
3. **Given** a phone-width screen, **when** I look, **then** the attribution is still readable.

**Business rules**

- None.

**Issues**

1. **Attribution in the footer and place views** · covers AC1, AC2, AC3 · depends on: none

---

# Stretch stories

Taken only if the MVP is done, in the order of [mvp.md](mvp.md) section 3. Each story is
created as an epic **without issues**. When the team takes one, it is split into issues
at sprint planning, with the same template.

## S1 Smart generator

### US-S1-01 Generate with real travel times and finer budget balance

- **As a:** Planner
- **Notes:** The basic generator (US-E8-01) already respects the hours of the day and known opening hours.

**I want** the generator to use real travel times and balance the budget more precisely,

**So that** the plan can be followed as it is.

**Acceptance criteria**

1. **Given** real travel times, **when** I generate, **then** the day's visits plus travel fit in the hours of the day.
2. **Given** a budget level, **when** I generate, **then** the average price is closer to the level than the basic generator's.
3. **Given** the same input, **when** I generate twice, **then** the result is the same.

**Business rules**

- Extends US-E8-01 with US-S2-01. Unit tested.

**Notes**

- Depends on S2 for the real travel times.

## S2 Real travel times

### US-S2-01 See real walking, driving and public transport times

- **As a:** Planner

**I want** real travel times between stops, on foot, by car and by public transport,

**So that** the estimates are not straight lines.

**Acceptance criteria**

1. **Given** two consecutive stops, **when** I look at the day, **then** I see the travel time on foot, by car and by public transport from a routing service.
2. **Given** the service has no answer for one or more of these (for example there is no public transport in that city), **when** I look, **then** I see the ones it did answer and the others are left out.
3. **Given** the service has no walking time for the pair, or does not answer at all, **when** I look, **then** the straight-line estimate (US-E7-01) is shown as the walking time, marked as approximate, and the other times that are known are still shown.
4. **Given** the same pair of places, **when** I look again, **then** the answer comes from a cache.

**Business rules**

- Each mode is independent: a missing time never hides the others. Only walking has a fallback (the estimate).
- Respect the service's usage policy and limits.

**Notes**

- Choose the provider in an ADR. Public transport needs a provider with transit data for our cities. OpenRouteService has none, so another provider, or a second one, may be needed. If no free and usable one exists, this story ships with walking and driving only.

## S3 Photos for landmarks

### US-S3-01 See a photo of a landmark

- **As a:** Explorer / reviewer

**I want** to see a photo for a landmark,

**So that** I recognise it.

**Acceptance criteria**

1. **Given** a landmark with a Wikimedia Commons image, **when** I open its page, **then** I see the photo with its author and licence.
2. **Given** a place with no image, **when** I open its page, **then** I see the category icon.
3. **Given** the image service does not answer, **when** I open the page, **then** the page works with the icon.

**Business rules**

- Show the licence and author as the licence requires.

**Notes**

- A new migration is needed.

## S4 Publish and share itineraries

### US-S4-01 Publish an itinerary and share it with a link

- **As a:** Planner

**I want** to publish a copy of my itinerary and share a link,

**So that** others can see my plan.

**Acceptance criteria**

1. **Given** a trip with an itinerary, **when** I publish it, **then** I get a link.
2. **Given** the link, **when** anyone opens it, **then** they see the itinerary without logging in.
3. **Given** a published itinerary, **when** I unpublish it or delete it, **then** the link stops working.

**Business rules**

- The share token is long and random; only the owner can unpublish.

### US-S4-02 Bookmark published itineraries

- **As a:** Explorer / reviewer

**I want** to bookmark another user's published itinerary,

**So that** I can find it later.

**Acceptance criteria**

1. **Given** a published itinerary, **when** I bookmark it, **then** it appears in my bookmarked itineraries.
2. **Given** a bookmarked itinerary, **when** I remove the bookmark, **then** it disappears from my list.
3. **Given** the owner unpublishes it, **when** I open my list, **then** it shows as no longer available.

### US-S4-03 Copy a published itinerary into my own trip

- **As a:** Planner

**I want** to copy a published itinerary into a new trip of mine,

**So that** I can adapt it.

**Acceptance criteria**

1. **Given** a published itinerary, **when** I copy it, **then** a new trip is created with its days and stops.
2. **Given** the copy, **when** I edit it, **then** the original is unchanged.
3. **Given** I choose new dates, **when** I copy, **then** the days follow my dates.

**Business rules**

- The copy belongs to the copier and is private.

## S5 Visit reminders

### US-S5-01 Get a reminder before a planned visit

- **As a:** Planner

**I want** a reminder before a planned visit,

**So that** I do not forget it.

**Acceptance criteria**

1. **Given** a stop with a visit time, **when** the time is near, **then** I get a reminder.
2. **Given** I switch reminders off for a trip, **when** a visit is near, **then** nothing is sent.

**Business rules**

- One reminder per stop. Needs a scheduled job; the Vercel Hobby plan limits how often one can run (check in an ADR).

## S6 Other conflict warnings

### US-S6-01 Warn about overlapping visits and too much walking

- **As a:** Planner

**I want** warnings about overlapping visits and too much walking in a day,

**So that** the plan is realistic.

**Acceptance criteria**

1. **Given** two stops whose visit times overlap, **when** I look at the day, **then** both show a warning.
2. **Given** a day whose walking time passes a limit, **when** I look at it, **then** the day shows a warning.
3. **Given** I fix the cause, **when** it saves, **then** the warning disappears.

**Business rules**

- Visit duration per category and the walking limit are constants chosen by the team. Unit tested.

## S7 Drag and drop reordering

### US-S7-01 Reorder stops by dragging

- **As a:** Planner

**I want** to drag a stop to another position or another day,

**So that** planning is quick.

**Acceptance criteria**

1. **Given** a day, **when** I drag a stop to another position, **then** the new order is saved.
2. **Given** a stop, **when** I drop it on another day, **then** it moves there.
3. **Given** a phone, **when** I use touch, **then** the button-based move from US-E4-01 still works.

**Business rules**

- Same ordering rules as US-E4-01.

## S8 Alternatives per stop

### US-S8-01 Swap a stop for an alternative

- **As a:** Planner

**I want** to see alternatives for a stop and swap it,

**So that** I can change a restaurant without rebuilding the day.

**Acceptance criteria**

1. **Given** a stop, **when** I ask for alternatives, **then** I see places of the same type near it, best rated first.
2. **Given** an alternative, **when** I choose it, **then** it replaces the stop in the same position and time.
3. **Given** the replaced place was a wishlist place, **when** I swap it, **then** I am warned.

## S9 Helpful votes

### US-S9-01 Mark reviews as helpful

- **As a:** Explorer / reviewer

**I want** to mark a review as helpful and sort reviews by helpfulness,

**So that** the best reviews come first.

**Acceptance criteria**

1. **Given** a review by someone else, **when** I mark it helpful, **then** its count goes up by one.
2. **Given** I already voted, **when** I click again, **then** my vote is removed.
3. **Given** my own review, **when** I look at it, **then** I cannot vote on it.
4. **Given** the reviews of a place, **when** I sort by most helpful, **then** they are ordered by votes.

**Business rules**

- One vote per user and review. Migration needed.

## S10 Personal stats and visited map

### US-S10-01 See my stats and a map of where I have been

- **As a:** Explorer / reviewer

**I want** my number of visited places per city and type, and a map of them,

**So that** I see my history.

**Acceptance criteria**

1. **Given** my visits, **when** I open my stats, **then** I see counts per city and per type.
2. **Given** my visits, **when** I open my map, **then** every visited place is a pin.
3. **Given** no visits, **when** I open them, **then** I see an empty message.

## S11 Ticket prices

### US-S11-01 See ticket prices from OpenStreetMap

- **As a:** Explorer / reviewer

**I want** to see the ticket price where OpenStreetMap has it,

**So that** I know the cost before I go.

**Acceptance criteria**

1. **Given** a place with a `charge` tag, **when** I open its page, **then** I see the price.
2. **Given** a place without it, **when** I open its page, **then** no price is shown.

**Business rules**

- Parsing of the tag is unit tested; amounts are shown as given.

## S12 Budget in euros per day

### US-S12-01 Set a budget in euros per day

- **As a:** Planner

**I want** an optional budget in euros per day,

**So that** I plan with an amount, not only with a level.

**Acceptance criteria**

1. **Given** a trip, **when** I set a daily amount, **then** each day shows an estimated cost from rough amounts per price level.
2. **Given** the estimate is above the amount, **when** I look, **then** the day shows a warning.
3. **Given** no amount, **when** I look, **then** the trip works as before.

**Business rules**

- The amount per price level is a documented rough table; unit tested.

## S13 Multi-city trips

### US-S13-01 Plan a trip across several cities

- **As a:** Planner

**I want** a trip with more than one city,

**So that** I can plan a tour.

**Acceptance criteria**

1. **Given** a trip, **when** I add a second city for some days, **then** those days only offer that city's places.
2. **Given** the cities, **when** I generate, **then** each day uses its own city.
3. **Given** I remove a city, **when** I save, **then** its days follow the rules of US-E2-01.

**Notes**

- Needs a schema change: the city moves from the trip to the day.

## S14 Trip summary e-mail

### US-S14-01 Receive my itinerary by e-mail

- **As a:** Planner

**I want** my trip summary sent by e-mail,

**So that** I have it offline.

**Acceptance criteria**

1. **Given** a trip, **when** I ask for the summary, **then** an e-mail with the days and stops is sent to my address.
2. **Given** a failure, **when** it is sent, **then** I see an error and can retry.

**Business rules**

- Only to the account's address.

## S15 Push notifications

### US-S15-01 Get push notifications on mobile

- **As a:** Planner

**I want** reminders as push notifications on my phone,

**So that** I see them without opening the app.

**Acceptance criteria**

1. **Given** I allow notifications, **when** a reminder is due, **then** it arrives as a push.
2. **Given** I refuse or switch them off, **when** a reminder is due, **then** none is sent.

**Notes**

- Depends on US-S5-01 and US-S17-01.

## S16 Export an itinerary

### US-S16-01 Export to PDF or calendar

- **As a:** Planner

**I want** to export an itinerary to PDF or to a calendar file,

**So that** I can print it or add it to my calendar.

**Acceptance criteria**

1. **Given** a trip, **when** I export to PDF, **then** I get a document with days, stops and times.
2. **Given** a trip, **when** I export to calendar, **then** I get an `.ics` file with one event per timed stop.
3. **Given** stops without a time, **when** I export to calendar, **then** they are left out or all-day events (the team decides).

## S17 Installable app with offline itinerary

### US-S17-01 Install the app and read my itinerary offline

- **As a:** Planner

**I want** to install the app and open my itinerary without a connection,

**So that** it works abroad.

**Acceptance criteria**

1. **Given** a supported browser, **when** I choose install, **then** the app is added to my device.
2. **Given** I opened a trip online, **when** I lose the connection, **then** I can still read its itinerary.
3. **Given** I am offline, **when** I try to write, **then** I am told it needs a connection.

## S18 Search outside the catalog

### US-S18-01 Search for a place outside the catalog

- **As a:** Explorer / reviewer

**I want** to search by name for a place that is not in the catalog,

**So that** I can review any place.

**Acceptance criteria**

1. **Given** the search box, **when** I press Enter, **then** places from OpenStreetMap that match are listed.
2. **Given** I choose one, **when** I review it, **then** it is saved to the catalog (US-S19-01).
3. **Given** too many searches, **when** the limit is hit, **then** I see a message to wait.

**Notes**

- The prototype has this (ADR-004): the search runs on submit only, with a limit of 1 request per second. Reuse it.

## S19 Discover places on the map

### US-S19-01 Discover places that are not yet in the catalog

- **As a:** Explorer / reviewer

**I want** to see OpenStreetMap places that are not in the catalog, and review them,

**So that** I am not limited to what was imported.

**Acceptance criteria**

1. **Given** I move the map, **when** it stops, **then** places from OpenStreetMap in the visible area that are not in the catalog appear as discovered pins.
2. **Given** I post the first review on a discovered place, **when** it is saved, **then** the place is saved to the catalog in the correct city and its rating is calculated.
3. **Given** OpenStreetMap does not answer, **when** I move the map, **then** the places already in the catalog are still shown and no error page appears.
4. **Given** a discovered place is already in the catalog, **when** the map loads, **then** it appears once.

**Business rules**

- A discovered place is assigned to the nearest city that is in the catalog.
- Unique by OpenStreetMap id.

**Notes**

- Was MVP feature B7; moved to Stretch because it depends on the public Overpass servers and is not needed for the demo scenario.
- Known bug in ADR-002: in the prototype a saved place always goes to Porto. This story fixes it (AC2).
- Search by name outside the catalog is S18.
