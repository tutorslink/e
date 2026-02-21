/**
 * TutorsLink Chat System
 * Simulates a real-time support chat with auto-responses from staff.
 */
(function () {
  'use strict';

  var STAFF_RESPONSES = [
    "Hi there! Welcome to TutorsLink. How can I help you today?",
    "Thanks for reaching out! Our team is happy to assist.",
    "Great question! Could you tell me a little more so I can help you better?",
    "Of course! We'd be glad to walk you through that.",
    "That's completely understandable. Let me look into this for you.",
    "We appreciate your patience. I'll get back to you with more details shortly.",
    "Absolutely! TutorsLink offers free demo sessions with every tutor — would you like help finding one?",
    "You can reach our full support team at support@tutorslink.com as well.",
    "Is there anything else I can help you with today?",
    "Thanks for contacting TutorsLink! We'll make sure your query is handled promptly."
  ];

  var responseIndex = 0;
  var typingTimeout = null;
  /* Unique session ID per page load for Firestore grouping */
  var chatSessionId = 'chat-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8);

  /**
   * Get the next staff response (cycles through the list).
   */
  function getNextResponse() {
    var msg = STAFF_RESPONSES[responseIndex % STAFF_RESPONSES.length];
    responseIndex++;
    return msg;
  }

  /**
   * Format the current time as HH:MM.
   */
  function formatTime(date) {
    var h = String(date.getHours()).padStart(2, '0');
    var m = String(date.getMinutes()).padStart(2, '0');
    return h + ':' + m;
  }

  /**
   * Sanitise a plain-text string for safe insertion as HTML.
   */
  function escHtml(str) {
    return String(str)
      .replace(/&/g,  '&amp;')
      .replace(/</g,  '&lt;')
      .replace(/>/g,  '&gt;')
      .replace(/"/g,  '&quot;')
      .replace(/'/g,  '&#39;');
  }

  /**
   * Append a message bubble to the chat messages container.
   */
  function appendMessage(container, type, text, time) {
    var el = document.createElement('div');
    el.className = 'tl-chat-msg tl-chat-msg--' + type;

    var timeStr = formatTime(time || new Date());

    if (type === 'system') {
      el.innerHTML = '<div class="tl-chat-msg__bubble">' + escHtml(text) + '</div>';
    } else if (type === 'staff') {
      el.innerHTML =
        '<div class="tl-chat-msg__avatar">🎓</div>' +
        '<div>' +
          '<div class="tl-chat-msg__bubble">' + escHtml(text) + '</div>' +
          '<div class="tl-chat-msg__time">' + timeStr + '</div>' +
        '</div>';
    } else {
      /* user */
      el.innerHTML =
        '<div class="tl-chat-msg__avatar" style="background:#FFD700;color:#000;font-size:0.7rem;">You</div>' +
        '<div>' +
          '<div class="tl-chat-msg__bubble">' + escHtml(text) + '</div>' +
          '<div class="tl-chat-msg__time">' + timeStr + '</div>' +
        '</div>';
    }

    container.appendChild(el);
    container.scrollTop = container.scrollHeight;
    return el;
  }

  /**
   * Show/hide the typing indicator.
   */
  function setTyping(indicator, visible) {
    if (!indicator) return;
    indicator.style.visibility = visible ? 'visible' : 'hidden';
  }

  /**
   * Simulate a staff reply after a short delay.
   */
  function simulateReply(messagesEl, typingEl) {
    var delay = 1200 + Math.random() * 1000;

    setTyping(typingEl, true);

    typingTimeout = setTimeout(function () {
      setTyping(typingEl, false);
      appendMessage(messagesEl, 'staff', getNextResponse());
    }, delay);
  }

  /**
   * Send a user message.
   */
  function sendMessage(input, messagesEl, typingEl) {
    var text = input.value.trim();
    if (!text) return;

    input.value = '';
    input.style.height = '';

    appendMessage(messagesEl, 'user', text);

    /* Notify Cloud Function (fire-and-forget, stub if not configured) */
    if (window.TLFunctions && window.TLFunctions.createSupportChatMessage) {
      window.TLFunctions.createSupportChatMessage(text, chatSessionId);
    }

    if (typingTimeout) clearTimeout(typingTimeout);
    simulateReply(messagesEl, typingEl);
  }

  /**
   * Initialise the chat widget.
   */
  function initChat() {
    var form       = document.getElementById('tl-chat-form');
    var input      = document.getElementById('tl-chat-input');
    var sendBtn    = document.getElementById('tl-chat-send');
    var messagesEl = document.getElementById('tl-chat-messages');
    var typingEl   = document.getElementById('tl-chat-typing');

    if (!form || !input || !messagesEl) return;

    /* Initial greeting */
    setTimeout(function () {
      appendMessage(messagesEl, 'staff', 'Hello! 👋 Welcome to TutorsLink support. How can we help you today?');
    }, 600);

    /* Auto-resize textarea */
    input.addEventListener('input', function () {
      input.style.height = 'auto';
      input.style.height = Math.min(input.scrollHeight, 120) + 'px';
      if (sendBtn) sendBtn.disabled = input.value.trim() === '';
    });

    /* Disable send button initially */
    if (sendBtn) sendBtn.disabled = true;

    /* Form submit (Enter key or button) */
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      sendMessage(input, messagesEl, typingEl);
      if (sendBtn) sendBtn.disabled = true;
    });

    /* Allow Shift+Enter for newlines; plain Enter to send */
    input.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        if (input.value.trim()) {
          sendMessage(input, messagesEl, typingEl);
          if (sendBtn) sendBtn.disabled = true;
        }
      }
    });

    if (sendBtn) {
      sendBtn.addEventListener('click', function () {
        if (input.value.trim()) {
          sendMessage(input, messagesEl, typingEl);
          sendBtn.disabled = true;
        }
      });
    }
  }

  /* ---- Init on DOM ready ---- */
  document.addEventListener('DOMContentLoaded', initChat);

  /* Expose for external use if needed */
  window.TLChat = { init: initChat };
}());
