import { expect } from "chai";

import { asAccount } from "../utils";
import { findTransferSingleEvent } from "../utils/erc1155";

export function testGuildTokenFeatures(): void {
  describe.only("Guild Tokens", function () {
    beforeEach("Setup guild", async function () {
      const { ensGuilds, flatFeePolicy, openAuthPolicy } = this.deployedContracts;
      const { ensNameOwner, domain, admin } = this.guildInfo;

      await this.approveGuildsAsEnsOperator();

      await asAccount(ensNameOwner, async (signer) => {
        // Register guild
        await ensGuilds
          .connect(signer)
          .registerGuild(domain, admin, flatFeePolicy.getAddress(), openAuthPolicy.getAddress());
      });
    });

    it("Minter receives guild token", async function () {
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

    it("Guild admin can set token collection metadata", async function () {
      const { ensGuilds } = this.deployedContracts;
      const { ensNode, admin } = this.guildInfo;
      const { minter } = this.addresses;
      const metadataURI = "https://test-domain.json";

      const tagToMint = "test";

      // claim the tag
      const claimTx = await asAccount(minter, async (signer) => {
        return await ensGuilds.connect(signer).claimGuildTag(ensNode, tagToMint, minter, "0x");
      });

      // guild admin updates metadata URI for their guild's NFTs
      await asAccount(admin, async (signer) => {
        await ensGuilds.connect(signer).setGuildTokenUri(ensNode, metadataURI);
      });

      // look for the event that was logged for the new token mint
      const claimTxReceipt = await claimTx.wait();
      const mintEvent = findTransferSingleEvent(claimTxReceipt?.logs);
      const tokenId = mintEvent.args.id;

      // look up the metadata for that token
      const observedURI = await ensGuilds.uri(tokenId);
      expect(observedURI).to.eq(metadataURI);
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

    it("Tag owner cannot transfer their guild token", async function () {
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
