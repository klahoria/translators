const fs = require("fs");
const Handlebars = require("handlebars");
const translate = require("@iamtraction/google-translate");

// Regex patterns
const HANDLEBARS_VAR_RE = /{{[^}]+}}/g;
const URL_RE = /(https?:\/\/[^\s<>"']+)/gi;
const TAG_RE = /(<[^>]+>)/g;

/**
 * Translates a content string, skipping URLs and Handlebars expressions
 * @param {string} str
 * @param {string} targetLang
 * @returns {Promise<string>}
 */
async function translateTextContent(str, targetLang) {
  if (!str.trim()) return str;

  const handlebarsVars = [...str.matchAll(HANDLEBARS_VAR_RE)];
  const urls = [...str.matchAll(URL_RE)];

  const placeholders = [];
  let replaced = str;

  // handlebarsVars.forEach((match, idx) => {
  //   const key = `___HB_VAR_${idx}___`;
  //   replaced = replaced.replace(match[0], key);
  //   placeholders.push({ key, value: match[0] });
  // });

  // urls.forEach((match, idx) => {
  //   const key = `___URL_${idx}___`;
  //   replaced = replaced.replace(match[0], key);
  //   placeholders.push({ key, value: match[0] });
  // });

  let translated = "";
  try {
    const res = await translate(replaced, { to: targetLang });
    translated = res.text;
  } catch (err) {
    console.error("Translation error:", err);
    translated = str;
  }

  for (const { key, value } of placeholders) {
    translated = translated.replace(key, value);
  }

  return translated;
}

/**
 * Translate visible text of a Handlebars template and write to output file
 * @param {string} template
 * @param {string} targetLang
 * @param {string} outputFilePath
 */
async function translateHandlebars(
  template,
  targetLang = "es",
  outputFilePath = "translated.handlebars"
) {
  const tokens = template.split(TAG_RE);
  const writeStream = fs.createWriteStream(outputFilePath, {
    flags: "w",
    encoding: "utf8",
  });

  for (let i = 0; i < tokens.length; i++) {
    const part = tokens[i];

    if (part.match(TAG_RE)) {
      writeStream.write(part);
    } else {
      const result = await translateTextContent(part, targetLang);
      writeStream.write(result);
    }
  }

  writeStream.end(() => {
    console.log(`✅ Translated output written to ${outputFilePath}`);
  });
}

module.exports = {
  translateHandlebars,
};

(async () => {
  const fs = require("fs");
  const template = await fs.readFileSync("./contract.handlebars", "utf-8");

  const translated = await translateHandlebars(template, "fr");
  console.log(translated);
})();
