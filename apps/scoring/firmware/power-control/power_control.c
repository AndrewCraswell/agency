#include "power_control.h"

/* Register definitions: ST UM2650 and STUSB4500 reference firmware. */
enum { ALERT = 0x0b, MASK = 0x0c, PORT_TRANS = 0x0d, PORT = 0x0e,
       MONITOR = 0x10, CC = 0x11, FAULT = 0x13, PROTOCOL = 0x16,
       COMMAND = 0x1a, ENGINE = 0x29, DEVICE = 0x2f, RX = 0x30,
       TX_HEADER = 0x51, PDO_COUNT = 0x70, SINK_PDO = 0x85, RDO = 0x91 };
static uint32_t le32(const uint8_t *p) {
    return (uint32_t)p[0] | ((uint32_t)p[1] << 8) | ((uint32_t)p[2] << 16) | ((uint32_t)p[3] << 24);
}
static bool read_bytes(power_control *c, uint8_t reg, uint8_t *p, size_t n) {
    return c->io.read(c->io.context, reg, p, n);
}
static bool write_bytes(power_control *c, uint8_t reg, const uint8_t *p, size_t n) {
    return c->io.write(c->io.context, reg, p, n);
}
static void output(power_control *c, power_mode mode) {
    c->mode = mode;
    /* Type-C 1.5A/3A permits advertised current during USB suspend. Under PD,
       fresh source PDO1 identifies a non-USB charger or the host's suspend rule.
       Bit28 is undefined if USB Communications Capable (bit26) is clear.
       The sink's No USB Suspend request is never treated as a grant. */
    const bool virtual_exempt = c->board == POWER_BOARD_VIRTUAL &&
        (mode == POWER_TYPE_C || (mode == POWER_LAPTOP && c->source_count != 0 &&
                                 ((c->source[0] & (UINT32_C(1) << 26)) == 0 ||
                                  (c->source[0] & (UINT32_C(1) << 28)) == 0)));
    c->io.outputs(c->io.context, mode == POWER_TYPE_C || mode == POWER_LAPTOP || mode == POWER_DISPLAY,
                  mode == POWER_DISPLAY, mode != POWER_DISPLAY && !virtual_exempt);
}
static void invalidate(power_control *c) {
    c->source_count = 0;
    c->pd_seen = false;
    c->requested_caps = false;
    output(c, POWER_OFF);
}
static bool fail(power_control *c) {
    invalidate(c);
    c->initialized = false;
    output(c, POWER_FAULT);
    return false;
}
static bool send_control(power_control *c, uint8_t header) {
    const uint8_t command = 0x26;
    return write_bytes(c, TX_HEADER, &header, 1) && write_bytes(c, COMMAND, &command, 1);
}
static bool profile(power_control *c, bool display) {
    /* USB communications capable sink, no dual-role power/data. 5V/1.5A and 20V/3A.
       PDO2 drives the board's POWER_OK2 hardware gate (POWER_OK_CFG=10b). */
    const uint32_t pdo[2] = { (UINT32_C(1) << 26) | (100u << 10) | 150u, (400u << 10) | 300u };
    uint8_t bytes[8], count = display ? 2u : 1u;
    const size_t size = c->board == POWER_BOARD_VIRTUAL ? 4u : sizeof bytes;
    for (size_t i = 0; i < 2; ++i)
        for (size_t j = 0; j < 4; ++j) bytes[i * 4 + j] = (uint8_t)(pdo[i] >> (8u * j));
    output(c, POWER_OFF);
    if (!write_bytes(c, SINK_PDO, bytes, size) || !write_bytes(c, PDO_COUNT, &count, 1)) return false;
    /* Read-back catches reset/NVM reload or a silently rejected write. */
    uint8_t verify[8], actual;
    if (!read_bytes(c, SINK_PDO, verify, size) || !read_bytes(c, PDO_COUNT, &actual, 1)) return false;
    for (size_t i = 0; i < size; ++i) if (verify[i] != bytes[i]) return false;
    if ((actual & 3u) != count) return false;
    c->display_profile = display;
    c->source_count = 0;
    c->pd_seen = true; /* Do not fall back to CC current during renegotiation. */
    c->requested_caps = false;
    return send_control(c, 0x0d);
}
void power_control_init(power_control *c, power_io io, power_board board) {
    c->io = io;
    c->board = board;
    c->source_count = 0;
    c->initialized = false;
    c->attached = false;
    c->display_profile = false;
    c->pd_seen = false;
    c->requested_caps = false;
    output(c, POWER_OFF);
}
static bool initialize(power_control *c) {
    uint8_t id;
    if (!read_bytes(c, DEVICE, &id, 1) || (id != 0x25u && id != 0x21u)) return false;
    const uint8_t mask = 0x01; /* All relevant transition/protocol/reset alerts enabled. */
    if (!write_bytes(c, MASK, &mask, 1) || !profile(c, false)) return false;
    c->initialized = true;
    c->attached = false;
    c->pd_seen = false; /* Non-PD Type-C is allowed after startup, at >=1.5A only. */
    return true;
}
static bool source_message(power_control *c) {
    uint8_t protocol;
    if (!read_bytes(c, PROTOCOL, &protocol, 1)) return false;
    if ((protocol & 3u) != 0) { invalidate(c); c->pd_seen = true; }
    if ((protocol & 4u) == 0) return true;
    uint8_t message[31], header_after[2];
    if (!read_bytes(c, RX, message, sizeof message) || !read_bytes(c, RX + 1u, header_after, 2)) return false;
    const uint16_t h = (uint16_t)((uint16_t)message[1] | ((uint16_t)message[2] << 8));
    if (message[1] != header_after[0] || message[2] != header_after[1]) return false;
    if ((h & 0x1fu) != 1u || (h & 0x8000u) != 0) return true;
    output(c, POWER_OFF);
    c->pd_seen = true;
    c->source_count = 0;
    const uint8_t count = (uint8_t)((h >> 12) & 7u);
    if (count == 0 || message[0] != count * 4u) return false;
    for (size_t i = 0; i < count; ++i) c->source[i] = le32(message + 3u + i * 4u);
    if ((c->source[0] >> 30) != 0 || ((c->source[0] >> 10) & 1023u) != 100u) return false;
    c->source_count = count;
    c->requested_caps = false;
    return true;
}
static bool display_available(const power_control *c) {
    if (c->board == POWER_BOARD_VIRTUAL) return false;
    if (c->source_count == 0 || (c->source[0] & (UINT32_C(1) << 26)) != 0) return false;
    for (size_t i = 0; i < c->source_count; ++i) {
        uint32_t p = c->source[i];
        if ((p >> 30) == 0 && ((p >> 10) & 1023u) == 400u && (p & 1023u) >= 300u) return true;
    }
    return false;
}
bool power_control_poll(power_control *c) {
    if (!c->initialized && !initialize(c)) return fail(c);
    uint8_t alert;
    if (!read_bytes(c, ALERT, &alert, 1)) return fail(c);
    if ((alert & 0x80u) != 0) { invalidate(c); c->pd_seen = true; }
    if ((alert & 0x40u) != 0) {
        uint8_t transition;
        if (!read_bytes(c, PORT_TRANS, &transition, 1)) return fail(c);
        if ((transition & 1u) != 0) invalidate(c);
    }
    /* RX first: source capabilities can be overwritten by Accept within about 3ms. */
    if ((alert & 2u) != 0 && !source_message(c)) return fail(c);
    uint8_t status[6], engine, request[4];
    if (!read_bytes(c, PORT, status, sizeof status) || !read_bytes(c, ENGINE, &engine, 1)) return fail(c);
    const bool attached = (status[0] & 1u) != 0;
    if (!attached) {
        invalidate(c);
        if (c->attached && !profile(c, false)) return fail(c);
        c->attached = false;
        c->pd_seen = false;
        return true;
    }
    c->attached = true;
    if ((status[5] & 0xafu) != 0 || (status[2] & 2u) == 0) {
        invalidate(c);
        c->pd_seen = true;
        return true;
    }
    if ((engine == 0x18u || engine == 0x19u) && c->source_count != 0 && display_available(c) != c->display_profile) {
        if (!profile(c, display_available(c))) return fail(c);
        return true;
    }
    if (engine != 0x18u && engine != 0x19u) {
        const uint8_t cc = status[3];
        const uint8_t cc1 = cc & 3u, cc2 = (cc >> 2) & 3u;
        const uint8_t active = cc1 == 0 ? cc2 : (cc2 == 0 ? cc1 : 0u);
        /* Only sink wait/discovery states can use Rp current, never a reset/transition/error state. */
        output(c, !c->pd_seen && (engine == 0x13u || engine == 0x14u) && (status[0] & 8u) == 0 && (cc & 0x20u) == 0 && active >= 2u
                      ? POWER_TYPE_C : POWER_OFF);
        return true;
    }
    if (c->source_count == 0) {
        output(c, POWER_OFF);
        c->pd_seen = true;
        /* Recover a capability message overwritten by Accept/PS_RDY, without enabling from stale RDO. */
        if (!c->requested_caps) {
            if (!send_control(c, 7)) return fail(c); /* Get_Source_Cap, once per unknown contract. */
            c->requested_caps = true;
        }
        return true;
    }
    if (!read_bytes(c, RDO, request, sizeof request)) return fail(c);
    const uint32_t r = le32(request);
    const uint8_t index = (uint8_t)((r >> 28) & 7u);
    if (index == 0 || index > c->source_count || (r & (UINT32_C(1) << 25)) == 0 || (r & ((UINT32_C(1) << 26) | (UINT32_C(1) << 27))) != 0) {
        output(c, POWER_OFF);return true;
    }
    const uint32_t p = c->source[index - 1u], voltage = (p >> 10) & 1023u;
    const uint32_t operating = (r >> 10) & 1023u, maximum = r & 1023u;
    if ((p >> 30) != 0 || operating > maximum || maximum > (p & 1023u)) {
        output(c, POWER_OFF);return true;
    }
    const bool display = c->display_profile && display_available(c) && voltage == 400u && operating >= 300u;
    const bool laptop = !c->display_profile && voltage == 100u && operating >= 150u;
    output(c, display ? POWER_DISPLAY : laptop ? POWER_LAPTOP : POWER_OFF);
    return true;
}
