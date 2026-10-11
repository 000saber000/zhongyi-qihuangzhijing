ALTER TABLE users ADD COLUMN role text NOT NULL DEFAULT 'user' CHECK(role IN ('user','admin'));
ALTER TABLE users ADD COLUMN disabled boolean NOT NULL DEFAULT false;
ALTER TABLE users ADD COLUMN must_change_password boolean NOT NULL DEFAULT false;
CREATE TABLE admin_audit (
  id bigserial PRIMARY KEY,
  actor_id uuid REFERENCES users(id) ON DELETE SET NULL,
  actor_username text NOT NULL,
  target_id uuid REFERENCES users(id) ON DELETE SET NULL,
  target_username text NOT NULL,
  action text NOT NULL CHECK(action IN ('bootstrap','disable','enable','revoke_sessions','reset_password','delete')),
  created_at timestamptz NOT NULL DEFAULT now()
);
