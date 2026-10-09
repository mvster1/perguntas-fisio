-- funcao minima usada pela rotina de keep-alive: o plano gratuito do supabase
-- pausa o projeto depois de cerca de 7 dias sem requisicoes, e chamar isto a
-- cada poucos dias reinicia essa contagem.
--
-- ela executa sql de verdade, e nao apenas responde no edge, que e o que faz a
-- chamada contar como atividade do banco. nao recebe senha nem le dado nenhum.
create or replace function ping()
returns text
language sql
security definer
set search_path = public
as $$
  select 'ok'::text;
$$;

grant execute on function ping() to anon;
