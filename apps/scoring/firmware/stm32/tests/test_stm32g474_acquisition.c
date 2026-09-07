#include "stm32g474_acquisition.h"
#include "stm32g474xx.h"
#include <assert.h>
#include <stddef.h>

GPIO_TypeDef scoring_test_gpioa;
GPIO_TypeDef scoring_test_gpiob;
GPIO_TypeDef scoring_test_gpioc;
GPIO_TypeDef scoring_test_gpiod;
RCC_TypeDef scoring_test_rcc;
COMP_TypeDef scoring_test_comp[7];

static void check_schedule(bool epee) {
  scoring_acquisition_t state;
  scoring_acquisition_frame_t frame = {0};
  size_t index;
  unsigned int cycle;
  GPIOA->MODER = 0x55000000U;
  GPIOB->MODER = 0x00000050U;
  GPIOA->PUPDR = UINT32_MAX;
  GPIOB->PUPDR = UINT32_MAX;
  assert(scoring_stm32g474_acquisition_start(&state, epee, 100U, true));
  assert(state.next_us == 305U);
  assert(GPIOA->MODER == 0x550000CFU);
  assert(GPIOB->MODER == 0x3CC00053U);
  assert(GPIOA->PUPDR == (UINT32_MAX & ~0xCFU));
  assert(GPIOB->PUPDR == (UINT32_MAX & ~0x3CC00003U));
  assert((RCC->APB2ENR & RCC_APB2ENR_SYSCFGEN) != 0U);
  for (index = 0U; index < 7U; ++index) {
    assert(scoring_test_comp[index].CSR == (COMP_CSR_EN | COMP_CSR_INMSEL_0 |
      COMP_CSR_SCALEN | COMP_CSR_BRGEN | COMP_CSR_HYST_0 |
      (index == 1U ? COMP_CSR_INPSEL : 0U)));
  }
  assert(scoring_stm32g474_acquisition_poll(&state, 304U, true, &frame) == SCORING_ACQUISITION_WAIT);
  assert(state.next_us == 305U);
  for (cycle = 0U; cycle < 2U; ++cycle) {
    for (index = 0U; index < 3U; ++index) {
      uint64_t base = 305U + cycle * 120U + index * 40U;
      uint8_t source = index == 2U ? 6U : (uint8_t)(index * 3U + (epee ? 0U : 1U));
      size_t comparator;
      assert(state.next_us == base);
      assert(scoring_stm32g474_acquisition_poll(&state, base, true, &frame) == SCORING_ACQUISITION_WAIT);
      assert(GPIOC->BSRR == (0x1F80U << 16U));
      assert(GPIOD->BSRR == (4U << 16U));
      assert(scoring_stm32g474_acquisition_poll(&state, base + 10U, true, &frame) == SCORING_ACQUISITION_WAIT);
      assert(GPIOC->BSRR == 0x1F80U && GPIOD->BSRR == 4U);
      assert(scoring_stm32g474_acquisition_poll(&state, base + 11U, true, &frame) == SCORING_ACQUISITION_WAIT);
      if (source == 6U) {
        assert(GPIOC->BSRR == 64U && GPIOD->BSRR == (4U << 16U));
      } else {
        assert(GPIOC->BSRR == (1U << (source + 23U)));
        assert(GPIOD->BSRR == 4U);
      }
      for (comparator = 0U; comparator < 7U; ++comparator) {
        if ((comparator % 3U) == index) {
          scoring_test_comp[comparator].CSR |= COMP_CSR_VALUE;
        } else {
          scoring_test_comp[comparator].CSR &= ~COMP_CSR_VALUE;
        }
      }
      assert(scoring_stm32g474_acquisition_poll(&state, base + 38U, true, &frame) == SCORING_ACQUISITION_WAIT);
      assert(scoring_stm32g474_acquisition_poll(&state, base + 39U, true, &frame) ==
             (index == 2U ? SCORING_ACQUISITION_FRAME : SCORING_ACQUISITION_WAIT));
      assert(GPIOC->BSRR == 0x1F80U && GPIOD->BSRR == 4U);
    }
    assert(frame.sources[0] == (epee ? 0U : 1U));
    assert(frame.sources[1] == (epee ? 3U : 4U));
    assert(frame.sources[2] == 6U);
    assert(frame.receivers[0] == 0x49U && frame.receivers[1] == 0x12U && frame.receivers[2] == 0x24U);
    assert(frame.sampled_us[0] == 343U + cycle * 120U);
    assert(frame.sampled_us[1] == frame.sampled_us[0] + 40U);
    assert(frame.sampled_us[2] == frame.sampled_us[0] + 80U);
  }
  scoring_stm32g474_acquisition_stop(&state);
  assert(!state.running && GPIOD->BSRR == 4U);
}

int main(void) {
  scoring_acquisition_t state = {0};
  scoring_acquisition_frame_t frame = {0};
  unsigned int index;
  check_schedule(false);
  check_schedule(true);
  assert(!scoring_stm32g474_acquisition_start(NULL, false, 0U, true));
  assert(!scoring_stm32g474_acquisition_start(&state, false, 0U, false));
  assert(!scoring_stm32g474_acquisition_start(&state, false, UINT64_MAX, true));
  for (index = 0U; index < 7U; ++index) {
    scoring_test_comp[index].CSR |= COMP_CSR_LOCK;
    assert(!scoring_stm32g474_acquisition_start(&state, false, 0U, true));
    assert(!state.running);
    scoring_test_comp[index].CSR = 0U;
  }
  assert(scoring_stm32g474_acquisition_poll(NULL, 0U, true, &frame) == SCORING_ACQUISITION_FAULT);
  assert(scoring_stm32g474_acquisition_poll(&state, 0U, true, &frame) == SCORING_ACQUISITION_FAULT);
  for (index = 0U; index < 5U; ++index) {
    unsigned int step;
    assert(scoring_stm32g474_acquisition_start(&state, false, 0U, true));
    for (step = 0U; step < index; ++step) {
      assert(scoring_stm32g474_acquisition_poll(&state, state.next_us, true, &frame) == SCORING_ACQUISITION_WAIT);
    }
    assert(scoring_stm32g474_acquisition_poll(&state, state.next_us + 1U, true, &frame) == SCORING_ACQUISITION_FAULT);
    assert(!state.running && GPIOD->BSRR == 4U);
  }
  assert(scoring_stm32g474_acquisition_start(&state, false, 100U, true));
  assert(scoring_stm32g474_acquisition_poll(&state, 99U, true, &frame) == SCORING_ACQUISITION_FAULT);
  assert(scoring_stm32g474_acquisition_start(&state, false, 100U, true));
  assert(scoring_stm32g474_acquisition_poll(&state, 100U, false, &frame) == SCORING_ACQUISITION_FAULT);
  assert(scoring_stm32g474_acquisition_start(&state, false, 100U, true));
  assert(scoring_stm32g474_acquisition_poll(&state, 100U, true, NULL) == SCORING_ACQUISITION_FAULT);
  assert(scoring_stm32g474_acquisition_start(&state, false, UINT64_MAX - 205U, true));
  assert(scoring_stm32g474_acquisition_poll(&state, UINT64_MAX, true, &frame) == SCORING_ACQUISITION_FAULT);
  assert(scoring_stm32g474_acquisition_start(&state, false, 0U, true));
  state.phase = 255U;
  assert(scoring_stm32g474_acquisition_poll(&state, 205U, true, &frame) == SCORING_ACQUISITION_FAULT);
  return 0;
}
