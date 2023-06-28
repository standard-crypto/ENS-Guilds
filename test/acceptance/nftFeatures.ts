import { expect } from "chai";

import { asAccount } from "../utils";
import { findTransferSingleEvent } from "../utils/erc1155";

export function testNFTFeatures(): void {
  describe("NFT Features", function () {
    beforeEach("Setup guild", async function () {
      const { ensRegistry, ensGuilds, flatFeePolicy, openAuthPolicy } = this.deployedContracts;
      const { ensNameOwner, ensNode, admin } = this.guildInfo;

      await asAccount(ensNameOwner, async (signer) => {
        // Set ENSGuilds contract as an approved operator
        await ensRegistry.connect(signer).setApprovalForAll(ensGuilds.getAddress(), true);
        // Register guild
        await ensGuilds
          .connect(signer)
          .registerGuild(ensNode, admin, flatFeePolicy.getAddress(), openAuthPolicy.getAddress());
      });
    });

    it("Minter receives guild tag NFT", async function () {
      const { ensGuilds } = this.deployedContracts;
      const { ensNode } = this.guildInfo;
      const { minter } = this.addresses;

      const tagToMint = "test";

      // claim the tag
      const claimTx = await asAccount(minter, async (signer) => {
        return await ensGuilds.connect(signer).claimGuildTag(ensNode, tagToMint, minter, "0x");
      });

      // look for the event that was logged for the new token mint
      const claimTxReceipt = await claimTx.wait();
      const mintEvent = findTransferSingleEvent(claimTxReceipt?.logs);
      expect(mintEvent.args.to).to.eq(minter);

      // from the event, get the tokenID that was minted, and sanity-check that the token
      // contract says the minter owns that token
      const tokenId = mintEvent.args.id;
      const tokenBalance = await ensGuilds.balanceOf(minter, tokenId);
      expect(tokenBalance).eq(1n);
    });

    it("Guild admin can set NFT collection metadata", async function () {
      const { ensGuilds } = this.deployedContracts;
      const { ensNode, admin } = this.guildInfo;
      const { minter } = this.addresses;
      const metadataURITemplate = "https://test-domain/{id}.json";

      const tagToMint = "test";

      // claim the tag
      const claimTx = await asAccount(minter, async (signer) => {
        return await ensGuilds.connect(signer).claimGuildTag(ensNode, tagToMint, minter, "0x");
      });

      // guild admin updates metadata URI for their guild's NFTs
      await asAccount(admin, async (signer) => {
        await ensGuilds.connect(signer).setGuildTokenUriTemplate(ensNode, metadataURITemplate);
      });

      // look for the event that was logged for the new token mint
      const claimTxReceipt = await claimTx.wait();
      const mintEvent = findTransferSingleEvent(claimTxReceipt?.logs);
      const tokenId = mintEvent.args.id;

      // look up the metadata for that token
      const observedURI = await ensGuilds.uri(tokenId);
      expect(observedURI).to.eq(metadataURITemplate);
    });

    it("ENSGuilds supports ERC1155 and ERC1155Metadata_URI interface", async function () {
      const { ensGuilds } = this.deployedContracts;

      // ERC1155
      // https://eips.ethereum.org/EIPS/eip-1155#specification
      await expect(ensGuilds.supportsInterface("0xd9b67a26")).to.eventually.be.true;

      // ERC1155Metadata_URI
      // https://eips.ethereum.org/EIPS/eip-1155#metadata
      await expect(ensGuilds.supportsInterface("0x0e89341c")).to.eventually.be.true;
    });

    it("Tag owner cannot transfer their tag NFT", async function () {
      const { ensGuilds } = this.deployedContracts;
      const { ensNode } = this.guildInfo;
      const { minter, unauthorizedThirdParty } = this.addresses;

      const tagToMint = "test";

      // claim the tag
      const claimTx = await asAccount(minter, async (signer) => {
        return await ensGuilds.connect(signer).claimGuildTag(ensNode, tagToMint, minter, "0x");
      });

      // look for the event that was logged for the new token mint
      const claimTxReceipt = await claimTx.wait();
      const mintEvent = findTransferSingleEvent(claimTxReceipt?.logs);
      const tokenId = mintEvent.args.id;

      // attempt to transfer the token
      await asAccount(minter, async (signer) => {
        const tx = ensGuilds.connect(signer).safeTransferFrom(minter, unauthorizedThirdParty, tokenId, 1, "0x");
        await this.expectRevertedWithCustomError(tx, "GuildsTokenTransferNotAllowed");
      });
    });
  });
}
