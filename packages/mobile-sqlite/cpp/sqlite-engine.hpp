#pragma once

#include <cstdint>
#include <string>

namespace ne_sqlite {

struct OpenResult {
  bool ok = false;
  int connectionId = 0;
  std::string error;
};

struct ExecuteResult {
  bool ok = false;
  std::string json;
  std::string error;
};

OpenResult openDatabase(const std::string& path, bool readonly);
ExecuteResult execute(int connectionId, const std::string& sql, const std::string& paramsJson);
void closeDatabase(int connectionId);

} // namespace ne_sqlite
