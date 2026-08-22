#include "stm32_scoring_host.h"
#include "stm32_transport.h"
#include "stm32_transport_golden_frames.h"

#include <stddef.h>
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

typedef struct fake_transport_state {
  scoring_status_t publish_status;
  size_t publish_count;
  size_t last_byte_count;
  uint8_t last_frame[SCORING_STM32_TRANSPORT_MAX_FRAME_BYTES];
} fake_transport_state_t;

static scoring_status_t fake_publish(void *context, const uint8_t *bytes, size_t byte_count) {
  fake_transport_state_t *state = context;

  state->publish_count += 1U;
  state->last_byte_count = byte_count;
  if (byte_count <= sizeof(state->last_frame)) {
    (void)memcpy(state->last_frame, bytes, byte_count);
  }
  return state->publish_status;
}

static scoring_stm32_transport_receiver_t sender_for(
  scoring_stm32_transport_receiver_t receiver
) {
  return receiver == SCORING_STM32_TRANSPORT_RECEIVER_STM32
    ? SCORING_STM32_TRANSPORT_RECEIVER_ESP32
    : SCORING_STM32_TRANSPORT_RECEIVER_STM32;
}

static void test_crc32c_check_value(void) {
  static const uint8_t CHECK_BYTES[] = "123456789";

  CHECK(scoring_stm32_transport_crc32c(CHECK_BYTES, sizeof(CHECK_BYTES) - 1U) == UINT32_C(0xE3069283));
}

static void test_generated_golden_frames_match_c_codec(void) {
  size_t index;

  CHECK(SCORING_STM32_TRANSPORT_GOLDEN_FIXTURE_COUNT == 3U);
  for (index = 0U; index < SCORING_STM32_TRANSPORT_GOLDEN_FIXTURE_COUNT; index += 1U) {
    const scoring_stm32_transport_golden_fixture_t *fixture = &SCORING_STM32_TRANSPORT_GOLDEN_FIXTURES[index];
    scoring_stm32_transport_t transport;
    scoring_stm32_transport_frame_t decoded;
    const uint8_t *encoded = NULL;
    size_t encoded_byte_count = 0U;

    scoring_stm32_transport_init(
      &transport,
      sender_for(fixture->receiver),
      0U,
      fixture->sequence
    );
    CHECK(
      scoring_stm32_transport_prepare_transmit(
        &transport,
        fixture->message_type,
        fixture->payload,
        fixture->payload_length,
        &encoded,
        &encoded_byte_count
      ) == SCORING_STM32_TRANSPORT_OK
    );
    CHECK(encoded_byte_count == fixture->frame_length);
    CHECK(memcmp(encoded, fixture->frame, encoded_byte_count) == 0);
    CHECK(
      scoring_stm32_transport_decode(fixture->receiver, fixture->frame, fixture->frame_length, &decoded) ==
      SCORING_STM32_TRANSPORT_OK
    );
    CHECK(decoded.message_type == fixture->message_type);
    CHECK(decoded.sequence == fixture->sequence);
    CHECK(decoded.payload_length == fixture->payload_length);
    CHECK(memcmp(decoded.payload, fixture->payload, decoded.payload_length) == 0);
  }
}

static void test_fragmented_request_is_delivered_once(void) {
  const scoring_stm32_transport_golden_fixture_t *fixture = &SCORING_STM32_TRANSPORT_GOLDEN_FIXTURES[1];
  scoring_stm32_transport_t transport;
  scoring_stm32_transport_frame_t frame;

  CHECK(fixture->receiver == SCORING_STM32_TRANSPORT_RECEIVER_STM32);
  scoring_stm32_transport_init(&transport, fixture->receiver, fixture->sequence, 0U);
  CHECK(scoring_stm32_transport_receive(&transport, fixture->frame, 1U, &frame) == SCORING_STM32_TRANSPORT_NEED_MORE);
  CHECK(
    scoring_stm32_transport_receive(
      &transport,
      &fixture->frame[1],
      SCORING_STM32_TRANSPORT_HEADER_BYTES - 1U,
      &frame
    ) == SCORING_STM32_TRANSPORT_NEED_MORE
  );
  CHECK(
    scoring_stm32_transport_receive(
      &transport,
      &fixture->frame[SCORING_STM32_TRANSPORT_HEADER_BYTES],
      fixture->frame_length - SCORING_STM32_TRANSPORT_HEADER_BYTES,
      &frame
    ) == SCORING_STM32_TRANSPORT_OK
  );
  CHECK(frame.message_type == SCORING_STM32_TRANSPORT_REQUEST);
  CHECK(frame.sequence == 0U);
  CHECK(frame.payload_length == 0U);
}

