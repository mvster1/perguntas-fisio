# perguntas-fisio

coletor de perguntas e respostas de fisioterapia, organizado pela grade do
curso. html, css e javascript puros no navegador; postgres no supabase como
único backend. sem framework e sem build; a única dependência externa da página
é a fonte inter, servida pelo google fonts.

acesso: <https://mvster1.github.io/perguntas-fisio/>

## filosofia

- o site inteiro são três arquivos: `index.html`, `script.js` e `config.js`.
- nenhuma biblioteca é carregada no navegador: `fetch` fala direto com a api
  rest do supabase; o único recurso de terceiros é a folha de estilo da fonte.
- o css mora dentro do `<style>` do próprio html, porque é curto o bastante
  para caber lá.
- a única dependência de desenvolvimento é a cli do supabase, usada apenas para
  aplicar migrações.
- toda a lógica de autorização vive no banco, não no cliente.

## arquivos

| arquivo | função |
| --- | --- |
| `index.html` | marcação, estilo e a lista fixa de disciplinas |
| `script.js` | senha, formulário, buscas, listagem e edição |
| `config.js` | url e chave publicável do supabase (gerado) |
| `generate-config.js` | escreve o `config.js` a partir do `.env` |
| `supabase/migrations/` | esquema e funções do banco |

## banco

tabela única, `perguntas`:

| coluna | tipo | observação |
| --- | --- | --- |
| `id` | `bigint` | identidade, chave primária |
| `pergunta` | `text` | obrigatório |
| `resposta` | `text` | nulo nos registros anteriores ao campo |
| `disciplina` | `text` | nome exatamente como aparece na picklist |
| `created_at` | `timestamptz` | `default now()` |

a tabela tem row level security ativa e nenhuma política de leitura, de modo que
o papel `anon` só alcança as linhas através das funções abaixo. todas são
`security definer` e recebem a senha como argumento:

- `checar_senha(p_senha)`: lê o segredo do vault e levanta exceção se não bater.
- `enviar_pergunta(p_pergunta, p_senha, p_disciplina, p_resposta)`: insere.
- `atualizar_pergunta(p_id, p_pergunta, p_senha, p_disciplina, p_resposta)`:
  sobrescreve a linha indicada; levanta exceção se o `id` não existir.
- `excluir_pergunta(p_id, p_senha)`: apaga a linha indicada; levanta exceção se
  o `id` não existir.
- `listar_perguntas(p_senha)`: devolve as vinte perguntas mais recentes,
  ordenadas por `id` decrescente.

a senha correta nunca chega ao cliente: fica no supabase vault, sob o nome
`senha_formulario`, e a comparação acontece dentro do banco.

as migrações em `supabase/migrations/` são cumulativas e devem ser aplicadas em
ordem. as colunas `disciplina` e `resposta` foram acrescentadas depois da
criação da tabela, e cada mudança de assinatura de `enviar_pergunta` derruba a
versão anterior para não deixar sobrecargas ambíguas no postgrest.

## como funciona

antes de qualquer coisa aparecer, o script chama o `prompt()` nativo do
navegador e pede a senha. a resposta é enviada à função `listar_perguntas`; se o
banco aceitar, o conteúdo é revelado e a senha fica em memória para as chamadas
seguintes. se recusar, o `prompt()` reaparece; se for cancelado, a página
permanece vazia.

autenticado, o layout se divide em duas colunas, formulário à esquerda e lista à
direita, que colapsam em uma só abaixo de 900px.

### envio

o formulário exige disciplina, enunciado e resposta. a disciplina vem de um
`<select>` com as 67 unidades curriculares de ensino do curso, agrupadas por
semestre em `<optgroup>`; as unidades de extensão ficaram de fora. a lista é
fixa no html, e o banco guarda apenas a string escolhida; não há tabela de
domínio nem constraint que valide o valor.

