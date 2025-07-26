const fs = require("fs");
const translate = require("@iamtraction/google-translate");

// Regex patterns
const HANDLEBARS_VAR_RE = /{{[^}]+}}/g;
const URL_RE = /(https?:\/\/[^\s<>"']+)/gi;
const TAG_RE = /(<[^>]+>)/g;

// Limit concurrent translations
const MAX_CONCURRENT = 5;

/**
 * A simple concurrency limiter
 */
function createLimiter(limit) {
  const queue = [];
  let active = 0;

  const run = async (fn) => {
    if (active >= limit) {
      await new Promise((resolve) => queue.push(resolve));
    }
    active++;
    try {
      return await fn();
    } finally {
      active--;
      if (queue.length > 0) queue.shift()();
    }
  };

  return run;
}

/**
 * Translates a content string, skipping URLs and Handlebars expressions
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

  // Restore original placeholders
  for (const { key, value } of placeholders) {
    translated = translated.replace(key, value);
  }

  return translated;
}

/**
 * Translates a Handlebars template file and writes to output using limited concurrency
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

  const runWithLimit = createLimiter(MAX_CONCURRENT);

  const translateToken = async (token) => {
    if (token.match(TAG_RE)) {
      writeStream.write(token);
    } else {
      const translated = await runWithLimit(() =>
        translateTextContent(token, targetLang)
      );
      writeStream.write(translated);
    }
  };

  for (const token of tokens) {
    await translateToken(token);
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
  // const { translateHandlebars } = require("./translateHandlebars");

  const template = fs.readFileSync("./contract.handlebars", "utf-8");
  await translateHandlebars(template, "ja", "./contract.ja.handlebars");
})();
