alter table perguntas
  add column disciplina text;

drop function if exists enviar_pergunta(text, text);

create function enviar_pergunta(p_pergunta text, p_senha text, p_disciplina text)
returns void
language plpgsql
security definer
set search_path = public, vault
as $$
begin
  perform checar_senha(p_senha);
  insert into perguntas (pergunta, disciplina) values (p_pergunta, p_disciplina);
end;
$$;

grant execute on function enviar_pergunta(text, text, text) to anon;
