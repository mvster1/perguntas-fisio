-- a coluna resposta já existia no banco, criada fora das migrações;
-- declarada aqui para o histórico voltar a reproduzir o esquema real.
alter table perguntas
  add column if not exists resposta text;

drop function if exists enviar_pergunta(text, text, text);

create function enviar_pergunta(
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
  insert into perguntas (pergunta, disciplina, resposta)
  values (p_pergunta, p_disciplina, p_resposta);
end;
$$;

grant execute on function enviar_pergunta(text, text, text, text) to anon;
