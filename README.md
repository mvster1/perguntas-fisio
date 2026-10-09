# perguntas-fisio

coletor de perguntas e respostas de fisioterapia, organizado pela grade do
curso. html, css e javascript puros no navegador; postgres no supabase como
único backend. sem framework e sem build; a única dependência externa da página
é a fonte inter, servida pelo google fonts.

acesso: <https://mvster1.github.io/perguntas-fisio/>

### uso

a versão publicada é servida pelo github pages a partir deste repositório. como
o `config.js` é versionado e não existe etapa de build, um `git push` na `main`
já atualiza o site. ao abrir, a página pede a senha; a mesma vale para enviar,
editar e excluir.

para rodar localmente:

```
git clone https://github.com/mvster1/perguntas-fisio.git
cd perguntas-fisio
npm install
cp .env.example .env      # preencha com a url e a chave publicável
npm run config            # gera o config.js
python -m http.server 8000
```

para levantar um banco do zero, aplique as migrações e cadastre a senha:

```
npx supabase link --project-ref SEU_REF
npx supabase db push
```

```sql
select vault.create_secret('sua-senha', 'senha_formulario');
```

### detalhamento técnico

#### arquitetura

três arquivos: `index.html`, com marcação, estilo e a lista fixa de disciplinas;
`script.js`, com toda a lógica; e `config.js`, gerado a partir do `.env`. nenhuma
biblioteca é carregada no navegador, o `fetch` conversa direto com a api rest do
supabase e o css mora no `<style>` do próprio html.

toda a autorização vive no banco; o cliente apenas repassa a senha digitada.

#### banco

tabela única, `perguntas`:

| coluna | tipo | conteúdo |
| --- | --- | --- |
| `id` | `bigint` | identidade, chave primária |
| `pergunta` | `text` | enunciado |
| `alt_a` a `alt_d` | `text` | as quatro alternativas |
| `correta` | `text` | letra da certa; `check` limita a `a`, `b`, `c` ou `d` |
| `resposta` | `text` | texto da alternativa correta, copiado no envio |
| `disciplina` | `text` | exatamente como aparece na picklist |
| `dificuldade` | `text` | sempre `null` nas novas; antigas guardam `Baixa`, `Média` ou `Alta` |
| `uce_id` | `smallint` | chave estrangeira para `uces`; nula só nas perguntas antigas |
| `dica_bonus` | `text` | `check` recusa texto vazio |
| `created_at` | `timestamptz` | `default now()` |

**todas as colunas, exceto `dificuldade` e `uce_id`, são `not null`**: uma pergunta
incompleta não serve ao jogo, que precisa das alternativas, da correta e da dica
para montar uma rodada. a regra vive no banco, não só no formulário. a
dificuldade saiu do formulário e o cliente passa sempre `null`.

a uce mora numa segunda tabela, `uces`, com `id` (`smallint`, `check` de 1 a 8)
e `nome` (`UCE 1` a `UCE 8`), já preenchida pela migração. `perguntas.uce_id`
aponta para ela; a coluna aceita null só porque as perguntas anteriores não têm
uce, e as funções de envio e edição recusam envio sem ela.

as duas tabelas têm row level security ativa e nenhuma política, de modo que o papel
`anon` não lê nem grava diretamente: o único caminho são estas funções, todas
`security definer` e com execução concedida a `anon`:

- `checar_senha(p_senha)`: compara com o segredo do vault e levanta exceção se
  não bater.
- `enviar_pergunta(...)`: insere, recebendo todos os campos mais a senha.
- `atualizar_pergunta(p_id, ...)`: mesma lista, precedida do `id`.
- `excluir_pergunta(p_id, p_senha)`: apaga a linha.
- `listar_perguntas(p_senha)`: devolve tudo, por `id` decrescente.

a senha correta nunca chega ao cliente: fica no supabase vault, sob o nome
`senha_formulario`, e a comparação acontece dentro do banco.

as migrações em `supabase/migrations/` são cumulativas e precisam ser aplicadas
em ordem. várias colunas nasceram no painel do supabase e só depois foram
declaradas, por isso usam `add column if not exists`. cada mudança na lista de
campos derruba a versão anterior de `enviar_pergunta` e `atualizar_pergunta`
antes de recriá-las, senão o postgrest ficaria com sobrecargas ambíguas.

#### formulário

a página só aparece depois que a senha digitada no `prompt()` nativo é aceita
por `listar_perguntas`; a senha fica em memória para as chamadas seguintes. a
exclusão pede a senha de novo, por ser a única ação destrutiva.

os campos são uce, enunciado, disciplina, as quatro alternativas com a marcação da
correta e a dica bônus. faltando qualquer um, o envio para e o
motivo aparece no status.

a disciplina vem de um `<select>` com as 67 unidades curriculares do curso,
agrupadas por semestre; as unidades de extensão ficaram de fora. abaixo dele há
uma busca que filtra as opções ignorando acentos e caixa, de modo que
`musculoesquel` encontra "Musculoesquelética". a lista é fixa no html e o banco
guarda só a string escolhida, sem constraint que a valide.

marcar uma alternativa desmarca as outras. no envio, a letra vai para `correta`
e o texto para `resposta`; é a letra que permite destacar a certa mesmo quando
duas alternativas têm o mesmo texto.

#### listagem

as perguntas são agrupadas por disciplina em `<details>` aninhados: o grupo traz
o nome e a contagem, e cada item traz o enunciado truncado e o horário, revelando alternativas, dica e ações ao expandir.

a busca acima da lista não abre menu de resultados: redesenha a lista com o que
casa com o termo, deixando visíveis apenas as disciplinas com resultado, já
expandidas.

a lista mostra só as disciplinas que cabem até a linha do botão enviar, e o
resto fica em páginas. a quantidade por página é medida a partir da altura real
do formulário, e recalculada no `resize` e quando a fonte termina de carregar.

o `editar` carrega a pergunta no formulário da esquerda e troca o botão para
`salvar`; o `excluir` vira `sim / não` no próprio lugar antes de pedir a senha.

#### tema

um script inline no `<head>` define `data-theme` antes da primeira pintura,
lendo o `localStorage` e caindo em `prefers-color-scheme` na primeira visita,
para a página não piscar clara antes de aplicar o tema escuro. as cores são
variáveis css redefinidas em `:root[data-theme="dark"]`. enquanto não houver
escolha manual no rodapé, a página acompanha o tema do sistema em tempo real.

#### ressalvas conhecidas

- a chave publicável e a url no `config.js` não são segredos: vão para o
  navegador de qualquer visitante, e a proteção real vem da row level security.
- a senha trafega em texto claro no corpo da requisição, então a página precisa
  ser servida sobre https; o github pages atende a isso.
- `listar_perguntas` devolve a tabela inteira: busca e paginação acontecem no
  navegador, sem paginação no banco.
- editar uma pergunta cuja disciplina saiu da picklist deixa o `<select>` vazio,
  e o campo é obrigatório: será preciso escolher outra para salvar.
