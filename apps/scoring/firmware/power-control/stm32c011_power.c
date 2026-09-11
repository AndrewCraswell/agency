#include "stm32c011_power.h"
#include "power_control.h"

/* STM32C011 RM0490: GPIO, RCC, I2C1, IWDG; Cortex-M0+ SysTick. No HAL or heap. */
#define RCC UINT32_C(0x40021000)
#define GPIOA UINT32_C(0x50000000)
#define GPIOB UINT32_C(0x50000400)
#define I2C UINT32_C(0x40005400)
#define IWDG UINT32_C(0x40003000)
#define SYSTICK UINT32_C(0xe000e010)
#define RTC UINT32_C(0x40002800)
#define PWR UINT32_C(0x40007000)
#define EXTI UINT32_C(0x40021800)
#define SCR UINT32_C(0xe000ed10)
#define NVIC_ISER UINT32_C(0xe000e100)
#define INPUT_EDGES ((1u << 1) | (1u << 6) | (1u << 7))
static power_control control;
static unsigned health_ticks;
static power_board target_board;
static bool clock_ready;
static volatile bool wake_pending;
_Static_assert(POWER_BOARD_COMBINED == 0 && POWER_BOARD_VIRTUAL == 1, "startup.S board selector");
static void wr(uintptr_t reg, uint32_t value) { power_register_write(reg, value); }
static uint32_t rd(uintptr_t reg) { return power_register_read(reg); }
static void replace(uintptr_t reg, uint32_t mask, uint32_t value) { wr(reg, (rd(reg) & ~mask) | value); }
static bool wait_register(uintptr_t reg, uint32_t mask, uint32_t expected) {
    for (unsigned n = 0; n < 4000u; ++n) if ((rd(reg) & mask) == expected) return true;
    return false;
}
static bool initialize_stop_clock(void) {
    /* RM0490 / STM32C011: RTC uses CSR1/CSR2 (no backup-domain DBP bit).
       Reset this private health timer on every MCU reset; it is not a wall clock. */
    replace(RCC + 0x3cu, 0, (1u << 28) | (1u << 10));
    replace(RCC + 0x60u, 0, 1u);
    if (!wait_register(RCC + 0x60u, 2u, 2u)) return false;
    wr(RCC + 0x5cu, 1u << 16);
    wr(RCC + 0x5cu, (2u << 8) | (1u << 15));
    wr(RTC + 0x24u, 0xcau);wr(RTC + 0x24u, 0x53u);
    wr(RTC + 0x0cu, 0x80u);
    if (!wait_register(RTC + 0x0cu, 0x40u, 0x40u)) return false;
    wr(RTC + 0x18u, 0);
    /* Nominal 32kHz / 32 / 1024; compare only SSR[4:0] for a 32-tick alarm.
       Nominal 32ms wake interval, independent of HSI/Stop; not scoring timing. */
    wr(RTC + 0x10u, 1023u);
    wr(RTC + 0x10u, (31u << 16) | 1023u);
    wr(RTC, 0);wr(RTC + 4u, 0x012101u); /* Arbitrary Monday, 1 January 2001. */
    wr(RTC + 0x40u, 0x80808080u); /* Mask calendar fields. */
    wr(RTC + 0x44u, 5u << 24); /* Compare low five subseconds bits with zero. */
    wr(RTC + 0x5cu, 1u);
    wr(RTC + 0x18u, (1u << 12) | (1u << 8));
    wr(RTC + 0x0cu, 0);wr(RTC + 0x24u, 0xffu);
    /* GPIO edges and RTC alarm wake Stop directly. Keep reset SWD assignment. */
    replace(EXTI + 0x60u, 0xff00u, 0);
    replace(EXTI + 0x64u, 0xffff0000u, 0);
    wr(EXTI, INPUT_EDGES);wr(EXTI + 4u, INPUT_EDGES);
    wr(EXTI + 0x0cu, INPUT_EDGES);wr(EXTI + 0x10u, INPUT_EDGES);
    wr(EXTI + 0x80u, INPUT_EDGES | (1u << 19));
    wr(NVIC_ISER, (1u << 2) | (1u << 5) | (1u << 7));
    replace(PWR, 7u, 8u); /* Stop0; flash powered down in Stop. */
    return true;
}
static bool wait_flag(uint32_t flag) {
    /* Bounded independently of SysTick or interrupts; any NACK/bus error aborts. */
    for (uint32_t n = 0; n < 4000u; ++n) {
        uint32_t status = rd(I2C + 0x18u);
        if ((status & 0x710u) != 0) return false; /* NACK, BERR, ARLO, OVR. */
        if ((status & flag) != 0) return true;
    }
    return false;
}
static bool stop_error(void) {
    wr(I2C + 4u, UINT32_C(1) << 14); /* STOP, then peripheral reset. */
    wr(I2C, 0);wr(I2C + 0x1cu, 0x3f38u);wr(I2C, 1);
    return false;
}
static bool transaction(void *context, uint8_t reg, uint8_t *receive, const uint8_t *send, size_t count) {
    (void)context;
    if (count == 0 || count > 31 || (rd(I2C + 0x18u) & 0x8000u) != 0) return false;
    const bool reading = receive != NULL;
    const uint32_t nbytes = reading ? 1u : (uint32_t)count + 1u;
    wr(I2C + 0x1cu, 0x3f38u);
    /* ADDR0/ADDR1 are grounded: 7-bit address 0x28, shifted left once. */
    wr(I2C + 4u, 0x50u | (nbytes << 16) | (1u << 13) | (reading ? 0u : (1u << 25)));
    if (!wait_flag(2)) return stop_error();
    wr(I2C + 0x28u, reg);
    if (reading) {
        if (!wait_flag(0x40)) return stop_error();
        wr(I2C + 4u, 0x50u | ((uint32_t)count << 16) | (1u << 13) | (1u << 10) | (1u << 25));
    }
    for (size_t i = 0; i < count; ++i) {
        if (!wait_flag(reading ? 4u : 2u)) return stop_error();
        if (reading) receive[i] = (uint8_t)rd(I2C + 0x24u);
        else wr(I2C + 0x28u, send[i]);
    }
    if (!wait_flag(0x20)) return stop_error();
    wr(I2C + 0x1cu, 0x20);
    return true;
}
static bool read_pd(void *context, uint8_t reg, uint8_t *p, size_t n) { return transaction(context, reg, p, NULL, n); }
static bool write_pd(void *context, uint8_t reg, const uint8_t *p, size_t n) { return transaction(context, reg, NULL, p, n); }
static void outputs(void *context, bool acquisition, bool application, bool suspend) {
    (void)context;
    if (target_board == POWER_BOARD_VIRTUAL) {
        /* BSRR changes qualification and exemption together, preventing a stale
           exemption pulse. The hardware AND gate owns USB-sleep timing. */
        const bool allowed = acquisition && (rd(GPIOA + 0x10u) & 2u) != 0;
        const uint32_t set = (allowed ? 1u << 4 : 0u) | (allowed && !suspend ? 1u << 5 : 0u);
        wr(GPIOA + 0x18u, set | ((0x30u & ~set) << 16));
        return;
    }
    /* Inhibit first when leaving display mode; program suspend policy before acquisition ON. */
    if (!application) wr(GPIOA + 0x18u, 1u << 5);
    wr(GPIOA + 0x18u, suspend ? (1u << 11) : (1u << 27));
    wr(GPIOA + 0x18u, acquisition ? (1u << 4) : (1u << 20));
    if (application) wr(GPIOA + 0x18u, 1u << 21);
}
void power_target_fault(void) {
    outputs(NULL, false, false, true);
    /* Startup vector's fault loop does not refresh IWDG, so hardware reset follows. */
}
void power_target_initialize(power_board board) {
    target_board = board;
    health_ticks = 0;
    wake_pending = false;
    clock_ready = false;
    /* HSI48 / 8 = 6MHz, reset clock source; all support clocks remain internal. */
    replace(RCC, 0x3800u, 3u << 11);
    replace(RCC + 0x34u, 0, 3u);
    (void)rd(RCC + 0x34u);
    outputs(NULL, false, false, true);
    if (board == POWER_BOARD_VIRTUAL) {
        wr(GPIOA + 0x18u, 1u << 16); /* PA0 PD reset stays deasserted, low. */
        replace(GPIOA + 4u, 0x31u, 0); /* PA0/4/5 push-pull, both grants low. */
        replace(GPIOA, 0xffffu, (1u << 0) | (1u << 8) | (1u << 10) | (3u << 4) | (3u << 6));
        /* PA1 fault, PA6 alert, PA7 awake digital; unused PA2/3 remain analog. */
    } else {
        replace(GPIOA + 4u, 0, 1u << 5); /* Q6 gate open drain, external pull-up inhibits. */
        replace(GPIOA, (3u << 8) | (3u << 10) | (3u << 22), (1u << 8) | (1u << 10) | (1u << 22));
    }
    replace(GPIOA, 3u << 12, 0); /* PA6 digital ALERT_N input; external 47k pull-up. */
    /* PB6/PB7 AF6 open-drain I2C; PA13/PA14 retain reset SWD function. */
    replace(GPIOB + 4u, 0, 0xc0u);
    replace(GPIOB + 8u, 0xf000u, 0xa000u);
    replace(GPIOB + 0x20u, 0xff000000u, 0x66000000u);
    replace(GPIOB, 0xf000u, 0xa000u);
    replace(RCC + 0x54u, 3u << 12, 0); /* I2C1 uses PCLK. */
    replace(RCC + 0x3cu, 0, 1u << 21);
    wr(I2C, 0);
    /* Fast-mode at 6MHz PCLK, analog filter enabled. Verify rise/fall timing on prototype. */
    wr(I2C + 0x10u, 0x00100206u);
    wr(I2C, 1);
    /* ~256ms at nominal 32kHz LSI, with bounded datasheet tolerance. */
    wr(IWDG, 0xccccu);wr(IWDG, 0x5555u);wr(IWDG + 4u, 3);wr(IWDG + 8u, 255);
    if (!wait_register(IWDG + 0xcu, 3u, 0)) return;
    wr(IWDG, 0xaaaau);
    if (board == POWER_BOARD_VIRTUAL) {
        wr(SYSTICK, 0);
        if (!initialize_stop_clock()) return;
    } else {
        wr(SYSTICK + 4u, 5999);wr(SYSTICK + 8u, 0);wr(SYSTICK, 7);
    }
    clock_ready = true;
    power_control_init(&control, (power_io){NULL, read_pd, write_pd, outputs}, board);
}
bool power_target_poll(void) {
    if (!clock_ready) { power_target_fault(); return false; }
    if (target_board == POWER_BOARD_VIRTUAL) {
        wake_pending = false;
        if ((rd(GPIOA + 0x10u) & 2u) == 0) power_target_fault();
        (void)power_control_poll(&control);
        wr(IWDG, 0xaaaau);
        return true; /* Unqualified sources sleep too; RTC retries, alerts wake directly. */
    }
    /* A qualified contract is stable until ALERT_N changes. Avoid continuously sinking the I2C
       pull-ups during USB suspend. Still inspect status every 10ms; no USB-session inference. */
    if ((control.mode == POWER_LAPTOP || control.mode == POWER_DISPLAY) &&
        (rd(GPIOA + 0x10u) & (1u << 6)) != 0) {
        if ((rd(SYSTICK) & (1u << 16)) != 0) ++health_ticks;
        if (health_ticks < 10u) { wr(IWDG, 0xaaaau); return true; }
    }
    health_ticks = 0;
    (void)power_control_poll(&control);
    wr(IWDG, 0xaaaau);
    return false; /* Re-check after transactions; never sleep on unqualified/error paths. */
}
void power_target_irq(void) {
    wake_pending = true;
    wr(RTC + 0x5cu, 1u); /* RTC alarm clear; EXTI19 is a direct internal interrupt. */
    wr(EXTI + 0x0cu, INPUT_EDGES);wr(EXTI + 0x10u, INPUT_EDGES);
}
void power_target_sleep(void) {
    power_interrupt_lock();
    /* WFI with PRIMASK set wakes on an enabled pending interrupt; unmask only
       after restoring HSI division. Never clear pending events in this window. */
    if (clock_ready && !wake_pending && (rd(GPIOA + 0x10u) & (1u << 6)) != 0) {
        if (target_board == POWER_BOARD_VIRTUAL) replace(SCR, 0, 4u);
        power_wait_for_interrupt();
        replace(SCR, 4u, 0);
        if (target_board == POWER_BOARD_VIRTUAL) replace(RCC, 0x3800u, 3u << 11);
    }
    power_interrupt_unlock();
}
