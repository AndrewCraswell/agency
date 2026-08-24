#include "scoring_product_release.h"

#include <stdbool.h>
#include <string.h>

#define RELEASE_TOP_FIELD_COUNT 13U
#define RELEASE_ARTIFACT_FIELD_COUNT 9U

typedef struct release_cursor {
  const uint8_t *bytes;
  size_t length;
  size_t offset;
} release_cursor_t;

typedef struct scoring_release_artifact {
  scoring_release_processor_t processor;
  scoring_release_string_t board_id;
  scoring_release_string_t target_id;
  uint32_t security_version;
  uint32_t artifact_length;
  uint8_t digest[SCORING_RELEASE_DIGEST_BYTES];
  scoring_release_string_t protocol_revision;
  scoring_release_string_t schema_revision;
  scoring_release_string_t config_revision;
} scoring_release_artifact_t;

typedef struct scoring_product_release_manifest {
  scoring_release_string_t release_id;
  scoring_release_string_t product_id;
  scoring_release_string_t protocol_revision;
  scoring_release_string_t schema_revision;
  scoring_release_string_t config_revision;
  uint32_t esp32_security_floor;
  uint32_t stm32_security_floor;
  scoring_release_artifact_t artifacts[SCORING_RELEASE_ARTIFACT_COUNT];
  scoring_release_string_t signature_algorithm;
  scoring_release_string_t signing_domain;
  scoring_release_string_t key_id;
  const uint8_t *signature;
  size_t signature_length;
  size_t signed_length;
} scoring_product_release_manifest_t;

static bool take_u8(release_cursor_t *cursor, uint8_t *value) {
  if (cursor->offset >= cursor->length) return false;
  *value = cursor->bytes[cursor->offset];
  cursor->offset += 1U;
  return true;
}

static bool take_u16(release_cursor_t *cursor, uint16_t *value) {
  if (cursor->length - cursor->offset < 2U) return false;
  *value = (uint16_t)(((uint16_t)cursor->bytes[cursor->offset] << 8U) | cursor->bytes[cursor->offset + 1U]);
  cursor->offset += 2U;
  return true;
}

static bool take_bytes(release_cursor_t *cursor, size_t length, const uint8_t **value) {
  if (length > cursor->length - cursor->offset) return false;
  *value = &cursor->bytes[cursor->offset];
  cursor->offset += length;
  return true;
}

static uint32_t read_u32(const uint8_t *bytes) {
  return ((uint32_t)bytes[0] << 24U) | ((uint32_t)bytes[1] << 16U) | ((uint32_t)bytes[2] << 8U) |
         (uint32_t)bytes[3];
}

static bool valid_identifier_byte(uint8_t value) {
  return (value >= (uint8_t)'A' && value <= (uint8_t)'Z') ||
         (value >= (uint8_t)'a' && value <= (uint8_t)'z') ||
         (value >= (uint8_t)'0' && value <= (uint8_t)'9') || value == (uint8_t)'-' || value == (uint8_t)'_' ||
         value == (uint8_t)'.';
}

static bool valid_identifier_bytes(
  const uint8_t *value,
  size_t length,
  size_t maximum,
  size_t storage_capacity
) {
  size_t index;

  if (value == NULL || length == 0U || length > maximum || length > storage_capacity) return false;
  for (index = 0U; index < length; index += 1U)
    if (!valid_identifier_byte(value[index])) return false;
  return true;
}

static scoring_release_reason_t decode_string(
  const uint8_t *value,
  size_t length,
  size_t maximum,
  scoring_release_string_t *out
) {
  if (!valid_identifier_bytes(value, length, maximum, sizeof(out->bytes))) return SCORING_RELEASE_INVALID_FIELD;
  (void)memset(out, 0, sizeof(*out));
  (void)memcpy(out->bytes, value, length);
  out->length = length;
  return SCORING_RELEASE_OK;
}

