const {
  sanitizeFilename,
  getChatTitle,
  normalizeText,
  domToMarkdown,
} = require('../geminy_chat_exporter');

describe('geminy_chat_exporter functions', () => {
  test('sanitizeFilename removes illegal characters', () => {
    const name = 'test?file:*path';
    const result = sanitizeFilename(name);
    expect(result).toBe('testfilepath');
  });

  test('sanitizeFilename collapses whitespace', () => {
    const name = '  hello   world\n\n';
    const result = sanitizeFilename(name);
    expect(result).toBe('hello world');
  });

  test('sanitizeFilename limit length', () => {
    const long = 'a'.repeat(300);
    const result = sanitizeFilename(long);
    expect(result.length).toBeLessThanOrEqual(200);
  });

  test('domToMarkdown returns correct formatting for simple node', () => {
    const div = document.createElement('div');
    div.innerHTML = '<p>Hello <b>world</b></p>';
    const result = domToMarkdown(div);
    expect(result).toBe('Hello **world**');
  });

  test('domToMarkdown handles heading', () => {
    const div = document.createElement('div');
    div.innerHTML = '<h1>Title</h1>';
    const result = domToMarkdown(div);
    expect(result).toMatch(/# Title/);
  });

  test('getChatTitle falls back to document title', () => {
    document.title = 'My Chat - Gemini';
    const title = getChatTitle();
    expect(title).toBe('My Chat');
  });
});
