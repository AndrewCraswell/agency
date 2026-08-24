#include "scoring_esp32_receiver.h"

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
  scoring_esp32_result_t result;
} fake_link_t;

typedef struct reset_observer {
  unsigned int reset_calls;
  unsigned int identity_calls;
  scoring_esp32_identifier_t boot_id;
  scoring_esp32_result_t boot_result;
} reset_observer_t;

static scoring_esp32_journal_storage_t test_storage;
_Static_assert(
  sizeof(test_storage) >= SCORING_ESP32_JOURNAL_HOST_STORAGE_MIN_BYTES,
  "host journal storage must retain its layout minimum"
);
_Static_assert(
  sizeof(test_storage) <= SCORING_ESP32_JOURNAL_HOST_STORAGE_MAX_BYTES,
  "host journal storage must retain its maximum bound"
);

static void write_u32_be(uint8_t *bytes, uint32_t value) {
  bytes[0] = (uint8_t)(value >> 24U);
  bytes[1] = (uint8_t)(value >> 16U);
  bytes[2] = (uint8_t)(value >> 8U);
  bytes[3] = (uint8_t)value;
}

static void set_boot_id(reset_observer_t *observer, const char *value) {
  const size_t length = strlen(value);
  (void)memset(&observer->boot_id, 0, sizeof(observer->boot_id));
  (void)memcpy(observer->boot_id.bytes, value, length);
  observer->boot_id.length = length;
  observer->boot_result = SCORING_ESP32_RESULT_OK;
}

static size_t make_frame(
  uint8_t *destination,
  scoring_esp32_transport_message_type_t message_type,
  const uint8_t *payload,
  size_t payload_length,
  uint32_t sequence
) {
  const size_t payload_end = SCORING_ESP32_TRANSPORT_HEADER_BYTES + payload_length;
  const size_t frame_length = payload_end + SCORING_ESP32_TRANSPORT_CRC_BYTES;
  uint32_t crc;
  if (destination == NULL || payload == NULL || payload_length > SCORING_ESP32_MAX_TRANSPORT_PAYLOAD_BYTES) {
    return 0U;
  }
  destination[0] = 0x53U;
  destination[1] = 0x43U;
  destination[2] = 1U;
  destination[3] = (uint8_t)message_type;
  destination[4] = 0U;
  destination[5] = 0U;
  write_u32_be(&destination[6], sequence);
  write_u32_be(&destination[10], (uint32_t)payload_length);
  (void)memcpy(&destination[SCORING_ESP32_TRANSPORT_HEADER_BYTES], payload, payload_length);
  crc = scoring_esp32_calculate_crc32c((scoring_esp32_bytes_t){.data = destination, .length = payload_end});
  write_u32_be(&destination[payload_end], crc);
  return frame_length;
}

static size_t make_decision_frame(
  uint8_t *destination,
  const uint8_t *payload,
  size_t payload_length,
  uint32_t sequence
) {
  return make_frame(destination, SCORING_ESP32_TRANSPORT_DECISION_RECORD, payload, payload_length, sequence);
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
  if (link->result != SCORING_ESP32_RESULT_OK) {
    *out_frame_length = 0U;
    return link->result;
  }
  if (link->frame_length > destination.capacity) {
    return SCORING_ESP32_RESULT_BUFFER_TOO_SMALL;
  }
  if (link->frame_length != 0U) {
    (void)memcpy(destination.data, link->frame, link->frame_length);
  }
  *out_frame_length = link->frame_length;
  return SCORING_ESP32_RESULT_OK;
}

static scoring_esp32_result_t fake_request_reset(void *context, scoring_esp32_reset_reason_t reason) {
  reset_observer_t *observer = context;
  (void)reason;
  if (observer == NULL) {
    return SCORING_ESP32_RESULT_INVALID_ARGUMENT;
  }
  observer->reset_calls += 1U;
  return SCORING_ESP32_RESULT_OK;
}

static scoring_esp32_result_t fake_read_boot_id(void *context, scoring_esp32_identifier_t *out_boot_id) {
  reset_observer_t *observer = context;
  if (observer == NULL || out_boot_id == NULL) {
    return SCORING_ESP32_RESULT_INVALID_ARGUMENT;
  }
  observer->identity_calls += 1U;
  *out_boot_id = observer->boot_id;
  return observer->boot_result;
}

static scoring_esp32_services_t services_for(fake_link_t *link, reset_observer_t *observer) {
  return (scoring_esp32_services_t){
    .identity = {.context = observer, .read_boot_id = fake_read_boot_id},
    .reset = {.context = observer, .request_reset = fake_request_reset},
    .scoring_link = {.context = link, .read_frame = fake_read_frame}
  };
}

static bool replay_matches(
  const scoring_esp32_journal_t *journal,
  size_t index,
  const uint8_t *expected_bytes,
  size_t expected_length,
  uint32_t expected_sequence
) {
  uint8_t replay[SCORING_ESP32_MAX_TRANSPORT_PAYLOAD_BYTES] = {0};
  size_t replay_length = 0U;
  uint32_t replay_sequence = 0U;
  CHECK(scoring_esp32_journal_replay(
    journal,
    index,
    (scoring_esp32_mutable_bytes_t){.data = replay, .capacity = sizeof(replay)},
    &replay_length,
    &replay_sequence
  ) == SCORING_ESP32_RESULT_OK);
  CHECK(replay_length == expected_length);
  CHECK(replay_sequence == expected_sequence);
  CHECK(memcmp(replay, expected_bytes, expected_length) == 0);
  return true;
}

