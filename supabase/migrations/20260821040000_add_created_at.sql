alter table perguntas
  add column created_at timestamptz not null default now();
