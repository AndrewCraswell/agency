#include "scoring_esp32_hal.h"

#include <stdbool.h>
#include <stdio.h>
#include <string.h>

#define CHECK(condition)                                                                                               \
  do {                                                                                                                 \
    if (!(condition)) {                                                                                                \
      (void)fprintf(stderr, "%s:%d: check failed: %s\n", __FILE__, __LINE__, #condition);                         \
      return false;                                                                                                    \
    }                                                                                                                  \
  } while (false)

typedef struct fake_hal {
  scoring_esp32_hal_result_t adc_result;
  scoring_esp32_hal_result_t output_result;
  scoring_esp32_hal_result_t ir_result;
  scoring_esp32_hal_result_t receive_result;
  scoring_esp32_hal_result_t transmit_result;
  uint8_t adc_channel_count;
  uint8_t ir_level;
  uint64_t ir_at_us;
  size_t reported_receive_length;
  uint8_t received_bytes[SCORING_ESP32_HAL_MAX_ETHERNET_FRAME_BYTES];
  size_t received_length;
  uint8_t transmitted_bytes[SCORING_ESP32_HAL_MAX_ETHERNET_FRAME_BYTES];
  size_t transmitted_length;
  scoring_esp32_hal_time_t last_adc_time;
  scoring_esp32_hal_time_t last_ir_time;
  scoring_esp32_hal_output_request_t last_output;
} fake_hal_t;

static scoring_esp32_hal_result_t fake_read_adc(
  void *context,
  const scoring_esp32_hal_time_t *requested_at,
  scoring_esp32_hal_adc_observation_t *out_observation
) {
  fake_hal_t *fake = context;
  fake->last_adc_time = *requested_at;
  if (fake->adc_result != SCORING_ESP32_HAL_OK) return fake->adc_result;
  *out_observation = (scoring_esp32_hal_adc_observation_t){
    .sampled_at_us = requested_at->monotonic_us,
    .sequence = 17U,
    .channel_count = fake->adc_channel_count,
    .codes = {1U, 2U, 3U, 4U, 5U, 6U, 7U}
  };
  return SCORING_ESP32_HAL_OK;
}

static scoring_esp32_hal_result_t fake_apply_output(
  void *context,
  const scoring_esp32_hal_output_request_t *request
) {
  fake_hal_t *fake = context;
  fake->last_output = *request;
  return fake->output_result;
}

static scoring_esp32_hal_result_t fake_read_ir(
  void *context,
  const scoring_esp32_hal_time_t *observed_through,
  scoring_esp32_hal_ir_edge_t *out_edge
) {
  fake_hal_t *fake = context;
  fake->last_ir_time = *observed_through;
  if (fake->ir_result != SCORING_ESP32_HAL_OK) return fake->ir_result;
  *out_edge = (scoring_esp32_hal_ir_edge_t){.captured_at_us = fake->ir_at_us, .level = fake->ir_level};
  return SCORING_ESP32_HAL_OK;
}

static scoring_esp32_hal_result_t fake_receive(
  void *context,
  uint8_t *destination,
  size_t capacity,
  size_t *out_length
) {
  fake_hal_t *fake = context;
  if (fake->receive_result != SCORING_ESP32_HAL_OK) return fake->receive_result;
  if (fake->received_length > capacity) {
    *out_length = fake->reported_receive_length;
    return SCORING_ESP32_HAL_OK;
  }
  if (fake->received_length != 0U) (void)memcpy(destination, fake->received_bytes, fake->received_length);
  *out_length = fake->reported_receive_length;
  return SCORING_ESP32_HAL_OK;
}

static scoring_esp32_hal_result_t fake_transmit(void *context, const uint8_t *bytes, size_t length) {
  fake_hal_t *fake = context;
  if (length != 0U) (void)memcpy(fake->transmitted_bytes, bytes, length);
  fake->transmitted_length = length;
  return fake->transmit_result;
}

static scoring_esp32_hal_services_t services_for(fake_hal_t *fake) {
  return (scoring_esp32_hal_services_t){
    .adc = {.context = fake, .read = fake_read_adc},
    .outputs = {.context = fake, .apply = fake_apply_output},
    .ir = {.context = fake, .read_edge = fake_read_ir},
    .ethernet = {.context = fake, .receive = fake_receive, .transmit = fake_transmit}
  };
}

static bool test_adc_uses_explicit_monotonic_time(void) {
  fake_hal_t fake = {.adc_channel_count = SCORING_ESP32_HAL_ADC_CHANNEL_COUNT};
  scoring_esp32_hal_services_t services = services_for(&fake);
  const scoring_esp32_hal_time_t at = {.monotonic_us = 100U};
  scoring_esp32_hal_adc_observation_t observation = {0};

  CHECK(scoring_esp32_hal_read_adc(&services, &at, &observation) == SCORING_ESP32_HAL_OK);
  CHECK(fake.last_adc_time.monotonic_us == at.monotonic_us);
  CHECK(observation.sampled_at_us == at.monotonic_us && observation.sequence == 17U);
  CHECK(observation.codes[SCORING_ESP32_HAL_ADC_CHANNEL_COUNT - 1U] == 7U);
  CHECK(scoring_esp32_hal_read_adc(NULL, &at, &observation) == SCORING_ESP32_HAL_INVALID_ARGUMENT);
  CHECK(scoring_esp32_hal_read_adc(&services, NULL, &observation) == SCORING_ESP32_HAL_INVALID_ARGUMENT);
  CHECK(scoring_esp32_hal_read_adc(&services, &at, NULL) == SCORING_ESP32_HAL_INVALID_ARGUMENT);
  services.adc.read = NULL;
  CHECK(scoring_esp32_hal_read_adc(&services, &at, &observation) == SCORING_ESP32_HAL_UNAVAILABLE);
  services = services_for(&fake);
  fake.adc_result = SCORING_ESP32_HAL_NO_DATA;
  CHECK(scoring_esp32_hal_read_adc(&services, &at, &observation) == SCORING_ESP32_HAL_NO_DATA);
  fake.adc_result = (scoring_esp32_hal_result_t)99;
  CHECK(scoring_esp32_hal_read_adc(&services, &at, &observation) == SCORING_ESP32_HAL_UNAVAILABLE);
  fake.adc_result = SCORING_ESP32_HAL_OK;
  fake.adc_channel_count = SCORING_ESP32_HAL_ADC_CHANNEL_COUNT - 1U;
  CHECK(scoring_esp32_hal_read_adc(&services, &at, &observation) == SCORING_ESP32_HAL_INVALID_ARGUMENT);
  return true;
}

static bool test_output_permit_fails_closed(void) {
  fake_hal_t fake = {0};
  scoring_esp32_hal_services_t services = services_for(&fake);
  scoring_esp32_hal_output_request_t request = {.permit = SCORING_ESP32_HAL_OUTPUT_PERMITTED, .left_indicator_on = 1U};

  CHECK(scoring_esp32_hal_apply_outputs(&services, &request) == SCORING_ESP32_HAL_OK);
  CHECK(fake.last_output.permit == SCORING_ESP32_HAL_OUTPUT_PERMITTED && fake.last_output.left_indicator_on == 1U);
  CHECK(scoring_esp32_hal_request_safe_inactive(&services) == SCORING_ESP32_HAL_OK);
  CHECK(fake.last_output.permit == SCORING_ESP32_HAL_OUTPUT_SAFE_INACTIVE && fake.last_output.audible_on == 0U);
  request.permit = (scoring_esp32_hal_output_permit_t)2;
  CHECK(scoring_esp32_hal_apply_outputs(&services, &request) == SCORING_ESP32_HAL_INVALID_ARGUMENT);
  request.permit = SCORING_ESP32_HAL_OUTPUT_PERMITTED;
  request.right_indicator_on = 2U;
  CHECK(scoring_esp32_hal_apply_outputs(&services, &request) == SCORING_ESP32_HAL_INVALID_ARGUMENT);
  request.right_indicator_on = 0U;
  request.permit = SCORING_ESP32_HAL_OUTPUT_SAFE_INACTIVE;
  CHECK(scoring_esp32_hal_apply_outputs(&services, &request) == SCORING_ESP32_HAL_INVALID_ARGUMENT);
  request.left_indicator_on = 0U;
  CHECK(scoring_esp32_hal_apply_outputs(NULL, &request) == SCORING_ESP32_HAL_INVALID_ARGUMENT);
  CHECK(scoring_esp32_hal_apply_outputs(&services, NULL) == SCORING_ESP32_HAL_INVALID_ARGUMENT);
  services.outputs.apply = NULL;
  CHECK(scoring_esp32_hal_apply_outputs(&services, &request) == SCORING_ESP32_HAL_UNAVAILABLE);
  services = services_for(&fake);
  fake.output_result = (scoring_esp32_hal_result_t)99;
  CHECK(scoring_esp32_hal_apply_outputs(&services, &request) == SCORING_ESP32_HAL_UNAVAILABLE);
  return true;
}

static bool test_ir_edges_are_timestamped_input_only(void) {
  fake_hal_t fake = {.ir_at_us = 44U, .ir_level = 1U};
  scoring_esp32_hal_services_t services = services_for(&fake);
  const scoring_esp32_hal_time_t through = {.monotonic_us = 45U};
  scoring_esp32_hal_ir_edge_t edge = {0};

  CHECK(scoring_esp32_hal_read_ir_edge(&services, &through, &edge) == SCORING_ESP32_HAL_OK);
  CHECK(fake.last_ir_time.monotonic_us == 45U && edge.captured_at_us == 44U && edge.level == 1U);
  CHECK(scoring_esp32_hal_read_ir_edge(NULL, &through, &edge) == SCORING_ESP32_HAL_INVALID_ARGUMENT);
  CHECK(scoring_esp32_hal_read_ir_edge(&services, NULL, &edge) == SCORING_ESP32_HAL_INVALID_ARGUMENT);
  CHECK(scoring_esp32_hal_read_ir_edge(&services, &through, NULL) == SCORING_ESP32_HAL_INVALID_ARGUMENT);
  services.ir.read_edge = NULL;
  CHECK(scoring_esp32_hal_read_ir_edge(&services, &through, &edge) == SCORING_ESP32_HAL_UNAVAILABLE);
  services = services_for(&fake);
  fake.ir_result = SCORING_ESP32_HAL_NO_DATA;
  CHECK(scoring_esp32_hal_read_ir_edge(&services, &through, &edge) == SCORING_ESP32_HAL_NO_DATA);
  fake.ir_result = SCORING_ESP32_HAL_OK;
  fake.ir_at_us = 46U;
  CHECK(scoring_esp32_hal_read_ir_edge(&services, &through, &edge) == SCORING_ESP32_HAL_INVALID_ARGUMENT);
  fake.ir_at_us = 44U;
  fake.ir_level = 2U;
  CHECK(scoring_esp32_hal_read_ir_edge(&services, &through, &edge) == SCORING_ESP32_HAL_INVALID_ARGUMENT);
  return true;
}

static bool test_ethernet_is_bounded_and_opaque(void) {
  fake_hal_t fake = {.received_bytes = {0xA1U, 0xB2U}, .received_length = 2U, .reported_receive_length = 2U};
  scoring_esp32_hal_services_t services = services_for(&fake);
  uint8_t received[SCORING_ESP32_HAL_MAX_ETHERNET_FRAME_BYTES] = {0};
  static const uint8_t transmitted[] = {0xC3U, 0xD4U};
  size_t length = 0U;

  CHECK(scoring_esp32_hal_receive_ethernet(&services, received, sizeof(received), &length) == SCORING_ESP32_HAL_OK);
  CHECK(length == 2U && received[0] == 0xA1U && received[1] == 0xB2U);
  CHECK(scoring_esp32_hal_transmit_ethernet(&services, transmitted, sizeof(transmitted)) == SCORING_ESP32_HAL_OK);
  CHECK(fake.transmitted_length == sizeof(transmitted) && fake.transmitted_bytes[1] == transmitted[1]);
  CHECK(scoring_esp32_hal_receive_ethernet(NULL, received, sizeof(received), &length) == SCORING_ESP32_HAL_INVALID_ARGUMENT);
  CHECK(scoring_esp32_hal_receive_ethernet(&services, NULL, 1U, &length) == SCORING_ESP32_HAL_INVALID_ARGUMENT);
  CHECK(scoring_esp32_hal_receive_ethernet(&services, received, sizeof(received), NULL) == SCORING_ESP32_HAL_INVALID_ARGUMENT);
  CHECK(scoring_esp32_hal_receive_ethernet(&services, received, sizeof(received) + 1U, &length) == SCORING_ESP32_HAL_INVALID_ARGUMENT);
  services.ethernet.receive = NULL;
  CHECK(scoring_esp32_hal_receive_ethernet(&services, received, sizeof(received), &length) == SCORING_ESP32_HAL_UNAVAILABLE);
  services = services_for(&fake);
  fake.receive_result = SCORING_ESP32_HAL_NO_DATA;
  CHECK(scoring_esp32_hal_receive_ethernet(&services, received, sizeof(received), &length) == SCORING_ESP32_HAL_NO_DATA);
  fake.receive_result = SCORING_ESP32_HAL_OK;
  fake.reported_receive_length = sizeof(received) + 1U;
  CHECK(scoring_esp32_hal_receive_ethernet(&services, received, sizeof(received), &length) == SCORING_ESP32_HAL_BUFFER_TOO_SMALL);
  CHECK(scoring_esp32_hal_transmit_ethernet(NULL, transmitted, sizeof(transmitted)) == SCORING_ESP32_HAL_INVALID_ARGUMENT);
  CHECK(scoring_esp32_hal_transmit_ethernet(&services, NULL, 1U) == SCORING_ESP32_HAL_INVALID_ARGUMENT);
  CHECK(scoring_esp32_hal_transmit_ethernet(&services, transmitted, SCORING_ESP32_HAL_MAX_ETHERNET_FRAME_BYTES + 1U) == SCORING_ESP32_HAL_INVALID_ARGUMENT);
  services.ethernet.transmit = NULL;
  CHECK(scoring_esp32_hal_transmit_ethernet(&services, transmitted, sizeof(transmitted)) == SCORING_ESP32_HAL_UNAVAILABLE);
  services = services_for(&fake);
  fake.transmit_result = (scoring_esp32_hal_result_t)99;
  CHECK(scoring_esp32_hal_transmit_ethernet(&services, transmitted, sizeof(transmitted)) == SCORING_ESP32_HAL_UNAVAILABLE);
  return true;
}

int main(void) {
  return test_adc_uses_explicit_monotonic_time() && test_output_permit_fails_closed() &&
      test_ir_edges_are_timestamped_input_only() && test_ethernet_is_bounded_and_opaque()
    ? 0
    : 1;
}
