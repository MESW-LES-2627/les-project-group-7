# AI log

Group 7 · MESW LES 2026-27

This log says how the team used AI. It has one section per iteration.

## Responsibility

Everything produced with AI was approved by the team, all code was checked by at least two members of the team, and all code in the repository is owned by the team. The team decides the scope, the product rules and what is merged.
Nothing runs on dev or prod unless a team member decides it. Secrets and connection strings are never given to the AI
tool or written in the repository.

## Conventions: what AI can be used for and how

1. **Tools.** Members can use the AI tools listed in this log. A new tool is added to the log in the iteration it is
   first used.
2. **Allowed uses.** AI can be used for code, tests, database migrations, scripts, debugging, documents, brainstorming
   and planning.
3. **Decisions.** AI can suggest options, but a team member chooses. Scope and product rules are decided by the team.
4. **Understanding.** The author must understand everything they submit and be able to explain it. Code that the
   author cannot explain is not submitted.
5. **Review.** Work made with AI follows the same review as any other work: the author checks it first, then one
   teammate other than the author reviews and approves the pull request.
6. **Tests.** Code made with AI must pass build, lint and tests like any other code. The author checks that tests
   written with AI really test the rule, and a test is not changed only to make it pass.
7. **Secrets and personal data.** Passwords, tokens, connection strings, `.env` files and personal data of real users
   are not given to the AI tool or written in the repository.
8. **Environments.** AI does not merge, deploy or change data on dev or prod without the explicit decision of a team
   member, who checks the command or change first.
9. **Checking facts.** Libraries, APIs and facts suggested by AI are checked against their official source. A new
   dependency must exist, be maintained and have a licence the project can use.
10. **No invented data.** A value the team does not know (a price level, opening hours) stays empty. AI does not fill
    it with a guess.
11. **Reviews.** A review by an AI tool, including GitHub Copilot, does not replace the approval of a teammate. For a
    change to a page, the reviewer also opens the page in a browser and uses it.
12. **Parallel writes.** Code that changes the same data from requests that can arrive together is tested with
    parallel requests against a real database, not only with unit tests.

## Iteration 1 (23 Oct to 6 Nov 2026)

### What the team used it for