static bool test_host_storage_size_is_measured_bound(void) {
  CHECK(sizeof(test_storage) == SCORING_ESP32_JOURNAL_HOST_STORAGE_MAX_BYTES);
  return true;
}

static bool test_accept_duplicate_corruption_reorder_and_replay(void) {
  static const uint8_t first_payload[] = {0xA1U, 0x00U, 0xFFU, 0x11U};
  static const uint8_t second_payload[] = {0xA1U, 0x01U, 0xFEU, 0x22U};
  uint8_t first_frame[SCORING_ESP32_MAX_TRANSPORT_FRAME_BYTES] = {0};
  uint8_t second_frame[SCORING_ESP32_MAX_TRANSPORT_FRAME_BYTES] = {0};
  uint8_t corrupted_frame[SCORING_ESP32_MAX_TRANSPORT_FRAME_BYTES] = {0};
  const size_t first_length = make_decision_frame(first_frame, first_payload, sizeof(first_payload), 10U);
  const size_t second_length = make_decision_frame(second_frame, second_payload, sizeof(second_payload), 11U);
  fake_link_t link = {.frame = first_frame, .frame_length = first_length};
  reset_observer_t observer = {0};
  scoring_esp32_services_t services;
  scoring_esp32_receiver_t receiver;
  scoring_esp32_receiver_receipt_t receipt;
  uint32_t expected_sequence = 0U;

  set_boot_id(&observer, "boot-1");
  services = services_for(&link, &observer);
  CHECK(first_length != 0U);
  CHECK(second_length != 0U);
  scoring_esp32_journal_storage_init(&test_storage);
  CHECK(scoring_esp32_receiver_init(&receiver, &services, &test_storage, 4U) == SCORING_ESP32_RESULT_OK);
  CHECK(scoring_esp32_receiver_receive(&receiver, &receipt) == SCORING_ESP32_RESULT_OK);
  CHECK(receipt.outcome == SCORING_ESP32_RECEIVER_ACCEPTED);
  CHECK(receipt.record.length == sizeof(first_payload));
  CHECK(memcmp(receipt.record.data, first_payload, sizeof(first_payload)) == 0);
  CHECK(scoring_esp32_journal_count(scoring_esp32_receiver_journal(&receiver)) == 1U);
  CHECK(scoring_esp32_receiver_has_expected_sequence(&receiver, &expected_sequence));
  CHECK(expected_sequence == 11U);

  CHECK(scoring_esp32_receiver_receive(&receiver, &receipt) == SCORING_ESP32_RESULT_DUPLICATE);
  CHECK(scoring_esp32_journal_count(scoring_esp32_receiver_journal(&receiver)) == 1U);
  CHECK(!scoring_esp32_receiver_is_link_degraded(&receiver));

  (void)memcpy(corrupted_frame, second_frame, second_length);
  corrupted_frame[SCORING_ESP32_TRANSPORT_HEADER_BYTES] ^= 1U;
  link = (fake_link_t){.frame = corrupted_frame, .frame_length = second_length};
  CHECK(scoring_esp32_receiver_receive(&receiver, &receipt) == SCORING_ESP32_RESULT_FRAME_INTEGRITY_FAILURE);
  CHECK(scoring_esp32_journal_count(scoring_esp32_receiver_journal(&receiver)) == 1U);
  CHECK(scoring_esp32_receiver_is_link_degraded(&receiver));

  link = (fake_link_t){.frame = second_frame, .frame_length = second_length};
  second_frame[9] = 12U;
  write_u32_be(&second_frame[SCORING_ESP32_TRANSPORT_HEADER_BYTES + sizeof(second_payload)],
    scoring_esp32_calculate_crc32c((scoring_esp32_bytes_t){.data = second_frame, .length = second_length - 4U}));
  CHECK(scoring_esp32_receiver_receive(&receiver, &receipt) == SCORING_ESP32_RESULT_OUT_OF_ORDER);
  second_frame[9] = 11U;
  write_u32_be(&second_frame[SCORING_ESP32_TRANSPORT_HEADER_BYTES + sizeof(second_payload)],
    scoring_esp32_calculate_crc32c((scoring_esp32_bytes_t){.data = second_frame, .length = second_length - 4U}));
  CHECK(scoring_esp32_receiver_receive(&receiver, &receipt) == SCORING_ESP32_RESULT_OK);
  CHECK(replay_matches(scoring_esp32_receiver_journal(&receiver), 1U, second_payload, sizeof(second_payload), 11U));
  CHECK(observer.reset_calls == 0U);
  return true;
}

