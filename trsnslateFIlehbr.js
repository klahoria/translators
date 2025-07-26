const fs = require("fs");
const translate = require("@iamtraction/google-translate");

const VAR_RE = /{{[^}]+}}/g,
  URL_RE = /(https?:\/\/[^\s<>"']+)/gi,
  TAG_RE = /(<[^>]+>)/g,
  VAR_ONLY_RE = /^{{[^}]+}}$/,
  MAX = 5;

const limiter = (limit) => {
  const q = [],
    r = async (f) => {
      if (q.length >= limit) await new Promise((res) => q.push(res));
      q.push(1);
      try {
        return await f();
      } finally {
        q.shift();
        if (typeof q[0] === "function") q.shift()();
      }
    };
  return r;
};

const skip = (s) =>
  !s.trim() ||
  !/[a-z0-9]/i.test(s) ||
  /^[-–_.:;|+*~!@#$%^&()\[\]{}<>"'=\\\/\n\r\t\s]+$/.test(s) ||
  VAR_ONLY_RE.test(s.trim());

const translateText = async (str, to) => {
  if (skip(str)) return str;
  const tokens = str.split(VAR_RE);
  const vars = str.match(VAR_RE) || [];
  if (!tokens.length) return str;

  const translated = [];
  for (let t of tokens) {
    if (!skip(t)) {
      try {
        const { text } = await translate(t, { to });
        translated.push(text);
      } catch {
        translated.push(t);
      }
    } else translated.push(t);
  }

  // Interleave with handlebars
  return translated.reduce((acc, t, i) => acc + t + (vars[i] || ""), "");
};

const translateHandlebars = async (
  tpl,
  to = "es",
  out = "translated.handlebars"
) => {
  const ws = fs.createWriteStream(out, { flags: "w", encoding: "utf8" });
  const run = limiter(MAX);

  const styles = [],
    tplCopy = tpl.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, (m) => {
      styles.push(m);
      return `___STYLE_${styles.length - 1}___`;
    });

  const tokens = tplCopy.split(TAG_RE);

  for (let t of tokens) {
    if (TAG_RE.test(t)) ws.write(t);
    else if (/___STYLE_(\d+)___/.test(t)) ws.write(styles[+t.match(/\d+/)[0]]);
    else ws.write(await run(() => translateText(t, to)));
  }

  ws.end(() => console.log(`✅ Output written to ${out}`));
};

module.exports = { translateHandlebars };

(async () => {
  const tpl = fs.readFileSync("./contract.handlebars", "utf-8");
  await translateHandlebars(tpl, "ja", "./contract.ja.handlebars");
})();
