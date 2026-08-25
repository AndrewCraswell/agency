#ifndef SCORING_ESP32_HAL_H
#define SCORING_ESP32_HAL_H

#include <stddef.h>
#include <stdint.h>

/*
 * BP-521 target-neutral prototype boundary. Target adapters supply the
 * callbacks; this interface deliberately names no ESP-IDF type, peripheral,
 * wall clock, display, remote-control command, or scoring rule.
 */
enum {
  SCORING_ESP32_HAL_ADC_CHANNEL_COUNT = 7U,
  SCORING_ESP32_HAL_MAX_ETHERNET_FRAME_BYTES = 1536U
};

typedef enum scoring_esp32_hal_result {
  SCORING_ESP32_HAL_OK = 0,
  SCORING_ESP32_HAL_INVALID_ARGUMENT,
  SCORING_ESP32_HAL_UNAVAILABLE,
  SCORING_ESP32_HAL_NO_DATA,
  SCORING_ESP32_HAL_BUFFER_TOO_SMALL
} scoring_esp32_hal_result_t;

typedef struct scoring_esp32_hal_time {
  /* Monotonic microseconds supplied by the caller, never wall-clock time. */
  uint64_t monotonic_us;
} scoring_esp32_hal_time_t;

typedef struct scoring_esp32_hal_adc_observation {
  uint64_t sampled_at_us;
  uint32_t sequence;
  uint8_t channel_count;
  uint16_t codes[SCORING_ESP32_HAL_ADC_CHANNEL_COUNT];
} scoring_esp32_hal_adc_observation_t;

typedef enum scoring_esp32_hal_output_permit {
  SCORING_ESP32_HAL_OUTPUT_SAFE_INACTIVE = 0,
  SCORING_ESP32_HAL_OUTPUT_PERMITTED = 1
} scoring_esp32_hal_output_permit_t;

typedef struct scoring_esp32_hal_output_request {
  scoring_esp32_hal_output_permit_t permit;
  uint8_t left_indicator_on;
  uint8_t right_indicator_on;
  uint8_t audible_on;
} scoring_esp32_hal_output_request_t;

typedef struct scoring_esp32_hal_ir_edge {
  uint64_t captured_at_us;
  uint8_t level;
} scoring_esp32_hal_ir_edge_t;

typedef struct scoring_esp32_hal_adc_service {
  void *context;
  scoring_esp32_hal_result_t (*read)(
    void *context,
    const scoring_esp32_hal_time_t *requested_at,
    scoring_esp32_hal_adc_observation_t *out_observation
  );
} scoring_esp32_hal_adc_service_t;

typedef struct scoring_esp32_hal_output_service {
  void *context;
  scoring_esp32_hal_result_t (*apply)(void *context, const scoring_esp32_hal_output_request_t *request);
} scoring_esp32_hal_output_service_t;

typedef struct scoring_esp32_hal_ir_service {
  void *context;
  scoring_esp32_hal_result_t (*read_edge)(
    void *context,
    const scoring_esp32_hal_time_t *observed_through,
    scoring_esp32_hal_ir_edge_t *out_edge
  );
} scoring_esp32_hal_ir_service_t;

typedef struct scoring_esp32_hal_ethernet_service {
  void *context;
  /* Opaque bounded frames only. This boundary neither parses nor authorizes them. */
  scoring_esp32_hal_result_t (*receive)(void *context, uint8_t *destination, size_t capacity, size_t *out_length);
  scoring_esp32_hal_result_t (*transmit)(void *context, const uint8_t *bytes, size_t length);
} scoring_esp32_hal_ethernet_service_t;

typedef struct scoring_esp32_hal_services {
  scoring_esp32_hal_adc_service_t adc;
  scoring_esp32_hal_output_service_t outputs;
  scoring_esp32_hal_ir_service_t ir;
  scoring_esp32_hal_ethernet_service_t ethernet;
} scoring_esp32_hal_services_t;

/* ADC observations are accepted only when their timestamp exactly matches the explicit input. */
scoring_esp32_hal_result_t scoring_esp32_hal_read_adc(
  const scoring_esp32_hal_services_t *services,
  const scoring_esp32_hal_time_t *requested_at,
  scoring_esp32_hal_adc_observation_t *out_observation
);

/* Safe-inactive requests cannot carry energized output fields. */
scoring_esp32_hal_result_t scoring_esp32_hal_apply_outputs(
  const scoring_esp32_hal_services_t *services,
  const scoring_esp32_hal_output_request_t *request
);
scoring_esp32_hal_result_t scoring_esp32_hal_request_safe_inactive(const scoring_esp32_hal_services_t *services);

/* IR input is an edge capture; it is not a scoring command path. */
scoring_esp32_hal_result_t scoring_esp32_hal_read_ir_edge(
  const scoring_esp32_hal_services_t *services,
  const scoring_esp32_hal_time_t *observed_through,
  scoring_esp32_hal_ir_edge_t *out_edge
);

scoring_esp32_hal_result_t scoring_esp32_hal_receive_ethernet(
  const scoring_esp32_hal_services_t *services,
  uint8_t *destination,
  size_t capacity,
  size_t *out_length
);
scoring_esp32_hal_result_t scoring_esp32_hal_transmit_ethernet(
  const scoring_esp32_hal_services_t *services,
  const uint8_t *bytes,
  size_t length
);

#endif
