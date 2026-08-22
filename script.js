// Valores vêm de config.js (gerado a partir do .env, veja README)
const SUPABASE_URL = window.SUPABASE_URL;
const SUPABASE_ANON_KEY = window.SUPABASE_ANON_KEY;

const main = document.getElementById("main");
const form = document.getElementById("form");
const textarea = document.getElementById("pergunta");
const disciplina = document.getElementById("disciplina");
const respostaBox = document.getElementById("resposta");
const busca = document.getElementById("busca");
const matches = document.getElementById("matches");
const cancelar = document.getElementById("cancelar");
const buscaPergunta = document.getElementById("busca-pergunta");
const enviar = document.getElementById("enviar");
const status = document.getElementById("status");
const lista = document.getElementById("lista");
const temaOpts = document.querySelectorAll("[data-tema]");

let senha = "";
let editandoId = null;
let perguntasAtuais = [];
let timerStatus = null;

function mostrarStatus(texto, classe = "") {
  clearTimeout(timerStatus);
  status.className = classe;
  status.textContent = texto;

  // só as confirmações somem sozinhas; erros ficam até a próxima ação
  if (classe !== "ok") return;

  timerStatus = setTimeout(() => {
    status.classList.add("sumindo");
    timerStatus = setTimeout(() => mostrarStatus(""), 600);
  }, 3000);
}

const opcoes = [...disciplina.options].filter((o) => o.value);

function normalizar(texto) {
  return texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
}

function montarMatches(caixa, achados, aviso, aoEscolher) {
  caixa.textContent = "";

  if (achados.length === 0) {
    const vazio = document.createElement("div");
    vazio.className = "sem";
    vazio.textContent = aviso;
    caixa.appendChild(vazio);
    return;
  }

  for (const achado of achados) {
    const item = document.createElement("div");
    item.textContent = achado.texto;
    item.title = achado.texto;
    item.addEventListener("click", () => aoEscolher(achado));
    caixa.appendChild(item);
  }
}

function ligarBusca(campo, caixa, aviso, obterItens, aoEscolher) {
  campo.addEventListener("input", () => {
    const termo = normalizar(campo.value.trim());
    caixa.textContent = "";
    if (!termo) return;

    const achados = obterItens()
      .filter((i) => normalizar(i.texto).includes(termo))
      .slice(0, 8);

    montarMatches(caixa, achados, aviso, aoEscolher);
  });

  campo.addEventListener("keydown", (e) => {
    if (e.key !== "Enter") return;
    // sem isto o Enter submeteria o formulário
    e.preventDefault();
    const primeiro = caixa.querySelector("div:not(.sem)");
    if (primeiro) primeiro.click();
  });
}

function selecionarDisciplina(nome) {
  disciplina.value = nome;
  busca.value = "";
  matches.textContent = "";
}

ligarBusca(
  busca,
  matches,
  "Nenhuma disciplina encontrada.",
  () => opcoes.map((o) => ({ texto: o.value })),
  (achado) => selecionarDisciplina(achado.texto)
);

function marcarTema(tema) {
  for (const opt of temaOpts) {
    opt.classList.toggle("active", opt.dataset.tema === tema);
  }
}

for (const opt of temaOpts) {
  opt.addEventListener("click", () => {
    document.documentElement.dataset.theme = opt.dataset.tema;
    localStorage.setItem("tema", opt.dataset.tema);
    marcarTema(opt.dataset.tema);
  });
}

marcarTema(document.documentElement.dataset.theme);

async function rpc(nome, params) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${nome}`, {
    method: "POST",
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(params),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.status === 204 ? null : res.json();
}

function acaoDoResumo(texto, classe, aoClicar) {
  const alvo = document.createElement("span");
  alvo.className = classe;
  alvo.textContent = texto;
  alvo.addEventListener("click", (e) => {
    // sem isto o clique tambem abriria/fecharia o <details>
    e.preventDefault();
    e.stopPropagation();
    aoClicar();
  });
  return alvo;
}

function montarExcluir(caixa, p) {
  caixa.textContent = "";
  caixa.appendChild(acaoDoResumo("[Excluir]", "op", () => confirmarExclusao(caixa, p)));
}

function confirmarExclusao(caixa, p) {
  caixa.textContent = "[";
  caixa.appendChild(acaoDoResumo("Sim", "op sim", () => excluirPergunta(caixa, p)));
  caixa.appendChild(document.createTextNode(" / "));
  caixa.appendChild(acaoDoResumo("Não", "op nao", () => montarExcluir(caixa, p)));
  caixa.appendChild(document.createTextNode("]"));
}

async function excluirPergunta(caixa, p) {
  const tentativa = prompt(
    `A pergunta #${p.id} será excluída definitivamente.\nDigite a senha para prosseguir:`
  );

  if (tentativa === null) {
    montarExcluir(caixa, p);
    return;
  }

  mostrarStatus("Excluindo...");

  try {
    await rpc("excluir_pergunta", { p_id: p.id, p_senha: tentativa });
    if (editandoId === p.id) sairDaEdicao();
    mostrarStatus("Pergunta excluída.", "ok");
    renderLista(await rpc("listar_perguntas", { p_senha: senha }));
  } catch (err) {
    console.error(err);
    montarExcluir(caixa, p);
    mostrarStatus("Erro ao excluir.", "err");
  }
}

