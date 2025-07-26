// worker.js
const translate = require("@iamtraction/google-translate");

const VAR_RE = /{{[^}]+}}/g;
const VAR_ONLY_RE = /^{{[^}]+}}$/;
const skip = (s) =>
  !s.trim() ||
  !/[a-z0-9]/i.test(s) ||
  /^[-–_.:;|+*~!@#$%^&()\[\]{}<>"'=\\\/\n\r\t\s]+$/.test(s) ||
  VAR_ONLY_RE.test(s.trim());

const translateText = async (text, to) => {
  if (skip(text)) return text;

  const tokens = text.split(VAR_RE);
  const vars = text.match(VAR_RE) || [];

  const translated = await Promise.all(
    tokens.map(async (t) =>
      skip(t)
        ? t
        : (await translate(t, { to }).catch(() => ({ text: t }))).text
    )
  );

  return translated.reduce((acc, t, i) => acc + t + (vars[i] || ""), "");
};

process.on("message", async (msg) => {
  const { id, text, lang } = msg;
  const translated = await translateText(text, lang);
  process.send({ id, translated });
});
