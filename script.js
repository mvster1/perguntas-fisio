// Valores vêm de config.js (gerado a partir do .env, veja README)
const SUPABASE_URL = window.SUPABASE_URL;
const SUPABASE_ANON_KEY = window.SUPABASE_ANON_KEY;

const main = document.getElementById("main");
const form = document.getElementById("form");
const textarea = document.getElementById("pergunta");
const disciplina = document.getElementById("disciplina");
const uce = document.getElementById("uce");
const alternativas = ["a", "b", "c", "d"].map((letra) => ({
  letra,
  campo: document.getElementById(`alt-${letra}`),
  marca: document.querySelector(`.correta[data-alt="${letra}"]`),
}));
const busca = document.getElementById("busca");
const matches = document.getElementById("matches");
const cancelar = document.getElementById("cancelar");
const buscaPergunta = document.getElementById("busca-pergunta");
const dica = document.getElementById("dica");
const paginacao = document.getElementById("paginacao");
const paginaAnterior = document.getElementById("pagina-anterior");
const paginaProxima = document.getElementById("pagina-proxima");
const paginaAtualTexto = document.getElementById("pagina-atual");
const enviar = document.getElementById("enviar");
const status = document.getElementById("status");
const lista = document.getElementById("lista");
const temaOpts = document.querySelectorAll("[data-tema]");

let senha = "";
let editandoId = null;
let perguntasAtuais = [];
let paginaAtual = 1;
let porPagina = 12;
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

function aplicarTema(tema) {
  document.documentElement.dataset.theme = tema;
  marcarTema(tema);
}

for (const opt of temaOpts) {
  opt.addEventListener("click", () => {
    localStorage.setItem("tema", opt.dataset.tema);
    aplicarTema(opt.dataset.tema);
  });
}

// segue o tema do sistema enquanto a página está aberta, a menos que
// já tenha havido uma escolha manual no rodapé
matchMedia("(prefers-color-scheme: dark)").addEventListener("change", (e) => {
  if (localStorage.getItem("tema")) return;
  aplicarTema(e.matches ? "dark" : "light");
});

marcarTema(document.documentElement.dataset.theme);

for (const alt of alternativas) {
  alt.marca.addEventListener("change", () => {
    // só uma alternativa pode ser a correta
    if (!alt.marca.checked) return;
    for (const outra of alternativas) {
      if (outra !== alt) outra.marca.checked = false;
    }
  });
}

function alternativaCorreta() {
  return alternativas.find((alt) => alt.marca.checked) || null;
}

function limparAlternativas() {
  for (const alt of alternativas) {
    alt.campo.value = "";
    alt.marca.checked = false;
  }
}

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
  caixa.appendChild(acaoDoResumo("Excluir", "op", () => confirmarExclusao(caixa, p)));
}

function confirmarExclusao(caixa, p) {
  caixa.textContent = "";
  caixa.appendChild(acaoDoResumo("Sim", "op sim", () => excluirPergunta(caixa, p)));
  caixa.appendChild(document.createTextNode(" / "));
  caixa.appendChild(acaoDoResumo("Não", "op nao", () => montarExcluir(caixa, p)));
}

