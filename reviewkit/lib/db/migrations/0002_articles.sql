-- Articles: comparisons, how-tos, troubleshooting, explainers and news analysis.
-- They share the content table; only the type check needs widening.

ALTER TABLE content DROP CONSTRAINT IF EXISTS content_type_check;
ALTER TABLE content
  ADD CONSTRAINT content_type_check CHECK (type IN ('review','pillar','page','article'));
