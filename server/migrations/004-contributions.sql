CREATE TABLE classic_comments (
  id uuid PRIMARY KEY,
  classic_id text NOT NULL REFERENCES knowledge_entries(id) ON DELETE CASCADE,
  user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  author_username text NOT NULL,
  body text NOT NULL CHECK (char_length(body) BETWEEN 1 AND 2000),
  created_at timestamptz NOT NULL DEFAULT now(),
  hidden_at timestamptz,
  hidden_by uuid REFERENCES users(id) ON DELETE SET NULL
);
CREATE INDEX classic_comments_page ON classic_comments(classic_id,created_at DESC,id) WHERE hidden_at IS NULL;
CREATE INDEX classic_comments_rate ON classic_comments(user_id,created_at);

CREATE TABLE classic_suggestions (
  id uuid PRIMARY KEY,
  classic_id text NOT NULL REFERENCES knowledge_entries(id) ON DELETE CASCADE,
  user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  author_username text NOT NULL,
  base jsonb NOT NULL,
  changes jsonb NOT NULL,
  reason text NOT NULL CHECK (char_length(reason) BETWEEN 1 AND 2000),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','merged','rejected')),
  created_at timestamptz NOT NULL DEFAULT now(),
  reviewed_at timestamptz,
  reviewed_by uuid REFERENCES users(id) ON DELETE SET NULL,
  review_note text NOT NULL DEFAULT '',
  merged_version integer
);
CREATE INDEX classic_suggestions_queue ON classic_suggestions(status,created_at,id);
CREATE INDEX classic_suggestions_member ON classic_suggestions(user_id,created_at DESC,id);