static bool test_backpressure_retains_expected_sequence(void) {
  static const uint8_t first_payload[] = {0x01U};
  static const uint8_t second_payload[] = {0x02U};
  uint8_t first_frame[SCORING_ESP32_MAX_TRANSPORT_FRAME_BYTES] = {0};
  uint8_t second_frame[SCORING_ESP32_MAX_TRANSPORT_FRAME_BYTES] = {0};
  const size_t first_length = make_decision_frame(first_frame, first_payload, sizeof(first_payload), 1U);
  const size_t second_length = make_decision_frame(second_frame, second_payload, sizeof(second_payload), 2U);
  fake_link_t link = {.frame = first_frame, .frame_length = first_length};
  reset_observer_t observer = {0};
  scoring_esp32_services_t services;
  scoring_esp32_receiver_t receiver;
  scoring_esp32_receiver_receipt_t receipt;
  uint32_t expected_sequence = 0U;

  set_boot_id(&observer, "boot-1");
  link.result = SCORING_ESP32_RESULT_OK;
  services = services_for(&link, &observer);
  scoring_esp32_journal_storage_init(&test_storage);
  CHECK(scoring_esp32_receiver_init(&receiver, &services, &test_storage, 1U) == SCORING_ESP32_RESULT_OK);
  CHECK(scoring_esp32_receiver_receive(&receiver, &receipt) == SCORING_ESP32_RESULT_OK);
  link = (fake_link_t){.frame = second_frame, .frame_length = second_length};
  CHECK(scoring_esp32_receiver_receive(&receiver, &receipt) == SCORING_ESP32_RESULT_BACKPRESSURE);
  CHECK(scoring_esp32_receiver_has_expected_sequence(&receiver, &expected_sequence));
  CHECK(expected_sequence == 2U);
  return true;
}

static bool test_power_loss_recovers_multiple_record_checkpoint(void) {
  static const uint8_t payloads[4][2] = {{0xA5U, 0x50U}, {0xA5U, 0x51U}, {0xA5U, 0x52U}, {0xA5U, 0x53U}};
  const scoring_esp32_journal_write_boundary_t boundaries[] = {
    SCORING_ESP32_JOURNAL_PREPARED_HEADER,
    SCORING_ESP32_JOURNAL_PREPARED_RECORDS,
    SCORING_ESP32_JOURNAL_PREPARED_INTEGRITY,
    SCORING_ESP32_JOURNAL_COMMIT_MARKER
  };
  size_t boundary_index;
  for (boundary_index = 0U; boundary_index < sizeof(boundaries) / sizeof(boundaries[0]); ++boundary_index) {
    uint8_t frames[4][SCORING_ESP32_MAX_TRANSPORT_FRAME_BYTES] = {{0}};
    size_t lengths[4];
    fake_link_t link;
    reset_observer_t observer = {0};
    scoring_esp32_services_t services;
    scoring_esp32_receiver_t receiver;
    scoring_esp32_receiver_receipt_t receipt;
    size_t index;
    for (index = 0U; index < 4U; ++index) {
      lengths[index] = make_decision_frame(frames[index], payloads[index], sizeof(payloads[index]), 77U + (uint32_t)index);
      CHECK(lengths[index] != 0U);
    }
    set_boot_id(&observer, "boot-1");
    link = (fake_link_t){.frame = frames[0], .frame_length = lengths[0]};
    services = services_for(&link, &observer);
    scoring_esp32_journal_storage_init(&test_storage);
    CHECK(scoring_esp32_receiver_init(&receiver, &services, &test_storage, 8U) == SCORING_ESP32_RESULT_OK);
    for (index = 0U; index < 3U; ++index) {
      link = (fake_link_t){.frame = frames[index], .frame_length = lengths[index]};
      CHECK(scoring_esp32_receiver_receive(&receiver, &receipt) == SCORING_ESP32_RESULT_OK);
    }
    scoring_esp32_journal_arm_power_loss(&test_storage, boundaries[boundary_index]);
    link = (fake_link_t){.frame = frames[3], .frame_length = lengths[3]};
    CHECK(scoring_esp32_receiver_receive(&receiver, &receipt) == SCORING_ESP32_RESULT_POWER_LOSS);
    set_boot_id(&observer, "boot-2");
    CHECK(scoring_esp32_receiver_reset(&receiver) == SCORING_ESP32_RESULT_OK);
    if (boundaries[boundary_index] == SCORING_ESP32_JOURNAL_COMMIT_MARKER) {
      CHECK(scoring_esp32_journal_count(scoring_esp32_receiver_journal(&receiver)) == 4U);
      for (index = 0U; index < 4U; ++index) {
        CHECK(replay_matches(scoring_esp32_receiver_journal(&receiver), index, payloads[index], sizeof(payloads[index]), 77U + (uint32_t)index));
      }
      CHECK(scoring_esp32_receiver_receive(&receiver, &receipt) == SCORING_ESP32_RESULT_DUPLICATE);
    } else {
      CHECK(scoring_esp32_journal_count(scoring_esp32_receiver_journal(&receiver)) == 3U);
      for (index = 0U; index < 3U; ++index) {
        CHECK(replay_matches(scoring_esp32_receiver_journal(&receiver), index, payloads[index], sizeof(payloads[index]), 77U + (uint32_t)index));
      }
      CHECK(scoring_esp32_receiver_receive(&receiver, &receipt) == SCORING_ESP32_RESULT_OK);
      CHECK(replay_matches(scoring_esp32_receiver_journal(&receiver), 3U, payloads[3], sizeof(payloads[3]), 80U));
    }
    CHECK(observer.reset_calls == 0U);
  }
  return true;
}

