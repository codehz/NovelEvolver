#pragma once

#include <cstdint>
#include <string>
#include <unordered_map>
#include <variant>
#include <vector>

namespace ne_sqlite {

using Blob = std::vector<uint8_t>;
using Value = std::variant<std::nullptr_t, bool, int64_t, double, std::string, Blob>;
using Row = std::unordered_map<std::string, Value>;

struct OpenResult {
  bool ok = false;
  int connectionId = 0;
  std::string error;
};

struct ExecuteResult {
  bool ok = false;
  std::vector<Row> rows;
  int64_t rowsAffected = 0;
  int64_t insertId = 0;
  std::string error;
};

OpenResult openDatabase(const std::string& path, bool readonly);
ExecuteResult execute(int connectionId, const std::string& sql, const std::vector<Value>& params);
void closeDatabase(int connectionId);

} // namespace ne_sqlite
