-- a dificuldade saiu do formulario: novas perguntas e edicoes gravam null.
-- as funcoes de envio e edicao continuam recebendo p_dificuldade, so que o
-- cliente passa sempre null, entao a assinatura nao muda.
alter table perguntas
  alter column dificuldade drop not null;

-- registra a uce (1 a 8) informada logo depois da senha, uma linha por acesso
create table if not exists acessos_uce (
  id         bigint generated always as identity primary key,
  uce        smallint    not null,
  created_at timestamptz not null default now(),

  constraint uce_valida check (uce between 1 and 8)
);

-- mesma regra de perguntas: rls ativa e nenhuma policy, so a funcao abaixo grava
alter table acessos_uce enable row level security;

create or replace function registrar_uce(p_uce integer, p_senha text)
returns void
language plpgsql
security definer
set search_path = public, vault
as $$
begin
  perform checar_senha(p_senha);
  insert into acessos_uce (uce) values (p_uce);
end;
$$;

grant execute on function registrar_uce(integer, text) to anon;
