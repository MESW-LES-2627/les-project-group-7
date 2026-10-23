# Templates

Group 7 · MESW LES 2026-27

The templates are GitHub issue forms in
[`.github/ISSUE_TEMPLATE`](../../.github/ISSUE_TEMPLATE). GitHub offers them on
**New issue** and on **Create sub-issue**, and both add the new issue to the
[LES project board](https://github.com/orgs/MESW-LES-2627/projects/20).
Priority, size, estimate and iteration are set as fields on the board, not in the
issue text.

How work moves from an idea to a merged pull request:

```
MVP feature (mvp.md)  →  User story (epic)  →  Sub-issues  →  Branch + pull request
       E1                  #10 US-E1-01         #12, #13      feature/12-trip-form
```

1. **User story** ([user-story.yml](../../.github/ISSUE_TEMPLATE/user-story.yml)):
   an **epic** with the labels `epic` and `user story`. It says what a user needs and
   why, with numbered acceptance criteria, and belongs to one MVP feature from
   [mvp.md](../mvp.md). It says nothing about how it is built.
2. **Issue** ([issue.yml](../../.github/ISSUE_TEMPLATE/issue.yml)): a piece of work
   that delivers all or part of a story. It is created **from** the story with
   **Create sub-issue**, so GitHub links it to its epic and shows the progress there.
   It copies the acceptance criteria it covers. A small story can have a single
   issue; a bigger one is split (for example backend and frontend).
3. **Pull request**: one per issue, linked with `Closes #<issue>`, and checked against
   the [Definition of Done](../definition-of-done.md).

A story is Done when all its sub-issues are closed and every one of its acceptance
criteria is covered by at least one of them. Then close the epic.

## Naming

| What | Format | Example |
|---|---|---|
| Story title | `[US-<feature>-<nn>] <short title>` | `[US-E1-01] Create a trip` |
| Issue title | `[US-<feature>-<nn>] <short action>` | `[US-E1-01] Trip creation API` |
| Branch | `<type>/<issue>-<short-name>` | `feature/12-trip-form` |
