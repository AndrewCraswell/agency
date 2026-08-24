#include "stm32_scoring_core.h"
#include "stm32_golden_vectors.h"

#include <stdio.h>
#include <stdlib.h>
#include <string.h>

#define CHECK(expression) \
  do { \
    if (!(expression)) { \
      (void)fprintf(stderr, "check failed: %s at %s:%d\n", #expression, __FILE__, __LINE__); \
      exit(EXIT_FAILURE); \
    } \
  } while (0)

static void check_hit(const scoring_core_hit_t *actual, const scoring_core_hit_t *expected) {
  CHECK(actual->side == expected->side);
  CHECK(actual->classification == expected->classification);
  CHECK(actual->started_at_us == expected->started_at_us);
  CHECK(actual->qualified_at_us == expected->qualified_at_us);
}

static void check_record(
  const scoring_core_decision_record_t *actual,
  const scoring_core_decision_record_t *expected
) {
  CHECK(actual->schema_version == expected->schema_version);
  CHECK(strcmp(actual->record_id, expected->record_id) == 0);
  CHECK(actual->decision_at_us == expected->decision_at_us);
  CHECK(actual->capture_from_us == expected->capture_from_us);
  CHECK(actual->capture_through_us == expected->capture_through_us);
  CHECK(actual->first_sequence == expected->first_sequence);
  CHECK(actual->last_sequence == expected->last_sequence);
  CHECK(strcmp(actual->firmware_identity, expected->firmware_identity) == 0);
  CHECK(strcmp(actual->firmware_digest, expected->firmware_digest) == 0);
  CHECK(strcmp(actual->scoring_boot_id, expected->scoring_boot_id) == 0);
  CHECK(strcmp(actual->hardware_revision, expected->hardware_revision) == 0);
  CHECK(strcmp(actual->rule_set_revision, expected->rule_set_revision) == 0);
  CHECK(strcmp(actual->timing_table_revision, expected->timing_table_revision) == 0);
  CHECK(strcmp(actual->line_contract_revision, expected->line_contract_revision) == 0);
  CHECK(strcmp(actual->calibration_profile_revision, expected->calibration_profile_revision) == 0);
  CHECK(strcmp(actual->capture_id, expected->capture_id) == 0);
  CHECK(strcmp(actual->capture_digest, expected->capture_digest) == 0);
  CHECK(strcmp(actual->capture_format_revision, expected->capture_format_revision) == 0);
  CHECK(actual->capture_sample_count == expected->capture_sample_count);
  CHECK(actual->raw_capture_ref_count == expected->raw_capture_ref_count);
  CHECK(actual->capture_kind == expected->capture_kind);
  CHECK(actual->raw_capture_from_us == expected->raw_capture_from_us);
  CHECK(actual->raw_capture_through_us == expected->raw_capture_through_us);
  CHECK(actual->raw_capture_first_sequence == expected->raw_capture_first_sequence);
  CHECK(actual->raw_capture_last_sequence == expected->raw_capture_last_sequence);
  CHECK(actual->weapon == expected->weapon);
  CHECK(actual->side == expected->side);
  CHECK(actual->disposition == expected->disposition);
  CHECK(actual->visual == expected->visual);
  CHECK(actual->audible == expected->audible);
  CHECK(actual->latched == expected->latched);
  CHECK(actual->hit_started_at_us == expected->hit_started_at_us);
  CHECK(actual->qualified_at_us == expected->qualified_at_us);
}

static void test_complete_golden_corpus(void) {
  size_t vector_index;

  for (vector_index = 0U; vector_index < SCORING_GOLDEN_VECTOR_COUNT; vector_index += 1U) {
    const scoring_golden_vector_fixture_t *fixture = &SCORING_GOLDEN_VECTORS[vector_index];
    scoring_core_state_t state;
    scoring_core_diagnostic_t diagnostics[SCORING_CORE_SIDE_COUNT];
    size_t index;

    CHECK(scoring_core_init(&state, (scoring_core_weapon_t)fixture->weapon) == SCORING_CORE_OK);
    for (index = 0U; index < fixture->stimulus_sample_count; index += 1U) {
      CHECK(scoring_core_advance(&state, &fixture->samples[index]) == SCORING_CORE_OK);
    }

    CHECK(state.hit_count == fixture->hit_count);
    for (index = 0U; index < state.hit_count; index += 1U) {
      scoring_core_decision_record_t record;
      check_hit(&state.hits[index], &fixture->hits[index]);
      CHECK(scoring_core_make_record(&state, index, &fixture->record_contexts[index], &record) == SCORING_CORE_OK);
      check_record(&record, &fixture->records[index]);
    }
    scoring_core_diagnostics(&state, diagnostics);
    CHECK(fixture->diagnostic_count == (fixture->weapon == SCORING_CORE_WEAPON_SABRE ? 2U : 0U));
    for (index = 0U; index < fixture->diagnostic_count; index += 1U) {
      CHECK(diagnostics[index].side == fixture->diagnostics[index].side);
      CHECK(diagnostics[index].white_on == fixture->diagnostics[index].white_on);
    }
  }
}

static void test_fail_closed_api(void) {
  scoring_core_state_t state;
  scoring_core_sample_t sample = { 0 };
  scoring_core_diagnostic_t diagnostics[SCORING_CORE_SIDE_COUNT] = { 0 };
  scoring_core_decision_record_t record;
  scoring_core_record_context_t context = {
    .record_id = "record",
    .capture_id = "capture",
    .capture_digest = "sha256:test",
    .firmware_digest = "sha256:test",
    .scoring_boot_id = "boot",
    .last_sequence = 1U,
    .capture_through_us = 1U,
    .sample_count = 1U
  };

  CHECK(scoring_core_init(NULL, SCORING_CORE_WEAPON_EPEE) == SCORING_CORE_INVALID_ARGUMENT);
  CHECK(scoring_core_init(&state, (scoring_core_weapon_t)99) == SCORING_CORE_INVALID_ARGUMENT);
  CHECK(scoring_core_init(&state, SCORING_CORE_WEAPON_EPEE) == SCORING_CORE_OK);
  CHECK(scoring_core_advance(NULL, &sample) == SCORING_CORE_INVALID_ARGUMENT);
  CHECK(scoring_core_advance(&state, NULL) == SCORING_CORE_INVALID_ARGUMENT);
  sample.left.target_kind = 2U;
  CHECK(scoring_core_advance(&state, &sample) == SCORING_CORE_INVALID_ARGUMENT);
  sample.left.target_kind = 0U;
  CHECK(scoring_core_advance(&state, &sample) == SCORING_CORE_OK);
  sample.at_us = 1U;
  CHECK(scoring_core_advance(&state, &sample) == SCORING_CORE_OK);
  sample.at_us = 0U;
  CHECK(scoring_core_advance(&state, &sample) == SCORING_CORE_NON_MONOTONIC);
  scoring_core_diagnostics(NULL, diagnostics);
  scoring_core_diagnostics(&state, NULL);
  CHECK(scoring_core_make_record(&state, 0U, &context, &record) == SCORING_CORE_INVALID_ARGUMENT);
  CHECK(scoring_core_make_record(NULL, 0U, &context, &record) == SCORING_CORE_INVALID_ARGUMENT);
}

static void test_overflow_is_atomic(void) {
  scoring_core_state_t state;
  scoring_core_state_t before_overflow;
  scoring_core_sample_t sample = {
    .at_us = UINT64_MAX - 13000U,
    .left = { .foil_open = 1U },
    .right = { 0 }
  };

  CHECK(scoring_core_init(&state, SCORING_CORE_WEAPON_FOIL) == SCORING_CORE_OK);
  CHECK(scoring_core_advance(&state, &sample) == SCORING_CORE_OK);
  before_overflow = state;
  sample.at_us = UINT64_MAX;
  CHECK(scoring_core_advance(&state, &sample) == SCORING_CORE_OVERFLOW);
  CHECK(memcmp(&state, &before_overflow, sizeof(state)) == 0);
}

static void test_simultaneous_hits_are_sorted(void) {
  scoring_core_state_t state;
  scoring_core_sample_t sample = { 0 };

  /* The right candidate starts first, so the sort branch must swap the two hits. */
  CHECK(scoring_core_init(&state, SCORING_CORE_WEAPON_EPEE) == SCORING_CORE_OK);
  sample.right.epee_closed = 1U;
  CHECK(scoring_core_advance(&state, &sample) == SCORING_CORE_OK);
  sample.at_us = 1U;
  sample.left.epee_closed = 1U;
  CHECK(scoring_core_advance(&state, &sample) == SCORING_CORE_OK);
  sample.at_us = 2001U;
  CHECK(scoring_core_advance(&state, &sample) == SCORING_CORE_OK);
  CHECK(state.hit_count == 2U);
  CHECK(state.hits[0].side == SCORING_CORE_SIDE_RIGHT);
  CHECK(state.hits[1].side == SCORING_CORE_SIDE_LEFT);

  /* Equal starts exercise the equal-time side ordering branch. */
  CHECK(scoring_core_init(&state, SCORING_CORE_WEAPON_EPEE) == SCORING_CORE_OK);
  sample = (scoring_core_sample_t) { .left = { .epee_closed = 1U }, .right = { .epee_closed = 1U } };
  CHECK(scoring_core_advance(&state, &sample) == SCORING_CORE_OK);
  sample.at_us = 2000U;
  CHECK(scoring_core_advance(&state, &sample) == SCORING_CORE_OK);
  CHECK(state.hit_count == 2U);
  CHECK(state.hits[0].side == SCORING_CORE_SIDE_LEFT);
  CHECK(state.hits[1].side == SCORING_CORE_SIDE_RIGHT);

  CHECK(scoring_core_init(&state, SCORING_CORE_WEAPON_EPEE) == SCORING_CORE_OK);
  sample = (scoring_core_sample_t) { .left = { .epee_closed = 1U } };
  CHECK(scoring_core_advance(&state, &sample) == SCORING_CORE_OK);
  sample.at_us = 1U;
  sample.right.epee_closed = 1U;
  CHECK(scoring_core_advance(&state, &sample) == SCORING_CORE_OK);
  sample.at_us = 2001U;
  CHECK(scoring_core_advance(&state, &sample) == SCORING_CORE_OK);
  CHECK(state.hit_count == 2U);
  CHECK(state.hits[0].side == SCORING_CORE_SIDE_LEFT);
  CHECK(state.hits[1].side == SCORING_CORE_SIDE_RIGHT);

  /* The same ordering contract applies to foil and sabre. */
  CHECK(scoring_core_init(&state, SCORING_CORE_WEAPON_FOIL) == SCORING_CORE_OK);
  sample = (scoring_core_sample_t) { .right = { .foil_open = 1U } };
  CHECK(scoring_core_advance(&state, &sample) == SCORING_CORE_OK);
  sample.at_us = 1U;
  sample.left.foil_open = 1U;
  CHECK(scoring_core_advance(&state, &sample) == SCORING_CORE_OK);
  sample.at_us = 13001U;
  CHECK(scoring_core_advance(&state, &sample) == SCORING_CORE_OK);
  CHECK(state.hit_count == 2U);
  CHECK(state.hits[0].side == SCORING_CORE_SIDE_RIGHT);
  CHECK(state.hits[1].side == SCORING_CORE_SIDE_LEFT);

  CHECK(scoring_core_init(&state, SCORING_CORE_WEAPON_SABRE) == SCORING_CORE_OK);
  sample = (scoring_core_sample_t) {
    .at_us = 0U,
    .left = { .target_kind = 1U },
    .right = { .blade_present = 1U }
  };
  CHECK(scoring_core_advance(&state, &sample) == SCORING_CORE_OK);
  sample.at_us = 1U;
  sample.left = (scoring_core_contact_t) { .blade_present = 1U };
  CHECK(scoring_core_advance(&state, &sample) == SCORING_CORE_OK);
  sample.at_us = 101U;
  CHECK(scoring_core_advance(&state, &sample) == SCORING_CORE_OK);
  CHECK(state.hit_count == 2U);
  CHECK(state.hits[0].side == SCORING_CORE_SIDE_RIGHT);
  CHECK(state.hits[1].side == SCORING_CORE_SIDE_LEFT);

  CHECK(scoring_core_init(&state, SCORING_CORE_WEAPON_FOIL) == SCORING_CORE_OK);
  sample = (scoring_core_sample_t) { .left = { .foil_open = 1U } };
  CHECK(scoring_core_advance(&state, &sample) == SCORING_CORE_OK);
  sample.at_us = 1U;
  sample.right.foil_open = 1U;
  CHECK(scoring_core_advance(&state, &sample) == SCORING_CORE_OK);
  sample.at_us = 13001U;
  CHECK(scoring_core_advance(&state, &sample) == SCORING_CORE_OK);
  CHECK(state.hit_count == 2U);
  CHECK(state.hits[0].side == SCORING_CORE_SIDE_LEFT);
  CHECK(state.hits[1].side == SCORING_CORE_SIDE_RIGHT);

  CHECK(scoring_core_init(&state, SCORING_CORE_WEAPON_SABRE) == SCORING_CORE_OK);
  sample = (scoring_core_sample_t) { .left = { .blade_present = 1U } };
  CHECK(scoring_core_advance(&state, &sample) == SCORING_CORE_OK);
  sample.at_us = 1U;
  sample.left.blade_present = 0U;
  CHECK(scoring_core_advance(&state, &sample) == SCORING_CORE_OK);
  sample.at_us = 2U;
  CHECK(scoring_core_advance(&state, &sample) == SCORING_CORE_OK);
}

static void test_epee_window_and_append_overflow(void) {
  scoring_core_state_t state;
  scoring_core_state_t before_overflow;
  scoring_core_sample_t sample = { 0 };

  /* A pending candidate may have started before the first accepted hit. */
  CHECK(scoring_core_init(&state, SCORING_CORE_WEAPON_EPEE) == SCORING_CORE_OK);
  state.has_first_hit = true;
  state.first_hit_signalled_at_us = 1000U;
  state.sides[SCORING_CORE_SIDE_LEFT].candidate_active = true;
  state.sides[SCORING_CORE_SIDE_LEFT].candidate_since_us = 0U;
  sample.at_us = 2000U;
  sample.left.epee_closed = 1U;
  CHECK(scoring_core_advance(&state, &sample) == SCORING_CORE_OK);
  CHECK(state.hit_count == 1U);
  CHECK(state.hits[0].started_at_us == 0U);

  /* A hit that starts outside the double-hit window is deliberately discarded. */
  CHECK(scoring_core_init(&state, SCORING_CORE_WEAPON_EPEE) == SCORING_CORE_OK);
  sample = (scoring_core_sample_t) { .left = { .epee_closed = 1U } };
  CHECK(scoring_core_advance(&state, &sample) == SCORING_CORE_OK);
  sample.at_us = 2000U;
  CHECK(scoring_core_advance(&state, &sample) == SCORING_CORE_OK);
  sample.at_us = 47000U;
  sample.left.epee_closed = 0U;
  sample.right.epee_closed = 1U;
  CHECK(scoring_core_advance(&state, &sample) == SCORING_CORE_OK);
  sample.at_us = 49000U;
  CHECK(scoring_core_advance(&state, &sample) == SCORING_CORE_OK);
  CHECK(state.hit_count == 1U);
  CHECK(state.locked);

  state.locked = false;
  state.sides[SCORING_CORE_SIDE_RIGHT].candidate_active = true;
  state.sides[SCORING_CORE_SIDE_RIGHT].candidate_since_us = 46000U;
  sample.at_us = 50000U;
  sample.left.epee_closed = 0U;
  sample.right.epee_closed = 1U;
  CHECK(scoring_core_advance(&state, &sample) == SCORING_CORE_OK);
  CHECK(state.hit_count == 1U);
  CHECK(state.locked);

  /* The first pending side makes the second pending test short-circuit. */
  CHECK(scoring_core_init(&state, SCORING_CORE_WEAPON_EPEE) == SCORING_CORE_OK);
  state.has_first_hit = true;
  state.first_hit_signalled_at_us = 1U;
  state.sides[SCORING_CORE_SIDE_LEFT].candidate_active = true;
  state.sides[SCORING_CORE_SIDE_LEFT].candidate_since_us = 0U;
  sample = (scoring_core_sample_t) { .at_us = 0U, .left = { .epee_closed = 1U } };
  CHECK(scoring_core_advance(&state, &sample) == SCORING_CORE_OK);
  CHECK(!state.locked);

  CHECK(scoring_core_init(&state, SCORING_CORE_WEAPON_EPEE) == SCORING_CORE_OK);
  state.hit_count = SCORING_CORE_MAX_HITS;
  state.sides[SCORING_CORE_SIDE_LEFT].candidate_active = true;
  sample.at_us = 2000U;
  sample.left.epee_closed = 1U;
  before_overflow = state;
  CHECK(scoring_core_advance(&state, &sample) == SCORING_CORE_OVERFLOW);
  CHECK(memcmp(&state, &before_overflow, sizeof(state)) == 0);

  CHECK(scoring_core_init(&state, SCORING_CORE_WEAPON_EPEE) == SCORING_CORE_OK);
  state.hit_count = SCORING_CORE_MAX_HITS;
  state.has_first_hit = true;
  state.first_hit_signalled_at_us = 0U;
  state.sides[SCORING_CORE_SIDE_LEFT].candidate_active = true;
  sample.at_us = 2000U;
  sample.left.epee_closed = 1U;
  before_overflow = state;
  CHECK(scoring_core_advance(&state, &sample) == SCORING_CORE_OVERFLOW);
  CHECK(memcmp(&state, &before_overflow, sizeof(state)) == 0);
}

static void test_latched_lock_and_append_overflow(void) {
  scoring_core_state_t state;
  scoring_core_state_t before_overflow;
  scoring_core_sample_t sample = { 0 };

  CHECK(scoring_core_init(&state, SCORING_CORE_WEAPON_FOIL) == SCORING_CORE_OK);
  state.locked = true;
  state.sides[SCORING_CORE_SIDE_LEFT].candidate_active = true;
  sample.left.foil_open = 1U;
  CHECK(scoring_core_advance(&state, &sample) == SCORING_CORE_OK);
  CHECK(state.locked);
  CHECK(!state.sides[SCORING_CORE_SIDE_LEFT].candidate_active);

  CHECK(scoring_core_init(&state, SCORING_CORE_WEAPON_FOIL) == SCORING_CORE_OK);
  state.has_first_hit = true;
  state.lockout_ends_at_us = 100U;
  state.sides[SCORING_CORE_SIDE_LEFT].candidate_active = true;
  sample.at_us = 100U;
  sample.left.foil_open = 1U;
  CHECK(scoring_core_advance(&state, &sample) == SCORING_CORE_OK);
  CHECK(state.locked);
  CHECK(!state.sides[SCORING_CORE_SIDE_LEFT].candidate_active);

  CHECK(scoring_core_init(&state, SCORING_CORE_WEAPON_FOIL) == SCORING_CORE_OK);
  state.hit_count = SCORING_CORE_MAX_HITS;
  state.sides[SCORING_CORE_SIDE_LEFT].candidate_active = true;
  state.sides[SCORING_CORE_SIDE_LEFT].candidate_classification = SCORING_CORE_CLASSIFICATION_ON_TARGET;
  sample = (scoring_core_sample_t) { .at_us = 13000U, .left = { .foil_open = 1U } };
  before_overflow = state;
  CHECK(scoring_core_advance(&state, &sample) == SCORING_CORE_OVERFLOW);
  CHECK(memcmp(&state, &before_overflow, sizeof(state)) == 0);
}

static void test_foil_off_target_and_reclassification(void) {
  scoring_core_state_t state;
  scoring_core_sample_t sample = { 0 };
  scoring_core_decision_record_t record;
  char digest[] = "sha256:0000000000000000000000000000000000000000000000000000000000000000";
  scoring_core_record_context_t context = {
    .record_id = "record",
    .capture_id = "capture",
    .capture_digest = digest,
    .firmware_digest = digest,
    .scoring_boot_id = "boot",
    .first_sequence = 1U,
    .last_sequence = 1U,
    .capture_from_us = 0U,
    .capture_through_us = 1U,
    .sample_count = 1U
  };

  CHECK(scoring_core_init(&state, SCORING_CORE_WEAPON_FOIL) == SCORING_CORE_OK);
  sample.left.foil_open = 1U;
  CHECK(scoring_core_advance(&state, &sample) == SCORING_CORE_OK);
  sample.at_us = 1U;
  sample.left.target_kind = 1U;
  CHECK(scoring_core_advance(&state, &sample) == SCORING_CORE_OK);
  sample.at_us = 13001U;
  CHECK(scoring_core_advance(&state, &sample) == SCORING_CORE_OK);
  CHECK(state.hit_count == 1U);
  CHECK(state.hits[0].classification == SCORING_CORE_CLASSIFICATION_OFF_TARGET);
  CHECK(scoring_core_make_record(&state, 0U, &context, &record) == SCORING_CORE_OK);
  CHECK(record.disposition == SCORING_CORE_RECORD_OFF_TARGET);
  CHECK(record.visual == SCORING_CORE_VISUAL_OFF_TARGET);
}

static void make_valid_record_state(scoring_core_state_t *state) {
  scoring_core_sample_t sample = { .left = { .epee_closed = 1U } };
  CHECK(scoring_core_init(state, SCORING_CORE_WEAPON_EPEE) == SCORING_CORE_OK);
  CHECK(scoring_core_advance(state, &sample) == SCORING_CORE_OK);
  sample.at_us = 2000U;
  CHECK(scoring_core_advance(state, &sample) == SCORING_CORE_OK);
}

static void test_record_validation_branches(void) {
  scoring_core_state_t state;
  scoring_core_decision_record_t record;
  unsigned char record_before[sizeof(record)];
  char capture_digest[] = "sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
  char firmware_digest[] = "sha256:0000000000000000000000000000000000000000000000000000000000000000";
  char invalid_slash[] = "sha256:/000000000000000000000000000000000000000000000000000000000000000";
  char invalid_g[] = "sha256:g000000000000000000000000000000000000000000000000000000000000000";
  char too_long[] = "sha256:00000000000000000000000000000000000000000000000000000000000000000";
  scoring_core_record_context_t context = {
    .record_id = "record",
    .capture_id = "capture",
    .capture_digest = capture_digest,
    .firmware_digest = firmware_digest,
    .scoring_boot_id = "boot",
    .first_sequence = 1U,
    .last_sequence = 1U,
    .capture_from_us = 0U,
    .capture_through_us = 1U,
    .sample_count = 1U
  };

  make_valid_record_state(&state);
  CHECK(scoring_core_make_record(&state, 0U, NULL, &record) == SCORING_CORE_INVALID_ARGUMENT);
  CHECK(scoring_core_make_record(&state, 0U, &context, NULL) == SCORING_CORE_INVALID_ARGUMENT);

  state.hit_count = SCORING_CORE_MAX_HITS + 1U;
  (void)memset(&record, 0xA5, sizeof(record));
  (void)memcpy(record_before, &record, sizeof(record));
  CHECK(scoring_core_make_record(&state, 0U, &context, &record) == SCORING_CORE_INVALID_ARGUMENT);
  CHECK(memcmp(record_before, &record, sizeof(record)) == 0);
  state.hit_count = 1U;

  CHECK(scoring_core_make_record(&state, 1U, &context, &record) == SCORING_CORE_INVALID_ARGUMENT);
  context.record_id = NULL;
  CHECK(scoring_core_make_record(&state, 0U, &context, &record) == SCORING_CORE_INVALID_ARGUMENT);
  context.record_id = "";
  CHECK(scoring_core_make_record(&state, 0U, &context, &record) == SCORING_CORE_INVALID_ARGUMENT);
  context.record_id = "record";
  context.capture_id = NULL;
  CHECK(scoring_core_make_record(&state, 0U, &context, &record) == SCORING_CORE_INVALID_ARGUMENT);
  context.capture_id = "";
  CHECK(scoring_core_make_record(&state, 0U, &context, &record) == SCORING_CORE_INVALID_ARGUMENT);
  context.capture_id = "capture";

  context.capture_digest = NULL;
  CHECK(scoring_core_make_record(&state, 0U, &context, &record) == SCORING_CORE_INVALID_ARGUMENT);
  context.capture_digest = "bad";
  CHECK(scoring_core_make_record(&state, 0U, &context, &record) == SCORING_CORE_INVALID_ARGUMENT);
  context.capture_digest = invalid_slash;
  CHECK(scoring_core_make_record(&state, 0U, &context, &record) == SCORING_CORE_INVALID_ARGUMENT);
  context.capture_digest = invalid_g;
  CHECK(scoring_core_make_record(&state, 0U, &context, &record) == SCORING_CORE_INVALID_ARGUMENT);
  context.capture_digest = too_long;
  CHECK(scoring_core_make_record(&state, 0U, &context, &record) == SCORING_CORE_INVALID_ARGUMENT);
  context.capture_digest = capture_digest;

  context.firmware_digest = NULL;
  CHECK(scoring_core_make_record(&state, 0U, &context, &record) == SCORING_CORE_INVALID_ARGUMENT);
  context.firmware_digest = firmware_digest;
  context.scoring_boot_id = NULL;
  CHECK(scoring_core_make_record(&state, 0U, &context, &record) == SCORING_CORE_INVALID_ARGUMENT);
  context.scoring_boot_id = "";
  CHECK(scoring_core_make_record(&state, 0U, &context, &record) == SCORING_CORE_INVALID_ARGUMENT);
  context.scoring_boot_id = "boot";
  context.sample_count = 0U;
  CHECK(scoring_core_make_record(&state, 0U, &context, &record) == SCORING_CORE_INVALID_ARGUMENT);
  context.sample_count = 1U;
  context.first_sequence = 2U;
  context.last_sequence = 1U;
  CHECK(scoring_core_make_record(&state, 0U, &context, &record) == SCORING_CORE_INVALID_ARGUMENT);
  context.first_sequence = 1U;
  context.capture_from_us = 2U;
  context.capture_through_us = 1U;
  CHECK(scoring_core_make_record(&state, 0U, &context, &record) == SCORING_CORE_INVALID_ARGUMENT);
}

static void test_advance_argument_branches(void) {
  scoring_core_state_t state;
  scoring_core_sample_t sample = { 0 };

  CHECK(scoring_core_init(&state, SCORING_CORE_WEAPON_EPEE) == SCORING_CORE_OK);
  state.weapon = (scoring_core_weapon_t)99;
  CHECK(scoring_core_advance(&state, &sample) == SCORING_CORE_INVALID_ARGUMENT);

  CHECK(scoring_core_init(&state, SCORING_CORE_WEAPON_EPEE) == SCORING_CORE_OK);
  sample.left.epee_closed = 2U;
  CHECK(scoring_core_advance(&state, &sample) == SCORING_CORE_INVALID_ARGUMENT);
  sample.left = (scoring_core_contact_t) { 0 };
  sample.left.foil_open = 2U;
  CHECK(scoring_core_advance(&state, &sample) == SCORING_CORE_INVALID_ARGUMENT);
  sample.left.foil_open = 0U;
  sample.left.blade_present = 2U;
  CHECK(scoring_core_advance(&state, &sample) == SCORING_CORE_INVALID_ARGUMENT);
  sample.left.blade_present = 0U;
  sample.left.control_break = 2U;
  CHECK(scoring_core_advance(&state, &sample) == SCORING_CORE_INVALID_ARGUMENT);
  sample.left.control_break = 0U;
  sample.right.epee_closed = 2U;
  CHECK(scoring_core_advance(&state, &sample) == SCORING_CORE_INVALID_ARGUMENT);
}

int main(void) {
  test_complete_golden_corpus();
  test_fail_closed_api();
  test_overflow_is_atomic();
  test_simultaneous_hits_are_sorted();
  test_epee_window_and_append_overflow();
  test_latched_lock_and_append_overflow();
  test_foil_off_target_and_reclassification();
  test_record_validation_branches();
  test_advance_argument_branches();
  return EXIT_SUCCESS;
}
