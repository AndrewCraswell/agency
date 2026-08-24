cmake_minimum_required(VERSION 3.25)

project(scoring_dual_firmware_integration LANGUAGES C)

enable_testing()
include("${CMAKE_CURRENT_LIST_DIR}/../cmake/ScoringNativePolicies.cmake")
scoring_native_initialize()

option(SCORING_ENABLE_LLVM_COVERAGE "Enable LLVM source-based coverage for native host tests" OFF)
if(SCORING_ENABLE_LLVM_COVERAGE)
  scoring_native_enable_llvm_coverage()
endif()

add_library(scoring_dual_firmware_real STATIC
  ../stm32/core/stm32_scoring_host.c
  ../stm32/core/stm32_transport.c
  ../esp32/src/scoring_esp32_services.c
  ../esp32/src/scoring_esp32_journal.c
  ../esp32/src/scoring_esp32_receiver.c
)
target_include_directories(scoring_dual_firmware_real PUBLIC
  "${CMAKE_CURRENT_LIST_DIR}/../stm32/include"
  "${CMAKE_CURRENT_LIST_DIR}/../esp32/include"
)

add_executable(scoring_dual_firmware_integration_test
  tests/test_dual_firmware_integration.c
)
target_link_libraries(scoring_dual_firmware_integration_test PRIVATE scoring_dual_firmware_real)

scoring_native_apply_baseline_warnings(scoring_dual_firmware_real)
scoring_native_apply_baseline_warnings(scoring_dual_firmware_integration_test)
scoring_native_assert_baseline_warnings(scoring_dual_firmware_real scoring_dual_firmware_integration_test)

add_test(NAME scoring_dual_firmware_integration_test COMMAND scoring_dual_firmware_integration_test)
