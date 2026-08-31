#include "sqlite-engine.hpp"

#include "sqlite3.h"

#include <cmath>
#include <cstdint>
#include <cstdio>
#include <cstring>
#include <limits>
#include <map>
#include <mutex>
#include <optional>
#include <stdexcept>
#include <string>
#include <string_view>
#include <utility>
#include <variant>
#include <vector>

// Bundled SQLite amalgamation from sqlite.manifest.json (downloaded, not the OS library).

namespace ne_sqlite {
namespace {

constexpr char kEmptyBlob = 0;
constexpr double kInt64MinAsDouble = static_cast<double>(std::numeric_limits<int64_t>::min());
constexpr double kInt64UpperBoundAsDouble = -kInt64MinAsDouble;

using Blob = std::vector<uint8_t>;
using Value = std::variant<std::nullptr_t, bool, int64_t, double, std::string, Blob>;

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

// --- base64 ---

constexpr char kBase64Alphabet[] = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

int base64Value(char ch) {
  if (ch >= 'A' && ch <= 'Z') {
    return ch - 'A';
  }
  if (ch >= 'a' && ch <= 'z') {
    return ch - 'a' + 26;
  }
  if (ch >= '0' && ch <= '9') {
    return ch - '0' + 52;
  }
  if (ch == '+') {
    return 62;
  }
  if (ch == '/') {
    return 63;
  }
  return -1;
}

std::string encodeBase64(const uint8_t* data, int size) {
  std::string out;
  out.reserve(static_cast<size_t>((size + 2) / 3 * 4));
  int index = 0;
  while (index < size) {
    const int remaining = size - index;
    const uint8_t first = data[index];
    const uint8_t second = remaining > 1 ? data[index + 1] : 0;
    const uint8_t third = remaining > 2 ? data[index + 2] : 0;
    out.push_back(kBase64Alphabet[first >> 2]);
    out.push_back(kBase64Alphabet[((first & 3) << 4) | (second >> 4)]);
    out.push_back(remaining > 1 ? kBase64Alphabet[((second & 15) << 2) | (third >> 6)] : '=');
    out.push_back(remaining > 2 ? kBase64Alphabet[third & 63] : '=');
    index += 3;
  }
  return out;
}

Blob decodeBase64(std::string_view input) {
  Blob out;
  out.reserve(input.size() / 4 * 3);
  int buffer = 0;
  int bits = 0;
  for (char ch : input) {
    if (ch == '=' || ch == '\n' || ch == '\r' || ch == ' ') {
      continue;
    }
    const int value = base64Value(ch);
    if (value < 0) {
      fail("Invalid base64 blob");
    }
    buffer = (buffer << 6) | value;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      out.push_back(static_cast<uint8_t>((buffer >> bits) & 0xff));
    }
  }
  return out;
}

// --- JSON ---

void appendEscaped(std::string& out, std::string_view value) {
  out.push_back('"');
  for (unsigned char ch : value) {
    switch (ch) {
      case '"':
        out += "\\\"";
        break;
      case '\\':
        out += "\\\\";
        break;
      case '\b':
        out += "\\b";
        break;
      case '\f':
        out += "\\f";
        break;
      case '\n':
        out += "\\n";
        break;
      case '\r':
        out += "\\r";
        break;
      case '\t':
        out += "\\t";
        break;
      default:
        if (ch < 0x20) {
          constexpr char hex[] = "0123456789abcdef";
          out += "\\u00";
          out.push_back(hex[ch >> 4]);
          out.push_back(hex[ch & 0x0f]);
        } else {
          out.push_back(static_cast<char>(ch));
        }
        break;
    }
  }
  out.push_back('"');
}

void appendJsonValue(std::string& out, const Value& value) {
  if (std::holds_alternative<std::nullptr_t>(value)) {
    out += "null";
  } else if (std::holds_alternative<bool>(value)) {
    out += std::get<bool>(value) ? "true" : "false";
  } else if (std::holds_alternative<int64_t>(value)) {
    out += std::to_string(std::get<int64_t>(value));
  } else if (std::holds_alternative<double>(value)) {
    const double number = std::get<double>(value);
    if (!std::isfinite(number)) {
      out += "null";
      return;
    }
    char buffer[64];
    const int length = std::snprintf(buffer, sizeof(buffer), "%.15g", number);
    out.append(buffer, static_cast<size_t>(length));
  } else if (std::holds_alternative<std::string>(value)) {
    appendEscaped(out, std::get<std::string>(value));
  } else {
    const Blob& blob = std::get<Blob>(value);
    out += "{\"$blob\":";
    appendEscaped(out, encodeBase64(blob.data(), static_cast<int>(blob.size())));
    out += "}";
  }
}

class JsonParser {
public:
  explicit JsonParser(std::string_view input) : input_(input) {}