static void test_invalid_frame_conditions_fail_closed(void) {
  const scoring_stm32_transport_golden_fixture_t *fixture = &SCORING_STM32_TRANSPORT_GOLDEN_FIXTURES[1];
  uint8_t altered[SCORING_STM32_TRANSPORT_MAX_FRAME_BYTES];
  scoring_stm32_transport_frame_t frame;

  (void)memcpy(altered, fixture->frame, fixture->frame_length);
  altered[0] = 0U;
  CHECK(scoring_stm32_transport_decode(fixture->receiver, altered, fixture->frame_length, &frame) == SCORING_STM32_TRANSPORT_MAGIC);

  (void)memcpy(altered, fixture->frame, fixture->frame_length);
  altered[2] = 2U;
  CHECK(scoring_stm32_transport_decode(fixture->receiver, altered, fixture->frame_length, &frame) == SCORING_STM32_TRANSPORT_VERSION);

  (void)memcpy(altered, fixture->frame, fixture->frame_length);
  altered[3] = 0xFFU;
  CHECK(scoring_stm32_transport_decode(fixture->receiver, altered, fixture->frame_length, &frame) == SCORING_STM32_TRANSPORT_MESSAGE_TYPE);

  CHECK(
    scoring_stm32_transport_decode(
      SCORING_STM32_TRANSPORT_RECEIVER_ESP32,
      fixture->frame,
      fixture->frame_length,
      &frame
    ) == SCORING_STM32_TRANSPORT_DIRECTION
  );

  (void)memcpy(altered, fixture->frame, fixture->frame_length);
  altered[5] = 1U;
  CHECK(scoring_stm32_transport_decode(fixture->receiver, altered, fixture->frame_length, &frame) == SCORING_STM32_TRANSPORT_FLAGS);

  (void)memcpy(altered, fixture->frame, fixture->frame_length);
  altered[10] = 0U;
  altered[11] = 0U;
  altered[12] = 0x10U;
  altered[13] = 1U;
  CHECK(
    scoring_stm32_transport_decode(fixture->receiver, altered, fixture->frame_length, &frame) ==
    SCORING_STM32_TRANSPORT_PAYLOAD_LENGTH
  );

  (void)memcpy(altered, fixture->frame, fixture->frame_length);
  altered[fixture->frame_length - 1U] ^= 1U;
  CHECK(scoring_stm32_transport_decode(fixture->receiver, altered, fixture->frame_length, &frame) == SCORING_STM32_TRANSPORT_CRC);
  CHECK(
    scoring_stm32_transport_decode(fixture->receiver, fixture->frame, fixture->frame_length - 1U, &frame) ==
    SCORING_STM32_TRANSPORT_LENGTH
  );
}

