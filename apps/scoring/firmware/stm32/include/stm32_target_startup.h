#ifndef STM32_TARGET_STARTUP_H
#define STM32_TARGET_STARTUP_H

#include <stdbool.h>
#include <stdint.h>

#include "stm32_scoring_host.h"

#ifdef __cplusplus
extern "C" {
#endif

/**
 * M3-06 boundary for the STM32G474RET3TR startup adapter. This file does not
 * contain STM32CubeG4 headers, register values, or a pin configuration. The
 * M0-08 allocation is still candidate-only, so a target adapter must prove
 * its exact CubeG4 package, clock tree, and output-driver configuration
 * before this sequence can be compiled for the MCU.
 */
typedef enum scoring_stm32_target_state {
  SCORING_STM32_TARGET_STATE_UNAVAILABLE = 0,
  SCORING_STM32_TARGET_STATE_READY,
  SCORING_STM32_TARGET_STATE_FAULTED
} scoring_stm32_target_state_t;

typedef enum scoring_stm32_output_state {
  SCORING_STM32_OUTPUT_STATE_SAFE_INACTIVE = 0
} scoring_stm32_output_state_t;

typedef struct scoring_stm32_target_manifest {
  const char *part_number;
  uint32_t maximum_core_clock_hz;
  bool requires_mpu;
  bool requires_external_hse_validation;
  bool requires_physical_output_pull_networks;
} scoring_stm32_target_manifest_t;

typedef struct scoring_stm32_target_platform {
  void *context;
  scoring_status_t (*assert_safe_outputs)(void *context);
  scoring_status_t (*configure_mpu)(void *context);
  scoring_status_t (*configure_clocks)(void *context);
  scoring_status_t (*validate_supervisor)(void *context);
  scoring_status_t (*validate_integrity)(void *context);
  scoring_status_t (*validate_acquisition_safety)(void *context);
  scoring_status_t (*verify_safe_outputs)(void *context);
  scoring_status_t (*arm_watchdog)(void *context);
} scoring_stm32_target_platform_t;

typedef struct scoring_stm32_target {
  const scoring_stm32_target_platform_t *platform;
  scoring_stm32_target_state_t state;
  scoring_stm32_output_state_t output_state;
  bool safe_outputs_verified;
} scoring_stm32_target_t;

/** Candidate device facts only. It is not a CubeMX or target-build claim. */
const scoring_stm32_target_manifest_t *scoring_stm32_target_manifest(void);

/** Binds a target adapter and establishes an unavailable, safe-inactive model. */
scoring_status_t scoring_stm32_target_init(
  scoring_stm32_target_t *target,
  const scoring_stm32_target_platform_t *platform
);

/**
 * Runs the M0-10 recovery gates in their required order. No failure may leave
 * the target ready, arm the watchdog, or expose an active scoring output.
 */
scoring_status_t scoring_stm32_target_start(scoring_stm32_target_t *target);

/**
 * Models an STM32 reset boundary. The hardware adapter must make outputs safe
 * before normal startup resumes; reset never represents a hit or bout reset.
 */
scoring_status_t scoring_stm32_target_reset(scoring_stm32_target_t *target);

#ifdef __cplusplus
}
#endif

#endif
