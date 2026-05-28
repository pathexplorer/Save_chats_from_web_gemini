// Gemini Chat Exporter
// Paste this into the browser console on a Gemini chat page,
// or use it as a Tampermonkey / Violentmonkey script.
(function() {
  'use strict';

  function normalizeText(element) {
    const clone = element.cloneNode(true);
    const controls = clone.querySelectorAll('button, .message-actions, [class*="actions"], .share-menu, .copy-button');
    controls.forEach(el => el.remove());
    let text = domToMarkdown(clone).trim();
    // Reduce excessive blank lines (more than 2 consecutive) to just 2
    text = text.replace(/\n{3,}/g, '\n\n');
    return text;
  }

  function domToMarkdown(node, context = {}) {
    const { listType = null, listIndex = 1, depth = 0, preserveWhitespace = false } = context;
    if (node.nodeType === Node.TEXT_NODE) {
      // Preserve whitespace in code contexts
      if (preserveWhitespace) {
        return node.nodeValue;
      }
      return node.nodeValue.replace(/\s+/g, ' ');
    }
    if (node.nodeType !== Node.ELEMENT_NODE) {
      return '';
    }

    const tag = node.tagName.toLowerCase();
    const children = Array.from(node.childNodes)
      .map(child => domToMarkdown(child, { listType, listIndex, depth, preserveWhitespace }))
      .join('');

    switch (tag) {
      case 'h1':
      case 'h2':
      case 'h3':
      case 'h4':
      case 'h5':
      case 'h6': {
        const level = parseInt(tag[1], 10);
        return `\n\n${'#'.repeat(level)} ${children.trim()}\n\n`;
      }
      case 'p':
        return `\n\n${children.trim()}\n\n`;
      case 'br':
        // Preserve single line breaks for better code formatting
        return '\n';
      case 'blockquote':
        return `\n\n> ${children.trim().replace(/\n/g, '\\n> ')}\n\n`;
      case 'table': {
        const rows = Array.from(node.querySelectorAll('tr'));
        if (!rows.length) return '';

        const mdRows = rows.map(row => {
          const cells = Array.from(row.children).filter(child => {
            const tagName = child.tagName.toLowerCase();
            return tagName === 'td' || tagName === 'th';
          });
          const cellTexts = cells.map(cell => domToMarkdown(cell, { depth: 0 }).trim().replace(/\|/g, '\|'));
          return `| ${cellTexts.join(' | ')} |`;
        });

        const firstRow = rows[0];
        const separatorRow = `| ${Array.from(firstRow.children).filter(child => {
          const tagName = child.tagName.toLowerCase();
          return tagName === 'td' || tagName === 'th';
        }).map(() => '---').join(' | ')} |`;
        if (mdRows.length > 1) {
          mdRows.splice(1, 0, separatorRow);
        }

        return `

${mdRows.join('\n')}

`;
      }
      case 'th':
      case 'td':
        return children.trim();
      case 'pre': {
        const codeText = node.textContent.replace(/ /g, ' ').trim();
        return `\n\n\`\`\`\n${codeText}\n\`\`\`\n\n`;
      }
      case 'code': {
        if (node.parentElement && node.parentElement.tagName.toLowerCase() === 'pre') {
          // Preserve whitespace inside code blocks
          const codeContent = Array.from(node.childNodes)
            .map(child => domToMarkdown(child, { ...context, preserveWhitespace: true }))
            .join('');
          return codeContent;
        }
        return `\`${children.trim()}\``;
      }
      case 'a': {
        const href = node.getAttribute('href') || node.textContent.trim();
        return `[${children.trim()}](${href})`;
      }
      case 'ul':
        return `\n${Array.from(node.children)
          .map(child => domToMarkdown(child, { listType: 'ul', depth: depth + 1 }))
          .join('')}\n`;
      case 'ol': {
        let index = 0;
        return `\n${Array.from(node.children)
          .map(child => {
            index += 1;
            return domToMarkdown(child, { listType: 'ol', listIndex: index, depth: depth + 1 });
          })
          .join('')}\n`;
      }
      case 'li': {
        const indent = '  '.repeat(Math.max(0, depth - 1));
        const prefix = listType === 'ol' ? `${listIndex}. ` : '- ';
        const line = children.trim().replace(/\n/g, `\n${indent}  `);
        return `${indent}${prefix}${line}\n`;
      }
      case 'strong':
      case 'b':
        return `**${children.trim()}**`;
      case 'em':
      case 'i':
        return `*${children.trim()}*`;
      case 'u':
        return `_${children.trim()}_`;
      case 'span':
      case 'div':
      case 'section':
      case 'article':
      case 'header':
      case 'footer':
        return children;
      default:
        return children;
    }
  }

  function exportCurrentChat() {
    const containers = Array.from(document.querySelectorAll('.conversation-container, message-loop-item'));
    if (!containers.length) {
      alert('No conversation blocks found. Make sure you are inside a Gemini chat.');
      return;
    }

    let markdown = `# Gemini chat export\nDate: ${new Date().toLocaleString()}\n\n`;

    containers.forEach((container, index) => {
      const user = container.querySelector('.query-text, user-query, user-query-content');
      const response = container.querySelector('model-response, .model-response, .response-content, .response-container-content, response-container, .presented-response-container');

      if (user) {
        let userText = normalizeText(user).replace(/^You said\s*/, '').trim();
        
        // If user question contains code-like content (indentation, brackets, etc), wrap in code block
        if (userText && /[\{\}\[\]\(\):=]/.test(userText) && userText.split('\n').length > 3) {
          // Check if not already in a code block
          if (!userText.startsWith('```')) {
            userText = `\`\`\`\n${userText}\n\`\`\``;
          }
        }
        
        if (userText) {
          markdown += `## Question ${index + 1}\n${userText}\n\n`;
        }
      }

      if (response) {
        const responseText = normalizeText(response).replace(/^Gemini said\s*/, '');
        if (responseText) {
          markdown += `## Answer ${index + 1}\n${responseText}\n\n---\n\n`;
        }
      }
    });

    if (!markdown.trim()) {
      alert('Export produced no text. The page structure may have changed.');
      return;
    }

    const fileName = `gemini-chat-${Date.now()}.md`;
    const blob = new Blob([markdown], { type: 'text/markdown;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  function createExportButton() {
    if (document.getElementById('gemini-chat-exporter-button')) return;

    const button = document.createElement('button');
    button.id = 'gemini-chat-exporter-button';
    button.type = 'button';
    button.innerText = '📥 Export Gemini Chat';
    Object.assign(button.style, {
      position: 'fixed',
      bottom: '20px',
      right: '20px',
      zIndex: 99999,
      padding: '12px 18px',
      backgroundColor: '#1a73e8',
      color: '#fff',
      border: 'none',
      borderRadius: '24px',
      boxShadow: '0 4px 12px rgba(0,0,0,0.25)',
      cursor: 'pointer',
      fontSize: '13px',
      fontWeight: '600'
    });

    button.addEventListener('click', exportCurrentChat);
    document.body.appendChild(button);
  }

  createExportButton();
})();