static scoring_release_reason_t read_tlv(
  release_cursor_t *cursor,
  uint8_t *tag,
  const uint8_t **value,
  size_t *value_length
) {
  uint16_t encoded_length;
  if (!take_u8(cursor, tag) || !take_u16(cursor, &encoded_length)) return SCORING_RELEASE_TRUNCATED;
  *value_length = encoded_length;
  if (!take_bytes(cursor, *value_length, value)) return SCORING_RELEASE_TRUNCATED;
  return SCORING_RELEASE_OK;
}

static scoring_release_reason_t decode_artifact(
  const uint8_t *bytes,
  size_t length,
  scoring_release_artifact_t *artifact
) {
  static const uint8_t expected_tags[RELEASE_ARTIFACT_FIELD_COUNT] = {1U, 2U, 3U, 4U, 5U, 6U, 7U, 8U, 9U};
  release_cursor_t cursor = {.bytes = bytes, .length = length, .offset = 0U};
  bool seen[13] = {false};
  uint8_t field_count;
  size_t field_index;
  (void)memset(artifact, 0, sizeof(*artifact));
  if (!take_u8(&cursor, &field_count)) return SCORING_RELEASE_TRUNCATED;
  if (field_count < RELEASE_ARTIFACT_FIELD_COUNT) return SCORING_RELEASE_MISSING_FIELD;
  if (field_count > RELEASE_ARTIFACT_FIELD_COUNT) return SCORING_RELEASE_INVALID_FIELD;

  for (field_index = 0U; field_index < field_count; field_index += 1U) {
    const uint8_t *value;
    size_t value_length;
    uint8_t tag;
    scoring_release_reason_t reason = read_tlv(&cursor, &tag, &value, &value_length);
    if (reason != SCORING_RELEASE_OK) return reason;
    if (tag == 0U || tag > RELEASE_ARTIFACT_FIELD_COUNT) return SCORING_RELEASE_INVALID_FIELD;
    if (seen[tag]) return SCORING_RELEASE_DUPLICATE_FIELD;
    seen[tag] = true;
    if (tag != expected_tags[field_index]) return SCORING_RELEASE_NON_CANONICAL;
    switch (tag) {
      case 1U:
        if (value_length != 1U || (value[0] != 1U && value[0] != 2U)) return SCORING_RELEASE_INVALID_FIELD;
        artifact->processor = (scoring_release_processor_t)value[0];
        break;
      case 2U:
        reason = decode_string(value, value_length, SCORING_RELEASE_MAX_ID_BYTES, &artifact->board_id);
        if (reason != SCORING_RELEASE_OK) return reason;
        break;
      case 3U:
        reason = decode_string(value, value_length, SCORING_RELEASE_MAX_ID_BYTES, &artifact->target_id);
        if (reason != SCORING_RELEASE_OK) return reason;
        break;
      case 4U:
        if (value_length != 4U) return SCORING_RELEASE_INVALID_FIELD;
        artifact->security_version = read_u32(value);
        if (artifact->processor == SCORING_RELEASE_PROCESSOR_ESP32 && artifact->security_version > UINT16_MAX)
          return SCORING_RELEASE_SECURITY_RANGE;
        break;
      case 5U:
        if (value_length != 4U || read_u32(value) == 0U) return SCORING_RELEASE_INVALID_FIELD;
        artifact->artifact_length = read_u32(value);
        break;
      case 6U:
        if (value_length != SCORING_RELEASE_DIGEST_BYTES) return SCORING_RELEASE_INVALID_FIELD;
        (void)memcpy(artifact->digest, value, SCORING_RELEASE_DIGEST_BYTES);
        break;
      case 7U:
        reason = decode_string(value, value_length, SCORING_RELEASE_MAX_REVISION_BYTES, &artifact->protocol_revision);
        if (reason != SCORING_RELEASE_OK) return reason;
        break;
      case 8U:
        reason = decode_string(value, value_length, SCORING_RELEASE_MAX_REVISION_BYTES, &artifact->schema_revision);
        if (reason != SCORING_RELEASE_OK) return reason;
        break;
      case 9U:
        reason = decode_string(value, value_length, SCORING_RELEASE_MAX_REVISION_BYTES, &artifact->config_revision);
        if (reason != SCORING_RELEASE_OK) return reason;
        break;
      default:
        return SCORING_RELEASE_INVALID_FIELD;
    }
  }
  if (cursor.offset != cursor.length) return SCORING_RELEASE_NON_CANONICAL;
  return SCORING_RELEASE_OK;
}

