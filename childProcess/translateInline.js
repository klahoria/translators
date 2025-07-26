const fs = require("fs");
const translate = require("@iamtraction/google-translate");

const HANDLEBARS_VAR_RE = /{{[^}]+}}/g;
const URL_RE = /(https?:\/\/[^\s<>"']+)/gi;
const TAG_RE = /(<[^>]+>)/g;
const HANDLEBARS_WHOLE_RE = /^{{[^}]+}}$/;
const MAX_CONCURRENT = 5;

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

async function translateTextContent(str, targetLang) {
  const isSkippable = (s) =>
    !s.trim() ||
    !/[a-zA-Z0-9]/.test(s) ||
    /^[-–—_.:;|+*~!@#$%^&()\[\]{}<>"'=\\\/\n\r\t\s]+$/.test(s) ||
    HANDLEBARS_WHOLE_RE.test(s.trim());

  if (isSkippable(str)) return str;

  const replaced = str;
  if (
    !HANDLEBARS_WHOLE_RE.test(replaced.trim()) &&
    HANDLEBARS_VAR_RE.test(replaced.trim())
  ) {
    let translated = "";
    const values = replaced
      .split(HANDLEBARS_VAR_RE)
      .filter(Boolean)
      .filter((v) => v && /[a-zA-Z0-9]/.test(v) && !/^\s*[\r\n]+\s*$/.test(v));

    if (!values.length) return replaced;

    for (const value of values) {
      try {
        const res = await translate(value, { to: targetLang });
        translated += res.text;
      } catch (err) {
        console.error("Translation error:", err);
        translated += str;
      }
    }
    return translated;
  } else {
    try {
      const res = await translate(replaced, { to: targetLang });
      return res.text;
    } catch (err) {
      console.error("Translation error:", err);
      return str;
    }
  }
}

async function translateHandlebars(
  template,
  targetLang = "es",
  outputFilePath = "translated.handlebars"
) {
  const writeStream = fs.createWriteStream(outputFilePath, {
    flags: "w",
    encoding: "utf8",
  });

  const runWithLimit = createLimiter(MAX_CONCURRENT);

  const styleBlockRegex = /<style[^>]*>[\s\S]*?<\/style>/gi;
  const styleBlocks = [];
  let templateCopy = template;

  // Extract style blocks

  templateCopy = templateCopy.replace(styleBlockRegex, (match) => {
    styleBlocks.push(match);
    return `___STYLE_BLOCK_${styleBlocks.length - 1}___`;
  });

  const tokens = templateCopy.split(TAG_RE);

  const translateToken = async (token) => {
    if (token.match(TAG_RE)) {
      writeStream.write(token);
    } else if (/___STYLE_BLOCK_\d+___/.test(token)) {
      const index = parseInt(token.match(/(\d+)/)[0], 10);
      writeStream.write(styleBlocks[index]); // Write style block unmodified
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

// Example run
