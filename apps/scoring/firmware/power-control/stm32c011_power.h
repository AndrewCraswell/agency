#ifndef STM32C011_POWER_H
#define STM32C011_POWER_H
#include <stdint.h>
/* Native tests replace only register access, not the transport or control logic. */
#ifdef POWER_REGISTER_TEST
uint32_t power_register_read(uintptr_t address);
void power_register_write(uintptr_t address, uint32_t value);
#else
static inline uint32_t power_register_read(uintptr_t address) { return *(volatile uint32_t *)address; }
static inline void power_register_write(uintptr_t address, uint32_t value) { *(volatile uint32_t *)address = value; }
#endif
void power_target_initialize(void);
void power_target_poll(void);
void power_target_fault(void);
#endif
