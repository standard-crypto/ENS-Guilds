import { expect } from "chai";
import dnsPacket from "dns-packet";
import { dnsEncode, toUtf8String } from "ethers";
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
      const nameEncoded = dnsEncode(name);
      const [childBytes, parentBytes] = await parentNameTestHelper.splitParentChildNames(nameEncoded);
      const parent = dnsPacket.name.decode(Buffer.from(parentBytes.slice(2), "hex"));
      const child = toUtf8String(childBytes);
      expect(parent).to.eq(expectedParent);
      expect(child).to.eq(expectedChild);
    }

    for (const [name, expectedChild, expectedParent] of [
      ["foo.bar", "foo", "bar"],
      ["one.two.three", "one", "two.three"],
      ["tld", "tld", "."],
    ]) {
      it(`resolves '${name}' to '${expectedParent}'`, async function () {
        await _test(name, expectedChild, expectedParent);
      });
    }
  });
}
