#ifndef SCORING_STM32G474_ACQUISITION_H
#define SCORING_STM32G474_ACQUISITION_H

#include <stdbool.h>
#include <stdint.h>
#include "stm32_conductor_frame.h"

/* Bits are LA, LB, LC, RA, RB, RC, piste. Times are monotonic microseconds.
 * The caller must serialize calls and dispatch at next_us using a hardware
 * timer. An overdue transition stops the scanner; it never catches up.
 * Start only after the target startup checks and supply validation pass.
 */
typedef struct {
  uint64_t next_us;
  uint64_t last_us;
  scoring_acquisition_frame_t frame;
  uint8_t slot;
  uint8_t phase;
  bool running;
} scoring_acquisition_t;

typedef enum {
  SCORING_ACQUISITION_FAULT = -1,
  SCORING_ACQUISITION_WAIT = 0,
  SCORING_ACQUISITION_FRAME = 1
} scoring_acquisition_result_t;

/* epee=false selects LB/RB/piste; true selects LA/RA/piste. */
bool scoring_stm32g474_acquisition_start(scoring_acquisition_t *state,
                                       bool epee, uint64_t now_us,
                                       bool supply_valid);
void scoring_stm32g474_acquisition_stop(scoring_acquisition_t *state);
scoring_acquisition_result_t scoring_stm32g474_acquisition_poll(
  scoring_acquisition_t *state, uint64_t now_us, bool supply_valid,
  scoring_acquisition_frame_t *frame);

#endif
