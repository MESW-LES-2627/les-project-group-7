# Templates

Group 7 · MESW LES 2026-27

How work moves from an idea to a merged pull request:

```
MVP feature (mvp.md)  →  User story  →  Issue(s)  →  Branch + pull request
       E1                 US-E1-01      #12, #13       feature/12-trip-form
```

1. **User story** ([user-story.md](user-story.md)): what a user needs and why, with
   acceptance criteria. Every story belongs to one MVP feature from [mvp.md](../mvp.md).
   It says nothing about how it is built.
2. **Issue** ([issue.md](issue.md)): a piece of work that delivers all or part of a
   story. It is created **from** the story: it links back to it and copies the
   acceptance criteria it covers. A small story can have a single issue; a bigger one
   is split (for example backend and frontend).
3. **Pull request**: one per issue, linked with `Closes #<issue>`, and checked against
   the [Definition of Done](../definition-of-done.md).

A story is Done when all its issues are closed and every one of its acceptance
criteria is covered by at least one of them.

## Naming

| What | Format | Example |
|---|---|---|
| Story ID | `US-<feature>-<nn>` | `US-E1-01` |
| Issue title | `[US-<feature>-<nn>] <short action>` | `[US-E1-01] Trip creation API` |
| Branch | `<type>/<issue>-<short-name>` | `feature/12-trip-form` |
