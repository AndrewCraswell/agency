#include "stm32g474_target_adapter.h"

#include <setjmp.h>
#include <stdbool.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

#include "stm32g474xx.h"

#define CHECK(expression) \
  do { \
    if (!(expression)) { \
      (void)fprintf(stderr, "check failed: %s at %s:%d\n", #expression, __FILE__, __LINE__); \
      exit(EXIT_FAILURE); \
    } \
  } while (0)

GPIO_TypeDef scoring_test_gpioa;
GPIO_TypeDef scoring_test_gpiob;
GPIO_TypeDef scoring_test_gpioc;
GPIO_TypeDef scoring_test_gpiod;
RCC_TypeDef scoring_test_rcc;
MPU_Type scoring_test_mpu;
SCB_Type scoring_test_scb;
IWDG_TypeDef scoring_test_iwdg;

static jmp_buf wfi_escape;
static bool wfi_expected;
static unsigned int wfi_count;

void scoring_test_wfi(void) {
  wfi_count += 1U;
  if (wfi_expected) {
    longjmp(wfi_escape, 1);
  }

  abort();
}

#define main scoring_stm32g474_target_main
#include "../target/stm32g474_target_main.c"
#undef main

static void reset_registers(void) {
  (void)memset(&scoring_test_gpioa, 0, sizeof(scoring_test_gpioa));
  (void)memset(&scoring_test_gpiob, 0, sizeof(scoring_test_gpiob));
  (void)memset(&scoring_test_gpioc, 0, sizeof(scoring_test_gpioc));
  (void)memset(&scoring_test_gpiod, 0, sizeof(scoring_test_gpiod));
  (void)memset(&scoring_test_rcc, 0, sizeof(scoring_test_rcc));
  (void)memset(&scoring_test_mpu, 0, sizeof(scoring_test_mpu));
  (void)memset(&scoring_test_scb, 0, sizeof(scoring_test_scb));
  (void)memset(&scoring_test_iwdg, 0, sizeof(scoring_test_iwdg));
  wfi_expected = false;
  wfi_count = 0U;
}

static uint32_t mode_mask(uint16_t pins) {
  uint32_t result = 0U;
  uint32_t pin;

  for (pin = 0U; pin < 16U; pin += 1U) {
    if ((pins & (uint16_t)(1U << pin)) != 0U) {
      result |= 3U << (pin * 2U);
    }
  }

  return result;
}

static uint32_t output_mode(uint16_t pins) {
  uint32_t result = 0U;
  uint32_t pin;

  for (pin = 0U; pin < 16U; pin += 1U) {
    if ((pins & (uint16_t)(1U << pin)) != 0U) {
      result |= 1U << (pin * 2U);
    }
  }

  return result;
}

static void prepare_ready_clock(void) {
  RCC->CR = RCC_CR_HSIRDY;
  RCC->CFGR = RCC_CFGR_SWS_HSI;
}

static void test_platform_declares_all_startup_gates(void) {
  const scoring_stm32_target_platform_t *platform = scoring_stm32g474_target_platform();

  CHECK(platform != NULL);
  CHECK(platform->context == NULL);
  CHECK(platform->assert_safe_outputs != NULL);
  CHECK(platform->configure_mpu != NULL);
  CHECK(platform->configure_clocks != NULL);
  CHECK(platform->validate_supervisor != NULL);
  CHECK(platform->validate_integrity != NULL);
  CHECK(platform->validate_acquisition_safety != NULL);
  CHECK(platform->verify_safe_outputs != NULL);
  CHECK(platform->arm_watchdog != NULL);
}

static void test_safe_output_setup_resets_every_candidate_output(void) {
  const scoring_stm32_target_platform_t *platform = scoring_stm32g474_target_platform();
  const uint16_t pins_a = 0x0104U;
  const uint16_t pins_c = 0x1FFFU;
  const uint16_t pins_d = 0x0004U;

  reset_registers();
  GPIOA->MODER = UINT32_MAX;
  GPIOB->OTYPER = UINT32_MAX;
  GPIOC->OSPEEDR = UINT32_MAX;
  GPIOC->PUPDR = UINT32_MAX;
  GPIOA->ODR = pins_a;
  GPIOB->MODER = UINT32_MAX;
  GPIOB->ODR = UINT32_MAX;
  GPIOC->ODR = pins_c;

  CHECK(platform->assert_safe_outputs(NULL) == SCORING_STATUS_OK);
  CHECK((RCC->AHB2ENR & (RCC_AHB2ENR_GPIOAEN | RCC_AHB2ENR_GPIOBEN | RCC_AHB2ENR_GPIOCEN)) ==
    (RCC_AHB2ENR_GPIOAEN | RCC_AHB2ENR_GPIOBEN | RCC_AHB2ENR_GPIOCEN));
  CHECK((GPIOA->MODER & mode_mask(pins_a)) == output_mode(pins_a));
  CHECK(GPIOB->MODER == UINT32_MAX);
  CHECK(GPIOB->ODR == UINT32_MAX);
  CHECK(GPIOB->BSRR == 0U);
  CHECK((GPIOA->MODER & ~mode_mask(pins_a)) == (UINT32_MAX & ~mode_mask(pins_a)));
  CHECK((GPIOD->MODER & mode_mask(pins_d)) == output_mode(pins_d));
  CHECK((GPIOC->MODER & mode_mask(pins_c)) == output_mode(pins_c));
  CHECK((GPIOA->OTYPER & pins_a) == 0U);
  CHECK(GPIOB->OTYPER == UINT32_MAX);
  CHECK((GPIOC->OTYPER & pins_c) == 0U);
  CHECK(GPIOA->BSRR == ((uint32_t)pins_a << 16U));
  CHECK(GPIOC->BSRR == 0x007F1F80U);
  CHECK(GPIOD->BSRR == 4U);
  CHECK((RCC->AHB2ENR & RCC_AHB2ENR_GPIODEN) != 0U);
}

static void test_clock_mpu_and_watchdog_fail_closed_on_unready_hardware(void) {
  const scoring_stm32_target_platform_t *platform = scoring_stm32g474_target_platform();

  reset_registers();
  CHECK(platform->configure_clocks(NULL) == SCORING_STATUS_HARDWARE_FAULT);

  reset_registers();
  RCC->CR = RCC_CR_HSIRDY;
  CHECK(platform->configure_clocks(NULL) == SCORING_STATUS_HARDWARE_FAULT);

  reset_registers();
  prepare_ready_clock();
  CHECK(platform->configure_clocks(NULL) == SCORING_STATUS_OK);
  CHECK((RCC->CR & RCC_CR_HSION) != 0U);
  CHECK((RCC->CFGR & RCC_CFGR_SW) == RCC_CFGR_SW_HSI);

  reset_registers();
  CHECK(platform->configure_mpu(NULL) == SCORING_STATUS_OK);
  CHECK(MPU->RNR == 1U);
  CHECK(MPU->RBAR == CCMSRAM_BASE);
  CHECK((MPU->RASR & (MPU_RASR_XN_Msk | MPU_RASR_ENABLE_Msk)) ==
    (MPU_RASR_XN_Msk | MPU_RASR_ENABLE_Msk));
  CHECK(MPU->CTRL == (MPU_CTRL_PRIVDEFENA_Msk | MPU_CTRL_ENABLE_Msk));

  reset_registers();
  IWDG->SR = IWDG_SR_PVU;
  CHECK(platform->arm_watchdog(NULL) == SCORING_STATUS_HARDWARE_FAULT);

  reset_registers();
  CHECK(platform->arm_watchdog(NULL) == SCORING_STATUS_OK);
  CHECK(IWDG->PR == 0U);
  CHECK(IWDG->RLR == 0x0FFFU);
  CHECK(IWDG->KR == 0xCCCCU);
}

static void test_unproven_safety_gates_never_claim_ready(void) {
  const scoring_stm32_target_platform_t *platform = scoring_stm32g474_target_platform();

  reset_registers();
  RCC->CSR = 0x55AAU;
  CHECK(platform->validate_supervisor(NULL) == SCORING_STATUS_UNAVAILABLE);
  CHECK((RCC->CSR & RCC_CSR_RMVF) != 0U);

  SCB->VTOR = FLASH_BASE + 4U;
  CHECK(platform->validate_integrity(NULL) == SCORING_STATUS_INTEGRITY_FAILURE);
  SCB->VTOR = FLASH_BASE;
  CHECK(platform->validate_integrity(NULL) == SCORING_STATUS_UNAVAILABLE);
  CHECK(platform->validate_acquisition_safety(NULL) == SCORING_STATUS_UNAVAILABLE);

  CHECK(platform->assert_safe_outputs(NULL) == SCORING_STATUS_OK);
  /* Register fixture does not implement BSRR side effects. */
  GPIOC->ODR = 0x1F80U;
  GPIOD->ODR = 4U;
  CHECK(platform->verify_safe_outputs(NULL) == SCORING_STATUS_OK);
  GPIOD->ODR = 0U;
  CHECK(platform->verify_safe_outputs(NULL) == SCORING_STATUS_HARDWARE_FAULT);
  GPIOD->ODR = 4U;
  GPIOC->MODER = 3U;
  CHECK(platform->verify_safe_outputs(NULL) == SCORING_STATUS_HARDWARE_FAULT);
}

static void test_target_entry_point_waits_after_fail_closed_startup(void) {
  reset_registers();
  prepare_ready_clock();
  SCB->VTOR = FLASH_BASE;
  wfi_expected = true;

  if (setjmp(wfi_escape) == 0) {
    (void)scoring_stm32g474_target_main();
    CHECK(false);
  }

  CHECK(wfi_count == 1U);
  CHECK((RCC->AHB2ENR & (RCC_AHB2ENR_GPIOAEN | RCC_AHB2ENR_GPIOBEN | RCC_AHB2ENR_GPIOCEN)) != 0U);
  CHECK(IWDG->KR == 0U);
}

static void test_c_runtime_hook_is_a_safe_noop(void) {
  __libc_init_array();
}

int main(void) {
  test_platform_declares_all_startup_gates();
  test_safe_output_setup_resets_every_candidate_output();
  test_clock_mpu_and_watchdog_fail_closed_on_unready_hardware();
  test_unproven_safety_gates_never_claim_ready();
  test_target_entry_point_waits_after_fail_closed_startup();
  test_c_runtime_hook_is_a_safe_noop();
  return EXIT_SUCCESS;
}
