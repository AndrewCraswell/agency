#include "stm32_conductor_frame.h"
#include <assert.h>

static scoring_acquisition_frame_t rest(scoring_core_weapon_t weapon) {
  bool epee = weapon == SCORING_CORE_WEAPON_EPEE;
  scoring_acquisition_frame_t result = {
    .sources = {epee ? 0U : 1U, epee ? 3U : 4U, 6U},
    .receivers = {epee ? 1U : 6U, epee ? 8U : 48U, 64U},
    .sampled_us = {1000U, 1040U, 1080U}
  };
  return result;
}

static void contacts(void) {
  scoring_core_sample_t sample;
  scoring_acquisition_frame_t frame;
  unsigned int side;
  for (side = 0U; side < 2U; ++side) {
    unsigned int own = side * 3U;
    unsigned int other = 3U - own;
    scoring_core_contact_t *contact = side == 0U ? &sample.left : &sample.right;
    frame = rest(SCORING_CORE_WEAPON_EPEE);
    assert(scoring_conductor_decode(&frame, SCORING_CORE_WEAPON_EPEE, &sample));
    assert(sample.at_us == 1080U && contact->epee_closed == 0U);
    frame.receivers[side] |= (uint8_t)(1U << (own + 1U));
    assert(scoring_conductor_decode(&frame, SCORING_CORE_WEAPON_EPEE, &sample));
    assert(contact->epee_closed == 1U);
    frame.receivers[side] |= (uint8_t)(1U << (own + 2U));
    assert(scoring_conductor_decode(&frame, SCORING_CORE_WEAPON_EPEE, &sample));
    assert(contact->epee_closed == 0U);
    frame = rest(SCORING_CORE_WEAPON_EPEE);
    frame.receivers[side] |= (uint8_t)((1U << (own + 1U)) | (1U << (other + 2U)));
    assert(scoring_conductor_decode(&frame, SCORING_CORE_WEAPON_EPEE, &sample));
    assert(contact->epee_closed == 0U);
    frame = rest(SCORING_CORE_WEAPON_EPEE);
    frame.receivers[side] |= (uint8_t)((1U << (own + 1U)) | 64U);
    frame.receivers[2] = frame.receivers[side];
    assert(scoring_conductor_decode(&frame, SCORING_CORE_WEAPON_EPEE, &sample));
    assert(contact->epee_closed == 0U);
    frame = rest(SCORING_CORE_WEAPON_EPEE);
    frame.receivers[side] |= (uint8_t)(1U << (other + 1U));
    assert(!scoring_conductor_decode(&frame, SCORING_CORE_WEAPON_EPEE, &sample));
    assert(sample.left.epee_closed == 0U && sample.right.epee_closed == 0U);

    frame = rest(SCORING_CORE_WEAPON_FOIL);
    assert(scoring_conductor_decode(&frame, SCORING_CORE_WEAPON_FOIL, &sample));
    assert(contact->foil_open == 0U);
    frame.receivers[side] = (uint8_t)(1U << (own + 1U));
    assert(scoring_conductor_decode(&frame, SCORING_CORE_WEAPON_FOIL, &sample));
    assert(contact->foil_open == 1U && contact->target_kind == 1U);
    frame.receivers[side] |= (uint8_t)(1U << other);
    assert(scoring_conductor_decode(&frame, SCORING_CORE_WEAPON_FOIL, &sample));
    assert(contact->foil_open == 1U && contact->target_kind == 0U);
    frame.receivers[side] |= (uint8_t)(1U << own);
    assert(scoring_conductor_decode(&frame, SCORING_CORE_WEAPON_FOIL, &sample));
    assert(contact->foil_open == 0U);
    frame.receivers[side] = (uint8_t)((1U << (own + 1U)) | (1U << (other + 2U)));
    assert(scoring_conductor_decode(&frame, SCORING_CORE_WEAPON_FOIL, &sample));
    assert(contact->foil_open == 0U);
    frame.receivers[side] = (uint8_t)((1U << (own + 1U)) | 64U);
    frame.receivers[2] = frame.receivers[side];
    assert(scoring_conductor_decode(&frame, SCORING_CORE_WEAPON_FOIL, &sample));
    assert(contact->foil_open == 0U);

    frame = rest(SCORING_CORE_WEAPON_SABRE);
    assert(scoring_conductor_decode(&frame, SCORING_CORE_WEAPON_SABRE, &sample));
    assert(contact->target_kind == 1U && contact->control_break == 0U);
    frame.receivers[side] |= (uint8_t)(1U << other);
    assert(scoring_conductor_decode(&frame, SCORING_CORE_WEAPON_SABRE, &sample));
    assert(contact->target_kind == 0U);
    frame.receivers[side] &= (uint8_t)~(1U << (own + 2U));
    assert(scoring_conductor_decode(&frame, SCORING_CORE_WEAPON_SABRE, &sample));
    assert(contact->control_break == 1U && contact->target_kind == 1U);
    frame = rest(SCORING_CORE_WEAPON_SABRE);
    frame.receivers[side] |= (uint8_t)((1U << other) | (1U << own));
    assert(scoring_conductor_decode(&frame, SCORING_CORE_WEAPON_SABRE, &sample));
    assert(contact->target_kind == 1U);
    frame = rest(SCORING_CORE_WEAPON_SABRE);
    frame.receivers[side] |= (uint8_t)((1U << other) | 64U);
    frame.receivers[2] = frame.receivers[side];
    assert(scoring_conductor_decode(&frame, SCORING_CORE_WEAPON_SABRE, &sample));
    assert(contact->target_kind == 1U);
    frame = rest(SCORING_CORE_WEAPON_SABRE);
    frame.receivers[0] = 54U;
    frame.receivers[1] = 54U;
    assert(scoring_conductor_decode(&frame, SCORING_CORE_WEAPON_SABRE, &sample));
    assert(sample.left.blade_present == 1U && sample.right.blade_present == 1U);
    frame.receivers[0] = 63U;
    frame.receivers[1] = 63U;
    assert(!scoring_conductor_decode(&frame, SCORING_CORE_WEAPON_SABRE, &sample));
    assert(sample.left.target_kind == 1U && sample.right.target_kind == 1U);
  }
}