static scoring_release_reason_t decode_manifest(
  const uint8_t *bytes,
  size_t length,
  scoring_product_release_manifest_t *out_manifest
) {
  static const uint8_t expected_tags[RELEASE_TOP_FIELD_COUNT] = {
    1U, 2U, 3U, 4U, 5U, 6U, 7U, 8U, 8U, 9U, 10U, 11U, 12U
  };
  release_cursor_t cursor;
  bool seen[13] = {false};
  uint8_t version;
  uint8_t field_count;
  size_t field_index;
  size_t artifact_count = 0U;
  scoring_product_release_manifest_t decoded;
  if (bytes == NULL || out_manifest == NULL) return SCORING_RELEASE_INVALID_ARGUMENT;
  (void)memset(out_manifest, 0, sizeof(*out_manifest));
  if (length > SCORING_RELEASE_MAX_MANIFEST_BYTES) return SCORING_RELEASE_OVERSIZE;
  if (length < 6U) return SCORING_RELEASE_TRUNCATED;
  if (memcmp(bytes, "SPRM", 4U) != 0) return SCORING_RELEASE_INVALID_FIELD;
  cursor = (release_cursor_t){.bytes = bytes, .length = length, .offset = 4U};
  if (!take_u8(&cursor, &version) || !take_u8(&cursor, &field_count)) return SCORING_RELEASE_TRUNCATED;
  if (version != 1U) return SCORING_RELEASE_UNKNOWN_VERSION;
  if (field_count < RELEASE_TOP_FIELD_COUNT) return SCORING_RELEASE_MISSING_FIELD;
  if (field_count > RELEASE_TOP_FIELD_COUNT) return SCORING_RELEASE_INVALID_FIELD;
  (void)memset(&decoded, 0, sizeof(decoded));

  for (field_index = 0U; field_index < field_count; field_index += 1U) {
    const size_t field_offset = cursor.offset;
    const uint8_t *value;
    size_t value_length;
    uint8_t tag;
    scoring_release_reason_t reason = read_tlv(&cursor, &tag, &value, &value_length);
    if (reason != SCORING_RELEASE_OK) return reason;
    if (tag == 0U || tag > 12U) return SCORING_RELEASE_INVALID_FIELD;
    if (tag != 8U && seen[tag]) return SCORING_RELEASE_DUPLICATE_FIELD;
    if (tag != 8U) seen[tag] = true;
    if (tag != expected_tags[field_index]) return SCORING_RELEASE_NON_CANONICAL;
    switch (tag) {
      case 1U:
        reason = decode_string(value, value_length, SCORING_RELEASE_MAX_ID_BYTES, &decoded.release_id);
        break;
      case 2U:
        reason = decode_string(value, value_length, SCORING_RELEASE_MAX_ID_BYTES, &decoded.product_id);
        break;
      case 3U:
        reason = decode_string(
          value,
          value_length,
          SCORING_RELEASE_MAX_REVISION_BYTES,
          &decoded.protocol_revision
        );
        break;
      case 4U:
        reason = decode_string(value, value_length, SCORING_RELEASE_MAX_REVISION_BYTES, &decoded.schema_revision);
        break;
      case 5U:
        reason = decode_string(value, value_length, SCORING_RELEASE_MAX_REVISION_BYTES, &decoded.config_revision);
        break;
      case 6U:
        if (value_length != 4U) return SCORING_RELEASE_INVALID_FIELD;
        decoded.esp32_security_floor = read_u32(value);
        if (decoded.esp32_security_floor > UINT16_MAX) return SCORING_RELEASE_SECURITY_RANGE;
        reason = SCORING_RELEASE_OK;
        break;
      case 7U:
        if (value_length != 4U) return SCORING_RELEASE_INVALID_FIELD;
        decoded.stm32_security_floor = read_u32(value);
        reason = SCORING_RELEASE_OK;
        break;
      case 8U:
        if (artifact_count >= SCORING_RELEASE_ARTIFACT_COUNT) return SCORING_RELEASE_ARTIFACT_COUNT_INVALID;
        reason = decode_artifact(value, value_length, &decoded.artifacts[artifact_count]);
        artifact_count += 1U;
        break;
      case 9U:
        reason = decode_string(
          value,
          value_length,
          SCORING_RELEASE_MAX_REVISION_BYTES,
          &decoded.signature_algorithm
        );
        break;
      case 10U:
        reason = decode_string(value, value_length, SCORING_RELEASE_MAX_ID_BYTES, &decoded.signing_domain);
        break;
      case 11U:
        reason = decode_string(value, value_length, SCORING_RELEASE_MAX_ID_BYTES, &decoded.key_id);
        break;
      case 12U:
        if (value_length != 0U && value_length != SCORING_RELEASE_SIGNATURE_BYTES)
          return SCORING_RELEASE_INVALID_FIELD;
        decoded.signature = value;
        decoded.signature_length = value_length;
        decoded.signed_length = field_offset;
        reason = SCORING_RELEASE_OK;
        break;
      default:
        return SCORING_RELEASE_INVALID_FIELD;
    }
    if (reason != SCORING_RELEASE_OK) return reason;
  }
  if (artifact_count != SCORING_RELEASE_ARTIFACT_COUNT) return SCORING_RELEASE_ARTIFACT_COUNT_INVALID;
  if (decoded.artifacts[0].processor == decoded.artifacts[1].processor)
    return SCORING_RELEASE_ARTIFACT_DUPLICATE;
  if (decoded.artifacts[0].processor != SCORING_RELEASE_PROCESSOR_ESP32 ||
      decoded.artifacts[1].processor != SCORING_RELEASE_PROCESSOR_STM32)
    return SCORING_RELEASE_NON_CANONICAL;
  if (cursor.offset != cursor.length) return SCORING_RELEASE_NON_CANONICAL;
  *out_manifest = decoded;
  return SCORING_RELEASE_OK;
}