static bool test_reset_restores_decision_cursor_and_next_frame(void) {
  static const uint8_t first_payload[] = {0x33U, 0x44U};
  static const uint8_t second_payload[] = {0x55U, 0x66U};
  uint8_t first_frame[SCORING_ESP32_MAX_TRANSPORT_FRAME_BYTES] = {0};
  uint8_t second_frame[SCORING_ESP32_MAX_TRANSPORT_FRAME_BYTES] = {0};
  const size_t first_length = make_decision_frame(first_frame, first_payload, sizeof(first_payload), 8U);
  const size_t second_length = make_decision_frame(second_frame, second_payload, sizeof(second_payload), 9U);
  fake_link_t link = {.frame = first_frame, .frame_length = first_length};
  reset_observer_t observer = {0};
  scoring_esp32_services_t services;
  scoring_esp32_receiver_t receiver;
  scoring_esp32_receiver_receipt_t receipt;
  scoring_esp32_identifier_t boot_id;

  set_boot_id(&observer, "boot-1");
  services = services_for(&link, &observer);
  scoring_esp32_journal_storage_init(&test_storage);
  CHECK(scoring_esp32_receiver_init(&receiver, &services, &test_storage, 4U) == SCORING_ESP32_RESULT_OK);
  CHECK(scoring_esp32_receiver_receive(&receiver, &receipt) == SCORING_ESP32_RESULT_OK);
  set_boot_id(&observer, "boot-2");
  CHECK(scoring_esp32_receiver_reset(&receiver) == SCORING_ESP32_RESULT_OK);
  CHECK(scoring_esp32_receiver_read_application_boot_id(&receiver, &boot_id) == SCORING_ESP32_RESULT_OK);
  CHECK(strcmp(boot_id.bytes, "boot-2") == 0);
  CHECK(scoring_esp32_receiver_receive(&receiver, &receipt) == SCORING_ESP32_RESULT_DUPLICATE);
  CHECK(receipt.outcome == SCORING_ESP32_RECEIVER_REJECTED);
  link = (fake_link_t){.frame = second_frame, .frame_length = second_length};
  CHECK(scoring_esp32_receiver_receive(&receiver, &receipt) == SCORING_ESP32_RESULT_OK);
  CHECK(replay_matches(scoring_esp32_receiver_journal(&receiver), 1U, second_payload, sizeof(second_payload), 9U));
  CHECK(observer.reset_calls == 0U);
  return true;
}

static bool test_reset_restores_ignored_cursor(void) {
  static const uint8_t status_payload[] = {0x70U};
  static const uint8_t decision_payload[] = {0x71U};
  uint8_t status_frame[SCORING_ESP32_MAX_TRANSPORT_FRAME_BYTES] = {0};
  uint8_t decision_frame[SCORING_ESP32_MAX_TRANSPORT_FRAME_BYTES] = {0};
  const size_t status_length = make_frame(status_frame, SCORING_ESP32_TRANSPORT_STATUS, status_payload, sizeof(status_payload), 30U);
  const size_t decision_length = make_decision_frame(decision_frame, decision_payload, sizeof(decision_payload), 31U);
  fake_link_t link = {.frame = status_frame, .frame_length = status_length};
  reset_observer_t observer = {0};
  scoring_esp32_services_t services;
  scoring_esp32_receiver_t receiver;
  scoring_esp32_receiver_receipt_t receipt;
  uint32_t expected_sequence = 0U;

  set_boot_id(&observer, "boot-1");
  services = services_for(&link, &observer);
  scoring_esp32_journal_storage_init(&test_storage);
  CHECK(scoring_esp32_receiver_init(&receiver, &services, &test_storage, 4U) == SCORING_ESP32_RESULT_OK);
  CHECK(scoring_esp32_receiver_receive(&receiver, &receipt) == SCORING_ESP32_RESULT_IGNORED);
  CHECK(receipt.outcome == SCORING_ESP32_RECEIVER_IGNORED);
  CHECK(scoring_esp32_receiver_has_expected_sequence(&receiver, &expected_sequence));
  CHECK(expected_sequence == 31U);
  set_boot_id(&observer, "boot-2");
  CHECK(scoring_esp32_receiver_reset(&receiver) == SCORING_ESP32_RESULT_OK);
  CHECK(scoring_esp32_receiver_has_expected_sequence(&receiver, &expected_sequence));
  CHECK(expected_sequence == 31U);
  CHECK(scoring_esp32_receiver_receive(&receiver, &receipt) == SCORING_ESP32_RESULT_DUPLICATE);
  CHECK(receipt.outcome == SCORING_ESP32_RECEIVER_REJECTED);
  link = (fake_link_t){.frame = decision_frame, .frame_length = decision_length};
  CHECK(scoring_esp32_receiver_receive(&receiver, &receipt) == SCORING_ESP32_RESULT_OK);
  CHECK(scoring_esp32_journal_count(scoring_esp32_receiver_journal(&receiver)) == 1U);
  return true;
}

