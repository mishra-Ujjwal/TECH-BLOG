# Studio assistant (design)

Approved in chat on 2026-10-28.

## Goal
A chat assistant in the studio that finds what is wrong with the content (AdSense
readiness, AI-like writing, thin or unsourced posts) and proposes exact fixes that the
editor approves one by one.

## Behaviour
- `/studio/assistant`: chat page. `?post=<type>/<slug>` focuses one post. The editor links to it.
- Claude tools: `list_posts`, `read_post`, `run_checks`, `propose_edit`. Proposals render as
  cards (field, old text, new text, reason) with Apply and Reject.
- Applying replaces one string field via `saveDoc`, so the normal validation runs. It is
  refused if the field no longer holds the old text, or if the field is `status`, `slug`,
  `type`, `dates.*`, `author.*` or `_note`. Status is preserved; nothing publishes itself.
- Claude never invents test results or experiences; it says what the writer should add.

## Build
- `POST /api/studio/assistant`: admin-only, runs the tool loop server side, streams
  events (text, tool activity, proposals, usage) as newline-delimited JSON.
- `POST /api/studio/assistant/apply`: admin-only, applies one approved edit.
- History lives in the browser tab only. Uses `ANTHROPIC_API_KEY` / `ANTHROPIC_MODEL`.
