# M3-08 ESP32 service boundary. This file is both an ESP-IDF component and a
# standalone native C17 host-test project; source files intentionally include
# no ESP-IDF headers.
if(ESP_PLATFORM)
  idf_component_register(
    SRCS "src/scoring_esp32_services.c"
    INCLUDE_DIRS "include"
  )
else()
  cmake_minimum_required(VERSION 3.24)
  project(scoring_esp32_services LANGUAGES C)

  enable_testing()
  set(CMAKE_C_STANDARD 17)
  set(CMAKE_C_STANDARD_REQUIRED ON)
  set(CMAKE_C_EXTENSIONS OFF)

  add_library(scoring_esp32_services STATIC src/scoring_esp32_services.c)
  target_include_directories(scoring_esp32_services PUBLIC include)

  add_executable(scoring_esp32_services_host_test tests/scoring_esp32_services_host_test.c)
  target_link_libraries(scoring_esp32_services_host_test PRIVATE scoring_esp32_services)

  add_executable(scoring_esp32_load_isolation_host_test tests/scoring_esp32_load_isolation_host_test.c)
  target_link_libraries(scoring_esp32_load_isolation_host_test PRIVATE scoring_esp32_services)

  foreach(target scoring_esp32_services scoring_esp32_services_host_test scoring_esp32_load_isolation_host_test)
    if(MSVC)
      target_compile_options(${target} PRIVATE /W4 /WX /permissive-)
    else()
      target_compile_options(${target} PRIVATE -Wall -Wextra -Werror -Wpedantic -Wconversion -Wsign-conversion)
    endif()
  endforeach()

  add_test(NAME scoring_esp32_services_host_test COMMAND scoring_esp32_services_host_test)
  add_test(NAME scoring_esp32_load_isolation_host_test COMMAND scoring_esp32_load_isolation_host_test)
endif()
