import { expect } from "chai";
import { deployments, ethers, getNamedAccounts } from "hardhat";

import { type ENSParentNameTestHelper, ENSParentNameTestHelper__factory } from "../../../types";

export function testENSParentName(): void {
  describe("ENSParentName", function () {
    let parentNameTestHelper: ENSParentNameTestHelper;

    beforeEach("setup", async function () {
      await deployments.fixture();
      const { deployer } = await getNamedAccounts();

      const testHelperDeployment = await deployments.deploy("ENSParentNameTestHelper", {
        from: deployer,
        autoMine: true,
      });
      parentNameTestHelper = ENSParentNameTestHelper__factory.connect(testHelperDeployment.address, ethers.provider);
    });

    async function _test(name: string, expectedChild: string, expectedParent: string): Promise<void> {
      const nameBytes = ethers.utils.toUtf8Bytes(name);
      const [childBytes, parentBytes] = await parentNameTestHelper.splitParentChildNames(nameBytes);
      const parent = ethers.utils.toUtf8String(parentBytes);
      const child = ethers.utils.toUtf8String(childBytes);
      expect(parent).to.eq(expectedParent);
      expect(child).to.eq(expectedChild);
    }

    for (const [name, expectedChild, expectedParent] of [
      ["foo.bar", "foo", "bar"],
      ["one.two.three", "one", "two.three"],
      ["tld", "tld", ""],
      [".", "", ""],
    ]) {
      it(`resolves '${name}' to '${expectedParent}'`, async function () {
        await _test(name, expectedChild, expectedParent);
      });
    }
  });
}
