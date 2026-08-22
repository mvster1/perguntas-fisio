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
const enviar = document.getElementById("enviar");
const status = document.getElementById("status");
const lista = document.getElementById("lista");
const temaOpts = document.querySelectorAll("[data-tema]");

let senha = "";
let editandoId = null;

const opcoes = [...disciplina.options].filter((o) => o.value);

function normalizar(texto) {
  return texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
}

function selecionarDisciplina(nome) {
  disciplina.value = nome;
  busca.value = "";
  matches.textContent = "";
}

busca.addEventListener("input", () => {
  const termo = normalizar(busca.value.trim());
  matches.textContent = "";
  if (!termo) return;

  const achados = opcoes
    .filter((o) => normalizar(o.value).includes(termo))
    .slice(0, 8);

  if (achados.length === 0) {
    const vazio = document.createElement("div");
    vazio.className = "sem";
    vazio.textContent = "Nenhuma disciplina encontrada.";
    matches.appendChild(vazio);
    return;
  }

  for (const o of achados) {
    const item = document.createElement("div");
    item.textContent = o.value;
    item.addEventListener("click", () => selecionarDisciplina(o.value));
    matches.appendChild(item);
  }
});

busca.addEventListener("keydown", (e) => {
  if (e.key !== "Enter") return;
  e.preventDefault();
  const primeiro = matches.querySelector("div:not(.sem)");
  if (primeiro) selecionarDisciplina(primeiro.textContent);
});

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

function criarItem(p) {
  const item = document.createElement("details");
  const summary = document.createElement("summary");

  const editar = document.createElement("span");
  editar.className = "editar";
  editar.textContent = "[Editar]";
  editar.addEventListener("click", (e) => {
    // sem isto o clique tambem abriria/fecharia o <details>
    e.preventDefault();
    e.stopPropagation();
    iniciarEdicao(p);
  });

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
  lista.textContent = "";

  if (!perguntas || perguntas.length === 0) {
    const vazio = document.createElement("p");
    vazio.className = "empty";
    vazio.textContent = "Nenhuma pergunta enviada ainda.";
    lista.appendChild(vazio);
    return;
  }

  // a lista já vem por id desc, então o Map preserva as disciplinas
  // na ordem da pergunta mais recente de cada uma
  const grupos = new Map();
  for (const p of perguntas) {
    const chave = p.disciplina || "Sem disciplina";
    if (!grupos.has(chave)) grupos.set(chave, []);
    grupos.get(chave).push(p);
  }

  for (const [chave, itens] of grupos) {
    const grupo = document.createElement("details");
    grupo.className = "grupo";

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
  status.className = "";
  status.textContent = `Editando a pergunta #${p.id}.`;
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
  status.className = "";
  status.textContent = "";
});

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  const pergunta = textarea.value.trim();
  const resposta = respostaBox.value.trim();
  if (!pergunta || !resposta || !disciplina.value) return;

  const editando = editandoId;

  enviar.disabled = true;
  status.className = "";
  status.textContent = editando ? "Salvando..." : "Enviando...";

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
    status.className = "ok";
    status.textContent = editando ? "Pergunta atualizada." : "Pergunta enviada.";
    renderLista(await rpc("listar_perguntas", { p_senha: senha }));
  } catch (err) {
    console.error(err);
    status.className = "err";
    status.textContent = editando ? "Erro ao salvar." : "Erro ao enviar.";
  } finally {
    enviar.disabled = false;
  }
});

autenticar();
