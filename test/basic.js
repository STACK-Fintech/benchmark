/**
 * Sample suite comparing JavaScript's Math.sqrt function to a
 * classic implementation ported from Quake.
 */

const { Suite, Step, Test } = require("../");

// Based on the fast inverse square root function
// https://en.wikipedia.org/wiki/Fast_inverse_square_root
// Some original comments preserved for humor value
// Designed to try to mimic the original as closely as possible
function Q_rsqrt(number) {
  let i;
  let x2, y;
  const threehalfs = 1.5;

  x2 = number * 0.5;
  y = number;
  //evil floating bit level hacking
  let buf = new ArrayBuffer(4);
  new Float32Array(buf)[0] = number;
  i = new Uint32Array(buf)[0];
  i = 0x5f3759df - (i >> 1); //What the fuck?
  new Uint32Array(buf)[0] = i;
  y = new Float32Array(buf)[0];
  y = y * (threehalfs - x2 * y * y); // 1st iteration
  //  y  = y * ( threehalfs - ( x2 * y * y ) );   // 2nd iteration, this can be removed

  return y;
}

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
  for (let step of test.steps) {
    test.printStats(step.name, test.stats[step.name]);
  }
});

// Run the benchmark!
(async () => {
  await suite.start();
})();
