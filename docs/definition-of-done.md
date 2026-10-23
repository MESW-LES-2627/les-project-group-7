# Definition of Done

Group 7 · MESW LES 2026-27 · Iteration 0

Work is **Done** only when every rule that applies to it is true. Work that does not
meet the rules goes back to the backlog. The rules are short on purpose: we can check
all of them at every pull request.

Three levels: [Story](#1-story-done) (merged into `dev`),
[Iteration](#2-iteration-done) (`dev` goes to `main` and prod, every two weeks) and
[Release](#3-release-done) (final MVP, 18 Dec 2026).

---

## 1. Story Done

A story or task is Done when it is merged into `dev` and all of this is true.

- [ ] The issue has **acceptance criteria** that a person can check, and says which
      MVP feature it belongs to (see [mvp.md](mvp.md)).
- [ ] It was done on a branch and merged through a **pull request** linked to the
      issue. Nobody pushes directly to `dev` or `main`.
- [ ] **One teammate other than the author** reviewed and approved it.
- [ ] Build, lint and tests **pass** on the pull request.
- [ ] Business rules have **automated unit tests** (for example rating recalculation,
      days from trip dates, opening-hours check, generator rules).
- [ ] The feature **works on the dev server**, not only on the author's machine, and
      the reviewer tried it.
- [ ] No secrets (keys, passwords, tokens) in the code. Configuration comes from
      environment variables.
- [ ] Data changes require login, users can only change their own data and input is
      validated on the server. Passwords are stored hashed. (Applies once login
      exists, feature A1.)
- [ ] Database changes are **new** Prisma migrations. A migration that was already
      applied is never edited.
      pull request if setup or the design changed.

A rule can be skipped only if it clearly does not apply (for example "works on the dev
server" for a documentation change). Say so in the pull request.

---

## 2. Iteration Done

The review dates are 23 Oct, 6 Nov, 20 Nov, 4 Dec and 18 Dec.

- [ ] Every planned story meets the story rules, or goes back to the backlog.
      Partly done stories do not count.
- [ ] **Before the review** (22 Oct, 5 Nov, 19 Nov, 3 Dec, 17 Dec), `dev` is
      merged into `main` through a pull request that someone other than its author
      reviewed.
- [ ] The prod database is **backed up before** the merge (see
      [deployment.md](deployment.md)).
- [ ] `main` is deployed to prod, and the **demo scenario** from [mvp.md](mvp.md) (as
      far as the iteration covers it) passes on prod.
- [ ] [vision.md](vision.md), [mvp.md](mvp.md), [design.md](design.md) and the
      [glossary](GLOSSARY.md) match what was built. Changes of scope are written down.
      

---

## 3. Release Done

The final MVP release (18 Dec 2026) is Done when all of this is true.

- [ ] Every MVP feature in [mvp.md](mvp.md) meets the story rules.
- [ ] The full **demo scenario** runs from start to finish on prod.
- [ ] No open bug blocks a main flow or loses data.
- [ ] The README explains how to run the app locally, how it is deployed, which
      environment variables it needs and how to load the places and demo data.
- [ ] The known issues are written down and honest.
- [ ] OpenStreetMap attribution ("© OpenStreetMap contributors") is shown.
- [ ] Every team member can explain how the system works.

---

## 4. Changing this document

The team can change it at any retrospective. All four members must agree, and the
change is made in git like any other.
