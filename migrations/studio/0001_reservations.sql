-- Apply only to a dedicated STUDIO_DB, never the blog likes binding.
CREATE TABLE IF NOT EXISTS studio_reservations (
 id TEXT PRIMARY KEY,
 visitor TEXT NOT NULL,
 day TEXT NOT NULL,
 input_hash TEXT NOT NULL,
 units INTEGER NOT NULL CHECK(units>0),
 state TEXT NOT NULL CHECK(state IN ('reserved','committed','consumed-failure'))
);
CREATE INDEX IF NOT EXISTS studio_daily_visitor ON studio_reservations(day,visitor);
CREATE TABLE IF NOT EXISTS studio_upload_limits(id TEXT PRIMARY KEY,visitor TEXT NOT NULL,day TEXT NOT NULL);
CREATE INDEX IF NOT EXISTS studio_upload_day ON studio_upload_limits(day,visitor);
