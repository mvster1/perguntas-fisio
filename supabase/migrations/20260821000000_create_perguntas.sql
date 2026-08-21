create table perguntas (
  id bigint generated always as identity primary key,
  pergunta text not null
);

alter table perguntas enable row level security;

create policy "Allow public insert"
on perguntas
for insert
to anon
with check (true);
