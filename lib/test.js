const debug = require("debug")("benchmark:test");
const debugSilly = require("debug")("benchmark:test:silly");
const exectimer = require("exectimer");
const crypto = require("crypto");
const Tick = exectimer.Tick;
const { EventEmitter } = require("events");
const Papa = require("papaparse");

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
      }

      if (step._fn ^ step._event) {
        throw new Error(
          `${step.name || "<unnamed>"}: only one of fn and event should be set`
        );
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

    let eventTimers = {};
    let eventCounters = {};
    // Setup timers.
    for (let step of this.steps) {
      if (step._event) {
        eventTimers[step.name] = {};
        eventCounters[step.name] = 0;

        function cb() {
          eventTimers[step.name][eventCounters[step.name]].stop();
          const args = Array.from(arguments);
          if (args[0]) {
            debug(`${step.name}(error): ${args[0]}`);
          }
          debug(
            `${step.name}: (run ${
              eventCounters[step.name]
            }): event emitter complete`
          );
          debugSilly(
            `${step.name}: arguments received: ${JSON.stringify(args, null, 2)}`
          );
        }

        debugSilly(
          `${step.name}: setting up event emitter for "${step._event.eventName}" event`
        );
        // NOTE: Using an anonymous function here mangles the scope required for proper
        // parsing of the "arguments" object into an array!
        step._event.emitter.on(step._event.eventName, function () {
          eventCounters[step.name]++;
          debug(
            `${step.name}: (run ${
              eventCounters[step.name]
            }): event emitter starting`
          );
          const args = Object.values(arguments);
          args.push(cb);
          const tick = new Tick(`${step.name}`);
          eventTimers[step.name][eventCounters[step.name]] = tick;
          tick.start();
          step._event.fn.apply(null, args);
        });
      }
    }

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

        if (step._event) {
          await new Promise((resolve) => {
            const interval = setInterval(() => {
              let count = eventCounters[step.name];
              debugSilly(
                `${step.name}: waiting for events (${count} out of ${iter})`
              );
              if (count >= iter) {
                clearInterval(interval);
                return resolve();
              }
            }, 0);
          });
        }

        if (step._fn) {
          debugSilly(`${step.name}: (run ${iter}): function starting`);
          const tick = new Tick(`${step.name}`);
          tick.start();
          await step._fn();
          tick.stop();
          debugSilly(`${step.name}: (run ${iter}): function complete`);
        }

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
   * Retrieves all of the datapoints generated in the Test's run for a specific Step.
   * @param {Step|String} step The Step object, or its name.
   * @returns {number[]} An array of numbers that represent durations in nanoseconds.
   */
  getStepDataPoints(step) {
    let name = step;
    if (typeof step !== "string") {
      name = step.name;
    }

    return exectimer.timers[name].ticks.map((tick) => {
      return tick.getDiff();
    });
  }

  /**
   * Retrieves all of the datapoints generated during the Test's run, for all Steps.
   * @returns {Array<Object>} An array of objects that follow a format that is parseable by
   * Papa Parse 5:
   * @example
   *
   * ```json
   *{
   *    "fields": ["Column 1", "Column 2"],
   *    "data": [
   *        ["foo", "bar"],
   *        ["abc", "def"]
   *    ]
   *}
   *```
   *
   */
  getDataPoints() {
    const dataPoints = [];
    const stepData = {};
    for (let step of this.steps) {
      stepData[step.name] = this.getStepDataPoints(step.name);
    }
    // TODO: Need something more robust than using the length of the first array.
    const maxLength = stepData[Object.keys(stepData)[0]].length;
    for (let i = 0; i < maxLength; i++) {
      let point = {};
      for (let step of this.steps) {
        point[step.name] = stepData[step.name][i];
      }
      dataPoints.push(point);
    }
    return dataPoints;
  }

  /**
   * Returns all of the datapoints generated during the Test's run, for all Steps, in CSV format.
   * @returns {String} The CSV-formatted output.
   */
  getDataPointsAsCSV() {
    return Papa.unparse(this.getDataPoints());
  }

  /**
   *
   * @param {Object} results The raw data of a Step's runs during a Test.
   * @returns {Object} An object with the parsed results, arranged for easy export.
   * @example
   *
   * ```js
   * // Results Format
   * {
   *    duration: "10.804 s",
   *    min: "108.4 ns",
   *    max: "32.6 ms",
   *    mean: "4.4 ms",
   * }
   * ```
   */
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
