module.exports = {
  //   files: ["**/*.ts"],
  //   resolvePluginsRelativeTo: __dirname,
  env: {
    commonjs: true,
    es2021: true,
  },
  extends: [
    // require.resolve(`eslint:recommended`),
    // require.resolve(`plugin:@typescript-eslint/recommended`),
  ],
  //   parser: "@typescript-eslint/parser",
  parserOptions: {
    ecmaVersion: 12,
  },
  //   plugins: ["@typescript-eslint"],
  rules: {},
};
