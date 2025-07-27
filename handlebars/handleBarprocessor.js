const fs = require("fs");
const { fork } = require("child_process");
const os = require("os");
const Handlebars = require("handlebars");
const path = require('path')
const STYLE_RE = /<style[^>]*>[\s\S]*?<\/style>/gi;

const cpuCount = os.cpus().length;
const WORKER_COUNT = Math.min(4, cpuCount);

let workers = [];
let current = 0;
let taskId = 0;
let results = {};
let initialized = false;

async function inlineTranslate(text, lang) {
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
    const worker = fork(path.join(__dirname, "../childProcess/worker.js"));
    worker.on("message", ({ id, translated }) => {
      results[id](translated);
      delete results[id];
    });
    workers.push(worker);
  }
};

const walkAst = async (node, lang, useWorkers) => {
  if (!node) return;

  if (Array.isArray(node)) {
    const results = [];
    for (const n of node) {
      results.push(await walkAst(n, lang, useWorkers));
    }
    return results.flat();
  }

  // Translate plain text
  if (node.type === "ContentStatement") {
    const text = node.value;

    // Preserve <style> blocks
    if (STYLE_RE.test(text)) return text;

    // Special handling for Denefits
    if (/denefits/i.test(text)) {
      const parts = text.split(/denefits/i);
      const translatedParts = await Promise.all(
        parts.map((p) =>
          useWorkers ? sendToWorker(p, lang) : inlineTranslate(p, lang)
        )
      );
      return translatedParts.join(" Denefits ");
    }

    return useWorkers
      ? await sendToWorker(text, lang)
      : await inlineTranslate(text, lang);
  }

  // Expressions, blocks, etc.
  if (
    node.type === "MustacheStatement" ||
    node.type === "BlockStatement" ||
    node.type === "PartialStatement"
  ) {
    return Handlebars.print(node); // Return as-is
  }

  // Handle nested nodes
  if (node.program)
    node.program.body = await walkAst(node.program.body, lang, useWorkers);
  if (node.inverse)
    node.inverse.body = await walkAst(node.inverse.body, lang, useWorkers);

  return Handlebars.print(node); // Return recompiled string
};

const translateHandlebars = async (tpl, to = "es") => {
  const useWorkers = cpuCount > 1;
  if (useWorkers) setupWorkers();

  // Parse handlebars AST
  const ast = Handlebars.parse(tpl);

  // Translate nodes
  const translatedChunks = await walkAst(ast.body, to, useWorkers);

  // Clean up workers
  if (useWorkers) {
    workers.forEach((w) => w.kill());
    workers = [];
    initialized = false;
  }

  // Recombine into final string
  return Array.isArray(translatedChunks)
    ? translatedChunks.join("")
    : translatedChunks;
};

module.exports = { translateHandlebars };
