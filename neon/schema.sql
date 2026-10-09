-- Esquema completo para um banco novo no Neon.
--
-- Equivale ao estado final das migracoes de supabase/migrations/, com duas
-- diferencas obrigatorias, porque sao coisas que so existem no Supabase:
--
--   1. a senha saia do supabase vault e passa a ficar aqui, com hash bcrypt.
--      alem de ser o unico caminho possivel, e mais seguro: nem quem tem acesso
--      administrativo ao banco consegue ler a senha de volta.
--   2. o papel `anon` do supabase vira `anonymous`, que e o papel usado pela
--      data api do neon quando a requisicao chega sem cabecalho Authorization.
--
-- Rode este arquivo uma unica vez, no SQL Editor do projeto Neon.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------- tabela

create table if not exists perguntas (
  id          bigint generated always as identity primary key,
  pergunta    text        not null,
  alt_a       text        not null,
  alt_b       text        not null,
  alt_c       text        not null,
  alt_d       text        not null,
  correta     text        not null,
  resposta    text        not null,
  disciplina  text        not null,
  dificuldade text        not null,
  dica_bonus  text        not null,
  created_at  timestamptz not null default now(),

  constraint correta_valida       check (correta in ('a', 'b', 'c', 'd')),
  constraint dica_bonus_nao_vazia check (btrim(dica_bonus) <> '')
);

alter table perguntas enable row level security;

-- sem nenhuma policy: o papel anonymous nao le nem grava direto na tabela.
-- o unico caminho sao as funcoes security definer abaixo.

-- ------------------------------------------------------------ senha

create table if not exists configuracao (
  chave text primary key,
  valor text not null
);

alter table configuracao enable row level security;

-- guarda a senha ja com hash; o valor original nao fica em lugar nenhum.
-- troque 'SENHA_AQUI' antes de rodar, ou rode este insert separado depois.
insert into configuracao (chave, valor)
values ('senha_formulario', crypt('SENHA_AQUI', gen_salt('bf')))
on conflict (chave) do nothing;

-- ---------------------------------------------------------- funcoes

create or replace function checar_senha(p_senha text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_hash text;
begin
  select valor into v_hash
    from configuracao
   where chave = 'senha_formulario';

  if v_hash is null or crypt(p_senha, v_hash) <> v_hash then
    -- encarece a forca bruta sem punir quem acerta
    perform pg_sleep(0.5);
    raise exception 'senha invalida' using errcode = '28000';
  end if;
end;
$$;

create or replace function listar_perguntas(p_senha text)
returns setof perguntas
language plpgsql
security definer
set search_path = public
as $$
begin
  perform checar_senha(p_senha);
  return query select * from perguntas order by id desc;
end;
$$;

create or replace function enviar_pergunta(
  p_pergunta text,
  p_senha text,
  p_disciplina text,
  p_resposta text,
  p_alt_a text,
  p_alt_b text,
  p_alt_c text,
  p_alt_d text,
  p_dificuldade text,
  p_dica_bonus text,
  p_correta text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  perform checar_senha(p_senha);
  insert into perguntas
    (pergunta, disciplina, resposta, alt_a, alt_b, alt_c, alt_d, dificuldade,
     dica_bonus, correta)
  values
    (p_pergunta, p_disciplina, p_resposta, p_alt_a, p_alt_b, p_alt_c, p_alt_d,
     p_dificuldade, btrim(p_dica_bonus), p_correta);
end;
$$;

create or replace function atualizar_pergunta(
  p_id bigint,
  p_pergunta text,
  p_senha text,
  p_disciplina text,
  p_resposta text,
  p_alt_a text,
  p_alt_b text,
  p_alt_c text,
  p_alt_d text,
  p_dificuldade text,
  p_dica_bonus text,
  p_correta text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  perform checar_senha(p_senha);

  update perguntas
     set pergunta = p_pergunta,
         disciplina = p_disciplina,
         resposta = p_resposta,
         alt_a = p_alt_a,
         alt_b = p_alt_b,
         alt_c = p_alt_c,
         alt_d = p_alt_d,
         dificuldade = p_dificuldade,
         dica_bonus = btrim(p_dica_bonus),
         correta = p_correta
   where id = p_id;

  if not found then
    raise exception 'pergunta inexistente' using errcode = 'P0002';
  end if;
end;
$$;

create or replace function excluir_pergunta(p_id bigint, p_senha text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  perform checar_senha(p_senha);

  delete from perguntas where id = p_id;

  if not found then
    raise exception 'pergunta inexistente' using errcode = 'P0002';
  end if;
end;
$$;

-- --------------------------------------------------------- permissoes

-- o papel anonymous atende as requisicoes que chegam sem Authorization,
-- que e exatamente o que a pagina faz.
grant usage on schema public to anonymous;

grant execute on function checar_senha(text)                                             to anonymous;
grant execute on function listar_perguntas(text)                                         to anonymous;
grant execute on function enviar_pergunta(text, text, text, text, text, text, text, text, text, text, text) to anonymous;
grant execute on function atualizar_pergunta(bigint, text, text, text, text, text, text, text, text, text, text, text) to anonymous;
grant execute on function excluir_pergunta(bigint, text)                                 to anonymous;

-- nenhum acesso direto as tabelas; so as funcoes acima.
revoke all on perguntas    from anonymous;
revoke all on configuracao from anonymous;
