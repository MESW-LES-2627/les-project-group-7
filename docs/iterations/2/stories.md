# Stories in Iteration 2

Group 7 · MESW LES 2026-27 · Iteration 2 (6 to 20 Nov 2026)

The stories planned for this iteration, with the issues and the pull requests that deliver them. A story
counts as done only when all its issues are merged (see the [Definition of Done](../../definition-of-done.md)).
The acceptance criteria of each story are in [user-stories.md](../../user-stories.md). The plan of the sprint is
in [sprint-2-plan.md](../../sprints/sprint-2-plan.md).

A story is done when all its tasks (its issues) are merged. A story whose planned tasks are done but that still has
tasks that are not done is listed in the second table, with the tasks that are done and the ones that are not.

## Done

| Story | Issues | Pull requests |
| :---- | :---- | :---- |
| US-E1-01 Create a trip (#6) | #7 Trip creation API, #8 Create trip form and trip page, #9 My trips list | #148, #149, #151, #153 |
| US-E2-01 Change a trip's dates (#53) | #54 Day synchronisation, #55 Edit trip API and UI with confirmation | #154, #165 |
| US-E3-01 Delete a trip (#56) | #57 Delete trip API and confirmation dialog | #150 |
| US-C2-01 Edit and delete my review (#39) | #40 Update and delete review API, #41 Edit and delete controls | #157, #162, #163 |
| US-C3-01 See my visited places (#42) | #43 Visited list API and page | #166 |
| US-D1-01 Save a place to the wishlist or bookmarks (#44) | #45 Saved places API, #46 Saved places UI and My places page | #159, #160, #170 |

## Tasks done, story not done yet

| Story | Tasks done | Tasks not done |
| :---- | :---- | :---- |
| US-E4-01 Build an itinerary by hand (#58) | #59 Stop ordering rules ([#155](https://github.com/MESW-LES-2627/les-project-group-7/pull/155)), #60 Stops API ([#156](https://github.com/MESW-LES-2627/les-project-group-7/pull/156), [#161](https://github.com/MESW-LES-2627/les-project-group-7/pull/161)), #61 Itinerary editing UI ([#158](https://github.com/MESW-LES-2627/les-project-group-7/pull/158), [#169](https://github.com/MESW-LES-2627/les-project-group-7/pull/169), [#174](https://github.com/MESW-LES-2627/les-project-group-7/pull/174)). These are all the tasks that the sprint plan had for this story. | #144 Itinerary settings API and #145 Itinerary settings box (the optional budget level and hour limits). They were added to the story on 12 Nov, are not in the sprint plan and are moved to Iteration 3, so the story stays open. |
| US-P2-01 Separate dev and prod environments (#79) | #81 Migrations per environment (closed), and the deploy workflow of Iteration 1 | #80 Pipeline for dev and prod (pull request #152, in review). The repository became public on 20 Nov and GitHub Actions runs again, so the pipeline can be checked and merged in Iteration 3. |

## Moved to Iteration 3

- #63 Nearby ranking function with unit tests (US-E5-01) and #69 Trip average with unit tests (US-E6-02) were
  moved out of Iteration 1 and the sprint plan left them out of this iteration, with the rest of the stories E5 to
  E8 and P1, for Iterations 3 and 4.
- #144 Itinerary settings API and #145 Itinerary settings box (US-E4-01) were added to the story on 12 Nov and are not in
  the sprint plan of this iteration.

## Other work in the iteration

- The Stops API no longer deadlocks when two changes arrive together ([#161](https://github.com/MESW-LES-2627/les-project-group-7/pull/161)).
- Polish found while using the pages: My trips ([#153](https://github.com/MESW-LES-2627/les-project-group-7/pull/153)) and the order of the reviews of a place ([#163](https://github.com/MESW-LES-2627/les-project-group-7/pull/163)).
- The planner shows a map next to the days, adds a place from the map and shows the saved places
  ([#169](https://github.com/MESW-LES-2627/les-project-group-7/pull/169), [#170](https://github.com/MESW-LES-2627/les-project-group-7/pull/170)).
- The design report of the end of the iteration: the domain model and the component diagram updated, change
  scenario 2 and ADR-011, one function that saves a place found on the map (commit `1450569`).
- The plan and the start snapshot of the sprint ([#172](https://github.com/MESW-LES-2627/les-project-group-7/pull/172)).
- The planner on one screen, with the days as a timeline and one panel to find places (Search, Saved and Map)
  ([#174](https://github.com/MESW-LES-2627/les-project-group-7/pull/174)).
