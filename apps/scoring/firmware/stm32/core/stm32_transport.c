#include "stm32_transport.h"

#include <limits.h>
#include <string.h>

enum {
  SCORING_STM32_TRANSPORT_MAGIC_FIRST = 0x53U,
  SCORING_STM32_TRANSPORT_MAGIC_SECOND = 0x43U,
  SCORING_STM32_TRANSPORT_FRAME_VERSION = 1U,
  SCORING_STM32_TRANSPORT_FLAGS_OFFSET = 4U,
  SCORING_STM32_TRANSPORT_SEQUENCE_OFFSET = 6U,
  SCORING_STM32_TRANSPORT_PAYLOAD_LENGTH_OFFSET = 10U
};

static uint16_t read_u16_be(const uint8_t *bytes) {
  return (uint16_t)(((uint16_t)bytes[0] << 8U) | (uint16_t)bytes[1]);
}

static uint32_t read_u32_be(const uint8_t *bytes) {
  return ((uint32_t)bytes[0] << 24U) | ((uint32_t)bytes[1] << 16U) |
    ((uint32_t)bytes[2] << 8U) | (uint32_t)bytes[3];
}

static void write_u32_be(uint8_t *bytes, uint32_t value) {
  bytes[0] = (uint8_t)(value >> 24U);
  bytes[1] = (uint8_t)(value >> 16U);
  bytes[2] = (uint8_t)(value >> 8U);
  bytes[3] = (uint8_t)value;
}

static bool is_known_message_type(uint8_t value) {
  return value >= (uint8_t)SCORING_STM32_TRANSPORT_DECISION_RECORD &&
    value <= (uint8_t)SCORING_STM32_TRANSPORT_RESPONSE;
}

static bool is_allowed_for_receiver(
  scoring_stm32_transport_receiver_t receiver,
  scoring_stm32_transport_message_type_t message_type
) {
  if (receiver == SCORING_STM32_TRANSPORT_RECEIVER_STM32) {
    return message_type == SCORING_STM32_TRANSPORT_REQUEST;
  }

  return message_type == SCORING_STM32_TRANSPORT_DECISION_RECORD ||
    message_type == SCORING_STM32_TRANSPORT_STATUS ||
    message_type == SCORING_STM32_TRANSPORT_RESPONSE;
}

static scoring_stm32_transport_receiver_t peer_receiver(scoring_stm32_transport_receiver_t receiver) {
  return receiver == SCORING_STM32_TRANSPORT_RECEIVER_STM32
    ? SCORING_STM32_TRANSPORT_RECEIVER_ESP32
    : SCORING_STM32_TRANSPORT_RECEIVER_STM32;
}

static bool is_valid_receiver(scoring_stm32_transport_receiver_t receiver) {
  return receiver == SCORING_STM32_TRANSPORT_RECEIVER_STM32 ||
    receiver == SCORING_STM32_TRANSPORT_RECEIVER_ESP32;
}

static void clear_receive_buffer(scoring_stm32_transport_t *transport) {
  transport->received_byte_count = 0U;
  transport->expected_frame_bytes = 0U;
}

static void clear_frame(scoring_stm32_transport_frame_t *frame) {
  if (frame != NULL) {
    frame->message_type = 0;
    frame->payload = NULL;
    frame->payload_length = 0U;
    frame->sequence = 0U;
  }
}

static scoring_stm32_transport_result_t validate_fixed_header(
  scoring_stm32_transport_receiver_t receiver,
  const uint8_t *bytes
) {
  scoring_stm32_transport_message_type_t message_type;

  if (
    bytes[0] != SCORING_STM32_TRANSPORT_MAGIC_FIRST ||
    bytes[1] != SCORING_STM32_TRANSPORT_MAGIC_SECOND
  ) {
    return SCORING_STM32_TRANSPORT_MAGIC;
  }

  if (bytes[2] != SCORING_STM32_TRANSPORT_FRAME_VERSION) {
    return SCORING_STM32_TRANSPORT_VERSION;
  }

  if (!is_known_message_type(bytes[3])) {
    return SCORING_STM32_TRANSPORT_MESSAGE_TYPE;
  }

  message_type = (scoring_stm32_transport_message_type_t)bytes[3];
  if (!is_allowed_for_receiver(receiver, message_type)) {
    return SCORING_STM32_TRANSPORT_DIRECTION;
  }

  if (read_u16_be(&bytes[SCORING_STM32_TRANSPORT_FLAGS_OFFSET]) != 0U) {
    return SCORING_STM32_TRANSPORT_FLAGS;
  }

  return SCORING_STM32_TRANSPORT_OK;
}

