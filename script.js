// Valores vêm de config.js (gerado a partir do .env, veja README)
const SUPABASE_URL = window.SUPABASE_URL;
const SUPABASE_ANON_KEY = window.SUPABASE_ANON_KEY;

const main = document.getElementById("main");
const form = document.getElementById("form");
const textarea = document.getElementById("pergunta");
const status = document.getElementById("status");
const lista = document.getElementById("lista");

const dialog = document.getElementById("senha-dialog");
const senhaForm = document.getElementById("senha-form");
const senhaInput = document.getElementById("senha-input");
const erroSenha = document.getElementById("erro-senha");
const senhaConfirmar = document.getElementById("senha-confirmar");

let senha = "";

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

function renderLista(perguntas) {
  lista.textContent = "";

  if (!perguntas || perguntas.length === 0) {
    const vazio = document.createElement("p");
    vazio.textContent = "Nenhuma pergunta enviada ainda.";
    lista.appendChild(vazio);
    return;
  }

  for (const p of perguntas) {
    const item = document.createElement("details");
    const summary = document.createElement("summary");

    const titulo = document.createElement("span");
    titulo.textContent = `#${p.id}`;

    const time = document.createElement("time");
    time.dateTime = p.created_at;
    time.textContent = new Date(p.created_at).toLocaleString("pt-BR", {
      dateStyle: "short",
      timeStyle: "short",
    });

    summary.appendChild(titulo);
    summary.appendChild(time);

    const texto = document.createElement("p");
    texto.textContent = p.pergunta;

    item.appendChild(summary);
    item.appendChild(texto);
    lista.appendChild(item);
  }
}

senhaForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const tentativa = senhaInput.value;
  if (!tentativa) return;

  senhaConfirmar.disabled = true;
  erroSenha.textContent = "";

  try {
    const perguntas = await rpc("listar_perguntas", { p_senha: tentativa });
    senha = tentativa;
    dialog.close();
    main.hidden = false;
    renderLista(perguntas);
  } catch (err) {
    erroSenha.textContent = "Senha incorreta.";
    console.error(err);
  } finally {
    senhaConfirmar.disabled = false;
  }
});

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  const pergunta = textarea.value.trim();
  if (!pergunta) return;

  status.textContent = "Enviando...";

  try {
    await rpc("enviar_pergunta", { p_pergunta: pergunta, p_senha: senha });
    form.reset();
    status.textContent = "Pergunta enviada!";
    renderLista(await rpc("listar_perguntas", { p_senha: senha }));
  } catch (err) {
    status.textContent = "Erro ao enviar.";
    console.error(err);
  }
});

dialog.showModal();
senhaInput.focus();
