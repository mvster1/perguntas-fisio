-- a uce deixa de ser registrada por acesso e passa a pertencer a pergunta,
-- escolhida no proprio formulario. a tabela de acessos nunca foi usada pelo
-- site publicado, entao sai sem migrar nada.
drop function if exists registrar_uce(integer, text);
drop table if exists acessos_uce;

create table if not exists uces (
  id   smallint primary key,
  nome text     not null unique,

  constraint uce_valida check (id between 1 and 8)
);

insert into uces (id, nome)
select n, 'UCE ' || n
  from generate_series(1, 8) as n
on conflict (id) do nothing;

-- mesma regra de perguntas: rls ativa e nenhuma policy
alter table uces enable row level security;

-- fica nullable porque as perguntas anteriores nao tem uce; as funcoes abaixo
-- exigem o valor em todo envio e edicao
alter table perguntas
  add column if not exists uce_id smallint references uces (id);

drop function if exists enviar_pergunta(text, text, text, text, text, text, text, text, text, text, text);

create function enviar_pergunta(
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
  p_correta text,
  p_uce_id smallint
)
returns void
language plpgsql
security definer
set search_path = public, vault
as $$
begin
  perform checar_senha(p_senha);

  if p_uce_id is null then
    raise exception 'uce obrigatoria' using errcode = '23502';
  end if;

  insert into perguntas
    (pergunta, disciplina, resposta, alt_a, alt_b, alt_c, alt_d, dificuldade,
     dica_bonus, correta, uce_id)
  values
    (p_pergunta, p_disciplina, p_resposta, p_alt_a, p_alt_b, p_alt_c, p_alt_d,
     p_dificuldade, btrim(p_dica_bonus), p_correta, p_uce_id);
end;
$$;

grant execute on function enviar_pergunta(text, text, text, text, text, text, text, text, text, text, text, smallint) to anon;

drop function if exists atualizar_pergunta(bigint, text, text, text, text, text, text, text, text, text, text, text);

create function atualizar_pergunta(
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
  p_correta text,
  p_uce_id smallint
)
returns void
language plpgsql
security definer
set search_path = public, vault
as $$
begin
  perform checar_senha(p_senha);

  if p_uce_id is null then
    raise exception 'uce obrigatoria' using errcode = '23502';
  end if;

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
         correta = p_correta,
         uce_id = p_uce_id
   where id = p_id;

  if not found then
    raise exception 'pergunta inexistente' using errcode = 'P0002';
  end if;
end;
$$;

grant execute on function atualizar_pergunta(bigint, text, text, text, text, text, text, text, text, text, text, text, smallint) to anon;
