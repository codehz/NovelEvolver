module.exports = {
  dependency: {
    platforms: {
      android: {
        sourceDir: "./android",
        packageImportPath: "import com.novelevolver.mobilesqlite.NativeSqlitePackage;",
        packageInstance: "new NativeSqlitePackage()",
      },
    },
  },
};
