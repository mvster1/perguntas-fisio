# perguntas-fisio

coletor de perguntas e respostas de fisioterapia, organizado pela grade do
curso. html, css e javascript puros no navegador; postgres no supabase como
único backend. sem framework e sem build; a única dependência externa da página
é a fonte inter, servida pelo google fonts.

acesso: <https://mvster1.github.io/perguntas-fisio/>

### uso

a versão publicada fica em <https://mvster1.github.io/perguntas-fisio/>, servida
pelo github pages a partir deste repositório. como o `config.js` é versionado e
não existe etapa de build, um `git push` na branch `main` já atualiza o site.

ao abrir, a página pede a senha antes de mostrar qualquer coisa. a mesma senha
vale para enviar, editar e excluir.

para rodar localmente, clone o repositório e instale as dependências de
desenvolvimento:

```
git clone https://github.com/mvster1/perguntas-fisio.git
cd perguntas-fisio
npm install
cp .env.example .env
```

preencha o `.env` com a url do projeto e a chave publicável e gere o `config.js`:

```
npm run config
```

aplique as migrações no projeto do supabase:

```
npx supabase link --project-ref SEU_REF
npx supabase db push
```

cadastre a senha no vault, pelo painel do supabase ou por sql:

```sql
select vault.create_secret('sua-senha', 'senha_formulario');
```

por fim, sirva o diretório com qualquer servidor estático:

```
python -m http.server 8000
```

e acesse <http://localhost:8000>. abrir o `index.html` direto pelo sistema de
arquivos também funciona, já que não há build nem módulos; apenas o
`localStorage` do tema se comporta de forma diferente sob `file://`.

### detalhamento técnico

#### arquitetura

o site inteiro são três arquivos: `index.html`, com marcação, estilo e a lista
fixa de disciplinas; `script.js`, com toda a lógica; e `config.js`, gerado a
partir do `.env` por `generate-config.js`. nenhuma biblioteca é carregada no
navegador: o `fetch` conversa direto com a api rest do supabase, e o css mora
no `<style>` do próprio html.

toda a autorização vive no banco. o cliente apenas repassa a senha digitada.

#### banco

tabela única, `perguntas`:

| coluna | tipo | observação |
| --- | --- | --- |
| `id` | `bigint` | identidade, chave primária |
| `pergunta` | `text` | enunciado; obrigatório |
| `resposta` | `text` | texto da alternativa marcada como correta |
| `alt_a` a `alt_d` | `text` | as quatro alternativas |
| `disciplina` | `text` | nome exatamente como aparece na picklist |
| `dificuldade` | `text` | `Baixa`, `Média` ou `Alta` |
| `dica_bonus` | `text` | opcional; nula quando não preenchida |
| `created_at` | `timestamptz` | `default now()` |

a tabela tem row level security ativa e nenhuma política de leitura, de modo que
o papel `anon` só alcança as linhas através das funções abaixo. todas são
`security definer`, recebem a senha como argumento e têm execução concedida ao
papel `anon`:

- `checar_senha(p_senha)`: lê o segredo do vault e levanta exceção se não bater.
- `enviar_pergunta(p_pergunta, p_senha, p_disciplina, p_resposta, p_alt_a, p_alt_b, p_alt_c, p_alt_d, p_dificuldade, p_dica_bonus)`:
  insere.
- `atualizar_pergunta(p_id, ...)`: mesma lista de campos, precedida do `id`;
  sobrescreve a linha indicada e levanta exceção se o `id` não existir.
- `excluir_pergunta(p_id, p_senha)`: apaga a linha indicada; levanta exceção se
  o `id` não existir.
- `listar_perguntas(p_senha)`: devolve todas as perguntas, ordenadas por `id`
  decrescente.

a senha correta nunca chega ao cliente: fica no supabase vault, sob o nome
`senha_formulario`, e a comparação acontece dentro do banco.

#### migrações

os arquivos de `supabase/migrations/` são cumulativos e devem ser aplicados em
ordem. as colunas `disciplina`, `resposta`, `alt_a` a `alt_d`, `dificuldade` e
`dica_bonus` foram acrescentadas depois da criação da tabela, e algumas delas
nasceram no painel do supabase; por isso as migrações correspondentes usam
`add column if not exists`, que as torna inócuas no banco atual e completas em
um banco novo.

cada mudança na lista de campos derruba a versão anterior de `enviar_pergunta` e
de `atualizar_pergunta` antes de recriá-las. sem esse `drop`, as assinaturas
antigas continuariam existindo e o postgrest teria sobrecargas ambíguas para
resolver.

#### autenticação

antes de qualquer coisa aparecer, o script chama o `prompt()` nativo do
navegador e pede a senha. a resposta é enviada à função `listar_perguntas`; se o
banco aceitar, o conteúdo é revelado e a senha fica em memória para as chamadas
seguintes. se recusar, o `prompt()` reaparece; se for cancelado, a página
permanece vazia.

a exclusão pede a senha outra vez, no mesmo `prompt()` nativo, por ser a única
ação destrutiva.

#### layout

autenticado, o conteúdo se divide em duas colunas, formulário à esquerda e lista
à direita, que colapsam em uma só abaixo de 900px. as colunas são
`minmax(0,1fr)` em vez de `1fr`, porque as opções longas do `<select>` esticariam
uma coluna de largura automática e empurrariam a lista para fora da tela.

