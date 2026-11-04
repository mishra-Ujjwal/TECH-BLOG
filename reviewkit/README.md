# ReviewKit

A publishing framework for a hands-on review site. You author each review as a JSON
file, a validator checks it, an import script loads it into Neon Postgres, and
Next.js renders it as prerendered HTML.

Next.js 16 (App Router) · React 19 · TypeScript · Tailwind 4 · Neon Postgres · Zod

## Why JSON files and a database

The JSON files are the source of truth: version-controlled, diffable, easy to
hand-edit, and impossible to corrupt by a bad query. Postgres is the read store,
which gives the site indexed queries, full-text search and a dated price history.
Set `CONTENT_SOURCE=files` and the site runs with no database at all, which is how
local development and CI builds work.

## Getting started

```bash
cp .env.example .env.local     # CONTENT_SOURCE=files is enough to start
npm install
npm run dev                    # http://localhost:3000
```

The repo ships with example content. The two products in it are invented, so nothing
real is misdescribed. Delete `content/reviews/*.json`, `content/articles/*.json`,
`content/pillars/*.json` and the placeholders in `public/images/` when you add your own.

### Connecting Neon

1. Create a Neon project and database.
2. Put the owner connection string in `DATABASE_URL_ADMIN` and run `npm run db:migrate`.
3. Create the read-only role (the SQL is at the bottom of
   `lib/db/migrations/0001_init.sql`) and put its string in `DATABASE_URL`.
4. `npm run content:import`, then set `CONTENT_SOURCE=neon`.

The site only ever needs SELECT. Keep the owner string out of your hosting
environment if you can, and run imports from your own machine or CI.

## Writing in the studio

Set `ADMIN_USERNAME` and `ADMIN_PASSWORD` (12+ characters) in `.env.local`, run
`npm run dev`, and open http://localhost:3000/studio. You are sent to
`/studio/login` first; there is one admin and no sign-up. The session is a signed,
httpOnly cookie that lasts seven days, five wrong passwords lock that address out for
15 minutes, and changing the password signs every session out. Pick what you are writing (a
review, a buying guide, a static page, or an article in any of the five formats) and
fill in the form. The form is generated from `lib/content/schema.ts`, so it has every
field the contract allows and checks each one as you type. Upload buttons put your
images in `public/images/<slug>/` and record their size.

Save draft writes `content/<type>/<slug>.json` with `status: "draft"`, which never
appears on the site. Publish writes the same file as `"published"`; the post then shows
on the home page, its category, the listings and the sitemap on the next request, with
no restart. Publishing is refused while anything says TODO, [GAP: ...] or
[UNVERIFIED: ...], so fill in `content/authors.json` before your first post.

The JSON tab shows the file exactly as it will be saved, and accepts a whole pasted
document. Files written by hand and files written in the studio are the same thing.

The studio writes to disk, so it only exists under `npm run dev`, or on a server you
control with `STUDIO_ENABLED=true`. Anywhere else it is a 404. On a serverless host,
write locally, commit, and deploy. If the site reads from Neon, run
`npm run content:import` after saving.

## Adding a how-to, comparison or explainer by hand

Copy `content/articles/export-notely-3-to-markdown.json` and set `format` to one of
`comparison`, `how-to`, `troubleshooting`, `explainer` or `news-analysis`. The `answer`
field is the plain answer to the title and is rendered first. The validator tells you
what each format still needs.

## Adding a review

1. Copy `content/reviews/notely-3-review.json` to a new slug.
2. Fill in your own testing, measurements, prices and sections. Keep `status: "draft"`.
3. Put your screenshots in `public/images/<slug>/` and record real `width`/`height`,
   which lets the renderer use `next/image`.
4. `npm run content:validate` and clear what it reports.
5. Set `status: "published"`, then `npm run content:import`.

### What the validator enforces

Errors (these fail):

- the document does not match the contract in `lib/content/schema.ts`, including
  unknown or misspelled keys
- a published document still containing a `[GAP: ...]` or `[UNVERIFIED: ...]` marker
- a duplicate slug, a category that is not in `categories.json`, a pillar or
  `reviewSlug` that points at nothing, a page slug that shadows a route
- a `sourceId` with no matching `sources` entry
- a date in the future where that makes no sense, or `updated` before `published`

Warnings (advisory, and errors under `--strict`):

- `TODO` left in a published document
- a spec with no `sourceId`, so it is unattributable
- no measurements recorded, fewer than two of your own images, or under 800 words
- a review not attached to a pillar page
- a local image that is not in `public/`

Run `npm run content:validate -- --strict` before you go live.

The contract also refuses to accept a review with an empty `cons` array or no
`skipIf` entries, because a review without downsides is not a review.

## Before you apply for AdSense

The framework handles the plumbing. The rest is your work.

Done for you:

- server-rendered HTML on every content page, so a reviewer sees real content
- `ads.txt` generated from `site.json`, `robots.txt`, `sitemap.xml`
- Review, FAQ, Article, Organization and BreadcrumbList structured data, generated
  from the document so it cannot claim a rating the page does not show
- no ad script until `adsense.enabled` is true and the visitor consents
- ad slots that reserve height, to protect layout shift
- `/search` is `noindex` and disallowed in robots, so it cannot create thin pages

Yours to do:

- **Install a certified consent management platform.** `components/consent.tsx` is a
  minimal gate, not a CMP. Google requires a certified CMP for UK and EEA ad traffic,
  and only a certified CMP passes the right consent signals. Replace it before
  switching ads on.
- Fill in every `TODO` in `content/pages/`, and get the privacy policy and terms
  checked by someone qualified. Both ship as `draft` so they cannot go live unfinished.
- Publish 15 to 25 real reviews at two or three a week. Thin or bulk-published
  content is the usual rejection reason.
- Set `NEXT_PUBLIC_SITE_URL` and the real domain in `site.json`, verify the site in
  Search Console and submit the sitemap.
- Do not publish near-identical UK and US versions of the same review. Pick one
  primary market and use `seo.alternates` only when you have genuinely tested for the
  second region.

Nothing here guarantees approval. Google reviews the content and the publisher, not
the framework.

## After an import

Pages are cached for an hour. To refresh immediately:

```bash
curl -X POST "$SITE/api/revalidate" -H 'content-type: application/json' \
  -d '{"secret":"'"$REVALIDATE_SECRET"'","paths":["/","/reviews/your-slug"]}'
```

## Known limits

- The file driver loads and validates every document in the process on first use.
  Fine into the low thousands; beyond that, use the Neon driver.
- Markdown in section bodies is rendered without sanitising, which is safe because
  you author the JSON. Add a sanitiser if that ever stops being true.
- Full-text search is `websearch_to_tsquery` on title and excerpt only. Extend the
  generated `search` column if you want body text included.
- There is no admin UI. Adding one later does not require changing the JSON contract.
