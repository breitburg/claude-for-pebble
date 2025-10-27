#include "chat_footer.h"
#include "claude_spark.h"

#define SPARK_SIZE 25
#define PADDING 10
#define TEXT_FONT FONT_KEY_GOTHIC_14

struct ChatFooter {
  Layer *layer;
  ClaudeSparkLayer *spark;
  TextLayer *text_layer;
  int height;
};

ChatFooter* chat_footer_create(int width) {
  ChatFooter *footer = malloc(sizeof(ChatFooter));
  if (!footer) {
    return NULL;
  }

  // Calculate text dimensions
  int text_x = PADDING + SPARK_SIZE + PADDING;
  int text_width = width - text_x - PADDING;

  GFont font = fonts_get_system_font(TEXT_FONT);
  GSize text_size = graphics_text_layout_get_content_size(
    CHAT_FOOTER_DISCLAIMER_TEXT,
    font,
    GRect(0, 0, text_width, 100),
    GTextOverflowModeWordWrap,
    GTextAlignmentLeft
  );

  // Calculate footer height dynamically
  int content_height = text_size.h > SPARK_SIZE ? text_size.h : SPARK_SIZE;
  footer->height = PADDING + content_height + PADDING;

  // Create container layer
  footer->layer = layer_create(GRect(0, 0, width, footer->height));

  // Create small Claude spark on the left (vertically centered)
  int spark_y = (footer->height - SPARK_SIZE) / 2;
  footer->spark = claude_spark_layer_create(
    GRect(PADDING, spark_y, SPARK_SIZE, SPARK_SIZE),
    CLAUDE_SPARK_SMALL
  );
  claude_spark_set_frame(footer->spark, 3);  // Static on frame 4
  layer_add_child(footer->layer, claude_spark_get_layer(footer->spark));

  // Create disclaimer text on the right (vertically centered)
  int text_y = (footer->height - text_size.h) / 2;
  footer->text_layer = text_layer_create(GRect(text_x, text_y, text_width, text_size.h));
  text_layer_set_text(footer->text_layer, CHAT_FOOTER_DISCLAIMER_TEXT);
  text_layer_set_font(footer->text_layer, fonts_get_system_font(TEXT_FONT));
  text_layer_set_text_alignment(footer->text_layer, GTextAlignmentLeft);
  text_layer_set_text_color(footer->text_layer, GColorDarkGray);
  text_layer_set_background_color(footer->text_layer, GColorClear);
#ifdef PBL_ROUND
  text_layer_enable_screen_text_flow_and_paging(footer->text_layer, 5);
#endif
  layer_add_child(footer->layer, text_layer_get_layer(footer->text_layer));

  return footer;
}

void chat_footer_destroy(ChatFooter *footer) {
  if (!footer) {
    return;
  }

  if (footer->text_layer) {
    text_layer_destroy(footer->text_layer);
  }

  if (footer->spark) {
    claude_spark_layer_destroy(footer->spark);
  }

  if (footer->layer) {
    layer_destroy(footer->layer);
  }

  free(footer);
}

Layer* chat_footer_get_layer(ChatFooter *footer) {
  return footer ? footer->layer : NULL;
}

void chat_footer_start_animation(ChatFooter *footer) {
  if (footer && footer->spark) {
    claude_spark_start_animation(footer->spark);
  }
}

void chat_footer_stop_animation(ChatFooter *footer) {
  if (footer && footer->spark) {
    claude_spark_stop_animation(footer->spark);
    claude_spark_set_frame(footer->spark, 3);  // Back to frame 4
  }
}

int chat_footer_get_height(ChatFooter *footer) {
  return footer ? footer->height : 0;
}