async function excluirPergunta(caixa, p) {
  const tentativa = prompt(
    `A pergunta #${p.id} será excluída definitivamente e esta ação não é reversível.\n\nDigite a senha para prosseguir, ou cancele:`
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

function medirPorPagina() {
  // mede o summary, e não o .grupo: durante a busca os grupos ficam abertos
  // e a altura do <details> deixaria de representar uma linha da lista
  const summary = lista.querySelector(".grupo > summary");
  const alturaLinha = summary ? summary.offsetHeight + 1 : 32;
  // o rodapé ainda pode estar oculto na primeira medição, mas o espaço dele
  // precisa ser descontado do mesmo jeito
  const alturaRodape = paginacao.hidden ? 27 : paginacao.offsetHeight;
  const disponivel =
    form.getBoundingClientRect().bottom -
    lista.getBoundingClientRect().top -
    alturaRodape;

  return Math.max(3, Math.floor(disponivel / alturaLinha));
}

function desenharPaginacao(totalPaginas) {
  paginacao.hidden = totalPaginas <= 1;
  if (paginacao.hidden) return;

  paginaAtualTexto.textContent = `${paginaAtual} / ${totalPaginas}`;
  paginaAnterior.classList.toggle("desativado", paginaAtual === 1);
  paginaProxima.classList.toggle("desativado", paginaAtual === totalPaginas);
}

function ajustarPorPagina() {
  const novo = medirPorPagina();
  if (novo === porPagina) return;
  porPagina = novo;
  desenharLista();
}

function irParaPagina(destino, totalPaginas) {
  if (destino < 1 || destino > totalPaginas) return;
  paginaAtual = destino;
  desenharLista();
}

function criarItem(p) {
  const item = document.createElement("details");
  const summary = document.createElement("summary");

  const numero = document.createElement("span");
  numero.className = "num";
  numero.textContent = "#" + p.id;

  const editar = acaoDoResumo("Editar", "editar", () => iniciarEdicao(p));

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

  summary.appendChild(numero);
  summary.appendChild(editar);
  summary.appendChild(excluir);
  summary.appendChild(titulo);

  summary.appendChild(time);

  const texto = document.createElement("p");
  texto.className = "q";
  texto.textContent = p.pergunta;

  item.appendChild(summary);
  item.appendChild(texto);

  const letras = ["a", "b", "c", "d"];
  const temAlternativas = letras.some((letra) => p[`alt_${letra}`]);

  if (temAlternativas) {
    for (const letra of letras) {
      const alt = p[`alt_${letra}`];
      if (!alt) continue;

      const linha = document.createElement("p");
      linha.className = letra === p.correta ? "alt certa" : "alt";
      linha.textContent = `${letra}) ${alt}`;
      item.appendChild(linha);
    }
  } else {
    // registros anteriores às alternativas guardam só a resposta
    const resposta = document.createElement("p");
    resposta.className = p.resposta ? "a" : "a sem";
    resposta.textContent = p.resposta || "Resposta não existe para essa pergunta.";
    item.appendChild(resposta);
  }

  if (p.dica_bonus) {
    const linha = document.createElement("p");
    linha.className = "dica";
    linha.textContent = p.dica_bonus;
    item.appendChild(linha);
  }

  return item;
}

function renderLista(perguntas) {
  perguntasAtuais = perguntas || [];
  buscaPergunta.value = "";
  paginaAtual = 1;
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
    paginacao.hidden = true;
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

  const disciplinas = [...grupos];
  const totalPaginas = Math.max(1, Math.ceil(disciplinas.length / porPagina));
  paginaAtual = Math.min(paginaAtual, totalPaginas);
  const inicio = (paginaAtual - 1) * porPagina;

  for (const [chave, itens] of disciplinas.slice(inicio, inicio + porPagina)) {
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

  desenharPaginacao(totalPaginas);

  paginaAnterior.onclick = () => irParaPagina(paginaAtual - 1, totalPaginas);
  paginaProxima.onclick = () => irParaPagina(paginaAtual + 1, totalPaginas);
}

buscaPergunta.addEventListener("input", () => {
  // a busca muda o conjunto de disciplinas, então a contagem recomeça
  paginaAtual = 1;
  desenharLista();
});

addEventListener("resize", ajustarPorPagina);

// a Inter chega depois do primeiro desenho e muda a altura da linha
if (document.fonts) document.fonts.ready.then(ajustarPorPagina);

async function autenticar() {
  let aviso = "Insira a senha:";

  for (;;) {
    const tentativa = prompt(aviso);
    if (tentativa === null) return;

    try {
      const perguntas = await rpc("listar_perguntas", { p_senha: tentativa });
      senha = tentativa;
      main.hidden = false;
      renderLista(perguntas);
      // só dá para medir depois que a lista existe e o main está visível
      ajustarPorPagina();
      return;
    } catch (err) {
      console.error(err);
      aviso = "Senha incorreta. Tente novamente:";
    }
  }
}

function iniciarEdicao(p) {
  editandoId = p.id;
  uce.value = p.uce_id || "";
  disciplina.value = p.disciplina || "";
  textarea.value = p.pergunta;

  for (const alt of alternativas) {
    alt.campo.value = p[`alt_${alt.letra}`] || "";
    alt.marca.checked = alt.letra === p.correta;
  }
  dica.value = p.dica_bonus || "";
  busca.value = "";
  matches.textContent = "";
  enviar.textContent = "Salvar";
  cancelar.hidden = false;
  mostrarStatus(`Editando a pergunta #${p.id}.`);
  // preventScroll evita que o foco arraste a página para o campo e cancele a
  // rolagem abaixo, que no celular precisa subir da lista até o formulário
  textarea.focus({ preventScroll: true });
  scrollTo({ top: 0, behavior: "smooth" });
}

function sairDaEdicao() {
  editandoId = null;
  form.reset();
  limparAlternativas();
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
  const correta = alternativaCorreta();

  if (!uce.value || !pergunta || !disciplina.value) return;
  if (alternativas.some((alt) => !alt.campo.value.trim())) {
    mostrarStatus("Preencha as quatro alternativas.", "err");
    return;
  }
  if (!correta) {
    mostrarStatus("Marque qual alternativa é a correta.", "err");
    return;
  }
  if (!dica.value.trim()) {
    mostrarStatus("Escreva a dica bônus.", "err");
    return;
  }

  // a resposta é o próprio texto da alternativa marcada
  const resposta = correta.campo.value.trim();
  const textos = Object.fromEntries(
    alternativas.map((alt) => [`p_alt_${alt.letra}`, alt.campo.value.trim()])
  );

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
        p_dificuldade: null,
        p_uce_id: Number(uce.value),
        p_dica_bonus: dica.value.trim(),
        p_correta: correta.letra,
        ...textos,
      });
    } else {
      await rpc("enviar_pergunta", {
        p_pergunta: pergunta,
        p_senha: senha,
        p_disciplina: disciplina.value,
        p_resposta: resposta,
        p_dificuldade: null,
        p_uce_id: Number(uce.value),
        p_dica_bonus: dica.value.trim(),
        p_correta: correta.letra,
        ...textos,
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
