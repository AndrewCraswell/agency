#ifndef STM32_TRANSPORT_H
#define STM32_TRANSPORT_H

#include <stdbool.h>
#include <stddef.h>
#include <stdint.h>

#ifdef __cplusplus
extern "C" {
#endif

enum {
  SCORING_STM32_TRANSPORT_HEADER_BYTES = 14U,
  SCORING_STM32_TRANSPORT_CRC_BYTES = 4U,
  SCORING_STM32_TRANSPORT_MAX_PAYLOAD_BYTES = 4096U,
  SCORING_STM32_TRANSPORT_MAX_FRAME_BYTES =
    SCORING_STM32_TRANSPORT_HEADER_BYTES + SCORING_STM32_TRANSPORT_MAX_PAYLOAD_BYTES +
    SCORING_STM32_TRANSPORT_CRC_BYTES
};

typedef enum scoring_stm32_transport_receiver {
  SCORING_STM32_TRANSPORT_RECEIVER_STM32 = 0,
  SCORING_STM32_TRANSPORT_RECEIVER_ESP32
} scoring_stm32_transport_receiver_t;

typedef enum scoring_stm32_transport_message_type {
  SCORING_STM32_TRANSPORT_DECISION_RECORD = 1,
  SCORING_STM32_TRANSPORT_STATUS = 2,
  SCORING_STM32_TRANSPORT_REQUEST = 3,
  SCORING_STM32_TRANSPORT_RESPONSE = 4
} scoring_stm32_transport_message_type_t;

typedef enum scoring_stm32_transport_result {
  SCORING_STM32_TRANSPORT_OK = 0,
  SCORING_STM32_TRANSPORT_NEED_MORE,
  SCORING_STM32_TRANSPORT_INVALID_ARGUMENT,
  SCORING_STM32_TRANSPORT_MAGIC,
  SCORING_STM32_TRANSPORT_VERSION,
  SCORING_STM32_TRANSPORT_MESSAGE_TYPE,
  SCORING_STM32_TRANSPORT_DIRECTION,
  SCORING_STM32_TRANSPORT_FLAGS,
  SCORING_STM32_TRANSPORT_PAYLOAD_LENGTH,
  SCORING_STM32_TRANSPORT_LENGTH,
  SCORING_STM32_TRANSPORT_CRC,
  SCORING_STM32_TRANSPORT_DUPLICATE,
  SCORING_STM32_TRANSPORT_REORDER,
  SCORING_STM32_TRANSPORT_SEQUENCE_EXHAUSTED,
  SCORING_STM32_TRANSPORT_BACKPRESSURE,
  SCORING_STM32_TRANSPORT_FAILED
} scoring_stm32_transport_result_t;

typedef struct scoring_stm32_transport_frame {
  scoring_stm32_transport_message_type_t message_type;
  const uint8_t *payload;
  size_t payload_length;
  uint32_t sequence;
} scoring_stm32_transport_frame_t;

/**
 * Caller-owned bounded transport state. Receive fragments may be copied into
 * this state, while a prepared outbound frame is held until its adapter write
 * succeeds. Neither buffer is interpreted as a scoring decision.
 */
typedef struct scoring_stm32_transport {
  scoring_stm32_transport_receiver_t receiver;
  uint8_t receive_buffer[SCORING_STM32_TRANSPORT_MAX_FRAME_BYTES];
  uint8_t transmit_buffer[SCORING_STM32_TRANSPORT_MAX_FRAME_BYTES];
  size_t received_byte_count;
  size_t expected_frame_bytes;
  size_t transmit_byte_count;
  uint32_t expected_receive_sequence;
  uint32_t next_transmit_sequence;
  bool receive_sequence_initialized;
  bool receive_exhausted;
  bool receive_failed;
  bool transmit_exhausted;
  bool transmit_blocked;
} scoring_stm32_transport_t;

/** Calculates reflected Castagnoli CRC-32C without a byte-order transform. */
uint32_t scoring_stm32_transport_crc32c(const uint8_t *bytes, size_t byte_count);

/** Initializes one directed stream at its separately established boot boundary. */
void scoring_stm32_transport_init(
  scoring_stm32_transport_t *transport,
  scoring_stm32_transport_receiver_t receiver,
  uint32_t first_receive_sequence,
  uint32_t first_transmit_sequence
);

/**
 * Explicitly starts a new stream after the owning link-recovery lifecycle has
 * established a sender boundary. It clears failed, blocked, and partial state.
 */
void scoring_stm32_transport_recover(
  scoring_stm32_transport_t *transport,
  uint32_t first_receive_sequence,
  uint32_t first_transmit_sequence
);

/** Validates exactly one complete M2-05 frame without changing stream state. */
scoring_stm32_transport_result_t scoring_stm32_transport_decode(
  scoring_stm32_transport_receiver_t receiver,
  const uint8_t *bytes,
  size_t byte_count,
  scoring_stm32_transport_frame_t *out_frame
);

/**
 * Copies one bounded link fragment. A delivered frame remains valid until the
 * next feed or recover call. Invalid, duplicate, or reordered input blocks
 * further receipt until the caller establishes a new stream with recover.
 */
scoring_stm32_transport_result_t scoring_stm32_transport_receive(
  scoring_stm32_transport_t *transport,
  const uint8_t *bytes,
  size_t byte_count,
  scoring_stm32_transport_frame_t *out_frame
);

/** Prepares one local-to-peer frame using the current transmit sequence. */
scoring_stm32_transport_result_t scoring_stm32_transport_prepare_transmit(
  scoring_stm32_transport_t *transport,
  scoring_stm32_transport_message_type_t message_type,
  const uint8_t *payload,
  size_t payload_length,
  const uint8_t **out_bytes,
  size_t *out_byte_count
);

/** Advances the outbound stream only after the adapter reports a successful write. */
void scoring_stm32_transport_commit_transmit(scoring_stm32_transport_t *transport);

/** Blocks further transmission after a failed adapter write until recover. */
void scoring_stm32_transport_fail_backpressure(scoring_stm32_transport_t *transport);

#ifdef __cplusplus
}
#endif

#endif
