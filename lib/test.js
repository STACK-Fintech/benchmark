const debug = require("debug")("benchmark:test");
const debugSilly = require("debug")("benchmark:test:silly");
const exectimer = require("exectimer");
const crypto = require("crypto");
const Tick = exectimer.Tick;
const { EventEmitter } = require("events");

const defaultOptions = {
  iterations: 30, // Default to normal distribution
};

class Test extends EventEmitter {
  /** * A Test, which comprises one or more Steps, to be run in a Suite. Tests define the number
   * of iterations of each collection of Steps, and collect statistics on each iteration, and for
   * each Step.
   *
   * @typedef {(function(name: String, options: {}): this) & (function(options: {}): this)} Test
   * @param {String=} options The name of the Test. Can also be specified as options.name.
   * @param {Object} options The options object for configuration.
   * @param {String=} options.name The name of the Test.
   * @param {String=} options.iterations The number of times to run the Test on start.
   * @param {Step[]=} options.steps An array of Step objects to run. All steps will be run
   * in the provided order.
   * @type Test
   */
  constructor(name, options) {
    super();
    // If we only get one parameter, assume it's the options object.
    if (!options) {
      options = name;
      if (typeof options === "string") {
        throw new Error("Test requires an options object!");
      }
      name = options.name || crypto.randomBytes(16).toString("hex");
    }
    this.name = name;
    // Any options not set will be supplied by the default options object.
    this.options = Object.assign({}, defaultOptions, options);
    debugSilly(
      `${this.name}(options): ${JSON.stringify(this.options, null, 2)}`
    );
    this.stats = {};
    this.steps = [];
  }

  /**
   * Add a step or array of steps to this test. Supplied steps will be executed in order.
   * @param {Step|Step[]} steps A Step or Step array that defines what to do for each test.
   */
  add(steps) {
    if (!Array.isArray(steps)) {
      debug(`${this.name}: adding step ${steps.name}`);
      steps = [steps]; // Easier to treat it as an array.
    } else {
      debug(
        `${this.name}: adding steps ${steps
          .map((s) => {
            return s.name;
          })
          .join(", ")}`
      );
    }

    this.steps = this.steps.concat(steps);
  }

  /**
   * Helper function that checks each step to ensure it has all of the required
   * properties to run on start.
   */
  checkSteps() {
    for (let index in this.steps) {
      const step = this.steps[index];
      if (!step.name) {
        throw new Error(
          `${this.name}(Step ${index + 1}): name property not set`
        );
      } else if (!step._fn) {
        throw new Error(`${step.name || "<unnamed>"}: fn not set`);
      }
      // These aren't problems, we just want to debug log them, in case
      // it helps users with configuration.
      if (!step._setup) {
        debug(`${step.name || "<unnamed>"}: setup not set`);
      }
      if (!step._teardown) {
        debug(`${step.name || "<unnamed>"}: teardown not set`);
      }
    }
  }

  /**
   * Run the Test, executing all of the steps repeatedly for
   * the number of iterations configured in this.options.iterations
   *
   * @param {Suite} suite A reference to the parent suite. Allows suite-level listeners to
   * tap into the test run.
   */
  async start(suite) {
    this.emit("start", this.options);
    this.checkSteps();
    for (let i = 0; i < this.options.iterations; i++) {
      const iter = i + 1;
      const cycleContext = {
        index: iter,
        iterations: this.options.iterations,
      };
      suite.emit("cycle", cycleContext);
      this.emit("cycle", cycleContext);
      debug(`${this.name} (run ${iter}): start`);
      for (let step of this.steps) {
        const stepContext = {
          index: iter,
          iterations: this.options.iterations,
          step,
        };
        suite.emit("step", stepContext);
        this.emit("step", stepContext);
        if (step._setup) {
          debugSilly(`${step.name} (run ${iter}): pre-setup`);
          await step._setup();
          debugSilly(`${step.name} (run ${iter}): post-setup`);
        }
        // TODO: Benchmarking needs to happen below here.
        debugSilly(`${step.name}: (run ${iter}): function starting`);
        // Use unique context to prevent aliasing (exectimer-recommended pattern)
        const timer = new Tick(`${step.name}`);
        timer.start();
        await step._fn();
        timer.stop();

        debugSilly(`${step.name}: (run ${iter}): function complete`);
        // TODO: Benchmarking needs to happen above here.
        if (step._teardown) {
          debugSilly(`${step.name}: (run ${iter}): pre-teardown`);
          await step._teardown();
          debugSilly(`${step.name}: (run ${iter}): post-teardown`);
        }
      }
      debug(`${this.name} (run ${iter}): complete`);
    }
    debug(`${this.name}: processing statistics`);
    for (let step of this.steps) {
      const results = this.processStats(exectimer.timers[step.name]);
      this.stats[step.name] = results;
      // Setup an event listener to capture the statistics right away
      // or pull them out of the test object!
    }
    this.emit("complete", this);
  }

  /**
   * Return the stats of the Test run.
   */
  getStats() {
    return this.stats;
  }

  processStats(results) {
    if (!results) {
      return {
        duration: NaN,
        min: NaN,
        max: NaN,
        mean: NaN,
      };
    }

    return {
      duration: results.parse(results.duration()),
      min: results.parse(results.min()),
      max: results.parse(results.max()),
      mean: results.parse(results.mean()),
    };
  }

  /**
   * Takes the stats object and prints it out. Feel free to override this function
   * with your own if you'd like.
   */
  printStats(name, results) {
    console.log(`${name} - Results:`);
    console.log(`Duration:\t${results.duration}`);
    console.log(`Min:\t\t${results.min}`);
    console.log(`Max:\t\t${results.max}`);
    console.log(`Mean:\t\t${results.mean}`);
    console.log(
      "======================================================================"
    );
  }
}

module.exports = Test;