uint32_t scoring_stm32_transport_crc32c(const uint8_t *bytes, size_t byte_count) {
  uint32_t crc = UINT32_MAX;
  size_t index;

  if (bytes == NULL && byte_count != 0U) {
    return 0U;
  }

  for (index = 0U; index < byte_count; index += 1U) {
    uint8_t bit;
    crc ^= (uint32_t)bytes[index];
    for (bit = 0U; bit < 8U; bit += 1U) {
      crc = (crc >> 1U) ^ ((crc & 1U) != 0U ? UINT32_C(0x82F63B78) : 0U);
    }
  }

  return crc ^ UINT32_MAX;
}

void scoring_stm32_transport_init(
  scoring_stm32_transport_t *transport,
  scoring_stm32_transport_receiver_t receiver,
  uint32_t first_receive_sequence,
  uint32_t first_transmit_sequence
) {
  if (transport == NULL) {
    return;
  }

  (void)memset(transport, 0, sizeof(*transport));
  transport->receiver = receiver;
  transport->expected_receive_sequence = first_receive_sequence;
  transport->next_transmit_sequence = first_transmit_sequence;
  transport->receive_sequence_initialized = is_valid_receiver(receiver);
}

void scoring_stm32_transport_recover(
  scoring_stm32_transport_t *transport,
  uint32_t first_receive_sequence,
  uint32_t first_transmit_sequence
) {
  if (transport == NULL) {
    return;
  }

  clear_receive_buffer(transport);
  transport->expected_receive_sequence = first_receive_sequence;
  transport->next_transmit_sequence = first_transmit_sequence;
  transport->receive_sequence_initialized = is_valid_receiver(transport->receiver);
  transport->receive_exhausted = false;
  transport->receive_failed = false;
  transport->transmit_exhausted = false;
  transport->transmit_blocked = false;
  transport->transmit_byte_count = 0U;
}

scoring_stm32_transport_result_t scoring_stm32_transport_decode(
  scoring_stm32_transport_receiver_t receiver,
  const uint8_t *bytes,
  size_t byte_count,
  scoring_stm32_transport_frame_t *out_frame
) {
  uint32_t payload_length;
  size_t payload_end;
  uint32_t expected_crc;
  scoring_stm32_transport_message_type_t message_type;

  clear_frame(out_frame);
  if (!is_valid_receiver(receiver) || bytes == NULL || out_frame == NULL) {
    return SCORING_STM32_TRANSPORT_INVALID_ARGUMENT;
  }

  if (byte_count < SCORING_STM32_TRANSPORT_HEADER_BYTES) {
    return SCORING_STM32_TRANSPORT_LENGTH;
  }

  if (byte_count > SCORING_STM32_TRANSPORT_MAX_FRAME_BYTES) {
    return SCORING_STM32_TRANSPORT_LENGTH;
  }

  {
    scoring_stm32_transport_result_t header_result = validate_fixed_header(receiver, bytes);
    if (header_result != SCORING_STM32_TRANSPORT_OK) {
      return header_result;
    }
  }

  message_type = (scoring_stm32_transport_message_type_t)bytes[3];

  payload_length = read_u32_be(&bytes[SCORING_STM32_TRANSPORT_PAYLOAD_LENGTH_OFFSET]);
  if (payload_length > SCORING_STM32_TRANSPORT_MAX_PAYLOAD_BYTES) {
    return SCORING_STM32_TRANSPORT_PAYLOAD_LENGTH;
  }

  payload_end = SCORING_STM32_TRANSPORT_HEADER_BYTES + (size_t)payload_length;
  if (byte_count != payload_end + SCORING_STM32_TRANSPORT_CRC_BYTES) {
    return SCORING_STM32_TRANSPORT_LENGTH;
  }

  expected_crc = read_u32_be(&bytes[payload_end]);
  if (scoring_stm32_transport_crc32c(bytes, payload_end) != expected_crc) {
    return SCORING_STM32_TRANSPORT_CRC;
  }

  out_frame->message_type = message_type;
  out_frame->payload = &bytes[SCORING_STM32_TRANSPORT_HEADER_BYTES];
  out_frame->payload_length = (size_t)payload_length;
  out_frame->sequence = read_u32_be(&bytes[SCORING_STM32_TRANSPORT_SEQUENCE_OFFSET]);
  return SCORING_STM32_TRANSPORT_OK;
}

