#include "scoring_esp32_services.h"

#include <stdio.h>
#include <string.h>

enum {
  APPLICATION_LOAD_ROUNDS = 2048U,
  STM32_TIMESTAMP_OFFSET = 8U,
  STM32_TIMESTAMP_BYTES = 8U
};

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
} fake_link_t;

typedef struct fake_storage {
  uint8_t record[SCORING_ESP32_MAX_TRANSPORT_PAYLOAD_BYTES];
  size_t record_length;
  uint32_t transport_sequence;
  unsigned int calls;
} fake_storage_t;

typedef struct fake_application_service {
  unsigned int calls;
  scoring_esp32_result_t result;
} fake_application_service_t;

static void write_u32_be(uint8_t *bytes, uint32_t value) {
  bytes[0] = (uint8_t)(value >> 24U);
  bytes[1] = (uint8_t)(value >> 16U);
  bytes[2] = (uint8_t)(value >> 8U);
  bytes[3] = (uint8_t)value;
}

static size_t make_decision_frame(
  uint8_t *destination,
  const uint8_t *payload,
  size_t payload_length,
  uint32_t sequence
) {
  const size_t payload_end = SCORING_ESP32_TRANSPORT_HEADER_BYTES + payload_length;
  const size_t frame_length = payload_end + SCORING_ESP32_TRANSPORT_CRC_BYTES;
  uint32_t crc;

  if (payload == NULL || payload_length > SCORING_ESP32_MAX_TRANSPORT_PAYLOAD_BYTES) {
    return 0U;
  }
  destination[0] = 0x53U;
  destination[1] = 0x43U;
  destination[2] = 1U;
  destination[3] = SCORING_ESP32_TRANSPORT_DECISION_RECORD;
  destination[4] = 0U;
  destination[5] = 0U;
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
  if (link == NULL || out_frame_length == NULL || link->frame_length > destination.capacity) {
    return SCORING_ESP32_RESULT_BUFFER_TOO_SMALL;
  }
  (void)memcpy(destination.data, link->frame, link->frame_length);
  *out_frame_length = link->frame_length;
  return SCORING_ESP32_RESULT_OK;
}

static scoring_esp32_result_t fake_append_record(void *context, const scoring_esp32_authoritative_record_t *record) {
  fake_storage_t *storage = context;
  if (storage == NULL || record == NULL || record->bytes.data == NULL ||
      record->bytes.length > sizeof(storage->record)) {
    return SCORING_ESP32_RESULT_INVALID_ARGUMENT;
  }
  (void)memcpy(storage->record, record->bytes.data, record->bytes.length);
  storage->record_length = record->bytes.length;
  storage->transport_sequence = record->transport_sequence;
  storage->calls += 1U;
  return SCORING_ESP32_RESULT_OK;
}

static scoring_esp32_result_t fake_application_bytes(void *context, scoring_esp32_bytes_t bytes) {
  fake_application_service_t *service = context;
  if (service == NULL || bytes.data == NULL || bytes.length != SCORING_ESP32_MAX_TRANSPORT_PAYLOAD_BYTES) {
    return SCORING_ESP32_RESULT_INVALID_ARGUMENT;
  }
  service->calls += 1U;
  return service->result;
}

static bool run_maximum_bounded_application_load(
  const scoring_esp32_app_t *app,
  const uint8_t *application_bytes,
  fake_application_service_t *network,
  fake_application_service_t *display,
  fake_application_service_t *audio
) {
  const scoring_esp32_bytes_t status = {
    .data = application_bytes,
    .length = SCORING_ESP32_MAX_TRANSPORT_PAYLOAD_BYTES
  };
  const unsigned int starting_network_calls = network->calls;
  const unsigned int starting_display_calls = display->calls;
  const unsigned int starting_audio_calls = audio->calls;
  unsigned int round;

  for (round = 0U; round < APPLICATION_LOAD_ROUNDS; ++round) {
    CHECK(scoring_esp32_publish_status(app, status) == SCORING_ESP32_RESULT_BUFFER_TOO_SMALL);
    CHECK(scoring_esp32_present_status(app, status) == SCORING_ESP32_RESULT_UNAVAILABLE);
    CHECK(scoring_esp32_play_notification(app, status) == SCORING_ESP32_RESULT_REJECTED);
  }
  CHECK(network->calls == starting_network_calls + APPLICATION_LOAD_ROUNDS);
  CHECK(display->calls == starting_display_calls + APPLICATION_LOAD_ROUNDS);
  CHECK(audio->calls == starting_audio_calls + APPLICATION_LOAD_ROUNDS);
  return true;
}

static bool accepted_record_matches(
  const scoring_esp32_authoritative_record_t *received,
  const fake_storage_t *storage,
  const uint8_t *expected_bytes,
  size_t expected_length,
  uint32_t expected_sequence
) {
  CHECK(received->transport_sequence == expected_sequence);
  CHECK(received->bytes.length == expected_length);
  CHECK(memcmp(received->bytes.data, expected_bytes, expected_length) == 0);
  CHECK(storage->calls == 1U);
  CHECK(storage->transport_sequence == expected_sequence);
  CHECK(storage->record_length == expected_length);
  CHECK(memcmp(storage->record, expected_bytes, expected_length) == 0);
  /* This fixture span is the STM32 atUs sentinel. It remains opaque to ESP32 code. */
  CHECK(memcmp(
    &storage->record[STM32_TIMESTAMP_OFFSET],
    &expected_bytes[STM32_TIMESTAMP_OFFSET],
    STM32_TIMESTAMP_BYTES
  ) == 0);
  return true;
}

