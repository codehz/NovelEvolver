require "json"

package = JSON.parse(File.read(File.join(__dir__, "package.json")))

sqlite_flags = %w[
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
].join(" ")

Pod::Spec.new do |s|
  s.name         = "NovelEvolverMobileSqlite"
  s.version      = package["version"]
  s.summary      = package["description"]
  s.homepage     = "https://github.com/codehz/NovelEvolver"
  s.license      = "UNLICENSED"
  s.authors      = "NovelEvolver"
  s.platforms    = { :ios => min_ios_version_supported }
  s.source       = { :git => "https://github.com/codehz/NovelEvolver.git", :tag => s.version }
  s.source_files = "ios/**/*.{h,m,mm,cpp}", "cpp/**/*.{h,hpp,c,cpp}"
  s.public_header_files = "ios/**/*.h"
  s.prepare_command = "node scripts/ensure-sqlite.mjs"
  s.pod_target_xcconfig = {
    "CLANG_CXX_LANGUAGE_STANDARD" => "c++20",
    "CLANG_CXX_LIBRARY" => "libc++",
    "GCC_PREPROCESSOR_DEFINITIONS" => "$(inherited) #{sqlite_flags}",
    "WARNING_CFLAGS" => "-Wno-shorten-64-to-32 -Wno-comma -Wno-unreachable-code -Wno-conditional-uninitialized",
    "HEADER_SEARCH_PATHS" => "\"$(PODS_TARGET_SRCROOT)/cpp\" \"$(PODS_TARGET_SRCROOT)/cpp/sqlite\"",
  }
  s.compiler_flags = "-DSQLITE_DQS=0"

  install_modules_dependencies(s)
end
