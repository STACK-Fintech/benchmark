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

  fn(func) {
    this._fn = func;
    return this;
  }
}

module.exports = Step;
