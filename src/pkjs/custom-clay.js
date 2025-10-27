module.exports = function(minified) {
  var clayConfig = this;
  var _ = minified._;
  var $ = minified.$;
  
  clayConfig.on(clayConfig.EVENTS.AFTER_BUILD, function() {
    // Handle reset button click
    var resetButton = clayConfig.getItemById('reset-button');
    if (resetButton) {
      resetButton.on('click', function() {
        // Confirm reset action
        if (confirm('Are you sure you want to reset all settings to defaults?')) {
          // Reset all fields to their defaults
          clayConfig.getItemByMessageKey('api_key').set('');
          clayConfig.getItemByMessageKey('base_url').set('https://api.anthropic.com/v1/messages');
          clayConfig.getItemByMessageKey('model').set('claude-haiku-4-5');
          clayConfig.getItemByMessageKey('system_message').set("You're running on a Pebble smartwatch. Please respond in plain text without any formatting, keeping your responses within 1-3 sentences.");
          clayConfig.getItemByMessageKey('web_search_enabled').set(false);
        }
      });
    }
  });
};