  std::vector<Value> parseArray() {
    skipWs();
    expect('[');
    skipWs();
    std::vector<Value> values;
    if (peek() == ']') {
      advance();
      skipWs();
      return values;
    }
    while (true) {
      values.push_back(parseValue());
      skipWs();
      if (peek() == ',') {
        advance();
        skipWs();
        continue;
      }
      expect(']');
      skipWs();
      return values;
    }
  }

  void finish() {
    skipWs();
    if (index_ != input_.size()) {
      fail("Unexpected trailing JSON");
    }
  }

private:
  std::string_view input_;
  size_t index_ = 0;

  char peek() const {
    return index_ < input_.size() ? input_[index_] : '\0';
  }

  char advance() {
    if (index_ >= input_.size()) {
      fail("Unexpected end of JSON");
    }
    return input_[index_++];
  }

  void skipWs() {
    while (index_ < input_.size()) {
      const char ch = input_[index_];
      if (ch == ' ' || ch == '\n' || ch == '\r' || ch == '\t') {
        index_ += 1;
        continue;
      }
      break;
    }
  }

  void expect(char ch) {
    if (advance() != ch) {
      fail(std::string("Expected '") + ch + "' in JSON");
    }
  }

  bool consume(std::string_view token) {
    if (input_.substr(index_, token.size()) != token) {
      return false;
    }
    index_ += token.size();
    return true;
  }

  Value parseValue() {
    skipWs();
    const char ch = peek();
    if (ch == 'n') {
      if (!consume("null")) {
        fail("Invalid JSON null");
      }
      return nullptr;
    }
    if (ch == 't') {
      if (!consume("true")) {
        fail("Invalid JSON true");
      }
      return true;
    }
    if (ch == 'f') {
      if (!consume("false")) {
        fail("Invalid JSON false");
      }
      return false;
    }
    if (ch == '"') {
      return parseString();
    }
    if (ch == '{') {
      return parseObject();
    }
    if (ch == '-' || (ch >= '0' && ch <= '9')) {
      return parseNumber();
    }
    fail("Invalid JSON value");
  }

  Value parseObject() {
    expect('{');
    skipWs();
    std::optional<std::string> blob;
    if (peek() != '}') {
      while (true) {
        const std::string key = parseString();
        skipWs();
        expect(':');
        skipWs();
        if (key == "$blob") {
          blob = parseString();
        } else {
          (void)parseValue();
        }
        skipWs();
        if (peek() == ',') {
          advance();
          skipWs();
          continue;
        }
        break;
      }
    }
    expect('}');
    if (!blob) {
      fail("JSON object bindings must be { \"$blob\": \"<base64>\" }");
    }
    return decodeBase64(*blob);
  }

  std::string parseString() {
    expect('"');
    std::string out;
    while (true) {
      const char ch = advance();
      if (ch == '"') {
        return out;
      }
      if (ch == '\\') {
        const char escaped = advance();
        switch (escaped) {
          case '"':
          case '\\':
          case '/':
            out.push_back(escaped);
            break;
          case 'b':
            out.push_back('\b');
            break;
          case 'f':
            out.push_back('\f');
            break;
          case 'n':
            out.push_back('\n');
            break;
          case 'r':
            out.push_back('\r');
            break;
          case 't':
            out.push_back('\t');
            break;
          case 'u': {
            unsigned code = 0;
            for (int i = 0; i < 4; i += 1) {
              const char hex = advance();
              code <<= 4;
              if (hex >= '0' && hex <= '9') {
                code += static_cast<unsigned>(hex - '0');
              } else if (hex >= 'a' && hex <= 'f') {
                code += static_cast<unsigned>(hex - 'a' + 10);
              } else if (hex >= 'A' && hex <= 'F') {
                code += static_cast<unsigned>(hex - 'A' + 10);
              } else {
                fail("Invalid JSON unicode escape");
              }
            }
            appendUtf8(out, code);
            break;
          }
          default:
            fail("Invalid JSON escape");
        }
        continue;
      }
      if (static_cast<unsigned char>(ch) < 0x20) {
        fail("Unescaped control character in JSON string");
      }
      out.push_back(ch);
    }
  }

