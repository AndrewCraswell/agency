#ifndef POWER_TEST_FIXTURE_H
#define POWER_TEST_FIXTURE_H
#include "power_control.h"
#include <assert.h>
#include <string.h>
typedef struct {
    uint8_t reg[256];
    unsigned calls, fail_at;
    bool bad_profile, torn_header;
    bool acquisition, application, suspend;
} fixture;
static inline void put32(uint8_t *p, uint32_t v) {
    for (size_t i=0;i<4;++i) p[i]=(uint8_t)(v>>(i*8));
}
static inline void setup(fixture *f) {
    memset(f,0,sizeof *f);f->reg[0x2f]=0x25;f->reg[0x0e]=1;f->reg[0x10]=2;f->reg[0x11]=2;f->reg[0x29]=0x14;
}
static inline bool get(void *ctx,uint8_t reg,uint8_t *p,size_t n) {
    fixture *f=ctx;
    if (++f->calls==f->fail_at) return false;
    memcpy(p,f->reg+reg,n);
    if(reg==0x0b)f->reg[reg]=0;
    if(reg==0x85 && f->bad_profile)p[0]^=1;
    if(reg==0x31 && f->torn_header)p[0]^=1;
    return true;
}
static inline bool put(void *ctx,uint8_t reg,const uint8_t *p,size_t n) {
    fixture *f=ctx;
    if (++f->calls==f->fail_at)return false;
    memcpy(f->reg+reg,p,n);return true;
}
static inline void out(void *ctx,bool a,bool d,bool s) {
    fixture *f=ctx;assert(!d || (a && !s));f->acquisition=a;f->application=d;f->suspend=s;
}
static inline power_io io(fixture *f) { return (power_io){f,get,put,out}; }
static inline void source(fixture *f,bool computer,unsigned count) {
    f->reg[0x0b]|=2;f->reg[0x16]=4;f->reg[0x30]=(uint8_t)(count*4);f->reg[0x31]=1;f->reg[0x32]=(uint8_t)(count<<4);
    put32(f->reg+0x33,(computer?(UINT32_C(1)<<26):0)|(100u<<10)|300u);
    for(unsigned i=1;i<count;++i)put32(f->reg+0x33+i*4,(400u<<10)|300u);
}
static inline void contract(fixture *f,unsigned index,unsigned current) {
    f->reg[0x29]=0x18;put32(f->reg+0x91,(index<<28)|(current<<10)|current|(1u<<25));
}
static inline void laptop(power_control *c,fixture *f) {
    setup(f);power_control_init(c,io(f));assert(power_control_poll(c));source(f,true,2);contract(f,1,150);assert(power_control_poll(c));assert(c->mode==POWER_LAPTOP);
}
static inline void display(power_control *c,fixture *f) {
    setup(f);power_control_init(c,io(f));assert(power_control_poll(c));source(f,false,2);contract(f,1,150);assert(power_control_poll(c));assert(f->reg[0x70]==2 && c->mode==POWER_OFF);
    source(f,false,2);contract(f,2,300);assert(power_control_poll(c));assert(c->mode==POWER_DISPLAY);
}
#endif
