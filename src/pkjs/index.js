// Initialize Clay for configuration
var Clay = require('pebble-clay');
var clayConfig = require('./config.json');
var customClay = require('./custom-clay');
var clay = new Clay(clayConfig, customClay);

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

// Stream response from Claude API
function streamClaudeResponse(messages) {
  var apiKey = localStorage.getItem('api_key');
  var baseUrl = localStorage.getItem('base_url') || 'https://api.anthropic.com/v1/messages';
  var model = localStorage.getItem('model') || 'claude-haiku-4-5';
  var systemMessage = localStorage.getItem('system_message') || "You're running on a Pebble smartwatch. Please respond in plain text without any formatting, keeping your responses within 1-3 sentences.";
  var webSearchEnabled = localStorage.getItem('web_search_enabled') === 'true';

  if (!apiKey) {
    console.log('No API key configured');
    Pebble.sendAppMessage({ 'RESPONSE_END': 1 });
    return;
  }

  console.log('Sending request to Claude API with ' + messages.length + ' messages');

  var xhr = new XMLHttpRequest();
  xhr.open('POST', baseUrl, true);
  xhr.setRequestHeader('Content-Type', 'application/json');
  xhr.setRequestHeader('x-api-key', apiKey);
  xhr.setRequestHeader('anthropic-version', '2023-06-01');

  var responseText = '';

  xhr.onreadystatechange = function () {
    if (xhr.readyState === 3 || xhr.readyState === 4) {
      // Process new data
      var newData = xhr.responseText.substring(responseText.length);
      responseText = xhr.responseText;

      // Parse SSE format
      var lines = newData.split('\n');
      for (var i = 0; i < lines.length; i++) {
        var line = lines[i].trim();
        if (line.startsWith('data:')) {
          var jsonStr = line.substring(5).trim();
          if (jsonStr === '[DONE]') continue;

          try {
            var data = JSON.parse(jsonStr);

            // Handle content_block_delta events
            if (data.type === 'content_block_delta' && data.delta && data.delta.text) {
              console.log('Sending chunk: ' + data.delta.text);
              Pebble.sendAppMessage({ 'RESPONSE_CHUNK': data.delta.text });
            }

            // Handle message_stop event
            if (data.type === 'message_stop') {
              console.log('Stream complete');
              Pebble.sendAppMessage({ 'RESPONSE_END': 1 });
            }
          } catch (e) {
            console.log('Error parsing JSON: ' + e);
          }
        }
      }

      // If request complete, send RESPONSE_END
      if (xhr.readyState === 4) {
        if (xhr.status !== 200) {
          console.log('API error: ' + xhr.status + ' - ' + xhr.responseText);
        }
        Pebble.sendAppMessage({ 'RESPONSE_END': 1 });
      }
    }
  };

  xhr.onerror = function () {
    console.log('Network error');
    Pebble.sendAppMessage({ 'RESPONSE_END': 1 });
  };

  var requestBody = {
    model: model,
    max_tokens: 256,
    messages: messages,
    stream: true
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

    streamClaudeResponse(messages);
  }
});

// Clay automatically handles 'showConfiguration' and 'webviewclosed' events
// We need to also save settings to individual localStorage keys for backward compatibility
Pebble.addEventListener('webviewclosed', function(e) {
  if (e && e.response) {
    // Get the settings that Clay has already parsed and saved
    var claySettings = clay.getSettings(e.response, true);
    
    // Also save to individual localStorage keys for backward compatibility
    var keys = ['api_key', 'base_url', 'model', 'system_message', 'web_search_enabled'];
    keys.forEach(function(key) {
      if (claySettings[key] !== undefined && claySettings[key] !== null) {
        var value = claySettings[key];
        // Convert objects with 'value' property (from Clay) to plain values
        if (typeof value === 'object' && value.value !== undefined) {
          value = value.value;
        }
        // Convert boolean to string for web_search_enabled
        if (typeof value === 'boolean') {
          value = value.toString();
        }
        if (value !== '' && value !== null) {
          localStorage.setItem(key, value);
          console.log(key + ' saved: ' + value);
        }
      }
    });
    
    // Send updated ready status to watch
    sendReadyStatus();
  }
});
