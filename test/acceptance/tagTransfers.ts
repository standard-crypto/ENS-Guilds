import { setTestUsesEnsNameWrapper } from "./utils";

export function testTagTransfers(): void {
  describe("Tag Transfers", function () {
    describe("With NameWrapper", function () {
      before(function (this) {
        setTestUsesEnsNameWrapper.bind(this)(true);
      });
      after(function (this) {
        setTestUsesEnsNameWrapper.bind(this)(false);
      });
      _testSuite();
    });

    describe("Without NameWrapper", function () {
      _testSuite();
    });
  });
}

function _testSuite(): void {
  describe("happy path", function () {
    it("updates the ENS forward record");
    it("transfers the corresponding tag NFT");
  });

  it("fails if tag does not exist");

  it("fails if the auth policy does not permit the transfer");
}
