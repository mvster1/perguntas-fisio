-- guarda a letra da alternativa correta. antes disso a correta era deduzida
-- comparando o texto de cada alternativa com resposta, o que marcava mais de
-- uma quando duas alternativas tinham o mesmo texto
alter table perguntas
  add column if not exists correta text;

-- preenche o que ja existe pela primeira alternativa que casa com resposta
update perguntas
   set correta = case
     when resposta is not null and alt_a = resposta then 'a'
     when resposta is not null and alt_b = resposta then 'b'
     when resposta is not null and alt_c = resposta then 'c'
     when resposta is not null and alt_d = resposta then 'd'
     else 'a'
   end
 where correta is null;

alter table perguntas
  alter column correta set not null,
  add constraint correta_valida check (correta in ('a', 'b', 'c', 'd'));

drop function if exists enviar_pergunta(text, text, text, text, text, text, text, text, text, text);

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
  p_correta text
)
returns void
language plpgsql
security definer
set search_path = public, vault
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

grant execute on function enviar_pergunta(text, text, text, text, text, text, text, text, text, text, text) to anon;

drop function if exists atualizar_pergunta(bigint, text, text, text, text, text, text, text, text, text, text);

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
  p_correta text
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
         dica_bonus = btrim(p_dica_bonus),
         correta = p_correta
   where id = p_id;

  if not found then
    raise exception 'pergunta inexistente' using errcode = 'P0002';
  end if;
end;
$$;

grant execute on function atualizar_pergunta(bigint, text, text, text, text, text, text, text, text, text, text, text) to anon;
