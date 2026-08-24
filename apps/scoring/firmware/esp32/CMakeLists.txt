# M3-08 ESP32 service boundary. This file is both an ESP-IDF component and a
# standalone native C17 host-test project; source files intentionally include
# no ESP-IDF headers.
option(SCORING_ENABLE_LLVM_COVERAGE "Enable LLVM source-based coverage for native host tests" OFF)
if(ESP_PLATFORM)
  idf_component_register(
    SRCS
      "src/scoring_esp32_services.c"
      "src/scoring_esp32_journal.c"
      "src/scoring_esp32_receiver.c"
    INCLUDE_DIRS "include"
  )
else()
  cmake_minimum_required(VERSION 3.24)
  project(scoring_esp32_services LANGUAGES C)

  enable_testing()
  include("${CMAKE_CURRENT_LIST_DIR}/../cmake/ScoringNativePolicies.cmake")
  scoring_native_initialize()

  if(SCORING_ENABLE_LLVM_COVERAGE)
    scoring_native_enable_llvm_coverage()
  endif()

  add_library(
    scoring_esp32_services
    STATIC
      src/scoring_esp32_services.c
      src/scoring_esp32_journal.c
      src/scoring_esp32_receiver.c
  )
  target_include_directories(scoring_esp32_services PUBLIC include)

  add_executable(scoring_esp32_services_host_test tests/scoring_esp32_services_host_test.c)
  target_link_libraries(scoring_esp32_services_host_test PRIVATE scoring_esp32_services)
  target_include_directories(scoring_esp32_services_host_test PRIVATE generated)

  add_executable(scoring_esp32_load_isolation_host_test tests/scoring_esp32_load_isolation_host_test.c)
  target_link_libraries(scoring_esp32_load_isolation_host_test PRIVATE scoring_esp32_services)

  add_executable(scoring_esp32_receiver_host_test tests/scoring_esp32_receiver_host_test.c)
  target_link_libraries(scoring_esp32_receiver_host_test PRIVATE scoring_esp32_services)

  foreach(target scoring_esp32_services scoring_esp32_services_host_test scoring_esp32_load_isolation_host_test scoring_esp32_receiver_host_test)
    scoring_native_apply_baseline_warnings(${target})
  endforeach()
  scoring_native_assert_baseline_warnings(
    scoring_esp32_services
    scoring_esp32_services_host_test
    scoring_esp32_load_isolation_host_test
    scoring_esp32_receiver_host_test
  )

  add_test(NAME scoring_esp32_services_host_test COMMAND scoring_esp32_services_host_test)
  add_test(NAME scoring_esp32_load_isolation_host_test COMMAND scoring_esp32_load_isolation_host_test)
  add_test(NAME scoring_esp32_receiver_host_test COMMAND scoring_esp32_receiver_host_test)
endif()
