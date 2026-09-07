#include "stm32_conductor_frame.h"

bool scoring_conductor_decode(const scoring_acquisition_frame_t *frame,
                              scoring_core_weapon_t weapon,
                              scoring_core_sample_t *sample) {
  size_t side;
  size_t index;
  bool epee = weapon == SCORING_CORE_WEAPON_EPEE;
  if (sample == NULL) {
    return false;
  }
  *sample = (scoring_core_sample_t){ .left.target_kind = 1U, .right.target_kind = 1U };
  if (frame == NULL || (unsigned int)weapon > (unsigned int)SCORING_CORE_WEAPON_SABRE) {
    return false;
  }
  if (frame->sources[0] != (epee ? 0U : 1U) ||
      frame->sources[1] != (epee ? 3U : 4U) || frame->sources[2] != 6U ||
      frame->sampled_us[0] > UINT64_MAX - 80U ||
      frame->sampled_us[1] != frame->sampled_us[0] + 40U ||
      frame->sampled_us[2] != frame->sampled_us[0] + 80U) {
    return false;
  }
  for (side = 0U; side < 3U; ++side) {
    uint8_t mask = frame->receivers[side];
    if ((mask & 0x80U) != 0U || (mask & (1U << frame->sources[side])) == 0U) {
      return false;
    }
    /* A passive static connected component must be reciprocal. Asymmetric
     * threshold readings or contacts changing during the frame are discarded.
     */
    for (index = side + 1U; index < 3U; ++index) {
      bool forward = (mask & (1U << frame->sources[index])) != 0U;
      bool reverse = (frame->receivers[index] & (1U << frame->sources[side])) != 0U;
      if (forward != reverse || (forward && mask != frame->receivers[index])) {
        return false;
      }
    }
  }
  for (side = 0U; side < 2U; ++side) {
    uint8_t mask = frame->receivers[side];
    unsigned int own = (unsigned int)side * 3U;
    unsigned int other = 3U - own;
    bool own_guard = (mask & (1U << (own + 2U))) != 0U;
    bool other_guard = (mask & (1U << (other + 2U))) != 0U;
    bool piste = (mask & 64U) != 0U;
    scoring_core_contact_t *contact = side == 0U ? &sample->left : &sample->right;
    if (epee) {
      /* Cross-fencer tip wiring is not an ordinary epee contact topology. */
      if ((mask & ((1U << other) | (1U << (other + 1U)))) != 0U) {
        *sample = (scoring_core_sample_t){ .left.target_kind = 1U, .right.target_kind = 1U };
        return false;
      }
      contact->epee_closed = (uint8_t)(!own_guard && !other_guard && !piste &&
        (mask & (1U << (own + 1U))) != 0U);
    } else {
      bool own_jacket = (mask & (1U << own)) != 0U;
      bool target = (mask & (1U << other)) != 0U;
      bool blade = other_guard || (mask & (1U << (other + 1U))) != 0U;
      if (weapon == SCORING_CORE_WEAPON_FOIL) {
        contact->foil_open = (uint8_t)(!own_guard && !own_jacket && !blade && !piste);
        contact->target_kind = (uint8_t)!target;
      } else {
        /* A crossed-blade network that also reaches a jacket cannot identify
         * which redundant physical contact caused it. Do not invent a hit.
         */
        if (blade && target) {
          *sample = (scoring_core_sample_t){ .left.target_kind = 1U, .right.target_kind = 1U };
          return false;
        }
        contact->control_break = (uint8_t)!own_guard;
        contact->blade_present = (uint8_t)blade;
        contact->target_kind = (uint8_t)!(target && own_guard && !own_jacket && !piste);
      }
    }
  }
  sample->at_us = frame->sampled_us[2];
  return true;
}
