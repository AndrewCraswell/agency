#include "stm32_scoring_core.h"

#include <string.h>

#define EPEE_CONTACT_MINIMUM_US UINT64_C(2000)
#define EPEE_DOUBLE_HIT_WINDOW_US UINT64_C(45000)
#define FOIL_CONTACT_BREAK_MINIMUM_US UINT64_C(13000)
#define FOIL_LOCKOUT_US UINT64_C(300000)
#define SABRE_MINIMUM_CONTACT_US UINT64_C(100)
#define SABRE_BLADE_REGISTRATION_LATEST_US UINT64_C(5000)
#define SABRE_BLADE_RECOVERY_US UINT64_C(20000)
#define SABRE_CONTROL_BREAK_US UINT64_C(3000)
#define SABRE_LOCKOUT_US UINT64_C(170000)

static bool weapon_is_valid(scoring_core_weapon_t weapon) {
  const int32_t value = (int32_t)weapon;
  return value >= (int32_t)SCORING_CORE_WEAPON_EPEE && value <= (int32_t)SCORING_CORE_WEAPON_SABRE;
}

static const scoring_core_contact_t *contact_for(
  const scoring_core_sample_t *sample,
  scoring_core_side_t side
) {
  return side == SCORING_CORE_SIDE_LEFT ? &sample->left : &sample->right;
}

static bool contact_is_normalized(const scoring_core_contact_t *contact) {
  return contact->epee_closed <= 1U && contact->foil_open <= 1U && contact->target_kind <= 1U &&
    contact->blade_present <= 1U && contact->control_break <= 1U;
}

static bool is_sha256_digest(const char *value) {
  static const char prefix[] = "sha256:";
  size_t index;
  if (value == NULL || strncmp(value, prefix, sizeof(prefix) - 1U) != 0) return false;
  for (index = sizeof(prefix) - 1U; index < sizeof(prefix) - 1U + 64U; index += 1U) {
    const char character = value[index];
    if (!((character >= '0' && character <= '9') || (character >= 'a' && character <= 'f'))) return false;
  }
  return value[sizeof(prefix) - 1U + 64U] == '\0';
}

static void clear_candidate(scoring_core_side_state_t *side) {
  side->candidate_active = false;
  side->candidate_since_us = 0U;
}

static scoring_core_hit_t make_hit(
  scoring_core_side_t side,
  uint8_t classification,
  uint64_t started_at_us,
  uint64_t qualified_at_us
) {
  scoring_core_hit_t hit = {
    .side = (uint8_t)side,
    .classification = classification,
    .started_at_us = started_at_us,
    .qualified_at_us = qualified_at_us
  };
  return hit;
}

static bool hit_precedes(const scoring_core_hit_t *left, const scoring_core_hit_t *right) {
  /* Candidate collection is left-side first, so equal timestamps are already in canonical side order. */
  return left->started_at_us <= right->started_at_us;
}

static bool starts_inside_window(uint64_t started_at_us, uint64_t first_at_us, uint64_t window_us) {
  return started_at_us <= first_at_us || started_at_us - first_at_us <= window_us;
}

static scoring_core_status_t append_hit(scoring_core_state_t *state, const scoring_core_hit_t *hit) {
  if (state->hit_count >= SCORING_CORE_MAX_HITS) {
    return SCORING_CORE_OVERFLOW;
  }
  state->hits[state->hit_count] = *hit;
  state->hit_count += 1U;
  return SCORING_CORE_OK;
}

static bool advance_epee_side(
  scoring_core_state_t *state,
  const scoring_core_sample_t *sample,
  scoring_core_side_t side,
  scoring_core_hit_t *out_hit
) {
  scoring_core_side_state_t *side_state = &state->sides[side];
  const scoring_core_contact_t *contact = contact_for(sample, side);

  if (side_state->registered) {
    return false;
  }
  if (contact->epee_closed == 0U) {
    clear_candidate(side_state);
    return false;
  }
  if (!side_state->candidate_active) {
    side_state->candidate_active = true;
    side_state->candidate_since_us = sample->at_us;
    return false;
  }
  if (sample->at_us - side_state->candidate_since_us < EPEE_CONTACT_MINIMUM_US) {
    return false;
  }

  *out_hit = make_hit(side, SCORING_CORE_CLASSIFICATION_NONE, side_state->candidate_since_us, sample->at_us);
  side_state->registered = true;
  clear_candidate(side_state);
  return true;
}

