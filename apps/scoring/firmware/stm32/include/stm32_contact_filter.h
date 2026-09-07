#ifndef STM32_CONTACT_FILTER_H
#define STM32_CONTACT_FILTER_H

#include <stdbool.h>
#include <stdint.h>

/* One instance per decoded contact predicate, zero-initialized before use.
 * Input must come from a complete, source-identified acquisition frame.
 * This does not decode conductor topology or replace the weapon scoring core.
 */
typedef struct scoring_contact_filter {
  uint64_t last_us;
  uint64_t since_us;
  bool has_sample;
  bool active;
} scoring_contact_filter_t;

/* 120us nominal frame, 5us scheduling allowance. Missing/invalid data never
 * extends an existing candidate. The 250us input filter precedes the core's
 * weapon-specific qualification; do not backdate its output to since_us.
 */
bool scoring_contact_filter_update(scoring_contact_filter_t *state,
                                   uint64_t at_us, bool active, bool valid);

#endif