static bool test_max_sequence_exhaustion_restores(void) {
  static const uint8_t payload[] = {0xA0U};
  uint8_t frame[SCORING_ESP32_MAX_TRANSPORT_FRAME_BYTES] = {0};
  const size_t frame_length = make_frame(frame, SCORING_ESP32_TRANSPORT_STATUS, payload, sizeof(payload), UINT32_MAX);
  fake_link_t link = {.frame = frame, .frame_length = frame_length};
  reset_observer_t observer = {0};
  scoring_esp32_services_t services;
  scoring_esp32_receiver_t receiver;
  scoring_esp32_receiver_receipt_t receipt;
  uint32_t expected_sequence = 0U;

  set_boot_id(&observer, "boot-1");
  services = services_for(&link, &observer);
  scoring_esp32_journal_storage_init(&test_storage);
  CHECK(scoring_esp32_receiver_init(&receiver, &services, &test_storage, 4U) == SCORING_ESP32_RESULT_OK);
  CHECK(scoring_esp32_receiver_receive(&receiver, &receipt) == SCORING_ESP32_RESULT_IGNORED);
  CHECK(!scoring_esp32_receiver_has_expected_sequence(&receiver, &expected_sequence));
  set_boot_id(&observer, "boot-2");
  CHECK(scoring_esp32_receiver_reset(&receiver) == SCORING_ESP32_RESULT_OK);
  CHECK(scoring_esp32_receiver_receive(&receiver, &receipt) == SCORING_ESP32_RESULT_SEQUENCE_EXHAUSTED);
  return true;
}

static bool test_boot_identity_is_required_changed_and_exposed(void) {
  static const uint8_t payload[] = {0x01U};
  uint8_t frame[SCORING_ESP32_MAX_TRANSPORT_FRAME_BYTES] = {0};
  const size_t frame_length = make_decision_frame(frame, payload, sizeof(payload), 1U);
  fake_link_t link = {.frame = frame, .frame_length = frame_length};
  reset_observer_t observer = {0};
  scoring_esp32_services_t services;
  scoring_esp32_receiver_t receiver;
  scoring_esp32_receiver_receipt_t receipt;
  scoring_esp32_identifier_t boot_id;

  set_boot_id(&observer, "boot-a");
  observer.boot_result = SCORING_ESP32_RESULT_UNAVAILABLE;
  services = services_for(&link, &observer);
  scoring_esp32_journal_storage_init(&test_storage);
  CHECK(scoring_esp32_receiver_init(&receiver, &services, &test_storage, 4U) == SCORING_ESP32_RESULT_UNAVAILABLE);
  observer.boot_result = SCORING_ESP32_RESULT_OK;
  observer.boot_id.length = 0U;
  CHECK(scoring_esp32_receiver_init(&receiver, &services, &test_storage, 4U) == SCORING_ESP32_RESULT_INVALID_ARGUMENT);
  set_boot_id(&observer, "boot-a");
  observer.boot_id.bytes[2] = '\0';
  CHECK(scoring_esp32_receiver_init(&receiver, &services, &test_storage, 4U) == SCORING_ESP32_RESULT_INVALID_ARGUMENT);
  set_boot_id(&observer, "boot-a");
  CHECK(scoring_esp32_receiver_init(&receiver, &services, &test_storage, 4U) == SCORING_ESP32_RESULT_OK);
  CHECK(scoring_esp32_receiver_read_application_boot_id(&receiver, &boot_id) == SCORING_ESP32_RESULT_OK);
  CHECK(strcmp(boot_id.bytes, "boot-a") == 0);
  CHECK(scoring_esp32_receiver_receive(&receiver, &receipt) == SCORING_ESP32_RESULT_OK);
  CHECK(scoring_esp32_receiver_reset(&receiver) == SCORING_ESP32_RESULT_REJECTED);
  link.result = SCORING_ESP32_RESULT_UNAVAILABLE;
  CHECK(scoring_esp32_receiver_receive(&receiver, &receipt) == SCORING_ESP32_RESULT_UNAVAILABLE);
  CHECK(receipt.outcome == SCORING_ESP32_RECEIVER_IGNORED);
  set_boot_id(&observer, "boot-b");
  link.result = SCORING_ESP32_RESULT_OK;
  CHECK(scoring_esp32_receiver_reset(&receiver) == SCORING_ESP32_RESULT_OK);
  CHECK(scoring_esp32_receiver_read_application_boot_id(&receiver, &boot_id) == SCORING_ESP32_RESULT_OK);
  CHECK(strcmp(boot_id.bytes, "boot-b") == 0);
  link = (fake_link_t){.frame = NULL, .frame_length = 0U, .result = SCORING_ESP32_RESULT_OK};
  CHECK(scoring_esp32_receiver_receive(&receiver, &receipt) == SCORING_ESP32_RESULT_UNAVAILABLE);
  CHECK(receipt.outcome == SCORING_ESP32_RECEIVER_IGNORED);
  return true;
}

