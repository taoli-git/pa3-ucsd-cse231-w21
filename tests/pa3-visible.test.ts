import { PyInt, PyBool, PyNone, NUM, CLASS } from "../utils";
import { assert, asserts, assertPrint, assertTCFail, assertTC, assertFail } from "./utils.test";

describe("PA3 visible tests", () => {
  // 1
  assert("literal-int", `100`, PyInt(100));
});
