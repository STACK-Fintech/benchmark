const { Suite, Step, Test } = require("../");
const { EventEmitter } = require("events");
const { Q_rsqrt } = require("./lib");
const suite = new Suite("Events");
const test = new Test({
  name: "sqrt",
  iterations: 1000,
});

// Hyper-contrived excuse for an event, but you get the idea...
class EventMath extends EventEmitter {
  constructor() {
    super();
  }
}

const eventMath = new EventMath();

// Create Steps
let sqrtValue;
const standardImplementation = new Step("Math.sqrt");

standardImplementation.setup(() => {
  sqrtValue = Math.round(Math.random() * 1000);
  // This is just to kick off the event, but if your events are triggered by external
  // input, you won't need to do anything like this.
  setImmediate(() => {
    eventMath.emit("Math.sqrt", sqrtValue);
  });
});

standardImplementation.event(eventMath, "Math.sqrt", (num, cb) => {
  Math.sqrt(num);
  cb();
});
test.add(standardImplementation);

const newImplementation = new Step("Q_rsqrt");

newImplementation.setup(() => {
  sqrtValue = Math.round(Math.random() * 1000);
  setImmediate(() => {
    eventMath.emit("Q_rsqrt", sqrtValue);
  });
});

newImplementation.event(eventMath, "Q_rsqrt", (num, cb) => {
  Q_rsqrt(num);
  cb();
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
