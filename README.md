# perguntas-fisio

formulário mínimo para coletar perguntas de fisioterapia. html, css e javascript
puros no navegador; postgres no supabase como único backend. sem framework e sem
build; a única dependência externa da página é a fonte montserrat, servida pelo
google fonts.

## filosofia

- o site inteiro são três arquivos: `index.html`, `script.js` e `config.js`.
- nenhuma biblioteca é carregada no navegador — `fetch` fala direto com a api
  rest do supabase; o único recurso de terceiros é a folha de estilo da fonte.
- o css mora dentro do `<style>` do próprio html, porque é curto o bastante
  para caber lá.
- a única dependência de desenvolvimento é a cli do supabase, usada apenas para
  aplicar migrações.
- toda a lógica de autorização vive no banco, não no cliente.

## arquivos

| arquivo | função |
| --- | --- |
| `index.html` | marcação e estilo da página |
| `script.js` | pedido de senha, envio do formulário e listagem |
| `config.js` | url e chave publicável do supabase (gerado) |
| `generate-config.js` | escreve o `config.js` a partir do `.env` |
| `supabase/migrations/` | esquema e funções do banco |

## como funciona

antes de qualquer coisa aparecer, o script chama o `prompt()` nativo do
navegador e pede a senha. a resposta é enviada à função `listar_perguntas`; se o
banco aceitar, o conteúdo é revelado e a senha fica em memória para os envios
seguintes. se recusar, o `prompt()` reaparece; se for cancelado, a página
permanece vazia.

o cliente nunca conhece a senha correta. ela é guardada no supabase vault, sob o
nome `senha_formulario`, e comparada dentro de funções `security definer`:

- `checar_senha(p_senha)` — lê o segredo do vault e levanta exceção se não bater.
- `enviar_pergunta(p_pergunta, p_senha, p_disciplina, p_resposta)` — checa a
  senha e insere a pergunta com a disciplina escolhida e a resposta.
- `atualizar_pergunta(p_id, p_pergunta, p_senha, p_disciplina, p_resposta)` —
  checa a senha e sobrescreve a pergunta indicada.
- `listar_perguntas(p_senha)` — checa a senha e devolve as vinte perguntas mais
  recentes.

a tabela `perguntas` tem row level security ativa e nenhuma política de leitura,
de modo que o papel `anon` só alcança as linhas através dessas funções.

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

aplique as migrações com a cli do supabase (requer o projeto já criado e
vinculado):

```
npx supabase link --project-ref SEU_REF
npx supabase db push
```

por fim, cadastre a senha no vault, pelo painel do supabase ou por sql:

```sql
select vault.create_secret('sua-senha', 'senha_formulario');
```

## uso

sirva o diretório com qualquer servidor estático:

```
python -m http.server 8000
```

e acesse `http://localhost:8000`. abrir o `index.html` direto pelo sistema de
arquivos também funciona, já que não há build nem módulos.

## observações

- a chave publicável e a url não são segredos: elas são visíveis no
  `config.js` entregue ao navegador, e a proteção real vem da row level
  security. o `config.js` é gerado a partir do `.env` apenas por conveniência.
- a senha trafega em texto claro dentro do corpo da requisição, portanto sirva a
  página sobre https.
- a política `Allow public insert`, criada na primeira migração, ainda permite
  inserção direta na tabela sem senha. remova-a se quiser que todo caminho de
  escrita passe por `enviar_pergunta`.

## licença

isc.
