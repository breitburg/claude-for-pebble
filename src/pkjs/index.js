// Parse encoded conversation string "[U]msg1[A]msg2..." into messages array
function parseConversation(encoded) {
  var messages = [];
  var parts = encoded.split(/(\[U\]|\[A\])/);

  var currentRole = null;
  for (var i = 0; i < parts.length; i++) {
    if (parts[i] === '[U]') {
      currentRole = 'user';
    } else if (parts[i] === '[A]') {
      currentRole = 'assistant';
    } else if (parts[i] && parts[i].length > 0 && currentRole) {
      messages.push({
        role: currentRole,
        content: parts[i]
      });
      currentRole = null;
    }
  }

  return messages;
}

// Get response from Claude API
function getClaudeResponse(messages) {
  var apiKey = localStorage.getItem('api_key');
  var baseUrl = localStorage.getItem('base_url') || 'https://api.anthropic.com/v1/messages';
  var model = localStorage.getItem('model') || 'claude-haiku-4-5';
  var systemMessage = localStorage.getItem('system_message') || "You're running on a Pebble smartwatch. Please respond in plain text without any formatting, keeping your responses within 1-3 sentences.";
  var webSearchEnabled = localStorage.getItem('web_search_enabled') === 'true';

  if (!apiKey) {
    console.log('No API key configured');
    // Send error, then end
    Pebble.sendAppMessage({ 'RESPONSE_TEXT': 'No API key configured. Please configure in settings.' });
    Pebble.sendAppMessage({ 'RESPONSE_END': 1 });
    return;
  }

  console.log('Sending request to Claude API with ' + messages.length + ' messages');

  var xhr = new XMLHttpRequest();
  xhr.open('POST', baseUrl, true);
  xhr.setRequestHeader('Content-Type', 'application/json');
  xhr.setRequestHeader('x-api-key', apiKey);
  xhr.setRequestHeader('anthropic-version', '2023-06-01');
  xhr.timeout = 5000;

  xhr.onload = function () {
    if (xhr.status === 200) {
      try {
        var data = JSON.parse(xhr.responseText);

        // Extract all text blocks from content array
        if (data.content && data.content.length > 0) {
          var responseText = '';

          for (var i = 0; i < data.content.length; i++) {
            var block = data.content[i];
            if (block.type === 'text' && block.text) {
              responseText += block.text;
            } else if (block.type === 'server_tool_use') {
              responseText += '\n\n';
            }
          }

          responseText = responseText.trim();

          if (responseText.length > 0) {
            console.log('Sending response: ' + responseText);
            Pebble.sendAppMessage({ 'RESPONSE_TEXT': responseText });
          } else {
            console.log('No text blocks in response');
            Pebble.sendAppMessage({ 'RESPONSE_TEXT': 'No response from Claude' });
          }
        } else {
          console.log('No content in response');
          Pebble.sendAppMessage({ 'RESPONSE_TEXT': 'No response from Claude' });
        }
      } catch (e) {
        console.log('Error parsing response: ' + e);
        Pebble.sendAppMessage({ 'RESPONSE_TEXT': 'Error parsing response' });
      }
    } else {
      console.log('API error: ' + xhr.status + ' - ' + xhr.responseText);
      // Parse error response and extract message
      var errorMessage = xhr.responseText;

      try {
        var errorData = JSON.parse(xhr.responseText);
        if (errorData.error && errorData.error.message) {
          errorMessage = errorData.error.message;
        }
      } catch (e) {
        console.log('Failed to parse error response: ' + e);
      }

      // Send error
      Pebble.sendAppMessage({ 'RESPONSE_TEXT': 'Error ' + xhr.status + ': ' + errorMessage });
    }

    // Always send end signal
    Pebble.sendAppMessage({ 'RESPONSE_END': 1 });
  };

  xhr.onerror = function () {
    console.log('Network error');
    Pebble.sendAppMessage({ 'RESPONSE_TEXT': 'Network error occurred' });
    Pebble.sendAppMessage({ 'RESPONSE_END': 1 });
  };

  xhr.ontimeout = function () {
    console.log('Request timeout');
    Pebble.sendAppMessage({ 'RESPONSE_TEXT': 'Request timed out. Likely problems on Anthropic\'s side.' });
    Pebble.sendAppMessage({ 'RESPONSE_END': 1 });
  };

  var requestBody = {
    model: model,
    max_tokens: 256,
    messages: messages
  };

  // Add system message if provided
  if (systemMessage) {
    requestBody.system = systemMessage;
  }

  // Add web search tool if enabled
  if (webSearchEnabled) {
    requestBody.tools = [{
      type: 'web_search_20250305',
      name: 'web_search',
      max_uses: 5
    }];
  }

  console.log('Request body: ' + JSON.stringify(requestBody));
  xhr.send(JSON.stringify(requestBody));
}

// Send ready status to watch
function sendReadyStatus() {
  var apiKey = localStorage.getItem('api_key');
  var isReady = apiKey && apiKey.trim().length > 0 ? 1 : 0;

  console.log('Sending READY_STATUS: ' + isReady);
  Pebble.sendAppMessage({ 'READY_STATUS': isReady });
}

// Listen for app ready
Pebble.addEventListener('ready', function () {
  console.log('PebbleKit JS ready');
  sendReadyStatus();
});

// Listen for messages from watch
Pebble.addEventListener('appmessage', function (e) {
  console.log('Received message from watch');

  if (e.payload.REQUEST_CHAT) {
    var encoded = e.payload.REQUEST_CHAT;
    console.log('REQUEST_CHAT received: ' + encoded);

    var messages = parseConversation(encoded);
    console.log('Parsed ' + messages.length + ' messages');

    getClaudeResponse(messages);
  }
});

// Listen for when the configuration page is opened
Pebble.addEventListener('showConfiguration', function () {
  // Get existing settings
  var apiKey = localStorage.getItem('api_key') || '';
  var baseUrl = localStorage.getItem('base_url') || '';
  var model = localStorage.getItem('model') || '';
  var systemMessage = localStorage.getItem('system_message') || '';
  var webSearchEnabled = localStorage.getItem('web_search_enabled') || 'false';

  // Build configuration URL
  var url = 'https://breitburg.github.io/claude-for-pebble/config/';
  url += '?api_key=' + encodeURIComponent(apiKey);
  url += '&base_url=' + encodeURIComponent(baseUrl);
  url += '&model=' + encodeURIComponent(model);
  url += '&system_message=' + encodeURIComponent(systemMessage);
  url += '&web_search_enabled=' + encodeURIComponent(webSearchEnabled);

  console.log('Opening configuration page: ' + url);
  Pebble.openURL(url);
});

// Listen for when the configuration page is closed
Pebble.addEventListener('webviewclosed', function (e) {
  if (e && e.response) {
    var settings = JSON.parse(decodeURIComponent(e.response));
    console.log('Settings received: ' + JSON.stringify(settings));

    // Save or clear settings in local storage
    var keys = ['api_key', 'base_url', 'model', 'system_message', 'web_search_enabled'];
    keys.forEach(function (key) {
      if (settings[key] && settings[key].trim() !== '') {
        localStorage.setItem(key, settings[key]);
        console.log(key + ' saved');
      } else {
        localStorage.removeItem(key);
        console.log(key + ' cleared');
      }
    });

    // Send updated ready status to watch
    sendReadyStatus();
  }
});
