-- as colunas ja haviam sido criadas pelo painel; declaradas aqui para o
-- historico reproduzir o esquema real
alter table perguntas
  add column if not exists alt_a text,
  add column if not exists alt_b text,
  add column if not exists alt_c text,
  add column if not exists alt_d text;

drop function if exists enviar_pergunta(text, text, text, text);

create function enviar_pergunta(
  p_pergunta text,
  p_senha text,
  p_disciplina text,
  p_resposta text,
  p_alt_a text,
  p_alt_b text,
  p_alt_c text,
  p_alt_d text
)
returns void
language plpgsql
security definer
set search_path = public, vault
as $$
begin
  perform checar_senha(p_senha);
  insert into perguntas (pergunta, disciplina, resposta, alt_a, alt_b, alt_c, alt_d)
  values (p_pergunta, p_disciplina, p_resposta, p_alt_a, p_alt_b, p_alt_c, p_alt_d);
end;
$$;

grant execute on function enviar_pergunta(text, text, text, text, text, text, text, text) to anon;

drop function if exists atualizar_pergunta(bigint, text, text, text, text);

create function atualizar_pergunta(
  p_id bigint,
  p_pergunta text,
  p_senha text,
  p_disciplina text,
  p_resposta text,
  p_alt_a text,
  p_alt_b text,
  p_alt_c text,
  p_alt_d text
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
         alt_d = p_alt_d
   where id = p_id;

  if not found then
    raise exception 'pergunta inexistente' using errcode = 'P0002';
  end if;
end;
$$;

grant execute on function atualizar_pergunta(bigint, text, text, text, text, text, text, text, text) to anon;
