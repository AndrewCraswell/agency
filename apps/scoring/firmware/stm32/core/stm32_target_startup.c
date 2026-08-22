#include "stm32_target_startup.h"

#include <stddef.h>

static const scoring_stm32_target_manifest_t TARGET_MANIFEST = {
  .part_number = "STM32G474RET3TR",
  .maximum_core_clock_hz = 170000000U,
  .requires_mpu = true,
  .requires_external_hse_validation = true,
  .requires_physical_output_pull_networks = true
};

const scoring_stm32_target_manifest_t *scoring_stm32_target_manifest(void) {
  return &TARGET_MANIFEST;
}

static void target_fail_closed(scoring_stm32_target_t *target) {
  target->state = SCORING_STM32_TARGET_STATE_UNAVAILABLE;
  target->output_state = SCORING_STM32_OUTPUT_STATE_SAFE_INACTIVE;
  target->safe_outputs_verified = false;
}

static bool target_platform_is_valid(const scoring_stm32_target_platform_t *platform) {
  return platform != NULL &&
    platform->assert_safe_outputs != NULL &&
    platform->configure_mpu != NULL &&
    platform->configure_clocks != NULL &&
    platform->validate_supervisor != NULL &&
    platform->validate_integrity != NULL &&
    platform->validate_acquisition_safety != NULL &&
    platform->verify_safe_outputs != NULL &&
    platform->arm_watchdog != NULL;
}

scoring_status_t scoring_stm32_target_init(
  scoring_stm32_target_t *target,
  const scoring_stm32_target_platform_t *platform
) {
  if (target == NULL || platform == NULL) {
    return SCORING_STATUS_INVALID_ARGUMENT;
  }

  target->platform = platform;
  target_fail_closed(target);
  return target_platform_is_valid(platform) ? SCORING_STATUS_OK : SCORING_STATUS_INVALID_ARGUMENT;
}

scoring_status_t scoring_stm32_target_start(scoring_stm32_target_t *target) {
  scoring_status_t status;

  if (target == NULL || target->platform == NULL) {
    return SCORING_STATUS_INVALID_ARGUMENT;
  }

  target_fail_closed(target);

  if (!target_platform_is_valid(target->platform)) {
    target->state = SCORING_STM32_TARGET_STATE_FAULTED;
    return SCORING_STATUS_INVALID_ARGUMENT;
  }

  status = target->platform->assert_safe_outputs(target->platform->context);
  if (status != SCORING_STATUS_OK) {
    return status;
  }

  status = target->platform->configure_mpu(target->platform->context);
  if (status != SCORING_STATUS_OK) {
    return status;
  }

  status = target->platform->configure_clocks(target->platform->context);
  if (status != SCORING_STATUS_OK) {
    return status;
  }

  status = target->platform->validate_supervisor(target->platform->context);
  if (status != SCORING_STATUS_OK) {
    return status;
  }

  status = target->platform->validate_integrity(target->platform->context);
  if (status != SCORING_STATUS_OK) {
    return status;
  }

  status = target->platform->validate_acquisition_safety(target->platform->context);
  if (status != SCORING_STATUS_OK) {
    return status;
  }

  status = target->platform->verify_safe_outputs(target->platform->context);
  if (status != SCORING_STATUS_OK) {
    return status;
  }

  target->safe_outputs_verified = true;
  status = target->platform->arm_watchdog(target->platform->context);
  if (status != SCORING_STATUS_OK) {
    target_fail_closed(target);
    return status;
  }

  target->state = SCORING_STM32_TARGET_STATE_READY;
  return SCORING_STATUS_OK;
}

scoring_status_t scoring_stm32_target_reset(scoring_stm32_target_t *target) {
  scoring_status_t status;

  if (target == NULL || target->platform == NULL) {
    return SCORING_STATUS_INVALID_ARGUMENT;
  }

  target_fail_closed(target);

  if (!target_platform_is_valid(target->platform)) {
    target->state = SCORING_STM32_TARGET_STATE_FAULTED;
    return SCORING_STATUS_INVALID_ARGUMENT;
  }

  status = target->platform->assert_safe_outputs(target->platform->context);
  if (status != SCORING_STATUS_OK) {
    return status;
  }

  return SCORING_STATUS_OK;
}
