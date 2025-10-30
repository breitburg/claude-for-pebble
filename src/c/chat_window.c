#include "chat_window.h"
#include "message_bubble.h"
#include "chat_footer.h"
#include "claude_spark.h"

#define MAX_MESSAGES 10
#define SCROLL_OFFSET 60
#define MESSAGE_BUFFER_SIZE 4096

// Message data structure
typedef struct {
  char text[512];
  bool is_user;
} Message;

// Global state for the chat window
static Window *s_window;
static StatusBarLayer *s_status_bar;
static ScrollLayer *s_scroll_layer;
static Layer *s_content_layer;
static Layer *s_action_button_layer;
static ChatFooter *s_footer;
static DictationSession *s_dictation_session;

// Message storage (designed for dynamic updates)
static Message s_messages[MAX_MESSAGES];
static int s_message_count = 0;

// Current UI state (bubble instances)
static MessageBubble *s_bubbles[MAX_MESSAGES];
static int s_bubble_count = 0;

static int s_content_width = 0;

// Chat state
static bool s_waiting_for_response = false;

// Forward declarations
static void rebuild_scroll_content(void);
static void dictation_session_callback(DictationSession *session, DictationSessionStatus status, char *transcription, void *context);
static void up_click_handler(ClickRecognizerRef recognizer, void *context);
static void down_click_handler(ClickRecognizerRef recognizer, void *context);
static void click_config_provider(void *context);
static void send_chat_request(void);
static void shift_messages(void);
static void add_assistant_message(const char *text);
static void scroll_to_bottom(void);
static void action_button_update_proc(Layer *layer, GContext *ctx);

static void window_load(Window *window) {
  Layer *window_layer = window_get_root_layer(window);
  GRect bounds = layer_get_bounds(window_layer);

  // Set click config provider on window
  window_set_click_config_provider(window, click_config_provider);

  // Create status bar
  s_status_bar = status_bar_layer_create();
  status_bar_layer_set_colors(s_status_bar, GColorWhite, GColorBlack);
  layer_add_child(window_layer, status_bar_layer_get_layer(s_status_bar));

  // Calculate content area
  s_content_width = bounds.size.w;
  int status_bar_height = STATUS_BAR_LAYER_HEIGHT;

  // Create scroll layer (below status bar)
  s_scroll_layer = scroll_layer_create(GRect(0, status_bar_height, s_content_width, bounds.size.h - status_bar_height));
  scroll_layer_set_shadow_hidden(s_scroll_layer, true);
  layer_add_child(window_layer, scroll_layer_get_layer(s_scroll_layer));

  // Create content layer (will be resized in rebuild)
  s_content_layer = layer_create(GRect(0, 0, s_content_width, 100));
  scroll_layer_add_child(s_scroll_layer, s_content_layer);

  // Create footer
  s_footer = chat_footer_create(s_content_width);

  // Create action button layer (spans entire window)
  s_action_button_layer = layer_create(bounds);
  layer_set_update_proc(s_action_button_layer, action_button_update_proc);
  layer_add_child(window_layer, s_action_button_layer);

  // Build the UI from message data
  rebuild_scroll_content();

  // Start dictation session automatically when window loads
  if (!s_waiting_for_response) {
    s_dictation_session = dictation_session_create(sizeof(char) * 256, dictation_session_callback, NULL);
    if (s_dictation_session) {
      dictation_session_start(s_dictation_session);
    }
  }
}

static void rebuild_scroll_content(void) {
  // Save current scroll position to restore after rebuild
  GPoint saved_offset = scroll_layer_get_content_offset(s_scroll_layer);

  // Destroy old bubbles
  for (int i = 0; i < s_bubble_count; i++) {
    if (s_bubbles[i]) {
      layer_remove_from_parent(message_bubble_get_layer(s_bubbles[i]));
      message_bubble_destroy(s_bubbles[i]);
      s_bubbles[i] = NULL;
    }
  }
  s_bubble_count = 0;

  // Remove footer from content layer
  layer_remove_from_parent(chat_footer_get_layer(s_footer));

  // Create new bubbles from message data
  int y_offset = 0;
  int bubble_max_width = s_content_width;

  for (int i = 0; i < s_message_count; i++) {
    MessageBubble *bubble = message_bubble_create(
      s_messages[i].text,
      s_messages[i].is_user,
      bubble_max_width
    );

    if (bubble) {
      s_bubbles[s_bubble_count++] = bubble;

      // Position bubble
      Layer *bubble_layer = message_bubble_get_layer(bubble);
      GRect frame = layer_get_frame(bubble_layer);
      frame.origin.x = 0;
      frame.origin.y = y_offset;
      layer_set_frame(bubble_layer, frame);
      layer_add_child(s_content_layer, bubble_layer);

      y_offset += message_bubble_get_height(bubble);
    }
  }

  // Add footer at the end
  // Add top padding only if last message is from user
  bool last_is_user = (s_message_count > 0) && s_messages[s_message_count - 1].is_user;
  if (last_is_user) {
    y_offset += 10;  // Add padding before footer
  }

  int footer_height = chat_footer_get_height(s_footer);
  Layer *footer_layer = chat_footer_get_layer(s_footer);
  GRect footer_frame = layer_get_frame(footer_layer);
  footer_frame.origin.x = 0;
  footer_frame.origin.y = y_offset;
  layer_set_frame(footer_layer, footer_frame);
  layer_add_child(s_content_layer, footer_layer);

  y_offset += footer_height;

  // Update content layer size
  GRect content_frame = layer_get_frame(s_content_layer);
  content_frame.size.h = y_offset;
  layer_set_frame(s_content_layer, content_frame);

  // Update scroll layer content size
  scroll_layer_set_content_size(s_scroll_layer, GSize(s_content_width, y_offset));

  // Restore previous scroll position (prevents jumping during rebuilds)
  scroll_layer_set_content_offset(s_scroll_layer, saved_offset, false);
}

