#include "stm32_contact_filter.h"
#include "stm32_scoring_core.h"

#include <stdio.h>
#include <stdlib.h>

#define CHECK(expression) do { if (!(expression)) { \
  (void)fprintf(stderr, "failed: %s:%d: %s\n", __FILE__, __LINE__, #expression); \
  exit(EXIT_FAILURE); \
} } while (0)

static void boundaries(void) {
  scoring_contact_filter_t filter = {0};
  CHECK(!scoring_contact_filter_update(NULL, 0, true, true));
  CHECK(!scoring_contact_filter_update(&filter, 0, false, true));
  CHECK(!scoring_contact_filter_update(&filter, 1, true, true));
  CHECK(!scoring_contact_filter_update(&filter, 126, true, true));
  CHECK(!scoring_contact_filter_update(&filter, 250, true, true));
  CHECK(scoring_contact_filter_update(&filter, 251, true, true));
  CHECK(!scoring_contact_filter_update(&filter, 252, false, true));
  CHECK(!scoring_contact_filter_update(&filter, 253, true, true));
  CHECK(!scoring_contact_filter_update(&filter, 379, true, true));
  CHECK(filter.since_us == 379);
  CHECK(!scoring_contact_filter_update(&filter, 379, true, true));
  CHECK(!filter.has_sample);
  CHECK(!scoring_contact_filter_update(&filter, 500, true, true));
  CHECK(!scoring_contact_filter_update(&filter, 499, true, true));
  CHECK(!scoring_contact_filter_update(&filter, 600, true, true));
  CHECK(!scoring_contact_filter_update(&filter, 700, true, false));
  CHECK(!filter.has_sample);
  CHECK(!scoring_contact_filter_update(&filter, UINT64_MAX - 250, true, true));
  CHECK(!scoring_contact_filter_update(&filter, UINT64_MAX - 125, true, true));
  CHECK(scoring_contact_filter_update(&filter, UINT64_MAX, true, true));
}

/* This is the executable timing envelope, not a conductor topology decoder.
 * Rejection uses zero onset delay plus a pessimistic 30us release extension;
 * guaranteed detection uses 120us onset delay and no extension. The latter
 * includes 40us analog/slot allowance plus 80us frame assembly latency.
 */
static void pulse(scoring_core_weapon_t weapon, uint64_t duration,
                  uint64_t onset_delay, uint64_t tail, bool expected,
                  uint64_t frame_us, uint64_t phase) {
  scoring_contact_filter_t filters[2] = {{0}, {0}};
  scoring_core_state_t core;
  CHECK(scoring_core_init(&core, weapon) == SCORING_CORE_OK);
  for (uint64_t now = 0; now < duration + 2000; now += frame_us) {
    scoring_core_sample_t sample = {.at_us = now};
    for (unsigned side = 0; side < 2; ++side) {
      const uint64_t start = 300 + phase + side * 40;
      const bool raw = now >= start + onset_delay && now < start + duration + tail;
      const bool active = scoring_contact_filter_update(&filters[side], now, raw, true);
      scoring_core_contact_t *contact = side == 0 ? &sample.left : &sample.right;
      contact->epee_closed = active ? 1 : 0;
      contact->foil_open = active ? 1 : 0;
      /* Core input encoding: 0 = conductive target, 1 = no conductive target.
       * This is not the separate output classification enum. */
      contact->target_kind = active ? 0U : 1U;
    }
    CHECK(scoring_core_advance(&core, &sample) == SCORING_CORE_OK);
  }
  CHECK(core.hit_count == (expected ? 2U : 0U));
  for (size_t i = 0; i < core.hit_count; ++i) {
    const uint64_t start = 300 + phase + core.hits[i].side * 40;
    CHECK(core.hits[i].qualified_at_us < start + duration);
  }
}

static void interruptions(uint64_t frame_us, uint64_t phase) {
  scoring_contact_filter_t filter = {0};
  for (uint64_t now = 0; now < 20000; now += frame_us) {
    const bool raw = now >= phase && (now - phase) % 225 < 90;
    /* 60us contact + maximum modeled 30us tail, followed by 135us low. */
    CHECK(!scoring_contact_filter_update(&filter, now, raw, true));
  }
}

int main(void) {
  boundaries();
  for (uint64_t frame = 120; frame <= 125; ++frame) {
    for (uint64_t phase = 0; phase < frame; ++phase) {
      pulse(SCORING_CORE_WEAPON_SABRE, 99, 0, 30, false, frame, phase);
      pulse(SCORING_CORE_WEAPON_SABRE, 1000, 120, 0, true, frame, phase);
      pulse(SCORING_CORE_WEAPON_EPEE, 1999, 0, 30, false, frame, phase);
      pulse(SCORING_CORE_WEAPON_EPEE, 10000, 120, 0, true, frame, phase);
      pulse(SCORING_CORE_WEAPON_FOIL, 12999, 0, 30, false, frame, phase);
      pulse(SCORING_CORE_WEAPON_FOIL, 15000, 120, 0, true, frame, phase);
      interruptions(frame, phase);
    }
  }
  (void)puts("contact filter: boundaries, both fencers, six pulse envelopes and interrupted trains passed");
  return EXIT_SUCCESS;
}