  Value parseNumber() {
    const size_t start = index_;
    if (peek() == '-') {
      advance();
    }
    if (peek() == '0') {
      advance();
    } else if (peek() >= '1' && peek() <= '9') {
      while (peek() >= '0' && peek() <= '9') {
        advance();
      }
    } else {
      fail("Invalid JSON number");
    }
    bool isFloat = false;
    if (peek() == '.') {
      isFloat = true;
      advance();
      if (peek() < '0' || peek() > '9') {
        fail("Invalid JSON number");
      }
      while (peek() >= '0' && peek() <= '9') {
        advance();
      }
    }
    if (peek() == 'e' || peek() == 'E') {
      isFloat = true;
      advance();
      if (peek() == '+' || peek() == '-') {
        advance();
      }
      if (peek() < '0' || peek() > '9') {
        fail("Invalid JSON number");
      }
      while (peek() >= '0' && peek() <= '9') {
        advance();
      }
    }
    const std::string token(input_.substr(start, index_ - start));
    if (isFloat) {
      return std::strtod(token.c_str(), nullptr);
    }
    char* end = nullptr;
    const long long parsed = std::strtoll(token.c_str(), &end, 10);
    return static_cast<int64_t>(parsed);
  }

  static void appendUtf8(std::string& out, unsigned code) {
    if (code <= 0x7f) {
      out.push_back(static_cast<char>(code));
    } else if (code <= 0x7ff) {
      out.push_back(static_cast<char>(0xc0 | (code >> 6)));
      out.push_back(static_cast<char>(0x80 | (code & 0x3f)));
    } else {
      out.push_back(static_cast<char>(0xe0 | (code >> 12)));
      out.push_back(static_cast<char>(0x80 | ((code >> 6) & 0x3f)));
      out.push_back(static_cast<char>(0x80 | (code & 0x3f)));
    }
  }
};

std::vector<Value> parseParams(const std::string& paramsJson) {
  if (paramsJson.empty()) {
    return {};
  }
  JsonParser parser(paramsJson);
  auto values = parser.parseArray();
  parser.finish();
  return values;
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

ExecuteResult execute(int connectionId, const std::string& sql, const std::string& paramsJson) {
  std::lock_guard<std::mutex> lock(gMutex);
  sqlite3_stmt* statement = nullptr;
  try {
    sqlite3* db = requireConnection(connectionId);
    const std::vector<Value> params = parseParams(paramsJson);
    const int prepareStatus = sqlite3_prepare_v2(db, sql.c_str(), -1, &statement, nullptr);
    if (prepareStatus != SQLITE_OK) {
      fail(sqlite3_errmsg(db));
    }
    for (size_t index = 0; index < params.size(); index += 1) {
      bindValue(statement, static_cast<int>(index + 1), params[index]);
    }

    std::string json = "{\"rows\":[";
    bool firstRow = true;
    while (true) {
      const int step = sqlite3_step(statement);
      if (step == SQLITE_DONE) {
        break;
      }
      if (step != SQLITE_ROW) {
        fail(sqlite3_errmsg(db));
      }
      if (!firstRow) {
        json += ",";
      }
      firstRow = false;
      json += "{";
      const int columns = sqlite3_column_count(statement);
      for (int column = 0; column < columns; column += 1) {
        if (column > 0) {
          json += ",";
        }
        const char* name = sqlite3_column_name(statement, column);
        appendEscaped(json, name == nullptr ? "" : name);
        json += ":";
        appendJsonValue(json, readColumn(statement, column));
      }
      json += "}";
    }
    json += "],\"rowsAffected\":";
    json += std::to_string(sqlite3_changes(db));
    json += ",\"insertId\":";
    json += std::to_string(sqlite3_last_insert_rowid(db));
    json += "}";
    sqlite3_finalize(statement);
    return {.ok = true, .json = std::move(json), .error = {}};
  } catch (const std::exception& error) {
    if (statement != nullptr) {
      sqlite3_finalize(statement);
    }
    return {.ok = false, .json = {}, .error = error.what()};
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
