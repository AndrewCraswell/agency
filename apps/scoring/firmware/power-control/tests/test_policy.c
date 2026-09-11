#include "fixture.h"
#include <stdio.h>
int main(void) {
    fixture f;power_control c;
    setup(&f);power_control_init(&c,io(&f),POWER_BOARD_COMBINED);assert(!f.acquisition && !f.application && f.suspend);
    assert(power_control_poll(&c));assert(c.mode==POWER_TYPE_C && f.reg[0x70]==1);
    for(unsigned orientation=0;orientation<2;++orientation)for(unsigned cc=0;cc<4;++cc) {
        f.reg[0x11]=(uint8_t)(cc<<(orientation*2));assert(power_control_poll(&c));assert(f.acquisition==(cc>=2));assert(!f.application);
    }
    f.reg[0x11]=0x0a;assert(power_control_poll(&c));assert(!f.acquisition);
    f.reg[0x11]=0x22;assert(power_control_poll(&c));assert(!f.acquisition);
    f.reg[0x11]=2;f.reg[0x0e]=9;assert(power_control_poll(&c));assert(!f.acquisition);
    for(unsigned engine=0;engine<256;++engine) {
        setup(&f);power_control_init(&c,io(&f),POWER_BOARD_COMBINED);assert(power_control_poll(&c));f.reg[0x29]=(uint8_t)engine;
        assert(power_control_poll(&c));assert(f.acquisition==(engine==0x13 || engine==0x14));
    }
    laptop(&c,&f);assert(f.acquisition && !f.application && f.suspend);
    /* Even a 20V-capable laptop never enables display or requests its 20V PDO. */
    contract(&f,2,300);assert(power_control_poll(&c));assert(!f.acquisition && !f.application && f.reg[0x70]==1);
    display(&c,&f);assert(f.application && !f.suspend);
    f.reg[0x0b]=0x80;f.reg[0x29]=0x14;assert(power_control_poll(&c));assert(!f.acquisition && c.source_count==0);
    display(&c,&f);f.reg[0x0e]=0;assert(power_control_poll(&c));assert(!f.application && f.reg[0x70]==1);
    assert(power_control_poll(&c));assert(!f.acquisition);
    display(&c,&f);source(&f,true,2);assert(power_control_poll(&c));assert(!f.application && f.reg[0x70]==1);
    laptop(&c,&f);f.reg[0x0b]=0x40;f.reg[0x0d]=1;assert(power_control_poll(&c));assert(!f.acquisition);
    laptop(&c,&f);f.reg[0x0b]=0x40;f.reg[0x0d]=0;assert(power_control_poll(&c));assert(f.acquisition);
    for(unsigned bad=0;bad<8;++bad) {
        laptop(&c,&f);
        switch(bad) {
        case 0: f.reg[0x13]=1;break;
        case 1: f.reg[0x10]=0;break;
        case 2: contract(&f,0,150);break;
        case 3: contract(&f,7,150);break;
        case 4: put32(f.reg+0x91,(1u<<28)|(1u<<26)|(150u<<10)|150u);break;
        case 5: put32(f.reg+0x91,(1u<<28)|(1u<<27)|(150u<<10)|150u);break;
        case 6: put32(f.reg+0x91,(1u<<28)|(200u<<10)|150u);break;
        default: contract(&f,1,301);break;
        }
        assert(power_control_poll(&c));assert(!f.acquisition && !f.application);
    }
    for(unsigned bad=0;bad<5;++bad) {
        laptop(&c,&f);source(&f,true,2);
        if(bad==0)f.torn_header=true;
        if(bad==1)f.reg[0x30]=3;
        if(bad==2)f.reg[0x32]=0;
        if(bad==3)put32(f.reg+0x33,0xc0000000u);
        if(bad==4)put32(f.reg+0x33,200u<<10);
        assert(!power_control_poll(&c));assert(c.mode==POWER_FAULT && !f.acquisition);
    }
    laptop(&c,&f);source(&f,true,1);f.reg[0x31]=3;assert(power_control_poll(&c));assert(f.acquisition);
    laptop(&c,&f);source(&f,true,1);f.reg[0x32]|=0x80;assert(power_control_poll(&c));assert(f.acquisition);
    laptop(&c,&f);f.reg[0x0b]=2;f.reg[0x16]=0;assert(power_control_poll(&c));assert(f.acquisition);
    f.reg[0x0b]=2;f.reg[0x16]=1;assert(power_control_poll(&c));assert(!f.acquisition);
    setup(&f);f.bad_profile=true;power_control_init(&c,io(&f),POWER_BOARD_COMBINED);assert(!power_control_poll(&c));
    setup(&f);f.reg[0x2f]=0;power_control_init(&c,io(&f),POWER_BOARD_COMBINED);assert(!power_control_poll(&c));
    setup(&f);f.reg[0x2f]=0x21;power_control_init(&c,io(&f),POWER_BOARD_COMBINED);assert(power_control_poll(&c));
    /* Every transaction position in boot, receive, display negotiation and detach fails closed. */
    for(unsigned flow=0;flow<4;++flow)for(unsigned failure=1;failure<=20;++failure) {
        if(flow==0){setup(&f);power_control_init(&c,io(&f),POWER_BOARD_COMBINED);}
        else if(flow==1){laptop(&c,&f);source(&f,true,2);}
        else if(flow==2){laptop(&c,&f);source(&f,false,2);}
        else{display(&c,&f);f.reg[0x0e]=0;}
        f.fail_at=f.calls+failure;
        bool ok=power_control_poll(&c);
        if(!ok){assert(!f.acquisition && !f.application && f.suspend);assert(c.mode==POWER_FAULT);}
        f.fail_at=0;f.torn_header=false;assert(power_control_poll(&c));
    }
    /* Non-fixed optional PDOs, inadequate chargers, smaller contracts and stale buffers stay off. */
    setup(&f);power_control_init(&c,io(&f),POWER_BOARD_COMBINED);assert(power_control_poll(&c));source(&f,false,7);
    for(unsigned i=1;i<7;++i)put32(f.reg+0x33+i*4,0xc0000000u);
    contract(&f,7,150);assert(power_control_poll(&c));assert(!f.application && !f.acquisition);
    laptop(&c,&f);contract(&f,1,149);assert(power_control_poll(&c));assert(!f.acquisition);
    display(&c,&f);contract(&f,2,299);assert(power_control_poll(&c));assert(!f.application);
    setup(&f);power_control_init(&c,io(&f),POWER_BOARD_COMBINED);assert(power_control_poll(&c));contract(&f,1,150);
    assert(power_control_poll(&c));assert(c.requested_caps && f.reg[0x51]==7 && !f.acquisition);
    assert(power_control_poll(&c));assert(!f.acquisition);
    source(&f,true,2);assert(power_control_poll(&c));assert(f.acquisition && !c.requested_caps);
    for(unsigned fail_byte=1;fail_byte<=2;++fail_byte) {
        setup(&f);power_control_init(&c,io(&f),POWER_BOARD_COMBINED);assert(power_control_poll(&c));contract(&f,1,150);
        f.fail_at=f.calls+3+fail_byte;assert(!power_control_poll(&c));assert(!f.acquisition);
    }
    laptop(&c,&f);f.reg[0x94]&=(uint8_t)~2u;assert(power_control_poll(&c));assert(!f.acquisition);
    puts("Power policy scenarios passed");return 0;
}
