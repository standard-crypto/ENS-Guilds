import { setBalance } from "@nomicfoundation/hardhat-network-helpers";
import { expect } from "chai";
import { type BytesLike, namehash, parseEther } from "ethers";
import { ethers, getNamedAccounts, getUnnamedAccounts } from "hardhat";

import { type ENS } from "../../types";
import { type NounsToken, NounsToken__factory } from "../../types/ethers-contracts";
import { type NounsAuctionHouse } from "../../types/ethers-contracts/NounsAuctionHouse";
import { NounsAuctionHouse__factory } from "../../types/ethers-contracts/factories/NounsAuctionHouse__factory";
import { ensLabelHash, resolveAddr, resolveText } from "../../utils";
import { asAccount, mineBlockAtTimestamp } from "../utils";

export function testNounsIntegration(): void {
  let nounsDomain: string;
  let nounsHash: BytesLike;
  let nounsDomainOwner: string;
  let ens: ENS;
  let existingTagNode: BytesLike;
  let nounsAuction: NounsAuctionHouse;
  let nounsToken: NounsToken;

  describe("Nouns Integration", function () {
    beforeEach("Set ENSGuilds contract as an ENS manager for the domain", async function () {
      const { nounsAuctionContract, nounsTokenContract } = await getNamedAccounts();
      const { ensGuilds, erc721WildcardResolver, flatFeePolicy, openAuthPolicy, ensRegistry } = this.deployedContracts;
      const { admin } = this.guildInfo;
      const { ensDefaultResolver: ensDefaultResolverAddr } = await getNamedAccounts();

      // Set up nouns domain
      nounsDomain = "nouns.eth";
      nounsHash = namehash(nounsDomain);
      ens = await ethers.getContractAt("ENS", ensRegistry);
      nounsDomainOwner = await ens.owner(namehash(nounsDomain));
      const originalResolver = await ensRegistry.resolver(nounsHash);

      // Set up a subdomain
      const existingTag = "existing";
      const existingTagHash = ensLabelHash(existingTag);
      existingTagNode = namehash(`${existingTag}.${nounsDomain}`);

      await asAccount(nounsDomainOwner, async (signer) => {
        await ensRegistry
          .connect(signer)
          .setSubnodeRecord(nounsHash, existingTagHash, nounsDomainOwner, ensDefaultResolverAddr, 0);
      });

      // Connect to Nouns Token contract and Nouns Auction House contract
      nounsToken = NounsToken__factory.connect(nounsTokenContract, ens.runner);
      nounsAuction = NounsAuctionHouse__factory.connect(nounsAuctionContract, ens.runner);

      // Set up Guild for nouns.eth
      // 1. Name owner sets ENSGuilds contract as an ENS operator
      await asAccount(nounsDomainOwner, async (signer) => {
        await ensRegistry.connect(signer).setApprovalForAll(ensGuilds.getAddress(), true);
      });

      // 2. Name owner registers nouns.eth as a new guild
      // const nounsDomain = "nouns.eth";
      await asAccount(nounsDomainOwner, async (signer) => {
        // Register guild
        await ensGuilds
          .connect(signer)
          .registerGuild(nounsDomain, admin, flatFeePolicy.getAddress(), openAuthPolicy.getAddress());
      });

      // 3. Name owner configures NFTWildcardResolver to resolve nouns.eth names using Nouns token contract
      await asAccount(nounsDomainOwner, async (signer) => {
        await erc721WildcardResolver
          .connect(signer)
          .setTokenContract(nounsDomain, nounsToken.getAddress(), originalResolver);
      });

      // 4. Guild admin registers NFTWildcardResolver as the fallback resolver for the nouns.eth guild
      await asAccount(admin, async (signer) => {
        await ensGuilds.connect(signer).setFallbackResolver(nounsHash, erc721WildcardResolver.getAddress());
      });
    });

    describe("Nouns token ID sub-names", function () {
      it("Are automatically assigned to existing Noun holders", async function () {
        const { ensRegistry } = this.deployedContracts;
        const existingNounId = 0;
        const nounOwner = await nounsToken.ownerOf(existingNounId);

        // Check that 0.nouns.eth resolves to the address of the owner
        const resolvedAddr = await resolveAddr(ensRegistry, `${existingNounId}.${nounsDomain}`);
        expect(resolvedAddr).to.eq(nounOwner);
      });
      it("Automatically follow transfers of Noun ownership", async function () {
        const [minter] = await getUnnamedAccounts();
        const { ensRegistry } = this.deployedContracts;
        const existingNounId = 0;
        const nounOwner = await nounsToken.ownerOf(existingNounId);
        await setBalance(nounOwner, parseEther("100000000"));

        // Transfer the Noun to a new account
        await asAccount(nounOwner, async (signer) => {
          await nounsToken.connect(signer).transferFrom(nounOwner, minter, existingNounId);
        });

        // Check that 0.nouns.eth resolves to the account it was transferred to
        const resolvedAddr = await resolveAddr(ensRegistry, `${existingNounId}.${nounsDomain}`);
        expect(resolvedAddr).to.eq(minter);
      });
      it("Are automatically assigned on auctions of new Nouns", async function () {
        const { ensRegistry } = this.deployedContracts;
        const [minter] = await getUnnamedAccounts();
        const nounsAuctionOwner = await nounsAuction.owner();

        // bid on current auction
        const nounId = (await nounsAuction.auction()).nounId;
        await asAccount(minter, async (signer) => {
          await nounsAuction.connect(signer).createBid(nounId, { value: ethers.parseUnits("100", "ether") });
        });

        // set date to after auction has closed
        const date = new Date();
        date.setDate(date.getDate() + 1);
        await mineBlockAtTimestamp(date);
        await asAccount(nounsAuctionOwner, async (signer) => {
          await nounsAuction.connect(signer).settleCurrentAndCreateNewAuction();
        });

        // Check that [token-id].[guild-name].eth resolves to the account that won the auction
        const resolvedAddr = await resolveAddr(ensRegistry, `${nounId}.${nounsDomain}`);
        expect(resolvedAddr).to.eq(minter);
      });
      it("Cannot be transferred outside of automatically following Nouns transfers", async function () {
        const { ensGuilds } = this.deployedContracts;
        const [tokenOwner, newTokenOwner] = await getUnnamedAccounts();
        const existingNounId = 0;

        // Transferring 0.nouns.eth domain should fail
        await asAccount(tokenOwner, async (signer) => {
          const tx = ensGuilds
            .connect(signer)
            .transferGuildTag(nounsHash, existingNounId.toString(), newTokenOwner, "0x");
          await this.expectRevertedWithCustomError(tx, "TransferUnauthorized");
        });
      });
    });

    describe("Existing nouns.eth ENS records", function () {
      const nounsAddrRecord = "0x0BC3807Ec262cB779b38D65b38158acC3bfedE10";
      const nounsTextRecord =
        // cspell: disable-next-line
        "ipns://storage.snapshot.page/registry/0x3c8221321441b08C580506e21899E3fa88943672/nouns.eth";
      it("Addr record on nouns.eth is preserved", async function () {
        await expect(resolveAddr(ens, nounsDomain)).to.eventually.eq(nounsAddrRecord);
      });
      it("Text record on nouns.eth is preserved", async function () {
        await expect(resolveText(ens, nounsDomain, "snapshot")).to.eventually.eq(nounsTextRecord);
      });
      it("Existing records for nouns.eth sub-names are preserved", async function () {
        const { ensRegistry } = this.deployedContracts;
        const existingSubdomainAddr = await ensRegistry.owner(existingTagNode);
        expect(existingSubdomainAddr).to.eq(nounsDomainOwner);
      });
      it("Name owner can still directly register sub-names", async function () {
        const { ensRegistry } = this.deployedContracts;
        const { ensDefaultResolver: ensDefaultResolverAddr } = await getNamedAccounts();
        const newTag = "new";
        const newTagHash = ensLabelHash(newTag);
        const newTagNode = namehash(`${newTag}.${nounsDomain}`);

        // domain owner can set a new tag in the ENS registry
        await asAccount(nounsDomainOwner, async (signer) => {
          await ensRegistry
            .connect(signer)
            .setSubnodeRecord(nounsHash, newTagHash, nounsDomainOwner, ensDefaultResolverAddr, 0);
        });
        const newSubdomainAddr = await ensRegistry.owner(newTagNode);
        expect(newSubdomainAddr).to.eq(nounsDomainOwner);
      });
      it("Name owner can still update existing sub-names", async function () {
        const { ensRegistry } = this.deployedContracts;
        const { ensDefaultResolver: ensDefaultResolverAddr } = await getNamedAccounts();
        const [subdomainOwner] = await getUnnamedAccounts();

        const newTag = "new";
        const newTagHash = ensLabelHash(newTag);
        const newTagNode = namehash(`${newTag}.${nounsDomain}`);

        // domain owner sets a new tag in the ENS registry
        await asAccount(nounsDomainOwner, async (signer) => {
          await ensRegistry
            .connect(signer)
            .setSubnodeRecord(nounsHash, newTagHash, nounsDomainOwner, ensDefaultResolverAddr, 0);
        });

        // domain owner re-assigns an existing tag in the ENS registry
        await asAccount(nounsDomainOwner, async (signer) => {
          await ensRegistry
            .connect(signer)
            .setSubnodeRecord(nounsHash, newTagHash, subdomainOwner, ensDefaultResolverAddr, 0);
        });
        const newTagOwner = await ensRegistry.owner(newTagNode);
        expect(newTagOwner).to.eq(subdomainOwner);
      });
    });
  });
}
