module.exports = {
  istanbulReporter: ["html", "lcov"],
  mocha: {
    grep: "@skip-on-coverage", // Find everything with this tag
    invert: true, // Run the grep's inverse set.
  },
  providerOptions: {
    mnemonic: process.env.MNEMONIC,
  },
  skipFiles: ["test"],
};
