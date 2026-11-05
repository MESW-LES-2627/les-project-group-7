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

Docker (and the dev container, once it exists) are only for working locally. Deployment does not use them.

## One-time setup

Status: the dev path was tested on 21 Oct 2026, first with a hello-world app (both sites opened with no login) and then with the real skeleton, including the Prisma migration step on the dev database. The `main` path (prod) ran on 22 Oct 2026: migrations applied, deploy succeeded, site answers (the prod database is still empty on purpose). Not tested yet: a deploy of a commit pushed by a teammate (see "Known problems" below).

### 1. Neon (two databases)

1. Create an account at neon.com (sign in with GitHub, no card).
2. Create two projects: `les-g7-dev` and `les-g7-prod`. Choose a region in Europe.
3. In each project open **Connect**. You need two strings:
   - the **pooled** one (the host contains `-pooler`). This is `DATABASE_URL` for the app.
   - the **direct** one (pooling switched off). Used only to apply migrations.

### 2. Vercel (two projects)

1. Create an account at vercel.com (sign in with GitHub, Hobby plan).
2. Create two projects without connecting a Git repository, by running `vercel link`
   twice in the app folder (in a throwaway `node:22` container, so nothing is installed):
   `les-group7` for prod and `les-group7-dev` for dev. Both are deployed to their own
   *production* environment, which gives each a fixed public address. (The first design
   used one project and a preview address, but `vercel alias set` failed with
   "User not found" on a personal account.)
3. In each project, **Settings, Environment Variables**, add `DATABASE_URL` (the
   **pooled** string) for the Production environment: the prod string in `les-group7`,
   the dev string in `les-group7-dev`. Authentication (ADR-009) also needs, in the same place,
   `BETTER_AUTH_SECRET` (a random value of at least 32 characters, **different** in
   each project, for example from `openssl rand -base64 32`) and `BETTER_AUTH_URL` (the address
   of that site: `https://les-group7.vercel.app` and `https://les-group7-dev.vercel.app`). Both
   were created on 31 Oct 2026. Never commit or print these values.
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

1. Before merging `dev` into `main`, back up the prod database. Neon Free keeps only
   6 hours of history (the project setting is at its maximum), so a backup you made
   yourself is the only way back after more than 6 hours.
   - Save a dump outside the repository. The `pg_dump` version must be at least the
     server version (18), so use the Postgres 18 image, with the direct connection string
     in an environment variable (never typed into a command that is saved or shared):
     `docker run --rm -e URL="$PROD_DIRECT_URL" postgres:18 sh -c 'pg_dump "$URL"' > ~/backups/prod-YYYY-MM-DD.sql`
     Never commit a dump: it holds user data.
2. Merge, watch the Action, and run the demo scenario on prod.

## Test a migration on a copy of the dev database

A migration that fails on `dev` stops the deploy for the whole team, and one that fails on prod
is worse. Neon branches are copy-on-write copies, so testing on one is free and safe. Do it for
every migration that changes or fills existing tables.

1. In the Neon console, project `les-g7-dev`, create a branch from `dev` (for example `test-<topic>`).
   The free plan allows 10 branches per project.
2. **Reset the password of the branch's role first.** A branch inherits the password of its parent,
   so showing its connection string would show the real dev credential.
3. With the migration in your working tree, run `DATABASE_URL=<direct string of the branch>
   npx prisma migrate deploy` (the workflow also uses the direct string), then look at the data.
4. Start the app with `DATABASE_URL=<pooled string of the branch>` (what Vercel uses) and run your
   checks.
5. Delete the branch.

Done on 31 Oct 2026 for the Better Auth migration (ADR-009).

## One-off data cleanups

The seed and the import only add and update: they never delete, and they leave the price level
of a place with reviews alone. When the rules change, the rows that are already in a database
keep their old values until someone fixes them with a statement like the ones below. Run them by
hand with the direct connection string, on dev first and on prod only with the team's agreement,
and test them on a copy first (see the section above).

