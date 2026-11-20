# Retrospective — Iteration 2

Group 7 · MESW LES 2026-27 · Iteration 2 (6 to 20 Nov 2026)

The facts below come from the pull requests, the issues and the checks of GitHub. The part "What we change in
Iteration 3" is a proposal, to agree on at the retrospective meeting.

## What went well

- The trip is in `dev` from start to end: create (#148, #149), list (#151), change the dates with a warning before
  stops are lost (#154, #165) and delete (#150). The rules have unit tests: the days from the dates, the order of the
  stops and the warning that counts the stops that would go.
- A person can build an itinerary by hand: the Stops API (#156) and the editing page (#158), and since 19 Nov a map,
  the saved places and the rating of a place next to the days (#169, #170).
- A deadlock in the Stops API was found before any user saw it. It showed up when the API was called with parallel
  requests against a real PostgreSQL, while reviewing #157, and it was fixed in #161 (see the [AI log](../../ai-log.md)).
- The reviews of #160 and #166 tested a merged tree with a real database and a browser at 390 px. They found a header
  that scrolled sideways on a phone and a conflict between the two pull requests, and both were fixed.
- Six stories are done: US-E1-01, US-E2-01, US-E3-01, US-C2-01, US-C3-01 and US-D1-01 (see
  [stories.md](stories.md)).

## What went badly

- The work arrived at the end again. 14 of the 21 pull requests merged since 13 Nov were merged on 19 and 20 Nov: 9 on
  19 Nov alone. Only 1 was merged between 10 and 14 Nov (#148). The freeze of 18 Nov was not kept, and the rule of
  Iteration 1 that every member delivers in every week did not hold in the first week.
- The review rule of the Definition of Done was not met. 7 of the 19 pull requests merged for the stories had no approval
  from a teammate: #157, #158, #160, #165, #166, #169 and #170. #160 and #166 were merged with a request for changes
  still open, after the fixes had been pushed. On #158 the only review was a Copilot comment that said it could not review
  because of quota.
- The planner was merged working but not usable. Each part was built and checked alone, and nobody used the page from
  the start to the end before the merge. On 19 Nov we saw that there was no map to choose a place from, the wishlist was
  on another page and a stop said nothing about its place. The redesign is in #174.
- The checks of GitHub Actions do not start: the jobs fail after 1 to 4 seconds with "The job was not started because
  recent account payments have failed or your spending limit needs to be increased". So "build, lint and tests pass on
  the pull request" was checked by hand. The pipeline (#80, pull request #152) is not merged and #81 has no pull request.
- Two stories are not done, US-E4-01 (the settings of the itinerary, #144 and #145) and US-P2-01 (#80 and #81), so they
  do not count for this iteration.
- The plan and the snapshot of the sprint were only merged on 20 Nov (#172), and the tag `sprint-2-start` was never made.

## What we change in Iteration 3

| Action | How we know it happened |
| :-- | :-- |
| We use the product before we merge it: a teammate other than the author goes through the demo scenario of the MVP in a browser, on `dev`, in the first week, and writes down what got in the way. | `docs/iterations/3/usability.md` exists by 23 Nov, with a table of problems and what we decide for each. |
| No pull request is merged without an approval from a teammate. A review by a tool does not count. | Every merged pull request shows an approval by a person in GitHub. |
| A pull request covers one issue and says "Part of #N". | The title and the first line of each pull request name one issue. |
| The freeze is kept: after Wed 2 Dec nothing new of a story is merged. | No story pull request is merged on 3 Dec or later, except fixes found in the review. |
| The pipeline runs, or the checks run on a computer and the result is in the pull request. | Green checks on the pull request, or the output of `bash scripts/ci-local.sh all` pasted in it. |
| The start of each sprint is tagged. | The tag `sprint-3-start` exists on the day of the planning. |
