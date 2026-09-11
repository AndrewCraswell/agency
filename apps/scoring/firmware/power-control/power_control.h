#ifndef POWER_CONTROL_H
#define POWER_CONTROL_H
#include <stdbool.h>
#include <stddef.h>
#include <stdint.h>

/* All callbacks execute synchronously. A failed transaction must return promptly. */
typedef struct {
    void *context;
    bool (*read)(void *, uint8_t, uint8_t *, size_t);
    bool (*write)(void *, uint8_t, const uint8_t *, size_t);
    void (*outputs)(void *, bool acquisition, bool application, bool suspend_shutdown);
} power_io;

typedef enum { POWER_OFF, POWER_TYPE_C, POWER_LAPTOP, POWER_DISPLAY, POWER_FAULT } power_mode;
typedef enum { POWER_BOARD_COMBINED, POWER_BOARD_VIRTUAL } power_board;
typedef struct {
    power_io io;
    power_board board;
    uint32_t source[7];
    uint8_t source_count;
    bool initialized;
    bool attached;
    bool display_profile;
    bool pd_seen;
    bool requested_caps;
    power_mode mode;
} power_control;

void power_control_init(power_control *control, power_io io, power_board board);
/* Call continuously; process alerts within 1ms to capture STUSB4500's transient RX buffer. */
bool power_control_poll(power_control *control);
#endif