static scoring_stm32_transport_result_t fail_receive(
  scoring_stm32_transport_t *transport,
  scoring_stm32_transport_result_t result
) {
  clear_receive_buffer(transport);
  transport->receive_failed = true;
  return result;
}

scoring_stm32_transport_result_t scoring_stm32_transport_receive(
  scoring_stm32_transport_t *transport,
  const uint8_t *bytes,
  size_t byte_count,
  scoring_stm32_transport_frame_t *out_frame
) {
  scoring_stm32_transport_result_t result;
  uint32_t declared_payload_length;

  clear_frame(out_frame);
  if (transport == NULL || out_frame == NULL || (bytes == NULL && byte_count != 0U)) {
    return SCORING_STM32_TRANSPORT_INVALID_ARGUMENT;
  }

  if (!is_valid_receiver(transport->receiver) || !transport->receive_sequence_initialized) {
    return SCORING_STM32_TRANSPORT_INVALID_ARGUMENT;
  }

  if (transport->receive_exhausted) {
    return SCORING_STM32_TRANSPORT_SEQUENCE_EXHAUSTED;
  }

  if (transport->receive_failed) {
    return SCORING_STM32_TRANSPORT_FAILED;
  }

  if (byte_count > SCORING_STM32_TRANSPORT_MAX_FRAME_BYTES - transport->received_byte_count) {
    return fail_receive(transport, SCORING_STM32_TRANSPORT_BACKPRESSURE);
  }

  if (byte_count != 0U) {
    (void)memcpy(&transport->receive_buffer[transport->received_byte_count], bytes, byte_count);
    transport->received_byte_count += byte_count;
  }

  if (transport->received_byte_count < SCORING_STM32_TRANSPORT_HEADER_BYTES) {
    return SCORING_STM32_TRANSPORT_NEED_MORE;
  }

  result = validate_fixed_header(transport->receiver, transport->receive_buffer);
  if (result != SCORING_STM32_TRANSPORT_OK) {
    return fail_receive(transport, result);
  }

  declared_payload_length = read_u32_be(
    &transport->receive_buffer[SCORING_STM32_TRANSPORT_PAYLOAD_LENGTH_OFFSET]
  );
  if (declared_payload_length > SCORING_STM32_TRANSPORT_MAX_PAYLOAD_BYTES) {
    return fail_receive(transport, SCORING_STM32_TRANSPORT_PAYLOAD_LENGTH);
  }

  transport->expected_frame_bytes = SCORING_STM32_TRANSPORT_HEADER_BYTES +
    (size_t)declared_payload_length + SCORING_STM32_TRANSPORT_CRC_BYTES;
  if (transport->received_byte_count < transport->expected_frame_bytes) {
    return SCORING_STM32_TRANSPORT_NEED_MORE;
  }

  if (transport->received_byte_count > transport->expected_frame_bytes) {
    return fail_receive(transport, SCORING_STM32_TRANSPORT_LENGTH);
  }

  result = scoring_stm32_transport_decode(
    transport->receiver,
    transport->receive_buffer,
    transport->received_byte_count,
    out_frame
  );
  if (result != SCORING_STM32_TRANSPORT_OK) {
    return fail_receive(transport, result);
  }

  if (out_frame->sequence < transport->expected_receive_sequence) {
    return fail_receive(transport, SCORING_STM32_TRANSPORT_DUPLICATE);
  }

  if (out_frame->sequence > transport->expected_receive_sequence) {
    return fail_receive(transport, SCORING_STM32_TRANSPORT_REORDER);
  }

  if (out_frame->sequence == UINT32_MAX) {
    transport->receive_exhausted = true;
  } else {
    transport->expected_receive_sequence += 1U;
  }

  clear_receive_buffer(transport);
  return SCORING_STM32_TRANSPORT_OK;
}