static bool test_newest_corrupt_falls_back_and_all_corrupt_fails(void) {
  static const uint8_t first_payload[] = {0x10U};
  static const uint8_t second_payload[] = {0x11U};
  uint8_t first_frame[SCORING_ESP32_MAX_TRANSPORT_FRAME_BYTES] = {0};
  uint8_t second_frame[SCORING_ESP32_MAX_TRANSPORT_FRAME_BYTES] = {0};
  const size_t first_length = make_decision_frame(first_frame, first_payload, sizeof(first_payload), 1U);
  const size_t second_length = make_decision_frame(second_frame, second_payload, sizeof(second_payload), 2U);
  fake_link_t link = {.frame = first_frame, .frame_length = first_length};
  reset_observer_t observer = {0};
  scoring_esp32_services_t services;
  scoring_esp32_receiver_t receiver;
  scoring_esp32_receiver_receipt_t receipt;

  set_boot_id(&observer, "boot-1");
  services = services_for(&link, &observer);
  scoring_esp32_journal_storage_init(&test_storage);
  CHECK(scoring_esp32_receiver_init(&receiver, &services, &test_storage, 4U) == SCORING_ESP32_RESULT_OK);
  CHECK(scoring_esp32_receiver_receive(&receiver, &receipt) == SCORING_ESP32_RESULT_OK);
  link = (fake_link_t){.frame = second_frame, .frame_length = second_length};
  CHECK(scoring_esp32_receiver_receive(&receiver, &receipt) == SCORING_ESP32_RESULT_OK);
  CHECK(scoring_esp32_journal_corrupt_committed(&test_storage, 0U) == SCORING_ESP32_RESULT_OK);
  set_boot_id(&observer, "boot-2");
  CHECK(scoring_esp32_receiver_reset(&receiver) == SCORING_ESP32_RESULT_OK);
  CHECK(scoring_esp32_journal_count(scoring_esp32_receiver_journal(&receiver)) == 1U);
  CHECK(replay_matches(scoring_esp32_receiver_journal(&receiver), 0U, first_payload, sizeof(first_payload), 1U));

  scoring_esp32_journal_storage_init(&test_storage);
  set_boot_id(&observer, "boot-3");
  link = (fake_link_t){.frame = first_frame, .frame_length = first_length};
  CHECK(scoring_esp32_receiver_init(&receiver, &services, &test_storage, 4U) == SCORING_ESP32_RESULT_OK);
  CHECK(scoring_esp32_receiver_receive(&receiver, &receipt) == SCORING_ESP32_RESULT_OK);
  link = (fake_link_t){.frame = second_frame, .frame_length = second_length};
  CHECK(scoring_esp32_receiver_receive(&receiver, &receipt) == SCORING_ESP32_RESULT_OK);
  CHECK(scoring_esp32_journal_corrupt_committed(&test_storage, 0U) == SCORING_ESP32_RESULT_OK);
  CHECK(scoring_esp32_journal_corrupt_committed(&test_storage, 0U) == SCORING_ESP32_RESULT_OK);
  set_boot_id(&observer, "boot-4");
  CHECK(scoring_esp32_receiver_reset(&receiver) == SCORING_ESP32_RESULT_JOURNAL_CORRUPT);
  return true;
}

