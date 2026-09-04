require "json"

package = JSON.parse(File.read(File.join(__dir__, "package.json")))

Pod::Spec.new do |s|
  s.name         = "NovelEvolverMobileFetch"
  s.version      = package["version"]
  s.summary      = package["description"]
  s.homepage     = "https://github.com/codehz/NovelEvolver"
  s.license      = "UNLICENSED"
  s.authors      = "NovelEvolver"
  s.platforms    = { :ios => min_ios_version_supported }
  s.source       = { :git => "https://github.com/codehz/NovelEvolver.git", :tag => s.version }
  s.source_files = [
    "ios/**/*.{swift}",
    "ios/**/*.{m,mm}",
  ]
  s.pod_target_xcconfig = {
    "CLANG_CXX_LANGUAGE_STANDARD" => "c++20",
    "CLANG_CXX_LIBRARY" => "libc++",
  }

  load "nitrogen/generated/ios/NovelEvolverMobileFetch+autolinking.rb"
  add_nitrogen_files(s)

  s.dependency "React-jsi"
  s.dependency "React-callinvoker"
  install_modules_dependencies(s)
end