static scoring_core_status_t advance_epee(scoring_core_state_t *state, const scoring_core_sample_t *sample) {
  scoring_core_hit_t new_hits[SCORING_CORE_SIDE_COUNT];
  size_t new_hit_count = 0U;
  scoring_core_side_t side;

  if (state->locked) {
    return SCORING_CORE_OK;
  }
  for (side = SCORING_CORE_SIDE_LEFT; side < SCORING_CORE_SIDE_COUNT; side += 1) {
    scoring_core_hit_t hit;
    if (advance_epee_side(state, sample, side, &hit)) {
      new_hits[new_hit_count] = hit;
      new_hit_count += 1U;
    }
  }
  if (new_hit_count == 2U && !hit_precedes(&new_hits[0], &new_hits[1])) {
    const scoring_core_hit_t swap = new_hits[0];
    new_hits[0] = new_hits[1];
    new_hits[1] = swap;
  }
  for (size_t index = 0U; index < new_hit_count; index += 1U) {
    const scoring_core_hit_t *hit = &new_hits[index];
    if (!state->has_first_hit) {
      state->has_first_hit = true;
      state->first_hit_signalled_at_us = hit->started_at_us;
      if (append_hit(state, hit) != SCORING_CORE_OK) return SCORING_CORE_OVERFLOW;
    } else if (starts_inside_window(hit->started_at_us, state->first_hit_signalled_at_us, EPEE_DOUBLE_HIT_WINDOW_US)) {
      if (append_hit(state, hit) != SCORING_CORE_OK) return SCORING_CORE_OVERFLOW;
    }
  }
  if (state->has_first_hit && sample->at_us - state->first_hit_signalled_at_us > EPEE_DOUBLE_HIT_WINDOW_US) {
    bool pending = false;
    for (side = SCORING_CORE_SIDE_LEFT; side < SCORING_CORE_SIDE_COUNT; side += 1) {
      const scoring_core_side_state_t *side_state = &state->sides[side];
      pending = pending || (side_state->candidate_active && starts_inside_window(
        side_state->candidate_since_us,
        state->first_hit_signalled_at_us,
        EPEE_DOUBLE_HIT_WINDOW_US
      ));
    }
    state->locked = !pending;
  }
  return SCORING_CORE_OK;
}

static bool advance_foil_side(
  scoring_core_state_t *state,
  const scoring_core_sample_t *sample,
  scoring_core_side_t side,
  scoring_core_hit_t *out_hit
) {
  scoring_core_side_state_t *side_state = &state->sides[side];
  const scoring_core_contact_t *contact = contact_for(sample, side);
  const uint8_t classification = contact->target_kind == 0U
    ? SCORING_CORE_CLASSIFICATION_ON_TARGET
    : SCORING_CORE_CLASSIFICATION_OFF_TARGET;

  if (side_state->registered || contact->foil_open == 0U) {
    clear_candidate(side_state);
    return false;
  }
  if (!side_state->candidate_active || side_state->candidate_classification != classification) {
    side_state->candidate_active = true;
    side_state->candidate_classification = classification;
    side_state->candidate_since_us = sample->at_us;
  }
  if (sample->at_us - side_state->candidate_since_us < FOIL_CONTACT_BREAK_MINIMUM_US) {
    return false;
  }
  *out_hit = make_hit(side, classification, side_state->candidate_since_us, sample->at_us);
  side_state->registered = true;
  clear_candidate(side_state);
  return true;
}

static bool update_sabre_blade_history(
  scoring_core_side_state_t *side_state,
  const scoring_core_contact_t *contact,
  uint64_t at_us
) {
  if (!side_state->blade_history_active) {
    if (contact->target_kind == 0U && contact->blade_present != 0U) {
      side_state->blade_history_active = true;
      side_state->last_blade_present = true;
      side_state->blade_interruptions = 0U;
      side_state->blade_started_at_us = at_us;
    }
    return side_state->blade_history_active;
  }
  if (at_us - side_state->blade_started_at_us >= SABRE_BLADE_RECOVERY_US) {
    side_state->blade_history_active = false;
    return false;
  }
  if (side_state->last_blade_present && contact->blade_present == 0U) {
    side_state->blade_interruptions += 1U;
  }
  side_state->last_blade_present = contact->blade_present != 0U;
  return true;
}