static bool same_string(const scoring_release_string_t *left, const scoring_release_string_t *right) {
  return left->length == right->length && memcmp(left->bytes, right->bytes, left->length) == 0;
}

static bool stored_equals_text(const scoring_release_string_t *value, const char *text) {
  const size_t text_length = strlen(text);
  return value->length == text_length && memcmp(value->bytes, text, text_length) == 0;
}

static bool valid_stored_string(const scoring_release_string_t *value, size_t maximum) {
  return value != NULL &&
    valid_identifier_bytes(value->bytes, value->length, maximum, sizeof(value->bytes));
}

static bool valid_environment_argument(const scoring_release_environment_t *environment) {
  return valid_stored_string(&environment->product_id, SCORING_RELEASE_MAX_ID_BYTES) &&
         valid_stored_string(&environment->protocol_revision, SCORING_RELEASE_MAX_REVISION_BYTES) &&
         valid_stored_string(&environment->schema_revision, SCORING_RELEASE_MAX_REVISION_BYTES) &&
         valid_stored_string(&environment->config_revision, SCORING_RELEASE_MAX_REVISION_BYTES) &&
         valid_stored_string(&environment->esp32.board_id, SCORING_RELEASE_MAX_ID_BYTES) &&
         valid_stored_string(&environment->esp32.target_id, SCORING_RELEASE_MAX_ID_BYTES) &&
         valid_stored_string(&environment->stm32.board_id, SCORING_RELEASE_MAX_ID_BYTES) &&
         valid_stored_string(&environment->stm32.target_id, SCORING_RELEASE_MAX_ID_BYTES) &&
         environment->esp32.security_version <= UINT16_MAX && environment->esp32.security_floor <= UINT16_MAX &&
         environment->esp32.maximum_security_version <= UINT16_MAX &&
         environment->esp32.security_version <= environment->esp32.maximum_security_version &&
         environment->esp32.security_floor <= environment->esp32.maximum_security_version &&
         environment->esp32.staging_capacity != 0U && environment->stm32.maximum_security_version != 0U &&
         environment->stm32.security_version <= environment->stm32.maximum_security_version &&
         environment->stm32.security_floor <= environment->stm32.maximum_security_version &&
         environment->stm32.staging_capacity != 0U;
}

