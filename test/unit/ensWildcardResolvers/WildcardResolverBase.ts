import { type HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { expect } from "chai";
import { Wallet, namehash, parseEther } from "ethers";
import { ethers, getNamedAccounts } from "hardhat";

import { type ENS, ENS__factory, type StubWildcardResolverBase } from "../../../types";
import { resolveAddr, resolveText } from "../../../utils";
import { asAccount } from "../../utils";

export function testWildcardResolverBase(): void {
  describe("WildcardResolverBase", function () {
    describe("wildcard passthrough", function () {
      let signer: HardhatEthersSigner;
      const ensParentName = "test.eth";
      const ensParentNode = namehash(ensParentName);
      const ensChildLabel = "sub-name";
      const ensChildNode = namehash(`${ensChildLabel}.${ensParentName}`);
      let ENS: ENS;

      beforeEach(async function () {
        const { deployer, ensRegistry } = await getNamedAccounts();
        signer = await ethers.getSigner(deployer);
        ENS = ENS__factory.connect(ensRegistry, signer);
      });

      async function deployStub(passthroughTarget: Promise<string>): Promise<StubWildcardResolverBase> {
        const { deployer, ensRegistry, ensNameWrapper } = await getNamedAccounts();
        const signer = await ethers.getSigner(deployer);
        const stub = await ethers.deployContract("StubWildcardResolverBase", [ensRegistry, ensNameWrapper], signer);
        await stub.setPassthroughTarget(ensParentName, passthroughTarget);

        // Owner tells ENS registry to use wildcard resolver as the new resolver for their name
        const originalNameOwner = await ENS.owner(ensParentNode);
        await signer.sendTransaction({ to: originalNameOwner, value: parseEther("1") });
        await asAccount(originalNameOwner, async (signer) => {
          await ENS.connect(signer).setResolver(ensParentNode, stub.getAddress());
        });

        return stub;
      }

      it("resolves a parent address from a passthrough target that implements `addr(node)`", async function () {
        const mockAddrResolver = await ethers.deployContract("MockAddrResolver", signer);
        await deployStub(mockAddrResolver.getAddress());

        // No record at first
        await expect(resolveAddr(ENS, ensParentName)).to.eventually.be.null;

        // Set a record on the passthrough target
        const addrRecordTarget = Wallet.createRandom().address;
        await mockAddrResolver["setAddr(bytes32,address)"](ensParentNode, addrRecordTarget);

        // Check for presence of that record
        await expect(resolveAddr(ENS, ensParentName)).to.eventually.eq(addrRecordTarget);
      });

      it("resolves a parent address from a passthrough target that implements `addr(node, coinType)`", async function () {
        const mockAddressResolver = await ethers.deployContract("MockAddressResolver", signer);
        await deployStub(mockAddressResolver.getAddress());

        // No record at first
        await expect(resolveAddr(ENS, ensParentName)).to.eventually.be.null;

        // Set a record on the passthrough target
        const addrRecordTarget = Wallet.createRandom().address;
        await mockAddressResolver["setAddr(bytes32,address)"](ensParentNode, addrRecordTarget);

        // Check for presence of that record
        await expect(resolveAddr(ENS, ensParentName)).to.eventually.eq(addrRecordTarget);
      });

      it("resolves a parent address from a passthrough target that implements `resolve()`", async function () {
        const mockWildcardResolver = await ethers.deployContract("MockWildcardResolver", signer);
        await deployStub(mockWildcardResolver.getAddress());

        // No record at first
        await expect(resolveAddr(ENS, ensParentName)).to.eventually.be.null;

        // Set a record on the passthrough target
        const addrRecordTarget = Wallet.createRandom().address;
        await mockWildcardResolver.setAddr(ensParentNode, addrRecordTarget);

        // Check for presence of that record
        await expect(resolveAddr(ENS, ensParentName)).to.eventually.eq(addrRecordTarget);
      });

      it("resolves a child address from a passthrough target that implements `resolve()`", async function () {
        const mockWildcardResolver = await ethers.deployContract("MockWildcardResolver", signer);
        await deployStub(mockWildcardResolver.getAddress());

        // No record at first
        await expect(resolveAddr(ENS, `${ensChildLabel}.${ensParentName}`)).to.eventually.be.null;

        // Set a record on the passthrough target
        const addrRecordTarget = Wallet.createRandom().address;
        await mockWildcardResolver.setAddr(ensChildNode, addrRecordTarget);

        // Check for presence of that record
        await expect(resolveAddr(ENS, `${ensChildLabel}.${ensParentName}`)).to.eventually.eq(addrRecordTarget);
      });

      it("resolves a parent text record from a passthrough target that implements `text()`", async function () {
        const mockTextResolver = await ethers.deployContract("MockTextResolver", signer);
        await deployStub(mockTextResolver.getAddress());
        const dummyUrl = "https://example.com";

        // No record at first
        await expect(resolveText(ENS, ensParentName, "url")).to.eventually.eq("");

        // Set a record on the passthrough target
        await mockTextResolver.setText(ensParentNode, "url", dummyUrl);

        // Check for presence of that record
        await expect(resolveText(ENS, ensParentName, "url")).to.eventually.eq(dummyUrl);
      });

      it("resolves a parent text record from a passthrough target that implements `resolve()`", async function () {
        const mockWildcardResolver = await ethers.deployContract("MockWildcardResolver", signer);
        await deployStub(mockWildcardResolver.getAddress());
        const dummyUrl = "https://example.com";

        // No record at first
        await expect(resolveText(ENS, ensParentName, "url")).to.eventually.eq("");

        // Set a record on the passthrough target
        await mockWildcardResolver.setText(ensParentNode, "url", dummyUrl);

        // Check for presence of that record
        await expect(resolveText(ENS, ensParentName, "url")).to.eventually.eq(dummyUrl);
      });

      it("resolves a child text record from a passthrough target that implements `resolve()`", async function () {
        const mockWildcardResolver = await ethers.deployContract("MockWildcardResolver", signer);
        await deployStub(mockWildcardResolver.getAddress());
        const dummyUrl = "https://example.com";

        // No record at first
        await expect(resolveText(ENS, `${ensChildLabel}.${ensParentName}`, "url")).to.eventually.eq("");

        // Set a record on the passthrough target
        await mockWildcardResolver.setText(ensChildNode, "url", dummyUrl);

        // Check for presence of that record
        await expect(resolveText(ENS, `${ensChildLabel}.${ensParentName}`, "url")).to.eventually.eq(dummyUrl);
      });
    });
  });
}
