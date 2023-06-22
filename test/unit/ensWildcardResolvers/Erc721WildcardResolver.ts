import { expect } from "chai";
import { deployments, ethers, getNamedAccounts, getUnnamedAccounts } from "hardhat";

import type { Erc721WildcardResolver, TestERC721 } from "../../../types";
import {
  Erc721WildcardResolver__factory,
  IAddrResolver__factory,
  IAddressResolver__factory,
  IPubkeyResolver__factory,
  ITextResolver__factory,
  TestERC721__factory,
} from "../../../types";
import { getSigner } from "../../utils";

export function testErc721WildcardResolver(): void {
  describe.only("Erc721WildcardResolver", function () {
    let resolver: Erc721WildcardResolver;
    let tokenContract: TestERC721;
    let tokenOwner: string;

    const ensParentName = "test.eth";
    const tokenId = 123;
    const fullName = `${tokenId}.${ensParentName}`;
    const fullNameBytes = ethers.utils.dnsEncode(fullName);
    const addrResolverIface = IAddrResolver__factory.createInterface();
    const addressResolverIface = IAddressResolver__factory.createInterface();
    const textResolverIface = ITextResolver__factory.createInterface();

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

      [tokenOwner] = await getUnnamedAccounts();
      await resolver.setTokenContract(ensParentName, tokenContract.address);
      await tokenContract.mint(tokenOwner, tokenId);
    });

    describe("address records", function () {
      it("resolves addr(bytes32 node) records", async function () {
        const data = addrResolverIface.encodeFunctionData("addr", [ethers.utils.namehash(fullName)]);

        const resolveResult = await resolver.resolve(fullNameBytes, data);
        const [addr] = ethers.utils.defaultAbiCoder.decode(["address"], resolveResult);
        expect(addr.toLowerCase()).to.eq(tokenOwner.toLowerCase());
      });

      it("resolves addr(bytes32 node, uint256 coinType) records", async function () {
        const data = addressResolverIface.encodeFunctionData("addr", [
          ethers.utils.namehash(fullName),
          60 /* COINTYPE_ETH */,
        ]);

        const resolveResult = await resolver.resolve(fullNameBytes, data);
        const [addr] = ethers.utils.defaultAbiCoder.decode(["bytes"], resolveResult);
        expect(addr.toLowerCase()).to.eq(tokenOwner.toLowerCase());
      });

      it("returns zero address when subdomain not found", async function () {
        const data = addrResolverIface.encodeFunctionData("addr", [ethers.utils.namehash(fullName)]);

        const name = ethers.utils.dnsEncode(`${tokenId}.unregistered-domain.eth`);

        const resolveResult = await resolver.resolve(name, data);
        const [addr] = ethers.utils.defaultAbiCoder.decode(["address"], resolveResult);
        expect(addr).to.eq(ethers.constants.AddressZero);
      });

      it("returns zero address when token has no owner", async function () {
        const data = addrResolverIface.encodeFunctionData("addr", [ethers.utils.namehash(fullName)]);

        const name = ethers.utils.dnsEncode(`99999.${ensParentName}`);

        const resolveResult = await resolver.resolve(name, data);
        const [addr] = ethers.utils.defaultAbiCoder.decode(["address"], resolveResult);
        expect(addr).to.eq(ethers.constants.AddressZero);
      });

      it("returns zero address malformed token ID", async function () {
        const data = addrResolverIface.encodeFunctionData("addr", [ethers.utils.namehash(fullName)]);

        const name = ethers.utils.dnsEncode(`notAnInteger.${ensParentName}`);

        const resolveResult = await resolver.resolve(name, data);
        const [addr] = ethers.utils.defaultAbiCoder.decode(["address"], resolveResult);
        expect(addr).to.eq(ethers.constants.AddressZero);
      });

      it("returns empty bytes for non-ETH addr() call", async function () {
        const data = addressResolverIface.encodeFunctionData("addr", [
          ethers.utils.namehash(fullName),
          61 /* COINTYPE_ETH_CLASSIC */,
        ]);

        const resolveResult = await resolver.resolve(fullNameBytes, data);
        const [result] = ethers.utils.defaultAbiCoder.decode(["bytes"], resolveResult);
        expect(result).to.eq("0x");
      });
    });

    describe("text records", function () {
      it("resolves avatar URL from token URL", async function () {
        const data = textResolverIface.encodeFunctionData("text", [ethers.utils.namehash(fullName), "avatar"]);
        const resolveResult = await resolver.resolve(fullNameBytes, data);
        const [observed] = ethers.utils.defaultAbiCoder.decode(["string"], resolveResult);

        const expected = `eip155:1/erc721:${tokenContract.address.toLowerCase()}/${tokenId}`;

        expect(observed).to.eq(expected);
      });

      it("returns empty string when subdomain not found", async function () {
        const data = textResolverIface.encodeFunctionData("text", [ethers.utils.namehash(fullName), "avatar"]);

        const name = ethers.utils.dnsEncode(`${tokenId}.unregistered-domain.eth`);

        const resolveResult = await resolver.resolve(name, data);
        const [value] = ethers.utils.defaultAbiCoder.decode(["string"], resolveResult);
        expect(value).to.eq("");
      });

      it("returns empty string when token has no owner", async function () {
        const data = textResolverIface.encodeFunctionData("text", [ethers.utils.namehash(fullName), "avatar"]);

        const name = ethers.utils.dnsEncode(`99999.${ensParentName}`);

        const resolveResult = await resolver.resolve(name, data);
        const [value] = ethers.utils.defaultAbiCoder.decode(["string"], resolveResult);
        expect(value).to.eq("");
      });

      it("returns empty string malformed token ID", async function () {
        const data = textResolverIface.encodeFunctionData("text", [ethers.utils.namehash(fullName), "avatar"]);

        const name = ethers.utils.dnsEncode(`notAnInteger.${ensParentName}`);

        const resolveResult = await resolver.resolve(name, data);
        const [value] = ethers.utils.defaultAbiCoder.decode(["string"], resolveResult);
        expect(value).to.eq("");
      });
    });

    it("reverts for unsupported record lookups", async function () {
      const pubkeyResolverIface = IPubkeyResolver__factory.createInterface();
      const data = pubkeyResolverIface.encodeFunctionData("pubkey", [ethers.utils.namehash(fullName)]);

      const resolveCall = resolver.resolve(fullNameBytes, data);
      await expect(resolveCall).to.be.revertedWithCustomError(resolver, "RecordTypeNotSupported");
    });

    describe("has correct function selector constants", function () {
      it("addr(bytes32 node)", async function () {
        const expected = addrResolverIface.getSighash(addrResolverIface.functions["addr(bytes32)"]);
        const observed = await resolver.RESOLVER_SIGNATURE__ADDR();
        expect(observed).to.eq(expected);
      });

      it("addr(bytes32 node, uint256 cointype)", async function () {
        const expected = addressResolverIface.getSighash(addressResolverIface.functions["addr(bytes32,uint256)"]);
        const observed = await resolver.RESOLVER_SIGNATURE__ADDR_WITH_COINTYPE();
        expect(observed).to.eq(expected);
      });

      it("text(bytes32 node, string key)", async function () {
        const expected = textResolverIface.getSighash(textResolverIface.functions["text(bytes32,string)"]);
        const observed = await resolver.RESOLVER_SIGNATURE__TEXT();
        expect(observed).to.eq(expected);
      });
    });
  });
}
