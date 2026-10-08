CREATE TABLE attempts (
  id TEXT PRIMARY KEY,
  activity_id TEXT NOT NULL,
  activity_version INTEGER NOT NULL,
  status TEXT NOT NULL CHECK(status IN ('open', 'completed')),
  revision INTEGER NOT NULL,
  draft_json TEXT NOT NULL,
  reflection TEXT NOT NULL DEFAULT ''
);
CREATE TABLE submissions (
  id TEXT PRIMARY KEY,
  attempt_id TEXT NOT NULL REFERENCES attempts(id),
  number INTEGER NOT NULL,
  input_json TEXT NOT NULL,
  result_json TEXT,
  feedback_json TEXT,
  UNIQUE(attempt_id, number)
);
