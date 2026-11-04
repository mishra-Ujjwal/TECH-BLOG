-- ReviewKit, Neon Postgres schema.
--
-- Design: each piece of content is one authored JSON document. We store the whole
-- document in `doc` (jsonb) and copy the fields we filter and sort on into real
-- columns. That keeps the hand-authored JSON as the single source of truth while
-- still giving the site indexed queries.
--
-- `summary` holds the small object listings need, so a category page never has to
-- read full documents.

CREATE TABLE IF NOT EXISTS _migrations (
  name       text PRIMARY KEY,
  applied_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS content (
  id           bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  type         text NOT NULL CHECK (type IN ('review','pillar','page')),
  slug         text NOT NULL,
  locale       text NOT NULL CHECK (locale IN ('en-GB','en-US')),
  status       text NOT NULL CHECK (status IN ('draft','published')),
  title        text NOT NULL,
  excerpt      text NOT NULL,
  category     text,
  pillar       text,
  score        numeric(3,1),
  published_at date NOT NULL,
  updated_at   date,
  last_checked date,
  tags         jsonb NOT NULL DEFAULT '[]'::jsonb,
  -- The authored document, exactly as validated.
  doc          jsonb NOT NULL,
  -- Light projection for listings.
  summary      jsonb NOT NULL,
  -- Source file, so you can trace a row back to the repo.
  source_path  text,
  content_hash text NOT NULL,
  imported_at  timestamptz NOT NULL DEFAULT now(),
  search       tsvector GENERATED ALWAYS AS (
                 to_tsvector('english'::regconfig,
                   coalesce(title,'') || ' ' || coalesce(excerpt,''))
               ) STORED,
  UNIQUE (type, slug)
);

CREATE INDEX IF NOT EXISTS content_published_idx
  ON content (status, type, published_at DESC);
CREATE INDEX IF NOT EXISTS content_category_idx
  ON content (status, category, published_at DESC);
CREATE INDEX IF NOT EXISTS content_pillar_idx
  ON content (status, pillar, published_at DESC);
CREATE INDEX IF NOT EXISTS content_search_idx
  ON content USING gin (search);
CREATE INDEX IF NOT EXISTS content_tags_idx
  ON content USING gin (tags);

-- Licence audit trail. One row per distinct external source you took facts from.
CREATE TABLE IF NOT EXISTS sources (
  id          text PRIMARY KEY,
  name        text NOT NULL,
  url         text,
  licence     text NOT NULL,
  licence_url text,
  attribution text,
  first_seen  timestamptz NOT NULL DEFAULT now(),
  last_seen   timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS content_sources (
  content_id bigint NOT NULL REFERENCES content(id) ON DELETE CASCADE,
  source_id  text   NOT NULL REFERENCES sources(id),
  fetched_at date,
  PRIMARY KEY (content_id, source_id)
);

-- Price history. The importer appends rather than overwrites, so you keep a record
-- of what you published and when you checked it.
CREATE TABLE IF NOT EXISTS price_snapshots (
  id         bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  content_id bigint NOT NULL REFERENCES content(id) ON DELETE CASCADE,
  retailer   text NOT NULL,
  amount     numeric(10,2) NOT NULL,
  currency   text NOT NULL CHECK (currency IN ('GBP','USD','EUR')),
  url        text,
  affiliate  boolean NOT NULL DEFAULT false,
  checked_at date NOT NULL,
  note       text,
  UNIQUE (content_id, retailer, amount, currency, checked_at)
);

CREATE INDEX IF NOT EXISTS price_snapshots_content_idx
  ON price_snapshots (content_id, checked_at DESC);

-- What each import run did.
CREATE TABLE IF NOT EXISTS import_log (
  id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  started_at  timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  files_seen  integer NOT NULL DEFAULT 0,
  upserted    integer NOT NULL DEFAULT 0,
  skipped     integer NOT NULL DEFAULT 0,
  removed     integer NOT NULL DEFAULT 0,
  errors      jsonb NOT NULL DEFAULT '[]'::jsonb
);

-- ---------------------------------------------------------------------------
-- Least privilege. Run these once in the Neon SQL editor as the owner role,
-- then put the site_reader connection string in DATABASE_URL and keep the owner
-- string in DATABASE_URL_ADMIN (used only by db:migrate and content:import).
--
--   CREATE ROLE site_reader WITH LOGIN PASSWORD 'choose-a-strong-one';
--   GRANT CONNECT ON DATABASE reviewkit TO site_reader;
--   GRANT USAGE ON SCHEMA public TO site_reader;
--   GRANT SELECT ON content, sources, content_sources, price_snapshots TO site_reader;
--   ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO site_reader;
--
-- The site never needs INSERT, UPDATE or DELETE. Draft rows are filtered in SQL,
-- and because the reader cannot write, a bug in the app cannot publish a draft.
-- ---------------------------------------------------------------------------