static void test_payload_and_receive_bounds_are_exact(void) {
  static uint8_t maximum_payload[SCORING_STM32_TRANSPORT_MAX_PAYLOAD_BYTES];
  static uint8_t oversized_payload[SCORING_STM32_TRANSPORT_MAX_PAYLOAD_BYTES + 1U];
  static uint8_t maximum_fragment[SCORING_STM32_TRANSPORT_MAX_FRAME_BYTES];
  scoring_stm32_transport_t sender;
  scoring_stm32_transport_t receiver;
  scoring_stm32_transport_frame_t frame;
  const uint8_t *encoded = NULL;
  size_t encoded_byte_count = 0U;

  maximum_payload[0] = 0x00U;
  maximum_payload[SCORING_STM32_TRANSPORT_MAX_PAYLOAD_BYTES - 1U] = 0xFFU;
  scoring_stm32_transport_init(&sender, SCORING_STM32_TRANSPORT_RECEIVER_STM32, 0U, 0U);
  CHECK(
    scoring_stm32_transport_prepare_transmit(
      &sender,
      SCORING_STM32_TRANSPORT_DECISION_RECORD,
      maximum_payload,
      sizeof(maximum_payload),
      &encoded,
      &encoded_byte_count
    ) == SCORING_STM32_TRANSPORT_OK
  );
  CHECK(encoded_byte_count == SCORING_STM32_TRANSPORT_MAX_FRAME_BYTES);
  CHECK(
    scoring_stm32_transport_decode(
      SCORING_STM32_TRANSPORT_RECEIVER_ESP32,
      encoded,
      encoded_byte_count,
      &frame
    ) == SCORING_STM32_TRANSPORT_OK
  );
  CHECK(frame.payload_length == sizeof(maximum_payload));
  CHECK(memcmp(frame.payload, maximum_payload, sizeof(maximum_payload)) == 0);

  scoring_stm32_transport_init(&sender, SCORING_STM32_TRANSPORT_RECEIVER_STM32, 0U, 0U);
  CHECK(
    scoring_stm32_transport_prepare_transmit(
      &sender,
      SCORING_STM32_TRANSPORT_DECISION_RECORD,
      oversized_payload,
      sizeof(oversized_payload),
      &encoded,
      &encoded_byte_count
    ) == SCORING_STM32_TRANSPORT_PAYLOAD_LENGTH
  );

  scoring_stm32_transport_init(&receiver, SCORING_STM32_TRANSPORT_RECEIVER_STM32, 0U, 0U);
  CHECK(scoring_stm32_transport_receive(&receiver, maximum_fragment, 1U, &frame) == SCORING_STM32_TRANSPORT_NEED_MORE);
  CHECK(
    scoring_stm32_transport_receive(&receiver, maximum_fragment, sizeof(maximum_fragment), &frame) ==
    SCORING_STM32_TRANSPORT_BACKPRESSURE
  );
  CHECK(scoring_stm32_transport_receive(&receiver, maximum_fragment, 0U, &frame) == SCORING_STM32_TRANSPORT_FAILED);
}

static void test_duplicate_and_reorder_block_receipt_until_recovery(void) {
  const scoring_stm32_transport_golden_fixture_t *fixture = &SCORING_STM32_TRANSPORT_GOLDEN_FIXTURES[1];
  scoring_stm32_transport_t receiver;
  scoring_stm32_transport_t sender;
  scoring_stm32_transport_frame_t frame;
  const uint8_t *reordered_bytes = NULL;
  size_t reordered_byte_count = 0U;

  scoring_stm32_transport_init(&receiver, fixture->receiver, 0U, 0U);
  CHECK(
    scoring_stm32_transport_receive(&receiver, fixture->frame, fixture->frame_length, &frame) ==
    SCORING_STM32_TRANSPORT_OK
  );
  CHECK(
    scoring_stm32_transport_receive(&receiver, fixture->frame, fixture->frame_length, &frame) ==
    SCORING_STM32_TRANSPORT_DUPLICATE
  );
  CHECK(
    scoring_stm32_transport_receive(&receiver, fixture->frame, fixture->frame_length, &frame) ==
    SCORING_STM32_TRANSPORT_FAILED
  );

  scoring_stm32_transport_init(&sender, SCORING_STM32_TRANSPORT_RECEIVER_ESP32, 0U, 1U);
  CHECK(
    scoring_stm32_transport_prepare_transmit(
      &sender,
      SCORING_STM32_TRANSPORT_REQUEST,
      NULL,
      0U,
      &reordered_bytes,
      &reordered_byte_count
    ) == SCORING_STM32_TRANSPORT_OK
  );
  scoring_stm32_transport_recover(&receiver, 0U, 0U);
  CHECK(
    scoring_stm32_transport_receive(&receiver, reordered_bytes, reordered_byte_count, &frame) ==
    SCORING_STM32_TRANSPORT_REORDER
  );
  CHECK(
    scoring_stm32_transport_receive(&receiver, fixture->frame, fixture->frame_length, &frame) ==
    SCORING_STM32_TRANSPORT_FAILED
  );
}

