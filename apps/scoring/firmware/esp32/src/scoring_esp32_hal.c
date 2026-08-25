#include "scoring_esp32_hal.h"

#include <stdbool.h>

static bool result_is_known(scoring_esp32_hal_result_t result) {
  return result >= SCORING_ESP32_HAL_OK && result <= SCORING_ESP32_HAL_BUFFER_TOO_SMALL;
}

static scoring_esp32_hal_result_t normalized_result(scoring_esp32_hal_result_t result) {
  return result_is_known(result) ? result : SCORING_ESP32_HAL_UNAVAILABLE;
}

static bool output_request_is_valid(const scoring_esp32_hal_output_request_t *request) {
  if (
    request->permit != SCORING_ESP32_HAL_OUTPUT_SAFE_INACTIVE && request->permit != SCORING_ESP32_HAL_OUTPUT_PERMITTED
  ) {
    return false;
  }
  if (request->left_indicator_on > 1U || request->right_indicator_on > 1U || request->audible_on > 1U) {
    return false;
  }
  return request->permit != SCORING_ESP32_HAL_OUTPUT_SAFE_INACTIVE ||
    (request->left_indicator_on == 0U && request->right_indicator_on == 0U && request->audible_on == 0U);
}

scoring_esp32_hal_result_t scoring_esp32_hal_read_adc(
  const scoring_esp32_hal_services_t *services,
  const scoring_esp32_hal_time_t *requested_at,
  scoring_esp32_hal_adc_observation_t *out_observation
) {
  scoring_esp32_hal_adc_observation_t observation = {0};
  scoring_esp32_hal_result_t result;
  if (services == NULL || requested_at == NULL || out_observation == NULL) return SCORING_ESP32_HAL_INVALID_ARGUMENT;
  if (services->adc.read == NULL) return SCORING_ESP32_HAL_UNAVAILABLE;

  result = normalized_result(services->adc.read(services->adc.context, requested_at, &observation));
  if (result != SCORING_ESP32_HAL_OK) return result;
  if (
    observation.sampled_at_us != requested_at->monotonic_us ||
    observation.channel_count != SCORING_ESP32_HAL_ADC_CHANNEL_COUNT
  ) {
    return SCORING_ESP32_HAL_INVALID_ARGUMENT;
  }
  *out_observation = observation;
  return SCORING_ESP32_HAL_OK;
}

scoring_esp32_hal_result_t scoring_esp32_hal_apply_outputs(
  const scoring_esp32_hal_services_t *services,
  const scoring_esp32_hal_output_request_t *request
) {
  if (services == NULL || request == NULL || !output_request_is_valid(request)) return SCORING_ESP32_HAL_INVALID_ARGUMENT;
  if (services->outputs.apply == NULL) return SCORING_ESP32_HAL_UNAVAILABLE;
  return normalized_result(services->outputs.apply(services->outputs.context, request));
}

scoring_esp32_hal_result_t scoring_esp32_hal_request_safe_inactive(const scoring_esp32_hal_services_t *services) {
  static const scoring_esp32_hal_output_request_t request = {
    .permit = SCORING_ESP32_HAL_OUTPUT_SAFE_INACTIVE,
    .left_indicator_on = 0U,
    .right_indicator_on = 0U,
    .audible_on = 0U
  };
  return scoring_esp32_hal_apply_outputs(services, &request);
}

scoring_esp32_hal_result_t scoring_esp32_hal_read_ir_edge(
  const scoring_esp32_hal_services_t *services,
  const scoring_esp32_hal_time_t *observed_through,
  scoring_esp32_hal_ir_edge_t *out_edge
) {
  scoring_esp32_hal_ir_edge_t edge = {0};
  scoring_esp32_hal_result_t result;
  if (services == NULL || observed_through == NULL || out_edge == NULL) return SCORING_ESP32_HAL_INVALID_ARGUMENT;
  if (services->ir.read_edge == NULL) return SCORING_ESP32_HAL_UNAVAILABLE;

  result = normalized_result(services->ir.read_edge(services->ir.context, observed_through, &edge));
  if (result != SCORING_ESP32_HAL_OK) return result;
  if (edge.captured_at_us > observed_through->monotonic_us || edge.level > 1U) return SCORING_ESP32_HAL_INVALID_ARGUMENT;
  *out_edge = edge;
  return SCORING_ESP32_HAL_OK;
}

scoring_esp32_hal_result_t scoring_esp32_hal_receive_ethernet(
  const scoring_esp32_hal_services_t *services,
  uint8_t *destination,
  size_t capacity,
  size_t *out_length
) {
  size_t received = 0U;
  scoring_esp32_hal_result_t result;
  if (
    services == NULL || out_length == NULL || (destination == NULL && capacity != 0U) ||
    capacity > SCORING_ESP32_HAL_MAX_ETHERNET_FRAME_BYTES
  ) {
    return SCORING_ESP32_HAL_INVALID_ARGUMENT;
  }
  if (services->ethernet.receive == NULL) return SCORING_ESP32_HAL_UNAVAILABLE;

  result = normalized_result(services->ethernet.receive(services->ethernet.context, destination, capacity, &received));
  if (result != SCORING_ESP32_HAL_OK) return result;
  if (received > capacity || received > SCORING_ESP32_HAL_MAX_ETHERNET_FRAME_BYTES) return SCORING_ESP32_HAL_BUFFER_TOO_SMALL;
  *out_length = received;
  return SCORING_ESP32_HAL_OK;
}

scoring_esp32_hal_result_t scoring_esp32_hal_transmit_ethernet(
  const scoring_esp32_hal_services_t *services,
  const uint8_t *bytes,
  size_t length
) {
  if (
    services == NULL || (bytes == NULL && length != 0U) ||
    length > SCORING_ESP32_HAL_MAX_ETHERNET_FRAME_BYTES
  ) {
    return SCORING_ESP32_HAL_INVALID_ARGUMENT;
  }
  if (services->ethernet.transmit == NULL) return SCORING_ESP32_HAL_UNAVAILABLE;
  return normalized_result(services->ethernet.transmit(services->ethernet.context, bytes, length));
}
