CREATE TABLE workspaces (id TEXT PRIMARY KEY, name TEXT NOT NULL);
CREATE TABLE systems (id TEXT NOT NULL, workspace_id TEXT NOT NULL REFERENCES workspaces(id), name TEXT NOT NULL, PRIMARY KEY(workspace_id, id));
CREATE TABLE experiments (id TEXT PRIMARY KEY, system_id TEXT NOT NULL, definition TEXT NOT NULL);
CREATE TABLE checkpoints (
  id TEXT PRIMARY KEY, workspace_id TEXT NOT NULL, system_id TEXT NOT NULL,
  commit_hash TEXT NOT NULL, digest TEXT NOT NULL, message TEXT NOT NULL, created_at INTEGER NOT NULL,
  FOREIGN KEY(workspace_id, system_id) REFERENCES systems(workspace_id, id)
);
CREATE TABLE runs (
  number INTEGER PRIMARY KEY AUTOINCREMENT, id TEXT UNIQUE NOT NULL,
  workspace_id TEXT NOT NULL, system_id TEXT NOT NULL, experiment_id TEXT NOT NULL REFERENCES experiments(id),
  status TEXT NOT NULL CHECK(status IN ('running','passed','failed','error','interrupted')),
  created_at INTEGER NOT NULL, completed_at INTEGER, duration_ms REAL,
  config TEXT NOT NULL, code TEXT NOT NULL, checkpoint_id TEXT REFERENCES checkpoints(id),
  initial_state TEXT, final_state TEXT, result TEXT, error TEXT,
  FOREIGN KEY(workspace_id, system_id) REFERENCES systems(workspace_id, id)
);
CREATE TABLE evidence (
  run_id TEXT NOT NULL REFERENCES runs(id), sequence INTEGER NOT NULL, timestamp INTEGER NOT NULL,
  source TEXT NOT NULL, type TEXT NOT NULL, request_id TEXT, payload TEXT NOT NULL,
  PRIMARY KEY(run_id, sequence)
);
CREATE TABLE requests (
  run_id TEXT NOT NULL REFERENCES runs(id), id TEXT NOT NULL, started_at INTEGER NOT NULL,
  duration_ms REAL NOT NULL, status INTEGER, body TEXT NOT NULL, error TEXT,
  PRIMARY KEY(run_id, id)
);
CREATE INDEX runs_by_system ON runs(workspace_id, system_id, number DESC);
CREATE INDEX checkpoints_by_system ON checkpoints(workspace_id, system_id, created_at DESC);
