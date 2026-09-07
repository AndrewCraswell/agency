#include "fixture.h"
#include "stm32c011_power.h"
#include <stdio.h>

static fixture pd;
static uint32_t gpio, i2c_status, remaining;
static uint8_t pointer;
static bool first_byte, auto_stop, reading, force_busy, force_timeout, nack_triggered;
static unsigned status_reads, nack_at, watchdog_updates;
typedef struct { uintptr_t address;uint32_t value; } slot;
static slot registers[40];static size_t register_count;
static void remember(uintptr_t a,uint32_t v) {
    for(size_t i=0;i<register_count;++i)if(registers[i].address==a){registers[i].value=v;return;}
    assert(register_count<40);registers[register_count++]=(slot){a,v};
}
uint32_t power_register_read(uintptr_t a) {
    if(a==0x40005418u) {
        if(force_busy)return 0x8000;
        if(force_timeout)return 0;
        ++status_reads;
        if(nack_at!=0 && status_reads>=nack_at && remaining>0){nack_triggered=true;return 0x10;}
        return i2c_status;
    }
    if(a==0x40005424u) {
        assert(reading && remaining>0);
        uint8_t value=pd.reg[pointer];if(pointer==0x0b)pd.reg[pointer]=0;
        ++pointer;if(--remaining==0)i2c_status=0x20;
        return value;
    }
    if(a==0x4000300cu && watchdog_updates>0){--watchdog_updates;return 3;}
    for(size_t i=0;i<register_count;++i)if(registers[i].address==a)return registers[i].value;
    return 0;
}
void power_register_write(uintptr_t a,uint32_t v) {
    if(a==0x50000018u){gpio|=v&0xffffu;gpio&=~(v>>16);return;}
    if(a==0x40005400u && v==0)i2c_status=0;
    if(a==0x4000541cu && (v&0x20u)!=0)i2c_status&=~0x20u;
    if(a==0x40005404u) {
        if((v&0x4000u)!=0){i2c_status=0;return;}
        assert((v&0x3ffu)==0x50u);
        remaining=(v>>16)&255u;reading=(v&0x400u)!=0;auto_stop=(v&(1u<<25))!=0;
        first_byte=!reading;i2c_status=reading?4u:2u;return;
    }
    if(a==0x40005428u) {
        assert(!reading && remaining>0);
        if(first_byte){pointer=(uint8_t)v;first_byte=false;}
        else pd.reg[pointer++]=(uint8_t)v;
        if(--remaining==0)i2c_status=auto_stop?0x20u:0x40u;
        return;
    }
    remember(a,v);
}
static void reset(void) {
    setup(&pd);gpio=0;i2c_status=0;remaining=0;register_count=0;status_reads=0;nack_at=0;nack_triggered=false;
    force_busy=false;force_timeout=false;watchdog_updates=1;
    power_target_initialize();
    assert((gpio&0x830u)==0x820u);
    assert(power_register_read(0x50000420u)==0x66000000u);
    assert(power_register_read(0x40005410u)==0x00100206u);
}
int main(void) {
    reset();power_target_poll();assert((gpio&0x830u)==0x830u); /* qualified Type-C */
    source(&pd,true,2);contract(&pd,1,150);power_target_poll();assert((gpio&0x830u)==0x830u);
    source(&pd,false,2);power_target_poll();assert((gpio&0x830u)==0x820u);
    source(&pd,false,2);contract(&pd,2,300);power_target_poll();assert((gpio&0x830u)==0x10u);
    power_target_fault();assert((gpio&0x830u)==0x820u);
    pd.reg[0x0e]=0;power_target_poll();assert((gpio&0x830u)==0x820u);
    for(unsigned i=1;i<180;++i) {
        reset();nack_at=i;power_target_poll();
        if(nack_triggered)assert((gpio&0x830u)==0x820u);
        nack_at=0;power_target_poll();
    }
    reset();force_busy=true;power_target_poll();assert((gpio&0x830u)==0x820u);
    reset();force_timeout=true;power_target_poll();assert((gpio&0x830u)==0x820u);
    force_timeout=false;power_target_poll();assert((gpio&0x830u)==0x830u);
    reset();pd.reg[0x2f]=0;power_target_poll();assert((gpio&0x830u)==0x820u);
    watchdog_updates=5000;power_target_initialize();assert((gpio&0x830u)==0x820u);
    puts("STM32C011 register/transport scenarios passed");return 0;
}