static bool advance_sabre_side(
  scoring_core_state_t *state,
  const scoring_core_sample_t *sample,
  scoring_core_side_t side,
  scoring_core_hit_t *out_hit
) {
  scoring_core_side_state_t *side_state = &state->sides[side];
  const scoring_core_contact_t *contact = contact_for(sample, side);
  const bool blade_history = update_sabre_blade_history(side_state, contact, sample->at_us);
  bool ready = contact->target_kind == 0U;

  if (blade_history && sample->at_us - side_state->blade_started_at_us > SABRE_BLADE_REGISTRATION_LATEST_US) {
    ready = false;
  }
  if (contact->control_break != 0U) {
    if (!side_state->control_break_active) {
      side_state->control_break_active = true;
      side_state->control_break_since_us = sample->at_us;
    }
    if (sample->at_us - side_state->control_break_since_us >= SABRE_CONTROL_BREAK_US) {
      side_state->white_on = 1U;
    }
  } else {
    side_state->control_break_active = false;
  }
  if (side_state->registered || !ready) {
    clear_candidate(side_state);
    return false;
  }
  if (!side_state->candidate_active) {
    side_state->candidate_active = true;
    side_state->candidate_since_us = sample->at_us;
  }
  if (sample->at_us - side_state->candidate_since_us < SABRE_MINIMUM_CONTACT_US) {
    return false;
  }
  *out_hit = make_hit(side, SCORING_CORE_CLASSIFICATION_NONE, side_state->candidate_since_us, sample->at_us);
  side_state->registered = true;
  clear_candidate(side_state);
  return true;
}

typedef bool (*advance_side_fn)(
  scoring_core_state_t *,
  const scoring_core_sample_t *,
  scoring_core_side_t,
  scoring_core_hit_t *
);

static scoring_core_status_t advance_latched_weapon(
  scoring_core_state_t *state,
  const scoring_core_sample_t *sample,
  advance_side_fn advance_side,
  uint64_t lockout_us
) {
  scoring_core_hit_t new_hits[SCORING_CORE_SIDE_COUNT];
  size_t new_hit_count = 0U;
  scoring_core_side_t side;

  if (state->locked || (state->has_first_hit && sample->at_us >= state->lockout_ends_at_us)) {
    state->locked = true;
    clear_candidate(&state->sides[SCORING_CORE_SIDE_LEFT]);
    clear_candidate(&state->sides[SCORING_CORE_SIDE_RIGHT]);
    return SCORING_CORE_OK;
  }
  for (side = SCORING_CORE_SIDE_LEFT; side < SCORING_CORE_SIDE_COUNT; side += 1) {
    scoring_core_hit_t hit;
    if (advance_side(state, sample, side, &hit)) {
      new_hits[new_hit_count] = hit;
      new_hit_count += 1U;
    }
  }
  if (new_hit_count == 2U && !hit_precedes(&new_hits[0], &new_hits[1])) {
    const scoring_core_hit_t swap = new_hits[0];
    new_hits[0] = new_hits[1];
    new_hits[1] = swap;
  }
  for (size_t index = 0U; index < new_hit_count; index += 1U) {
    if (append_hit(state, &new_hits[index]) != SCORING_CORE_OK) return SCORING_CORE_OVERFLOW;
  }
  if (!state->has_first_hit && new_hit_count > 0U) {
    if (UINT64_MAX - new_hits[0].qualified_at_us < lockout_us) return SCORING_CORE_OVERFLOW;
    state->has_first_hit = true;
    state->first_hit_signalled_at_us = new_hits[0].qualified_at_us;
    state->lockout_ends_at_us = state->first_hit_signalled_at_us + lockout_us;
  }
  return SCORING_CORE_OK;
}

scoring_core_status_t scoring_core_init(scoring_core_state_t *state, scoring_core_weapon_t weapon) {
  if (state == NULL || !weapon_is_valid(weapon)) return SCORING_CORE_INVALID_ARGUMENT;
  memset(state, 0, sizeof(*state));
  state->weapon = weapon;
  return SCORING_CORE_OK;
}