static void shift_messages(void) {
  if (s_message_count == 0) {
    return;
  }

  // Shift all messages one position forward (removing the first/oldest message)
  for (int i = 0; i < s_message_count - 1; i++) {
    s_messages[i] = s_messages[i + 1];
  }

  // Decrement count to free up the last slot
  s_message_count--;
}

static void add_user_message(const char *text) {
  if (s_message_count >= MAX_MESSAGES) {
    // Message array is full, shift to make room
    shift_messages();
  }

  // Add the new message
  snprintf(s_messages[s_message_count].text, sizeof(s_messages[s_message_count].text), "%s", text);
  s_messages[s_message_count].is_user = true;
  s_message_count++;

  // Rebuild the UI to show the new message
  rebuild_scroll_content();
}

static void add_assistant_message(const char *text) {
  if (s_message_count >= MAX_MESSAGES) {
    // Message array is full, shift to make room
    shift_messages();
  }

  // Add empty or initial assistant message
  snprintf(s_messages[s_message_count].text, sizeof(s_messages[s_message_count].text), "%s", text);
  s_messages[s_message_count].is_user = false;
  s_message_count++;

  // Rebuild UI
  rebuild_scroll_content();
}

static void scroll_to_bottom(void) {
  GRect content_bounds = layer_get_bounds(s_content_layer);
  GRect scroll_bounds = layer_get_bounds(scroll_layer_get_layer(s_scroll_layer));

  int max_offset = content_bounds.size.h - scroll_bounds.size.h;
  if (max_offset < 0) {
    max_offset = 0;
  }

  scroll_layer_set_content_offset(s_scroll_layer, GPoint(0, -max_offset), true);
}

static void send_chat_request(void) {
  // Encode all messages into format: "[U]msg1[A]msg2[U]msg3..."
  static char encoded_buffer[MESSAGE_BUFFER_SIZE];
  encoded_buffer[0] = '\0';

  for (int i = 0; i < s_message_count; i++) {
    const char *prefix = s_messages[i].is_user ? "[U]" : "[A]";
    size_t current_len = strlen(encoded_buffer);
    size_t available = MESSAGE_BUFFER_SIZE - current_len - 1;

    // Add prefix
    strncat(encoded_buffer, prefix, available);
    current_len = strlen(encoded_buffer);
    available = MESSAGE_BUFFER_SIZE - current_len - 1;

    // Add message text
    strncat(encoded_buffer, s_messages[i].text, available);
  }

  // Send via AppMessage
  DictionaryIterator *iter;
  AppMessageResult result = app_message_outbox_begin(&iter);

  if (result == APP_MSG_OK) {
    dict_write_cstring(iter, MESSAGE_KEY_REQUEST_CHAT, encoded_buffer);
    result = app_message_outbox_send();

    if (result == APP_MSG_OK) {
      APP_LOG(APP_LOG_LEVEL_DEBUG, "Sent REQUEST_CHAT: %d bytes", (int)strlen(encoded_buffer));
      s_waiting_for_response = true;
      chat_window_set_footer_animating(true);
    } else {
      APP_LOG(APP_LOG_LEVEL_ERROR, "Failed to send REQUEST_CHAT: %d", (int)result);
    }
  } else {
    APP_LOG(APP_LOG_LEVEL_ERROR, "Failed to begin outbox: %d", (int)result);
  }
}

static void dictation_session_callback(DictationSession *session, DictationSessionStatus status, char *transcription, void *context) {
  if (status == DictationSessionStatusSuccess && transcription) {
    // Add the transcription as a user message
    add_user_message(transcription);
    scroll_to_bottom();

    // Send chat request to JS
    send_chat_request();
  } else {
    // Dictation was canceled or failed
    // If there are no messages, return to welcome screen
    if (s_message_count == 0) {
      window_stack_pop(true);
    }
  }

  // Clean up the dictation session
  dictation_session_destroy(s_dictation_session);
  s_dictation_session = NULL;
}

