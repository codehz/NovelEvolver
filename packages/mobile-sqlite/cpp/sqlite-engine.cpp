#include "sqlite-engine.hpp"

#include "sqlite3.h"

#include <cmath>
#include <cstring>
#include <limits>
#include <map>
#include <mutex>
#include <stdexcept>
#include <string>
#include <utility>

// Bundled SQLite amalgamation from sqlite.manifest.json (downloaded, not the OS library).

namespace ne_sqlite {
namespace {

constexpr char kEmptyBlob = 0;
constexpr double kInt64MinAsDouble = static_cast<double>(std::numeric_limits<int64_t>::min());
constexpr double kInt64UpperBoundAsDouble = -kInt64MinAsDouble;

std::mutex gMutex;
std::map<int, sqlite3*> gConnections;
int gNextId = 1;
bool gInitialized = false;

[[noreturn]] void fail(const std::string& message) {
  throw std::runtime_error(message);
}

void ensureInitialized() {
  if (gInitialized) {
    return;
  }
  if (sqlite3_initialize() != SQLITE_OK) {
    fail("Failed to initialize SQLite");
  }
  gInitialized = true;
}

sqlite3* requireConnection(int connectionId) {
  auto it = gConnections.find(connectionId);
  if (it == gConnections.end()) {
    fail("Database is closed");
  }
  return it->second;
}

void bindValue(sqlite3_stmt* statement, int index, const Value& value) {
  if (std::holds_alternative<std::nullptr_t>(value)) {
    sqlite3_bind_null(statement, index);
  } else if (std::holds_alternative<bool>(value)) {
    sqlite3_bind_int(statement, index, std::get<bool>(value) ? 1 : 0);
  } else if (std::holds_alternative<int64_t>(value)) {
    sqlite3_bind_int64(statement, index, std::get<int64_t>(value));
  } else if (std::holds_alternative<double>(value)) {
    const double number = std::get<double>(value);
    if (std::trunc(number) == number && number >= kInt64MinAsDouble && number < kInt64UpperBoundAsDouble) {
      sqlite3_bind_int64(statement, index, static_cast<sqlite3_int64>(number));
    } else {
      sqlite3_bind_double(statement, index, number);
    }
  } else if (std::holds_alternative<std::string>(value)) {
    const std::string& text = std::get<std::string>(value);
    sqlite3_bind_text(statement, index, text.c_str(), static_cast<int>(text.size()), SQLITE_TRANSIENT);
  } else {
    const Blob& blob = std::get<Blob>(value);
    const void* data = blob.data();
    const int size = static_cast<int>(blob.size());
    // sqlite3_bind_blob(NULL, ...) is always SQL NULL, even when n == 0.
    // Empty vectors typically have a null data pointer.
    if (size == 0) {
      data = &kEmptyBlob;
    }
    sqlite3_bind_blob(statement, index, data, size, SQLITE_TRANSIENT);
  }
}

Value readColumn(sqlite3_stmt* statement, int column) {
  switch (sqlite3_column_type(statement, column)) {
    case SQLITE_INTEGER:
      return static_cast<int64_t>(sqlite3_column_int64(statement, column));
    case SQLITE_FLOAT:
      return sqlite3_column_double(statement, column);
    case SQLITE_TEXT: {
      const unsigned char* text = sqlite3_column_text(statement, column);
      const int size = sqlite3_column_bytes(statement, column);
      if (text == nullptr) {
        return std::string();
      }
      return std::string(reinterpret_cast<const char*>(text), static_cast<size_t>(size));
    }
    case SQLITE_BLOB: {
      const int size = sqlite3_column_bytes(statement, column);
      const void* blob = sqlite3_column_blob(statement, column);
      Blob bytes(static_cast<size_t>(size));
      if (size > 0 && blob != nullptr) {
        std::memcpy(bytes.data(), blob, static_cast<size_t>(size));
      }
      return bytes;
    }
    case SQLITE_NULL:
    default:
      return nullptr;
  }
}

int openFlags(bool readonly, bool memory) {
  int flags = SQLITE_OPEN_FULLMUTEX;
  if (memory) {
    flags |= SQLITE_OPEN_READWRITE | SQLITE_OPEN_CREATE | SQLITE_OPEN_MEMORY;
  } else if (readonly) {
    flags |= SQLITE_OPEN_READONLY;
  } else {
    flags |= SQLITE_OPEN_READWRITE | SQLITE_OPEN_CREATE;
  }
  return flags;
}

} // namespace

OpenResult openDatabase(const std::string& path, bool readonly) {
  std::lock_guard<std::mutex> lock(gMutex);
  try {
    ensureInitialized();
    sqlite3* db = nullptr;
    const bool memory = path == ":memory:";
    const int status = sqlite3_open_v2(path.c_str(), &db, openFlags(readonly, memory), nullptr);
    if (status != SQLITE_OK) {
      const std::string message = db == nullptr ? sqlite3_errstr(status) : sqlite3_errmsg(db);
      if (db != nullptr) {
        sqlite3_close_v2(db);
      }
      return {.ok = false, .connectionId = 0, .error = message};
    }
    const int id = gNextId++;
    gConnections[id] = db;
    return {.ok = true, .connectionId = id, .error = {}};
  } catch (const std::exception& error) {
    return {.ok = false, .connectionId = 0, .error = error.what()};
  }
}

ExecuteResult execute(int connectionId, const std::string& sql, const std::vector<Value>& params) {
  std::lock_guard<std::mutex> lock(gMutex);
  sqlite3_stmt* statement = nullptr;
  try {
    sqlite3* db = requireConnection(connectionId);
    const int prepareStatus = sqlite3_prepare_v2(db, sql.c_str(), -1, &statement, nullptr);
    if (prepareStatus != SQLITE_OK) {
      fail(sqlite3_errmsg(db));
    }
    for (size_t index = 0; index < params.size(); index += 1) {
      bindValue(statement, static_cast<int>(index + 1), params[index]);
    }

    std::vector<Row> rows;
    while (true) {
      const int step = sqlite3_step(statement);
      if (step == SQLITE_DONE) {
        break;
      }
      if (step != SQLITE_ROW) {
        fail(sqlite3_errmsg(db));
      }
      Row row;
      const int columns = sqlite3_column_count(statement);
      for (int column = 0; column < columns; column += 1) {
        const char* name = sqlite3_column_name(statement, column);
        row.emplace(name == nullptr ? "" : name, readColumn(statement, column));
      }
      rows.push_back(std::move(row));
    }
    const int64_t rowsAffected = sqlite3_changes(db);
    const int64_t insertId = sqlite3_last_insert_rowid(db);
    sqlite3_finalize(statement);
    return {
        .ok = true,
        .rows = std::move(rows),
        .rowsAffected = rowsAffected,
        .insertId = insertId,
        .error = {},
    };
  } catch (const std::exception& error) {
    if (statement != nullptr) {
      sqlite3_finalize(statement);
    }
    return {.ok = false, .rows = {}, .rowsAffected = 0, .insertId = 0, .error = error.what()};
  }
}

void closeDatabase(int connectionId) {
  std::lock_guard<std::mutex> lock(gMutex);
  auto it = gConnections.find(connectionId);
  if (it == gConnections.end()) {
    return;
  }
  sqlite3_close_v2(it->second);
  gConnections.erase(it);
}

} // namespace ne_sqlite
