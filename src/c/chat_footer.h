#pragma once
#include <pebble.h>

/**
 * Chat Footer Component
 *
 * Displays a small Claude spark icon with "Claude can make mistakes." disclaimer.
 * Shown at the bottom of the chat conversation.
 */

#define CHAT_FOOTER_DISCLAIMER_TEXT "Claude\ncan make\nmistakes."

typedef struct ChatFooter ChatFooter;

/**
 * Create a new chat footer.
 * @param width Width of the footer (typically content area width)
 * @return Pointer to the created footer
 */
ChatFooter* chat_footer_create(int width);

/**
 * Destroy a chat footer and free its resources.
 * @param footer The footer to destroy
 */
void chat_footer_destroy(ChatFooter *footer);

/**
 * Get the underlying Layer for adding to view hierarchy.
 * @param footer The chat footer
 * @return The Layer object
 */
Layer* chat_footer_get_layer(ChatFooter *footer);

/**
 * Start animating the Claude spark.
 * @param footer The chat footer
 */
void chat_footer_start_animation(ChatFooter *footer);

/**
 * Stop animating the Claude spark.
 * @param footer The chat footer
 */
void chat_footer_stop_animation(ChatFooter *footer);

/**
 * Get the height of the footer (for layout calculations).
 * @param footer The chat footer
 * @return Height in pixels
 */
int chat_footer_get_height(ChatFooter *footer);
