# Issue template

An issue is always created **from a user story** (see [user-story.md](user-story.md)).
It links back to the story and copies the acceptance criteria it is responsible
for. After creating it, add it to the story's **Issues** list.

Title: `[US-<feature>-<nn>] <short action>`, for example `[US-E1-01] Trip creation API`.

Copy everything below the line into the issue body.

---

**User story:** [US-<feature>-<nn>: <story title>](<link to the story>)
**MVP feature:** <ID and name, e.g. E1 Create a trip>
**Type:** <Feature / Task / Bug / Docs>
**Estimate:** <story points>

### What

<One or two sentences: which part of the story this issue delivers. If it delivers
the whole story, say so.>

### Acceptance criteria

<Copied from the story. Only the ones this issue covers; keep the story's numbers.>

- [ ] AC<n>: **Given** <...>, **when** <...>, **then** <...>.
- [ ] AC<n>: **Given** <...>, **when** <...>, **then** <...>.

### Tasks

- [ ] <e.g. Prisma migration for the new table>
- [ ] <e.g. API endpoint with server-side validation>
- [ ] <e.g. Page or component>
- [ ] Unit tests for the business rules: <which ones, or "none">

### Depends on

<Other issues that must be merged first, or "None".>

- #<issue>

### Definition of Done

Checked at the pull request, see [definition-of-done.md](../definition-of-done.md#1-story-done).

- [ ] Acceptance criteria above are checkable and the MVP feature is named
- [ ] Reviewed and approved by a teammate other than the author
- [ ] Build, lint and tests pass on the pull request
- [ ] Business rules have automated unit tests
