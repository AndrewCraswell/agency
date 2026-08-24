#include "scoring_esp32_services.h"
#include "esp32_transport_golden_frames.h"

#include <stdio.h>
#include <string.h>

#define CHECK(condition)                                                                                               \
  do {                                                                                                                 \
    if (!(condition)) {                                                                                                \
      (void)fprintf(stderr, "%s:%d: check failed: %s\n", __FILE__, __LINE__, #condition);                         \
      return false;                                                                                                    \
    }                                                                                                                  \
  } while (false)

static void write_u32_be(uint8_t *bytes, uint32_t value) {
  bytes[0] = (uint8_t)(value >> 24U);
  bytes[1] = (uint8_t)(value >> 16U);
  bytes[2] = (uint8_t)(value >> 8U);
  bytes[3] = (uint8_t)value;
}

static size_t make_frame(
  uint8_t *destination,
  scoring_esp32_transport_message_type_t message_type,
  uint16_t flags,
  const uint8_t *payload,
  size_t payload_length,
  uint32_t sequence
) {
  const size_t payload_end = SCORING_ESP32_TRANSPORT_HEADER_BYTES + payload_length;
  const size_t frame_length = payload_end + SCORING_ESP32_TRANSPORT_CRC_BYTES;
  uint32_t crc;
  if (payload_length > SCORING_ESP32_MAX_TRANSPORT_PAYLOAD_BYTES || payload == NULL) {
    return 0U;
  }
  destination[0] = 0x53U;
  destination[1] = 0x43U;
  destination[2] = 1U;
  destination[3] = (uint8_t)message_type;
  destination[4] = (uint8_t)(flags >> 8U);
  destination[5] = (uint8_t)flags;
  write_u32_be(&destination[6], sequence);
  write_u32_be(&destination[10], (uint32_t)payload_length);
  (void)memcpy(&destination[SCORING_ESP32_TRANSPORT_HEADER_BYTES], payload, payload_length);
  crc = scoring_esp32_calculate_crc32c((scoring_esp32_bytes_t){.data = destination, .length = payload_end});
  write_u32_be(&destination[payload_end], crc);
  return frame_length;
}

static bool test_generated_golden_frames_match_esp32_codec(void) {
  static uint8_t maximum_payload[SCORING_ESP32_MAX_TRANSPORT_PAYLOAD_BYTES] = {0};
  uint8_t maximum_frame[SCORING_ESP32_MAX_TRANSPORT_FRAME_BYTES] = {0};
  uint8_t corrupted[SCORING_ESP32_MAX_TRANSPORT_FRAME_BYTES] = {0};
  size_t index;
  scoring_esp32_transport_frame_t decoded;

  CHECK(SCORING_ESP32_TRANSPORT_GOLDEN_FIXTURE_COUNT == 4U);
  for (index = 0U; index < SCORING_ESP32_TRANSPORT_GOLDEN_FIXTURE_COUNT; index += 1U) {
    const scoring_esp32_transport_golden_fixture_t *fixture = &SCORING_ESP32_TRANSPORT_GOLDEN_FIXTURES[index];
    CHECK(scoring_esp32_decode_transport_frame(
            fixture->receiver,
            (scoring_esp32_bytes_t){.data = fixture->frame, .length = fixture->frame_length},
            &decoded
          ) == SCORING_ESP32_RESULT_OK);
    CHECK(decoded.message_type == fixture->message_type);
    CHECK(decoded.sequence == fixture->sequence);
    CHECK(decoded.payload.length == fixture->payload_length);
    CHECK(memcmp(decoded.payload.data, fixture->payload, decoded.payload.length) == 0);
  }

  (void)memcpy(corrupted, SCORING_ESP32_TRANSPORT_GOLDEN_FIXTURES[0].frame,
    SCORING_ESP32_TRANSPORT_GOLDEN_FIXTURES[0].frame_length);
  corrupted[SCORING_ESP32_TRANSPORT_HEADER_BYTES] ^= 1U;
  CHECK(scoring_esp32_decode_transport_frame(
          SCORING_ESP32_TRANSPORT_RECEIVER_ESP32,
          (scoring_esp32_bytes_t){
            .data = corrupted,
            .length = SCORING_ESP32_TRANSPORT_GOLDEN_FIXTURES[0].frame_length
          },
          &decoded
        ) == SCORING_ESP32_RESULT_FRAME_INTEGRITY_FAILURE);
  CHECK(scoring_esp32_decode_transport_frame(
          SCORING_ESP32_TRANSPORT_RECEIVER_ESP32,
          (scoring_esp32_bytes_t){
            .data = SCORING_ESP32_TRANSPORT_GOLDEN_FIXTURES[0].frame,
            .length = SCORING_ESP32_TRANSPORT_GOLDEN_FIXTURES[0].frame_length - 1U
          },
          &decoded
        ) == SCORING_ESP32_RESULT_FRAME_TRUNCATED);
  CHECK(scoring_esp32_decode_transport_frame(
          SCORING_ESP32_TRANSPORT_RECEIVER_STM32,
          (scoring_esp32_bytes_t){
            .data = SCORING_ESP32_TRANSPORT_GOLDEN_FIXTURES[0].frame,
            .length = SCORING_ESP32_TRANSPORT_GOLDEN_FIXTURES[0].frame_length
          },
          &decoded
        ) == SCORING_ESP32_RESULT_FRAME_INVALID);
  (void)memcpy(corrupted, SCORING_ESP32_TRANSPORT_GOLDEN_FIXTURES[0].frame,
    SCORING_ESP32_TRANSPORT_GOLDEN_FIXTURES[0].frame_length);
  corrupted[2] = 2U;
  CHECK(scoring_esp32_decode_transport_frame(
          SCORING_ESP32_TRANSPORT_RECEIVER_ESP32,
          (scoring_esp32_bytes_t){
            .data = corrupted,
            .length = SCORING_ESP32_TRANSPORT_GOLDEN_FIXTURES[0].frame_length
          },
          &decoded
        ) == SCORING_ESP32_RESULT_FRAME_INVALID);
  corrupted[2] = 1U;
  corrupted[3] = 0xFFU;
  CHECK(scoring_esp32_decode_transport_frame(
          SCORING_ESP32_TRANSPORT_RECEIVER_ESP32,
          (scoring_esp32_bytes_t){
            .data = corrupted,
            .length = SCORING_ESP32_TRANSPORT_GOLDEN_FIXTURES[0].frame_length
          },
          &decoded
        ) == SCORING_ESP32_RESULT_FRAME_INVALID);

  maximum_payload[0] = 0x00U;
  maximum_payload[SCORING_ESP32_MAX_TRANSPORT_PAYLOAD_BYTES - 1U] = 0xFFU;
  CHECK(make_frame(
          maximum_frame,
          SCORING_ESP32_TRANSPORT_DECISION_RECORD,
          0U,
          maximum_payload,
          sizeof(maximum_payload),
          1U
        ) == SCORING_ESP32_MAX_TRANSPORT_FRAME_BYTES);
  CHECK(scoring_esp32_decode_transport_frame(
          SCORING_ESP32_TRANSPORT_RECEIVER_ESP32,
          (scoring_esp32_bytes_t){.data = maximum_frame, .length = sizeof(maximum_frame)},
          &decoded
        ) == SCORING_ESP32_RESULT_OK);
  CHECK(decoded.payload.length == sizeof(maximum_payload));
  return true;
}

static bool test_missing_adapters_are_safe_and_unavailable(void) {
  scoring_esp32_app_t app;
  scoring_esp32_identifier_t identifier = {.bytes = {'x'}, .length = 1U};
  scoring_esp32_time_metadata_t metadata = {.is_available = true, .source = SCORING_ESP32_WALL_CLOCK_NETWORK};
  uint64_t monotonic_us = 1U;
  static const uint8_t payload[] = {0x01U};
  const scoring_esp32_bytes_t bytes = {.data = payload, .length = sizeof(payload)};

  CHECK(scoring_esp32_app_init(&app, NULL) == SCORING_ESP32_RESULT_OK);
  CHECK(scoring_esp32_read_monotonic_us(&app, &monotonic_us) == SCORING_ESP32_RESULT_UNAVAILABLE);
  CHECK(monotonic_us == 0U);
  CHECK(scoring_esp32_read_time_metadata(&app, &metadata) == SCORING_ESP32_RESULT_UNAVAILABLE);
  CHECK(!metadata.is_available);
  CHECK(metadata.source == SCORING_ESP32_WALL_CLOCK_UNAVAILABLE);
  CHECK(scoring_esp32_read_boot_id(&app, &identifier) == SCORING_ESP32_RESULT_UNAVAILABLE);
  CHECK(identifier.length == 0U);
  CHECK(identifier.bytes[0] == '\0');
  CHECK(scoring_esp32_read_device_id(&app, &identifier) == SCORING_ESP32_RESULT_UNAVAILABLE);
  CHECK(identifier.length == 0U);
  CHECK(scoring_esp32_publish_status(&app, bytes) == SCORING_ESP32_RESULT_UNAVAILABLE);
  CHECK(scoring_esp32_present_status(&app, bytes) == SCORING_ESP32_RESULT_UNAVAILABLE);
  CHECK(scoring_esp32_play_notification(&app, bytes) == SCORING_ESP32_RESULT_UNAVAILABLE);
  CHECK(scoring_esp32_stage_signed_update(&app, bytes) == SCORING_ESP32_RESULT_UNAVAILABLE);
  CHECK(scoring_esp32_activate_staged_update(&app) == SCORING_ESP32_RESULT_UNAVAILABLE);
  CHECK(scoring_esp32_feed_watchdog(&app) == SCORING_ESP32_RESULT_UNAVAILABLE);
  CHECK(scoring_esp32_request_reset(&app, SCORING_ESP32_RESET_RECOVERY) == SCORING_ESP32_RESULT_UNAVAILABLE);
  return true;
}

static scoring_esp32_result_t callback_read_monotonic(void *context, uint64_t *out_us) {
  (void)context;
  if (out_us == NULL) {
    return SCORING_ESP32_RESULT_INVALID_ARGUMENT;
  }
  *out_us = UINT64_C(123456);
  return SCORING_ESP32_RESULT_OK;
}

static scoring_esp32_result_t callback_read_time(
  void *context,
  scoring_esp32_time_metadata_t *out_metadata
) {
  (void)context;
  if (out_metadata == NULL) {
    return SCORING_ESP32_RESULT_INVALID_ARGUMENT;
  }
  *out_metadata = (scoring_esp32_time_metadata_t){
    .is_available = true,
    .wall_clock_at_us = INT64_C(987654),
    .uncertainty_us = 7U,
    .source = SCORING_ESP32_WALL_CLOCK_RTC
  };
  return SCORING_ESP32_RESULT_OK;
}

static scoring_esp32_result_t callback_read_identifier(
  void *context,
  scoring_esp32_identifier_t *out_identifier
) {
  (void)context;
  if (out_identifier == NULL) {
    return SCORING_ESP32_RESULT_INVALID_ARGUMENT;
  }
  *out_identifier = (scoring_esp32_identifier_t){.bytes = "adapter-id", .length = 10U};
  return SCORING_ESP32_RESULT_OK;
}

static scoring_esp32_result_t callback_read_invalid_identifier(
  void *context,
  scoring_esp32_identifier_t *out_identifier
) {
  (void)context;
  if (out_identifier == NULL) {
    return SCORING_ESP32_RESULT_INVALID_ARGUMENT;
  }
  *out_identifier = (scoring_esp32_identifier_t){.bytes = {'x', 'x'}, .length = 1U};
  return SCORING_ESP32_RESULT_OK;
}

static scoring_esp32_result_t callback_bytes(void *context, scoring_esp32_bytes_t bytes) {
  (void)context;
  (void)bytes;
  return SCORING_ESP32_RESULT_OK;
}

static scoring_esp32_result_t callback_no_arguments(void *context) {
  (void)context;
  return SCORING_ESP32_RESULT_OK;
}

static scoring_esp32_result_t callback_reset(void *context, scoring_esp32_reset_reason_t reason) {
  (void)context;
  (void)reason;
  return SCORING_ESP32_RESULT_OK;
}

static scoring_esp32_result_t callback_read_frame(
  void *context,
  scoring_esp32_mutable_bytes_t destination,
  size_t *out_frame_length
) {
  (void)context;
  (void)destination;
  if (out_frame_length == NULL) {
    return SCORING_ESP32_RESULT_INVALID_ARGUMENT;
  }
  *out_frame_length = 0U;
  return SCORING_ESP32_RESULT_UNAVAILABLE;
}

static bool test_service_callbacks_and_argument_boundaries(void) {
  static const uint8_t payload[] = {0xA5U};
  uint8_t encoded[SCORING_ESP32_TRANSPORT_HEADER_BYTES + sizeof(payload) + SCORING_ESP32_TRANSPORT_CRC_BYTES] = {0};
  scoring_esp32_transport_frame_t frame;
  scoring_esp32_services_t services = {
    .audio = {.play_notification = callback_bytes},
    .clock = {.read_monotonic_us = callback_read_monotonic, .read_time_metadata = callback_read_time},
    .display = {.present_status = callback_bytes},
    .identity = {.read_boot_id = callback_read_identifier, .read_device_id = callback_read_identifier},
    .network = {.publish_status = callback_bytes},
    .reset = {.request_reset = callback_reset},
    .scoring_link = {.read_frame = callback_read_frame},
    .signed_update = {.stage_signed_update = callback_bytes, .activate_staged_update = callback_no_arguments},
    .watchdog = {.feed = callback_no_arguments}
  };
  scoring_esp32_app_t app;
  scoring_esp32_identifier_t identifier = {0};
  scoring_esp32_time_metadata_t metadata = {0};
  uint64_t monotonic_us = 0U;

  CHECK(scoring_esp32_app_init(NULL, &services) == SCORING_ESP32_RESULT_INVALID_ARGUMENT);
  CHECK(scoring_esp32_app_init(&app, &services) == SCORING_ESP32_RESULT_OK);
  CHECK(scoring_esp32_calculate_crc32c((scoring_esp32_bytes_t){.data = NULL, .length = 1U}) == 0U);
  CHECK(scoring_esp32_calculate_crc32c((scoring_esp32_bytes_t){.data = NULL, .length = 0U}) == 0U);
  CHECK(scoring_esp32_decode_transport_frame(
          SCORING_ESP32_TRANSPORT_RECEIVER_ESP32,
          (scoring_esp32_bytes_t){.data = encoded, .length = sizeof(encoded)},
          NULL
        ) ==
        SCORING_ESP32_RESULT_INVALID_ARGUMENT);
  CHECK(scoring_esp32_decode_transport_frame(
          SCORING_ESP32_TRANSPORT_RECEIVER_ESP32,
          (scoring_esp32_bytes_t){.data = NULL, .length = 1U},
          &frame
        ) ==
        SCORING_ESP32_RESULT_INVALID_ARGUMENT);
  CHECK(scoring_esp32_read_monotonic_us(NULL, &monotonic_us) == SCORING_ESP32_RESULT_INVALID_ARGUMENT);
  CHECK(scoring_esp32_read_monotonic_us(&app, NULL) == SCORING_ESP32_RESULT_INVALID_ARGUMENT);
  CHECK(scoring_esp32_read_time_metadata(NULL, &metadata) == SCORING_ESP32_RESULT_INVALID_ARGUMENT);
  CHECK(scoring_esp32_read_time_metadata(&app, NULL) == SCORING_ESP32_RESULT_INVALID_ARGUMENT);
  CHECK(scoring_esp32_read_boot_id(NULL, &identifier) == SCORING_ESP32_RESULT_INVALID_ARGUMENT);
  CHECK(scoring_esp32_read_boot_id(&app, NULL) == SCORING_ESP32_RESULT_INVALID_ARGUMENT);
  CHECK(scoring_esp32_read_device_id(NULL, &identifier) == SCORING_ESP32_RESULT_INVALID_ARGUMENT);
  CHECK(scoring_esp32_read_device_id(&app, NULL) == SCORING_ESP32_RESULT_INVALID_ARGUMENT);
  CHECK(scoring_esp32_publish_status(NULL, (scoring_esp32_bytes_t){0}) == SCORING_ESP32_RESULT_INVALID_ARGUMENT);
  CHECK(scoring_esp32_present_status(NULL, (scoring_esp32_bytes_t){0}) == SCORING_ESP32_RESULT_INVALID_ARGUMENT);
  CHECK(scoring_esp32_play_notification(NULL, (scoring_esp32_bytes_t){0}) == SCORING_ESP32_RESULT_INVALID_ARGUMENT);
  CHECK(scoring_esp32_stage_signed_update(NULL, (scoring_esp32_bytes_t){0}) == SCORING_ESP32_RESULT_INVALID_ARGUMENT);
  CHECK(scoring_esp32_activate_staged_update(NULL) == SCORING_ESP32_RESULT_INVALID_ARGUMENT);
  CHECK(scoring_esp32_feed_watchdog(NULL) == SCORING_ESP32_RESULT_INVALID_ARGUMENT);
  CHECK(scoring_esp32_request_reset(NULL, SCORING_ESP32_RESET_OPERATOR) == SCORING_ESP32_RESULT_INVALID_ARGUMENT);

  CHECK(scoring_esp32_read_monotonic_us(&app, &monotonic_us) == SCORING_ESP32_RESULT_OK);
  CHECK(monotonic_us == UINT64_C(123456));
  CHECK(scoring_esp32_read_time_metadata(&app, &metadata) == SCORING_ESP32_RESULT_OK);
  CHECK(metadata.is_available && metadata.wall_clock_at_us == INT64_C(987654));
  CHECK(scoring_esp32_read_boot_id(&app, &identifier) == SCORING_ESP32_RESULT_OK);
  CHECK(strcmp(identifier.bytes, "adapter-id") == 0);
  CHECK(scoring_esp32_read_device_id(&app, &identifier) == SCORING_ESP32_RESULT_OK);
  CHECK(strcmp(identifier.bytes, "adapter-id") == 0);
  CHECK(scoring_esp32_publish_status(&app, (scoring_esp32_bytes_t){.data = payload, .length = sizeof(payload)}) ==
        SCORING_ESP32_RESULT_OK);
  CHECK(scoring_esp32_present_status(&app, (scoring_esp32_bytes_t){.data = payload, .length = sizeof(payload)}) ==
        SCORING_ESP32_RESULT_OK);
  CHECK(scoring_esp32_play_notification(&app, (scoring_esp32_bytes_t){.data = payload, .length = sizeof(payload)}) ==
        SCORING_ESP32_RESULT_OK);
  CHECK(scoring_esp32_stage_signed_update(&app, (scoring_esp32_bytes_t){.data = payload, .length = sizeof(payload)}) ==
        SCORING_ESP32_RESULT_OK);
  CHECK(scoring_esp32_activate_staged_update(&app) == SCORING_ESP32_RESULT_OK);
  CHECK(scoring_esp32_feed_watchdog(&app) == SCORING_ESP32_RESULT_OK);
  CHECK(scoring_esp32_request_reset(&app, SCORING_ESP32_RESET_UPDATE) == SCORING_ESP32_RESULT_OK);
  services.identity.read_boot_id = callback_read_invalid_identifier;
  CHECK(scoring_esp32_app_init(&app, &services) == SCORING_ESP32_RESULT_OK);
  CHECK(scoring_esp32_read_boot_id(&app, &identifier) == SCORING_ESP32_RESULT_INVALID_ARGUMENT);
  CHECK(identifier.length == 0U && identifier.bytes[0] == '\0');
  return true;
}

int main(void) {
  if (!test_generated_golden_frames_match_esp32_codec() || !test_missing_adapters_are_safe_and_unavailable() ||
      !test_service_callbacks_and_argument_boundaries()) {
    return 1;
  }
  return 0;
}
