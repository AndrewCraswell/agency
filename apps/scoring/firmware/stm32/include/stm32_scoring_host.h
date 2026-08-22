#ifndef STM32_SCORING_HOST_H
#define STM32_SCORING_HOST_H

#include <stddef.h>
#include <stdint.h>

#include "stm32_transport.h"

#ifdef __cplusplus
extern "C" {
#endif

enum {
  SCORING_STM32_CONDUCTOR_COUNT = 7U,
  SCORING_STM32_MAX_DMA_FRAMES_PER_POLL = 8U,
  SCORING_STM32_MAX_COMPARATOR_EVENTS_PER_POLL = 16U
};

typedef enum scoring_status {
  SCORING_STATUS_OK = 0,
  SCORING_STATUS_UNAVAILABLE,
  SCORING_STATUS_INVALID_ARGUMENT,
  SCORING_STATUS_NOT_READY,
  SCORING_STATUS_OVERFLOW,
  SCORING_STATUS_BACKPRESSURE,
  SCORING_STATUS_HARDWARE_FAULT,
  SCORING_STATUS_INTEGRITY_FAILURE
} scoring_status_t;

typedef enum scoring_stm32_state {
  SCORING_STM32_STATE_UNAVAILABLE = 0,
  SCORING_STM32_STATE_READY,
  SCORING_STM32_STATE_FAULTED
} scoring_stm32_state_t;

typedef enum scoring_comparator_edge {
  SCORING_COMPARATOR_EDGE_FALLING = 0,
  SCORING_COMPARATOR_EDGE_RISING
} scoring_comparator_edge_t;

typedef struct scoring_adc_frame {
  uint16_t channel_codes[SCORING_STM32_CONDUCTOR_COUNT];
  uint64_t sampled_at_us;
} scoring_adc_frame_t;

typedef struct scoring_comparator_event {
  uint64_t occurred_at_us;
  uint8_t conductor;
  scoring_comparator_edge_t edge;
} scoring_comparator_event_t;

typedef struct scoring_clock_interface {
  void *context;
  scoring_status_t (*now_us)(void *context, uint64_t *out_now_us);
} scoring_clock_interface_t;

typedef struct scoring_adc_interface {
  void *context;
  scoring_status_t (*read_frame)(void *context, scoring_adc_frame_t *out_frame);
} scoring_adc_interface_t;

typedef struct scoring_comparator_interface {
  void *context;
  scoring_status_t (*read_events)(
    void *context,
    scoring_comparator_event_t *out_events,
    size_t event_capacity,
    size_t *out_event_count
  );
} scoring_comparator_interface_t;

typedef struct scoring_dma_interface {
  void *context;
  scoring_status_t (*pop_frames)(
    void *context,
    scoring_adc_frame_t *out_frames,
    size_t frame_capacity,
    size_t *out_frame_count
  );
} scoring_dma_interface_t;

typedef struct scoring_flash_interface {
  void *context;
  scoring_status_t (*read)(void *context, uint32_t offset, uint8_t *out_bytes, size_t byte_count);
  scoring_status_t (*write)(void *context, uint32_t offset, const uint8_t *bytes, size_t byte_count);
} scoring_flash_interface_t;

typedef struct scoring_watchdog_interface {
  void *context;
  scoring_status_t (*arm)(void *context);
  scoring_status_t (*service)(void *context);
} scoring_watchdog_interface_t;

typedef struct scoring_transport_interface {
  void *context;
  scoring_status_t (*publish)(void *context, const uint8_t *bytes, size_t byte_count);
} scoring_transport_interface_t;

typedef struct scoring_stm32_hardware {
  scoring_clock_interface_t clock;
  scoring_adc_interface_t adc;
  scoring_comparator_interface_t comparator;
  scoring_dma_interface_t dma;
  scoring_flash_interface_t flash;
  scoring_watchdog_interface_t watchdog;
  scoring_transport_interface_t transport;
} scoring_stm32_hardware_t;

typedef struct scoring_stm32_host {
  const scoring_stm32_hardware_t *hardware;
  scoring_stm32_transport_t transport;
  scoring_stm32_state_t state;
  uint64_t started_at_us;
} scoring_stm32_host_t;

/**
 * Returns substitutable interfaces whose operations all fail closed with
 * SCORING_STATUS_UNAVAILABLE. These defaults never emulate a score.
 */
const scoring_stm32_hardware_t *scoring_stm32_safe_hardware(void);

/** Validates that each required hardware operation is available. */
scoring_status_t scoring_stm32_validate_hardware(const scoring_stm32_hardware_t *hardware);

/** Binds one caller-owned hardware surface; binding starts unavailable. */
scoring_status_t scoring_stm32_host_init(
  scoring_stm32_host_t *host,
  const scoring_stm32_hardware_t *hardware
);

/**
 * Performs only availability checks and watchdog arming. It does not enable
 * excitation, configure pins, or make a scoring decision.
 */
scoring_status_t scoring_stm32_host_start(scoring_stm32_host_t *host);

/**
 * Polls bounded acquisition interfaces for host coverage. M3-04 owns the
 * qualification core; this scaffold intentionally emits no decision.
 */
scoring_status_t scoring_stm32_host_poll(scoring_stm32_host_t *host);

/**
 * Frames an already-authoritative payload and publishes it through the
 * substitutable transport adapter. A failed write blocks further output until
 * the owner establishes a recovery stream; this function makes no decision.
 */
scoring_status_t scoring_stm32_host_publish_transport_frame(
  scoring_stm32_host_t *host,
  scoring_stm32_transport_message_type_t message_type,
  const uint8_t *payload,
  size_t payload_length
);

/**
 * Gives a bounded raw link fragment to the C17 transport adapter. Only an
 * inbound request frame can be delivered to this STM32 role; no payload is
 * parsed as a scoring decision.
 */
scoring_stm32_transport_result_t scoring_stm32_host_receive_transport_fragment(
  scoring_stm32_host_t *host,
  const uint8_t *bytes,
  size_t byte_count,
  scoring_stm32_transport_frame_t *out_frame
);

/** Explicitly clears link-failure state at an owning recovery boundary. */
void scoring_stm32_host_recover_transport(
  scoring_stm32_host_t *host,
  uint32_t first_receive_sequence,
  uint32_t first_transmit_sequence
);

#ifdef __cplusplus
}
#endif

#endif
