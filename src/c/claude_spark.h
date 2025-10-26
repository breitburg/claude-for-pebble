#pragma once
#include <pebble.h>

/**
 * Claude Spark Animation Component
 *
 * Provides reusable Claude spark animation that can be placed anywhere in the UI.
 * Supports two sizes (large/small) and animation control (play/pause/freeze).
 */

typedef enum {
  CLAUDE_SPARK_SMALL,
  CLAUDE_SPARK_LARGE
} ClaudeSparkSize;

typedef struct ClaudeSparkLayer ClaudeSparkLayer;

/**
 * Initialize the Claude Spark system (loads PDC resources).
 * Call this once during app initialization.
 */
void claude_spark_init(void);

/**
 * Deinitialize the Claude Spark system (frees PDC resources).
 * Call this once during app deinitialization.
 */
void claude_spark_deinit(void);

/**
 * Create a new Claude Spark layer.
 * @param frame The position and size of the layer
 * @param size The size variant (SMALL or LARGE)
 * @return Pointer to the created spark layer
 */
ClaudeSparkLayer* claude_spark_layer_create(GRect frame, ClaudeSparkSize size);

/**
 * Destroy a Claude Spark layer and free its resources.
 * @param spark The spark layer to destroy
 */
void claude_spark_layer_destroy(ClaudeSparkLayer *spark);

/**
 * Get the underlying Layer for adding to the view hierarchy.
 * @param spark The spark layer
 * @return The Layer object
 */
Layer* claude_spark_get_layer(ClaudeSparkLayer *spark);

/**
 * Start animating the spark (loops through all frames).
 * @param spark The spark layer
 */
void claude_spark_start_animation(ClaudeSparkLayer *spark);

/**
 * Stop the animation and freeze on the current frame.
 * @param spark The spark layer
 */
void claude_spark_stop_animation(ClaudeSparkLayer *spark);

/**
 * Set the spark to display a specific frame (and stop animation).
 * @param spark The spark layer
 * @param frame_index The frame index (0-based)
 */
void claude_spark_set_frame(ClaudeSparkLayer *spark, int frame_index);

/**
 * Change the size of the spark (switches between large/small PDC).
 * @param spark The spark layer
 * @param size The new size
 */
void claude_spark_set_size(ClaudeSparkLayer *spark, ClaudeSparkSize size);

/**
 * Check if the spark is currently animating.
 * @param spark The spark layer
 * @return true if animating, false otherwise
 */
bool claude_spark_is_animating(ClaudeSparkLayer *spark);
