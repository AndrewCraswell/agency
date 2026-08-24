#include "scoring_esp32_receiver.h"
#include "stm32_scoring_host.h"

#include <stdio.h>
#include <stdlib.h>
#include <string.h>

#define CHECK(expression) \
  do { \
    if (!(expression)) { \
      (void)fprintf(stderr, "check failed: %s at %s:%d\n", #expression, __FILE__, __LINE__); \
      return false; \
    } \
  } while (false)

typedef struct integration_link {
  uint8_t frame[SCORING_STM32_TRANSPORT_MAX_FRAME_BYTES];
  size_t frame_length;
  size_t publish_calls;
  bool frame_available;
  scoring_status_t publish_result;
} integration_link_t;

typedef struct integration_platform {
  integration_link_t link;
  scoring_esp32_identifier_t boot_id;
} integration_platform_t;

typedef struct integration_fixture {
  integration_platform_t platform;
  scoring_stm32_hardware_t stm32_hardware;
  scoring_stm32_host_t stm32;
  scoring_esp32_services_t esp32_services;
  scoring_esp32_journal_storage_t journal_storage;
  scoring_esp32_receiver_t esp32;
} integration_fixture_t;

static scoring_status_t fake_now_us(void *context, uint64_t *out_now_us) {
  (void)context;
  if (out_now_us == NULL) {
    return SCORING_STATUS_INVALID_ARGUMENT;
  }
  *out_now_us = 0U;
  return SCORING_STATUS_OK;
}

static scoring_status_t fake_read_adc(void *context, scoring_adc_frame_t *out_frame) {
  (void)context;
  if (out_frame == NULL) {
    return SCORING_STATUS_INVALID_ARGUMENT;
  }
  *out_frame = (scoring_adc_frame_t){0};
  return SCORING_STATUS_OK;
}

static scoring_status_t fake_read_events(
  void *context,
  scoring_comparator_event_t *out_events,
  size_t event_capacity,
  size_t *out_event_count
) {
  (void)context;
  (void)out_events;
  (void)event_capacity;
  if (out_event_count == NULL) {
    return SCORING_STATUS_INVALID_ARGUMENT;
  }
  *out_event_count = 0U;
  return SCORING_STATUS_OK;
}

static scoring_status_t fake_pop_frames(
  void *context,
  scoring_adc_frame_t *out_frames,
  size_t frame_capacity,
  size_t *out_frame_count
) {
  (void)context;
  (void)out_frames;
  (void)frame_capacity;
  if (out_frame_count == NULL) {
    return SCORING_STATUS_INVALID_ARGUMENT;
  }
  *out_frame_count = 0U;
  return SCORING_STATUS_OK;
}

static scoring_status_t fake_flash_read(void *context, uint32_t offset, uint8_t *out_bytes, size_t byte_count) {
  (void)context;
  (void)offset;
  if (out_bytes == NULL && byte_count != 0U) {
    return SCORING_STATUS_INVALID_ARGUMENT;
  }
  if (out_bytes != NULL) {
    (void)memset(out_bytes, 0, byte_count);
  }
  return SCORING_STATUS_OK;
}

static scoring_status_t fake_flash_write(void *context, uint32_t offset, const uint8_t *bytes, size_t byte_count) {
  (void)context;
  (void)offset;
  if (bytes == NULL && byte_count != 0U) {
    return SCORING_STATUS_INVALID_ARGUMENT;
  }
  return SCORING_STATUS_OK;
}

static scoring_status_t fake_watchdog(void *context) {
  (void)context;
  return SCORING_STATUS_OK;
}

/* Platform-link fake: it stores only the exact bytes emitted by the real STM32 transport seam. */
static scoring_status_t fake_stm32_publish(void *context, const uint8_t *bytes, size_t byte_count) {
  integration_link_t *link = context;
  if (link == NULL || (bytes == NULL && byte_count != 0U) || byte_count > sizeof(link->frame)) {
    return SCORING_STATUS_INVALID_ARGUMENT;
  }
  link->publish_calls += 1U;
  if (link->publish_result != SCORING_STATUS_OK) {
    return link->publish_result;
  }
  if (byte_count != 0U) {
    (void)memcpy(link->frame, bytes, byte_count);
  }
  link->frame_length = byte_count;
  link->frame_available = true;
  return SCORING_STATUS_OK;
}

/* Platform-link fake: it presents the saved physical-link frame once to the real ESP32 receiver. */
static scoring_esp32_result_t fake_esp32_read_frame(
  void *context,
  scoring_esp32_mutable_bytes_t destination,
  size_t *out_frame_length
) {
  integration_link_t *link = context;
  if (link == NULL || out_frame_length == NULL || (destination.data == NULL && destination.capacity != 0U)) {
    return SCORING_ESP32_RESULT_INVALID_ARGUMENT;
  }
  if (!link->frame_available) {
    *out_frame_length = 0U;
    return SCORING_ESP32_RESULT_OK;
  }
  if (link->frame_length > destination.capacity) {
    return SCORING_ESP32_RESULT_BUFFER_TOO_SMALL;
  }
  (void)memcpy(destination.data, link->frame, link->frame_length);
  *out_frame_length = link->frame_length;
  link->frame_available = false;
  return SCORING_ESP32_RESULT_OK;
}

/* Platform identity fake; changing it models an ESP32 application boot boundary only. */
static scoring_esp32_result_t fake_read_boot_id(void *context, scoring_esp32_identifier_t *out_boot_id) {
  integration_platform_t *platform = context;
  if (platform == NULL || out_boot_id == NULL) {
    return SCORING_ESP32_RESULT_INVALID_ARGUMENT;
  }
  *out_boot_id = platform->boot_id;
  return SCORING_ESP32_RESULT_OK;
}

static void set_boot_id(integration_platform_t *platform, const char *boot_id) {
  const size_t length = strlen(boot_id);
  (void)memset(&platform->boot_id, 0, sizeof(platform->boot_id));
  (void)memcpy(platform->boot_id.bytes, boot_id, length);
  platform->boot_id.length = length;
}

static void reinject_frame(integration_link_t *link, const uint8_t *bytes, size_t byte_count) {
  if (bytes != link->frame) {
    (void)memcpy(link->frame, bytes, byte_count);
  }
  link->frame_length = byte_count;
  link->frame_available = true;
}

static bool fixture_init(integration_fixture_t *fixture, const char *boot_id) {
  *fixture = (integration_fixture_t){0};
  set_boot_id(&fixture->platform, boot_id);
  fixture->platform.link.publish_result = SCORING_STATUS_OK;
  fixture->stm32_hardware = (scoring_stm32_hardware_t){
    .clock = {.context = NULL, .now_us = fake_now_us},
    .adc = {.context = NULL, .read_frame = fake_read_adc},
    .comparator = {.context = NULL, .read_events = fake_read_events},
    .dma = {.context = NULL, .pop_frames = fake_pop_frames},
    .flash = {.context = NULL, .read = fake_flash_read, .write = fake_flash_write},
    .watchdog = {.context = NULL, .arm = fake_watchdog, .service = fake_watchdog},
    .transport = {.context = &fixture->platform.link, .publish = fake_stm32_publish}
  };
  fixture->esp32_services = (scoring_esp32_services_t){
    .identity = {.context = &fixture->platform, .read_boot_id = fake_read_boot_id},
    .scoring_link = {.context = &fixture->platform.link, .read_frame = fake_esp32_read_frame}
  };
  scoring_esp32_journal_storage_init(&fixture->journal_storage);
  return scoring_stm32_host_init(&fixture->stm32, &fixture->stm32_hardware) == SCORING_STATUS_OK &&
    scoring_stm32_host_start(&fixture->stm32) == SCORING_STATUS_OK &&
    scoring_esp32_receiver_init(&fixture->esp32, &fixture->esp32_services, &fixture->journal_storage, 8U) ==
      SCORING_ESP32_RESULT_OK;
}

static bool publish_decision(integration_fixture_t *fixture, const uint8_t *payload, size_t payload_length) {
  return scoring_stm32_host_publish_transport_frame(
           &fixture->stm32,
           SCORING_STM32_TRANSPORT_DECISION_RECORD,
           payload,
           payload_length
         ) == SCORING_STATUS_OK;
}

static bool assert_replay(
  const integration_fixture_t *fixture,
  size_t index,
  const uint8_t *payload,
  size_t payload_length,
  uint32_t sequence
) {
  uint8_t replay[SCORING_ESP32_MAX_TRANSPORT_PAYLOAD_BYTES] = {0};
  size_t replay_length = 0U;
  uint32_t replay_sequence = 0U;
  CHECK(scoring_esp32_journal_replay(
    scoring_esp32_receiver_journal(&fixture->esp32),
    index,
    (scoring_esp32_mutable_bytes_t){.data = replay, .capacity = sizeof(replay)},
    &replay_length,
    &replay_sequence
  ) == SCORING_ESP32_RESULT_OK);
  CHECK(replay_length == payload_length);
  CHECK(replay_sequence == sequence);
  CHECK(memcmp(replay, payload, payload_length) == 0);
  return true;
}

static bool test_transport_to_receiver_accept_once_recovery_and_replay(void) {
  static const uint8_t payload_zero[] = {0xA0U, 0x00U, 0xF0U};
  static const uint8_t payload_one[] = {0xA1U};
  static const uint8_t payload_two[] = {0xA2U, 0x22U};
  static const uint8_t payload_three[] = {0xA3U};
  integration_fixture_t fixture;
  scoring_esp32_receiver_receipt_t receipt;
  uint8_t sequence_one[SCORING_STM32_TRANSPORT_MAX_FRAME_BYTES] = {0};
  uint8_t sequence_two[SCORING_STM32_TRANSPORT_MAX_FRAME_BYTES] = {0};
  size_t sequence_one_length;
  size_t sequence_two_length;
  size_t before_publish_calls;

  CHECK(fixture_init(&fixture, "esp-boot-1"));
  CHECK(publish_decision(&fixture, payload_zero, sizeof(payload_zero)));
  CHECK(fixture.platform.link.frame_length > SCORING_STM32_TRANSPORT_HEADER_BYTES);
  CHECK(scoring_esp32_receiver_receive(&fixture.esp32, &receipt) == SCORING_ESP32_RESULT_OK);
  CHECK(receipt.outcome == SCORING_ESP32_RECEIVER_ACCEPTED);
  CHECK(receipt.sequence == 0U);
  CHECK(receipt.record.length == sizeof(payload_zero));
  CHECK(memcmp(receipt.record.data, payload_zero, sizeof(payload_zero)) == 0);
  CHECK(assert_replay(&fixture, 0U, payload_zero, sizeof(payload_zero), 0U));

  reinject_frame(&fixture.platform.link, fixture.platform.link.frame, fixture.platform.link.frame_length);
  CHECK(scoring_esp32_receiver_receive(&fixture.esp32, &receipt) == SCORING_ESP32_RESULT_DUPLICATE);
  CHECK(receipt.outcome == SCORING_ESP32_RECEIVER_REJECTED);
  CHECK(scoring_esp32_journal_count(scoring_esp32_receiver_journal(&fixture.esp32)) == 1U);

  fixture.platform.link.frame[SCORING_STM32_TRANSPORT_HEADER_BYTES] ^= 1U;
  fixture.platform.link.frame_available = true;
  CHECK(scoring_esp32_receiver_receive(&fixture.esp32, &receipt) == SCORING_ESP32_RESULT_FRAME_INTEGRITY_FAILURE);
  CHECK(scoring_esp32_receiver_is_link_degraded(&fixture.esp32));
  set_boot_id(&fixture.platform, "esp-boot-2");
  CHECK(scoring_esp32_receiver_reset(&fixture.esp32) == SCORING_ESP32_RESULT_OK);
  CHECK(!scoring_esp32_receiver_is_link_degraded(&fixture.esp32));
  CHECK(assert_replay(&fixture, 0U, payload_zero, sizeof(payload_zero), 0U));

  CHECK(publish_decision(&fixture, payload_one, sizeof(payload_one)));
  sequence_one_length = fixture.platform.link.frame_length;
  (void)memcpy(sequence_one, fixture.platform.link.frame, sequence_one_length);
  fixture.platform.link.frame_available = false;
  CHECK(publish_decision(&fixture, payload_two, sizeof(payload_two)));
  sequence_two_length = fixture.platform.link.frame_length;
  (void)memcpy(sequence_two, fixture.platform.link.frame, sequence_two_length);
  CHECK(scoring_esp32_receiver_receive(&fixture.esp32, &receipt) == SCORING_ESP32_RESULT_OUT_OF_ORDER);
  CHECK(scoring_esp32_receiver_is_link_degraded(&fixture.esp32));
  set_boot_id(&fixture.platform, "esp-boot-3");
  CHECK(scoring_esp32_receiver_reset(&fixture.esp32) == SCORING_ESP32_RESULT_OK);
  reinject_frame(&fixture.platform.link, sequence_one, sequence_one_length);
  CHECK(scoring_esp32_receiver_receive(&fixture.esp32, &receipt) == SCORING_ESP32_RESULT_OK);
  reinject_frame(&fixture.platform.link, sequence_two, sequence_two_length);
  CHECK(scoring_esp32_receiver_receive(&fixture.esp32, &receipt) == SCORING_ESP32_RESULT_OK);
  CHECK(assert_replay(&fixture, 1U, payload_one, sizeof(payload_one), 1U));
  CHECK(assert_replay(&fixture, 2U, payload_two, sizeof(payload_two), 2U));

  fixture.platform.link.publish_result = SCORING_STATUS_BACKPRESSURE;
  CHECK(scoring_stm32_host_publish_transport_frame(
    &fixture.stm32,
    SCORING_STM32_TRANSPORT_DECISION_RECORD,
    payload_three,
    sizeof(payload_three)
  ) == SCORING_STATUS_BACKPRESSURE);
  before_publish_calls = fixture.platform.link.publish_calls;
  fixture.platform.link.publish_result = SCORING_STATUS_OK;
  CHECK(scoring_stm32_host_publish_transport_frame(
    &fixture.stm32,
    SCORING_STM32_TRANSPORT_DECISION_RECORD,
    payload_three,
    sizeof(payload_three)
  ) == SCORING_STATUS_BACKPRESSURE);
  CHECK(fixture.platform.link.publish_calls == before_publish_calls);
  scoring_stm32_host_recover_transport(&fixture.stm32, 0U, 3U);
  CHECK(publish_decision(&fixture, payload_three, sizeof(payload_three)));
  CHECK(scoring_esp32_receiver_receive(&fixture.esp32, &receipt) == SCORING_ESP32_RESULT_OK);
  CHECK(assert_replay(&fixture, 3U, payload_three, sizeof(payload_three), 3U));

  set_boot_id(&fixture.platform, "esp-boot-4");
  CHECK(scoring_esp32_receiver_reset(&fixture.esp32) == SCORING_ESP32_RESULT_OK);
  CHECK(scoring_esp32_journal_count(scoring_esp32_receiver_journal(&fixture.esp32)) == 4U);
  CHECK(assert_replay(&fixture, 3U, payload_three, sizeof(payload_three), 3U));
  return true;
}

static bool test_power_loss_reopens_old_or_new_complete_journal(void) {
  static const uint8_t old_payload[] = {0xB0U};
  static const uint8_t new_payload[] = {0xB1U, 0x11U};
  scoring_esp32_journal_write_boundary_t boundary;

  for (boundary = SCORING_ESP32_JOURNAL_PREPARED_HEADER;
       boundary <= SCORING_ESP32_JOURNAL_COMMIT_MARKER;
       boundary = (scoring_esp32_journal_write_boundary_t)(boundary + 1U)) {
    integration_fixture_t fixture;
    scoring_esp32_receiver_receipt_t receipt;
    size_t count_after_reset;

    CHECK(fixture_init(&fixture, "power-boot-1"));
    CHECK(publish_decision(&fixture, old_payload, sizeof(old_payload)));
    CHECK(scoring_esp32_receiver_receive(&fixture.esp32, &receipt) == SCORING_ESP32_RESULT_OK);
    scoring_esp32_journal_arm_power_loss(&fixture.journal_storage, boundary);
    CHECK(publish_decision(&fixture, new_payload, sizeof(new_payload)));
    CHECK(scoring_esp32_receiver_receive(&fixture.esp32, &receipt) == SCORING_ESP32_RESULT_POWER_LOSS);
    set_boot_id(&fixture.platform, "power-boot-2");
    CHECK(scoring_esp32_receiver_reset(&fixture.esp32) == SCORING_ESP32_RESULT_OK);
    count_after_reset = scoring_esp32_journal_count(scoring_esp32_receiver_journal(&fixture.esp32));
    CHECK(count_after_reset == 1U || count_after_reset == 2U);
    CHECK(assert_replay(&fixture, 0U, old_payload, sizeof(old_payload), 0U));
    if (count_after_reset == 2U) {
      CHECK(assert_replay(&fixture, 1U, new_payload, sizeof(new_payload), 1U));
    }
  }
  return true;
}

int main(void) {
  if (!test_transport_to_receiver_accept_once_recovery_and_replay() ||
      !test_power_loss_reopens_old_or_new_complete_journal()) {
    return EXIT_FAILURE;
  }
  return EXIT_SUCCESS;
}