- The OpenStreetMap import script, the grid search of Paris and Berlin, and the seed that loads about 1,000 places
  per city with sample reviews ([#121](https://github.com/MESW-LES-2627/les-project-group-7/pull/121),
  [#131](https://github.com/MESW-LES-2627/les-project-group-7/pull/131)).
- The migration that adds one review per user and place. It deletes the repeated reviews first
  ([#132](https://github.com/MESW-LES-2627/les-project-group-7/pull/132)).
- Rules and their unit tests: the rating score ([#117](https://github.com/MESW-LES-2627/les-project-group-7/pull/117)),
  filters and sorting ([#122](https://github.com/MESW-LES-2627/les-project-group-7/pull/122)), the search that
  ignores accents ([#126](https://github.com/MESW-LES-2627/les-project-group-7/pull/126)) and the price level of a
  place ([#129](https://github.com/MESW-LES-2627/les-project-group-7/pull/129)).
- The ADRs, the domain model, the change scenario for editing and deleting a review, the glossary and the deployment
  guide.
- Comparing designs before choosing one (the rating score, the login library) and splitting the stories into issues.

### Problems we found in code written with AI

| Problem                                                                                                                                                                               | How we found it                                                          | Fix                                                                                                                                                           |
| :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | :----------------------------------------------------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| The import of the prototype guessed a price level from the category (241 `FREE`, 166 `€` and 94 `€€` in Porto, all guessed) and wrote opening hours that OpenStreetMap does not have. | Checking the Porto data against OpenStreetMap while writing the stories. | A price level only comes from `fee=no` or from reviews, and unknown hours stay empty ([#121](https://github.com/MESW-LES-2627/les-project-group-7/pull/121)). |
| The average rating used `toFixed(1)`, which turns 4.35 into 4.3.                                                                                                                      | Two places of the demo data showed the wrong average.                    | The rounding works on whole numbers ([`74dab2a`](https://github.com/MESW-LES-2627/les-project-group-7/commit/74dab2a)).                                       |
| Opening a map pin near the edge crashed the page with "Maximum update depth exceeded".                                                                                                | Testing the map by hand on `dev` after two pull requests were merged.    | [#130](https://github.com/MESW-LES-2627/les-project-group-7/pull/130). There is no automated test, because the tests run without a browser.                   |
| The search box saved an OpenStreetMap id as `4242` and the import as `way/4242`, so one place could be saved twice.                                                                   | Reviewing the import code.                                               | One function builds every id ([#121](https://github.com/MESW-LES-2627/les-project-group-7/pull/121)).                                                         |

### How we checked the work

- We broke the code on purpose to see if the tests fail (mutation check). The tests caught 6 of 7 changes in
  [#129](https://github.com/MESW-LES-2627/les-project-group-7/pull/129) and 7 of 7 in
  [#132](https://github.com/MESW-LES-2627/les-project-group-7/pull/132).
- The migration that deletes repeated reviews ran on a Neon branch of dev and on a copy of prod before it went near
  prod ([#132](https://github.com/MESW-LES-2627/les-project-group-7/pull/132)).
- We called the endpoints with `curl` against a local database: 26 checks in
  [#118](https://github.com/MESW-LES-2627/les-project-group-7/pull/118), 21 in
  [#129](https://github.com/MESW-LES-2627/les-project-group-7/pull/129) and 15 in
  [#132](https://github.com/MESW-LES-2627/les-project-group-7/pull/132).

### What we changed because of it

When we do not know a value, such as a price level or opening hours, we leave it empty. This is now convention 10.

### Tools

- Claude Code (Anthropic)
- GitHub Copilot
- ChatGPT

## Iteration 2 (6 to 20 Nov 2026)

### What the team used it for

- Claude Code was used for the Edit trip API and its dialog with the warning before stops are lost
  ([#165](https://github.com/MESW-LES-2627/les-project-group-7/pull/165)), for the map, the rating of a place and the
  saved places in the planner ([#169](https://github.com/MESW-LES-2627/les-project-group-7/pull/169),
  [#170](https://github.com/MESW-LES-2627/les-project-group-7/pull/170)), for the fixes asked in the reviews of #160 and
  #166.
- It also helped to compare the reviews of #160 and #166 with the code, and to write the plan of the usability review of
  Iteration 3.
- GalaxyXYZ888: I used Claude Code for the Create trip API with its days and an empty itinerary
  ([#148](https://github.com/MESW-LES-2627/les-project-group-7/pull/148)), the day synchronisation when the dates of a
  trip change ([#154](https://github.com/MESW-LES-2627/les-project-group-7/pull/154)), and the polish of the My trips
  page ([#153](https://github.com/MESW-LES-2627/les-project-group-7/pull/153)). I used it for the Stops API: add, list,
  move, set the time of and remove the stops of an itinerary, with the order rule for stops with a time
  ([#156](https://github.com/MESW-LES-2627/les-project-group-7/pull/156)), and for the lock that makes the changes of
  one itinerary wait for each other
  ([#161](https://github.com/MESW-LES-2627/les-project-group-7/pull/161)). I also used it for the order of the reviews,
  the "Open place page" button and the matching buttons of the review form
  ([#163](https://github.com/MESW-LES-2627/les-project-group-7/pull/163)), and for the backfill script of the
  OpenStreetMap price ([#157](https://github.com/MESW-LES-2627/les-project-group-7/pull/157)).
- A script outside the repository runs the deploy workflow with `act` in Docker while GitHub Actions does not start. I
  used Claude Code to run it and deploy `dev` after merges, and to take a snapshot of the Neon `dev` database before
  the migrations. The secrets are in files outside the repository. The tool ran the script that reads them and did not
  print them, and I had the log of each deploy searched for their values.

### Problems we found in code written with AI

| Problem | How we found it | Fix |
| :-- | :-- | :-- |
| The Stops API ran every change in a serializable transaction. Two parallel moves deadlocked and the person got a 500, and in a rare case a change that was not saved. When several changes arrived together, all but one failed with "try again". | Calling the API with parallel requests against a real PostgreSQL, while reviewing #157. The unit tests did not show it. | Every writer locks the itinerary first (`FOR NO KEY UPDATE`), the transaction is read committed, and a deadlock that still happens is answered 409 and not 500 ([#161](https://github.com/MESW-LES-2627/les-project-group-7/pull/161)). Convention 12. |
| The planner of #61 was merged working, but it was a form above columns that scrolled sideways, with no map to choose from, and a stop said nothing about its place. A review by a tool had not said anything about it: on #158 the only review was a Copilot comment that said it could not review because of quota, and no teammate approved it. | Using the page on 19 Nov, after the merge. | A usability review of the whole demo scenario in Iteration 3, a redesign of the planner ([#174](https://github.com/MESW-LES-2627/les-project-group-7/pull/174)), and convention 11. |
| The header of the logged-in pages was 411 px wide with the link "My places", and 467 px with the link of #166, so every page scrolled sideways on a phone. The two pull requests also conflicted in the same file. | The review of #160 and #166, with a real browser at 390 px. | The username is only for screen readers below `sm`, and the two links were solved together. |

### How we checked the work

- Parallel requests against a local PostgreSQL, which found the deadlock of #161.
- The reviews of #160 and #166 used a merged tree of `dev` and the branch, a real database and a browser at 390 px, in
  light and dark.
- While GitHub Actions does not start, the checks of the pipeline are run by hand on a computer: format, types, lint,
  knip and the tests, and the pull request is only merged after they pass.

### What we changed because of it

Two conventions, 11 and 12 above. The team agrees on them at the retrospective.

### Tools

- Claude Code (Anthropic)
- GitHub Copilot (asked to review pull requests; its review did not run on #158)
- ChatGPT

