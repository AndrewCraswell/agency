#ifndef SCORING_PRODUCT_RELEASE_H
#define SCORING_PRODUCT_RELEASE_H

#include <stddef.h>
#include <stdint.h>

#define SCORING_RELEASE_MAX_MANIFEST_BYTES 2048U
#define SCORING_RELEASE_MAX_ID_BYTES 64U
#define SCORING_RELEASE_MAX_REVISION_BYTES 48U
#define SCORING_RELEASE_DIGEST_BYTES 32U
#define SCORING_RELEASE_ARTIFACT_COUNT 2U
#define SCORING_RELEASE_SIGNATURE_BYTES 64U

typedef enum scoring_release_reason {
  SCORING_RELEASE_OK = 0,
  SCORING_RELEASE_INVALID_ARGUMENT,
  SCORING_RELEASE_TRUNCATED,
  SCORING_RELEASE_OVERSIZE,
  SCORING_RELEASE_UNKNOWN_VERSION,
  SCORING_RELEASE_NON_CANONICAL,
  SCORING_RELEASE_MISSING_FIELD,
  SCORING_RELEASE_DUPLICATE_FIELD,
  SCORING_RELEASE_INVALID_FIELD,
  SCORING_RELEASE_ARTIFACT_COUNT_INVALID,
  SCORING_RELEASE_ARTIFACT_DUPLICATE,
  SCORING_RELEASE_UNSIGNED,
  SCORING_RELEASE_SIGNATURE_INVALID,
  SCORING_RELEASE_PRODUCT_MISMATCH,
  SCORING_RELEASE_BOARD_MISMATCH,
  SCORING_RELEASE_TARGET_MISMATCH,
  SCORING_RELEASE_PROTOCOL_MISMATCH,
  SCORING_RELEASE_SCHEMA_MISMATCH,
  SCORING_RELEASE_CONFIG_MISMATCH,
  SCORING_RELEASE_LENGTH_MISMATCH,
  SCORING_RELEASE_DIGEST_MISMATCH,
  SCORING_RELEASE_SECURITY_FLOOR,
  SCORING_RELEASE_DOWNGRADE,
  SCORING_RELEASE_CAPACITY_EXCEEDED,
  SCORING_RELEASE_SECURITY_RANGE
} scoring_release_reason_t;

typedef enum scoring_release_processor {
  SCORING_RELEASE_PROCESSOR_ESP32 = 1,
  SCORING_RELEASE_PROCESSOR_STM32 = 2
} scoring_release_processor_t;

typedef enum scoring_release_signature_result {
  SCORING_RELEASE_SIGNATURE_REJECTED = 0,
  SCORING_RELEASE_SIGNATURE_VALID = 1
} scoring_release_signature_result_t;

typedef struct scoring_release_string {
  uint8_t bytes[SCORING_RELEASE_MAX_ID_BYTES];
  size_t length;
} scoring_release_string_t;

typedef struct scoring_release_installed_processor {
  scoring_release_string_t board_id;
  scoring_release_string_t target_id;
  uint32_t security_version;
  uint32_t security_floor;
  uint32_t maximum_security_version;
  uint32_t staging_capacity;
} scoring_release_installed_processor_t;

typedef struct scoring_release_environment {
  scoring_release_string_t product_id;
  scoring_release_string_t protocol_revision;
  scoring_release_string_t schema_revision;
  scoring_release_string_t config_revision;
  scoring_release_installed_processor_t esp32;
  scoring_release_installed_processor_t stm32;
} scoring_release_environment_t;

typedef struct scoring_release_observed_artifact {
  scoring_release_processor_t processor;
  uint32_t artifact_length;
  uint8_t digest[SCORING_RELEASE_DIGEST_BYTES];
} scoring_release_observed_artifact_t;

typedef struct scoring_release_signature_request {
  const uint8_t *signed_bytes;
  size_t signed_length;
  const uint8_t *signature;
  size_t signature_length;
  scoring_release_string_t algorithm;
  scoring_release_string_t domain;
  scoring_release_string_t key_id;
} scoring_release_signature_request_t;

typedef scoring_release_signature_result_t (*scoring_release_signature_verifier_t)(
  void *context,
  const scoring_release_signature_request_t *request
);

scoring_release_reason_t scoring_product_release_verify_and_authorize(
  const uint8_t *bytes,
  size_t length,
  scoring_release_signature_verifier_t signature_verifier,
  void *signature_context,
  const scoring_release_environment_t *environment,
  const scoring_release_observed_artifact_t observed[SCORING_RELEASE_ARTIFACT_COUNT]
);

const char *scoring_product_release_reason_code(scoring_release_reason_t reason);

#endif
