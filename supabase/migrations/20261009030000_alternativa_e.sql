-- quinta alternativa. fica nullable porque as perguntas anteriores tem so
-- quatro; as funcoes abaixo exigem a alternativa e em todo envio e edicao
alter table perguntas
  add column if not exists alt_e text;

alter table perguntas
  drop constraint correta_valida,
  add constraint correta_valida check (correta in ('a', 'b', 'c', 'd', 'e'));

drop function if exists enviar_pergunta(text, text, text, text, text, text, text, text, text, text, text, smallint);

create function enviar_pergunta(
  p_pergunta text,
  p_senha text,
  p_disciplina text,
  p_resposta text,
  p_alt_a text,
  p_alt_b text,
  p_alt_c text,
  p_alt_d text,
  p_alt_e text,
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

  if coalesce(btrim(p_alt_e), '') = '' then
    raise exception 'alternativa e obrigatoria' using errcode = '23502';
  end if;

  insert into perguntas
    (pergunta, disciplina, resposta, alt_a, alt_b, alt_c, alt_d, alt_e,
     dificuldade, dica_bonus, correta, uce_id)
  values
    (p_pergunta, p_disciplina, p_resposta, p_alt_a, p_alt_b, p_alt_c, p_alt_d,
     p_alt_e, p_dificuldade, btrim(p_dica_bonus), p_correta, p_uce_id);
end;
$$;

grant execute on function enviar_pergunta(text, text, text, text, text, text, text, text, text, text, text, text, smallint) to anon;

drop function if exists atualizar_pergunta(bigint, text, text, text, text, text, text, text, text, text, text, text, smallint);

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
  p_alt_e text,
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

  if coalesce(btrim(p_alt_e), '') = '' then
    raise exception 'alternativa e obrigatoria' using errcode = '23502';
  end if;

  update perguntas
     set pergunta = p_pergunta,
         disciplina = p_disciplina,
         resposta = p_resposta,
         alt_a = p_alt_a,
         alt_b = p_alt_b,
         alt_c = p_alt_c,
         alt_d = p_alt_d,
         alt_e = p_alt_e,
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

grant execute on function atualizar_pergunta(bigint, text, text, text, text, text, text, text, text, text, text, text, text, smallint) to anon;
