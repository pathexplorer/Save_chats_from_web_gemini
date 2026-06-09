// ==UserScript==
// @name         Gemini Chat Exporter
// @namespace    https://gemini.google.com
// @version      2.1
// @description  Export Gemini chats to Markdown with one click or Ctrl+Shift+X hotkey. Auto-scrolls to load all messages, auto-detects chat title for filename.
// @author       You
// @match        https://gemini.google.com/app/*
// @grant        none
// ==/UserScript==

(function() {
  'use strict';

  // --- UI Helpers ---

  function showToast(message, duration = 3000) {
    let toast = document.getElementById('gemini-export-toast');
    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'gemini-export-toast';
      Object.assign(toast.style, {
        position: 'fixed',
        bottom: '80px',
        right: '20px',
        zIndex: 99999,
        padding: '10px 20px',
        backgroundColor: '#333',
        color: '#fff',
        borderRadius: '8px',
        fontSize: '13px',
        boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
        transition: 'opacity 0.3s',
        opacity: '0',
        pointerEvents: 'none'
      });
      document.body.appendChild(toast);
    }
    toast.textContent = message;
    toast.style.opacity = '1';
    clearTimeout(toast._timeout);
    toast._timeout = setTimeout(() => { toast.style.opacity = '0'; }, duration);
  }

  // --- Filename Helpers ---

  function sanitizeFilename(name) {
    return name
      .replace(/[?<>:"/\\|*]/g, '')   // Remove illegal filename characters
      .replace(/[\r\n\t]+/g, ' ')     // Replace line breaks with spaces
      .replace(/\s+/g, ' ')           // Collapse multiple whitespace
      .trim()
      .substring(0, 200)              // Limit length for filesystem safety
      || 'gemini-chat';               // Fallback if result is empty
  }

  function getChatTitle() {
    // Strategy 1: Try sidebar active item (usually most reliable)
    const sidebarSelectors = [
      '[data-chat-title]',
      '.conversation-title',
      '[aria-current="page"]',
      'nav [aria-current]',
      '.chat-list-item--selected [class*="title"]',
      '[class*="selected"] [class*="title"]',
      '.side-navigation-panel [aria-selected="true"]',
      '[role="listbox"] [aria-selected="true"]',
      '.chat-history-item.active'
    ];
    for (const sel of sidebarSelectors) {
      try {
        const el = document.querySelector(sel);
        if (el) {
          const text = el.textContent.trim();
          if (text && text.length > 2 && text.length < 300) {
            return sanitizeFilename(text);
          }
        }
      } catch (_) { /* invalid selector, skip */ }
    }

    // Strategy 2: Extract from document title
    // Gemini format: "ChatName - Gemini" or "ChatName | Gemini"
    const pageTitle = document.title;
    const cleanTitle = pageTitle
      .replace(/\s*[-–|]\s*(Gemini|Google AI|Google).*$/i, '')
      .trim();
    if (cleanTitle && cleanTitle.length > 1) {
      return sanitizeFilename(cleanTitle);
    }

    // Strategy 3: Look for a visible heading in the conversation area
    const mainHeading = document.querySelector('main h1, main h2, [role="main"] h1, [role="main"] h2');
    if (mainHeading) {
      const text = mainHeading.textContent.trim();
      if (text && text.length > 1 && text.length < 300) {
        return sanitizeFilename(text);
      }
    }

    // Final fallback
    return 'gemini-chat-' + new Date().toISOString().slice(0, 16).replace(/:/g, '-');
  }

  // --- Scroll to Load All Messages ---

  function scrollToTopAndLoad(callback, maxWaitMs = 20000) {
    // Find the likely scrollable conversation container
    const container = document.querySelector(
      'main, [role="main"], .conversation-container, [class*="conversation"], ' +
      '.chat-content, [class*="scroll"], .main-content, ' +
      '.gemini-content, .response-container'
    );

    if (!container) {
      console.warn('[GeminiExporter] Could not find scrollable container; exporting current state.');
      callback();
      return;
    }

    let lastScrollHeight = 0;
    let stableCount = 0;
    const startTime = Date.now();

    function scrollStep() {
      // Scroll to the very top of the container
      container.scrollTop = 0;

      // Also try scrolling the main window if the container didn't change
      if (document.scrollingElement) {
        document.scrollingElement.scrollTop = 0;
      }

      setTimeout(() => {
        const newScrollHeight = container.scrollHeight;

        if (newScrollHeight === lastScrollHeight) {
          stableCount++;
          if (stableCount >= 4 || Date.now() - startTime > maxWaitMs) {
            callback();
            return;
          }
        } else {
          stableCount = 0;
          lastScrollHeight = newScrollHeight;
        }
        scrollStep();
      }, 600);
    }

    scrollStep();
  }

  // --- DOM-to-Markdown Engine ---

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
          const cellTexts = cells.map(cell => domToMarkdown(cell, { depth: 0 }).trim().replace(/\|/g, '\\|'));
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

        return `\n\n${mdRows.join('\n')}\n\n`;
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

  // --- Main Export Logic ---

  function performExport() {
    const containers = Array.from(document.querySelectorAll('.conversation-container, message-loop-item'));
    if (!containers.length) {
      showToast('❌ No conversation blocks found. Are you inside a Gemini chat?', 5000);
      return;
    }

    let markdown = `# ${getChatTitle()}\nDate: ${new Date().toLocaleString()}\n\n`;

    containers.forEach((container, index) => {
      const user = container.querySelector('.query-text, user-query, user-query-content');
      const response = container.querySelector('model-response, .model-response, .response-content, .response-container-content, response-container, .presented-response-container');

      if (user) {
        let userText = normalizeText(user).replace(/^You said\s*/, '').trim();
        
        // If user question contains code-like content (indentation, brackets, etc), wrap in code block
        if (userText && /[\{\}\[\]\(\):=]/.test(userText) && userText.split('\n').length > 3) {
          if (!userText.startsWith('```')) {
            userText = userText.replace(/\n\n+/g, '\n');
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
      showToast('❌ Export produced no text. The page structure may have changed.', 5000);
      return;
    }

    const fileName = getChatTitle() + '.md';
    const blob = new Blob([markdown], { type: 'text/markdown;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(link.href);

    showToast('✅ Exported: ' + fileName, 4000);
  }

  function exportCurrentChat() {
    showToast('🔄 Loading all messages, please wait...', 20000);
    scrollToTopAndLoad(() => {
      performExport();
    });
  }

  // --- UI: Export Button ---

  function createExportButton() {
    if (document.getElementById('gemini-chat-exporter-button')) return;

    const button = document.createElement('button');
    button.id = 'gemini-chat-exporter-button';
    button.type = 'button';
    button.title = 'Export Markdown (Ctrl+Shift+X)';
    button.innerText = '📥 Export Chat';
    Object.assign(button.style, {
      position: 'fixed',
      bottom: '20px',
      right: '20px',
      zIndex: 99999,
      padding: '10px 16px',
      backgroundColor: '#1a73e8',
      color: '#fff',
      border: 'none',
      borderRadius: '24px',
      boxShadow: '0 4px 12px rgba(0,0,0,0.25)',
      cursor: 'pointer',
      fontSize: '13px',
      fontWeight: '600',
      transition: 'background-color 0.2s, transform 0.1s'
    });

    button.addEventListener('mouseenter', () => { button.style.backgroundColor = '#1557b0'; });
    button.addEventListener('mouseleave', () => { button.style.backgroundColor = '#1a73e8'; });
    button.addEventListener('mousedown', () => { button.style.transform = 'scale(0.95)'; });
    button.addEventListener('mouseup', () => { button.style.transform = ''; });

    button.addEventListener('click', exportCurrentChat);
    document.body.appendChild(button);
  }

  // --- Keyboard Shortcut ---
  // Ctrl+Shift+X = eXport.  NOT Ctrl+Shift+E — that would conflict with
  // Firefox's "Network" tab shortcut.
  document.addEventListener('keydown', function(e) {
    const isInput = ['INPUT','TEXTAREA','SELECT','[contenteditable]']
      .some(sel => e.target.matches(sel) || e.target.closest(sel));
    if (isInput) return;  // don't steal from text editing

    if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.code === 'KeyX') {
      e.preventDefault();
      exportCurrentChat();
    }
  });

  // --- Zipper Mode (auto-export on page load) ---

  var zipperEnabled = localStorage.getItem('gemini-zipper-mode') === 'true';
  var zipperFired = false;

  function updateZipperButton(btn) {
    if (zipperEnabled) {
      btn.innerText = '🤖 Zipper: ON';
      btn.style.backgroundColor = '#34a853';
      btn.title = 'Click to disable Zipper mode (auto-export)';
    } else {
      btn.innerText = '🤖 Zipper: OFF';
      btn.style.backgroundColor = '#666';
      btn.title = 'Click to enable Zipper mode (auto-export on page load)';
    }
  }

  function toggleZipperMode() {
    zipperEnabled = !zipperEnabled;
    localStorage.setItem('gemini-zipper-mode', zipperEnabled);
    var btn = document.getElementById('gemini-zipper-button');
    if (btn) updateZipperButton(btn);
    showToast(
      zipperEnabled
        ? '🤖 Zipper mode ON — each opened chat will auto-export'
        : '🤖 Zipper mode OFF',
      2500
    );
  }

  function createZipperButton() {
    if (document.getElementById('gemini-zipper-button')) return;

    var btn = document.createElement('button');
    btn.id = 'gemini-zipper-button';
    btn.type = 'button';
    Object.assign(btn.style, {
      position: 'fixed',
      bottom: '70px',
      right: '20px',
      zIndex: 99999,
      padding: '8px 14px',
      color: '#fff',
      border: 'none',
      borderRadius: '24px',
      boxShadow: '0 4px 12px rgba(0,0,0,0.25)',
      cursor: 'pointer',
      fontSize: '12px',
      fontWeight: '600',
      transition: 'background-color 0.2s, transform 0.1s'
    });

    updateZipperButton(btn);
    btn.addEventListener('click', toggleZipperMode);
    document.body.appendChild(btn);
  }

  function startZipperAutoExport() {
    if (!zipperEnabled || zipperFired) return;

    var observer = new MutationObserver(function() {
      var containers = document.querySelectorAll('.conversation-container, message-loop-item');
      if (containers.length > 0 && !zipperFired) {
        zipperFired = true;
        observer.disconnect();
        showToast('🤖 Zipper: auto-exporting...', 5000);
        setTimeout(function() {
          exportCurrentChat();
        }, 2000);
      }
    });

    observer.observe(document.body, { childList: true, subtree: true });

    var existing = document.querySelectorAll('.conversation-container, message-loop-item');
    if (existing.length > 0 && !zipperFired) {
      zipperFired = true;
      observer.disconnect();
      setTimeout(function() {
        exportCurrentChat();
      }, 2000);
    }
  }

  // --- Initialize ---

  createExportButton();
  createZipperButton();
  startZipperAutoExport();
})();
