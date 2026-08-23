-- freia forca bruta contra a senha: cada tentativa errada custa meio segundo,
-- e quem acerta nao paga nada. nao e um bloqueio por tentativas, que exigiria
-- transacao autonoma: a excecao abaixo faria rollback de qualquer registro.
create or replace function checar_senha(p_senha text)
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
    perform pg_sleep(0.5);
    raise exception 'senha invalida' using errcode = '28000';
  end if;
end;
$$;
