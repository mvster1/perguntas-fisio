create or replace function enviar_pergunta(p_pergunta text, p_senha text)
returns void
language plpgsql
security definer
set search_path = public, vault
as $$
declare
  v_senha text;
begin
  select decrypted_secret into v_senha
  from vault.decrypted_secrets
  where name = 'senha_formulario';

  if v_senha is null or p_senha is distinct from v_senha then
    raise exception 'senha invalida' using errcode = '28000';
  end if;

  insert into perguntas (pergunta) values (p_pergunta);
end;
$$;

grant execute on function enviar_pergunta(text, text) to anon;
