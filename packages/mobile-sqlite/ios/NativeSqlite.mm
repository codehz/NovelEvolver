#import "NativeSqlite.h"

#import <Foundation/Foundation.h>

#include "sqlite-engine.hpp"

#include <memory>
#include <string>

@implementation NativeSqlite

+ (NSString *)moduleName
{
  return @"NativeSqlite";
}

static std::string toUtf8(NSString *value)
{
  if (value == nil) {
    return {};
  }
  const char *chars = [value UTF8String];
  return chars == nullptr ? std::string() : std::string(chars);
}

static NSString *fromUtf8(const std::string &value)
{
  return [[NSString alloc] initWithBytes:value.data()
                                  length:value.size()
                                encoding:NSUTF8StringEncoding];
}

static NSString *resolvePath(NSString *name, NSString *location)
{
  if ([name isEqualToString:@":memory:"]) {
    return name;
  }
  NSString *root = NSSearchPathForDirectoriesInDomains(NSDocumentDirectory, NSUserDomainMask, YES).firstObject;
  NSString *directory = location.length == 0 ? root : [root stringByAppendingPathComponent:location];
  NSError *error = nil;
  BOOL created = [[NSFileManager defaultManager] createDirectoryAtPath:directory
                                           withIntermediateDirectories:YES
                                                            attributes:nil
                                                                 error:&error];
  if (!created && error != nil) {
    @throw [NSException exceptionWithName:@"SQLiteError"
                                   reason:error.localizedDescription
                                 userInfo:nil];
  }
  return [directory stringByAppendingPathComponent:name];
}

- (NSNumber *)open:(NSString *)name location:(NSString *)location readonly:(BOOL)readonly
{
  const auto result = ne_sqlite::openDatabase(toUtf8(resolvePath(name, location)), readonly);
  if (!result.ok) {
    @throw [NSException exceptionWithName:@"SQLiteError" reason:fromUtf8(result.error) userInfo:nil];
  }
  return @(result.connectionId);
}

- (NSString *)execute:(double)connectionId sql:(NSString *)sql paramsJson:(NSString *)paramsJson
{
  const auto result = ne_sqlite::execute(static_cast<int>(connectionId), toUtf8(sql), toUtf8(paramsJson));
  if (!result.ok) {
    @throw [NSException exceptionWithName:@"SQLiteError" reason:fromUtf8(result.error) userInfo:nil];
  }
  return fromUtf8(result.json);
}

- (void)close:(double)connectionId
{
  ne_sqlite::closeDatabase(static_cast<int>(connectionId));
}

- (std::shared_ptr<facebook::react::TurboModule>)getTurboModule:
  (const facebook::react::ObjCTurboModule::InitParams &)params
{
  return std::make_shared<facebook::react::NativeSqliteSpecJSI>(params);
}

@end
