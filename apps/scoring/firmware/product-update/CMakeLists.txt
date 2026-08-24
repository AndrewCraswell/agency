cmake_minimum_required(VERSION 3.24)
project(scoring_product_update LANGUAGES C)

enable_testing()
include("${CMAKE_CURRENT_LIST_DIR}/../cmake/ScoringNativePolicies.cmake")
scoring_native_initialize()
option(SCORING_PRODUCT_UPDATE_SANITIZERS "Enable address and undefined-behaviour sanitizers for host tests" OFF)
option(SCORING_ENABLE_LLVM_COVERAGE "Enable LLVM source-based coverage for native host tests" OFF)

if(SCORING_ENABLE_LLVM_COVERAGE)
  scoring_native_enable_llvm_coverage()
endif()

add_library(scoring_product_release STATIC src/scoring_product_release.c)
target_include_directories(scoring_product_release PUBLIC include)

add_executable(scoring_product_release_host_test tests/scoring_product_release_host_test.c)
target_link_libraries(scoring_product_release_host_test PRIVATE scoring_product_release)

foreach(target scoring_product_release scoring_product_release_host_test)
  scoring_native_apply_baseline_warnings(${target})
endforeach()
scoring_native_assert_baseline_warnings(scoring_product_release scoring_product_release_host_test)

if(SCORING_PRODUCT_UPDATE_SANITIZERS AND NOT MSVC)
  target_compile_options(scoring_product_release PRIVATE -fsanitize=address,undefined -fno-omit-frame-pointer)
  target_compile_options(scoring_product_release_host_test PRIVATE -fsanitize=address,undefined -fno-omit-frame-pointer)
  target_link_options(scoring_product_release_host_test PRIVATE -fsanitize=address,undefined)
endif()

add_test(NAME scoring_product_release_host_test COMMAND scoring_product_release_host_test)
