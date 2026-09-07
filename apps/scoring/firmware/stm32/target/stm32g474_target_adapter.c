#include "stm32g474_target_adapter.h"

#include <stdbool.h>
#include <stddef.h>
#include <stdint.h>

#include "stm32g474xx.h"

enum {
  SCORING_STM32_MPU_SRAM_REGION_SIZE = 16U,
  SCORING_STM32_MPU_CCMSRAM_REGION_SIZE = 14U,
  SCORING_STM32_IWDG_UPDATE_LIMIT = 100000U
};

typedef struct scoring_stm32_output_group {
  GPIO_TypeDef *port;
  uint16_t pins;
  uint16_t high_pins;
} scoring_stm32_output_group_t;

typedef struct scoring_stm32_target_observations {
  uint32_t reset_flags;
} scoring_stm32_target_observations_t;

static scoring_stm32_target_observations_t target_observations;

/* Native USB scoring board: PC0-6 drive low, PC7-12/PD2 OE_N high.
 * PA2 Favero and PA8 sounder are inactive low. Leave USB, UART, SWD and
 * every comparator input untouched. Preload levels before enabling outputs.
 */
static const scoring_stm32_output_group_t SAFE_OUTPUTS[] = {
  { .port = GPIOC, .pins = 0x1FFFU, .high_pins = 0x1F80U },
  { .port = GPIOD, .pins = 0x0004U, .high_pins = 0x0004U },
  { .port = GPIOA, .pins = 0x0104U, .high_pins = 0U }
};

_Static_assert(SCORING_STM32_OUTPUT_STATE_SAFE_INACTIVE == 0, "reset output state must be inactive");
_Static_assert((0x0104U & 0x7E0BU) == 0U, "USB/UART/SWD/analog PA pins must not be outputs");

static uint32_t gpio_mode_mask(uint16_t pins) {
  uint32_t mode_mask = 0U;
  uint32_t pin;

  for (pin = 0U; pin < 16U; pin += 1U) {
    if ((pins & (uint16_t)(1U << pin)) != 0U) {
      mode_mask |= 3U << (pin * 2U);
    }
  }

  return mode_mask;
}

static uint32_t gpio_output_mode(uint16_t pins) {
  uint32_t output_mode = 0U;
  uint32_t pin;

  for (pin = 0U; pin < 16U; pin += 1U) {
    if ((pins & (uint16_t)(1U << pin)) != 0U) {
      output_mode |= 1U << (pin * 2U);
    }
  }

  return output_mode;
}

static scoring_status_t assert_safe_outputs(void *context) {
  size_t index;
  (void)context;

  RCC->AHB2ENR |= RCC_AHB2ENR_GPIOAEN | RCC_AHB2ENR_GPIOBEN | RCC_AHB2ENR_GPIOCEN | RCC_AHB2ENR_GPIODEN;
  (void)RCC->AHB2ENR;

  for (index = 0U; index < (sizeof(SAFE_OUTPUTS) / sizeof(SAFE_OUTPUTS[0])); index += 1U) {
    const scoring_stm32_output_group_t *group = &SAFE_OUTPUTS[index];
    uint32_t mode_mask = gpio_mode_mask(group->pins);
    uint32_t output_mode = gpio_output_mode(group->pins);
    uint32_t levels = group->high_pins | ((uint32_t)(group->pins & ~group->high_pins) << 16U);

    group->port->BSRR = levels;
    group->port->MODER &= ~mode_mask;
    group->port->OTYPER &= ~(uint32_t)group->pins;
    group->port->OSPEEDR &= ~mode_mask;
    group->port->PUPDR &= ~mode_mask;
    group->port->MODER |= output_mode;
    group->port->BSRR = levels;
  }

  return SCORING_STATUS_OK;
}

static scoring_status_t configure_mpu(void *context) {
  (void)context;

  MPU->CTRL = 0U;
  __DMB();
  MPU->RNR = 0U;
  MPU->RBAR = SRAM1_BASE;
  MPU->RASR = MPU_RASR_XN_Msk |
    (3U << MPU_RASR_AP_Pos) |
    MPU_RASR_C_Msk |
    MPU_RASR_S_Msk |
    (SCORING_STM32_MPU_SRAM_REGION_SIZE << MPU_RASR_SIZE_Pos) |
    MPU_RASR_ENABLE_Msk;
  MPU->RNR = 1U;
  MPU->RBAR = CCMSRAM_BASE;
  MPU->RASR = MPU_RASR_XN_Msk |
    (3U << MPU_RASR_AP_Pos) |
    MPU_RASR_C_Msk |
    MPU_RASR_S_Msk |
    (SCORING_STM32_MPU_CCMSRAM_REGION_SIZE << MPU_RASR_SIZE_Pos) |
    MPU_RASR_ENABLE_Msk;
  __DSB();
  __ISB();
  MPU->CTRL = MPU_CTRL_PRIVDEFENA_Msk | MPU_CTRL_ENABLE_Msk;
  __DSB();
  __ISB();
  return SCORING_STATUS_OK;
}

