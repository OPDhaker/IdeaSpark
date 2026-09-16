export const PLAYBOOK_ARTICLE_ID = "playbook-article";

function toMarkdown(node: Node): string {
  if (node.nodeType === Node.TEXT_NODE) {
    return (node.textContent ?? "")
      .replace(/^\s*\n\s*$/, "")
      .replace(/\s+/g, " ");
  }
  if (!(node instanceof Element) || node.hasAttribute("aria-hidden")) return "";

  const text = Array.from(node.childNodes, toMarkdown).join("").trim();
  const tag = node.tagName;

  if (/^H[1-3]$/.test(tag)) return `${"#".repeat(Number(tag[1]))} ${text}\n\n`;
  if (tag === "BR") return " ";
  if (tag === "STRONG") return `**${text}**`;
  if (tag === "A") return `[${text}](${node.getAttribute("href")})`;
  if (tag === "P") return `${text}\n\n`;
  if (tag === "SUMMARY") return `### ${text}\n\n`;
  if (tag === "UL" || tag === "OL") {
    const items = Array.from(
      node.children,
      (item, i) =>
        `${tag === "OL" ? `${i + 1}.` : "-"} ${toMarkdown(item).trim()}`,
    );
    return `${items.join("\n")}\n\n`;
  }
  if (node instanceof HTMLTableElement) {
    const rows = Array.from(node.rows, (row, i) => {
      const cells = Array.from(row.cells, (cell) => toMarkdown(cell).trim());
      const divider =
        i === 0 ? `| ${cells.map(() => "---").join(" | ")} |\n` : "";
      return `| ${cells.join(" | ")} |\n${divider}`;
    });
    return `${rows.join("")}\n\n`;
  }
  if (node.hasAttribute("data-callout")) {
    const lines = text
      .split(/\n+/)
      .filter(Boolean)
      .map((line) => `> ${line}`);
    return `> [!IMPORTANT]\n${lines.join("\n")}\n\n`;
  }
  if (["ARTICLE", "SECTION", "DETAILS", "DIV"].includes(tag)) {
    return `${text}\n\n`;
  }
  return text;
}

export function pageMarkdown() {
  const article = document.getElementById(PLAYBOOK_ARTICLE_ID);
  if (!article) return "";
  return `${toMarkdown(article)
    .replace(/\n{3,}/g, "\n\n")
    .trim()}\n`;
}
