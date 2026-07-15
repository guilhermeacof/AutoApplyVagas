// Ponte entre a página do portal e o Painel (127.0.0.1:4599).
//
// Quem busca as respostas é este service worker, não o content script: uma página do
// LinkedIn não pode chamar o seu localhost (o navegador barra por CORS), mas a
// extensão pode, porque o manifest declara 127.0.0.1:4599 em host_permissions.
// Assim o painel não precisa abrir CORS para a internet inteira.

const PAINEL = "http://127.0.0.1:4599";

chrome.runtime.onMessage.addListener((msg, _sender, responder) => {
  if (!msg || msg.tipo !== "respostas") return;
  fetch(PAINEL + "/api/answers/for?url=" + encodeURIComponent(msg.url || ""))
    .then((r) => {
      if (!r.ok) throw new Error("o painel respondeu " + r.status);
      return r.json();
    })
    .then((d) => responder({ ok: true, d }))
    .catch(() =>
      // Erro aqui quase sempre é o painel fechado — é a dica que ajuda a pessoa.
      responder({ ok: false, erro: "não consegui falar com o Painel. Ele está aberto? (a janela preta precisa estar rodando)" })
    );
  return true;   // resposta é assíncrona
});