static scoring_status_t configure_clocks(void *context) {
  uint32_t attempts = 0U;
  (void)context;

  RCC->CR |= RCC_CR_HSION;
  while ((RCC->CR & RCC_CR_HSIRDY) == 0U) {
    attempts += 1U;
    if (attempts == SCORING_STM32_IWDG_UPDATE_LIMIT) {
      return SCORING_STATUS_HARDWARE_FAULT;
    }
  }

  RCC->CFGR = (RCC->CFGR & ~RCC_CFGR_SW) | RCC_CFGR_SW_HSI;
  attempts = 0U;
  while ((RCC->CFGR & RCC_CFGR_SWS) != RCC_CFGR_SWS_HSI) {
    attempts += 1U;
    if (attempts == SCORING_STM32_IWDG_UPDATE_LIMIT) {
      return SCORING_STATUS_HARDWARE_FAULT;
    }
  }

  return SCORING_STATUS_OK;
}

static scoring_status_t validate_supervisor(void *context) {
  (void)context;

  target_observations.reset_flags = RCC->CSR;
  RCC->CSR |= RCC_CSR_RMVF;

  /* The native board does not provide a readable supervisor-good input here. */
  return SCORING_STATUS_UNAVAILABLE;
}

static scoring_status_t validate_integrity(void *context) {
  (void)context;

  if (SCB->VTOR != FLASH_BASE) {
    return SCORING_STATUS_INTEGRITY_FAILURE;
  }

  /* Vector placement is not firmware authentication or image-integrity evidence. */
  return SCORING_STATUS_UNAVAILABLE;
}

static scoring_status_t validate_acquisition_safety(void *context) {
  (void)context;

  /* Bench threshold, rail and interrupt-latency qualification is outstanding. */
  return SCORING_STATUS_UNAVAILABLE;
}

static scoring_status_t verify_safe_outputs(void *context) {
  size_t index;
  (void)context;

  for (index = 0U; index < (sizeof(SAFE_OUTPUTS) / sizeof(SAFE_OUTPUTS[0])); index += 1U) {
    const scoring_stm32_output_group_t *group = &SAFE_OUTPUTS[index];
    uint32_t mode_mask = gpio_mode_mask(group->pins);
    uint32_t output_mode = gpio_output_mode(group->pins);

    if ((group->port->ODR & group->pins) != group->high_pins || (group->port->MODER & mode_mask) != output_mode) {
      return SCORING_STATUS_HARDWARE_FAULT;
    }
  }

  return SCORING_STATUS_OK;
}

static scoring_status_t arm_watchdog(void *context) {
  uint32_t attempts = 0U;
  (void)context;

  IWDG->KR = 0x5555U;
  IWDG->PR = 0U;
  IWDG->RLR = 0x0FFFU;
  while ((IWDG->SR & (IWDG_SR_PVU | IWDG_SR_RVU)) != 0U) {
    attempts += 1U;
    if (attempts == SCORING_STM32_IWDG_UPDATE_LIMIT) {
      return SCORING_STATUS_HARDWARE_FAULT;
    }
  }

  IWDG->KR = 0xAAAAU;
  IWDG->KR = 0xCCCCU;
  return SCORING_STATUS_OK;
}

static const scoring_stm32_target_platform_t TARGET_PLATFORM = {
  .context = NULL,
  .assert_safe_outputs = assert_safe_outputs,
  .configure_mpu = configure_mpu,
  .configure_clocks = configure_clocks,
  .validate_supervisor = validate_supervisor,
  .validate_integrity = validate_integrity,
  .validate_acquisition_safety = validate_acquisition_safety,
  .verify_safe_outputs = verify_safe_outputs,
  .arm_watchdog = arm_watchdog
};

const scoring_stm32_target_platform_t *scoring_stm32g474_target_platform(void) {
  return &TARGET_PLATFORM;
}
