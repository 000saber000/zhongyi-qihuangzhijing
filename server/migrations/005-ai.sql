ALTER TABLE admin_audit DROP CONSTRAINT admin_audit_action_check;
ALTER TABLE admin_audit ADD CONSTRAINT admin_audit_action_check CHECK(action IN ('bootstrap','disable','enable','revoke_sessions','reset_password','delete','ai_config_update','ai_connection_test'));

CREATE TABLE ai_settings (
 id integer PRIMARY KEY CHECK (id=1),
 provider text NOT NULL DEFAULT 'deepseek',
 model text NOT NULL DEFAULT 'deepseek-chat',
 enabled boolean NOT NULL DEFAULT false,
 encrypted_key text,
 daily_limit integer NOT NULL DEFAULT 10 CHECK (daily_limit BETWEEN 1 AND 100),
 global_daily_limit integer NOT NULL DEFAULT 200 CHECK (global_daily_limit BETWEEN 1 AND 10000),
 max_tokens integer NOT NULL DEFAULT 1024 CHECK (max_tokens BETWEEN 128 AND 2048),
 version integer NOT NULL DEFAULT 0,
 updated_by uuid REFERENCES users(id) ON DELETE SET NULL,
 updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE ai_usage (
 day date NOT NULL,
 scope text NOT NULL,
 used integer NOT NULL DEFAULT 0 CHECK (used>=0),
 PRIMARY KEY(day,scope)
);
CREATE TABLE ai_activity (
 user_id uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
 request_id uuid NOT NULL,
 expires_at timestamptz NOT NULL
);
