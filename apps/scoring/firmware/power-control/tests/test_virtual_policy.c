#include "fixture.h"
#include <stdio.h>

static void start(power_control *c, fixture *f) {
    setup(f);
    memset(f->reg + 0x89, 0xa5, 4); /* The virtual image must not write a 20V PDO. */
    power_control_init(c, io(f), POWER_BOARD_VIRTUAL);
    assert(!f->acquisition && !f->application && f->suspend);
    assert(power_control_poll(c));
    assert(c->mode == POWER_TYPE_C && f->acquisition && !f->suspend);
    assert(f->reg[0x70] == 1);
    for (unsigned i = 0; i < 4; ++i) assert(f->reg[0x89 + i] == 0xa5);
}
static uint32_t first_pdo(bool usb, bool suspend, unsigned current) {
    return (usb ? 1u << 26 : 0u) | (suspend ? 1u << 28 : 0u) | (100u << 10) | current;
}
int main(void) {
    power_control c;fixture f;
    /* Laptop and charger may each advertise PD. Use explicit source flags, not
       absent enumeration, the sink request bit, or the existence of 20V. */
    for (unsigned usb = 0; usb < 2; ++usb)
    for (unsigned suspend = 0; suspend < 2; ++suspend)
    for (unsigned request_exempt = 0; request_exempt < 2; ++request_exempt) {
        start(&c, &f);source(&f, usb != 0, 2);
        put32(f.reg + 0x33, first_pdo(usb != 0, suspend != 0, 300));
        contract(&f, 1, 150);
        if (request_exempt) f.reg[0x94] |= 1u;
        assert(power_control_poll(&c));
        assert(c.mode == POWER_LAPTOP && f.acquisition && !f.application);
        assert(f.suspend == (usb != 0 && suspend != 0));
        assert(!c.display_profile && f.reg[0x70] == 1);
        contract(&f, 2, 300);assert(power_control_poll(&c));
        assert(c.mode == POWER_OFF && !f.acquisition && f.suspend);
    }
    for (unsigned orientation = 0; orientation < 2; ++orientation)
    for (unsigned current = 0; current < 4; ++current) {
        start(&c, &f);f.reg[0x11] = (uint8_t)(current << (orientation * 2));
        assert(power_control_poll(&c));
        assert(f.acquisition == (current >= 2));assert(f.suspend == (current < 2));
    }
    for (unsigned engine = 0; engine < 256; ++engine) {
        start(&c, &f);f.reg[0x29] = (uint8_t)engine;
        assert(power_control_poll(&c));
        assert(f.acquisition == (engine == 0x13 || engine == 0x14));
    }
    for (unsigned fault = 0; fault < 7; ++fault) {
        start(&c, &f);source(&f, false, 2);contract(&f, 1, 150);assert(power_control_poll(&c));
        assert(f.acquisition && !f.suspend);
        switch (fault) {
        case 0: f.reg[0x0e] = 0;break; /* Detach removes cached exemption. */
        case 1: f.reg[0x13] = 1;break;
        case 2: f.reg[0x0b] = 0x80;f.reg[0x29] = 0x14;break;
        case 3: f.reg[0x0b] = 2;f.reg[0x16] = 1;break;
        case 4: f.reg[0x10] = 0;break;
        case 5: contract(&f, 1, 149);break;
        default: f.fail_at = f.calls + 1;break;
        }
        (void)power_control_poll(&c);
        assert(!f.acquisition && !f.application && f.suspend);
    }
    /* Fresh capabilities can withdraw a previously valid exemption. */
    start(&c, &f);source(&f, false, 1);contract(&f, 1, 150);assert(power_control_poll(&c));
    assert(!f.suspend);
    source(&f, true, 1);put32(f.reg + 0x33, first_pdo(true, true, 150));
    assert(power_control_poll(&c));assert(f.acquisition && f.suspend);
    for (unsigned failure = 1; failure < 24; ++failure) {
        setup(&f);power_control_init(&c, io(&f), POWER_BOARD_VIRTUAL);f.fail_at = failure;
        if (!power_control_poll(&c)) assert(!f.acquisition && f.suspend);
        start(&c, &f);source(&f, true, 1);contract(&f, 1, 150);f.fail_at = f.calls + failure;
        if (!power_control_poll(&c)) assert(!f.acquisition && f.suspend);
    }
    start(&c, &f);contract(&f, 1, 150);assert(power_control_poll(&c));
    assert(c.requested_caps && !f.acquisition && f.suspend);
    assert(power_control_poll(&c));assert(!f.acquisition);
    puts("Virtual-board source qualification and suspend scenarios passed");
    return 0;
}
