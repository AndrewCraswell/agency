cmake_minimum_required(VERSION 3.25)

project(scoring_stm32_host LANGUAGES C ASM)

set(CMAKE_C_STANDARD 17)
set(CMAKE_C_STANDARD_REQUIRED ON)
set(CMAKE_C_EXTENSIONS OFF)

enable_testing()

set(SCORING_FIRMWARE_ROOT "${CMAKE_CURRENT_SOURCE_DIR}")

option(SCORING_BUILD_STM32G474RE_TARGET "Build the pinned STM32G474RE target safety adapter" OFF)

add_library(scoring_stm32_host STATIC
  core/stm32_scoring_core.c
  core/stm32_scoring_host.c
  core/stm32_target_startup.c
  core/stm32_transport.c
)

target_include_directories(scoring_stm32_host
  PUBLIC
    "${SCORING_FIRMWARE_ROOT}/include"
)

if(MSVC)
  target_compile_options(scoring_stm32_host PRIVATE /W4 /WX)
else()
  target_compile_options(scoring_stm32_host PRIVATE -Wall -Wextra -Werror -Wpedantic)
endif()

add_executable(scoring_stm32_host_tests
  tests/test_stm32_host.c
)

add_executable(scoring_stm32_transport_tests
  tests/test_stm32_transport.c
)

add_executable(scoring_stm32_core_tests
  tests/test_stm32_scoring_core.c
)

add_executable(scoring_stm32_target_startup_tests
  tests/test_stm32_target_startup.c
)

target_include_directories(scoring_stm32_host_tests PRIVATE
  "${SCORING_FIRMWARE_ROOT}/include"
  "${SCORING_FIRMWARE_ROOT}/generated"
)

target_include_directories(scoring_stm32_transport_tests PRIVATE
  "${SCORING_FIRMWARE_ROOT}/include"
  "${SCORING_FIRMWARE_ROOT}/generated"
)

target_include_directories(scoring_stm32_core_tests PRIVATE
  "${SCORING_FIRMWARE_ROOT}/include"
  "${SCORING_FIRMWARE_ROOT}/generated"
)

target_include_directories(scoring_stm32_target_startup_tests PRIVATE
  "${SCORING_FIRMWARE_ROOT}/include"
)

target_link_libraries(scoring_stm32_host_tests PRIVATE scoring_stm32_host)
target_link_libraries(scoring_stm32_transport_tests PRIVATE scoring_stm32_host)
target_link_libraries(scoring_stm32_core_tests PRIVATE scoring_stm32_host)
target_link_libraries(scoring_stm32_target_startup_tests PRIVATE scoring_stm32_host)

if(MSVC)
  target_compile_options(scoring_stm32_host_tests PRIVATE /W4 /WX)
else()
  target_compile_options(scoring_stm32_host_tests PRIVATE -Wall -Wextra -Werror -Wpedantic)
endif()

if(MSVC)
  target_compile_options(scoring_stm32_transport_tests PRIVATE /W4 /WX)
else()
  target_compile_options(scoring_stm32_transport_tests PRIVATE -Wall -Wextra -Werror -Wpedantic)
endif()

if(MSVC)
  target_compile_options(scoring_stm32_core_tests PRIVATE /W4 /WX)
else()
  target_compile_options(scoring_stm32_core_tests PRIVATE -Wall -Wextra -Werror -Wpedantic)
endif()

if(MSVC)
  target_compile_options(scoring_stm32_target_startup_tests PRIVATE /W4 /WX)
else()
  target_compile_options(scoring_stm32_target_startup_tests PRIVATE -Wall -Wextra -Werror -Wpedantic)
endif()

