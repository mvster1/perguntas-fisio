// Valores vêm de config.js (gerado a partir do .env, veja README)
const SUPABASE_URL = window.SUPABASE_URL;
const SUPABASE_ANON_KEY = window.SUPABASE_ANON_KEY;

const form = document.getElementById("form");
const textarea = document.getElementById("pergunta");
const status = document.getElementById("status");
const lista = document.getElementById("lista");

const dialog = document.getElementById("senha-dialog");
const senhaForm = document.getElementById("senha-form");
const senhaInput = document.getElementById("senha-input");
const erroSenha = document.getElementById("erro-senha");
const senhaCancelar = document.getElementById("senha-cancelar");
const senhaConfirmar = document.getElementById("senha-confirmar");

let perguntaPendente = "";

form.addEventListener("submit", (e) => {
  e.preventDefault();
  const pergunta = textarea.value.trim();
  if (!pergunta) return;

  perguntaPendente = pergunta;
  senhaInput.value = "";
  erroSenha.textContent = "";
  dialog.showModal();
  senhaInput.focus();
});

senhaCancelar.addEventListener("click", () => {
  dialog.close();
});

senhaForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const senha = senhaInput.value;
  if (!senha) return;

  senhaConfirmar.disabled = true;
  erroSenha.textContent = "";

  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/enviar_pergunta`, {
      method: "POST",
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ p_pergunta: perguntaPendente, p_senha: senha }),
    });

    if (!res.ok) throw new Error(await res.text());

    dialog.close();
    form.reset();
    status.textContent = "Pergunta enviada!";
    carregarLista();
  } catch (err) {
    erroSenha.textContent = "Senha incorreta ou erro ao enviar.";
    console.error(err);
  } finally {
    senhaConfirmar.disabled = false;
  }
});

async function carregarLista() {
  lista.textContent = "Carregando...";

  try {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/perguntas?select=id,pergunta&order=id.desc&limit=20`,
      {
        headers: {
          apikey: SUPABASE_ANON_KEY,
          Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        },
      }
    );

    if (!res.ok) throw new Error(await res.text());

    const perguntas = await res.json();
    lista.textContent = "";

    if (perguntas.length === 0) {
      const vazio = document.createElement("p");
      vazio.className = "vazio";
      vazio.textContent = "Nenhuma pergunta enviada ainda.";
      lista.appendChild(vazio);
      return;
    }

    for (const p of perguntas) {
      const item = document.createElement("details");

      const summary = document.createElement("summary");
      summary.textContent = `Pergunta #${p.id}`;

      const texto = document.createElement("p");
      texto.textContent = p.pergunta;

      item.appendChild(summary);
      item.appendChild(texto);
      lista.appendChild(item);
    }
  } catch (err) {
    lista.textContent = "Erro ao carregar perguntas.";
    console.error(err);
  }
}

carregarLista();
