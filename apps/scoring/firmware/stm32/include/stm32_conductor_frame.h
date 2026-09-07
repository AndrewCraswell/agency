#ifndef SCORING_STM32_CONDUCTOR_FRAME_H
#define SCORING_STM32_CONDUCTOR_FRAME_H

#include "stm32_scoring_core.h"

/* Bit order LA, LB, LC, RA, RB, RC, piste; source entries are bit indices. */
typedef struct {
  uint8_t sources[3];
  uint8_t receivers[3];
  uint64_t sampled_us[3];
} scoring_acquisition_frame_t;

/* Produces unqualified contact observations, not hits. A false result requires
 * resetting positive-contact filters. Never feed a partial or invalid frame to
 * the weapon core. True results still need the 250us positive-contact filter;
 * guard/piste inhibition and blade/control observations must not be delayed.
 */
bool scoring_conductor_decode(const scoring_acquisition_frame_t *frame,
                              scoring_core_weapon_t weapon,
                              scoring_core_sample_t *sample);

#endif
