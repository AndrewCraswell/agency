#include "stm32g474_target_adapter.h"

#include "stm32g474xx.h"

void __libc_init_array(void) {
}

int main(void) {
  scoring_stm32_target_t target;
  const scoring_stm32_target_platform_t *platform = scoring_stm32g474_target_platform();

  (void)scoring_stm32_target_init(&target, platform);
  (void)scoring_stm32_target_start(&target);

  for (;;) {
    __WFI();
  }
}
