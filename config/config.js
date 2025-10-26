// Get query parameters
function getQueryParam(param) {
  var query = location.search.substring(1);
  var vars = query.split('&');
  for (var i = 0; i < vars.length; i++) {
    var pair = vars[i].split('=');
    if (decodeURIComponent(pair[0]) == param) {
      return decodeURIComponent(pair[1]);
    }
  }
  return null;
}

// Default values
var defaults = {
  base_url: 'https://api.anthropic.com/v1/messages',
  model: 'claude-haiku-4-5',
  system_message: "You're running on a Pebble smartwatch. Please respond in plain text without any formatting, keeping your responses within 1-3 sentences."
};

// Load existing settings
var apiKey = getQueryParam('api_key');
var baseUrl = getQueryParam('base_url');
var model = getQueryParam('model');
var systemMessage = getQueryParam('system_message');

// Get return_to for emulator support (falls back to pebblejs://close# for real hardware)
var returnTo = getQueryParam('return_to') || 'pebblejs://close#';

// Initialize form when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
  var apiKeyInput = document.getElementById('api-key');
  var advancedRows = document.querySelectorAll('.advanced-field');

  // Set form values
  if (apiKey) {
    apiKeyInput.value = apiKey;
  }
  document.getElementById('base-url').value = baseUrl || defaults.base_url;
  document.getElementById('model').value = model || defaults.model;
  document.getElementById('system-message').value = systemMessage || defaults.system_message;

  // Function to toggle advanced fields visibility
  function toggleAdvancedFields() {
    var hasApiKey = apiKeyInput.value.trim() !== '';
    advancedRows.forEach(function(row) {
      row.style.display = hasApiKey ? '' : 'none';
    });
  }

  // Initial visibility check
  toggleAdvancedFields();

  // Listen for API key changes
  apiKeyInput.addEventListener('input', toggleAdvancedFields);

  // Save button handler
  document.getElementById('save-button').addEventListener('click', function() {
    var settings = {
      api_key: apiKeyInput.value.trim(),
      base_url: document.getElementById('base-url').value.trim(),
      model: document.getElementById('model').value.trim(),
      system_message: document.getElementById('system-message').value.trim()
    };

    // Send settings back to Pebble (works for both emulator and real hardware)
    var url = returnTo + encodeURIComponent(JSON.stringify(settings));
    document.location = url;
  });

  // Reset button handler
  document.getElementById('reset-button').addEventListener('click', function() {
    // Clear all form fields
    apiKeyInput.value = '';
    document.getElementById('base-url').value = defaults.base_url;
    document.getElementById('model').value = defaults.model;
    document.getElementById('system-message').value = defaults.system_message;

    // Toggle advanced fields visibility
    toggleAdvancedFields();

    // Send empty settings back to Pebble to clear localStorage
    var settings = {
      api_key: '',
      base_url: defaults.base_url,
      model: defaults.model,
      system_message: defaults.system_message
    };

    var url = returnTo + encodeURIComponent(JSON.stringify(settings));
    document.location = url;
  });
});
