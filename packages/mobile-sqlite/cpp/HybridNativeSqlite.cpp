#include "HybridNativeSqlite.hpp"

#include "sqlite-engine.hpp"

#include <NitroModules/HybridObjectRegistry.hpp>

#include <cstdint>
#include <cstring>
#include <filesystem>
#include <memory>
#include <stdexcept>
#include <string>
#include <unordered_map>
#include <utility>
#include <variant>
#include <vector>

namespace margelo::nitro::mobilesqlite {
namespace {

using NitroSqlValue = std::variant<nitro::NullType, bool, std::shared_ptr<ArrayBuffer>, std::string, double>;

ne_sqlite::Value toEngineValue(const NitroSqlValue& value) {
  if (std::holds_alternative<nitro::NullType>(value)) {
    return nullptr;
  }
  if (std::holds_alternative<bool>(value)) {
    return std::get<bool>(value);
  }
  if (std::holds_alternative<std::string>(value)) {
    return std::get<std::string>(value);
  }
  if (std::holds_alternative<double>(value)) {
    return std::get<double>(value);
  }
  const auto& buffer = std::get<std::shared_ptr<ArrayBuffer>>(value);
  if (buffer == nullptr) {
    return nullptr;
  }
  const size_t size = buffer->size();
  const uint8_t* data = buffer->data();
  ne_sqlite::Blob blob(size);
  if (size > 0 && data != nullptr) {
    std::memcpy(blob.data(), data, size);
  }
  return blob;
}

NitroSqlValue toNitroValue(const ne_sqlite::Value& value) {
  if (std::holds_alternative<std::nullptr_t>(value)) {
    return NullType::null;
  }
  if (std::holds_alternative<bool>(value)) {
    return std::get<bool>(value);
  }
  if (std::holds_alternative<int64_t>(value)) {
    return static_cast<double>(std::get<int64_t>(value));
  }
  if (std::holds_alternative<double>(value)) {
    return std::get<double>(value);
  }
  if (std::holds_alternative<std::string>(value)) {
    return std::get<std::string>(value);
  }
  const ne_sqlite::Blob& blob = std::get<ne_sqlite::Blob>(value);
  if (blob.empty()) {
    return ArrayBuffer::allocate(0);
  }
  return ArrayBuffer::copy(blob);
}

} // namespace

std::string HybridNativeSqlite::resolvePath(const std::string& name, const std::string& location) {
  if (name == ":memory:") {
    return name;
  }
  if (platform_ == nullptr) {
    platform_ = std::dynamic_pointer_cast<HybridNativeSqlitePlatformSpec>(
        HybridObjectRegistry::createHybridObject("NativeSqlitePlatform"));
    if (platform_ == nullptr) {
      throw std::runtime_error("NativeSqlitePlatform is unavailable");
    }
  }
  std::filesystem::path directory = platform_->getBaseDirectory();
  if (!location.empty()) {
    directory /= location;
  }
  std::error_code error;
  std::filesystem::create_directories(directory, error);
  if (error) {
    throw std::runtime_error("Unable to create SQLite directory: " + directory.string());
  }
  return (directory / name).string();
}

double HybridNativeSqlite::open(const std::string& name, const std::string& location, bool readonly) {
  const auto result = ne_sqlite::openDatabase(resolvePath(name, location), readonly);
  if (!result.ok) {
    throw std::runtime_error(result.error);
  }
  return static_cast<double>(result.connectionId);
}

QueryResult HybridNativeSqlite::execute(
    double connectionId,
    const std::string& sql,
    const std::vector<std::variant<nitro::NullType, bool, std::shared_ptr<ArrayBuffer>, std::string, double>>& params) {
  std::vector<ne_sqlite::Value> engineParams;
  engineParams.reserve(params.size());
  for (const auto& param : params) {
    engineParams.push_back(toEngineValue(param));
  }
  const auto result = ne_sqlite::execute(static_cast<int>(connectionId), sql, engineParams);
  if (!result.ok) {
    throw std::runtime_error(result.error);
  }
  std::vector<std::unordered_map<std::string, NitroSqlValue>> rows;
  rows.reserve(result.rows.size());
  for (const auto& row : result.rows) {
    std::unordered_map<std::string, NitroSqlValue> mapped;
    mapped.reserve(row.size());
    for (const auto& [column, value] : row) {
      mapped.emplace(column, toNitroValue(value));
    }
    rows.push_back(std::move(mapped));
  }
  return QueryResult(
      std::move(rows),
      static_cast<double>(result.rowsAffected),
      static_cast<double>(result.insertId));
}

void HybridNativeSqlite::close(double connectionId) {
  ne_sqlite::closeDatabase(static_cast<int>(connectionId));
}

} // namespace margelo::nitro::mobilesqlite
