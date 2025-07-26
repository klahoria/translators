const fs = require("fs");
const { fork } = require("child_process");
const os = require("os");

const TAG_RE = /(<[^>]+>)/g;
const STYLE_RE = /<style[^>]*>[\s\S]*?<\/style>/gi;

const cpuCount = os.cpus().length;
const WORKER_COUNT = Math.min(4, cpuCount);

console.log(`🧠 Available CPU cores: ${cpuCount}`);

let workers = [];
let current = 0;
let taskId = 0;
let results = {};
let initialized = false;

// Dummy inline translate function fallback (replace with your actual sync translation logic or API call)
async function inlineTranslate(text, lang) {
  // For example, just return text for now or simulate translation
  // Replace this with your actual translate logic for single process
  return text; 
}

const sendToWorker = (text, lang) =>
  new Promise((resolve) => {
    const id = taskId++;
    results[id] = resolve;
    const worker = workers[current];
    current = (current + 1) % workers.length;
    worker.send({ id, text, lang });
  });

const setupWorkers = () => {
  if (initialized) return;
  initialized = true;

  for (let i = 0; i < WORKER_COUNT; i++) {
    const worker = fork("./childProcess/worker.js");
    worker.on("message", ({ id, translated }) => {
      results[id](translated);
      delete results[id];
    });
    workers.push(worker);
  }
};

/**
 * Main translateHandlebars function.
 * - If multiple CPUs: use workers
 * - Else: translate inline (single process)
 * Returns translated string content.
 */
const translateHandlebars = async (tpl, to = "es") => {
  const useWorkers = cpuCount > 1;

  let styles = [];
  const tplCopy = tpl.replace(STYLE_RE, (m) => {
    styles.push(m);
    return `___STYLE_${styles.length - 1}___`;
  });

  const tokens = tplCopy.split(TAG_RE);

  if (useWorkers) {
    setupWorkers();

    const promises = tokens.map((t) => {
      if (TAG_RE.test(t)) return Promise.resolve(t);
      if (/___STYLE_(\d+)___/.test(t))
        return Promise.resolve(styles[+t.match(/\d+/)[0]]);
      return sendToWorker(t, to);
    });

    const translatedTokens = await Promise.all(promises);

    // Clean up workers after translation
    workers.forEach((w) => w.kill());
    workers = [];
    initialized = false;

    return translatedTokens.join("");
  } else {
    // Single CPU: translate inline sequentially
    const translatedTokens = [];
    for (const t of tokens) {
      if (TAG_RE.test(t)) {
        translatedTokens.push(t);
      } else if (/___STYLE_(\d+)___/.test(t)) {
        translatedTokens.push(styles[+t.match(/\d+/)[0]]);
      } else {
        const translated = await inlineTranslate(t, to);
        translatedTokens.push(translated);
      }
    }
    return translatedTokens.join("");
  }
};

module.exports = { translateHandlebars };
