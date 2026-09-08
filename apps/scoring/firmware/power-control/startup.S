.syntax unified
.cpu cortex-m0plus
.thumb
.section .vectors,"a",%progbits
.word _stack_top
.word Reset_Handler
.rept 13
.word Fault_Handler
.endr
.word SysTick_Handler
.rept 32
.word Fault_Handler
.endr
.section .text.Reset_Handler,"ax",%progbits
.global Reset_Handler
.thumb_func
Reset_Handler:
    ldr r0, =_sidata
    ldr r1, =_sdata
    ldr r2, =_edata
1:  cmp r1, r2
    bcs 2f
    ldr r3, [r0]
    str r3, [r1]
    adds r0, #4
    adds r1, #4
    b 1b
2:  ldr r1, =_sbss
    ldr r2, =_ebss
    movs r3, #0
3:  cmp r1, r2
    bcs 4f
    str r3, [r1]
    adds r1, #4
    b 3b
4:  bl power_target_initialize
5:  bl power_target_poll
    cmp r0, #0
    beq 5b
    /* Shallow Sleep only: SysTick remains clocked. A tick racing this instruction
       can postpone the next poll by at most one further nominal 1ms period. */
    dsb
    wfi
    isb
    b 5b
.global SysTick_Handler
.thumb_func
SysTick_Handler:
    bx lr
.thumb_func
Fault_Handler:
    bl power_target_fault
6:  b 6b
