cmake_minimum_required(VERSION 3.13)
project(novelevolver-sqlite)

set(CMAKE_CXX_STANDARD 20)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

set(SQLITE_ROOT ${CMAKE_CURRENT_SOURCE_DIR}/../cpp)
set(SQLITE_AMALGAMATION ${SQLITE_ROOT}/sqlite/sqlite3.c)
if(NOT EXISTS ${SQLITE_AMALGAMATION})
  message(FATAL_ERROR "Missing ${SQLITE_AMALGAMATION}. Run `bun run sqlite:ensure` (or unset SKIP_SQLITE).")
endif()

add_library(novelevolver-sqlite SHARED
  src/main/cpp/jni-sqlite.cpp
  ${SQLITE_ROOT}/sqlite-engine.cpp
  ${SQLITE_AMALGAMATION}
)

set_source_files_properties(
  ${SQLITE_AMALGAMATION}
  PROPERTIES
    LANGUAGE C
    COMPILE_FLAGS "-w"
)

target_include_directories(novelevolver-sqlite PRIVATE
  ${SQLITE_ROOT}
  ${SQLITE_ROOT}/sqlite
)

target_compile_definitions(novelevolver-sqlite PRIVATE
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

target_compile_options(novelevolver-sqlite PRIVATE
  $<$<COMPILE_LANGUAGE:CXX>:-fexceptions>
)

find_library(LOG_LIB log)
target_link_libraries(novelevolver-sqlite ${LOG_LIB})