**Guessed price levels and fake opening hours (US-B1-01, #17).** The old import gave every place a
price level guessed from its category and the same opening hours (`Mo-Su 09:00-19:00`). Now a
place is `FREE` only if OpenStreetMap says `fee=no`, and its hours are the ones OpenStreetMap has.
Run this first, and then `npm run seed`, which sets `FREE` and the real hours again from the
snapshot of Porto. Places with reviews keep their price level, which comes from the reviews.

```sql
BEGIN;
UPDATE "Place" SET "priceLevel" = NULL
WHERE source = 'IMPORTED' AND NOT EXISTS (SELECT 1 FROM "Review" r WHERE r."placeId" = "Place".id);
UPDATE "Place" SET "openingHours" = NULL WHERE "openingHours" = 'Mo-Su 09:00-19:00';
COMMIT;
```

Check before and after: `SELECT coalesce("priceLevel", 'unknown'), count(*) FROM "Place" GROUP BY 1;`

Status: run on dev on 5 Nov 2026, followed by the seed (625 places, 20 demo users). Not run on prod yet: it
waits for the merge of `dev` into `main`.

**Hand-written places of the prototype seed (US-B2-01, #20).** The old seed created 18 places by
hand: 10 in Porto (ids `porto/...`) and 8 in Paris and Berlin (invented OpenStreetMap ids), with 78
reviews. They are replaced by the real OpenStreetMap places from the snapshots, which now carry the
sample reviews, and three of them were duplicates of imported places (São Bento, Bolhão, Jardim do
Morro). This removes them and their reviews, visits and saved places (all their reviews were written
by demo users on dev). Run it before `npm run seed`, which then writes the sample reviews, including
the "Meh" review, on the real places. Check first that nobody else reviewed them:
`SELECT count(*) FROM "Review" r JOIN "Place" p ON p.id = r."placeId" WHERE p."osmId" IN (...) AND r."userId" NOT LIKE 'demo-user-%';`

```sql
BEGIN;
DELETE FROM "Place" WHERE "osmId" IN (
  'porto/serralves', 'porto/cafe-santiago', 'porto/ponte-dom-luis', 'porto/sao-bento',
  'porto/mercado-bolhao', 'porto/livraria-lello', 'porto/torre-clerigos', 'porto/cafe-majestic',
  'porto/jardim-morro', 'porto/catraio-beer',
  'node/45299496', 'node/45299497', 'node/45299498', 'node/45299500',
  'node/65299496', 'node/65299497', 'node/65299498', 'node/65299499'
);
-- Old imported places of Porto outside the zone (Perafita to Vilar do Paraíso) and without reviews
DELETE FROM "Place" p
WHERE p."cityId" = 'city-porto' AND p.source = 'IMPORTED'
  AND (p.latitude NOT BETWEEN 41.08 AND 41.24 OR p.longitude NOT BETWEEN -8.73 AND -8.56)
  AND NOT EXISTS (SELECT 1 FROM "Review" r WHERE r."placeId" = p.id);
COMMIT;
```

Check before and after: `SELECT c.name, count(p.id) FROM "City" c LEFT JOIN "Place" p ON p."cityId" = c.id GROUP BY c.name;`

Status: tried on a copy of dev on 5 Nov 2026 (2,969 places, 6,549 reviews and 30 demo users afterwards).
Not run on dev or prod yet.

**Lisbon, Madrid, Rome and London (US-B2-01, #21).** The prototype seed created these four cities
with four landmarks each. The MVP cities are Porto, Paris and Berlin, so the seed no longer creates
them. This removes the cities and their 16 places; the reviews, visits, saved places and itinerary
stops of those places go with them. It stops with an error if a trip uses one of the cities.

```sql
BEGIN;
DELETE FROM "Place" WHERE "cityId" IN ('city-lisboa', 'city-madrid', 'city-roma', 'city-londres');
DELETE FROM "City" WHERE id IN ('city-lisboa', 'city-madrid', 'city-roma', 'city-londres');
COMMIT;
```

Check before and after: `SELECT c.name, count(p.id) FROM "City" c LEFT JOIN "Place" p ON p."cityId" = c.id GROUP BY c.name;`

Status: run on dev on 5 Nov 2026. Not run on prod yet.

## Known problems and rules

- **Migrations are incremental.** Never edit or squash a migration that was already applied
  to dev or prod: `prisma migrate deploy` then fails on the other database (this broke the
  prod deploy once, with "type Role already exists"). A schema change is always a new migration.
- **Prisma binary target.** `prisma/schema.prisma` lists `native` and `rhel-openssl-3.0.x`.
  Vercel Functions run on a different system than the CI runner, and without the second
  target every page that reads the database fails with "could not locate the Query Engine".
- **Hobby plan and commit authors.** Vercel Hobby only deploys commits authored by the
  account owner and blocks the others. The workflow hides `.git` while it uploads so that
  the upload has no author. This is proven for the owner's commits only: when a teammate
  pushes to `dev` for the first time, check that the deploy succeeds. If it stays blocked,
  the options are to let the owner deploy or to move to a paid plan.
- **Logs.** Vercel Hobby keeps runtime logs for 1 hour only. The failed GitHub Action runs
  are the longer history, and they show which commit each deploy came from.

## Things to know

- Neon suspends the database after 5 minutes without use. The first request after
  that is slower. Open the app a minute before a demo.
- Free limits: Vercel Hobby, 100 deployments per day and 1M function calls per month;
  Neon Free, 100 compute-hours per month per project. Exceeding them pauses the feature.
- The place import script (OpenStreetMap) runs from a developer machine against the
  database, not inside Vercel.
- Both Vercel projects belong to one person's account. If that person leaves, create
  new projects and update the Vercel secrets.
