#include "setup_window.h"

static Window *s_window;
static Layer *s_message_layer;
static GFont s_font;

static void message_layer_update_proc(Layer *layer, GContext *ctx) {
  GRect bounds = layer_get_bounds(layer);
  const char *text = "Configure Claude\nin settings";

  graphics_context_set_text_color(ctx, GColorBlack);

  // Calculate text height to center vertically
  GSize text_size = graphics_text_layout_get_content_size(
    text,
    s_font,
    bounds,
    GTextOverflowModeWordWrap,
    GTextAlignmentCenter
  );

  // Create centered rect for drawing
  GRect text_rect = GRect(
    bounds.origin.x,
    bounds.origin.y + (bounds.size.h - text_size.h) / 2,
    bounds.size.w,
    text_size.h
  );

  // Draw text with horizontal and vertical centering
  graphics_draw_text(ctx,
    text,
    s_font,
    text_rect,
    GTextOverflowModeWordWrap,
    GTextAlignmentCenter,
    NULL);
}

static void window_load(Window *window) {
  Layer *window_layer = window_get_root_layer(window);
  GRect bounds = layer_get_bounds(window_layer);

  // Get font
  s_font = fonts_get_system_font(FONT_KEY_GOTHIC_24_BOLD);

  // Create custom layer that spans full screen
  int margin = PBL_IF_ROUND_ELSE(30, 20);
  s_message_layer = layer_create(GRect(
    margin,
    0,
    bounds.size.w - margin * 2,
    bounds.size.h
  ));

  // Set update procedure for custom drawing with vertical centering
  layer_set_update_proc(s_message_layer, message_layer_update_proc);

  layer_add_child(window_layer, s_message_layer);
}

static void window_unload(Window *window) {
  if (s_message_layer) {
    layer_destroy(s_message_layer);
    s_message_layer = NULL;
  }
}

Window* setup_window_create(void) {
  s_window = window_create();
  window_set_background_color(s_window, GColorWhite);
  window_set_window_handlers(s_window, (WindowHandlers) {
    .load = window_load,
    .unload = window_unload,
  });

  return s_window;
}

void setup_window_destroy(Window *window) {
  if (window) {
    window_destroy(window);
  }
}
