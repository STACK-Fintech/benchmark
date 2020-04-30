const debug = require("debug")("benchmark:step");
const debugSilly = require("debug")("benchmark:step:silly");

class Step {
  /**
   *
   * @param {String|Object} nameOrObject Either the name of the Step, or a complete object that
   * has a name, setup, teardown and fn property.
   */
  constructor(nameOrObject) {
    if (!nameOrObject) {
      throw new Error("Step must define a name or configuration object");
    } else if (typeof nameOrObject === "string") {
      debug("nameOrObject was String");
      this.name = nameOrObject;
    } else {
      debug("nameOrObject was Object");
      this.name = nameOrObject.name || null;
      this._setup = nameOrObject.setup || null;
      this._event = nameOrObject.event || null;
      this._teardown = nameOrObject.teardown || null;
      this._fn = nameOrObject.fn || null;
      debugSilly(`nameOrObject: ${JSON.stringify(nameOrObject, null, 2)}`);
    }
  }

  setup(func) {
    this._setup = func;
    return this;
  }

  teardown(func) {
    this._teardown = func;
    return this;
  }

  /**
   * Bind a function to run during each cycle that will be benchmarked.
   * Steps may only have one "fn" or one "event", and not both!
   *
   * @param {Function} func The function to call on each cycle.
   */
  fn(func) {
    this._fn = func;
    return this;
  }

  /**
   * Setup an event listener to benchmark on each cycle. Each cycle, the event handler
   * will be setup using the .once function.
   * IMPORTANT: Using "event" will hang the Test loop if no matching event is ever emitted!
   *
   * Steps may only have one "fn" or one "event", and not both!
   *
   * @param {EventEmitter} emitter The emitter object.
   * @param {string} eventName The event to setup the provided function as a listener for.
   * @param {Function} func The function that will handle the event. This function must handle
   * a callback as its last argument.
   */
  event(emitter, eventName, func) {
    this._event = {
      emitter,
      eventName,
      fn: func,
    };
    return this;
  }
}

module.exports = Step;
