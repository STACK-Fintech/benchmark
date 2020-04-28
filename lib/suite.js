const debug = require("debug")("benchmark:suite");
const crypto = require("crypto");
const { EventEmitter } = require("events");

class Suite extends EventEmitter {
  /**
   *
   * @param {string=} name Optional name for the suite.
   */
  constructor(name) {
    super();
    this.name = name || "";
    this.tests = {};
    this.stats = {};
  }

  /**
   *
   * @param {string=} name The name of the Test being added to the suite.
   * @param {Test} test The Test to add to the suite.
   */
  add(name, test) {
    // If we only get one parameter, assume it's the Test object.
    if (!test) {
      test = name;
      name = test.name || crypto.randomBytes(16).toString("hex");
    }
    debug(`${this.name}: adding test ${name}`);
    this.tests[name] = test;
  }

  reset() {
    // TODO: Decide what reset should do for the suite.
  }

  /**
   * Get the named Test object from the suite. If not present, returns null.
   * @param {string} name The name of the test to retrieve.
   */
  test(name) {
    return this.tests[name] || null;
  }

  /**
   * Execute the test suite.
   */
  async start() {
    this.emit("start");
    // TODO: Configuration?
    for (let test of Object.values(this.tests)) {
      console.log(
        `${this.name}: Running "${test.name}" - ${test.options.iterations} iterations`
      );
      console.log(
        `======================================================================`
      );
      await test.start(this); // Run the test.
      debug(`${test.name}: ${require("util").inspect(test, null, 1)}`);
    }
    this.emit("complete");
  }
}

module.exports = Suite;
