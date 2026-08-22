#ifndef STM32_SCORING_CORE_H
#define STM32_SCORING_CORE_H

#include <stdbool.h>
#include <stddef.h>
#include <stdint.h>

#define SCORING_CORE_MAX_SAMPLES_PER_VECTOR 4U
#define SCORING_CORE_MAX_HITS 2U
#define SCORING_CORE_SIDE_COUNT 2U

typedef enum scoring_core_weapon {
  SCORING_CORE_WEAPON_EPEE = 0,
  SCORING_CORE_WEAPON_FOIL = 1,
  SCORING_CORE_WEAPON_SABRE = 2
} scoring_core_weapon_t;

typedef enum scoring_core_side {
  SCORING_CORE_SIDE_LEFT = 0,
  SCORING_CORE_SIDE_RIGHT = 1
} scoring_core_side_t;

typedef enum scoring_core_classification {
  SCORING_CORE_CLASSIFICATION_NONE = 0,
  SCORING_CORE_CLASSIFICATION_ON_TARGET = 1,
  SCORING_CORE_CLASSIFICATION_OFF_TARGET = 2
} scoring_core_classification_t;

typedef enum scoring_core_record_disposition {
  SCORING_CORE_RECORD_QUALIFIED_HIT = 0,
  SCORING_CORE_RECORD_OFF_TARGET = 1
} scoring_core_record_disposition_t;

typedef enum scoring_core_record_visual {
  SCORING_CORE_VISUAL_VALID_HIT = 0,
  SCORING_CORE_VISUAL_OFF_TARGET = 1
} scoring_core_record_visual_t;

typedef struct scoring_core_contact {
  uint8_t epee_closed;
  uint8_t foil_open;
  uint8_t target_kind;
  uint8_t blade_present;
  uint8_t control_break;
} scoring_core_contact_t;

typedef struct scoring_core_sample {
  uint64_t at_us;
  scoring_core_contact_t left;
  scoring_core_contact_t right;
} scoring_core_sample_t;

typedef struct scoring_core_hit {
  uint8_t side;
  uint8_t classification;
  uint64_t started_at_us;
  uint64_t qualified_at_us;
} scoring_core_hit_t;

typedef struct scoring_core_diagnostic {
  uint8_t side;
  uint8_t white_on;
} scoring_core_diagnostic_t;

typedef struct scoring_core_record_context {
  const char *record_id;
  const char *capture_id;
  const char *capture_digest;
  const char *firmware_digest;
  const char *scoring_boot_id;
  uint32_t first_sequence;
  uint32_t last_sequence;
  uint64_t capture_from_us;
  uint64_t capture_through_us;
  uint32_t sample_count;
} scoring_core_record_context_t;

typedef struct scoring_core_decision_record {
  uint8_t schema_version;
  const char *record_id;
  uint64_t decision_at_us;
  uint64_t capture_from_us;
  uint64_t capture_through_us;
  uint32_t first_sequence;
  uint32_t last_sequence;
  const char *firmware_identity;
  const char *firmware_digest;
  const char *scoring_boot_id;
  const char *hardware_revision;
  const char *rule_set_revision;
  const char *timing_table_revision;
  const char *line_contract_revision;
  const char *calibration_profile_revision;
  const char *capture_id;
  const char *capture_digest;
  const char *capture_format_revision;
  uint32_t capture_sample_count;
  uint8_t raw_capture_ref_count;
  uint8_t capture_kind;
  uint64_t raw_capture_from_us;
  uint64_t raw_capture_through_us;
  uint32_t raw_capture_first_sequence;
  uint32_t raw_capture_last_sequence;
  uint8_t weapon;
  uint8_t side;
  uint8_t disposition;
  uint8_t visual;
  uint8_t audible;
  uint8_t latched;
  uint64_t hit_started_at_us;
  uint64_t qualified_at_us;
} scoring_core_decision_record_t;

typedef struct scoring_core_side_state {
  bool candidate_active;
  bool registered;
  bool blade_history_active;
  bool last_blade_present;
  bool control_break_active;
  uint8_t candidate_classification;
  uint8_t blade_interruptions;
  uint64_t candidate_since_us;
  uint64_t blade_started_at_us;
  uint64_t control_break_since_us;
  uint8_t white_on;
} scoring_core_side_state_t;

typedef struct scoring_core_state {
  scoring_core_weapon_t weapon;
  bool has_last_sample;
  bool has_first_hit;
  bool locked;
  uint64_t last_sample_at_us;
  uint64_t first_hit_signalled_at_us;
  uint64_t lockout_ends_at_us;
  scoring_core_side_state_t sides[SCORING_CORE_SIDE_COUNT];
  scoring_core_hit_t hits[SCORING_CORE_MAX_HITS];
  size_t hit_count;
} scoring_core_state_t;

typedef enum scoring_core_status {
  SCORING_CORE_OK = 0,
  SCORING_CORE_INVALID_ARGUMENT = 1,
  SCORING_CORE_NON_MONOTONIC = 2,
  SCORING_CORE_OVERFLOW = 3
} scoring_core_status_t;

scoring_core_status_t scoring_core_init(scoring_core_state_t *state, scoring_core_weapon_t weapon);
scoring_core_status_t scoring_core_advance(scoring_core_state_t *state, const scoring_core_sample_t *sample);
void scoring_core_diagnostics(
  const scoring_core_state_t *state,
  scoring_core_diagnostic_t out_diagnostics[SCORING_CORE_SIDE_COUNT]
);
scoring_core_status_t scoring_core_make_record(
  const scoring_core_state_t *state,
  size_t hit_index,
  const scoring_core_record_context_t *context,
  scoring_core_decision_record_t *out_record
);

#endif