scoring_stm32_transport_result_t scoring_stm32_transport_prepare_transmit(
  scoring_stm32_transport_t *transport,
  scoring_stm32_transport_message_type_t message_type,
  const uint8_t *payload,
  size_t payload_length,
  const uint8_t **out_bytes,
  size_t *out_byte_count
) {
  size_t payload_end;

  if (out_bytes != NULL) {
    *out_bytes = NULL;
  }
  if (out_byte_count != NULL) {
    *out_byte_count = 0U;
  }

  if (transport == NULL || out_bytes == NULL || out_byte_count == NULL) {
    return SCORING_STM32_TRANSPORT_INVALID_ARGUMENT;
  }

  if (!is_valid_receiver(transport->receiver) || !is_known_message_type((uint8_t)message_type)) {
    return SCORING_STM32_TRANSPORT_INVALID_ARGUMENT;
  }

  if (payload == NULL && payload_length != 0U) {
    return SCORING_STM32_TRANSPORT_INVALID_ARGUMENT;
  }

  if (payload_length > SCORING_STM32_TRANSPORT_MAX_PAYLOAD_BYTES) {
    return SCORING_STM32_TRANSPORT_PAYLOAD_LENGTH;
  }

  if (!is_allowed_for_receiver(peer_receiver(transport->receiver), message_type)) {
    return SCORING_STM32_TRANSPORT_DIRECTION;
  }

  if (transport->transmit_blocked || transport->transmit_byte_count != 0U) {
    return SCORING_STM32_TRANSPORT_BACKPRESSURE;
  }

  if (transport->transmit_exhausted) {
    return SCORING_STM32_TRANSPORT_SEQUENCE_EXHAUSTED;
  }

  transport->transmit_buffer[0] = SCORING_STM32_TRANSPORT_MAGIC_FIRST;
  transport->transmit_buffer[1] = SCORING_STM32_TRANSPORT_MAGIC_SECOND;
  transport->transmit_buffer[2] = SCORING_STM32_TRANSPORT_FRAME_VERSION;
  transport->transmit_buffer[3] = (uint8_t)message_type;
  transport->transmit_buffer[4] = 0U;
  transport->transmit_buffer[5] = 0U;
  write_u32_be(&transport->transmit_buffer[SCORING_STM32_TRANSPORT_SEQUENCE_OFFSET], transport->next_transmit_sequence);
  write_u32_be(&transport->transmit_buffer[SCORING_STM32_TRANSPORT_PAYLOAD_LENGTH_OFFSET], (uint32_t)payload_length);
  if (payload_length != 0U) {
    (void)memcpy(&transport->transmit_buffer[SCORING_STM32_TRANSPORT_HEADER_BYTES], payload, payload_length);
  }

  payload_end = SCORING_STM32_TRANSPORT_HEADER_BYTES + payload_length;
  write_u32_be(
    &transport->transmit_buffer[payload_end],
    scoring_stm32_transport_crc32c(transport->transmit_buffer, payload_end)
  );
  transport->transmit_byte_count = payload_end + SCORING_STM32_TRANSPORT_CRC_BYTES;
  *out_bytes = transport->transmit_buffer;
  *out_byte_count = transport->transmit_byte_count;
  return SCORING_STM32_TRANSPORT_OK;
}

void scoring_stm32_transport_commit_transmit(scoring_stm32_transport_t *transport) {
  if (
    transport == NULL ||
    transport->transmit_blocked ||
    transport->transmit_exhausted ||
    transport->transmit_byte_count == 0U
  ) {
    return;
  }

  if (transport->next_transmit_sequence == UINT32_MAX) {
    transport->transmit_exhausted = true;
  } else {
    transport->next_transmit_sequence += 1U;
  }
  transport->transmit_byte_count = 0U;
}

void scoring_stm32_transport_fail_backpressure(scoring_stm32_transport_t *transport) {
  if (transport != NULL) {
    transport->transmit_blocked = true;
    transport->transmit_byte_count = 0U;
  }
}
