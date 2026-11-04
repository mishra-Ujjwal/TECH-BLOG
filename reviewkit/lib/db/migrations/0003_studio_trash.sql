-- The studio on a database-backed site. Deleting a post there moves its document
-- here instead of erasing it, the same promise content/.trash/ makes on disk, so a
-- mistake can be undone by putting the row back.

CREATE TABLE IF NOT EXISTS content_trash (
  id         bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  type       text NOT NULL,
  slug       text NOT NULL,
  doc        jsonb NOT NULL,
  reason     text NOT NULL CHECK (reason IN ('deleted','renamed')),
  trashed_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS content_trash_slug_idx ON content_trash (type, slug, trashed_at DESC);
