# AI log — Iteration 1

Group 7 · MESW LES 2026-27 · 23 Oct to 6 Nov 2026

This log says how the team used AI in this iteration. Commits and pull requests do not carry an AI mark, so
this file is the record.

## What the team used it for

- **Writing code:** features, tests, database migrations, the seed and the import script, and the documents of
  the repository.
- **Brainstorming and planning:** choosing between designs (for example the rating score, the login library,
  how to load the demo data), breaking stories into issues, and preparing the rollout to dev and prod.

## Tools

- Claude Code (Anthropic), in the terminal on the machine of the author of the work, with Claude models.
- GitHub Copilot reviewed some pull requests automatically (its comments are in the pull requests).

## How the team stays responsible for the result

- Every change is read by the team member who asked for it before it is pushed, and that member can explain it.
- Business rules have unit tests, and the tests of the rules were also checked by changing the code on purpose
  and seeing the tests fail.
- Changes were run in a real browser against the local app, and migrations and data changes were rehearsed on
  copies of the dev and prod databases before they touched a real database.
- Nothing runs on dev or prod without the explicit decision of a team member. Secrets and connection strings are
  not given to the AI tool or written in the repository.
- Pull requests are reviewed by another team member before they are merged (the Definition of Done). The team
  decides the scope, the product rules and what is merged.
- All code in the repository is owned by the team.

## What each member used (to be completed by each member)

| Member | Tool | For what |
| :---- | :---- | :---- |
| Gonçalo (GalaxyXYZ888) | Claude Code | Code, tests and docs of the issues #11, #14, #17, #19, #20, #21, #37 and #107, the fixes in #129, deployment and data tooling, reviews of the pull requests of the others |
| João (joaopachecowork1) | to be filled | to be filled |
| Mariana (mclcavalcante) | to be filled | to be filled |
| Fourth member | to be filled | to be filled |
