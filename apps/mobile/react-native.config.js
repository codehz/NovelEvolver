module.exports = {
  // Font files are linked by scripts/link-mobile-fonts.mjs. Keeping the
  // directory in the CLI config documents the shared asset source without
  // invoking the CLI's Android metadata parser for variable fonts.
  assets: ["../../vendor/fonts/native"],
  commands: require("rollipop/commands"),
  project: {
    android: {
      packageName: "com.novelevolver.mobile",
      sourceDir: "./android",
    },
    ios: {
      sourceDir: "./ios",
    },
  },
};
