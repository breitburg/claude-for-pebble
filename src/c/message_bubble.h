#pragma once
#include <pebble.h>

/**
 * Message Bubble Component
 *
 * Displays a single message in the chat with appropriate styling.
 * User messages have grey background, Claude messages have white/clear background.
 */

typedef struct MessageBubble MessageBubble;

/**
 * Create a new message bubble.
 * @param text The message text to display
 * @param is_user true if this is a user message (grey background), false for Claude (white)
 * @param max_width Maximum width for the bubble (for text wrapping)
 * @return Pointer to the created message bubble
 */
MessageBubble* message_bubble_create(const char *text, bool is_user, int max_width);

/**
 * Destroy a message bubble and free its resources.
 * @param bubble The bubble to destroy
 */
void message_bubble_destroy(MessageBubble *bubble);

/**
 * Update the text in the message bubble (for streaming support).
 * @param bubble The bubble to update
 * @param text The new text to display
 */
void message_bubble_set_text(MessageBubble *bubble, const char *text);

/**
 * Get the underlying Layer for adding to view hierarchy.
 * @param bubble The message bubble
 * @return The Layer object
 */
Layer* message_bubble_get_layer(MessageBubble *bubble);

/**
 * Get the height of the message bubble (for layout calculations).
 * @param bubble The message bubble
 * @return Height in pixels
 */
int message_bubble_get_height(MessageBubble *bubble);
