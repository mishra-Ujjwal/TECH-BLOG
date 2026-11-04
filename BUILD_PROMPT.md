# Claude prompt for working on this project

Paste the whole of this file into Claude Code (or any Claude session with file access)
at the start of a working session on this repo. It describes the architecture, the
rules and the conventions, so Claude does not have to guess and does not drift into
the patterns this project exists to avoid.

Keep it updated when the architecture changes. It is also a reasonable brief for a
human joining the project.

---

## The prompt

You are working on **ReviewKit**, the publishing framework for a hands-on tech and
software review site aimed at UK readers (US is a secondary locale). It is a
Next.js App Router site, TypeScript, Tailwind v4, reading content from Neon Postgres.

### Non-negotiable rules

1. **No scraping or republishing.** Never add code that downloads article bodies,
   rewrites another publisher's text, or bulk-extracts a database. External sources
   may contribute only facts (specs, versions, dates, prices) or a headline, link and
   date for topic discovery. Anything else is out of scope, whatever the request
   sounds like.
2. **Every external fact carries provenance.** A fact in a review must have a
   `sourceId` pointing at an entry in that document's `sources` array, with a licence
   and the date it was read. If a change would break that chain, do not make it.
3. **First-hand evidence is the product.** A review without the author's own
   measurements, observations and images is worthless here. Features that help the
   author record and display real test data are high value. Features that generate
   text without evidence are not.
4. **The human edit gate stays.** Nothing publishes automatically. `status` starts at
   `draft` and only a person changes it.
5. **Honest UI.** Do not label an unverified figure as verified, do not hide a price's
   date, do not drop the affiliate marker on an affiliate link, and do not describe a
   consent banner as a certified CMP. If an output would mislead a reader, say so
   rather than shipping it.
6. **British English in reader-facing copy** when `locale` is `en-GB`, American when
   `en-US`. Never write a price without the date it was checked.
7. **No em dashes in reader-facing copy.** Use commas, full stops or brackets.

### Architecture

```
content/                 the source of truth, hand-authored JSON
  site.json              site config: name, url, publisher, adsense, affiliate text
  categories.json        taxonomy
  reviews/*.json         one review per file
  pillars/*.json         buying guides, each clustering reviews by `pillar` slug
  pages/*.json           about, how-we-test, contact, privacy, terms, disclosure
lib/content/schema.ts    THE CONTENT CONTRACT (zod). Strict objects: typos fail.
lib/content/files.ts     file driver, reads content/ off disk
lib/content/neon-driver.ts  Neon driver, published rows only, filters in SQL
lib/content/index.ts     one API over both drivers
lib/db/migrations/*.sql  schema, applied in order by scripts/migrate.ts
lib/{site,markdown,format,jsonld}.ts
scripts/validate-content.ts  schema plus cross-file checks
scripts/import-content.ts    content/ -> Neon, appends price history
scripts/migrate.ts
app/                     App Router pages
components/              primitives, review-parts, chrome, consent
```

**Flow:** author JSON -> `npm run content:validate` -> `npm run content:import` ->
Neon -> Next.js renders. The JSON files stay authoritative; the database is the read
store. `CONTENT_SOURCE=files` bypasses the database entirely, which is how local dev
and CI builds work.

**Two database roles on purpose.** `DATABASE_URL` should be a SELECT-only role used by
the site. `DATABASE_URL_ADMIN` is the owner role, used only by `db:migrate` and
`content:import`. The site cannot write, so a bug in the app cannot publish a draft.

**Storage shape.** Each document is stored whole in `content.doc` (jsonb), with the
fields used for filtering and sorting copied into real columns, plus a `summary` jsonb
for listings so a category page never reads full documents. Prices are appended to
`price_snapshots`, giving a dated history rather than an overwrite.

### Conventions

- Routes: `/reviews/[slug]`, `/guides/[slug]` (pillars), `/categories/[slug]`,
  `/[slug]` (static pages). Page slugs may not shadow a route; the validator checks.
- Pages set `export const revalidate = 3600` and use `generateStaticParams`, so content
  is prerendered and an AdSense reviewer sees real HTML.
- Colours come from CSS custom properties in `app/globals.css`, defined for light and
  dark. Use `var(--color-ink)` and friends, not hard-coded hex.
- `.prose` is hand-rolled in globals.css. There is no typography plugin.
- Ads: no advertising script loads unless `site.adsense.enabled` is true **and** the
  visitor consented. `AdSlot` reserves height to protect Cumulative Layout Shift.
- Adding a field: change `lib/content/schema.ts` first, then the renderer, then the
  importer if it needs a column. Bump `schemaVersion` only for a breaking change.

### Commands

```
npm run dev                          local, uses content/ directly
npm run content:validate             errors fail; warnings are advisory
npm run content:validate -- --strict warnings fail too; run before going live
npm run db:migrate                   apply SQL migrations (needs DATABASE_URL_ADMIN)
npm run content:import               load content/ into Neon
npm run content:import -- --prune    also delete rows whose file is gone
npm run check                        validate, typecheck, build
```

### What to do when asked for a new feature

Say which of these it is, then build it:

- **Content shape change** -> schema, then renderer, then importer, then validator check.
- **New page type** -> a new member of the `docSchema` union, a route, a renderer, a
  sitemap entry.
- **Rendering or design** -> components only, no schema change.
- **Pipeline or sources** -> keep it in the separate discovery tooling, not in this
  repo's render path, and respect rule 1.

If a request would break one of the non-negotiable rules, say so plainly, explain the
risk in one or two sentences, and offer the version that does not break it.
