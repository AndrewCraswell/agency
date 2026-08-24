cmake_minimum_required(VERSION 3.24)
project(scoring_product_update LANGUAGES C)

enable_testing()
set(CMAKE_C_STANDARD 17)
set(CMAKE_C_STANDARD_REQUIRED ON)
set(CMAKE_C_EXTENSIONS OFF)
option(SCORING_PRODUCT_UPDATE_SANITIZERS "Enable address and undefined-behaviour sanitizers for host tests" OFF)
option(SCORING_ENABLE_LLVM_COVERAGE "Enable LLVM source-based coverage for native host tests" OFF)

if(SCORING_ENABLE_LLVM_COVERAGE)
  if(MSVC)
    message(FATAL_ERROR "SCORING_ENABLE_LLVM_COVERAGE requires a Clang-compatible compiler")
  endif()
  add_compile_options(-fprofile-instr-generate -fcoverage-mapping -O0)
  add_link_options(-fprofile-instr-generate -fcoverage-mapping)
endif()

add_library(scoring_product_release STATIC src/scoring_product_release.c)
target_include_directories(scoring_product_release PUBLIC include)

add_executable(scoring_product_release_host_test tests/scoring_product_release_host_test.c)
target_link_libraries(scoring_product_release_host_test PRIVATE scoring_product_release)

foreach(target scoring_product_release scoring_product_release_host_test)
  if(MSVC)
    target_compile_options(${target} PRIVATE /W4 /WX /permissive-)
  else()
    target_compile_options(${target} PRIVATE -Wall -Wextra -Werror -Wpedantic -Wconversion -Wsign-conversion)
  endif()
endforeach()

if(SCORING_PRODUCT_UPDATE_SANITIZERS AND NOT MSVC)
  target_compile_options(scoring_product_release PRIVATE -fsanitize=address,undefined -fno-omit-frame-pointer)
  target_compile_options(scoring_product_release_host_test PRIVATE -fsanitize=address,undefined -fno-omit-frame-pointer)
  target_link_options(scoring_product_release_host_test PRIVATE -fsanitize=address,undefined)
endif()

add_test(NAME scoring_product_release_host_test COMMAND scoring_product_release_host_test)
