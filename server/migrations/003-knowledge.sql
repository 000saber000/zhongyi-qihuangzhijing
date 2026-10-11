CREATE TABLE knowledge_entries (
  id text PRIMARY KEY,
  draft jsonb NOT NULL,
  published jsonb,
  version integer NOT NULL DEFAULT 1 CHECK (version > 0),
  updated_by uuid REFERENCES users(id) ON DELETE SET NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);
