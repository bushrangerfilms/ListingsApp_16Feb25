(function() {
  'use strict';
  
  // Widget configuration
  var CONFIG = window.AIWidgetConfig || {};
  var ORG_SLUG = CONFIG.orgSlug || '';
  var PRIMARY_COLOR = CONFIG.primaryColor || '#2563eb';
  var WELCOME_MESSAGE = CONFIG.welcomeMessage || 'Hi! How can I help you find your perfect property today?';
  var POSITION = CONFIG.position || 'bottom-right';
  var SUPABASE_URL = CONFIG.supabaseUrl || 'https://sjcfcxjpukgeaxxkffpq.supabase.co';

  if (!ORG_SLUG) {
    console.error('AI Widget: orgSlug is required. Please set window.AIWidgetConfig.orgSlug');
    return;
  }

  // Create styles
  var styles = document.createElement('style');
  styles.textContent = '\n\
    .ai-widget-container {\n\
      position: fixed;\n\
      z-index: 999999;\n\
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;\n\
    }\n\
    .ai-widget-container.bottom-right {\n\
      bottom: 20px;\n\
      right: 20px;\n\
    }\n\
    .ai-widget-container.bottom-left {\n\
      bottom: 20px;\n\
      left: 20px;\n\
    }\n\
    .ai-widget-button {\n\
      width: 60px;\n\
      height: 60px;\n\
      border-radius: 50%;\n\
      border: none;\n\
      cursor: pointer;\n\
      display: flex;\n\
      align-items: center;\n\
      justify-content: center;\n\
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);\n\
      transition: transform 0.2s, box-shadow 0.2s;\n\
    }\n\
    .ai-widget-button:hover {\n\
      transform: scale(1.05);\n\
      box-shadow: 0 6px 16px rgba(0,0,0,0.2);\n\
    }\n\
    .ai-widget-button svg {\n\
      width: 28px;\n\
      height: 28px;\n\
      fill: white;\n\
    }\n\
    .ai-widget-chat {\n\
      position: absolute;\n\
      bottom: 70px;\n\
      width: 380px;\n\
      height: 520px;\n\
      background: white;\n\
      border-radius: 16px;\n\
      box-shadow: 0 8px 32px rgba(0,0,0,0.15);\n\
      display: none;\n\
      flex-direction: column;\n\
      overflow: hidden;\n\
    }\n\
    .ai-widget-container.bottom-right .ai-widget-chat {\n\
      right: 0;\n\
    }\n\
    .ai-widget-container.bottom-left .ai-widget-chat {\n\
      left: 0;\n\
    }\n\
    .ai-widget-chat.open {\n\
      display: flex;\n\
    }\n\
    .ai-widget-header {\n\
      padding: 16px;\n\
      color: white;\n\
      display: flex;\n\
      align-items: center;\n\
      justify-content: space-between;\n\
    }\n\
    .ai-widget-header-title {\n\
      font-weight: 600;\n\
      font-size: 16px;\n\
    }\n\
    .ai-widget-header-subtitle {\n\
      font-size: 12px;\n\
      opacity: 0.9;\n\
    }\n\
    .ai-widget-close {\n\
      background: none;\n\
      border: none;\n\
      color: white;\n\
      cursor: pointer;\n\
      padding: 4px;\n\
      display: flex;\n\
      align-items: center;\n\
      justify-content: center;\n\
    }\n\
    .ai-widget-close:hover {\n\
      opacity: 0.8;\n\
    }\n\
    .ai-widget-messages {\n\
      flex: 1;\n\
      overflow-y: auto;\n\
      padding: 16px;\n\
      display: flex;\n\
      flex-direction: column;\n\
      gap: 12px;\n\
    }\n\
    .ai-widget-message {\n\
      max-width: 85%;\n\
      padding: 12px 16px;\n\
      border-radius: 16px;\n\
      font-size: 14px;\n\
      line-height: 1.5;\n\
    }\n\
    .ai-widget-message.assistant {\n\
      align-self: flex-start;\n\
      background: #f1f5f9;\n\
      color: #1e293b;\n\
      border-bottom-left-radius: 4px;\n\
    }\n\
    .ai-widget-message.user {\n\
      align-self: flex-end;\n\
      color: white;\n\
      border-bottom-right-radius: 4px;\n\
    }\n\
    .ai-widget-typing {\n\
      align-self: flex-start;\n\
      padding: 12px 16px;\n\
      background: #f1f5f9;\n\
      border-radius: 16px;\n\
      border-bottom-left-radius: 4px;\n\
      display: none;\n\
    }\n\
    .ai-widget-typing.visible {\n\
      display: flex;\n\
      align-items: center;\n\
      gap: 4px;\n\
    }\n\
    .ai-widget-typing-dot {\n\
      width: 8px;\n\
      height: 8px;\n\
      background: #94a3b8;\n\
      border-radius: 50%;\n\
      animation: aiWidgetTyping 1.4s infinite;\n\
    }\n\
    .ai-widget-typing-dot:nth-child(2) {\n\
      animation-delay: 0.2s;\n\
    }\n\
    .ai-widget-typing-dot:nth-child(3) {\n\
      animation-delay: 0.4s;\n\
    }\n\
    @keyframes aiWidgetTyping {\n\
      0%, 60%, 100% { opacity: 0.3; transform: scale(1); }\n\
      30% { opacity: 1; transform: scale(1.2); }\n\
    }\n\
    .ai-widget-input-container {\n\
      padding: 16px;\n\
      border-top: 1px solid #e2e8f0;\n\
      display: flex;\n\
      gap: 8px;\n\
    }\n\
    .ai-widget-input {\n\
      flex: 1;\n\
      padding: 12px 16px;\n\
      border: 1px solid #e2e8f0;\n\
      border-radius: 24px;\n\
      font-size: 14px;\n\
      outline: none;\n\
      transition: border-color 0.2s;\n\
    }\n\
    .ai-widget-input:focus {\n\
      border-color: ' + PRIMARY_COLOR + ';\n\
    }\n\
    .ai-widget-send {\n\
      width: 44px;\n\
      height: 44px;\n\
      border-radius: 50%;\n\
      border: none;\n\
      cursor: pointer;\n\
      display: flex;\n\
      align-items: center;\n\
      justify-content: center;\n\
      transition: opacity 0.2s;\n\
    }\n\
    .ai-widget-send:disabled {\n\
      opacity: 0.5;\n\
      cursor: not-allowed;\n\
    }\n\
    .ai-widget-send svg {\n\
      width: 20px;\n\
      height: 20px;\n\
      fill: white;\n\
    }\n\
    .ai-widget-error {\n\
      text-align: center;\n\
      padding: 12px;\n\
      color: #dc2626;\n\
      font-size: 13px;\n\
    }\n\
    @media (max-width: 420px) {\n\
      .ai-widget-chat {\n\
        width: calc(100vw - 40px);\n\
        height: calc(100vh - 120px);\n\
        max-height: 600px;\n\
      }\n\
    }\n\
  ';
  document.head.appendChild(styles);

  // Create widget HTML
  var container = document.createElement('div');
  container.className = 'ai-widget-container ' + POSITION;
  container.innerHTML = '\n\
    <div class="ai-widget-chat">\n\
      <div class="ai-widget-header" style="background: ' + PRIMARY_COLOR + '">\n\
        <div>\n\
          <div class="ai-widget-header-title">AI Property Assistant</div>\n\
          <div class="ai-widget-header-subtitle">Ask me about properties</div>\n\
        </div>\n\
        <button class="ai-widget-close" aria-label="Close chat">\n\
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">\n\
            <line x1="18" y1="6" x2="6" y2="18"></line>\n\
            <line x1="6" y1="6" x2="18" y2="18"></line>\n\
          </svg>\n\
        </button>\n\
      </div>\n\
      <div class="ai-widget-messages"></div>\n\
      <div class="ai-widget-typing">\n\
        <div class="ai-widget-typing-dot"></div>\n\
        <div class="ai-widget-typing-dot"></div>\n\
        <div class="ai-widget-typing-dot"></div>\n\
      </div>\n\
      <div class="ai-widget-input-container">\n\
        <input type="text" class="ai-widget-input" placeholder="Type your message..." />\n\
        <button class="ai-widget-send" style="background: ' + PRIMARY_COLOR + '" aria-label="Send message">\n\
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">\n\
            <line x1="22" y1="2" x2="11" y2="13"></line>\n\
            <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>\n\
          </svg>\n\
        </button>\n\
      </div>\n\
    </div>\n\
    <button class="ai-widget-button" style="background: ' + PRIMARY_COLOR + '" aria-label="Open chat">\n\
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">\n\
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>\n\
      </svg>\n\
    </button>\n\
  ';
  document.body.appendChild(container);

  // Get elements
  var chatWindow = container.querySelector('.ai-widget-chat');
  var openButton = container.querySelector('.ai-widget-button');
  var closeButton = container.querySelector('.ai-widget-close');
  var messagesContainer = container.querySelector('.ai-widget-messages');
  var typingIndicator = container.querySelector('.ai-widget-typing');
  var inputField = container.querySelector('.ai-widget-input');
  var sendButton = container.querySelector('.ai-widget-send');

  // State
  var isOpen = false;
  var isLoading = false;
  var conversationHistory = [];

  // Add message to chat
  function addMessage(content, role) {
    var messageEl = document.createElement('div');
    messageEl.className = 'ai-widget-message ' + role;
    if (role === 'user') {
      messageEl.style.background = PRIMARY_COLOR;
    }
    messageEl.textContent = content;
    messagesContainer.appendChild(messageEl);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
  }

  // Show/hide typing indicator
  function setTyping(show) {
    if (show) {
      typingIndicator.classList.add('visible');
    } else {
      typingIndicator.classList.remove('visible');
    }
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
  }

  // Send message to API
  async function sendMessage(text) {
    if (!text.trim() || isLoading) return;

    addMessage(text, 'user');
    conversationHistory.push({ role: 'user', content: text });
    inputField.value = '';
    isLoading = true;
    sendButton.disabled = true;
    setTyping(true);

    try {
      var response = await fetch(SUPABASE_URL + '/functions/v1/query-ai-assistant', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-org-slug': ORG_SLUG
        },
        body: JSON.stringify({
          query: text,
          conversationHistory: conversationHistory.slice(0, -1),
          organizationSlug: ORG_SLUG
        })
      });

      if (!response.ok) {
        throw new Error('Request failed');
      }

      var data = await response.json();
      
      if (data.error) {
        throw new Error(data.error);
      }

      var assistantMessage = data.response;
      addMessage(assistantMessage, 'assistant');
      conversationHistory.push({ role: 'assistant', content: assistantMessage });

    } catch (error) {
      console.error('AI Widget error:', error);
      addMessage('Sorry, I encountered an error. Please try again.', 'assistant');
    } finally {
      isLoading = false;
      sendButton.disabled = false;
      setTyping(false);
    }
  }

  // Toggle chat window
  function toggleChat() {
    isOpen = !isOpen;
    if (isOpen) {
      chatWindow.classList.add('open');
      if (conversationHistory.length === 0) {
        addMessage(WELCOME_MESSAGE, 'assistant');
        conversationHistory.push({ role: 'assistant', content: WELCOME_MESSAGE });
      }
      inputField.focus();
    } else {
      chatWindow.classList.remove('open');
    }
  }

  // Event listeners
  openButton.addEventListener('click', toggleChat);
  closeButton.addEventListener('click', toggleChat);
  
  sendButton.addEventListener('click', function() {
    sendMessage(inputField.value);
  });

  inputField.addEventListener('keypress', function(e) {
    if (e.key === 'Enter') {
      sendMessage(inputField.value);
    }
  });

  // Expose API for programmatic control
  window.AIWidget = {
    open: function() {
      if (!isOpen) toggleChat();
    },
    close: function() {
      if (isOpen) toggleChat();
    },
    sendMessage: sendMessage
  };

  console.log('AI Widget loaded for organization:', ORG_SLUG);
})();
