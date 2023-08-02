import { setBalance } from "@nomicfoundation/hardhat-network-helpers";
import { expect } from "chai";
import { AbiCoder, Wallet, ZeroAddress, dnsEncode, namehash, parseEther } from "ethers";
import { deployments, ethers, getNamedAccounts, getUnnamedAccounts } from "hardhat";

import type { ENS, Erc721WildcardResolver, IENSLegacyPublicResolver, TestERC721 } from "../../../types";
import {
  ENS__factory,
  Erc721WildcardResolver__factory,
  IAddrResolver__factory,
  IAddressResolver__factory,
  IENSLegacyPublicResolver__factory,
  IPubkeyResolver__factory,
  ITextResolver__factory,
  TestERC721__factory,
} from "../../../types";
import { ensLabelHash, getReverseName, getReverseRegistrar, resolveAddr, resolveText } from "../../../utils";
import { asAccount } from "../../utils";

export function testErc721WildcardResolver(): void {
  describe("Erc721WildcardResolver", function () {
    let wildcardResolver: Erc721WildcardResolver;
    let tokenContract: TestERC721;
    let tokenOwner: string;
    let ENS: ENS;
    let originalResolver: IENSLegacyPublicResolver;
    let originalNameOwner: string;

    const ensParentName = "nouns.eth";
    const ensParentNode = namehash(ensParentName);
    const tokenId = 123;
    const fullName = `${tokenId}.${ensParentName}`;
    const fullNameBytes = dnsEncode(fullName);
    const addrResolverIface = IAddrResolver__factory.createInterface();
    const addressResolverIface = IAddressResolver__factory.createInterface();
    const textResolverIface = ITextResolver__factory.createInterface();

    beforeEach("setup", async function () {
      await deployments.fixture();
      const { deployer, ensRegistry } = await getNamedAccounts();

      const signer = await ethers.getImpersonatedSigner(deployer);

      const deployment = await deployments.get("Erc721WildcardResolver");
      wildcardResolver = Erc721WildcardResolver__factory.connect(deployment.address, signer);

      const tokenDeployment = await deployments.deploy("TestERC721", {
        from: deployer,
        autoMine: true,
        args: ["TestToken", "TEST"],
      });
      tokenContract = TestERC721__factory.connect(tokenDeployment.address, signer);

      ENS = ENS__factory.connect(ensRegistry, signer);

      originalResolver = IENSLegacyPublicResolver__factory.connect(await ENS.resolver(ensParentNode), ENS.runner);

      // Set our wildcard resolver as the resolver for this ENS name
      originalNameOwner = await ENS.owner(ensParentNode);
      await signer.sendTransaction({ to: originalNameOwner, value: parseEther("1") });
      await asAccount(originalNameOwner, async (signer) => {
        // Owner tells the original resolver to allow the wildcard resolver to set records
        await originalResolver.connect(signer).setAuthorisation(ensParentNode, wildcardResolver.getAddress(), true);

        // Owner tells ENS registry to use wildcard resolver as the new resolver for their name
        await ENS.connect(signer).setResolver(ensParentNode, wildcardResolver.getAddress());

        // Owner configures the wildcard resolver to refer to the TestERC721 contract for resolving wildcards under
        // the owner's parent name
        await wildcardResolver
          .connect(signer)
          .setTokenContract(ensParentName, tokenContract.getAddress(), originalResolver.getAddress());
      });

      [tokenOwner] = await getUnnamedAccounts();
      await tokenContract.mint(tokenOwner, tokenId);
    });

    it("claims its own reverse record", async function () {
      const { ensDefaultResolver } = await getNamedAccounts();
      const wildCardResolverDeployment = await deployments.get("Erc721WildcardResolver");
      const reverseRegistrar = await getReverseRegistrar(ENS);
      const guildSubdomain = `wildcard`;
      const ensDomain = "standard-crypto.eth";
      const guildSubdomainHash = ensLabelHash(guildSubdomain);
      const guildHash = namehash(ensDomain);
      const fullTagName = `${guildSubdomain}.${ensDomain}`;
      const ensNameOwner = await ENS.owner(guildHash);

      await setBalance(ensNameOwner, parseEther("100000000"));
      await setBalance(wildCardResolverDeployment.address, parseEther("100000000"));

      // Set forward record
      await asAccount(ensNameOwner, async (signer) => {
        await ENS.connect(signer).setSubnodeRecord(
          guildHash,
          guildSubdomainHash,
          wildCardResolverDeployment.address,
          ensDefaultResolver,
          0,
        );
      });

      // Set Primary Name
      await asAccount(wildCardResolverDeployment.address, async (signer) => {
        await reverseRegistrar.connect(signer).setNameForAddr(signer, signer, ensDefaultResolver, fullTagName);
      });

      // Lookup the reverse record
      const reverseName = await getReverseName(ENS, wildCardResolverDeployment.address);
      expect(reverseName).to.eq(fullTagName);
    });

    it("implements ENSIP 10 interface", async function () {
      // Source: https://docs.ens.domains/ens-improvement-proposals/ensip-10-wildcard-resolution
      await expect(wildcardResolver.supportsInterface("0x9061b923")).to.eventually.be.true;
    });

    describe("address records", function () {
      it("resolves addr(bytes32 node) records", async function () {
        // Directly invoke the `resolve()` method and check that the result matches what we expect
        const data = addrResolverIface.encodeFunctionData("addr", [namehash(fullName)]);
        const resolveResult = await wildcardResolver.resolve(fullNameBytes, data);
        const [addr] = AbiCoder.defaultAbiCoder().decode(["address"], resolveResult);
        expect(addr.toLowerCase()).to.eq(tokenOwner.toLowerCase());

        // Also use ethers.js to try to resolve this name, checking that we've correctly implemented
        // the standard
        await expect(resolveAddr(ENS, fullName)).to.eventually.eq(tokenOwner);
      });

      it("resolves addr(bytes32 node, uint256 coinType) records", async function () {
        const data = addressResolverIface.encodeFunctionData("addr", [namehash(fullName), 60 /* COINTYPE_ETH */]);

        const resolveResult = await wildcardResolver.resolve(fullNameBytes, data);
        const [addr] = AbiCoder.defaultAbiCoder().decode(["bytes"], resolveResult);
        expect(addr.toLowerCase()).to.eq(tokenOwner.toLowerCase());
      });

      it("returns zero address when subdomain not found", async function () {
        const data = addrResolverIface.encodeFunctionData("addr", [namehash(fullName)]);

        const name = dnsEncode(`${tokenId}.unregistered-domain.eth`);

        const resolveResult = await wildcardResolver.resolve(name, data);
        const [addr] = AbiCoder.defaultAbiCoder().decode(["address"], resolveResult);
        expect(addr).to.eq(ZeroAddress);

        // sanity-check that ethers.js resolver returns null
        await expect(resolveAddr(ENS, name)).to.eventually.be.null;
      });

      it("returns zero address when token has no owner", async function () {
        const data = addrResolverIface.encodeFunctionData("addr", [namehash(fullName)]);

        const name = dnsEncode(`99999.${ensParentName}`);

        const resolveResult = await wildcardResolver.resolve(name, data);
        const [addr] = AbiCoder.defaultAbiCoder().decode(["address"], resolveResult);
        expect(addr).to.eq(ZeroAddress);

        // sanity-check that ethers.js resolver returns null
        await expect(resolveAddr(ENS, name)).to.eventually.be.null;
      });

      it("returns zero address malformed token ID", async function () {
        const data = addrResolverIface.encodeFunctionData("addr", [namehash(fullName)]);

        const name = dnsEncode(`notAnInteger.${ensParentName}`);

        const resolveResult = await wildcardResolver.resolve(name, data);
        const [addr] = AbiCoder.defaultAbiCoder().decode(["address"], resolveResult);
        expect(addr).to.eq(ZeroAddress);

        // sanity-check that ethers.js resolver returns null
        await expect(resolveAddr(ENS, name)).to.eventually.be.null;
      });

      it("returns empty bytes for non-ETH addr() call", async function () {
        const data = addressResolverIface.encodeFunctionData("addr", [
          namehash(fullName),
          61 /* COINTYPE_ETH_CLASSIC */,
        ]);

        const resolveResult = await wildcardResolver.resolve(fullNameBytes, data);
        const [result] = AbiCoder.defaultAbiCoder().decode(["bytes"], resolveResult);
        expect(result).to.eq("0x");
      });
    });

    describe("text records", function () {
      it("resolves avatar URL from token URL", async function () {
        const data = textResolverIface.encodeFunctionData("text", [namehash(fullName), "avatar"]);
        const resolveResult = await wildcardResolver.resolve(fullNameBytes, data);
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
        const resolveResult = await wildcardResolver.resolve(fullNameBytes, data);
        const [observed] = AbiCoder.defaultAbiCoder().decode(["string"], resolveResult);

        expect(observed).to.eq(givenURI);

        // check the above a second time using ethers.js
        await expect(resolveText(ENS, fullName, "url")).to.eventually.eq(givenURI);
      });

      it("returns empty string when subdomain not found", async function () {
        const data = textResolverIface.encodeFunctionData("text", [namehash(fullName), "avatar"]);

        const name = dnsEncode(`${tokenId}.unregistered-domain.eth`);

        const resolveResult = await wildcardResolver.resolve(name, data);
        const [value] = AbiCoder.defaultAbiCoder().decode(["string"], resolveResult);
        expect(value).to.eq("");
      });

      it("returns empty string when token has no owner", async function () {
        const data = textResolverIface.encodeFunctionData("text", [namehash(fullName), "avatar"]);

        const name = dnsEncode(`99999.${ensParentName}`);

        const resolveResult = await wildcardResolver.resolve(name, data);
        const [value] = AbiCoder.defaultAbiCoder().decode(["string"], resolveResult);
        expect(value).to.eq("");

        // check the above a second time using ethers.js
        await expect(resolveText(ENS, name, "avatar")).to.eventually.be.null;
      });

      it("returns empty string malformed token ID", async function () {
        const data = textResolverIface.encodeFunctionData("text", [namehash(fullName), "avatar"]);

        const name = dnsEncode(`notAnInteger.${ensParentName}`);

        const resolveResult = await wildcardResolver.resolve(name, data);
        const [value] = AbiCoder.defaultAbiCoder().decode(["string"], resolveResult);
        expect(value).to.eq("");

        // check the above a second time using ethers.js
        await expect(resolveText(ENS, name, "avatar")).to.eventually.be.null;
      });
    });

    it("reverts for unsupported record lookups", async function () {
      const pubkeyResolverIface = IPubkeyResolver__factory.createInterface();
      const data = pubkeyResolverIface.encodeFunctionData("pubkey", [namehash(fullName)]);

      const resolveCall = wildcardResolver.resolve(fullNameBytes, data);
      await expect(resolveCall).to.be.revertedWithCustomError(wildcardResolver, "RecordTypeNotSupported");
    });

    describe("has correct function selector constants", function () {
      it("addr(bytes32 node)", async function () {
        const expected = addrResolverIface.getFunction("addr").selector;
        const observed = await wildcardResolver.RESOLVER_SIGNATURE__ADDR();
        expect(observed).to.eq(expected);
      });

      it("addr(bytes32 node, uint256 cointype)", async function () {
        const expected = addressResolverIface.getFunction("addr").selector;
        const observed = await wildcardResolver.RESOLVER_SIGNATURE__ADDR_WITH_COINTYPE();
        expect(observed).to.eq(expected);
      });

      it("text(bytes32 node, string key)", async function () {
        const expected = textResolverIface.getFunction("text").selector;
        const observed = await wildcardResolver.RESOLVER_SIGNATURE__TEXT();
        expect(observed).to.eq(expected);
      });
    });

    describe("records on the parent name", function () {
      it("can still set and resolve regular addr records on the parent name", async function () {
        // Lookup an existing record
        await expect(resolveAddr(ENS, ensParentName)).to.eventually.eq("0x0BC3807Ec262cB779b38D65b38158acC3bfedE10");

        // Override existing record
        const newAddrRecordTarget = Wallet.createRandom().address;
        await asAccount(originalNameOwner, async (signer) => {
          await wildcardResolver.connect(signer)["setAddr(bytes32,address)"](ensParentNode, newAddrRecordTarget);
        });
        await expect(resolveAddr(ENS, ensParentName)).to.eventually.eq(newAddrRecordTarget);
      });

      it("can still set and resolve regular text records on the parent name", async function () {
        // Lookup an existing record
        await expect(resolveText(ENS, ensParentName, "snapshot")).to.eventually.eq(
          // cspell: disable-next-line
          "ipns://storage.snapshot.page/registry/0x3c8221321441b08C580506e21899E3fa88943672/nouns.eth",
        );

        // Override existing record
        const newSnapshotUrl = "dummy-snapshot-url";
        await asAccount(originalNameOwner, async (signer) => {
          await wildcardResolver.connect(signer).setText(ensParentNode, "snapshot", newSnapshotUrl);
        });

        // Set a new record
        const url = "https://test.com";
        await asAccount(originalNameOwner, async (signer) => {
          await wildcardResolver.connect(signer).setText(ensParentNode, "url", url);
        });
        await expect(resolveText(ENS, ensParentName, "url")).to.eventually.eq(url);
      });
    });

    describe("authorization", function () {
      it("only owner can set token contract for a name");

      it("owner can set records on the parent name");

      it("delegates can set records on the parent name");

      it("non-owner, non-delegates cannot set records on the parent name");
    });
  });
}
