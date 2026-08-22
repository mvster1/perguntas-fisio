-- coluna criada pelo painel; declarada aqui para o historico reproduzir o esquema
alter table perguntas
  add column if not exists dica_bonus text;

drop function if exists enviar_pergunta(text, text, text, text, text, text, text, text, text);

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
  p_dica_bonus text
)
returns void
language plpgsql
security definer
set search_path = public, vault
as $$
begin
  perform checar_senha(p_senha);
  insert into perguntas
    (pergunta, disciplina, resposta, alt_a, alt_b, alt_c, alt_d, dificuldade, dica_bonus)
  values
    (p_pergunta, p_disciplina, p_resposta, p_alt_a, p_alt_b, p_alt_c, p_alt_d,
     p_dificuldade, nullif(btrim(p_dica_bonus), ''));
end;
$$;

grant execute on function enviar_pergunta(text, text, text, text, text, text, text, text, text, text) to anon;

drop function if exists atualizar_pergunta(bigint, text, text, text, text, text, text, text, text, text);

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
  p_dica_bonus text
)
returns void
language plpgsql
security definer
set search_path = public, vault
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
         dica_bonus = nullif(btrim(p_dica_bonus), '')
   where id = p_id;

  if not found then
    raise exception 'pergunta inexistente' using errcode = 'P0002';
  end if;
end;
$$;

grant execute on function atualizar_pergunta(bigint, text, text, text, text, text, text, text, text, text, text) to anon;
