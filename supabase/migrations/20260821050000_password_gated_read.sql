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
    raise exception 'senha invalida' using errcode = '28000';
  end if;
end;
$$;

create or replace function enviar_pergunta(p_pergunta text, p_senha text)
returns void
language plpgsql
security definer
set search_path = public, vault
as $$
begin
  perform checar_senha(p_senha);
  insert into perguntas (pergunta) values (p_pergunta);
end;
$$;

create function listar_perguntas(p_senha text)
returns setof perguntas
language plpgsql
security definer
set search_path = public, vault
as $$
begin
  perform checar_senha(p_senha);
  return query select * from perguntas order by id desc limit 20;
end;
$$;

drop policy if exists "Allow public read" on perguntas;

grant execute on function listar_perguntas(text) to anon;