static bool test_application_load_isolated_from_authoritative_record_ingress(void) {
  /* Bytes 8-15 are an opaque STM32 timestamp sentinel, not decoded by this test or the scaffold. */
  static const uint8_t decision_payload[] = {
    0xA1U, 0x41U, 0x74U, 0x55U, 0x73U, 0x01U, 0x9CU, 0x02U,
    0x01U, 0x23U, 0x45U, 0x67U, 0x89U, 0xABU, 0xCDU, 0xEFU,
    0xA1U, 0x67U, 0x6FU, 0x75U, 0x74U, 0x63U, 0x6FU, 0x6DU,
    0x65U, 0x42U, 0x6FU, 0x6BU
  };
  uint8_t frame[SCORING_ESP32_MAX_TRANSPORT_FRAME_BYTES] = {0};
  uint8_t application_bytes[SCORING_ESP32_MAX_TRANSPORT_PAYLOAD_BYTES];
  const uint32_t stm32_sequence = UINT32_C(0x10203040);
  const size_t frame_length = make_decision_frame(frame, decision_payload, sizeof(decision_payload), stm32_sequence);
  fake_link_t link = {.frame = frame, .frame_length = frame_length};
  fake_storage_t storage = {0};
  fake_application_service_t network = {.result = SCORING_ESP32_RESULT_BUFFER_TOO_SMALL};
  fake_application_service_t display = {.result = SCORING_ESP32_RESULT_UNAVAILABLE};
  fake_application_service_t audio = {.result = SCORING_ESP32_RESULT_REJECTED};
  const scoring_esp32_services_t services = {
    .audio = {.context = &audio, .play_notification = fake_application_bytes},
    .display = {.context = &display, .present_status = fake_application_bytes},
    .network = {.context = &network, .publish_status = fake_application_bytes},
    .scoring_link = {.context = &link, .read_frame = fake_read_frame},
    .storage = {.context = &storage, .append_authoritative_record = fake_append_record}
  };
  scoring_esp32_app_t app;
  scoring_esp32_authoritative_record_t received;

  (void)memset(application_bytes, 0x5AU, sizeof(application_bytes));
  CHECK(frame_length != 0U);
  CHECK(scoring_esp32_app_init(&app, &services) == SCORING_ESP32_RESULT_OK);
  CHECK(run_maximum_bounded_application_load(&app, application_bytes, &network, &display, &audio));
  CHECK(scoring_esp32_receive_authoritative_record(&app, &received) == SCORING_ESP32_RESULT_OK);
  CHECK(accepted_record_matches(&received, &storage, decision_payload, sizeof(decision_payload), stm32_sequence));
  CHECK(run_maximum_bounded_application_load(&app, application_bytes, &network, &display, &audio));
  CHECK(accepted_record_matches(&received, &storage, decision_payload, sizeof(decision_payload), stm32_sequence));
  return true;
}

static bool test_application_load_does_not_create_or_reclassify_a_rejected_record(void) {
  static const uint8_t payload[] = {0xA1U, 0x61U, 0x78U, 0x01U};
  uint8_t frame[SCORING_ESP32_MAX_TRANSPORT_FRAME_BYTES] = {0};
  uint8_t application_bytes[SCORING_ESP32_MAX_TRANSPORT_PAYLOAD_BYTES];
  const size_t frame_length = make_decision_frame(frame, payload, sizeof(payload), 7U);
  fake_link_t link = {.frame = frame, .frame_length = frame_length};
  fake_storage_t storage = {0};
  fake_application_service_t network = {.result = SCORING_ESP32_RESULT_BUFFER_TOO_SMALL};
  fake_application_service_t display = {.result = SCORING_ESP32_RESULT_UNAVAILABLE};
  fake_application_service_t audio = {.result = SCORING_ESP32_RESULT_REJECTED};
  const scoring_esp32_services_t services = {
    .audio = {.context = &audio, .play_notification = fake_application_bytes},
    .display = {.context = &display, .present_status = fake_application_bytes},
    .network = {.context = &network, .publish_status = fake_application_bytes},
    .scoring_link = {.context = &link, .read_frame = fake_read_frame},
    .storage = {.context = &storage, .append_authoritative_record = fake_append_record}
  };
  scoring_esp32_app_t app;
  scoring_esp32_authoritative_record_t received = {.bytes = {.data = payload, .length = sizeof(payload)}, .transport_sequence = 7U};

  (void)memset(application_bytes, 0xA5, sizeof(application_bytes));
  CHECK(frame_length != 0U);
  frame[SCORING_ESP32_TRANSPORT_HEADER_BYTES] ^= 1U;
  CHECK(scoring_esp32_app_init(&app, &services) == SCORING_ESP32_RESULT_OK);
  CHECK(run_maximum_bounded_application_load(&app, application_bytes, &network, &display, &audio));
  CHECK(scoring_esp32_receive_authoritative_record(&app, &received) == SCORING_ESP32_RESULT_FRAME_INTEGRITY_FAILURE);
  CHECK(storage.calls == 0U);
  CHECK(received.bytes.data == NULL);
  CHECK(received.bytes.length == 0U);
  CHECK(received.transport_sequence == 0U);
  return true;
}

int main(void) {
  if (!test_application_load_isolated_from_authoritative_record_ingress() ||
      !test_application_load_does_not_create_or_reclassify_a_rejected_record()) {
    return 1;
  }
  return 0;
}
