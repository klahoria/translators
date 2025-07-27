const translate = require("@iamtraction/google-translate");
const { MongoClient } = require("mongodb");

const VAR_RE = /({{[^}]+}})/g;
const VAR_ONLY_RE = /^{{[^}]+}}$/;
const BLOCK_RE = /^{{[#\/][^}]+}}$/;
const INLINE_BLOCK_RE = /{{[^}]*}}.*{{\/[^}]*}}/;

// Text skipping logic
const skip = (s) =>
  !s.trim() ||
  !/[a-z0-9]/i.test(s) ||
  /^[-–_.:;|+*~!@#$%^&()\[\]{}<>"'=\\\/\n\r\t\s]+$/.test(s) ||
  VAR_ONLY_RE.test(s.trim()) ||
  BLOCK_RE.test(s.trim()) ||
  INLINE_BLOCK_RE.test(s.trim()) ||
  !s.replace(/&nbsp;/gi, "").trim();

// MongoDB setup
const MONGO_URI = "mongodb://localhost:27017";
const DB_NAME = "translations";
const COLLECTION = "logs";

let db, collection;

const connectMongo = async () => {
  if (collection) return collection;
  const client = await MongoClient.connect(MONGO_URI, {
    useUnifiedTopology: true,
    monitorCommands: true,
  });
  db = client.db(DB_NAME);
  collection = db.collection(COLLECTION);
  return collection;
};

const findTranslation = async (original, from = "en", to) => {
  try {
    const col = await connectMongo();
    return await col.findOne({
      original: original.replace(/\s+/g, " ").trim(),
      to,
    });
  } catch (err) {
    console.error("❌ MongoDB find error:", err.message);
    return null;
  }
};

const saveTranslation = async ({ original, translated, from, to }) => {
  try {
    if (original == "&nbsp;" || !original.replace(/&nbsp/g, "").trim()) return;
    const col = await connectMongo();
    await col.insertOne({
      original: original.trim(),
      translated: translated.trim(),
      from,
      to,
      timestamp: new Date(),
    });
  } catch (err) {
    console.error("❌ MongoDB insert error:", err.message);
  }
};

const translateText = async (text, from = "en", to) => {
  if (skip(text)) return text;

  const tokens = text.split(VAR_RE); // Includes {{...}} as separate tokens

  let finalFrom = from;
  const translatedTokens = await Promise.all(
    tokens.map(async (t) => {
      if (skip(t)) return t;

      const cached = await findTranslation(t.trim(), from, to);
      if (cached?.translated) return cached.translated;

      // 🔥 NEW: Split text into smaller sentences
      const sentences = t.split(/(?<=[.?!])\s+(?=[A-Z])/); // simple sentence splitter

      const translatedSentences = await Promise.all(
        sentences.map(async (sentence) => {
          try {
            const res = await translate(sentence, { from, to });

            // Save each sentence only if it's not already saved
            await saveTranslation({
              original: sentence.replace(/\s+/g, " ").trim(),
              translated: res.text.replace(/\s+/g, " ").trim(),
              from,
              to,
            });

            return res.text;
          } catch {
            return sentence;
          }
        })
      );

      return translatedSentences.join(" ");
    })
  );

  return translatedTokens.join("");
};

// Child process handler
process.on("message", async (msg) => {
  const { id, text, lang, from = "en" } = msg;
  const translated = await translateText(text, from, lang);
  process.send({ id, translated });
});

module.exports = { translateText };
