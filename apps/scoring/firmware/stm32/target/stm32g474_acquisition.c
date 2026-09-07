#include "stm32g474_acquisition.h"
#include "stm32g474xx.h"
#include <stddef.h>

static COMP_TypeDef *const comparators[] = {
  COMP1, COMP2, COMP3, COMP4, COMP5, COMP6, COMP7
};

static void high_impedance(void) {
  GPIOC->BSRR = 0x1F80U;
  GPIOD->BSRR = 0x0004U;
}

void scoring_stm32g474_acquisition_stop(scoring_acquisition_t *state) {
  high_impedance();
  GPIOC->BSRR = 0x007FU << 16U;
  if (state != NULL) {
    *state = (scoring_acquisition_t){0};
  }
}

bool scoring_stm32g474_acquisition_start(scoring_acquisition_t *state,
                                       bool epee, uint64_t now_us,
                                       bool supply_valid) {
  size_t index;
  /* Safe output modes are established by the target startup adapter. */
  scoring_stm32g474_acquisition_stop(state);
  if (state == NULL || !supply_valid || now_us > UINT64_MAX - 205U) {
    return false;
  }
  RCC->APB2ENR |= RCC_APB2ENR_SYSCFGEN;
  (void)RCC->APB2ENR;
  for (index = 0U; index < 7U; ++index) {
    if ((comparators[index]->CSR & COMP_CSR_LOCK) != 0U) {
      return false;
    }
  }
  /* PA0/1/3 and PB0/11/13/14 are the seven native-board analog inputs. */
  GPIOA->MODER |= 0x000000CFU;
  GPIOA->PUPDR &= ~0x000000CFU;
  GPIOB->MODER |= 0x3CC00003U;
  GPIOB->PUPDR &= ~0x3CC00003U;
  for (index = 0U; index < 7U; ++index) {
    comparators[index]->CSR = 0U;
    comparators[index]->CSR = COMP_CSR_EN | COMP_CSR_INMSEL_0 |
      COMP_CSR_SCALEN | COMP_CSR_BRGEN | COMP_CSR_HYST_0 |
      (index == 1U ? COMP_CSR_INPSEL : 0U);
  }
  state->frame.sources[0] = epee ? 0U : 1U;
  state->frame.sources[1] = epee ? 3U : 4U;
  state->frame.sources[2] = 6U;
  state->next_us = now_us + 205U;
  state->last_us = now_us;
  state->running = true;
  return true;
}

scoring_acquisition_result_t scoring_stm32g474_acquisition_poll(
  scoring_acquisition_t *state, uint64_t now_us, bool supply_valid,
  scoring_acquisition_frame_t *frame) {
  uint64_t delay;
  bool complete = false;
  if (state == NULL || frame == NULL || !supply_valid || !state->running ||
      now_us < state->last_us || now_us > state->next_us) {
    scoring_stm32g474_acquisition_stop(state);
    return SCORING_ACQUISITION_FAULT;
  }
  state->last_us = now_us;
  if (now_us < state->next_us) {
    return SCORING_ACQUISITION_WAIT;
  }
  switch (state->phase) {
    case 0U: /* 0us: all seven outputs low for active cable discharge. */
      GPIOC->BSRR = 0x007FU << 16U;
      GPIOC->BSRR = 0x1F80U << 16U;
      GPIOD->BSRR = 0x0004U << 16U;
      delay = 10U;
      break;
    case 1U: /* 10us: break before driving a different conductor. */
      high_impedance();
      delay = 1U;
      break;
    case 2U: { /* 11us: exactly one high source, other outputs high-Z. */
      uint8_t source = state->frame.sources[state->slot];
      GPIOC->BSRR = 1U << source;
      if (source == 6U) {
        GPIOD->BSRR = 0x0004U << 16U;
      } else {
        GPIOC->BSRR = 1U << (source + 7U + 16U);
      }
      delay = 27U;
      break;
    }
    case 3U: { /* 38us: capture comparator levels, not host wall time. */
      uint8_t values = 0U;
      size_t index;
      for (index = 0U; index < 7U; ++index) {
        if ((comparators[index]->CSR & COMP_CSR_VALUE) != 0U) {
          values |= (uint8_t)(1U << index);
        }
      }
      state->frame.receivers[state->slot] = values;
      state->frame.sampled_us[state->slot] = now_us;
      delay = 1U;
      break;
    }
    case 4U: /* 39us: release before handing the frame to its consumer. */
      high_impedance();
      if (state->slot == 2U) {
        *frame = state->frame;
        complete = true;
      }
      delay = 1U;
      break;
    default:
      scoring_stm32g474_acquisition_stop(state);
      return SCORING_ACQUISITION_FAULT;
  }
  if (now_us > UINT64_MAX - delay) {
    scoring_stm32g474_acquisition_stop(state);
    return SCORING_ACQUISITION_FAULT;
  }
  state->next_us = now_us + delay;
  state->phase += 1U;
  if (state->phase == 5U) {
    state->phase = 0U;
    state->slot = (uint8_t)((state->slot + 1U) % 3U);
  }
  return complete ? SCORING_ACQUISITION_FRAME : SCORING_ACQUISITION_WAIT;
}
