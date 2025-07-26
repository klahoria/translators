const Handlebars = require("handlebars");
const translate = require("@iamtraction/google-translate");

// Regex patterns
const HANDLEBARS_VAR_RE = /{{[^}]+}}/g;
const URL_RE = /(https?:\/\/[^\s<>"']+)/gi;
const TAG_RE = /(<[^>]+>)/g;

/**
 * Translate visible text of a Handlebars template
 * @param {string} template
 * @param {string} targetLang
 * @returns {string}
 */
async function translateHandlebars(template, targetLang = "es") {
  const tokens = template.split(TAG_RE);
  const translated = [];

  for (let i = 0; i < tokens.length; i++) {
    const part = tokens[i];

    if (part.match(TAG_RE)) {
      // It's an HTML tag, don't translate
      translated.push(part);
    } else {
      // Process text content
      const result = await translateTextContent(part, targetLang);
      translated.push(result);
    }
  }

  return translated.join("");
}

/**
 * Translates a content string, skipping URLs and Handlebars expressions
 * @param {string} str
 * @param {string} targetLang
 * @returns {Promise<string>}
 */
async function translateTextContent(str, targetLang) {
  if (!str.trim()) return str;

  // Extract Handlebars variables and URLs
  const handlebarsVars = [...str.matchAll(HANDLEBARS_VAR_RE)];
  const urls = [...str.matchAll(URL_RE)];

  const placeholders = [];
  let replaced = str;

  // Replace handlebars expressions with placeholders
  // handlebarsVars.forEach((match, idx) => {
  //   const key = `___HB_VAR_${idx}___`;
  //   replaced = replaced.replace(match[0], key);
  //   placeholders.push({ key, value: match[0] });
  // });

  // Replace URLs with placeholders
  // urls.forEach((match, idx) => {
  //   const key = `___URL_${idx}___`;
  //   replaced = replaced.replace(match[0], key);
  //   placeholders.push({ key, value: match[0] });
  // });

  // Translate cleaned string
  let translated = "";
  try {
    const res = await translate(replaced, { to: targetLang });
    translated = res.text;
  } catch (err) {
    console.error("Translation error:", err);
    translated = str;
  }

  // Restore placeholders
  for (const { key, value } of placeholders) {
    translated = translated.replace(key, value);
  }

  return translated;
}

module.exports = {
  translateHandlebars,
};

// const { translateHandlebars } = require('./translateHandlebars');

(async () => {
  const fs = require('fs')
  const template = await fs.readFileSync('./contract.handlebars', 'utf-8')

  const translated = await translateHandlebars(template, "fr");
  console.log(translated);
})();
