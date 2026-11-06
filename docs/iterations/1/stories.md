# Stories in Iteration 1

Group 7 · MESW LES 2026-27 · Iteration 1 (23 Oct to 6 Nov 2026)

The stories planned for this iteration, with the issues and the pull requests that deliver them. A story
counts as done only when all its issues are merged (see the [Definition of Done](../../definition-of-done.md)).
The acceptance criteria of each story are in [user-stories.md](../../user-stories.md).

## Done

| Story | Issues | Pull requests |
| :---- | :---- | :---- |
| US-A1-01 Register (#10) | #11 Registration API, #12 Registration page | #110, #114 |
| US-A1-02 Log in and log out (#13) | #14 Session and write-endpoint guard, #15 Login and logout API and UI | #112, #116 |
| US-B1-01 Import places from OpenStreetMap (#16) | #17 Import the three MVP cities | #121 |
| US-B2-01 Load demo data (#18) | #19 Seed with real hashes, #21 Demo users and reviews without duplicates, #20 Enough reviews for every city | #118, #120, #131 |
| US-B3-01 Find a city and browse its places (#22) | #23 City search and empty state, #24 Accent-insensitive place search | #124, #126 |
| US-B3-02 Filter and sort places (#25) | #26 Filter functions with unit tests, #27 Filter controls on the explorer | #122, #123, #130 |
| US-B4-01 See a place's details (#28) | #29 Place page with details and reviews, #30 Opening hours display | #127, #138 |
| US-B5-01 See places on a map (#31) | #32 Map with pins, clustering and popup, #33 Performance with hundreds of places | #128, #139 |
| US-B6-01 See the top-rated places (#34) | #107 Rating score with unit tests, #35 Ranking by city and type, independent of the map | #117, #134 |
| US-C1-01 Post a review (#36) | #38 Review form validation and visited marker, #37 One review per user and place | #125, #129, #132, #133 |
| US-P3-01 Show the OpenStreetMap attribution (#82) | #83 Attribution in the footer and place views | #135 |

## Started, not done

None: every story of the iteration has all its issues merged.

## Moved to Iteration 2

- #63 Nearby ranking function with unit tests (US-E5-01) and #69 Trip average with unit tests (US-E6-02) had been planned for this iteration and were moved to Iteration 2, with the rest of the trip planning.

## Other work in the iteration

- ADR-009, authentication with Better Auth (#109), and the alignment of the docs with the created issues (#108).
- The deployment of dev and prod with GitHub Actions and Neon (see [deployment.md](../../deployment.md)).
- Fixes found after the merges (#129 price level and review form, #130 map card, #140 dark mode of the place page, the footer and the attribution line).
- Docs brought up to date with what was built (#137: ADR-008, glossary and README).
