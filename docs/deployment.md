# Deployment

Group 7 · MESW LES 2026-27

How the app gets from the repository to the two sites teachers can open.

| | Dev | Prod |
|---|---|---|
| Branch | `dev` | `main` |
| App | Vercel project `les-group7-dev` | Vercel project `les-group7` |
| Address | `les-group7-dev.vercel.app` | `les-group7.vercel.app` |
| Database | Neon project `les-g7-dev` | Neon project `les-g7-prod` |
| When | every push to `dev` | the day before each review (see the [Definition of Done](definition-of-done.md)) |

Both free plans are enough for a class project: Vercel Hobby (non-commercial use) and
Neon Free (no card, 1 GB per project). The repository is private in the course
organisation, and Vercel's free plan cannot connect to private organisation repositories.
So a GitHub Action ([deploy.yml](../.github/workflows/deploy.yml)) builds the app and uploads
the result with the Vercel command line tool. Vercel never connects to the repository.

Docker and the dev container are only for working locally. Deployment does not use them.

## One-time setup

Status: the dev path was tested on 21 Oct 2026 with a hello-world app (both sites opened with no login). Not tested yet: the `main` path (prod) and the Prisma migration step.

### 1. Neon (two databases)

1. Create an account at neon.com (sign in with GitHub, no card).
2. Create two projects: `les-g7-dev` and `les-g7-prod`. Choose a region in Europe.
3. In each project open **Connect**. You need two strings:
   - the **pooled** one (the host contains `-pooler`). This is `DATABASE_URL` for the app.
   - the **direct** one (pooling switched off). Used only to apply migrations.

### 2. Vercel (two projects)

1. Create an account at vercel.com (sign in with GitHub, Hobby plan).
2. Create two projects without connecting a Git repository, by running `vercel link`
   twice in the app folder (in a throwaway `node:20` container, so nothing is installed):
   `les-group7` for prod and `les-group7-dev` for dev. Both are deployed to their own
   *production* environment, which gives each a fixed public address. (The first design
   used one project and a preview address, but `vercel alias set` failed with
   "User not found" on a personal account.)
3. In each project, **Settings, Environment Variables**, add `DATABASE_URL` (the
   **pooled** string) for the Production environment: the prod string in `les-group7`,
   the dev string in `les-group7-dev`.
4. Write down the `orgId` (the same for both) and the two `projectId`s from `.vercel/project.json`.
5. Create an access token on vercel.com/account/tokens. **Scope: choose the team, then "All Projects".** A token limited to one project cannot see the other project, and gives confusing errors ("Project not found", "User not found"). Set an expiry after the final release.

### 3. GitHub (repository settings, Secrets and variables, Actions)

Secrets: `VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID_DEV`,
`VERCEL_PROJECT_ID_PROD`, `DEV_DIRECT_URL`, `PROD_DIRECT_URL` (the two direct Neon strings).

Never paste these values in chat or commit them.

### 4. First test (do this before real code exists)

1. Make a hello-world Next.js app with Prisma and one tiny table, in a branch.
2. Merge it into `dev` and watch the Action. Check the dev site opens and reads the database.
3. Merge `dev` into `main`. Check the prod site.
4. Fix `deploy.yml` if anything fails. The migration step is skipped until `prisma/schema.prisma` exists.

## Every iteration

1. Before merging `dev` into `main`, back up the prod database: Neon Free keeps only
   6 hours of history and one manual snapshot per project, so take the snapshot, or run
   `pg_dump` from the dev container.
2. Merge, watch the Action, and run the demo scenario on prod.

## Things to know

- Neon suspends the database after 5 minutes without use. The first request after
  that is slower. Open the app a minute before a demo.
- Free limits: Vercel Hobby, 100 deployments per day and 1M function calls per month;
  Neon Free, 100 compute-hours per month per project. Exceeding them pauses the feature.
- The place import script (OpenStreetMap) runs from a developer machine against the
  database, not inside Vercel.
- Both Vercel projects belong to one person's account. If that person leaves, create
  new projects and update the Vercel secrets.