static void test_transport_state_boundaries_are_fail_closed(void) {
  const scoring_stm32_transport_golden_fixture_t *request = &SCORING_STM32_TRANSPORT_GOLDEN_FIXTURES[1];
  const scoring_stm32_transport_golden_fixture_t *status = &SCORING_STM32_TRANSPORT_GOLDEN_FIXTURES[2];
  scoring_stm32_transport_t receiver;
  scoring_stm32_transport_t sender;
  scoring_stm32_transport_frame_t frame = {
    .message_type = SCORING_STM32_TRANSPORT_REQUEST,
    .payload = request->frame,
    .payload_length = request->frame_length,
    .sequence = 99U
  };
  uint8_t altered[SCORING_STM32_TRANSPORT_MAX_FRAME_BYTES];
  const uint8_t *prepared_bytes = NULL;
  size_t prepared_byte_count = 0U;
  scoring_stm32_transport_frame_t decoded;

  (void)memcpy(altered, request->frame, request->frame_length);
  altered[0] = 0U;
  CHECK(scoring_stm32_transport_decode(request->receiver, altered, request->frame_length, &frame) == SCORING_STM32_TRANSPORT_MAGIC);
  CHECK(frame.message_type == 0);
  CHECK(frame.payload == NULL);
  CHECK(frame.payload_length == 0U);
  CHECK(frame.sequence == 0U);

  scoring_stm32_transport_init(&receiver, request->receiver, 0U, 0U);
  (void)memcpy(altered, request->frame, request->frame_length);
  altered[0] = 0U;
  CHECK(
    scoring_stm32_transport_receive(&receiver, altered, SCORING_STM32_TRANSPORT_HEADER_BYTES, &frame) ==
    SCORING_STM32_TRANSPORT_MAGIC
  );
  CHECK(frame.payload == NULL);

  scoring_stm32_transport_init(&receiver, request->receiver, 0U, 0U);
  (void)memcpy(altered, request->frame, request->frame_length);
  altered[5] = 1U;
  CHECK(
    scoring_stm32_transport_receive(&receiver, altered, SCORING_STM32_TRANSPORT_HEADER_BYTES, &frame) ==
    SCORING_STM32_TRANSPORT_FLAGS
  );
  CHECK(frame.payload == NULL);

  scoring_stm32_transport_init(&sender, SCORING_STM32_TRANSPORT_RECEIVER_STM32, 0U, 7U);
  scoring_stm32_transport_commit_transmit(&sender);
  CHECK(sender.next_transmit_sequence == 7U);
  CHECK(
    scoring_stm32_transport_prepare_transmit(
      &sender,
      SCORING_STM32_TRANSPORT_STATUS,
      NULL,
      0U,
      &prepared_bytes,
      &prepared_byte_count
    ) == SCORING_STM32_TRANSPORT_OK
  );
  CHECK(
    scoring_stm32_transport_decode(
      SCORING_STM32_TRANSPORT_RECEIVER_ESP32,
      prepared_bytes,
      prepared_byte_count,
      &decoded
    ) == SCORING_STM32_TRANSPORT_OK
  );
  CHECK(decoded.sequence == 7U);
  CHECK(
    scoring_stm32_transport_prepare_transmit(
      &sender,
      SCORING_STM32_TRANSPORT_STATUS,
      NULL,
      0U,
      &prepared_bytes,
      &prepared_byte_count
    ) == SCORING_STM32_TRANSPORT_BACKPRESSURE
  );

  scoring_stm32_transport_init(&sender, SCORING_STM32_TRANSPORT_RECEIVER_STM32, 0U, UINT32_MAX);
  CHECK(
    scoring_stm32_transport_prepare_transmit(
      &sender,
      SCORING_STM32_TRANSPORT_STATUS,
      NULL,
      0U,
      &prepared_bytes,
      &prepared_byte_count
    ) == SCORING_STM32_TRANSPORT_OK
  );
  scoring_stm32_transport_commit_transmit(&sender);
  CHECK(
    scoring_stm32_transport_prepare_transmit(
      &sender,
      SCORING_STM32_TRANSPORT_STATUS,
      NULL,
      0U,
      &prepared_bytes,
      &prepared_byte_count
    ) == SCORING_STM32_TRANSPORT_SEQUENCE_EXHAUSTED
  );

  scoring_stm32_transport_init(&receiver, status->receiver, status->sequence, 0U);
  CHECK(
    scoring_stm32_transport_receive(&receiver, status->frame, status->frame_length, &frame) ==
    SCORING_STM32_TRANSPORT_OK
  );
  CHECK(
    scoring_stm32_transport_receive(&receiver, status->frame, status->frame_length, &frame) ==
    SCORING_STM32_TRANSPORT_SEQUENCE_EXHAUSTED
  );
}