int main(void) {
  scoring_acquisition_frame_t frame = rest(SCORING_CORE_WEAPON_FOIL);
  scoring_core_sample_t sample;
  unsigned int index;
  contacts();
  assert(!scoring_conductor_decode(&frame, SCORING_CORE_WEAPON_FOIL, NULL));
  assert(!scoring_conductor_decode(NULL, SCORING_CORE_WEAPON_FOIL, &sample));
  assert(!scoring_conductor_decode(&frame, (scoring_core_weapon_t)3, &sample));
  assert(!scoring_conductor_decode(&frame, (scoring_core_weapon_t)-1, &sample));
  for (index = 0U; index < 3U; ++index) {
    frame = rest(SCORING_CORE_WEAPON_FOIL);
    frame.sources[index] = 7U;
    assert(!scoring_conductor_decode(&frame, SCORING_CORE_WEAPON_FOIL, &sample));
    frame = rest(SCORING_CORE_WEAPON_FOIL);
    frame.receivers[index] |= 128U;
    assert(!scoring_conductor_decode(&frame, SCORING_CORE_WEAPON_FOIL, &sample));
    frame = rest(SCORING_CORE_WEAPON_FOIL);
    frame.receivers[index] = 0U;
    assert(!scoring_conductor_decode(&frame, SCORING_CORE_WEAPON_FOIL, &sample));
    frame = rest(SCORING_CORE_WEAPON_FOIL);
    frame.sampled_us[index] += 1U;
    assert(!scoring_conductor_decode(&frame, SCORING_CORE_WEAPON_FOIL, &sample));
  }
  frame = rest(SCORING_CORE_WEAPON_FOIL);
  frame.sampled_us[0] = UINT64_MAX;
  assert(!scoring_conductor_decode(&frame, SCORING_CORE_WEAPON_FOIL, &sample));
  frame = rest(SCORING_CORE_WEAPON_FOIL);
  frame.receivers[0] |= 16U;
  assert(!scoring_conductor_decode(&frame, SCORING_CORE_WEAPON_FOIL, &sample));
  frame = rest(SCORING_CORE_WEAPON_FOIL);
  frame.receivers[1] |= 2U;
  assert(!scoring_conductor_decode(&frame, SCORING_CORE_WEAPON_FOIL, &sample));
  frame.receivers[0] |= 16U;
  assert(!scoring_conductor_decode(&frame, SCORING_CORE_WEAPON_FOIL, &sample));
  /* Joined B conductors with both C returns open: blade path still visible. */
  frame = rest(SCORING_CORE_WEAPON_SABRE);
  frame.receivers[0] = 18U;
  frame.receivers[1] = 18U;
  assert(scoring_conductor_decode(&frame, SCORING_CORE_WEAPON_SABRE, &sample));
  assert(sample.left.blade_present == 1U && sample.right.blade_present == 1U);
  assert(sample.left.control_break == 1U && sample.right.control_break == 1U);
  frame = rest(SCORING_CORE_WEAPON_SABRE);
  frame.receivers[0] = 14U;
  frame.receivers[1] = 49U;
  assert(scoring_conductor_decode(&frame, SCORING_CORE_WEAPON_SABRE, &sample));
  assert(sample.left.target_kind == 0U && sample.right.target_kind == 0U);
  assert(sample.left.blade_present == 0U && sample.right.blade_present == 0U);
  frame = rest(SCORING_CORE_WEAPON_EPEE);
  frame.receivers[0] = 3U;
  frame.receivers[1] = 24U;
  assert(scoring_conductor_decode(&frame, SCORING_CORE_WEAPON_EPEE, &sample));
  assert(sample.left.epee_closed == 1U && sample.right.epee_closed == 1U);
  for (index = 0U; index < 3U; ++index) {
    scoring_core_weapon_t weapon = (scoring_core_weapon_t)index;
    frame = rest(weapon);
    frame.receivers[0] = 127U;
    frame.receivers[1] = 127U;
    frame.receivers[2] = 127U;
    if (weapon == SCORING_CORE_WEAPON_FOIL) {
      assert(scoring_conductor_decode(&frame, weapon, &sample));
      assert(sample.left.foil_open == 0U && sample.right.foil_open == 0U);
    } else {
      assert(!scoring_conductor_decode(&frame, weapon, &sample));
      assert(sample.left.epee_closed == 0U && sample.right.epee_closed == 0U);
      assert(sample.left.target_kind == 1U && sample.right.target_kind == 1U);
    }
  }
  return 0;
}
