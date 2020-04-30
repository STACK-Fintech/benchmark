# benchmark

A simple framework for benchmarking your functions.

## Install

`npm i --save @stack-fintech/benchmark`

## Usage

This example should give you everything you need to setup your own benchmarks!

```js
// The benchmark tools are comprised of these three classes:
const { Suite, Step, Test } = require("@stack-fintech/benchmark");

const crypto = require("crypto"); // Not always required, just for this example.
const Widget = require("./lib/widget"); // Some example thing you're testing.

// Suites take a collection of Tests and run them in the order they're added to the Suite.
const suite = new Suite("YourSuite");

/*
  Tests run a collection of Steps, for a given number of iterations, and produce
  statistics for each Step.

  Each iteration runs all of the Steps once, in the order they're added to the Test.
*/
const test = new Test({
  name: "widget-flow",
  iterations: 10000,
});

// Steps require a name for tracking statistics.
const makeWidget = new Step("makeWidget");

// The setup and teardown functions let you prep and cleanup before a Step runs,
// without that overhead contaminating your benchmark data.
let widgetName;
let createdWidget;

makeWidget.setup(() => {
  // Generate a random name for the widget.
  widgetName = crypto.randomBytes(16).toString("hex");
});

makeWidget.teardown(() => {
  // If you need to clean something up, you'd do it here.
});

// You can give the function handler sync or async functions.
makeWidget.fn(async () => {
  createdWidget = await Widget.create(widgetName);
});

// You can use event handlers instead if your code is event-driven.
// Note that you must:
// - make sure the event is being emitted, otherwise your Test will
// hang.
// - accept a callback as the last parameter of your handler function
// and call it when finished.
makeWidget.event(Widget, "ordered", (cb) => {
  Widget.create(widgetName)
    .then(() => {
      return cb();
    })
    .catch((err) => {
      return cb(err);
    });
});

// Steps can also be created with object definitions.

// Note: You still need to use the Step constructor, as the Test class
// expects certain properties for validation.
const shipWidget = new Step({
  name: "shipWidget",
  fn: () => {
    Widget.ship(createdWidget);
  },
});

// Assemble your test
test.add(makeWidget);
test.add(shipWidget);

// And then assemble your suite.
suite.add(test);

/*
  Suites and Tests are EventEmitters, and you can hook into them!
  
  Tests:
    start:    When Test.start is called. Provides the callback with the Test's
              options object as a parameter.
    cycle:    At the top of each iteration, before any of the steps run. Provides
              the callback with a context object that has an index (the current
              iteration), and the maximum number of iterations:
              (ex. { index: 4, iterations: 10000 })
    step:     Before each step in a cycle. Provides the callback with a context
              object that has an index (the current iteration), the maximum
              number of iterations, and the Step object.
              (ex. { index: 4, iterations: 10000, step: { ... } })
    complete: At the end of the test run. Provides the callback with a copy of
              the Test itself.
  Suites:
    start:    When Suite.start is called.
    cycle:    Identical to the "cycle" event for Tests. Useful for applying the
              same function calls to multiple test runs.
    step:     Identical to the "step" event for Tests. Again, useful if you
              want to run the same function on every Step of multiple Tests.
    complete: At the end of Suite.start, when all Tests have finished.
 */

test.on("cycle", (context) => {
  // These event emitters are *very* useful for adding your own progress tracking,
  // like progress bars, spinners, etc.
  console.log(`Run ${context.index} of ${context.iterations}`);
});

test.on("complete", () => {
  for (let step of test.steps) {
    // Test provides a printStats function you can use to print the results to stdout.
    test.printStats(step.name, test.stats[step.name]);
    // Alternatively, you can access the test.stats object and roll your own!
  }
});

(async () => {
  await suite.start(); // And that's how you do it!
})();
```
