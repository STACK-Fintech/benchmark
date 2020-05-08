/**
 * Sample suite comparing JavaScript's Math.sqrt function to a
 * classic implementation ported from Quake.
 */

const { Suite, Step, Test } = require("../");
const { Q_rsqrt } = require("./lib");

/**
 * Benchmark setup
 */

const suite = new Suite("Math");
const test = new Test({
  name: "sqrt",
  iterations: 1000,
});

// Create Steps
let sqrtValue;
const standardImplementation = new Step("Math.sqrt");

standardImplementation.setup(() => {
  sqrtValue = Math.round(Math.random() * 1000);
});

standardImplementation.fn(() => {
  Math.sqrt(sqrtValue);
});
test.add(standardImplementation);

const newImplementation = new Step("Q_rsqrt");

newImplementation.setup(() => {
  sqrtValue = Math.round(Math.random() * 1000);
});

newImplementation.fn(() => {
  Q_rsqrt(sqrtValue);
});
test.add(newImplementation);

suite.add(test);

test.on("complete", () => {
  console.log("Raw CSV:");
  console.log("");
  console.log(test.getDataPointsAsCSV());
});

// Run the benchmark!
(async () => {
  await suite.start();
})();