static void test_backpressure_blocks_repeat_transmission(void) {
  fake_transport_state_t state = { .publish_status = SCORING_STATUS_BACKPRESSURE };
  scoring_stm32_hardware_t hardware = { .transport = { .context = &state, .publish = fake_publish } };
  scoring_stm32_host_t host;

  CHECK(scoring_stm32_host_init(&host, &hardware) == SCORING_STATUS_OK);
  CHECK(
    scoring_stm32_host_publish_transport_frame(
      &host,
      SCORING_STM32_TRANSPORT_STATUS,
      NULL,
      0U
    ) == SCORING_STATUS_BACKPRESSURE
  );
  CHECK(state.publish_count == 1U);

  state.publish_status = SCORING_STATUS_OK;
  CHECK(
    scoring_stm32_host_publish_transport_frame(
      &host,
      SCORING_STM32_TRANSPORT_STATUS,
      NULL,
      0U
    ) == SCORING_STATUS_BACKPRESSURE
  );
  CHECK(state.publish_count == 1U);

  scoring_stm32_host_recover_transport(&host, 0U, 0U);
  CHECK(
    scoring_stm32_host_publish_transport_frame(
      &host,
      SCORING_STM32_TRANSPORT_STATUS,
      NULL,
      0U
    ) == SCORING_STATUS_OK
  );
  CHECK(state.publish_count == 2U);
}

static void test_default_host_cannot_publish_a_decision_and_preserves_adapter_failure(void) {
  fake_transport_state_t state = { .publish_status = SCORING_STATUS_HARDWARE_FAULT };
  scoring_stm32_hardware_t hardware = { .transport = { .context = &state, .publish = fake_publish } };
  scoring_stm32_host_t host;

  CHECK(scoring_stm32_host_init(&host, &hardware) == SCORING_STATUS_OK);
  CHECK(
    scoring_stm32_host_publish_transport_frame(
      &host,
      SCORING_STM32_TRANSPORT_DECISION_RECORD,
      NULL,
      0U
    ) == SCORING_STATUS_NOT_READY
  );
  CHECK(state.publish_count == 0U);

  CHECK(
    scoring_stm32_host_publish_transport_frame(
      &host,
      SCORING_STM32_TRANSPORT_STATUS,
      NULL,
      0U
    ) == SCORING_STATUS_HARDWARE_FAULT
  );
  CHECK(state.publish_count == 1U);

  state.publish_status = SCORING_STATUS_OK;
  CHECK(
    scoring_stm32_host_publish_transport_frame(
      &host,
      SCORING_STM32_TRANSPORT_STATUS,
      NULL,
      0U
    ) == SCORING_STATUS_BACKPRESSURE
  );
  CHECK(state.publish_count == 1U);
}

int main(void) {
  test_crc32c_check_value();
  test_generated_golden_frames_match_c_codec();
  test_fragmented_request_is_delivered_once();
  test_invalid_frame_conditions_fail_closed();
  test_payload_and_receive_bounds_are_exact();
  test_duplicate_and_reorder_block_receipt_until_recovery();
  test_transport_state_boundaries_are_fail_closed();
  test_backpressure_blocks_repeat_transmission();
  test_default_host_cannot_publish_a_decision_and_preserves_adapter_failure();
  return EXIT_SUCCESS;
}