static const scoring_release_artifact_t *artifact_for_processor(
  const scoring_product_release_manifest_t *manifest,
  scoring_release_processor_t processor
) {
  size_t index;
  for (index = 0U; index < SCORING_RELEASE_ARTIFACT_COUNT; index += 1U)
    if (manifest->artifacts[index].processor == processor) return &manifest->artifacts[index];
  return NULL;
}

static const scoring_release_observed_artifact_t *observed_for_processor(
  const scoring_release_observed_artifact_t observed[SCORING_RELEASE_ARTIFACT_COUNT],
  scoring_release_processor_t processor
) {
  size_t index;
  for (index = 0U; index < SCORING_RELEASE_ARTIFACT_COUNT; index += 1U)
    if (observed[index].processor == processor) return &observed[index];
  return NULL;
}

static const scoring_release_installed_processor_t *installed_for_processor(
  const scoring_release_environment_t *environment,
  scoring_release_processor_t processor
) {
  if (processor == SCORING_RELEASE_PROCESSOR_ESP32) return &environment->esp32;
  if (processor == SCORING_RELEASE_PROCESSOR_STM32) return &environment->stm32;
  return NULL;
}

static uint32_t security_floor_for_processor(
  const scoring_product_release_manifest_t *manifest,
  scoring_release_processor_t processor
) {
  if (processor == SCORING_RELEASE_PROCESSOR_ESP32) return manifest->esp32_security_floor;
  if (processor == SCORING_RELEASE_PROCESSOR_STM32) return manifest->stm32_security_floor;
  return 0U;
}

static scoring_release_reason_t authorize_artifact(
  const scoring_product_release_manifest_t *manifest,
  const scoring_release_artifact_t *artifact,
  const scoring_release_installed_processor_t *installed,
  const scoring_release_observed_artifact_t *observed,
  uint32_t manifest_floor
) {
  if (!same_string(&artifact->board_id, &installed->board_id)) return SCORING_RELEASE_BOARD_MISMATCH;
  if (!same_string(&artifact->target_id, &installed->target_id)) return SCORING_RELEASE_TARGET_MISMATCH;
  if (!same_string(&artifact->protocol_revision, &manifest->protocol_revision))
    return SCORING_RELEASE_PROTOCOL_MISMATCH;
  if (!same_string(&artifact->schema_revision, &manifest->schema_revision)) return SCORING_RELEASE_SCHEMA_MISMATCH;
  if (!same_string(&artifact->config_revision, &manifest->config_revision)) return SCORING_RELEASE_CONFIG_MISMATCH;
  if (manifest_floor < installed->security_floor || artifact->security_version < manifest_floor)
    return SCORING_RELEASE_SECURITY_FLOOR;
  if (artifact->security_version > installed->maximum_security_version)
    return SCORING_RELEASE_SECURITY_RANGE;
  if (artifact->security_version < installed->security_version) return SCORING_RELEASE_DOWNGRADE;
  if (artifact->artifact_length > installed->staging_capacity) return SCORING_RELEASE_CAPACITY_EXCEEDED;
  if (observed->processor != artifact->processor) return SCORING_RELEASE_TARGET_MISMATCH;
  if (observed->artifact_length != artifact->artifact_length) return SCORING_RELEASE_LENGTH_MISMATCH;
  if (memcmp(observed->digest, artifact->digest, SCORING_RELEASE_DIGEST_BYTES) != 0)
    return SCORING_RELEASE_DIGEST_MISMATCH;
  return SCORING_RELEASE_OK;
}