static bool test_journal_public_argument_boundaries(void) {
  static const uint8_t payload[] = {0xA1U};
  static const uint8_t other_payload[] = {0xA2U};
  uint8_t replay[SCORING_ESP32_MAX_TRANSPORT_PAYLOAD_BYTES] = {0};
  scoring_esp32_journal_storage_t storage;
  scoring_esp32_journal_t journal = {0};
  scoring_esp32_journal_t unopened = {0};
  size_t replay_length = 0U;
  uint32_t replay_sequence = 0U;

  scoring_esp32_journal_storage_init(NULL);
  scoring_esp32_journal_arm_power_loss(NULL, SCORING_ESP32_JOURNAL_COMMIT_MARKER);
  CHECK(scoring_esp32_journal_corrupt_committed(NULL, 0U) == SCORING_ESP32_RESULT_INVALID_ARGUMENT);
  scoring_esp32_journal_storage_init(&storage);
  CHECK(scoring_esp32_journal_corrupt_committed(&storage, 0U) == SCORING_ESP32_RESULT_JOURNAL_CORRUPT);
  CHECK(scoring_esp32_journal_open(NULL, &storage, 1U) == SCORING_ESP32_RESULT_INVALID_ARGUMENT);
  CHECK(scoring_esp32_journal_open(&journal, NULL, 1U) == SCORING_ESP32_RESULT_INVALID_ARGUMENT);
  CHECK(scoring_esp32_journal_open(&journal, &storage, 0U) == SCORING_ESP32_RESULT_INVALID_ARGUMENT);
  CHECK(scoring_esp32_journal_open(&journal, &storage, SCORING_ESP32_JOURNAL_MAX_ENTRIES + 1U) ==
        SCORING_ESP32_RESULT_INVALID_ARGUMENT);
  CHECK(scoring_esp32_journal_open(&journal, &storage, 4U) == SCORING_ESP32_RESULT_OK);
  CHECK(scoring_esp32_journal_recovery(&journal) == SCORING_ESP32_JOURNAL_RECOVERY_EMPTY);
  CHECK(scoring_esp32_journal_recovery(NULL) == SCORING_ESP32_JOURNAL_RECOVERY_CORRUPT);
  CHECK(scoring_esp32_journal_count(NULL) == 0U);
  CHECK(scoring_esp32_journal_reopen(&unopened) == SCORING_ESP32_RESULT_INVALID_ARGUMENT);
  CHECK(scoring_esp32_journal_append(NULL, 1U, (scoring_esp32_bytes_t){0}) == SCORING_ESP32_RESULT_INVALID_ARGUMENT);
  CHECK(scoring_esp32_journal_append(&journal, 1U, (scoring_esp32_bytes_t){.data = NULL, .length = 1U}) ==
        SCORING_ESP32_RESULT_INVALID_ARGUMENT);
  CHECK(scoring_esp32_journal_append(
          &journal,
          1U,
          (scoring_esp32_bytes_t){.data = payload, .length = SCORING_ESP32_MAX_TRANSPORT_PAYLOAD_BYTES + 1U}
        ) == SCORING_ESP32_RESULT_BUFFER_TOO_SMALL);
  CHECK(scoring_esp32_journal_append(&journal, 1U, (scoring_esp32_bytes_t){.data = NULL, .length = 0U}) ==
        SCORING_ESP32_RESULT_OK);
  CHECK(scoring_esp32_journal_replay(NULL, 0U, (scoring_esp32_mutable_bytes_t){0}, &replay_length, &replay_sequence) ==
        SCORING_ESP32_RESULT_INVALID_ARGUMENT);
  CHECK(scoring_esp32_journal_replay(&journal, 0U, (scoring_esp32_mutable_bytes_t){0}, NULL, &replay_sequence) ==
        SCORING_ESP32_RESULT_INVALID_ARGUMENT);
  CHECK(scoring_esp32_journal_replay(&journal, 0U, (scoring_esp32_mutable_bytes_t){0}, &replay_length, NULL) ==
        SCORING_ESP32_RESULT_INVALID_ARGUMENT);
  CHECK(scoring_esp32_journal_replay(
          &journal,
          0U,
          (scoring_esp32_mutable_bytes_t){.data = NULL, .capacity = 1U},
          &replay_length,
          &replay_sequence
        ) == SCORING_ESP32_RESULT_INVALID_ARGUMENT);
  CHECK(scoring_esp32_journal_replay(
          &journal,
          99U,
          (scoring_esp32_mutable_bytes_t){.data = replay, .capacity = sizeof(replay)},
          &replay_length,
          &replay_sequence
        ) == SCORING_ESP32_RESULT_INVALID_ARGUMENT);
  CHECK(scoring_esp32_journal_replay(
          &journal,
          0U,
          (scoring_esp32_mutable_bytes_t){.data = NULL, .capacity = 0U},
          &replay_length,
          &replay_sequence
        ) == SCORING_ESP32_RESULT_OK);
  CHECK(replay_length == 0U && replay_sequence == 1U);
  CHECK(scoring_esp32_journal_append(&journal, 2U, (scoring_esp32_bytes_t){.data = payload, .length = sizeof(payload)}) ==
        SCORING_ESP32_RESULT_OK);
  CHECK(scoring_esp32_journal_replay(
          &journal,
          1U,
          (scoring_esp32_mutable_bytes_t){.data = NULL, .capacity = 0U},
          &replay_length,
          &replay_sequence
        ) == SCORING_ESP32_RESULT_BUFFER_TOO_SMALL);
  CHECK(scoring_esp32_journal_replay(
          &journal,
          1U,
          (scoring_esp32_mutable_bytes_t){.data = replay, .capacity = sizeof(replay)},
          &replay_length,
          &replay_sequence
        ) == SCORING_ESP32_RESULT_OK);
  CHECK(replay_length == sizeof(payload) && replay_sequence == 2U && replay[0] == payload[0]);
  CHECK(scoring_esp32_journal_append(&journal, 2U, (scoring_esp32_bytes_t){.data = payload, .length = sizeof(payload)}) ==
        SCORING_ESP32_RESULT_DUPLICATE);
  CHECK(scoring_esp32_journal_append(
          &journal,
          2U,
          (scoring_esp32_bytes_t){.data = other_payload, .length = sizeof(other_payload)}
        ) ==
        SCORING_ESP32_RESULT_CONFLICT);
  {
    const scoring_esp32_result_t out_of_order = scoring_esp32_journal_append(
          &journal,
          0U,
          (scoring_esp32_bytes_t){.data = other_payload, .length = sizeof(other_payload)}
        );
    CHECK(out_of_order == SCORING_ESP32_RESULT_OUT_OF_ORDER);
  }
  CHECK(scoring_esp32_journal_advance_cursor(NULL, 3U) == SCORING_ESP32_RESULT_INVALID_ARGUMENT);
  CHECK(scoring_esp32_journal_advance_cursor(&journal, 2U) == SCORING_ESP32_RESULT_DUPLICATE);
  CHECK(scoring_esp32_journal_advance_cursor(&journal, 1U) == SCORING_ESP32_RESULT_OUT_OF_ORDER);
  CHECK(scoring_esp32_journal_advance_cursor(&journal, 3U) == SCORING_ESP32_RESULT_OK);
  {
    scoring_esp32_journal_storage_t zero_storage;
    scoring_esp32_journal_t zero_journal;
    scoring_esp32_journal_storage_init(&zero_storage);
    CHECK(scoring_esp32_journal_open(&zero_journal, &zero_storage, 1U) == SCORING_ESP32_RESULT_OK);
    CHECK(scoring_esp32_journal_append(&zero_journal, 1U, (scoring_esp32_bytes_t){.data = NULL, .length = 0U}) ==
          SCORING_ESP32_RESULT_OK);
    CHECK(scoring_esp32_journal_corrupt_committed(&zero_storage, 1U) == SCORING_ESP32_RESULT_INVALID_ARGUMENT);
    CHECK(scoring_esp32_journal_corrupt_committed(&zero_storage, 0U) == SCORING_ESP32_RESULT_OK);
  }
  return true;
}

