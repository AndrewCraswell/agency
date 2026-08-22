#include "stm32_scoring_host.h"
#include "stm32_golden_vectors.h"

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

typedef struct fake_hardware_state {
  size_t comparator_event_count;
  size_t dma_frame_count;
  size_t watchdog_arm_count;
  size_t watchdog_service_count;
  uint64_t now_us;
  scoring_status_t adc_status;
  scoring_status_t clock_status;
  scoring_status_t comparator_status;
  scoring_status_t dma_status;
  scoring_status_t watchdog_arm_status;
  scoring_status_t watchdog_service_status;
} fake_hardware_state_t;

static scoring_status_t fake_now_us(void *context, uint64_t *out_now_us) {
  fake_hardware_state_t *state = context;

  if (state->clock_status != SCORING_STATUS_OK) {
    return state->clock_status;
  }

  *out_now_us = state->now_us;
  return SCORING_STATUS_OK;
}

static scoring_status_t fake_read_frame(void *context, scoring_adc_frame_t *out_frame) {
  fake_hardware_state_t *state = context;

  if (state->adc_status != SCORING_STATUS_OK) {
    return state->adc_status;
  }

  memset(out_frame, 0, sizeof(*out_frame));
  out_frame->sampled_at_us = 41U;
  return SCORING_STATUS_OK;
}

static scoring_status_t fake_read_events(
  void *context,
  scoring_comparator_event_t *out_events,
  size_t event_capacity,
  size_t *out_event_count
) {
  fake_hardware_state_t *state = context;
  (void)out_events;
  (void)event_capacity;
  *out_event_count = state->comparator_event_count;
  return state->comparator_status;
}

static scoring_status_t fake_pop_frames(
  void *context,
  scoring_adc_frame_t *out_frames,
  size_t frame_capacity,
  size_t *out_frame_count
) {
  fake_hardware_state_t *state = context;
  (void)out_frames;
  (void)frame_capacity;
  *out_frame_count = state->dma_frame_count;
  return state->dma_status;
}

static scoring_status_t fake_flash_read(void *context, uint32_t offset, uint8_t *out_bytes, size_t byte_count) {
  (void)context;
  (void)offset;
  (void)out_bytes;
  (void)byte_count;
  return SCORING_STATUS_OK;
}

static scoring_status_t fake_flash_write(void *context, uint32_t offset, const uint8_t *bytes, size_t byte_count) {
  (void)context;
  (void)offset;
  (void)bytes;
  (void)byte_count;
  return SCORING_STATUS_OK;
}

static scoring_status_t fake_watchdog_arm(void *context) {
  fake_hardware_state_t *state = context;
  state->watchdog_arm_count += 1U;
  return state->watchdog_arm_status;
}

static scoring_status_t fake_watchdog_service(void *context) {
  fake_hardware_state_t *state = context;
  state->watchdog_service_count += 1U;
  return state->watchdog_service_status;
}

static scoring_status_t fake_publish(void *context, const uint8_t *bytes, size_t byte_count) {
  (void)context;
  (void)bytes;
  (void)byte_count;
  return SCORING_STATUS_OK;
}

static scoring_stm32_hardware_t make_fake_hardware(fake_hardware_state_t *state) {
  scoring_stm32_hardware_t hardware = {
    .clock = { .context = state, .now_us = fake_now_us },
    .adc = { .context = state, .read_frame = fake_read_frame },
    .comparator = { .context = state, .read_events = fake_read_events },
    .dma = { .context = state, .pop_frames = fake_pop_frames },
    .flash = { .context = state, .read = fake_flash_read, .write = fake_flash_write },
    .watchdog = { .context = state, .arm = fake_watchdog_arm, .service = fake_watchdog_service },
    .transport = { .context = state, .publish = fake_publish }
  };
  return hardware;
}

static void start_ready_host(
  scoring_stm32_host_t *host,
  scoring_stm32_hardware_t *hardware,
  fake_hardware_state_t *state
) {
  *hardware = make_fake_hardware(state);
  CHECK(scoring_stm32_host_init(host, hardware) == SCORING_STATUS_OK);
  CHECK(scoring_stm32_host_start(host) == SCORING_STATUS_OK);
  CHECK(host->state == SCORING_STM32_STATE_READY);
}

static void test_safe_defaults_remain_unavailable(void) {
  scoring_stm32_host_t host;
  const scoring_stm32_hardware_t *safe_hardware = scoring_stm32_safe_hardware();

  CHECK(scoring_stm32_host_init(&host, safe_hardware) == SCORING_STATUS_OK);
  CHECK(scoring_stm32_host_start(&host) == SCORING_STATUS_UNAVAILABLE);
  CHECK(host.state == SCORING_STM32_STATE_UNAVAILABLE);
  CHECK(scoring_stm32_host_poll(&host) == SCORING_STATUS_NOT_READY);
}

static void test_missing_callback_fails_before_start(void) {
  fake_hardware_state_t state = { .now_us = 1234U };
  scoring_stm32_hardware_t hardware = make_fake_hardware(&state);
  scoring_stm32_host_t host;

  hardware.adc.read_frame = NULL;
  CHECK(scoring_stm32_validate_hardware(&hardware) == SCORING_STATUS_INVALID_ARGUMENT);
  CHECK(scoring_stm32_host_init(&host, &hardware) == SCORING_STATUS_OK);
  CHECK(scoring_stm32_host_start(&host) == SCORING_STATUS_INVALID_ARGUMENT);
  CHECK(host.state == SCORING_STM32_STATE_FAULTED);
}

