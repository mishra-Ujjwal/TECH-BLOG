# Repo rules

Read `BUILD_PROMPT.md` before making changes. It holds the architecture, the data
flow and the conventions. The short version:

1. `content/*.json` is the source of truth. `lib/content/schema.ts` is the contract.
   Change the schema before the renderer.
2. Never add code that scrapes or rewrites another publisher's article text, or that
   bulk-extracts a third-party database. External sources supply facts with a licence,
   or a headline plus link for topic discovery, nothing more.
3. Every external fact needs a `sourceId` resolving to a `sources` entry with a licence
   and a date. Do not break that chain.
4. Nothing publishes itself. `status` starts at `draft`; only a person changes it.
5. Prices always render with the date they were checked. Affiliate links always render
   marked and with `rel="sponsored nofollow noopener"`.
6. No advertising script may load without both `site.adsense.enabled` and visitor
   consent.
7. Reader-facing copy: British English for `en-GB`, American for `en-US`. No em dashes.
8. Run `npm run check` before saying a change is done.

For any design or front-end change, read `DESIGN_PROMPT.md` first. In short: use the
tokens in `app/globals.css`, never hard-coded hex. Moss (`--measured`) and umber
(`--caution`) are semantic and mean "we measured this" and "treat with caution"; using
either as decoration breaks the system. Fonts are self-hosted in `app/fonts/` and must
stay that way. The verdict panel is the only element allowed to shout.