add_test(NAME scoring_stm32_host_tests COMMAND scoring_stm32_host_tests)
add_test(NAME scoring_stm32_transport_tests COMMAND scoring_stm32_transport_tests)
add_test(NAME scoring_stm32_core_tests COMMAND scoring_stm32_core_tests)
add_test(NAME scoring_stm32_target_startup_tests COMMAND scoring_stm32_target_startup_tests)
add_test(
  NAME scoring_stm32_golden_fixture_is_current
  COMMAND node "${SCORING_FIRMWARE_ROOT}/tools/generate-golden-fixture.mjs" --check
)
add_test(
  NAME scoring_stm32_transport_golden_fixture_is_current
  COMMAND node "${SCORING_FIRMWARE_ROOT}/tools/generate-transport-fixture.mjs" --check
)

if(SCORING_BUILD_STM32G474RE_TARGET)
  if(NOT DEFINED SCORING_STM32CUBE_G4_ROOT)
    message(FATAL_ERROR "SCORING_STM32CUBE_G4_ROOT must point to the pinned STM32CubeG4 source")
  endif()

  set(SCORING_STM32_DEVICE_ROOT "${SCORING_STM32CUBE_G4_ROOT}/Drivers/CMSIS/Device/ST/STM32G4xx")
  set(SCORING_CMSIS_ROOT "${SCORING_STM32CUBE_G4_ROOT}/Drivers/CMSIS")
  set(SCORING_TARGET_MAP "${CMAKE_CURRENT_BINARY_DIR}/scoring_stm32g474re.map")
  set(SCORING_TARGET_ELF "${CMAKE_CURRENT_BINARY_DIR}/scoring_stm32g474re.elf")
  set(SCORING_TARGET_STATIC_EVIDENCE "${CMAKE_CURRENT_BINARY_DIR}/scoring_stm32g474re.static-check.json")

  add_executable(scoring_stm32g474re
    core/stm32_target_startup.c
    target/stm32g474_target_adapter.c
    target/stm32g474_target_main.c
    "${SCORING_STM32_DEVICE_ROOT}/Source/Templates/system_stm32g4xx.c"
    "${SCORING_STM32_DEVICE_ROOT}/Source/Templates/gcc/startup_stm32g474xx.s"
  )

  set_target_properties(scoring_stm32g474re PROPERTIES
    OUTPUT_NAME "scoring_stm32g474re"
    SUFFIX ".elf"
  )

  target_compile_definitions(scoring_stm32g474re PRIVATE STM32G474xx)
  target_include_directories(scoring_stm32g474re PRIVATE
    "${SCORING_FIRMWARE_ROOT}/include"
    "${SCORING_FIRMWARE_ROOT}/target"
    "${SCORING_CMSIS_ROOT}/Include"
    "${SCORING_STM32_DEVICE_ROOT}/Include"
  )
  target_compile_options(scoring_stm32g474re PRIVATE
    -mcpu=cortex-m4
    -mthumb
    -mfloat-abi=soft
    -ffreestanding
    -fdata-sections
    -ffunction-sections
    -Wall
    -Wextra
    -Werror
    -Wpedantic
  )
  target_link_options(scoring_stm32g474re PRIVATE
    -mcpu=cortex-m4
    -mthumb
    -mfloat-abi=soft
    -nostdlib
    "-T${SCORING_FIRMWARE_ROOT}/target/stm32g474re.ld"
    "-Wl,-Map=${SCORING_TARGET_MAP}"
    -Wl,--gc-sections
    -Wl,--no-undefined
    -lgcc
  )

  add_custom_command(
    OUTPUT "${SCORING_TARGET_STATIC_EVIDENCE}"
    COMMAND node "${SCORING_FIRMWARE_ROOT}/tools/check-target-static.mjs"
      "${SCORING_ARM_GNU_TOOLCHAIN_ROOT}"
      "$<TARGET_FILE:scoring_stm32g474re>"
      "${SCORING_TARGET_MAP}"
      "${SCORING_TARGET_STATIC_EVIDENCE}"
    DEPENDS scoring_stm32g474re "${SCORING_FIRMWARE_ROOT}/tools/check-target-static.mjs"
    VERBATIM
  )
  add_custom_target(scoring_stm32g474re_static_check DEPENDS "${SCORING_TARGET_STATIC_EVIDENCE}")
endif()
