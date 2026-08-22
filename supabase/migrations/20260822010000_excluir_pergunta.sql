create function excluir_pergunta(p_id bigint, p_senha text)
returns void
language plpgsql
security definer
set search_path = public, vault
as $$
begin
  perform checar_senha(p_senha);

  delete from perguntas where id = p_id;

  if not found then
    raise exception 'pergunta inexistente' using errcode = 'P0002';
  end if;
end;
$$;

grant execute on function excluir_pergunta(bigint, text) to anon;