function criarItem(p) {
  const item = document.createElement("details");
  const summary = document.createElement("summary");

  const editar = acaoDoResumo("[Editar]", "editar", () => iniciarEdicao(p));

  const excluir = document.createElement("span");
  excluir.className = "excluir";
  montarExcluir(excluir, p);

  const titulo = document.createElement("span");
  titulo.className = "titulo";
  titulo.textContent = p.pergunta;

  const time = document.createElement("time");
  time.dateTime = p.created_at;
  time.textContent = new Date(p.created_at).toLocaleString("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  });

  summary.appendChild(editar);
  summary.appendChild(excluir);
  summary.appendChild(titulo);
  summary.appendChild(time);

  const texto = document.createElement("p");
  texto.className = "q";
  texto.textContent = p.pergunta;

  const resposta = document.createElement("p");
  resposta.className = p.resposta ? "a" : "a sem";
  resposta.textContent = p.resposta || "Resposta não existe para essa pergunta.";

  item.appendChild(summary);
  item.appendChild(texto);
  item.appendChild(resposta);
  return item;
}

function renderLista(perguntas) {
  perguntasAtuais = perguntas || [];
  buscaPergunta.value = "";
  desenharLista();
}

function desenharLista() {
  const termo = normalizar(buscaPergunta.value.trim());
  const visiveis = termo
    ? perguntasAtuais.filter((p) => normalizar(p.pergunta).includes(termo))
    : perguntasAtuais;

  lista.textContent = "";

  if (visiveis.length === 0) {
    const vazio = document.createElement("p");
    vazio.className = "empty";
    vazio.textContent = termo
      ? "Nenhuma pergunta encontrada."
      : "Nenhuma pergunta enviada ainda.";
    lista.appendChild(vazio);
    return;
  }

  // a lista já vem por id desc, então o Map preserva as disciplinas
  // na ordem da pergunta mais recente de cada uma
  const grupos = new Map();
  for (const p of visiveis) {
    const chave = p.disciplina || "Sem disciplina";
    if (!grupos.has(chave)) grupos.set(chave, []);
    grupos.get(chave).push(p);
  }

  for (const [chave, itens] of grupos) {
    const grupo = document.createElement("details");
    grupo.className = "grupo";
    // com busca ativa, a disciplina do resultado já aparece aberta
    grupo.open = Boolean(termo);

    const summary = document.createElement("summary");

    const nome = document.createElement("span");
    nome.className = "titulo";
    nome.textContent = chave;
    nome.title = chave;

    const total = document.createElement("span");
    total.className = "n";
    total.textContent = itens.length;

    summary.appendChild(nome);
    summary.appendChild(total);
    grupo.appendChild(summary);

    for (const p of itens) grupo.appendChild(criarItem(p));
    lista.appendChild(grupo);
  }
}

buscaPergunta.addEventListener("input", desenharLista);

async function autenticar() {
  let aviso = "Senha:";

  for (;;) {
    const tentativa = prompt(aviso);
    if (tentativa === null) return;

    try {
      const perguntas = await rpc("listar_perguntas", { p_senha: tentativa });
      senha = tentativa;
      main.hidden = false;
      renderLista(perguntas);
      return;
    } catch (err) {
      console.error(err);
      aviso = "Senha incorreta. Tente novamente:";
    }
  }
}

function iniciarEdicao(p) {
  editandoId = p.id;
  disciplina.value = p.disciplina || "";
  textarea.value = p.pergunta;
  respostaBox.value = p.resposta || "";
  busca.value = "";
  matches.textContent = "";
  enviar.textContent = "Salvar";
  cancelar.hidden = false;
  mostrarStatus(`Editando a pergunta #${p.id}.`);
  form.scrollIntoView({ behavior: "smooth", block: "start" });
  textarea.focus();
}

function sairDaEdicao() {
  editandoId = null;
  form.reset();
  matches.textContent = "";
  enviar.textContent = "Enviar";
  cancelar.hidden = true;
}

cancelar.addEventListener("click", () => {
  sairDaEdicao();
  mostrarStatus("");
});

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  const pergunta = textarea.value.trim();
  const resposta = respostaBox.value.trim();
  if (!pergunta || !resposta || !disciplina.value) return;

  const editando = editandoId;

  enviar.disabled = true;
  mostrarStatus(editando ? "Salvando..." : "Enviando...");

  try {
    if (editando) {
      await rpc("atualizar_pergunta", {
        p_id: editando,
        p_pergunta: pergunta,
        p_senha: senha,
        p_disciplina: disciplina.value,
        p_resposta: resposta,
      });
    } else {
      await rpc("enviar_pergunta", {
        p_pergunta: pergunta,
        p_senha: senha,
        p_disciplina: disciplina.value,
        p_resposta: resposta,
      });
    }
    sairDaEdicao();
    mostrarStatus(editando ? "Pergunta atualizada." : "Pergunta enviada.", "ok");
    renderLista(await rpc("listar_perguntas", { p_senha: senha }));
  } catch (err) {
    console.error(err);
    mostrarStatus(editando ? "Erro ao salvar." : "Erro ao enviar.", "err");
  } finally {
    enviar.disabled = false;
  }
});

autenticar();
