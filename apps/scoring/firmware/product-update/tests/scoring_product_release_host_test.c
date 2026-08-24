#include "scoring_product_release.h"

#include <stdbool.h>
#include <stdio.h>
#include <string.h>

#define CHECK(condition)                                                                                               \
  do {                                                                                                                 \
    if (!(condition)) {                                                                                                \
      (void)fprintf(stderr, "%s:%d: check failed: %s\n", __FILE__, __LINE__, #condition);                           \
      return false;                                                                                                    \
    }                                                                                                                  \
  } while (false)

typedef struct test_buffer {
  uint8_t bytes[4096];
  size_t length;
} test_buffer_t;

typedef struct manifest_offsets {
  size_t algorithm_value;
  size_t domain_value;
  size_t esp32_floor_value;
  size_t esp32_security_version_value;
  size_t product_tag;
  size_t first_artifact_processor;
  size_t second_artifact_processor;
  size_t signature_length;
} manifest_offsets_t;

static void append_u8(test_buffer_t *buffer, uint8_t value) {
  buffer->bytes[buffer->length] = value;
  buffer->length += 1U;
}

static void append_u16(test_buffer_t *buffer, size_t value) {
  buffer->bytes[buffer->length] = (uint8_t)(value >> 8U);
  buffer->bytes[buffer->length + 1U] = (uint8_t)value;
  buffer->length += 2U;
}

static void append_u32(test_buffer_t *buffer, uint32_t value) {
  buffer->bytes[buffer->length] = (uint8_t)(value >> 24U);
  buffer->bytes[buffer->length + 1U] = (uint8_t)(value >> 16U);
  buffer->bytes[buffer->length + 2U] = (uint8_t)(value >> 8U);
  buffer->bytes[buffer->length + 3U] = (uint8_t)value;
  buffer->length += 4U;
}

static void append_bytes(test_buffer_t *buffer, const uint8_t *bytes, size_t length) {
  (void)memcpy(&buffer->bytes[buffer->length], bytes, length);
  buffer->length += length;
}

static void append_tlv(test_buffer_t *buffer, uint8_t tag, const uint8_t *value, size_t length) {
  append_u8(buffer, tag);
  append_u16(buffer, length);
  append_bytes(buffer, value, length);
}

static void append_text_tlv(test_buffer_t *buffer, uint8_t tag, const char *value) {
  append_tlv(buffer, tag, (const uint8_t *)value, strlen(value));
}

static void append_u32_tlv(test_buffer_t *buffer, uint8_t tag, uint32_t value) {
  test_buffer_t encoded = {{0}, 0U};
  append_u32(&encoded, value);
  append_tlv(buffer, tag, encoded.bytes, encoded.length);
}

static test_buffer_t artifact(
  uint8_t processor,
  const char *board,
  const char *target,
  uint32_t security_version,
  uint32_t length,
  uint8_t digest_byte,
  size_t *processor_offset,
  size_t *security_version_offset
) {
  test_buffer_t encoded = {{0}, 0U};
  uint8_t digest[SCORING_RELEASE_DIGEST_BYTES];
  (void)memset(digest, digest_byte, sizeof(digest));
  append_u8(&encoded, 9U);
  append_u8(&encoded, 1U);
  append_u16(&encoded, 1U);
  *processor_offset = encoded.length;
  append_u8(&encoded, processor);
  append_text_tlv(&encoded, 2U, board);
  append_text_tlv(&encoded, 3U, target);
  *security_version_offset = encoded.length + 3U;
  append_u32_tlv(&encoded, 4U, security_version);
  append_u32_tlv(&encoded, 5U, length);
  append_tlv(&encoded, 6U, digest, sizeof(digest));
  append_text_tlv(&encoded, 7U, "transport-1");
  append_text_tlv(&encoded, 8U, "schema-1");
  append_text_tlv(&encoded, 9U, "config-1");
  return encoded;
}

static test_buffer_t canonical_manifest(bool with_signature, manifest_offsets_t *offsets) {
  uint8_t signature[SCORING_RELEASE_SIGNATURE_BYTES];
  test_buffer_t manifest = {{0}, 0U};
  size_t esp_processor_offset;
  size_t esp_security_version_offset;
  size_t stm_processor_offset;
  size_t stm_security_version_offset;
  test_buffer_t esp = artifact(
    1U,
    "esp32-board-a",
    "esp32-app",
    7U,
    1024U,
    0xA5U,
    &esp_processor_offset,
    &esp_security_version_offset
  );
  test_buffer_t stm = artifact(
    2U,
    "stm32-board-a",
    "stm32-app",
    11U,
    2048U,
    0x5AU,
    &stm_processor_offset,
    &stm_security_version_offset
  );
  (void)esp_processor_offset;
  (void)stm_security_version_offset;
  (void)memset(signature, 0xC3, sizeof(signature));
  append_bytes(&manifest, (const uint8_t *)"SPRM", 4U);
  append_u8(&manifest, 1U);
  append_u8(&manifest, 13U);
  append_text_tlv(&manifest, 1U, "release-2026-08");
  offsets->product_tag = manifest.length;
  append_text_tlv(&manifest, 2U, "scoring-box");
  append_text_tlv(&manifest, 3U, "transport-1");
  append_text_tlv(&manifest, 4U, "schema-1");
  append_text_tlv(&manifest, 5U, "config-1");
  offsets->esp32_floor_value = manifest.length + 3U;
  append_u32_tlv(&manifest, 6U, 6U);
  append_u32_tlv(&manifest, 7U, 10U);
  append_u8(&manifest, 8U);
  append_u16(&manifest, esp.length);
  offsets->first_artifact_processor = manifest.length + esp_processor_offset;
  offsets->esp32_security_version_value = manifest.length + esp_security_version_offset;
  append_bytes(&manifest, esp.bytes, esp.length);
  append_u8(&manifest, 8U);
  append_u16(&manifest, stm.length);
  offsets->second_artifact_processor = manifest.length + stm_processor_offset;
  append_bytes(&manifest, stm.bytes, stm.length);
  offsets->algorithm_value = manifest.length + 3U;
  append_text_tlv(&manifest, 9U, "ed25519");
  offsets->domain_value = manifest.length + 3U;
  append_text_tlv(&manifest, 10U, "scoring-product-release-v1");
  append_text_tlv(&manifest, 11U, "production-key-1");
  append_u8(&manifest, 12U);
  offsets->signature_length = manifest.length;
  append_u16(&manifest, with_signature ? sizeof(signature) : 0U);
  if (with_signature) append_bytes(&manifest, signature, sizeof(signature));
  return manifest;
}

static scoring_release_string_t release_string(const char *value) {
  scoring_release_string_t result = {{0}, 0U};
  result.length = strlen(value);
  (void)memcpy(result.bytes, value, result.length);
  return result;
}

static scoring_release_environment_t compatible_environment(void) {
  scoring_release_environment_t environment;
  (void)memset(&environment, 0, sizeof(environment));
  environment.product_id = release_string("scoring-box");
  environment.protocol_revision = release_string("transport-1");
  environment.schema_revision = release_string("schema-1");
  environment.config_revision = release_string("config-1");
  environment.esp32.board_id = release_string("esp32-board-a");
  environment.esp32.target_id = release_string("esp32-app");
  environment.esp32.security_version = 6U;
  environment.esp32.security_floor = 5U;
  environment.esp32.maximum_security_version = UINT16_MAX;
  environment.esp32.staging_capacity = 4096U;
  environment.stm32.board_id = release_string("stm32-board-a");
  environment.stm32.target_id = release_string("stm32-app");
  environment.stm32.security_version = 10U;
  environment.stm32.security_floor = 9U;
  environment.stm32.maximum_security_version = UINT32_MAX;
  environment.stm32.staging_capacity = 4096U;
  return environment;
}

static void matching_observed(scoring_release_observed_artifact_t observed[SCORING_RELEASE_ARTIFACT_COUNT]) {
  observed[0].processor = SCORING_RELEASE_PROCESSOR_ESP32;
  observed[0].artifact_length = 1024U;
  (void)memset(observed[0].digest, 0xA5, SCORING_RELEASE_DIGEST_BYTES);
  observed[1].processor = SCORING_RELEASE_PROCESSOR_STM32;
  observed[1].artifact_length = 2048U;
  (void)memset(observed[1].digest, 0x5A, SCORING_RELEASE_DIGEST_BYTES);
}

typedef struct verifier_observer {
  scoring_release_signature_result_t result;
  size_t calls;
  size_t signed_length;
  const uint8_t *expected_bytes;
} verifier_observer_t;

static scoring_release_signature_result_t verify_signature(
  void *context,
  const scoring_release_signature_request_t *request
) {
  verifier_observer_t *observer = context;
  observer->calls += 1U;
  observer->signed_length = request->signed_length;
  if (request->signed_bytes != observer->expected_bytes || request->signature == NULL ||
      request->signature != request->signed_bytes + request->signed_length + 3U ||
      request->signature_length != SCORING_RELEASE_SIGNATURE_BYTES || request->algorithm.length != 7U ||
      request->domain.length != strlen("scoring-product-release-v1") || request->key_id.length == 0U)
    return SCORING_RELEASE_SIGNATURE_REJECTED;
  return observer->result;
}

static scoring_release_reason_t verify_release(
  const test_buffer_t *encoded,
  verifier_observer_t *verifier,
  const scoring_release_environment_t *environment,
  const scoring_release_observed_artifact_t observed[SCORING_RELEASE_ARTIFACT_COUNT]
) {
  verifier->expected_bytes = encoded->bytes;
  return scoring_product_release_verify_and_authorize(
    encoded->bytes,
    encoded->length,
    verify_signature,
    verifier,
    environment,
    observed
  );
}

static bool test_valid_release(void) {
  manifest_offsets_t offsets;
  test_buffer_t encoded = canonical_manifest(true, &offsets);
  scoring_release_environment_t environment = compatible_environment();
  scoring_release_observed_artifact_t observed[SCORING_RELEASE_ARTIFACT_COUNT];
  verifier_observer_t verifier = {SCORING_RELEASE_SIGNATURE_VALID, 0U, 0U, NULL};
  matching_observed(observed);
  CHECK(verify_release(&encoded, &verifier, &environment, observed) == SCORING_RELEASE_OK);
  CHECK(verifier.calls == 1U);
  CHECK(verifier.signed_length < encoded.length);
  return true;
}

static bool test_signature_precedes_compatibility(void) {
  manifest_offsets_t offsets;
  test_buffer_t encoded = canonical_manifest(false, &offsets);
  scoring_release_environment_t environment = compatible_environment();
  scoring_release_observed_artifact_t observed[SCORING_RELEASE_ARTIFACT_COUNT];
  verifier_observer_t verifier = {SCORING_RELEASE_SIGNATURE_VALID, 0U, 0U, NULL};
  matching_observed(observed);
  environment.product_id = release_string("wrong-product");
  CHECK(scoring_product_release_verify_and_authorize(
          encoded.bytes,
          encoded.length,
          NULL,
          &verifier,
          &environment,
          observed
        ) == SCORING_RELEASE_INVALID_ARGUMENT);
  CHECK(verify_release(&encoded, &verifier, &environment, observed) == SCORING_RELEASE_UNSIGNED);
  CHECK(verifier.calls == 0U);
  encoded = canonical_manifest(true, &offsets);
  verifier.result = SCORING_RELEASE_SIGNATURE_REJECTED;
  CHECK(verify_release(&encoded, &verifier, &environment, observed) == SCORING_RELEASE_SIGNATURE_INVALID);
  CHECK(verifier.calls == 1U);
  return true;
}

static bool test_structural_rejections(void) {
  manifest_offsets_t offsets;
  test_buffer_t encoded = canonical_manifest(true, &offsets);
  uint8_t oversized[SCORING_RELEASE_MAX_MANIFEST_BYTES + 1U] = {0};
  scoring_release_environment_t environment = compatible_environment();
  scoring_release_observed_artifact_t observed[SCORING_RELEASE_ARTIFACT_COUNT];
  verifier_observer_t verifier = {SCORING_RELEASE_SIGNATURE_VALID, 0U, 0U, NULL};
  matching_observed(observed);
  CHECK(scoring_product_release_verify_and_authorize(NULL, 0U, verify_signature, &verifier, &environment, observed) ==
        SCORING_RELEASE_INVALID_ARGUMENT);
  encoded.length = 5U;
  CHECK(verify_release(&encoded, &verifier, &environment, observed) == SCORING_RELEASE_TRUNCATED);
  CHECK(scoring_product_release_verify_and_authorize(
          oversized,
          sizeof(oversized),
          verify_signature,
          &verifier,
          &environment,
          observed
        ) == SCORING_RELEASE_OVERSIZE);
  encoded = canonical_manifest(true, &offsets);
  encoded.bytes[4] = 2U;
  CHECK(verify_release(&encoded, &verifier, &environment, observed) == SCORING_RELEASE_UNKNOWN_VERSION);
  encoded = canonical_manifest(true, &offsets);
  encoded.bytes[5] = 12U;
  CHECK(verify_release(&encoded, &verifier, &environment, observed) == SCORING_RELEASE_MISSING_FIELD);
  encoded = canonical_manifest(true, &offsets);
  encoded.bytes[offsets.product_tag] = 1U;
  CHECK(verify_release(&encoded, &verifier, &environment, observed) == SCORING_RELEASE_DUPLICATE_FIELD);
  encoded = canonical_manifest(true, &offsets);
  encoded.bytes[offsets.second_artifact_processor] = 1U;
  CHECK(verify_release(&encoded, &verifier, &environment, observed) == SCORING_RELEASE_ARTIFACT_DUPLICATE);
  encoded = canonical_manifest(true, &offsets);
  encoded.bytes[offsets.second_artifact_processor - 4U] = 8U;
  CHECK(verify_release(&encoded, &verifier, &environment, observed) == SCORING_RELEASE_MISSING_FIELD);
  encoded = canonical_manifest(true, &offsets);
  encoded.bytes[offsets.second_artifact_processor + 1U] = 1U;
  CHECK(verify_release(&encoded, &verifier, &environment, observed) == SCORING_RELEASE_DUPLICATE_FIELD);
  encoded = canonical_manifest(true, &offsets);
  encoded.bytes[offsets.first_artifact_processor] = 2U;
  encoded.bytes[offsets.second_artifact_processor] = 1U;
  CHECK(verify_release(&encoded, &verifier, &environment, observed) == SCORING_RELEASE_NON_CANONICAL);
  encoded = canonical_manifest(true, &offsets);
  encoded.bytes[offsets.signature_length] = 0U;
  encoded.bytes[offsets.signature_length + 1U] = 65U;
  CHECK(verify_release(&encoded, &verifier, &environment, observed) == SCORING_RELEASE_TRUNCATED);
  encoded.length += 1U;
  CHECK(verify_release(&encoded, &verifier, &environment, observed) == SCORING_RELEASE_INVALID_FIELD);
  encoded = canonical_manifest(true, &offsets);
  encoded.bytes[offsets.algorithm_value] = (uint8_t)'x';
  CHECK(verify_release(&encoded, &verifier, &environment, observed) == SCORING_RELEASE_INVALID_FIELD);
  encoded = canonical_manifest(true, &offsets);
  encoded.bytes[offsets.domain_value] = (uint8_t)'x';
  CHECK(verify_release(&encoded, &verifier, &environment, observed) == SCORING_RELEASE_INVALID_FIELD);
  encoded = canonical_manifest(true, &offsets);
  encoded.bytes[offsets.esp32_floor_value] = 0U;
  encoded.bytes[offsets.esp32_floor_value + 1U] = 1U;
  encoded.bytes[offsets.esp32_floor_value + 2U] = 0U;
  encoded.bytes[offsets.esp32_floor_value + 3U] = 0U;
  CHECK(verify_release(&encoded, &verifier, &environment, observed) == SCORING_RELEASE_SECURITY_RANGE);
  encoded = canonical_manifest(true, &offsets);
  encoded.bytes[offsets.esp32_security_version_value] = 0U;
  encoded.bytes[offsets.esp32_security_version_value + 1U] = 1U;
  encoded.bytes[offsets.esp32_security_version_value + 2U] = 0U;
  encoded.bytes[offsets.esp32_security_version_value + 3U] = 0U;
  CHECK(verify_release(&encoded, &verifier, &environment, observed) == SCORING_RELEASE_SECURITY_RANGE);
  return true;
}

static bool test_every_truncation_fails_closed(void) {
  manifest_offsets_t offsets;
  test_buffer_t encoded = canonical_manifest(true, &offsets);
  scoring_release_environment_t environment = compatible_environment();
  scoring_release_observed_artifact_t observed[SCORING_RELEASE_ARTIFACT_COUNT];
  verifier_observer_t verifier = {SCORING_RELEASE_SIGNATURE_VALID, 0U, 0U, NULL};
  size_t truncated_length;
  matching_observed(observed);
  for (truncated_length = 0U; truncated_length < encoded.length; truncated_length += 1U) {
    test_buffer_t truncated = encoded;
    truncated.length = truncated_length;
    CHECK(verify_release(&truncated, &verifier, &environment, observed) != SCORING_RELEASE_OK);
  }
  return true;
}

static bool test_malformed_identifier_bound(void) {
  manifest_offsets_t offsets;
  test_buffer_t encoded = canonical_manifest(true, &offsets);
  scoring_release_environment_t environment = compatible_environment();
  scoring_release_observed_artifact_t observed[SCORING_RELEASE_ARTIFACT_COUNT];
  verifier_observer_t verifier = {SCORING_RELEASE_SIGNATURE_VALID, 0U, 0U, NULL};
  matching_observed(observed);
  const size_t release_length_offset = 7U;
  encoded.bytes[release_length_offset] = 0U;
  encoded.bytes[release_length_offset + 1U] = 65U;
  CHECK(verify_release(&encoded, &verifier, &environment, observed) == SCORING_RELEASE_INVALID_FIELD);
  return true;
}

static bool test_identity_and_revision_mismatches(void) {
  manifest_offsets_t offsets;
  test_buffer_t encoded = canonical_manifest(true, &offsets);
  scoring_release_environment_t environment;
  scoring_release_observed_artifact_t observed[SCORING_RELEASE_ARTIFACT_COUNT];
  verifier_observer_t verifier = {SCORING_RELEASE_SIGNATURE_VALID, 0U, 0U, NULL};
  matching_observed(observed);
  environment = compatible_environment();
  environment.product_id = release_string("other-product");
  CHECK(verify_release(&encoded, &verifier, &environment, observed) == SCORING_RELEASE_PRODUCT_MISMATCH);
  environment = compatible_environment();
  environment.esp32.board_id = release_string("other-board");
  CHECK(verify_release(&encoded, &verifier, &environment, observed) == SCORING_RELEASE_BOARD_MISMATCH);
  environment = compatible_environment();
  environment.stm32.target_id = release_string("other-target");
  CHECK(verify_release(&encoded, &verifier, &environment, observed) == SCORING_RELEASE_TARGET_MISMATCH);
  environment = compatible_environment();
  environment.protocol_revision = release_string("transport-2");
  CHECK(verify_release(&encoded, &verifier, &environment, observed) == SCORING_RELEASE_PROTOCOL_MISMATCH);
  environment = compatible_environment();
  environment.schema_revision = release_string("schema-2");
  CHECK(verify_release(&encoded, &verifier, &environment, observed) == SCORING_RELEASE_SCHEMA_MISMATCH);
  environment = compatible_environment();
  environment.config_revision = release_string("config-2");
  CHECK(verify_release(&encoded, &verifier, &environment, observed) == SCORING_RELEASE_CONFIG_MISMATCH);
  return true;
}

static bool test_artifact_and_security_rejections(void) {
  manifest_offsets_t offsets;
  test_buffer_t encoded = canonical_manifest(true, &offsets);
  scoring_release_environment_t environment = compatible_environment();
  scoring_release_observed_artifact_t observed[SCORING_RELEASE_ARTIFACT_COUNT];
  verifier_observer_t verifier = {SCORING_RELEASE_SIGNATURE_VALID, 0U, 0U, NULL};
  matching_observed(observed);
  observed[0].artifact_length += 1U;
  CHECK(verify_release(&encoded, &verifier, &environment, observed) == SCORING_RELEASE_LENGTH_MISMATCH);
  matching_observed(observed);
  observed[1].digest[0] ^= 1U;
  CHECK(verify_release(&encoded, &verifier, &environment, observed) == SCORING_RELEASE_DIGEST_MISMATCH);
  matching_observed(observed);
  environment.esp32.security_floor = 8U;
  CHECK(verify_release(&encoded, &verifier, &environment, observed) == SCORING_RELEASE_SECURITY_FLOOR);
  environment = compatible_environment();
  environment.stm32.security_version = 12U;
  CHECK(verify_release(&encoded, &verifier, &environment, observed) == SCORING_RELEASE_DOWNGRADE);
  environment = compatible_environment();
  environment.esp32.maximum_security_version = 6U;
  CHECK(verify_release(&encoded, &verifier, &environment, observed) == SCORING_RELEASE_SECURITY_RANGE);
  environment = compatible_environment();
  environment.esp32.staging_capacity = 1023U;
  CHECK(verify_release(&encoded, &verifier, &environment, observed) == SCORING_RELEASE_CAPACITY_EXCEEDED);
  return true;
}

static bool test_observed_artifact_order_is_identity_based(void) {
  manifest_offsets_t offsets;
  test_buffer_t encoded = canonical_manifest(true, &offsets);
  scoring_release_environment_t environment = compatible_environment();
  scoring_release_observed_artifact_t observed[SCORING_RELEASE_ARTIFACT_COUNT];
  scoring_release_observed_artifact_t reversed[SCORING_RELEASE_ARTIFACT_COUNT];
  verifier_observer_t verifier = {SCORING_RELEASE_SIGNATURE_VALID, 0U, 0U, NULL};
  matching_observed(observed);
  reversed[0] = observed[1];
  reversed[1] = observed[0];
  CHECK(verify_release(&encoded, &verifier, &environment, reversed) == SCORING_RELEASE_OK);

  environment = compatible_environment();
  environment.esp32.board_id = release_string("other-board");
  CHECK(verify_release(&encoded, &verifier, &environment, reversed) == SCORING_RELEASE_BOARD_MISMATCH);
  environment = compatible_environment();
  environment.stm32.target_id = release_string("other-target");
  CHECK(verify_release(&encoded, &verifier, &environment, reversed) == SCORING_RELEASE_TARGET_MISMATCH);
  environment = compatible_environment();
  environment.esp32.security_floor = 8U;
  CHECK(verify_release(&encoded, &verifier, &environment, reversed) == SCORING_RELEASE_SECURITY_FLOOR);
  environment = compatible_environment();
  environment.stm32.staging_capacity = 2047U;
  CHECK(verify_release(&encoded, &verifier, &environment, reversed) == SCORING_RELEASE_CAPACITY_EXCEEDED);
  environment = compatible_environment();
  reversed[0].artifact_length += 1U;
  CHECK(verify_release(&encoded, &verifier, &environment, reversed) == SCORING_RELEASE_LENGTH_MISMATCH);
  reversed[0].artifact_length = 2048U;
  reversed[0].digest[0] ^= 1U;
  environment = compatible_environment();
  CHECK(verify_release(&encoded, &verifier, &environment, reversed) == SCORING_RELEASE_DIGEST_MISMATCH);
  return true;
}

static bool test_authorization_argument_bounds(void) {
  manifest_offsets_t offsets;
  test_buffer_t encoded = canonical_manifest(true, &offsets);
  scoring_release_environment_t environment = compatible_environment();
  scoring_release_observed_artifact_t observed[SCORING_RELEASE_ARTIFACT_COUNT];
  verifier_observer_t verifier = {SCORING_RELEASE_SIGNATURE_VALID, 0U, 0U, NULL};
  matching_observed(observed);
  environment.stm32.board_id.length = SCORING_RELEASE_MAX_ID_BYTES + 1U;
  CHECK(verify_release(&encoded, &verifier, &environment, observed) == SCORING_RELEASE_INVALID_ARGUMENT);
  environment = compatible_environment();
  environment.esp32.maximum_security_version = (uint32_t)UINT16_MAX + 1U;
  CHECK(verify_release(&encoded, &verifier, &environment, observed) == SCORING_RELEASE_INVALID_ARGUMENT);
  return true;
}

static uint32_t next_random(uint32_t *state) {
  uint32_t value = *state;
  value ^= value << 13U;
  value ^= value >> 17U;
  value ^= value << 5U;
  *state = value;
  return value;
}

static uint32_t fuzz_checksum(uint32_t seed) {
  uint8_t bytes[SCORING_RELEASE_MAX_MANIFEST_BYTES];
  manifest_offsets_t offsets;
  const test_buffer_t canonical = canonical_manifest(true, &offsets);
  uint32_t checksum = 2166136261U;
  size_t iteration;
  scoring_release_environment_t environment = compatible_environment();
  scoring_release_observed_artifact_t observed[SCORING_RELEASE_ARTIFACT_COUNT];
  verifier_observer_t verifier = {SCORING_RELEASE_SIGNATURE_VALID, 0U, 0U, NULL};
  (void)offsets;
  matching_observed(observed);
  for (iteration = 0U; iteration < 10000U; iteration += 1U) {
    size_t length = canonical.length;
    size_t mutation;
    const size_t mutation_count = iteration % 257U == 0U ? 0U : 1U + (size_t)(next_random(&seed) % 8U);
    (void)memcpy(bytes, canonical.bytes, canonical.length);
    for (mutation = 0U; mutation < mutation_count; mutation += 1U) {
      const size_t index = (size_t)(next_random(&seed) % (uint32_t)canonical.length);
      bytes[index] ^= (uint8_t)(1U + next_random(&seed));
    }
    if (iteration % 4U == 0U) length = (size_t)(next_random(&seed) % ((uint32_t)canonical.length + 1U));
    checksum ^= (uint32_t)scoring_product_release_verify_and_authorize(
      bytes,
      length,
      verify_signature,
      &verifier,
      &environment,
      observed
    );
    checksum *= 16777619U;
  }
  return checksum;
}

static bool test_seeded_parser_fuzz_is_deterministic(void) {
  const uint32_t first = fuzz_checksum(0xE0092026U);
  const uint32_t second = fuzz_checksum(0xE0092026U);
  CHECK(first == second);
  CHECK(first != 0U);
  return true;
}

static bool test_reason_codes_are_stable(void) {
  static const char *const expected[] = {
    "ok",                "invalid-argument",   "truncated",          "oversize",
    "unknown-version",   "non-canonical",      "missing-field",      "duplicate-field",
    "invalid-field",     "artifact-count",     "artifact-duplicate", "unsigned",
    "signature-invalid", "product-mismatch",   "board-mismatch",     "target-mismatch",
    "protocol-mismatch", "schema-mismatch",    "config-mismatch",    "length-mismatch",
    "digest-mismatch",   "security-floor",     "downgrade",          "capacity-exceeded",
    "security-range"
  };
  size_t index;
  for (index = 0U; index < sizeof(expected) / sizeof(expected[0]); index += 1U)
    CHECK(strcmp(scoring_product_release_reason_code((scoring_release_reason_t)index), expected[index]) == 0);
  CHECK(strcmp(scoring_product_release_reason_code((scoring_release_reason_t)999), "unknown-reason") == 0);
  return true;
}

int main(void) {
  static const struct test_case {
    const char *name;
    bool (*run)(void);
  } tests[] = {
    {"valid release", test_valid_release},
    {"signature precedes compatibility", test_signature_precedes_compatibility},
    {"structural rejections", test_structural_rejections},
    {"every truncation fails closed", test_every_truncation_fails_closed},
    {"malformed identifier bound", test_malformed_identifier_bound},
    {"identity and revision mismatches", test_identity_and_revision_mismatches},
    {"artifact and security rejections", test_artifact_and_security_rejections},
    {"observed artifact order is identity based", test_observed_artifact_order_is_identity_based},
    {"authorization argument bounds", test_authorization_argument_bounds},
    {"seeded parser fuzz", test_seeded_parser_fuzz_is_deterministic},
    {"stable reason codes", test_reason_codes_are_stable}
  };
  size_t index;
  for (index = 0U; index < sizeof(tests) / sizeof(tests[0]); index += 1U) {
    if (!tests[index].run()) {
      (void)fprintf(stderr, "FAIL %s\n", tests[index].name);
      return 1;
    }
    (void)printf("PASS %s\n", tests[index].name);
  }
  return 0;
}
