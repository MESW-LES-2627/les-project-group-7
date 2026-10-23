# User story template

Copy everything below the line. Replace the `<...>` parts and delete hints you do
not need. The user roles are the ones in [vision.md](../vision.md#3-who-it-is-for):
Planner, Explorer / reviewer, Curator (admin).

---

## US-<feature>-<nn>: <short title>

| | |
|---|---|
| **MVP feature** | <ID and name, e.g. E1 Create a trip> |
| **Priority** | <Must / Should / Could> |
| **Estimate** | <story points> |
| **Status** | <Backlog / Ready / In progress / Done> |

### Story

**As a** <user role>,
**I want** <what the user wants to do>,
**so that** <why it matters to them>.

### Acceptance criteria

Each criterion must be something a person can check on the dev server.

1. **Given** <starting situation>, **when** <user action>, **then** <expected result>.
2. **Given** <...>, **when** <...>, **then** <...>.
3. <error or edge case, e.g. invalid input, not logged in, empty list>

### Business rules

<Rules that need automated unit tests (see the
[Definition of Done](../definition-of-done.md)). Write "None" if there are none.>

- <e.g. the number of days is the number of dates from start to end, inclusive>

### Out of scope

<What this story does **not** do, so it is not argued about at review. Link the
story that does it, if any.>

- <...>

### Notes

<UI sketch or link to the design, related terms in the [glossary](../GLOSSARY.md),
open questions, dependencies on other stories.>

### Issues

<Filled in when the story is split into issues (see [issue.md](issue.md)).>

- [ ] #<issue> <title>
- [ ] #<issue> <title>
