import { type Context } from "mocha";

import { expectDefined } from "../utils";
import "./type-annotations";

export function setTestUsesEnsNameWrapper(this: Context, usingNameWrapper: boolean): void {
  for (let test = this.test?.parent; test?.root !== true; test = test?.parent) {
    expectDefined(test);
    test.ctx.usingNameWrapper = usingNameWrapper;
  }
}
