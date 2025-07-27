const translate = require("@iamtraction/google-translate");
const { MongoClient } = require("mongodb");

const VAR_RE = /{{[^}]+}}/g;
const VAR_ONLY_RE = /^{{[^}]+}}$/;

// const skip = (s) =>
//   !s.trim() ||
//   !/[a-z0-9]/i.test(s) ||
//   /^[-–_.:;|+*~!@#$%^&()\[\]{}<>"'=\\\/\n\r\t\s]+$/.test(s) ||
//   VAR_ONLY_RE.test(s.trim());

const BLOCK_RE = /^{{[#\/][^}]+}}$/; // Matches block helpers like {{#if}}, {{/if}}, etc.

const skip = (s) =>
  !s.trim() ||
  !/[a-z0-9]/i.test(s) || // no alphanumeric content
  /^[-–_.:;|+*~!@#$%^&()\[\]{}<>"'=\\\/\n\r\t\s]+$/.test(s) || // symbols only
  VAR_ONLY_RE.test(s.trim()) || // exact match like {{some_var}}
  BLOCK_RE.test(s.trim()) || // block helper tags like {{#if condition}}, {{/if}}
  /{{[^}]*}}.*{{\/[^}]*}}/.test(s.trim()); // inline tag followed by closing like {{guardian}}{{/if}}

// MongoDB setup
const MONGO_URI = "mongodb://localhost:27017";
const DB_NAME = "translations";
const COLLECTION = "logs";

let db, collection;

const connectMongo = async () => {
  if (collection) return collection;
  const client = await MongoClient.connect(MONGO_URI, {
    useUnifiedTopology: true,
  });
  db = client.db(DB_NAME);
  collection = db.collection(COLLECTION);
  return collection;
};

const findTranslation = async (original, from, to) => {
  try {
    const col = await connectMongo();
    return await col.findOne({ original, from, to });
  } catch (err) {
    console.error("❌ MongoDB find error:", err.message);
    return null;
  }
};

const saveTranslation = async ({ original, translated, from, to }) => {
  try {
    const col = await connectMongo();
    await col.insertOne({
      original,
      translated,
      from,
      to,
      timestamp: new Date(),
    });
  } catch (err) {
    console.error("❌ MongoDB insert error:", err.message);
  }
};

const translateText = async (text, to, from = "en") => {
  if (skip(text)) return text;

  // ✅ Check if translation already exists
  const existing = await findTranslation(text, from, to);
  if (existing && existing.translated) {
    return existing.translated;
  }

  const tokens = text.split(VAR_RE);
  const vars = text.match(VAR_RE) || [];

  const translatedTokens = await Promise.all(
    tokens.map(async (t) => {
      if (skip(t)) return t;

      try {
        const res = await translate(t, { from, to });
        await saveTranslation({
          original: text,
          translated: res.text,
          from,
          to,
        });

        return res.text;
      } catch (e) {
        return t; // fallback
      }
    })
  );

  const finalText = translatedTokens.reduce(
    (acc, t, i) => acc + t + (vars[i] || ""),
    ""
  );

  // ✅ Save translation to MongoDB
  return finalText;
};

process.on("message", async (msg) => {
  const { id, text, lang, from = "en" } = msg;
  const translated = await translateText(text, lang, from);
  process.send({ id, translated });
});

module.exports = { translate };
