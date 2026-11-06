# Retrospective — Iteration 1

Group 7 · MESW LES 2026-27 · Iteration 1 (23 Oct to 6 Nov 2026)

## What went well

- We finished all 11 stories of the iteration. We moved two trip planning issues (#63 and #69) to Iteration 2 on
  purpose (see [stories.md](stories.md)).
- We tested the risky changes on a copy first. The migration that deletes repeated reviews ran on a Neon branch of dev
  and on a copy of prod before it went near prod.
- The new tests were mutation checked, and we called the endpoints with `curl` against a local database before
  merging.
- The bugs that showed up after the merges (the map crash, the price level, the dark mode) were fixed before the
  review, each in its own pull request (#129, #130, #140).

## What went badly

- The work was not spread evenly. Most of the code came from part of the team, so some members had little time to
  learn the codebase before Iteration 2.
- Some pull requests were opened in the last two days of the iteration, so they were reviewed in a hurry and some
  fixes came after the merge.

## What we change in Iteration 2

| Action                                                     | How we know it happened                                                                                            |
| :--------------------------------------------------------- | :----------------------------------------------------------------------------------------------------------------- |
| All four members take part in the sprint planning.         | The board shows who took each issue at the planning.                                                               |
| Each member chooses and estimates the issues they will do. | Every issue of Iteration 2 has an estimate and an assignee at the start of the sprint (snapshot `sprint-2-start`). |
| Every member delivers work in every week of the sprint.    | A checkpoint in the middle of the sprint looks at the board and the open pull requests.                            |
| We open a pull request as soon as part of an issue works.  | No pull request of a story is opened in the last day of the iteration.                                        |
