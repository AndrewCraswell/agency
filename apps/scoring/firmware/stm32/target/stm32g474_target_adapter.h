#ifndef STM32G474_TARGET_ADAPTER_H
#define STM32G474_TARGET_ADAPTER_H

#include "stm32_target_startup.h"

#ifdef __cplusplus
extern "C" {
#endif

/**
 * Candidate-only STM32G474RE adapter. It cannot report scoring ready until a
 * later M0-08/M3-07 implementation proves the acquisition and physical
 * supervisor gates on the reviewed board.
 */
const scoring_stm32_target_platform_t *scoring_stm32g474_target_platform(void);

#ifdef __cplusplus
}
#endif

#endif
