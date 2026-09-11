#ifndef STM32C011_POWER_H
#define STM32C011_POWER_H
#include <stdint.h>
#include <stdbool.h>
#include "power_control.h"
/* Native tests replace only register access, not the transport or control logic. */
#ifdef POWER_REGISTER_TEST
uint32_t power_register_read(uintptr_t address);
void power_register_write(uintptr_t address, uint32_t value);
void power_interrupt_lock(void);
void power_interrupt_unlock(void);
void power_wait_for_interrupt(void);
#else
static inline uint32_t power_register_read(uintptr_t address) { return *(volatile uint32_t *)address; }
static inline void power_register_write(uintptr_t address, uint32_t value) { *(volatile uint32_t *)address = value; }
static inline void power_interrupt_lock(void) { __asm__ volatile("cpsid i" ::: "memory"); }
static inline void power_interrupt_unlock(void) { __asm__ volatile("cpsie i" ::: "memory"); }
static inline void power_wait_for_interrupt(void) { __asm__ volatile("dsb\n wfi\n isb" ::: "memory"); }
#endif
void power_target_initialize(power_board board);
/* Hint to enter power_target_sleep, which rechecks pending events atomically. */
bool power_target_poll(void);
void power_target_sleep(void);
void power_target_irq(void);
void power_target_fault(void);
#endif