static bool test_receiver_public_argument_and_link_boundaries(void) {
  static const uint8_t status_payload[] = {0x70U};
  uint8_t status_frame[SCORING_ESP32_MAX_TRANSPORT_FRAME_BYTES] = {0};
  const size_t status_length = make_frame(
    status_frame,
    SCORING_ESP32_TRANSPORT_STATUS,
    status_payload,
    sizeof(status_payload),
    1U
  );
  fake_link_t link = {.frame = status_frame, .frame_length = status_length, .result = SCORING_ESP32_RESULT_FRAME_INVALID};
  reset_observer_t observer = {0};
  scoring_esp32_services_t services;
  scoring_esp32_receiver_t receiver = {0};
  scoring_esp32_receiver_receipt_t receipt = {0};
  scoring_esp32_identifier_t identifier = {0};
  uint32_t expected_sequence = 0U;

  CHECK(scoring_esp32_receiver_init(NULL, NULL, &test_storage, 1U) == SCORING_ESP32_RESULT_INVALID_ARGUMENT);
  CHECK(scoring_esp32_receiver_init(&receiver, NULL, NULL, 1U) == SCORING_ESP32_RESULT_INVALID_ARGUMENT);
  CHECK(scoring_esp32_receiver_reset(NULL) == SCORING_ESP32_RESULT_INVALID_ARGUMENT);
  CHECK(scoring_esp32_receiver_receive(NULL, &receipt) == SCORING_ESP32_RESULT_INVALID_ARGUMENT);
  CHECK(scoring_esp32_receiver_receive(&receiver, NULL) == SCORING_ESP32_RESULT_INVALID_ARGUMENT);
  CHECK(scoring_esp32_receiver_receive(&receiver, &receipt) == SCORING_ESP32_RESULT_UNAVAILABLE);
  CHECK(receipt.outcome == SCORING_ESP32_RECEIVER_IGNORED);
  CHECK(scoring_esp32_receiver_is_link_degraded(NULL) == false);
  CHECK(scoring_esp32_receiver_has_expected_sequence(NULL, &expected_sequence) == false);
  CHECK(scoring_esp32_receiver_has_expected_sequence(&receiver, NULL) == false);
  CHECK(scoring_esp32_receiver_read_application_boot_id(NULL, &identifier) == SCORING_ESP32_RESULT_INVALID_ARGUMENT);
  CHECK(scoring_esp32_receiver_read_application_boot_id(&receiver, NULL) == SCORING_ESP32_RESULT_INVALID_ARGUMENT);
  CHECK(scoring_esp32_receiver_read_application_boot_id(&receiver, &identifier) == SCORING_ESP32_RESULT_UNAVAILABLE);
  CHECK(identifier.length == 0U);
  CHECK(scoring_esp32_receiver_journal(NULL) == NULL);

  set_boot_id(&observer, "boundary-boot");
  services = services_for(&link, &observer);
  scoring_esp32_journal_storage_init(&test_storage);
  CHECK(status_length != 0U);
  CHECK(scoring_esp32_receiver_init(&receiver, &services, &test_storage, 2U) == SCORING_ESP32_RESULT_OK);
  CHECK(scoring_esp32_receiver_receive(&receiver, &receipt) == SCORING_ESP32_RESULT_FRAME_INVALID);
  CHECK(receipt.outcome == SCORING_ESP32_RECEIVER_REJECTED);
  CHECK(receipt.result == SCORING_ESP32_RESULT_FRAME_INVALID);
  CHECK(scoring_esp32_receiver_is_link_degraded(&receiver));

  link.result = SCORING_ESP32_RESULT_OK;
  scoring_esp32_journal_arm_power_loss(&test_storage, SCORING_ESP32_JOURNAL_PREPARED_HEADER);
  CHECK(scoring_esp32_receiver_receive(&receiver, &receipt) == SCORING_ESP32_RESULT_POWER_LOSS);
  CHECK(receipt.outcome == SCORING_ESP32_RECEIVER_REJECTED);
  CHECK(receipt.has_sequence);
  CHECK(receipt.sequence == 1U);
  return true;
}

int main(void) {
  if (!test_host_storage_size_is_measured_bound() ||
      !test_accept_duplicate_corruption_reorder_and_replay() ||
      !test_backpressure_retains_expected_sequence() ||
      !test_power_loss_recovers_multiple_record_checkpoint() ||
      !test_reset_restores_decision_cursor_and_next_frame() ||
      !test_reset_restores_ignored_cursor() ||
      !test_max_sequence_exhaustion_restores() ||
      !test_boot_identity_is_required_changed_and_exposed() ||
      !test_newest_corrupt_falls_back_and_all_corrupt_fails() ||
      !test_journal_public_argument_boundaries() ||
      !test_receiver_public_argument_and_link_boundaries()) {
    return 1;
  }
  return 0;
}
