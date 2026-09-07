#include "stm32_contact_filter.h"

#include <stddef.h>

bool scoring_contact_filter_update(scoring_contact_filter_t *state,
                                   uint64_t at_us, bool active, bool valid) {
  if (state == NULL) {
    return false;
  }
  if (!valid) {
    *state = (scoring_contact_filter_t){0};
    return false;
  }
  if (state->has_sample) {
    if (at_us <= state->last_us) {
      *state = (scoring_contact_filter_t){0};
      return false;
    }
    if (at_us - state->last_us > UINT64_C(125)) {
      state->active = false;
    }
  }
  state->last_us = at_us;
  state->has_sample = true;
  if (!active) {
    state->active = false;
    return false;
  }
  if (!state->active) {
    state->since_us = at_us;
    state->active = true;
  }
  return at_us - state->since_us >= UINT64_C(250);
}
