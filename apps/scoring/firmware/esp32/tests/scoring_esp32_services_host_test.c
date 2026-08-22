#include "scoring_esp32_services.h"

#include <stdio.h>
#include <string.h>

#define CHECK(condition)                                                                                               \
  do {                                                                                                                 \
    if (!(condition)) {                                                                                                \
      (void)fprintf(stderr, "%s:%d: check failed: %s\n", __FILE__, __LINE__, #condition);                         \
      return false;                                                                                                    \
    }                                                                                                                  \
  } while (false)

typedef struct fake_link {
  const uint8_t *frame;
  size_t frame_length;
  size_t reported_length;
} fake_link_t;

typedef struct fake_storage {
  uint8_t record[SCORING_ESP32_MAX_TRANSPORT_PAYLOAD_BYTES];
  size_t record_length;
  scoring_esp32_result_t result;
  uint32_t sequence;
  unsigned int calls;
} fake_storage_t;

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

static scoring_esp32_result_t fake_read_frame(
  void *context,
  scoring_esp32_mutable_bytes_t destination,
  size_t *out_frame_length
) {
  const fake_link_t *link = context;
  if (link == NULL || out_frame_length == NULL || (destination.data == NULL && destination.capacity != 0U)) {
    return SCORING_ESP32_RESULT_INVALID_ARGUMENT;
  }
  if (link->frame_length > destination.capacity) {
    return SCORING_ESP32_RESULT_BUFFER_TOO_SMALL;
  }
  (void)memcpy(destination.data, link->frame, link->frame_length);
  *out_frame_length = link->reported_length;
  return SCORING_ESP32_RESULT_OK;
}

static scoring_esp32_result_t fake_append_record(void *context, const scoring_esp32_authoritative_record_t *record) {
  fake_storage_t *storage = context;
  if (storage == NULL || record == NULL || record->bytes.length > sizeof(storage->record) ||
      (record->bytes.data == NULL && record->bytes.length != 0U)) {
    return SCORING_ESP32_RESULT_INVALID_ARGUMENT;
  }
  (void)memcpy(storage->record, record->bytes.data, record->bytes.length);
  storage->record_length = record->bytes.length;
  storage->sequence = record->transport_sequence;
  storage->calls += 1U;
  return storage->result;
}

static scoring_esp32_services_t receive_services(fake_link_t *link, fake_storage_t *storage) {
  return (scoring_esp32_services_t){
    .scoring_link = {.context = link, .read_frame = fake_read_frame},
    .storage = {.context = storage, .append_authoritative_record = fake_append_record}
  };
}

static bool received_record_is_empty(const scoring_esp32_authoritative_record_t *record) {
  return record->bytes.data == NULL && record->bytes.length == 0U && record->transport_sequence == 0U;
}

static bool test_valid_m2_05_frame_reaches_storage_as_opaque_authority(void) {
  static const uint8_t payload[] = {0xA1U, 0x01U, 0xDEU, 0xADU, 0xBEU, 0xEFU};
  uint8_t frame[SCORING_ESP32_MAX_TRANSPORT_FRAME_BYTES] = {0};
  const size_t frame_length = make_frame(
    frame,
    SCORING_ESP32_TRANSPORT_DECISION_RECORD,
    0U,
    payload,
    sizeof(payload),
    41U
  );
  fake_link_t link = {.frame = frame, .frame_length = frame_length, .reported_length = frame_length};
  fake_storage_t storage = {.result = SCORING_ESP32_RESULT_OK};
  scoring_esp32_services_t services = receive_services(&link, &storage);
  scoring_esp32_app_t app;
  scoring_esp32_authoritative_record_t received;

  CHECK(frame_length != 0U);
  CHECK(scoring_esp32_app_init(&app, &services) == SCORING_ESP32_RESULT_OK);
  CHECK(scoring_esp32_receive_authoritative_record(&app, &received) == SCORING_ESP32_RESULT_OK);
  CHECK(received.transport_sequence == 41U);
  CHECK(received.bytes.length == sizeof(payload));
  CHECK(memcmp(received.bytes.data, payload, sizeof(payload)) == 0);
  CHECK(storage.calls == 1U);
  CHECK(storage.sequence == 41U);
  CHECK(storage.record_length == sizeof(payload));
  CHECK(memcmp(storage.record, payload, sizeof(payload)) == 0);
  return true;
}

static bool test_rejected_frames_never_reach_storage(void) {
  static const uint8_t payload[] = {0x81U, 0x01U};
  uint8_t frame[SCORING_ESP32_MAX_TRANSPORT_FRAME_BYTES] = {0};
  fake_storage_t storage = {.result = SCORING_ESP32_RESULT_OK};
  fake_link_t link = {0};
  scoring_esp32_services_t services = receive_services(&link, &storage);
  scoring_esp32_app_t app;
  scoring_esp32_authoritative_record_t received = {.bytes = {.data = payload, .length = sizeof(payload)}, .transport_sequence = 9U};
  size_t frame_length;

  CHECK(scoring_esp32_app_init(&app, &services) == SCORING_ESP32_RESULT_OK);

  frame_length = make_frame(frame, SCORING_ESP32_TRANSPORT_STATUS, 0U, payload, sizeof(payload), 1U);
  link = (fake_link_t){.frame = frame, .frame_length = frame_length, .reported_length = frame_length};
  CHECK(scoring_esp32_receive_authoritative_record(&app, &received) == SCORING_ESP32_RESULT_REJECTED);
  CHECK(storage.calls == 0U);
  CHECK(received_record_is_empty(&received));

  frame_length = make_frame(frame, SCORING_ESP32_TRANSPORT_DECISION_RECORD, 1U, payload, sizeof(payload), 2U);
  link = (fake_link_t){.frame = frame, .frame_length = frame_length, .reported_length = frame_length};
  CHECK(scoring_esp32_receive_authoritative_record(&app, &received) == SCORING_ESP32_RESULT_FRAME_INVALID);
  CHECK(storage.calls == 0U);
  CHECK(received_record_is_empty(&received));

  frame_length = make_frame(frame, SCORING_ESP32_TRANSPORT_DECISION_RECORD, 0U, payload, sizeof(payload), 3U);
  frame[SCORING_ESP32_TRANSPORT_HEADER_BYTES] ^= 1U;
  link = (fake_link_t){.frame = frame, .frame_length = frame_length, .reported_length = frame_length};
  CHECK(scoring_esp32_receive_authoritative_record(&app, &received) == SCORING_ESP32_RESULT_FRAME_INTEGRITY_FAILURE);
  CHECK(storage.calls == 0U);
  CHECK(received_record_is_empty(&received));

  frame_length = make_frame(frame, SCORING_ESP32_TRANSPORT_DECISION_RECORD, 0U, payload, sizeof(payload), 3U);
  write_u32_be(&frame[10], (uint32_t)(sizeof(payload) + 1U));
  link = (fake_link_t){.frame = frame, .frame_length = frame_length, .reported_length = frame_length};
  CHECK(scoring_esp32_receive_authoritative_record(&app, &received) == SCORING_ESP32_RESULT_FRAME_TRUNCATED);
  CHECK(storage.calls == 0U);
  CHECK(received_record_is_empty(&received));

  frame_length = make_frame(frame, SCORING_ESP32_TRANSPORT_DECISION_RECORD, 0U, payload, sizeof(payload), 4U);
  write_u32_be(&frame[10], SCORING_ESP32_MAX_TRANSPORT_PAYLOAD_BYTES + 1U);
  link = (fake_link_t){.frame = frame, .frame_length = frame_length, .reported_length = frame_length};
  CHECK(scoring_esp32_receive_authoritative_record(&app, &received) == SCORING_ESP32_RESULT_FRAME_INVALID);
  CHECK(storage.calls == 0U);
  CHECK(received_record_is_empty(&received));

  link = (fake_link_t){
    .frame = frame,
    .frame_length = 0U,
    .reported_length = SCORING_ESP32_MAX_TRANSPORT_FRAME_BYTES + 1U
  };
  CHECK(scoring_esp32_receive_authoritative_record(&app, &received) == SCORING_ESP32_RESULT_BUFFER_TOO_SMALL);
  CHECK(storage.calls == 0U);
  CHECK(received_record_is_empty(&received));
  return true;
}

static bool test_storage_failure_does_not_return_a_record(void) {
  static const uint8_t payload[] = {0x81U, 0x02U};
  uint8_t frame[SCORING_ESP32_MAX_TRANSPORT_FRAME_BYTES] = {0};
  const size_t frame_length = make_frame(
    frame,
    SCORING_ESP32_TRANSPORT_DECISION_RECORD,
    0U,
    payload,
    sizeof(payload),
    5U
  );
  fake_link_t link = {.frame = frame, .frame_length = frame_length, .reported_length = frame_length};
  fake_storage_t storage = {.result = SCORING_ESP32_RESULT_UNAVAILABLE};
  scoring_esp32_services_t services = receive_services(&link, &storage);
  scoring_esp32_app_t app;
  scoring_esp32_authoritative_record_t received = {.bytes = {.data = payload, .length = sizeof(payload)}, .transport_sequence = 9U};

  CHECK(scoring_esp32_app_init(&app, &services) == SCORING_ESP32_RESULT_OK);
  CHECK(scoring_esp32_receive_authoritative_record(&app, &received) == SCORING_ESP32_RESULT_UNAVAILABLE);
  CHECK(storage.calls == 1U);
  CHECK(received_record_is_empty(&received));
  return true;
}

static bool test_missing_adapters_are_safe_and_unavailable(void) {
  scoring_esp32_app_t app;
  scoring_esp32_identifier_t identifier = {.bytes = {'x'}, .length = 1U};
  scoring_esp32_time_metadata_t metadata = {.is_available = true, .source = SCORING_ESP32_WALL_CLOCK_NETWORK};
  scoring_esp32_authoritative_record_t received;
  uint64_t monotonic_us = 1U;
  static const uint8_t payload[] = {0x01U};
  const scoring_esp32_bytes_t bytes = {.data = payload, .length = sizeof(payload)};

  CHECK(scoring_esp32_app_init(&app, NULL) == SCORING_ESP32_RESULT_OK);
  CHECK(scoring_esp32_receive_authoritative_record(&app, &received) == SCORING_ESP32_RESULT_UNAVAILABLE);
  CHECK(received_record_is_empty(&received));
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

int main(void) {
  if (!test_valid_m2_05_frame_reaches_storage_as_opaque_authority() || !test_rejected_frames_never_reach_storage() ||
      !test_storage_failure_does_not_return_a_record() || !test_missing_adapters_are_safe_and_unavailable()) {
    return 1;
  }
  return 0;
}
