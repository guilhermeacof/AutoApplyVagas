// Preenche a tela de candidatura com as respostas salvas no Painel.
//
// REGRA QUE NÃO SE QUEBRA: esta extensão NUNCA clica em "Enviar"/"Candidatar-se".
// Ela preenche e para. Conferir e enviar é sempre da pessoa — candidatura é
// irreversível e sai no nome dela.
//
// O casamento pergunta↔campo é por semelhança de texto, então erra às vezes. Por isso
// o relatório mostra, campo a campo, o que foi preenchido e com base em qual pergunta,
// e lista o que ficou sem resposta. Preenchimento silencioso seria pior que nada: a
// pessoa enviaria sem saber que um campo foi preenchido com a resposta errada.

(() => {
  if (window.__painelCandidaturas) return;   // evita injetar duas vezes na mesma aba
  window.__painelCandidaturas = true;

  // ---------- texto ----------
  const PALAVRAS_VAZIAS = new Set(["de","da","do","das","dos","e","a","o","as","os","um","uma","em","no","na",
    "qual","quais","sua","seu","suas","seus","voce","vc","com","para","por","que","tem","possui","favor",
    "informe","descreva","conte","nos","the","your","you","have","please","what","which","is","in","of","and"]);

  const norm = (s) => String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, " ").trim();

  const tokens = (s) => norm(s).split(" ").filter((t) => t && t.length > 1 && !PALAVRAS_VAZIAS.has(t));

  // Semelhança de Dice entre dois textos (0 a 1). Simples e previsível — o suficiente
  // para casar "Pretensão salarial (CLT)" com "Qual sua pretensão salarial?".
  function semelhanca(a, b) {
    const A = new Set(tokens(a)), B = new Set(tokens(b));
    if (!A.size || !B.size) return 0;
    let comuns = 0;
    for (const t of A) if (B.has(t)) comuns++;
    return (2 * comuns) / (A.size + B.size);
  }

  // ---------- achar os campos e seus rótulos ----------
  const visivel = (el) => {
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0 && getComputedStyle(el).visibility !== "hidden";
  };

  function rotuloDe(el) {
    const textoDe = (n) => (n ? String(n.innerText || n.textContent || "").replace(/\s+/g, " ").trim() : "");
    if (el.id) {
      const l = document.querySelector('label[for="' + CSS.escape(el.id) + '"]');
      if (textoDe(l)) return textoDe(l);
    }
    if (el.getAttribute("aria-labelledby")) {
      const t = el.getAttribute("aria-labelledby").split(/\s+/)
        .map((id) => textoDe(document.getElementById(id))).filter(Boolean).join(" ");
      if (t) return t;
    }
    if (el.getAttribute("aria-label")) return el.getAttribute("aria-label").trim();
    const pai = el.closest("label");
    if (textoDe(pai)) return textoDe(pai);
    const fs = el.closest("fieldset");
    if (fs && textoDe(fs.querySelector("legend"))) return textoDe(fs.querySelector("legend"));
    // Último recurso: o texto logo acima do campo (padrão comum em formulários).
    const grupo = el.closest("div,section,li");
    if (grupo && textoDe(grupo).length < 300) return textoDe(grupo);
    return el.name || el.placeholder || "";
  }

  function camposDaTela() {
    const nos = [...document.querySelectorAll("input, textarea, select")];
    const grupos = new Map();   // radios do mesmo name viram UM campo
    const saida = [];
    for (const el of nos) {
      const tipo = (el.type || "").toLowerCase();
      if (["hidden", "submit", "button", "file", "image", "reset", "password", "search"].includes(tipo)) continue;
      if (el.disabled || el.readOnly || !visivel(el)) continue;
      if (tipo === "radio" || tipo === "checkbox") {
        const chave = el.name || rotuloDe(el);
        if (!chave) continue;
        if (!grupos.has(chave)) {
          const g = { tipo: "opcoes", nome: chave, opcoes: [], rotulo: "" };
          grupos.set(chave, g); saida.push(g);
        }
        const g = grupos.get(chave);
        g.opcoes.push({ el, texto: rotuloDe(el) });
        // O rótulo do grupo é a pergunta (legend/fieldset), não o texto de cada opção.
        const fs = el.closest("fieldset");
        if (fs) {
          const lg = fs.querySelector("legend");
          if (lg) g.rotulo = String(lg.innerText || "").replace(/\s+/g, " ").trim();
        }
        if (!g.rotulo) g.rotulo = chave;
        continue;
      }
      saida.push({ tipo: el.tagName === "SELECT" ? "select" : "texto", el, rotulo: rotuloDe(el) });
    }
    return saida.filter((c) => c.rotulo);
  }

  // ---------- escrever no campo ----------
  // React/Ember (LinkedIn e Gupy) ignoram el.value = x: eles guardam o valor num
  // estado interno e sobrescrevem na hora. É preciso chamar o setter nativo e disparar
  // os eventos na mão para o framework perceber a mudança.
  function escrever(el, valor) {
    const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    const setter = Object.getOwnPropertyDescriptor(proto, "value").set;
    setter.call(el, valor);
    el.dispatchEvent(new Event("input", { bubbles: true }));
    el.dispatchEvent(new Event("change", { bubbles: true }));
  }

  const preenchido = (c) =>
    c.tipo === "opcoes" ? c.opcoes.some((o) => o.el.checked) : String(c.el.value || "").trim() !== "";

  function aplicar(campo, resposta) {
    if (campo.tipo === "texto") { escrever(campo.el, resposta); return resposta; }
    if (campo.tipo === "select") {
      const ops = [...campo.el.options];
      const alvo = ops.map((o) => ({ o, s: semelhanca(o.text, resposta) }))
        .sort((a, b) => b.s - a.s).find((x) => x.s >= 0.5);
      if (!alvo) return null;
      campo.el.value = alvo.o.value;
      campo.el.dispatchEvent(new Event("change", { bubbles: true }));
      return alvo.o.text;
    }
    if (campo.tipo === "opcoes") {
      // "Sim, aplico BDD…" → marca a opção "Sim". Senão, a opção mais parecida.
      const inicio = norm(resposta).split(" ")[0];
      let alvo = campo.opcoes.find((o) => norm(o.texto) === inicio);
      if (!alvo) {
        alvo = campo.opcoes.map((o) => ({ o, s: semelhanca(o.texto, resposta) }))
          .sort((a, b) => b.s - a.s).filter((x) => x.s >= 0.5).map((x) => x.o)[0];
      }
      if (!alvo) return null;
      alvo.el.click();
      return alvo.texto;
    }
    return null;
  }

  // ---------- preencher ----------
  const LIMITE = 0.45;   // abaixo disso o casamento é chute; melhor deixar em branco

  function preencher(campos, respostas) {
    const usados = new Set();
    const feitos = [], semResposta = [], jaTinha = [];
    for (const campo of campos) {
      if (preenchido(campo)) { jaTinha.push(campo.rotulo); continue; }   // não sobrescreve o que o portal já trouxe
      const cand = respostas
        .map((r, i) => ({ i, r, s: semelhanca(campo.rotulo, r.pergunta) }))
        .filter((x) => x.r.resposta && !usados.has(x.i) && x.s >= LIMITE)
        .sort((a, b) => b.s - a.s)[0];
      if (!cand) { semResposta.push(campo.rotulo); continue; }
      const escrito = aplicar(campo, cand.r.resposta);
      if (escrito == null) { semResposta.push(campo.rotulo); continue; }
      usados.add(cand.i);
      feitos.push({ campo: campo.rotulo, pergunta: cand.r.pergunta, valor: escrito, conf: cand.s });
    }
    return { feitos, semResposta, jaTinha };
  }

  // ---------- interface ----------
  const corta = (s, n) => (s.length > n ? s.slice(0, n - 1) + "…" : s);

  function relatorio(res, info) {
    const cx = document.createElement("div");
    cx.className = "pcx-relat";
    const linhas = res.feitos.map((f) =>
      '<li><b>' + corta(f.campo, 60) + '</b><span>' + corta(String(f.valor), 90) + '</span>' +
      (f.conf < 0.7 ? '<i class="pcx-duvida">confira: casei com “' + corta(f.pergunta, 45) + '”</i>' : '') + '</li>').join("");
    const faltou = res.semResposta.length
      ? '<p class="pcx-faltou"><b>Sem resposta salva (' + res.semResposta.length + '):</b> ' +
        corta(res.semResposta.join(" · "), 220) + '</p>' : "";
    cx.innerHTML =
      '<div class="pcx-topo"><span>' + (res.feitos.length ? "✅ " + res.feitos.length + " campo(s) preenchido(s)" : "Nada para preencher aqui") +
      '</span><button class="pcx-x" title="Fechar">✕</button></div>' +
      '<p class="pcx-fonte">' + info + '</p>' +
      (linhas ? '<ul class="pcx-lista">' + linhas + '</ul>' : "") + faltou +
      '<p class="pcx-aviso">⚠ Confira tudo antes de enviar. <b>Eu não envio nada</b> — o clique em “Enviar” é seu.</p>';
    cx.querySelector(".pcx-x").addEventListener("click", () => cx.remove());
    document.querySelectorAll(".pcx-relat").forEach((n) => n.remove());
    document.body.appendChild(cx);
  }

  function aviso(texto) {
    relatorio({ feitos: [], semResposta: [], jaTinha: [] }, texto);
  }

  const botao = document.createElement("button");
  botao.className = "pcx-btn";
  botao.textContent = "📋 Preencher com o Painel";
  botao.addEventListener("click", () => {
    botao.disabled = true; botao.textContent = "Buscando respostas…";
    chrome.runtime.sendMessage({ tipo: "respostas", url: location.href }, (resp) => {
      botao.disabled = false; botao.textContent = "📋 Preencher com o Painel";
      if (!resp || !resp.ok) return aviso("❌ " + ((resp && resp.erro) || "não consegui falar com o Painel."));
      const d = resp.d || {};
      const respostas = (d.campos || []).filter((c) => c.resposta);
      if (!respostas.length) return aviso("Não há respostas salvas para preencher. Abra a vaga no Painel e prepare as respostas primeiro.");
      const campos = camposDaTela();
      const res = preencher(campos, respostas);
      const fonte = d.achou
        ? "Respostas desta vaga: " + (d.vaga.company || "") + (d.vaga.title ? " — " + d.vaga.title : "") +
          (d.casou === "id" ? " (casei pelo id da vaga)" : "")
        : "⚠ Não achei esta vaga no Painel — usei só os seus dados padrão (cidade, pretensão, LinkedIn…). " +
          "As perguntas específicas desta vaga ficaram em branco.";
      relatorio(res, fonte);
    });
  });

  const por = () => { if (!document.body.contains(botao)) document.body.appendChild(botao); };
  por();
  // O formulário do LinkedIn é um modal de várias páginas: o botão precisa sobreviver
  // à troca de página, e a pessoa clica de novo a cada etapa.
  new MutationObserver(por).observe(document.documentElement, { childList: true, subtree: true });
})();
