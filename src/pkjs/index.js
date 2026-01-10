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

function getModelResponse(messages) {
  if(localStorage.getItem('base_url').includes('openrouter')) {
      return getOpenRouterResponse(messages);
  } else {
      return getClaudeResponse(messages);
  }
}

function getOpenRouterResponse(messages) {
  var apiKey = localStorage.getItem('api_key');
  var baseUrl = localStorage.getItem('base_url');
  var model = localStorage.getItem('model') ||
      'anthropic/claude-haiku-4.5';
  var systemMessage = localStorage.getItem('system_message') || "You're running on a Pebble smartwatch. Please respond in plain text without any formatting, keeping your responses within 1-3 sentences.";
  var webSearchEnabled = localStorage.getItem('web_search_enabled') === 'true';
  var mcpServersJson = localStorage.getItem('mcp_servers');

  if (!apiKey) {
    console.log('No API key configured');
    // Send error, then end
    Pebble.sendAppMessage({ 'RESPONSE_TEXT': 'No API key configured. Please configure in settings.' });
    Pebble.sendAppMessage({ 'RESPONSE_END': 1 });
    return;
  }

  console.log('Sending request to OpenRouter API with ' + messages.length + ' messages');
  console.log('API key ' + apiKey);

  var xhr = new XMLHttpRequest();
  xhr.open('POST', baseUrl, true);
  xhr.setRequestHeader('Content-Type', 'application/json');
  xhr.setRequestHeader('Authorization', 'Bearer ' + apiKey);


  xhr.timeout = 15000;

  xhr.onload = function () {
    if (xhr.status === 200) {
      try {
        var data = JSON.parse(xhr.responseText);

        // Extract all text blocks from content array
        if (data.choices[0] && data.choices.length > 0) {
          var responseText = '';
          var mcpToolsUsed = 0;

          for (var i = 0; i < data.choices.length; i++) {
            var choice = data.choices[i];
            if (choice.message && choice.message.content) {
              responseText += choice.message.content;
            }
            // TODO; Fix MCP compat
            // if(choice.message.tool_calls) {
            //     for(var i = 0; choice.message.tool_calls.length; i++) {
            //         var tool = choice.message.tool_calls[i];

            //         mcpToolsUsed++;
            //         console.log('MCP tool called: ' + tool.type + ' on server ' + choice.server_name);
            //     } 
            // }
            // else if (choice.msessage.tool_calls === 'mcp_tool_use') {
            //   // MCP tool is being called - log for debugging
            //   mcpToolsUsed++;
            //   console.log('MCP tool called: ' + choice.name + ' on server ' + choice.server_name);
            // } else if (choice.type === 'mcp_tool_result') {
            //   // MCP tool result received - log for debugging
            //   console.log('MCP tool result received for tool_use_id: ' + choice.tool_use_id);
            //   responseText += '\n\n';
            // } else if (choice.type === 'server_tool_use') {
            //   responseText += '\n\n';
            // }
          }

          console.log(JSON.stringify(data.content, null, 2));

          if (mcpToolsUsed > 0) {
            console.log('Response used ' + mcpToolsUsed + ' MCP tool(s)');
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
      requestBody.messages.unshift({
        role: 'system',
        content: systemMessage
      });
  }

  // Add web search tool if enabled
  if (webSearchEnabled) {
      requestBody.model = requestBody.model + ':online';
  }

  // Add MCP servers if configured; these are called tools in OpenRouter lingo;
  // https://openrouter.ai/docs/api/api-reference/chat/send-chat-completion-request#request.body.tools
  if (mcpServersJson && mcpServersJson.trim().length > 0) {
    try {
      var mcpServers = JSON.parse(mcpServersJson);
      if (Array.isArray(mcpServers) && mcpServers.length > 0) {
        requestBody.tools = mcpServers;
        console.log('Added ' + mcpServers.length + ' MCP server(s) to request');
      }
    } catch (e) {
      console.log('Error parsing MCP servers JSON: ' + e);
    }
  }

  console.log('Request body: ' + JSON.stringify(requestBody));
  xhr.send(JSON.stringify(requestBody));
}

// Get response from Claude API
function getClaudeResponse(messages) {
  var apiKey = localStorage.getItem('api_key');
  var baseUrl = localStorage.getItem('base_url') || 'https://api.anthropic.com/v1/messages';
  var model = localStorage.getItem('model') || 'claude-haiku-4-5';
  var systemMessage = localStorage.getItem('system_message') || "You're running on a Pebble smartwatch. Please respond in plain text without any formatting, keeping your responses within 1-3 sentences.";
  var webSearchEnabled = localStorage.getItem('web_search_enabled') === 'true';
  var mcpServersJson = localStorage.getItem('mcp_servers');

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

  // Add MCP beta header if MCP servers are configured
  if (mcpServersJson && mcpServersJson.trim().length > 0) {
    xhr.setRequestHeader('anthropic-beta', 'mcp-client-2025-04-04');
    console.log('MCP beta header added');
  }

  xhr.timeout = 15000;

  xhr.onload = function () {
    if (xhr.status === 200) {
      try {
        var data = JSON.parse(xhr.responseText);

        // Extract all text blocks from content array
        if (data.content && data.content.length > 0) {
          var responseText = '';
          var mcpToolsUsed = 0;

          for (var i = 0; i < data.content.length; i++) {
            var block = data.content[i];
            if (block.type === 'text' && block.text) {
              responseText += block.text;
            } else if (block.type === 'mcp_tool_use') {
              // MCP tool is being called - log for debugging
              mcpToolsUsed++;
              console.log('MCP tool called: ' + block.name + ' on server ' + block.server_name);
            } else if (block.type === 'mcp_tool_result') {
              // MCP tool result received - log for debugging
              console.log('MCP tool result received for tool_use_id: ' + block.tool_use_id);
              responseText += '\n\n';
            } else if (block.type === 'server_tool_use') {
              responseText += '\n\n';
            }
          }

          console.log(JSON.stringify(data.content, null, 2));

          if (mcpToolsUsed > 0) {
            console.log('Response used ' + mcpToolsUsed + ' MCP tool(s)');
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

  // Add MCP servers if configured
  if (mcpServersJson && mcpServersJson.trim().length > 0) {
    try {
      var mcpServers = JSON.parse(mcpServersJson);
      if (Array.isArray(mcpServers) && mcpServers.length > 0) {
        requestBody.mcp_servers = mcpServers;
        console.log('Added ' + mcpServers.length + ' MCP server(s) to request');
      }
    } catch (e) {
      console.log('Error parsing MCP servers JSON: ' + e);
    }
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

    getModelResponse(messages);
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
  var mcpServers = localStorage.getItem('mcp_servers') || '';

  // Build configuration URL
  var url = 'https://breitburg.github.io/claude-for-pebble/config/';
  url += '?api_key=' + encodeURIComponent(apiKey);
  url += '&base_url=' + encodeURIComponent(baseUrl);
  url += '&model=' + encodeURIComponent(model);
  url += '&system_message=' + encodeURIComponent(systemMessage);
  url += '&web_search_enabled=' + encodeURIComponent(webSearchEnabled);
  url += '&mcp_servers=' + encodeURIComponent(mcpServers);

  console.log('Opening configuration page: ' + url);
  Pebble.openURL(url);
});

// Listen for when the configuration page is closed
Pebble.addEventListener('webviewclosed', function (e) {
  if (e && e.response) {
    var settings = JSON.parse(decodeURIComponent(e.response));
    console.log('Settings received: ' + JSON.stringify(settings));

    // Save or clear settings in local storage
    var keys = ['api_key', 'base_url', 'model', 'system_message', 'web_search_enabled', 'mcp_servers'];
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
