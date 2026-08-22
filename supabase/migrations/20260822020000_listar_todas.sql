-- a listagem passa a devolver todas as perguntas, sem o limite de 20
create or replace function listar_perguntas(p_senha text)
returns setof perguntas
language plpgsql
security definer
set search_path = public, vault
as $$
begin
  perform checar_senha(p_senha);
  return query select * from perguntas order by id desc;
end;
$$;