static void test_clock_and_watchdog_start_failures_remain_unavailable(void) {
  fake_hardware_state_t clock_failure = { .clock_status = SCORING_STATUS_HARDWARE_FAULT, .now_us = 1234U };
  fake_hardware_state_t watchdog_failure = {
    .now_us = 1234U,
    .watchdog_arm_status = SCORING_STATUS_HARDWARE_FAULT
  };
  scoring_stm32_hardware_t hardware;
  scoring_stm32_host_t host;

  hardware = make_fake_hardware(&clock_failure);
  CHECK(scoring_stm32_host_init(&host, &hardware) == SCORING_STATUS_OK);
  CHECK(scoring_stm32_host_start(&host) == SCORING_STATUS_HARDWARE_FAULT);
  CHECK(host.state == SCORING_STM32_STATE_UNAVAILABLE);

  hardware = make_fake_hardware(&watchdog_failure);
  CHECK(scoring_stm32_host_init(&host, &hardware) == SCORING_STATUS_OK);
  CHECK(scoring_stm32_host_start(&host) == SCORING_STATUS_HARDWARE_FAULT);
  CHECK(host.state == SCORING_STM32_STATE_UNAVAILABLE);
}

static void test_acquisition_and_watchdog_poll_failures_remain_unavailable(void) {
  fake_hardware_state_t adc_failure = { .adc_status = SCORING_STATUS_HARDWARE_FAULT, .now_us = 1234U };
  fake_hardware_state_t dma_failure = { .dma_status = SCORING_STATUS_HARDWARE_FAULT, .now_us = 1234U };
  fake_hardware_state_t comparator_failure = {
    .comparator_status = SCORING_STATUS_HARDWARE_FAULT,
    .now_us = 1234U
  };
  fake_hardware_state_t watchdog_failure = {
    .now_us = 1234U,
    .watchdog_service_status = SCORING_STATUS_HARDWARE_FAULT
  };
  scoring_stm32_hardware_t hardware;
  scoring_stm32_host_t host;

  start_ready_host(&host, &hardware, &adc_failure);
  CHECK(scoring_stm32_host_poll(&host) == SCORING_STATUS_HARDWARE_FAULT);
  CHECK(host.state == SCORING_STM32_STATE_UNAVAILABLE);

  start_ready_host(&host, &hardware, &dma_failure);
  CHECK(scoring_stm32_host_poll(&host) == SCORING_STATUS_HARDWARE_FAULT);
  CHECK(host.state == SCORING_STM32_STATE_UNAVAILABLE);

  start_ready_host(&host, &hardware, &comparator_failure);
  CHECK(scoring_stm32_host_poll(&host) == SCORING_STATUS_HARDWARE_FAULT);
  CHECK(host.state == SCORING_STM32_STATE_UNAVAILABLE);

  start_ready_host(&host, &hardware, &watchdog_failure);
  CHECK(scoring_stm32_host_poll(&host) == SCORING_STATUS_HARDWARE_FAULT);
  CHECK(host.state == SCORING_STM32_STATE_UNAVAILABLE);
}

static void test_bounded_dma_and_comparator_fail_closed(void) {
  fake_hardware_state_t dma_overflow = {
    .dma_frame_count = SCORING_STM32_MAX_DMA_FRAMES_PER_POLL + 1U,
    .now_us = 1234U
  };
  fake_hardware_state_t comparator_overflow = {
    .comparator_event_count = SCORING_STM32_MAX_COMPARATOR_EVENTS_PER_POLL + 1U,
    .now_us = 1234U
  };
  scoring_stm32_hardware_t hardware;
  scoring_stm32_host_t host;

  start_ready_host(&host, &hardware, &dma_overflow);
  CHECK(scoring_stm32_host_poll(&host) == SCORING_STATUS_OVERFLOW);
  CHECK(host.state == SCORING_STM32_STATE_UNAVAILABLE);

  start_ready_host(&host, &hardware, &comparator_overflow);
  CHECK(scoring_stm32_host_poll(&host) == SCORING_STATUS_OVERFLOW);
  CHECK(host.state == SCORING_STM32_STATE_UNAVAILABLE);
}

static void test_checked_golden_fixture_translation(void) {
  size_t index;
  size_t total_diagnostics = 0U;
  size_t total_hits = 0U;

  CHECK(strcmp(SCORING_GOLDEN_VECTOR_FORMAT, "scoring-firmware-golden-vectors") == 0);
  CHECK(strcmp(SCORING_GOLDEN_VECTOR_RULE_SET_REVISION, "rules-1") == 0);
  CHECK(strcmp(SCORING_GOLDEN_VECTOR_TIMING_TABLE_REVISION, "timing-1") == 0);
  CHECK(SCORING_GOLDEN_VECTOR_COUNT == 54U);

  for (index = 0U; index < SCORING_GOLDEN_VECTOR_COUNT; index += 1U) {
    const scoring_golden_vector_fixture_t *fixture = &SCORING_GOLDEN_VECTORS[index];
    CHECK(fixture->id[0] != '\0');
    CHECK(fixture->boundary_us > 0U);
    CHECK(fixture->stimulus_sample_count > 0U);
    total_diagnostics += fixture->diagnostic_count;
    total_hits += fixture->hit_count;
  }

  CHECK(total_diagnostics > 0U);
  CHECK(total_hits > 0U);
}

int main(void) {
  test_safe_defaults_remain_unavailable();
  test_missing_callback_fails_before_start();
  test_clock_and_watchdog_start_failures_remain_unavailable();
  test_acquisition_and_watchdog_poll_failures_remain_unavailable();
  test_bounded_dma_and_comparator_fail_closed();
  test_checked_golden_fixture_translation();
  return EXIT_SUCCESS;
}
