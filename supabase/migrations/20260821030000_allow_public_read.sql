create policy "Allow public read"
on perguntas
for select
to anon
using (true);
