#ifndef SCORING_TEST_STM32G474XX_H
#define SCORING_TEST_STM32G474XX_H

#include <stdint.h>

typedef struct {
  volatile uint32_t MODER;
  volatile uint32_t OTYPER;
  volatile uint32_t OSPEEDR;
  volatile uint32_t PUPDR;
  volatile uint32_t IDR;
  volatile uint32_t ODR;
  volatile uint32_t BSRR;
} GPIO_TypeDef;

typedef struct {
  volatile uint32_t CR;
  volatile uint32_t CFGR;
  volatile uint32_t AHB2ENR;
  volatile uint32_t CSR;
  volatile uint32_t APB2ENR;
} RCC_TypeDef;

typedef struct { volatile uint32_t CSR; } COMP_TypeDef;
extern COMP_TypeDef scoring_test_comp[7];
#define COMP1 (&scoring_test_comp[0])
#define COMP2 (&scoring_test_comp[1])
#define COMP3 (&scoring_test_comp[2])
#define COMP4 (&scoring_test_comp[3])
#define COMP5 (&scoring_test_comp[4])
#define COMP6 (&scoring_test_comp[5])
#define COMP7 (&scoring_test_comp[6])
#define COMP_CSR_EN (1U << 0U)
#define COMP_CSR_INMSEL_0 (1U << 4U)
#define COMP_CSR_INPSEL (1U << 8U)
#define COMP_CSR_HYST_0 (1U << 16U)
#define COMP_CSR_BRGEN (1U << 22U)
#define COMP_CSR_SCALEN (1U << 23U)
#define COMP_CSR_VALUE (1U << 30U)
#define COMP_CSR_LOCK (1U << 31U)
#define RCC_APB2ENR_SYSCFGEN (1U << 0U)

typedef struct {
  volatile uint32_t CTRL;
  volatile uint32_t RNR;
  volatile uint32_t RBAR;
  volatile uint32_t RASR;
} MPU_Type;

typedef struct {
  volatile uint32_t VTOR;
} SCB_Type;

typedef struct {
  volatile uint32_t KR;
  volatile uint32_t PR;
  volatile uint32_t RLR;
  volatile uint32_t SR;
} IWDG_TypeDef;

extern GPIO_TypeDef scoring_test_gpioa;
extern GPIO_TypeDef scoring_test_gpiob;
extern GPIO_TypeDef scoring_test_gpioc;
extern GPIO_TypeDef scoring_test_gpiod;
extern RCC_TypeDef scoring_test_rcc;
extern MPU_Type scoring_test_mpu;
extern SCB_Type scoring_test_scb;
extern IWDG_TypeDef scoring_test_iwdg;

#define GPIOA (&scoring_test_gpioa)
#define GPIOB (&scoring_test_gpiob)
#define GPIOC (&scoring_test_gpioc)
#define GPIOD (&scoring_test_gpiod)
#define RCC (&scoring_test_rcc)
#define MPU (&scoring_test_mpu)
#define SCB (&scoring_test_scb)
#define IWDG (&scoring_test_iwdg)

#define RCC_AHB2ENR_GPIOAEN (1U << 0U)
#define RCC_AHB2ENR_GPIOBEN (1U << 1U)
#define RCC_AHB2ENR_GPIOCEN (1U << 2U)
#define RCC_AHB2ENR_GPIODEN (1U << 3U)
#define RCC_CR_HSION (1U << 8U)
#define RCC_CR_HSIRDY (1U << 10U)
#define RCC_CFGR_SW (3U << 0U)
#define RCC_CFGR_SW_HSI (1U << 0U)
#define RCC_CFGR_SWS (3U << 2U)
#define RCC_CFGR_SWS_HSI (1U << 2U)
#define RCC_CSR_RMVF (1U << 23U)
#define MPU_RASR_XN_Msk (1U << 28U)
#define MPU_RASR_AP_Pos 24U
#define MPU_RASR_C_Msk (1U << 17U)
#define MPU_RASR_S_Msk (1U << 18U)
#define MPU_RASR_SIZE_Pos 1U
#define MPU_RASR_ENABLE_Msk (1U << 0U)
#define MPU_CTRL_PRIVDEFENA_Msk (1U << 2U)
#define MPU_CTRL_ENABLE_Msk (1U << 0U)
#define IWDG_SR_PVU (1U << 0U)
#define IWDG_SR_RVU (1U << 1U)
#define SRAM1_BASE 0x20000000U
#define CCMSRAM_BASE 0x10000000U
#define FLASH_BASE 0x08000000U

#define __DMB() ((void)0)
#define __DSB() ((void)0)
#define __ISB() ((void)0)

void scoring_test_wfi(void);
#define __WFI() scoring_test_wfi()

#endif
