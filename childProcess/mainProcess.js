const fs = require("fs");
const { fork } = require("child_process");
const os = require("os");

const TAG_RE = /(<[^>]+>)/g;
const STYLE_RE = /<style[^>]*>[\s\S]*?<\/style>/gi;
const WORKER_COUNT = Math.min(4, os.cpus().length);

let workers = [];
let current = 0;
let taskId = 0;
let results = {};
let initialized = false;

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

const translateHandlebars = async (
  tpl,
  to = "es",
  out = "translated.handlebars"
) => {
  setupWorkers();

  const styles = [];
  const tplCopy = tpl.replace(STYLE_RE, (m) => {
    styles.push(m);
    return `___STYLE_${styles.length - 1}___`;
  });

  const tokens = tplCopy.split(TAG_RE);
  const promises = tokens.map((t) =>
    TAG_RE.test(t)
      ? Promise.resolve(t)
      : /___STYLE_(\d+)___/.test(t)
      ? Promise.resolve(styles[+t.match(/\d+/)[0]])
      : sendToWorker(t, to)
  );

  const translated = await Promise.all(promises);
  fs.writeFileSync(out, translated.join(""), "utf-8");
  console.log(`✅ Output written to ${out}`);

  workers.forEach((w) => w.kill());
  workers = [];
  initialized = false;
};

module.exports = { translateHandlebars };
