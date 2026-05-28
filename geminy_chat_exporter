// Gemini Chat Exporter
// Paste this into the browser console on a Gemini chat page,
// or use it as a Tampermonkey / Violentmonkey script.
(function() {
  'use strict';

  function normalizeText(element) {
    const clone = element.cloneNode(true);
    const codeBlocks = Array.from(clone.querySelectorAll('pre'));
    codeBlocks.forEach(block => {
      const codeText = block.textContent.trim();
      const lang = block.getAttribute('data-language') || '';
      const fenced = `\n\`\`\`${lang}\n${codeText}\n\`\`\`\n`;
      const textNode = document.createTextNode(fenced);
      block.parentNode.replaceChild(textNode, block);
    });

    const controls = clone.querySelectorAll('button, .message-actions, [class*="actions"], .share-menu, .copy-button');
    controls.forEach(el => el.remove());

    return clone.textContent.trim();
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
        const userText = normalizeText(user);
        if (userText) {
          markdown += `## Question ${index + 1}\n${userText.replace(/^You said\s*/, '')}\n\n`;
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
