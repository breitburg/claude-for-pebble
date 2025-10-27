#include "message_bubble.h"

#define MESSAGE_PADDING 10
#define MESSAGE_FONT FONT_KEY_GOTHIC_24_BOLD

struct MessageBubble {
  Layer *layer;
  TextLayer *text_layer;
  bool is_user;
  int max_width;
};

static void background_update_proc(Layer *layer, GContext *ctx) {
  MessageBubble *bubble = *(MessageBubble**)layer_get_data(layer);
  if (!bubble) {
    return;
  }

  // Only draw background for user messages (rectangle spanning full width)
  if (bubble->is_user) {
    GRect bounds = layer_get_bounds(layer);
    graphics_context_set_fill_color(ctx, PBL_IF_COLOR_ELSE(GColorRajah, GColorLightGray));
    graphics_fill_rect(ctx, bounds, 0, GCornerNone);  // No rounded corners
  }
  // Claude messages have no background (white on white)
}

MessageBubble* message_bubble_create(const char *text, bool is_user, int max_width) {
  MessageBubble *bubble = malloc(sizeof(MessageBubble));
  if (!bubble) {
    return NULL;
  }

  bubble->is_user = is_user;
  bubble->max_width = max_width;

  // Calculate text size (account for padding so bubble doesn't exceed max_width)
  GFont font = fonts_get_system_font(MESSAGE_FONT);
  int available_text_width = max_width - (MESSAGE_PADDING * 2);
  GSize text_size = graphics_text_layout_get_content_size(
    text,
    font,
    GRect(0, 0, available_text_width, 2000),
    GTextOverflowModeWordWrap,
    GTextAlignmentLeft
  );

  // Bubble spans full width, height based on text + padding
  int bubble_height = text_size.h + (MESSAGE_PADDING * 2);

  // Create container layer with background (full width)
  bubble->layer = layer_create_with_data(GRect(0, 0, max_width, bubble_height), sizeof(MessageBubble*));
  layer_set_update_proc(bubble->layer, background_update_proc);
  *(MessageBubble**)layer_get_data(bubble->layer) = bubble;

  // Create text layer (positioned to center vertically, with extra height for descenders)
  bubble->text_layer = text_layer_create(GRect(
    MESSAGE_PADDING,
    MESSAGE_PADDING / 2,
    text_size.w,
    bubble_height - MESSAGE_PADDING
  ));
  text_layer_set_text(bubble->text_layer, text);
  text_layer_set_font(bubble->text_layer, font);
  text_layer_set_text_alignment(bubble->text_layer, GTextAlignmentLeft);
  text_layer_set_background_color(bubble->text_layer, GColorClear);
  text_layer_set_text_color(bubble->text_layer, GColorBlack);
  layer_add_child(bubble->layer, text_layer_get_layer(bubble->text_layer));

  return bubble;
}

void message_bubble_destroy(MessageBubble *bubble) {
  if (!bubble) {
    return;
  }

  if (bubble->text_layer) {
    text_layer_destroy(bubble->text_layer);
  }

  if (bubble->layer) {
    layer_destroy(bubble->layer);
  }

  free(bubble);
}

void message_bubble_set_text(MessageBubble *bubble, const char *text) {
  if (!bubble || !bubble->text_layer) {
    return;
  }

  // Update text
  text_layer_set_text(bubble->text_layer, text);

  // Recalculate text size (account for padding so bubble doesn't exceed max_width)
  GFont font = fonts_get_system_font(MESSAGE_FONT);
  int available_text_width = bubble->max_width - (MESSAGE_PADDING * 2);
  GSize text_size = graphics_text_layout_get_content_size(
    text,
    font,
    GRect(0, 0, available_text_width, 2000),
    GTextOverflowModeWordWrap,
    GTextAlignmentLeft
  );

  // Update bubble height (width stays at max_width)
  int bubble_height = text_size.h + (MESSAGE_PADDING * 2);
  GRect frame = layer_get_frame(bubble->layer);
  frame.size.h = bubble_height;
  layer_set_frame(bubble->layer, frame);

  // Update text layer size and position (centered vertically with extra height for descenders)
  GRect text_frame = GRect(
    MESSAGE_PADDING,
    MESSAGE_PADDING / 2,
    text_size.w,
    bubble_height - MESSAGE_PADDING
  );
  layer_set_frame(text_layer_get_layer(bubble->text_layer), text_frame);

  layer_mark_dirty(bubble->layer);
}

Layer* message_bubble_get_layer(MessageBubble *bubble) {
  return bubble ? bubble->layer : NULL;
}

int message_bubble_get_height(MessageBubble *bubble) {
  if (!bubble || !bubble->layer) {
    return 0;
  }

  return layer_get_frame(bubble->layer).size.h;
}
