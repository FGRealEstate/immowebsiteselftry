const fs = require("fs");
const path = require("path");

const projectRoot = path.resolve(__dirname, "..");

function readJsonDirectory(name) {
  const directory = path.join(projectRoot, "content", name);
  return fs.readdirSync(directory)
    .filter((file) => file.endsWith(".json"))
    .sort((a, b) => a.localeCompare(b, "de"))
    .map((file) => JSON.parse(fs.readFileSync(path.join(directory, file), "utf8")));
}

function cleanText(value) {
  return String(value || "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function limit(value, max = 1050) {
  const text = cleanText(value);
  if (text.length <= max) return text;
  const cut = text.slice(0, max);
  const lastSentence = Math.max(cut.lastIndexOf(". "), cut.lastIndexOf("! "), cut.lastIndexOf("? "));
  return `${cut.slice(0, lastSentence > max * 0.55 ? lastSentence + 1 : max).trim()} …`;
}

function keywordList(...values) {
  const explicit = values.flatMap((value) => Array.isArray(value) ? value : []);
  const text = values.filter((value) => typeof value === "string").join(" ").toLocaleLowerCase("de-DE");
  const tokens = text.match(/[a-zäöüß0-9][a-zäöüß0-9%./-]{2,}/g) || [];
  return [...new Set([...explicit, ...tokens].map((item) => cleanText(item).toLocaleLowerCase("de-DE")).filter(Boolean))].slice(0, 120);
}

function articleAnswer(article) {
  if (article.assistantAnswer) {
    return limit([article.assistantAnswer, article.decisionUse].filter(Boolean).join(" Entscheidungsrelevant: "));
  }
  const faqAnswer = Array.isArray(article.faq) ? article.faq.map((item) => item.a).filter(Boolean).join(" ") : "";
  return limit([article.summary, faqAnswer, article.decisionUse, article.body].filter(Boolean).join(" "));
}

function lexiconAnswer(entry) {
  return limit(entry.assistantAnswer || [entry.definition, entry.explanation, entry.practiceExample].filter(Boolean).join(" "));
}

const articles = readJsonDirectory("wissen").map((article) => {
  const answer = articleAnswer(article);
  return {
    kind: "article",
    id: article.id || article.slug,
    title: article.title,
    category: article.category || "Immobilienwissen",
    summary: cleanText(article.summary || article.lead || article.body),
    answer,
    url: article.url || `/wissen/${article.slug}/`,
    keywords: keywordList(article.keywords, article.synonyms, article.title, article.summary, article.body, answer)
  };
});

const lexicon = readJsonDirectory("lexikon").map((entry) => {
  const answer = lexiconAnswer(entry);
  return {
    kind: "lexicon",
    id: entry.id || entry.slug,
    title: entry.term,
    category: entry.category || "Immobilienwissen",
    summary: cleanText(entry.definition),
    answer,
    url: entry.url || `/lexikon/${entry.slug}/`,
    keywords: keywordList(entry.keywords, entry.synonyms, entry.term, entry.definition, entry.explanation, answer)
  };
});

const knowledge = [...articles, ...lexicon];
const output = `/* Automatisch aus content/wissen und content/lexikon erzeugt. */\nwindow.FG_SHARED_KNOWLEDGE=${JSON.stringify(knowledge)};\n`;
fs.writeFileSync(path.join(projectRoot, "fg-knowledge.js"), output, "utf8");

console.log(`[F&G Wissen] ${articles.length} Artikel + ${lexicon.length} Lexikoneinträge = ${knowledge.length} Einträge`);
