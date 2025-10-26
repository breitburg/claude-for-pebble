#pragma once
#include <pebble.h>

/**
 * Chat Window - Displays conversation with Claude
 *
 * Shows a scrollable list of message bubbles with a footer.
 * Designed for dynamic message updates (streaming support).
 */

/**
 * Create the chat window.
 * @return Pointer to the created window
 */
Window* chat_window_create(void);

/**
 * Destroy the chat window and free its resources.
 * @param window The window to destroy
 */
void chat_window_destroy(Window *window);

/**
 * Control the footer Claude spark animation.
 * @param animating true to animate (thinking), false to stop
 */
void chat_window_set_footer_animating(bool animating);

/**
 * Handle incoming AppMessage from JavaScript.
 * @param iterator Dictionary iterator with message data
 */
void chat_window_handle_inbox(DictionaryIterator *iterator);
