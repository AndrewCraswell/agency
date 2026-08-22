cmake_minimum_required(VERSION 3.25)

project(scoring_stm32_host LANGUAGES C)

set(CMAKE_C_STANDARD 17)
set(CMAKE_C_STANDARD_REQUIRED ON)
set(CMAKE_C_EXTENSIONS OFF)

enable_testing()

set(SCORING_FIRMWARE_ROOT "${CMAKE_CURRENT_SOURCE_DIR}")

add_library(scoring_stm32_host STATIC
  core/stm32_scoring_core.c
  core/stm32_scoring_host.c
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

target_link_libraries(scoring_stm32_host_tests PRIVATE scoring_stm32_host)
target_link_libraries(scoring_stm32_transport_tests PRIVATE scoring_stm32_host)
target_link_libraries(scoring_stm32_core_tests PRIVATE scoring_stm32_host)

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

add_test(NAME scoring_stm32_host_tests COMMAND scoring_stm32_host_tests)
add_test(NAME scoring_stm32_transport_tests COMMAND scoring_stm32_transport_tests)
add_test(NAME scoring_stm32_core_tests COMMAND scoring_stm32_core_tests)
add_test(
  NAME scoring_stm32_golden_fixture_is_current
  COMMAND node "${SCORING_FIRMWARE_ROOT}/tools/generate-golden-fixture.mjs" --check
)
add_test(
  NAME scoring_stm32_transport_golden_fixture_is_current
  COMMAND node "${SCORING_FIRMWARE_ROOT}/tools/generate-transport-fixture.mjs" --check
)
