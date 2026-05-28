// Rendu markdown minimaliste sans dépendance externe.
// On n'a pas (encore) de lib markdown installée, donc on parse les bases :
// # headings, **bold**, *italic*, `code`, [links](url), - listes, ``` blocs code.
// Suffisant pour un wiki interne. Si on veut plus tard, on swap pour
// react-markdown ou marked.
//
// Sécurité : on échappe le HTML manuellement avant d'appliquer les regex
// pour éviter les XSS depuis le markdown utilisateur.

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function renderInline(s: string): string {
  let out = escapeHtml(s);
  // Code inline (avant tout autre formatage)
  out = out.replace(/`([^`]+)`/g, '<code class="px-1 py-0.5 rounded bg-midnight-100 text-[0.85em] font-mono">$1</code>');
  // Liens [texte](url)
  out = out.replace(
    /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g,
    '<a href="$2" target="_blank" rel="noopener noreferrer" class="text-indigoaccent hover:underline">$1</a>'
  );
  // Bold **x**
  out = out.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  // Italique *x*
  out = out.replace(/(?<!\*)\*([^*\n]+)\*(?!\*)/g, '<em>$1</em>');
  return out;
}

function markdownToHtml(md: string): string {
  const lines = md.split("\n");
  let html = "";
  let inCode = false;
  let codeLang = "";
  let codeBuf: string[] = [];
  let listBuf: string[] = [];
  let listType: "ul" | "ol" | null = null;

  const flushList = () => {
    if (listType && listBuf.length) {
      const tag = listType;
      html += `<${tag} class="${tag === "ul" ? "list-disc" : "list-decimal"} pl-5 my-2 text-sm space-y-1">${listBuf.join("")}</${tag}>`;
    }
    listBuf = [];
    listType = null;
  };
  const flushCode = () => {
    if (codeBuf.length) {
      html += `<pre class="bg-midnight-900 text-midnight-50 rounded p-3 text-xs overflow-x-auto my-3 font-mono">${escapeHtml(
        codeBuf.join("\n")
      )}</pre>`;
    }
    codeBuf = [];
    codeLang = "";
  };

  for (const raw of lines) {
    const line = raw.replace(/\r$/, "");

    // Bloc de code ```
    const fenceMatch = line.match(/^```(\w*)\s*$/);
    if (fenceMatch) {
      if (inCode) {
        flushCode();
        inCode = false;
      } else {
        flushList();
        inCode = true;
        codeLang = fenceMatch[1] || "";
      }
      continue;
    }
    if (inCode) {
      codeBuf.push(line);
      continue;
    }

    // Heading
    const h = line.match(/^(#{1,6})\s+(.*)$/);
    if (h) {
      flushList();
      const level = h[1].length;
      const sizes = ["text-2xl", "text-xl", "text-lg", "text-base", "text-sm", "text-xs"];
      const cls = sizes[level - 1] ?? "text-sm";
      html += `<h${level} class="font-semibold ${cls} text-midnight-900 mt-4 mb-2">${renderInline(h[2])}</h${level}>`;
      continue;
    }

    // Liste à puces
    const ul = line.match(/^[-*]\s+(.*)$/);
    if (ul) {
      if (listType !== "ul") {
        flushList();
        listType = "ul";
      }
      listBuf.push(`<li>${renderInline(ul[1])}</li>`);
      continue;
    }

    // Liste numérotée
    const ol = line.match(/^\d+\.\s+(.*)$/);
    if (ol) {
      if (listType !== "ol") {
        flushList();
        listType = "ol";
      }
      listBuf.push(`<li>${renderInline(ol[1])}</li>`);
      continue;
    }

    // Ligne vide -> flush + paragraphe break
    if (line.trim() === "") {
      flushList();
      html += "<div class='h-2'></div>";
      continue;
    }

    // Ligne normale -> paragraphe
    flushList();
    html += `<p class="text-sm text-midnight-800 leading-relaxed my-1">${renderInline(line)}</p>`;
  }
  flushList();
  flushCode();
  return html;
}

export function MarkdownView({ source }: { source: string }) {
  // Rendu côté serveur OK (le HTML est généré ici, pas d'effets de bord).
  // L'échappement est fait à l'intérieur de markdownToHtml.
  const html = markdownToHtml(source);
  return (
    <div
      className="markdown-content"
      // dangerouslySetInnerHTML safe ici car on escape le markdown avant rendu
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
