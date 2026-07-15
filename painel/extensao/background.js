// Ponte entre a página do portal e o Painel (127.0.0.1:4599), e gatilho da extensão.
//
// Por que pelo ÍCONE e não por uma lista de sites: as vagas do painel vêm de mais de 60
// domínios (LinkedIn, vagas.com.br, infojobs, empregos, dezenas de subdomínios da Gupy,
// greenhouse, lever, smartrecruiters, workday, inhire, solides, ashby, workable…), e o
// link do anúncio ainda redireciona para o ATS da empresa. Qualquer lista fixa nasce
// incompleta. A alternativa — rodar em TODOS os sites — daria à extensão acesso ao banco,
// ao e-mail e a tudo mais que a pessoa abre; para um preenchedor de formulário isso é
// invasivo demais. Com activeTab a extensão só enxerga a aba em que se clicou, no momento
// do clique, e nada mais.
//
// Quem busca as respostas é este service worker: uma página do portal não pode chamar o
// seu localhost (o navegador barra por CORS), mas a extensão pode, porque o manifest
// declara 127.0.0.1:4599 em host_permissions. Assim o painel não precisa abrir CORS.

const PAINEL = "http://127.0.0.1:4599";

async function buscar(caminho) {
  const r = await fetch(PAINEL + caminho);
  if (!r.ok) throw new Error("o painel respondeu " + r.status);
  return r.json();
}

chrome.runtime.onMessage.addListener((msg, _sender, responder) => {
  if (!msg) return;
  const rota =
    msg.tipo === "respostas" ? "/api/answers/for?url=" + encodeURIComponent(msg.url || "") +
      "&titulo=" + encodeURIComponent(msg.titulo || "")
    : msg.tipo === "lista" ? "/api/answers/list"
    // A vaga escolhida na mão vai pela MESMA rota (a URL exata casa direto). Assim ela
    // também recebe o padrão somado — pelo /api/answers cru viria só o que a vaga tem.
    : msg.tipo === "vaga" ? "/api/answers/for?url=" + encodeURIComponent(msg.url || "")
    : null;
  if (!rota) return;
  buscar(rota)
    .then((d) => responder({ ok: true, d }))
    .catch(() =>
      // Erro aqui quase sempre é o painel fechado — é a dica que ajuda a pessoa.
      responder({ ok: false, erro: "não consegui falar com o Painel. Ele está aberto? (a janela preta precisa estar rodando)" })
    );
  return true;   // resposta é assíncrona
});

// Clique no ícone: injeta o preenchedor nesta aba e manda preencher. Injetar duas vezes
// é inofensivo — o content.js se protege e apenas reexecuta o preenchimento.
chrome.action.onClicked.addListener(async (tab) => {
  if (!tab.id) return;
  try {
    await chrome.scripting.insertCSS({ target: { tabId: tab.id }, files: ["content.css"] });
    await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ["content.js"] });
    await chrome.scripting.executeScript({ target: { tabId: tab.id }, func: () => window.__painelPreencher && window.__painelPreencher() });
  } catch (e) {
    // Páginas internas do navegador (chrome://, a loja de extensões) recusam injeção.
    console.warn("Painel: não consegui abrir nesta página — " + e.message);
  }
});
