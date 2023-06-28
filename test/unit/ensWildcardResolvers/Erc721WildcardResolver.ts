import { expect } from "chai";
import { AbiCoder, ZeroAddress, dnsEncode, namehash, parseEther } from "ethers";
import { deployments, getNamedAccounts, getUnnamedAccounts } from "hardhat";

import type { ENS, Erc721WildcardResolver, TestERC721 } from "../../../types";
import {
  ENS__factory,
  Erc721WildcardResolver__factory,
  IAddrResolver__factory,
  IAddressResolver__factory,
  IPubkeyResolver__factory,
  ITextResolver__factory,
  TestERC721__factory,
} from "../../../types";
import { resolveName, resolveText } from "../../../utils";
import { asAccount, getSigner } from "../../utils";

export function testErc721WildcardResolver(): void {
  describe("Erc721WildcardResolver", function () {
    let resolver: Erc721WildcardResolver;
    let tokenContract: TestERC721;
    let tokenOwner: string;
    let ENS: ENS;

    const ensParentName = "test.eth";
    const tokenId = 123;
    const fullName = `${tokenId}.${ensParentName}`;
    const fullNameBytes = dnsEncode(fullName);
    const addrResolverIface = IAddrResolver__factory.createInterface();
    const addressResolverIface = IAddressResolver__factory.createInterface();
    const textResolverIface = ITextResolver__factory.createInterface();

    beforeEach("setup", async function () {
      await deployments.fixture();
      const { deployer, ensDefaultResolver, ensRegistry, ensNameWrapper } = await getNamedAccounts();

      const signer = await getSigner(deployer);

      const deployment = await deployments.deploy("Erc721WildcardResolver", {
        from: deployer,
        autoMine: true,
        args: [deployer /* owner */, ensRegistry /* _ens */, ensNameWrapper /* wrapperAddress */],
      });
      resolver = Erc721WildcardResolver__factory.connect(deployment.address, signer);

      const tokenDeployment = await deployments.deploy("TestERC721", {
        from: deployer,
        autoMine: true,
        args: ["TestToken", "TEST"],
      });
      tokenContract = TestERC721__factory.connect(tokenDeployment.address, signer);

      ENS = ENS__factory.connect(ensRegistry, signer);

      // Set our wildcard resolver as the resolver for this ENS name
      const nameOwner = await ENS.owner(namehash(ensParentName));
      await signer.sendTransaction({ to: nameOwner, value: parseEther("1") });
      await asAccount(nameOwner, async (signer) => {
        await ENS.connect(signer).setResolver(namehash(ensParentName), resolver.getAddress());
      });

      [tokenOwner] = await getUnnamedAccounts();
      await resolver.setTokenContract(ensParentName, await tokenContract.getAddress(), ensDefaultResolver);
      await tokenContract.mint(tokenOwner, tokenId);
    });

    it("implements ENSIP 10 interface", async function () {
      // Source: https://docs.ens.domains/ens-improvement-proposals/ensip-10-wildcard-resolution
      await expect(resolver.supportsInterface("0x9061b923")).to.eventually.be.true;
    });

    describe("address records", function () {
      it("resolves addr(bytes32 node) records", async function () {
        // Directly invoke the `resolve()` method and check that the result matches what we expect
        const data = addrResolverIface.encodeFunctionData("addr", [namehash(fullName)]);
        const resolveResult = await resolver.resolve(fullNameBytes, data);
        const [addr] = AbiCoder.defaultAbiCoder().decode(["address"], resolveResult);
        expect(addr.toLowerCase()).to.eq(tokenOwner.toLowerCase());

        // Also use ethers.js to try to resolve this name, checking that we've correctly implemented
        // the standard
        await expect(resolveName(ENS, fullName)).to.eventually.eq(tokenOwner);
      });

      it("resolves addr(bytes32 node, uint256 coinType) records", async function () {
        const data = addressResolverIface.encodeFunctionData("addr", [namehash(fullName), 60 /* COINTYPE_ETH */]);

        const resolveResult = await resolver.resolve(fullNameBytes, data);
        const [addr] = AbiCoder.defaultAbiCoder().decode(["bytes"], resolveResult);
        expect(addr.toLowerCase()).to.eq(tokenOwner.toLowerCase());
      });

      it("returns zero address when subdomain not found", async function () {
        const data = addrResolverIface.encodeFunctionData("addr", [namehash(fullName)]);

        const name = dnsEncode(`${tokenId}.unregistered-domain.eth`);

        const resolveResult = await resolver.resolve(name, data);
        const [addr] = AbiCoder.defaultAbiCoder().decode(["address"], resolveResult);
        expect(addr).to.eq(ZeroAddress);

        // sanity-check that ethers.js resolver returns null
        await expect(resolveName(ENS, name)).to.eventually.be.null;
      });

      it("returns zero address when token has no owner", async function () {
        const data = addrResolverIface.encodeFunctionData("addr", [namehash(fullName)]);

        const name = dnsEncode(`99999.${ensParentName}`);

        const resolveResult = await resolver.resolve(name, data);
        const [addr] = AbiCoder.defaultAbiCoder().decode(["address"], resolveResult);
        expect(addr).to.eq(ZeroAddress);

        // sanity-check that ethers.js resolver returns null
        await expect(resolveName(ENS, name)).to.eventually.be.null;
      });

      it("returns zero address malformed token ID", async function () {
        const data = addrResolverIface.encodeFunctionData("addr", [namehash(fullName)]);

        const name = dnsEncode(`notAnInteger.${ensParentName}`);

        const resolveResult = await resolver.resolve(name, data);
        const [addr] = AbiCoder.defaultAbiCoder().decode(["address"], resolveResult);
        expect(addr).to.eq(ZeroAddress);

        // sanity-check that ethers.js resolver returns null
        await expect(resolveName(ENS, name)).to.eventually.be.null;
      });

      it("returns empty bytes for non-ETH addr() call", async function () {
        const data = addressResolverIface.encodeFunctionData("addr", [
          namehash(fullName),
          61 /* COINTYPE_ETH_CLASSIC */,
        ]);

        const resolveResult = await resolver.resolve(fullNameBytes, data);
        const [result] = AbiCoder.defaultAbiCoder().decode(["bytes"], resolveResult);
        expect(result).to.eq("0x");
      });
    });

    describe("text records", function () {
      it("resolves avatar URL from token URL", async function () {
        const data = textResolverIface.encodeFunctionData("text", [namehash(fullName), "avatar"]);
        const resolveResult = await resolver.resolve(fullNameBytes, data);
        const [observed] = AbiCoder.defaultAbiCoder().decode(["string"], resolveResult);
        const tokenContractAddr = (await tokenContract.getAddress()).toLowerCase();

        const expected = `eip155:1/erc721:${tokenContractAddr}/${tokenId}`;

        expect(observed).to.eq(expected);

        // check the above a second time using ethers.js
        await expect(resolveText(ENS, fullName, "avatar")).to.eventually.eq(expected);
      });

      it("resolves token URIs for url records", async function () {
        const givenURI = `https://example.com/${tokenId}`;
        await tokenContract.setTokenURI(tokenId, givenURI);

        const data = textResolverIface.encodeFunctionData("text", [namehash(fullName), "url"]);
        const resolveResult = await resolver.resolve(fullNameBytes, data);
        const [observed] = AbiCoder.defaultAbiCoder().decode(["string"], resolveResult);

        expect(observed).to.eq(givenURI);

        // check the above a second time using ethers.js
        await expect(resolveText(ENS, fullName, "url")).to.eventually.eq(givenURI);
      });

      it("returns empty string when subdomain not found", async function () {
        const data = textResolverIface.encodeFunctionData("text", [namehash(fullName), "avatar"]);

        const name = dnsEncode(`${tokenId}.unregistered-domain.eth`);

        const resolveResult = await resolver.resolve(name, data);
        const [value] = AbiCoder.defaultAbiCoder().decode(["string"], resolveResult);
        expect(value).to.eq("");
      });

      it("returns empty string when token has no owner", async function () {
        const data = textResolverIface.encodeFunctionData("text", [namehash(fullName), "avatar"]);

        const name = dnsEncode(`99999.${ensParentName}`);

        const resolveResult = await resolver.resolve(name, data);
        const [value] = AbiCoder.defaultAbiCoder().decode(["string"], resolveResult);
        expect(value).to.eq("");

        // check the above a second time using ethers.js
        await expect(resolveText(ENS, name, "avatar")).to.eventually.be.null;
      });

      it("returns empty string malformed token ID", async function () {
        const data = textResolverIface.encodeFunctionData("text", [namehash(fullName), "avatar"]);

        const name = dnsEncode(`notAnInteger.${ensParentName}`);

        const resolveResult = await resolver.resolve(name, data);
        const [value] = AbiCoder.defaultAbiCoder().decode(["string"], resolveResult);
        expect(value).to.eq("");

        // check the above a second time using ethers.js
        await expect(resolveText(ENS, name, "avatar")).to.eventually.be.null;
      });
    });

    it("reverts for unsupported record lookups", async function () {
      const pubkeyResolverIface = IPubkeyResolver__factory.createInterface();
      const data = pubkeyResolverIface.encodeFunctionData("pubkey", [namehash(fullName)]);

      const resolveCall = resolver.resolve(fullNameBytes, data);
      await expect(resolveCall).to.be.revertedWithCustomError(resolver, "RecordTypeNotSupported");
    });

    describe("has correct function selector constants", function () {
      it("addr(bytes32 node)", async function () {
        const expected = addrResolverIface.getFunction("addr").selector;
        const observed = await resolver.RESOLVER_SIGNATURE__ADDR();
        expect(observed).to.eq(expected);
      });

      it("addr(bytes32 node, uint256 cointype)", async function () {
        const expected = addressResolverIface.getFunction("addr").selector;
        const observed = await resolver.RESOLVER_SIGNATURE__ADDR_WITH_COINTYPE();
        expect(observed).to.eq(expected);
      });

      it("text(bytes32 node, string key)", async function () {
        const expected = textResolverIface.getFunction("text").selector;
        const observed = await resolver.RESOLVER_SIGNATURE__TEXT();
        expect(observed).to.eq(expected);
      });
    });
  });
}
