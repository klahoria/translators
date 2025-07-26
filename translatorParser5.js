import { parseHTML } from 'linkedom';
import translate from '@iamtraction/google-translate';

async function translateHandlebarsHTML(html, targetLang = 'fr') {
  const { document } = parseHTML(html);

  const textNodes = [];
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);

  while (walker.nextNode()) {
    const node = walker.currentNode;
    const text = node.nodeValue.trim();

    if (!text) continue;

    // Skip handlebars and URLs
    if (/{{.*?}}/.test(text) || /^https?:\/\//.test(text)) continue;

    textNodes.push(node);
  }

  for (const node of textNodes) {
    const res = await translate(node.nodeValue, { to: targetLang });
    node.nodeValue = res.text;
  }

  return document.toString();
}

(async () => {
  const html = `<div>Hello {{name}}, check <a href="https://example.com">this link</a>.</div>`;
  console.log(await translateHandlebarsHTML(html, 'es'));
})();