abaixo da picklist há uma busca que filtra as opções conforme se digita,
ignorando acentos e caixa (`normalizar()` aplica `NFD` e remove os
diacríticos). clicar em um resultado, ou teclar enter, seleciona a opção no
`<select>` acima.

### listagem

as perguntas chegam ordenadas por `id` decrescente e são agrupadas por
disciplina em `<details>` aninhados: o grupo externo traz o nome da disciplina e
a contagem; cada item interno traz o enunciado truncado e o horário, revelando
enunciado, resposta e o botão de edição ao expandir. como o `map` preserva a
ordem de inserção, as disciplinas aparecem na ordem da pergunta mais recente de
cada uma.

a busca acima da lista não abre um menu de resultados: ela redesenha a lista com
as perguntas que casam com o termo, mantendo visíveis apenas as disciplinas com
resultado e já expandindo cada uma.

### edição

o `[Editar]` de cada pergunta carrega os valores daquela linha no formulário da
esquerda, troca o botão para `salvar` e revela o `cancelar`. salvar chama
`atualizar_pergunta` em vez de `enviar_pergunta` e recarrega a lista.

ao lado dele, o `[Excluir]` se transforma em `[sim / não]` no próprio lugar; o
`sim` abre um `prompt()` avisando que a exclusão é definitiva e pedindo a senha
outra vez, que vai direto para `excluir_pergunta`. cancelar o `prompt`, recusar
na confirmação ou errar a senha devolve o rótulo ao estado inicial.

os cliques dessas ações interrompem a propagação, senão também abririam o
`<details>` que as contém.

### tema

um script inline no `<head>` define `data-theme` no elemento raiz antes da
primeira pintura, lendo o `localStorage` e caindo em `prefers-color-scheme` na
primeira visita; sem isso a página piscaria clara antes de aplicar o tema
escuro. as cores são variáveis css redefinidas em `:root[data-theme="dark"]`, e
o seletor no rodapé grava a escolha.

## instalação

```
git clone https://github.com/mvster1/perguntas-fisio.git
cd perguntas-fisio
npm install
cp .env.example .env
```

preencha o `.env` com a url do projeto e a chave publicável, então gere o
`config.js`:

```
npm run config
```

aplique as migrações com a cli do supabase (requer o projeto já criado):

```
npx supabase link --project-ref SEU_REF
npx supabase db push
```

por fim, cadastre a senha no vault, pelo painel do supabase ou por sql:

```sql
select vault.create_secret('sua-senha', 'senha_formulario');
```

## uso

a versão publicada fica em <https://mvster1.github.io/perguntas-fisio/>, servida
pelo github pages a partir deste repositório: como o `config.js` é versionado e
não há etapa de build, um `git push` já atualiza o site.

para rodar localmente, sirva o diretório com qualquer servidor estático:

```
python -m http.server 8000
```

e acesse <http://localhost:8000>. abrir o `index.html` direto pelo sistema de
arquivos também funciona, já que não há build nem módulos; o `localStorage` do
tema é o único recurso que se comporta de forma diferente sob `file://`.

## observações

- a chave publicável e a url não são segredos: elas são visíveis no
  `config.js` entregue ao navegador, e a proteção real vem da row level
  security. o `config.js` é gerado a partir do `.env` apenas por conveniência.
- a senha trafega em texto claro dentro do corpo da requisição, portanto sirva a
  página sobre https; o github pages já atende a esse requisito.
- a política `Allow public insert`, criada na primeira migração, ainda permite
  inserção direta na tabela sem senha. remova-a se quiser que todo caminho de
  escrita passe por `enviar_pergunta`.
- `listar_perguntas` tem limite fixo de vinte linhas, e as buscas da página
  operam apenas sobre o que já foi carregado.
- editar uma pergunta cuja disciplina saiu da picklist deixa o `<select>` vazio,
  e o campo é obrigatório: será preciso escolher outra para salvar.

## licença

isc.