static scoring_release_reason_t authorize_manifest(
  const scoring_product_release_manifest_t *manifest,
  const scoring_release_environment_t *environment,
  const scoring_release_observed_artifact_t observed[SCORING_RELEASE_ARTIFACT_COUNT]
) {
  static const scoring_release_processor_t processors[SCORING_RELEASE_ARTIFACT_COUNT] = {
    SCORING_RELEASE_PROCESSOR_ESP32,
    SCORING_RELEASE_PROCESSOR_STM32
  };
  scoring_release_reason_t reason;
  size_t index;
  if (!valid_environment_argument(environment)) return SCORING_RELEASE_INVALID_ARGUMENT;
  if (!same_string(&manifest->product_id, &environment->product_id)) return SCORING_RELEASE_PRODUCT_MISMATCH;
  if (!same_string(&manifest->protocol_revision, &environment->protocol_revision))
    return SCORING_RELEASE_PROTOCOL_MISMATCH;
  if (!same_string(&manifest->schema_revision, &environment->schema_revision)) return SCORING_RELEASE_SCHEMA_MISMATCH;
  if (!same_string(&manifest->config_revision, &environment->config_revision)) return SCORING_RELEASE_CONFIG_MISMATCH;
  for (index = 0U; index < SCORING_RELEASE_ARTIFACT_COUNT; index += 1U) {
    const scoring_release_processor_t processor = processors[index];
    const scoring_release_artifact_t *artifact = artifact_for_processor(manifest, processor);
    const scoring_release_installed_processor_t *installed = installed_for_processor(environment, processor);
    const scoring_release_observed_artifact_t *observed_artifact = observed_for_processor(observed, processor);
    if (artifact == NULL || installed == NULL || observed_artifact == NULL) return SCORING_RELEASE_TARGET_MISMATCH;
    reason = authorize_artifact(
      manifest,
      artifact,
      installed,
      observed_artifact,
      security_floor_for_processor(manifest, processor)
    );
    if (reason != SCORING_RELEASE_OK) return reason;
  }
  return SCORING_RELEASE_OK;
}

scoring_release_reason_t scoring_product_release_verify_and_authorize(
  const uint8_t *bytes,
  size_t length,
  scoring_release_signature_verifier_t signature_verifier,
  void *signature_context,
  const scoring_release_environment_t *environment,
  const scoring_release_observed_artifact_t observed[SCORING_RELEASE_ARTIFACT_COUNT]
) {
  scoring_product_release_manifest_t manifest;
  scoring_release_signature_request_t request;
  scoring_release_reason_t reason;
  if (bytes == NULL || signature_verifier == NULL || environment == NULL || observed == NULL)
    return SCORING_RELEASE_INVALID_ARGUMENT;
  reason = decode_manifest(bytes, length, &manifest);
  if (reason != SCORING_RELEASE_OK) return reason;
  if (!stored_equals_text(&manifest.signature_algorithm, "ed25519") ||
      !stored_equals_text(&manifest.signing_domain, "scoring-product-release-v1"))
    return SCORING_RELEASE_INVALID_FIELD;
  if (manifest.signature_length == 0U) return SCORING_RELEASE_UNSIGNED;
  request = (scoring_release_signature_request_t){
    .signed_bytes = bytes,
    .signed_length = manifest.signed_length,
    .signature = manifest.signature,
    .signature_length = manifest.signature_length,
    .algorithm = manifest.signature_algorithm,
    .domain = manifest.signing_domain,
    .key_id = manifest.key_id
  };
  if (signature_verifier(signature_context, &request) != SCORING_RELEASE_SIGNATURE_VALID)
    return SCORING_RELEASE_SIGNATURE_INVALID;
  return authorize_manifest(&manifest, environment, observed);
}

const char *scoring_product_release_reason_code(scoring_release_reason_t reason) {
  static const char *const codes[] = {
    "ok",                "invalid-argument",   "truncated",          "oversize",
    "unknown-version",   "non-canonical",      "missing-field",      "duplicate-field",
    "invalid-field",     "artifact-count",     "artifact-duplicate", "unsigned",
    "signature-invalid", "product-mismatch",   "board-mismatch",     "target-mismatch",
    "protocol-mismatch", "schema-mismatch",    "config-mismatch",    "length-mismatch",
    "digest-mismatch",   "security-floor",     "downgrade",          "capacity-exceeded",
    "security-range"
  };
  const size_t count = sizeof(codes) / sizeof(codes[0]);
  if ((unsigned int)reason >= count) return "unknown-reason";
  return codes[(size_t)reason];
}