scoring_core_status_t scoring_core_advance(scoring_core_state_t *state, const scoring_core_sample_t *sample) {
  scoring_core_state_t next;
  scoring_core_status_t status;
  if (state == NULL || sample == NULL || !weapon_is_valid(state->weapon)) {
    return SCORING_CORE_INVALID_ARGUMENT;
  }
  if (!contact_is_normalized(&sample->left) || !contact_is_normalized(&sample->right)) {
    return SCORING_CORE_INVALID_ARGUMENT;
  }
  if (state->has_last_sample && sample->at_us < state->last_sample_at_us) return SCORING_CORE_NON_MONOTONIC;

  next = *state;

  if (next.weapon == SCORING_CORE_WEAPON_EPEE) {
    status = advance_epee(&next, sample);
  } else if (next.weapon == SCORING_CORE_WEAPON_FOIL) {
    status = advance_latched_weapon(&next, sample, advance_foil_side, FOIL_LOCKOUT_US);
  } else {
    status = advance_latched_weapon(&next, sample, advance_sabre_side, SABRE_LOCKOUT_US);
  }
  if (status != SCORING_CORE_OK) return status;
  next.has_last_sample = true;
  next.last_sample_at_us = sample->at_us;
  *state = next;
  return status;
}

void scoring_core_diagnostics(
  const scoring_core_state_t *state,
  scoring_core_diagnostic_t out_diagnostics[SCORING_CORE_SIDE_COUNT]
) {
  size_t side;
  if (state == NULL || out_diagnostics == NULL) return;
  for (side = 0U; side < SCORING_CORE_SIDE_COUNT; side += 1U) {
    out_diagnostics[side].side = (uint8_t)side;
    out_diagnostics[side].white_on = state->weapon == SCORING_CORE_WEAPON_SABRE
      ? state->sides[side].white_on
      : 0U;
  }
}

scoring_core_status_t scoring_core_make_record(
  const scoring_core_state_t *state,
  size_t hit_index,
  const scoring_core_record_context_t *context,
  scoring_core_decision_record_t *out_record
) {
  const scoring_core_hit_t *hit;
  if (
    state == NULL || context == NULL || out_record == NULL || state->hit_count > SCORING_CORE_MAX_HITS ||
    hit_index >= state->hit_count ||
    context->record_id == NULL || context->record_id[0] == '\0' || context->capture_id == NULL ||
    context->capture_id[0] == '\0' || !is_sha256_digest(context->capture_digest) ||
    !is_sha256_digest(context->firmware_digest) ||
    context->scoring_boot_id == NULL || context->scoring_boot_id[0] == '\0' || context->sample_count == 0U ||
    context->first_sequence > context->last_sequence || context->capture_from_us > context->capture_through_us
  ) {
    return SCORING_CORE_INVALID_ARGUMENT;
  }
  hit = &state->hits[hit_index];
  *out_record = (scoring_core_decision_record_t) {
    .schema_version = 1U,
    .record_id = context->record_id,
    .decision_at_us = hit->qualified_at_us,
    .capture_from_us = context->capture_from_us,
    .capture_through_us = context->capture_through_us,
    .first_sequence = context->first_sequence,
    .last_sequence = context->last_sequence,
    .firmware_identity = "stm32-scoring-core",
    .firmware_digest = context->firmware_digest,
    .scoring_boot_id = context->scoring_boot_id,
    .hardware_revision = "host-golden",
    .rule_set_revision = "rules-1",
    .timing_table_revision = "timing-1",
    .line_contract_revision = "lines-1",
    .calibration_profile_revision = "calibration-1",
    .capture_id = context->capture_id,
    .capture_digest = context->capture_digest,
    .capture_format_revision = "golden-vector-1",
    .capture_sample_count = context->sample_count,
    .raw_capture_ref_count = 1U,
    .capture_kind = 0U,
    .raw_capture_from_us = context->capture_from_us,
    .raw_capture_through_us = context->capture_through_us,
    .raw_capture_first_sequence = context->first_sequence,
    .raw_capture_last_sequence = context->last_sequence,
    .weapon = (uint8_t)state->weapon,
    .side = hit->side,
    .disposition = hit->classification == SCORING_CORE_CLASSIFICATION_OFF_TARGET
      ? SCORING_CORE_RECORD_OFF_TARGET
      : SCORING_CORE_RECORD_QUALIFIED_HIT,
    .visual = hit->classification == SCORING_CORE_CLASSIFICATION_OFF_TARGET
      ? SCORING_CORE_VISUAL_OFF_TARGET
      : SCORING_CORE_VISUAL_VALID_HIT,
    .audible = 1U,
    .latched = 1U,
    .hit_started_at_us = hit->started_at_us,
    .qualified_at_us = hit->qualified_at_us
  };
  return SCORING_CORE_OK;
}