static void up_click_handler(ClickRecognizerRef recognizer, void *context) {
  // Scroll up
  GPoint offset = scroll_layer_get_content_offset(s_scroll_layer);
  offset.y += SCROLL_OFFSET;
  scroll_layer_set_content_offset(s_scroll_layer, offset, true);
}

static void down_click_handler(ClickRecognizerRef recognizer, void *context) {
  // Scroll down
  GPoint offset = scroll_layer_get_content_offset(s_scroll_layer);
  offset.y -= SCROLL_OFFSET;
  scroll_layer_set_content_offset(s_scroll_layer, offset, true);
}

static void select_click_handler(ClickRecognizerRef recognizer, void *context) {
  // Don't allow dictation if waiting for response
  if (s_waiting_for_response) {
    return;
  }

  // Start dictation session
  s_dictation_session = dictation_session_create(sizeof(char) * 256, dictation_session_callback, NULL);

  if (s_dictation_session) {
    dictation_session_start(s_dictation_session);
  }
}

// TODO: Switch to the official action button API once it appears in the SDK
// This is a temporary implementation based on the Pebble firmware source
static void action_button_update_proc(Layer *layer, GContext *ctx) {
  const GRect bounds = layer_get_bounds(layer);

  // Button radius (13 for rectangular displays, 12 for round)
  const int radius = PBL_IF_ROUND_ELSE(12, 13);

  // Create button rect and align it to the right side
  GRect button_rect = GRect(0, 0, radius * 2, radius * 2);
  grect_align(&button_rect, &bounds, GAlignRight, false);

  // Offset the button halfway off-screen
  button_rect.origin.x += radius;

  // Further offset on a per-content-size basis
  // Note: Using default medium content size offsets
  button_rect.origin.x += PBL_IF_ROUND_ELSE(1, 8);

  // Draw filled circle
  graphics_context_set_fill_color(ctx, GColorBlack);
  graphics_fill_radial(ctx, button_rect, GOvalScaleModeFitCircle, radius, 0, TRIG_MAX_ANGLE);
}

static void click_config_provider(void *context) {
  window_single_repeating_click_subscribe(BUTTON_ID_UP, 100, up_click_handler);
  window_single_repeating_click_subscribe(BUTTON_ID_DOWN, 100, down_click_handler);
  window_single_click_subscribe(BUTTON_ID_SELECT, select_click_handler);
}

static void window_unload(Window *window) {
  // Clean up dictation session if still active
  if (s_dictation_session) {
    dictation_session_destroy(s_dictation_session);
    s_dictation_session = NULL;
  }

  // Destroy all bubbles
  for (int i = 0; i < s_bubble_count; i++) {
    if (s_bubbles[i]) {
      message_bubble_destroy(s_bubbles[i]);
      s_bubbles[i] = NULL;
    }
  }
  s_bubble_count = 0;

  // Reset message history
  s_message_count = 0;

  // Destroy footer
  if (s_footer) {
    chat_footer_destroy(s_footer);
    s_footer = NULL;
  }

  // Destroy UI components
  if (s_content_layer) {
    layer_destroy(s_content_layer);
  }

  if (s_scroll_layer) {
    scroll_layer_destroy(s_scroll_layer);
  }

  if (s_action_button_layer) {
    layer_destroy(s_action_button_layer);
  }

  if (s_status_bar) {
    status_bar_layer_destroy(s_status_bar);
  }
}

void chat_window_handle_inbox(DictionaryIterator *iterator) {
  // Handle incoming messages from JS
  Tuple *response_text_tuple = dict_find(iterator, MESSAGE_KEY_RESPONSE_TEXT);
  Tuple *response_end_tuple = dict_find(iterator, MESSAGE_KEY_RESPONSE_END);

  if (response_text_tuple) {
    // Received complete response text
    const char *text = response_text_tuple->value->cstring;
    APP_LOG(APP_LOG_LEVEL_DEBUG, "Received RESPONSE_TEXT: %s", text);

    // Add as new assistant message
    add_assistant_message(text);
  }

  if (response_end_tuple) {
    // Response complete - unlock UI
    APP_LOG(APP_LOG_LEVEL_DEBUG, "Received RESPONSE_END");
    s_waiting_for_response = false;
    chat_window_set_footer_animating(false);
  }
}

Window* chat_window_create(void) {
  s_window = window_create();
  window_set_background_color(s_window, GColorWhite);
  window_set_window_handlers(s_window, (WindowHandlers) {
    .load = window_load,
    .unload = window_unload,
  });

  return s_window;
}

void chat_window_destroy(Window *window) {
  if (window) {
    window_destroy(window);
  }
}

void chat_window_set_footer_animating(bool animating) {
  if (!s_footer) {
    return;
  }

  if (animating) {
    chat_footer_start_animation(s_footer);
  } else {
    chat_footer_stop_animation(s_footer);
  }
}
