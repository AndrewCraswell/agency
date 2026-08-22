#include "stm32_target_startup.h"

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

typedef enum fake_step {
  FAKE_STEP_SAFE_OUTPUTS = 0,
  FAKE_STEP_MPU,
  FAKE_STEP_CLOCKS,
  FAKE_STEP_SUPERVISOR,
  FAKE_STEP_INTEGRITY,
  FAKE_STEP_ACQUISITION,
  FAKE_STEP_VERIFY_OUTPUTS,
  FAKE_STEP_WATCHDOG
} fake_step_t;

typedef struct fake_platform_state {
  fake_step_t steps[8];
  size_t step_count;
  fake_step_t failing_step;
} fake_platform_state_t;

static scoring_status_t record_step(fake_platform_state_t *state, fake_step_t step) {
  state->steps[state->step_count] = step;
  state->step_count += 1U;
  return state->failing_step == step ? SCORING_STATUS_HARDWARE_FAULT : SCORING_STATUS_OK;
}

static scoring_status_t assert_safe_outputs(void *context) {
  return record_step(context, FAKE_STEP_SAFE_OUTPUTS);
}

static scoring_status_t configure_mpu(void *context) {
  return record_step(context, FAKE_STEP_MPU);
}

static scoring_status_t configure_clocks(void *context) {
  return record_step(context, FAKE_STEP_CLOCKS);
}

static scoring_status_t validate_supervisor(void *context) {
  return record_step(context, FAKE_STEP_SUPERVISOR);
}

static scoring_status_t validate_integrity(void *context) {
  return record_step(context, FAKE_STEP_INTEGRITY);
}

static scoring_status_t validate_acquisition_safety(void *context) {
  return record_step(context, FAKE_STEP_ACQUISITION);
}

static scoring_status_t verify_safe_outputs(void *context) {
  return record_step(context, FAKE_STEP_VERIFY_OUTPUTS);
}

static scoring_status_t arm_watchdog(void *context) {
  return record_step(context, FAKE_STEP_WATCHDOG);
}

static scoring_stm32_target_platform_t make_platform(fake_platform_state_t *state) {
  scoring_stm32_target_platform_t platform = {
    .context = state,
    .assert_safe_outputs = assert_safe_outputs,
    .configure_mpu = configure_mpu,
    .configure_clocks = configure_clocks,
    .validate_supervisor = validate_supervisor,
    .validate_integrity = validate_integrity,
    .validate_acquisition_safety = validate_acquisition_safety,
    .verify_safe_outputs = verify_safe_outputs,
    .arm_watchdog = arm_watchdog
  };
  return platform;
}

static void check_unavailable_safe(const scoring_stm32_target_t *target) {
  CHECK(target->state == SCORING_STM32_TARGET_STATE_UNAVAILABLE);
  CHECK(target->output_state == SCORING_STM32_OUTPUT_STATE_SAFE_INACTIVE);
  CHECK(!target->safe_outputs_verified);
}

static void test_manifest_is_bounded_to_the_candidate_device(void) {
  const scoring_stm32_target_manifest_t *manifest = scoring_stm32_target_manifest();

  CHECK(strcmp(manifest->part_number, "STM32G474RET3TR") == 0);
  CHECK(manifest->maximum_core_clock_hz == 170000000U);
  CHECK(manifest->requires_mpu);
  CHECK(manifest->requires_external_hse_validation);
  CHECK(manifest->requires_physical_output_pull_networks);
}

static void test_reset_defaults_are_unavailable_and_safe(void) {
  fake_platform_state_t state = { .failing_step = FAKE_STEP_WATCHDOG };
  scoring_stm32_target_platform_t platform = make_platform(&state);
  scoring_stm32_target_t target;

  CHECK(scoring_stm32_target_init(&target, &platform) == SCORING_STATUS_OK);
  check_unavailable_safe(&target);
  CHECK(scoring_stm32_target_reset(&target) == SCORING_STATUS_OK);
  check_unavailable_safe(&target);
  CHECK(state.step_count == 1U);
  CHECK(state.steps[0] == FAKE_STEP_SAFE_OUTPUTS);
}

static void test_startup_runs_recovery_gates_before_watchdog(void) {
  static const fake_step_t expected_steps[] = {
    FAKE_STEP_SAFE_OUTPUTS,
    FAKE_STEP_MPU,
    FAKE_STEP_CLOCKS,
    FAKE_STEP_SUPERVISOR,
    FAKE_STEP_INTEGRITY,
    FAKE_STEP_ACQUISITION,
    FAKE_STEP_VERIFY_OUTPUTS,
    FAKE_STEP_WATCHDOG
  };
  fake_platform_state_t state = { .failing_step = (fake_step_t)99 };
  scoring_stm32_target_platform_t platform = make_platform(&state);
  scoring_stm32_target_t target;

  CHECK(scoring_stm32_target_init(&target, &platform) == SCORING_STATUS_OK);
  CHECK(scoring_stm32_target_start(&target) == SCORING_STATUS_OK);
  CHECK(target.state == SCORING_STM32_TARGET_STATE_READY);
  CHECK(target.output_state == SCORING_STM32_OUTPUT_STATE_SAFE_INACTIVE);
  CHECK(target.safe_outputs_verified);
  CHECK(state.step_count == 8U);
  CHECK(memcmp(state.steps, expected_steps, sizeof(expected_steps)) == 0);
}

static void test_each_gate_failure_fails_closed_before_watchdog(void) {
  fake_step_t failed_step;

  for (failed_step = FAKE_STEP_SAFE_OUTPUTS; failed_step <= FAKE_STEP_WATCHDOG; failed_step += 1) {
    fake_platform_state_t state = { .failing_step = failed_step };
    scoring_stm32_target_platform_t platform = make_platform(&state);
    scoring_stm32_target_t target;

    CHECK(scoring_stm32_target_init(&target, &platform) == SCORING_STATUS_OK);
    CHECK(scoring_stm32_target_start(&target) == SCORING_STATUS_HARDWARE_FAULT);
    check_unavailable_safe(&target);
    CHECK(state.step_count == (size_t)failed_step + 1U);
  }
}

static void test_missing_target_callback_never_starts(void) {
  fake_platform_state_t state = { .failing_step = (fake_step_t)99 };
  scoring_stm32_target_platform_t platform = make_platform(&state);
  scoring_stm32_target_t target;

  platform.configure_clocks = NULL;
  CHECK(scoring_stm32_target_init(&target, &platform) == SCORING_STATUS_INVALID_ARGUMENT);
  check_unavailable_safe(&target);
  CHECK(scoring_stm32_target_start(&target) == SCORING_STATUS_INVALID_ARGUMENT);
  CHECK(target.state == SCORING_STM32_TARGET_STATE_FAULTED);
  CHECK(target.output_state == SCORING_STM32_OUTPUT_STATE_SAFE_INACTIVE);
  CHECK(!target.safe_outputs_verified);
  CHECK(state.step_count == 0U);
}

int main(void) {
  test_manifest_is_bounded_to_the_candidate_device();
  test_reset_defaults_are_unavailable_and_safe();
  test_startup_runs_recovery_gates_before_watchdog();
  test_each_gate_failure_fails_closed_before_watchdog();
  test_missing_target_callback_never_starts();
  return EXIT_SUCCESS;
}