#### formulário

os campos são preenchidos nesta ordem: enunciado, disciplina, as quatro
alternativas, a dificuldade e a dica bônus. só a dica é opcional; sem os demais
o envio para e o motivo aparece na linha de status.

a disciplina vem de um `<select>` com as 67 unidades curriculares de ensino do
curso, agrupadas por semestre em `<optgroup>`; as unidades de extensão ficaram de
fora. a lista é fixa no html, e o banco guarda apenas a string escolhida: não há
tabela de domínio nem constraint que valide o valor.

logo abaixo há uma busca que filtra as opções conforme se digita, ignorando
acentos e caixa. a normalização aplica `NFD` e descarta os diacríticos, de modo
que `musculoesquel` encontra "Musculoesquelética". clicar em um resultado, ou
teclar enter, seleciona a opção no `<select>` acima. o enter também precisa de
`preventDefault`, senão submeteria o formulário no meio da busca.

as quatro alternativas têm cada uma sua caixa e sua marcação. marcar uma
desmarca as demais, de modo que a marcação funciona como escolha única mesmo
sendo `checkbox`. no envio, o texto da alternativa marcada é copiado para a
coluna `resposta`.

a dificuldade é uma faixa de três opções, `Baixa`, `Média` e `Alta`, neutra até
receber o clique; a escolhida ganha o fundo pastel correspondente.

a dica bônus é o único campo opcional do formulário. em branco, chega ao banco
como nulo, porque as funções de escrita aplicam `nullif(btrim(...), '')`.

#### listagem

as perguntas chegam ordenadas por `id` decrescente e são agrupadas por
disciplina em `<details>` aninhados: o grupo externo traz o nome da disciplina e
a contagem, e cada item interno traz o enunciado truncado, o selo de dificuldade
e o horário, revelando enunciado, alternativas e ações ao expandir. a alternativa
correta aparece destacada com um `✓`; registros anteriores às alternativas
mostram apenas a linha `resposta`. quando existe dica bônus, ela fecha o bloco.

como o `map` preserva a ordem de inserção, as disciplinas aparecem na ordem da
pergunta mais recente de cada uma.

a busca acima da lista não abre um menu de resultados: ela redesenha a lista com
as perguntas que casam com o termo, mantendo visíveis apenas as disciplinas com
resultado e já expandindo cada uma.

#### paginação

a lista mostra apenas as disciplinas que cabem até a linha do botão enviar, e o
restante fica em páginas, com `[< anterior] x / y [próxima >]` no rodapé.

a quantidade por página é medida, não fixa: `medirPorPagina()` calcula o espaço
entre o topo da lista e a base do formulário, desconta o rodapé e divide pela
altura de uma linha. a altura de linha vem do `<summary>` e não do `<details>`,
porque durante a busca os grupos ficam abertos e a altura do `<details>` deixaria
de representar uma linha. a medição se repete no `resize` e quando
`document.fonts.ready` resolve, já que a inter chega depois do primeiro desenho e
muda a altura da linha.

a paginação volta à primeira página ao enviar, editar ou excluir uma pergunta e
a cada digitação na busca.

#### edição e exclusão

o `editar` de cada pergunta carrega os valores daquela linha no formulário da
esquerda, incluindo alternativas e dificuldade, troca o botão para `salvar` e
revela o `cancelar`. salvar chama `atualizar_pergunta` em vez de
`enviar_pergunta`. a página rola para o topo e o foco usa `preventScroll`, senão
o próprio foco arrastaria a rolagem e cancelaria o movimento.

o `excluir` se transforma em `sim / não` no próprio lugar; o `sim` abre o
`prompt()` de senha. cancelar, recusar ou errar a senha devolve o rótulo ao
estado inicial.

os cliques dessas ações interrompem a propagação, senão também abririam o
`<details>` que as contém.

#### tema

um script inline no `<head>` define `data-theme` no elemento raiz antes da
primeira pintura, lendo o `localStorage` e caindo em `prefers-color-scheme` na
primeira visita; sem isso a página piscaria clara antes de aplicar o tema
escuro. as cores são variáveis css redefinidas em `:root[data-theme="dark"]`, e o
seletor no rodapé grava a escolha. enquanto não houver escolha manual, a página
acompanha em tempo real a troca de tema do sistema.

#### ressalvas conhecidas

- a chave publicável e a url não são segredos: estão visíveis no `config.js`
  entregue ao navegador, e a proteção real vem da row level security.
- a senha trafega em texto claro no corpo da requisição, portanto a página
  precisa ser servida sobre https; o github pages já atende a isso.
- a política `Allow public insert`, criada na primeira migração, ainda permite
  inserção direta na tabela sem senha. remova-a se quiser que todo caminho de
  escrita passe por `enviar_pergunta`.
- a listagem não é paginada no banco: `listar_perguntas` devolve a tabela
  inteira, e tanto a busca quanto a paginação operam no navegador.
- não há coluna que guarde a letra da alternativa correta. ela é reconhecida
  comparando o texto de cada alternativa com `resposta`, o que marcaria as duas
  caso houvesse alternativas idênticas.
- editar uma pergunta cuja disciplina saiu da picklist deixa o `<select>` vazio,
  e o campo é obrigatório: será preciso escolher outra para salvar.
