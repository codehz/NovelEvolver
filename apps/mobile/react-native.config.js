module.exports = {
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
