#pragma once

#include "HybridNativeSqlitePlatformSpec.hpp"
#include "HybridNativeSqliteSpec.hpp"

#include <memory>

namespace margelo::nitro::mobilesqlite {

class HybridNativeSqlite final : public HybridNativeSqliteSpec {
public:
  HybridNativeSqlite() : HybridObject(TAG) {}

public:
  double open(const std::string& name, const std::string& location, bool readonly) override;
  QueryResult execute(
      double connectionId,
      const std::string& sql,
      const std::vector<std::variant<nitro::NullType, bool, std::shared_ptr<ArrayBuffer>, std::string, double>>& params) override;
  void close(double connectionId) override;

private:
  std::string resolvePath(const std::string& name, const std::string& location);

  std::shared_ptr<HybridNativeSqlitePlatformSpec> platform_;
};

} // namespace margelo::nitro::mobilesqlite
