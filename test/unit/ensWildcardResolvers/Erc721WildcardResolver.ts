import { expect } from "chai";
import { deployments, ethers, getNamedAccounts, getUnnamedAccounts } from "hardhat";

import {
  type Erc721WildcardResolver,
  Erc721WildcardResolver__factory,
  type TestERC721,
  TestERC721__factory,
} from "../../../types";
import { getSigner } from "../../utils";

export function testErc721WildcardResolver(): void {
  describe("Erc721WildcardResolver", function () {
    let resolver: Erc721WildcardResolver;
    let tokenContract: TestERC721;

    beforeEach("setup", async function () {
      await deployments.fixture();
      const { deployer } = await getNamedAccounts();

      const signer = await getSigner(deployer);

      const deployment = await deployments.deploy("Erc721WildcardResolver", {
        from: deployer,
        autoMine: true,
      });
      resolver = Erc721WildcardResolver__factory.connect(deployment.address, signer);

      const tokenDeployment = await deployments.deploy("TestERC721", {
        from: deployer,
        autoMine: true,
        args: ["TestToken", "TEST"],
      });
      tokenContract = TestERC721__factory.connect(tokenDeployment.address, signer);
    });

    it("resolve - happy path", async function () {
      const ensParentName = "test.eth";
      const [tokenOwner] = await getUnnamedAccounts();
      const tokenId = 123;

      await resolver.setTokenContract(ensParentName, tokenContract.address);
      await tokenContract.mint(tokenOwner, tokenId);

      const fullNameBytes = ethers.utils.dnsEncode(`${tokenId}.${ensParentName}`);

      const resolveResult = await resolver.resolve(fullNameBytes, []);
      const [addr] = ethers.utils.defaultAbiCoder.decode(["address"], resolveResult);
      expect(addr.toLowerCase()).to.eq(tokenOwner.toLowerCase());
    });
  });
}
