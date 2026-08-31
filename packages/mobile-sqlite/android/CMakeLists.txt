project(NovelEvolverMobileSqlite)
cmake_minimum_required(VERSION 3.13)

set(PACKAGE_NAME NovelEvolverMobileSqlite)
set(CMAKE_VERBOSE_MAKEFILE ON)
set(CMAKE_CXX_STANDARD 20)

set(SQLITE_ROOT ${CMAKE_CURRENT_SOURCE_DIR}/../cpp)
set(SQLITE_AMALGAMATION ${SQLITE_ROOT}/sqlite/sqlite3.c)
if(NOT EXISTS ${SQLITE_AMALGAMATION})
  message(FATAL_ERROR "Missing ${SQLITE_AMALGAMATION}. Run `bun run sqlite:ensure` (or unset SKIP_SQLITE).")
endif()

add_library(${PACKAGE_NAME} SHARED
  src/main/cpp/cpp-adapter.cpp
  ${SQLITE_ROOT}/HybridNativeSqlite.cpp
  ${SQLITE_ROOT}/sqlite-engine.cpp
  ${SQLITE_AMALGAMATION}
)

set_source_files_properties(
  ${SQLITE_AMALGAMATION}
  PROPERTIES
    LANGUAGE C
    COMPILE_FLAGS "-w"
)

include(${CMAKE_SOURCE_DIR}/../nitrogen/generated/android/NovelEvolverMobileSqlite+autolinking.cmake)

include_directories(
  "src/main/cpp"
  ${SQLITE_ROOT}
  ${SQLITE_ROOT}/sqlite
)

target_compile_definitions(${PACKAGE_NAME} PRIVATE
  SQLITE_DQS=0
  SQLITE_THREADSAFE=1
  SQLITE_DEFAULT_MEMSTATUS=0
  SQLITE_DEFAULT_WAL_SYNCHRONOUS=1
  SQLITE_LIKE_DOESNT_MATCH_BLOBS=1
  SQLITE_MAX_EXPR_DEPTH=0
  SQLITE_OMIT_DEPRECATED=1
  SQLITE_OMIT_PROGRESS_CALLBACK=1
  SQLITE_OMIT_SHARED_CACHE=1
  SQLITE_OMIT_LOAD_EXTENSION=1
  SQLITE_USE_ALLOCA=1
)

target_compile_options(${PACKAGE_NAME} PRIVATE
  $<$<COMPILE_LANGUAGE:CXX>:-fexceptions -frtti>
)

find_library(LOG_LIB log)
target_link_libraries(
  ${PACKAGE_NAME}
  ${LOG_LIB}
  android
)
