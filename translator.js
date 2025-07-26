const translate = require('@iamtraction/google-translate');

/**
 * Safely translate a Handlebars string while preserving:
 * - Handlebars expressions: {{...}} or {{#...}}{{/...}}
 * - Full links like https://example.com
 */
async function translateHandlebars(input, targetLang = 'hi') {
  // Match and preserve handlebars expressions
  const handlebarsRegex = /{{[^}]+}}|{{#[^}]+}}[\s\S]*?{{\/[^}]+}}/g;
  const handlebarsMatches = [];
  let preserved = input.replace(handlebarsRegex, match => {
    const token = `__HANDLEBARS_${handlebarsMatches.length}__`;
    handlebarsMatches.push(match);
    return token;
  });

  // Match and preserve full links (http/https)
  const linkRegex = /\bhttps?:\/\/[^\s"'<>]+/g;
  const linkMatches = [];
  preserved = preserved.replace(linkRegex, match => {
    const token = `__LINK_${linkMatches.length}__`;
    linkMatches.push(match);
    return token;
  });

  // Translate the remaining text
  let translated;
  try {
    const result = await translate(preserved, { to: targetLang });
    translated = result.text;
  } catch (err) {
    console.error('Translation failed:', err.message);
    return input;
  }

  // Restore links
  translated = translated.replace(/__LINK_(\d+)__/g, (_, i) => linkMatches[i]);

  // Restore handlebars
  translated = translated.replace(/__HANDLEBARS_(\d+)__/g, (_, i) => handlebarsMatches[i]);

  return translated;
}

// Example usage
(async () => {
  const template = `<p>Hello {{name}}, please visit our <a href="https://example.com">website</a> or check {{#if user}}your dashboard{{/if}}.</p>`;
  const result = await translateHandlebars(template, 'fr');
  console.log('\n🔁 Translated Template:\n', result);
})();
