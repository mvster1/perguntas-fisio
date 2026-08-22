create function atualizar_pergunta(
  p_id bigint,
  p_pergunta text,
  p_senha text,
  p_disciplina text,
  p_resposta text
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
         resposta = p_resposta
   where id = p_id;

  if not found then
    raise exception 'pergunta inexistente' using errcode = 'P0002';
  end if;
end;
$$;

grant execute on function atualizar_pergunta(bigint, text, text, text, text) to anon;
