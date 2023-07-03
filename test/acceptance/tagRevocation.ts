import { expect } from "chai";
import { ZeroAddress, namehash } from "ethers";
import { deployments, getNamedAccounts } from "hardhat";

import { type RevocationTestHelper, RevocationTestHelper__factory } from "../../types";
import { ensLabelHash, resolveAddr } from "../../utils";
import { asAccount } from "../utils";
import { findTransferSingleEvent } from "../utils/erc1155";

export function testTagRevocation(): void {
  describe("Tag Revocation", function () {
    let revocationTestHelper: RevocationTestHelper;

    beforeEach("Setup guild", async function () {
      const { ensRegistry, ensGuilds, flatFeePolicy } = this.deployedContracts;
      const { ensNameOwner, ensNode, admin } = this.guildInfo;
      const { deploy } = deployments;
      const { deployer } = await getNamedAccounts();
      const revocationTestHelperDeployment = await deploy("RevocationTestHelper", {
        from: deployer,
        autoMine: true,
      });
      revocationTestHelper = RevocationTestHelper__factory.connect(
        revocationTestHelperDeployment.address,
        ensRegistry.runner,
      );

      await asAccount(ensNameOwner, async (signer) => {
        // Set ENSGuilds contract as an approved operator
        await ensRegistry.connect(signer).setApprovalForAll(ensGuilds.getAddress(), true);
        // Register guild
        await ensGuilds
          .connect(signer)
          .registerGuild(ensNode, admin, flatFeePolicy.getAddress(), revocationTestHelperDeployment.address);
      });
    });

    it("A revoked guild tag appears as un-registered in ENS", async function () {
      const { ensGuilds, ensRegistry } = this.deployedContracts;
      const { ensNode, domain } = this.guildInfo;
      const { minter, unauthorizedThirdParty: revokingParty } = this.addresses;

      // first, mint a tag
      const tagToMint = "test";
      const tagFullDomain = `${tagToMint}.${domain}`;
      const tagEnsNode = namehash(`${tagToMint}.${domain}`);
      await asAccount(minter, async (signer) => {
        await ensGuilds.connect(signer).claimGuildTag(ensNode, tagToMint, minter, "0x");
      });

      // sanity-check the ENS resolution
      await expect(resolveAddr(ensRegistry, tagFullDomain)).to.eventually.eq(minter);

      // now revoke the tag
      await asAccount(revokingParty, async (signer) => {
        await ensGuilds.connect(signer).revokeGuildTag(ensNode, tagToMint, "0x");
      });

      // ENS resolution should be reset
      await expect(resolveAddr(ensRegistry, tagFullDomain)).to.eventually.be.null;
      await expect(ensRegistry.owner(tagEnsNode)).to.eventually.eq(ZeroAddress);
    });

    it("Revoked guild tag also revokes NFT ownership", async function () {
      const { ensGuilds } = this.deployedContracts;
      const { ensNode } = this.guildInfo;
      const { minter, unauthorizedThirdParty: revokingParty } = this.addresses;

      // mint a tag and grab the corresponding NFT
      const tagToMint = "test";
      const claimTx = await asAccount(minter, async (signer) => {
        return await ensGuilds.connect(signer).claimGuildTag(ensNode, tagToMint, minter, "0x");
      });
      const claimTxReceipt = await claimTx.wait();
      const mintEvent = findTransferSingleEvent(claimTxReceipt?.logs);
      const tokenId = mintEvent.args.id;

      // revoke the tag
      await asAccount(revokingParty, async (signer) => {
        await ensGuilds.connect(signer).revokeGuildTag(ensNode, tagToMint, "0x");
      });

      // minter should no longer own that NFT
      const tokenBalance = await ensGuilds.balanceOf(minter, tokenId);
      expect(tokenBalance).eq(0n);
    });

    it("Revoked guild tag can be minted again at a later time", async function () {
      const { ensGuilds, ensRegistry } = this.deployedContracts;
      const { ensNode, domain } = this.guildInfo;
      const { minter: minter1, unauthorizedThirdParty: minter2 } = this.addresses;

      // mint a tag
      const tagToMint = "test";
      await asAccount(minter1, async (signer) => {
        await ensGuilds.connect(signer).claimGuildTag(ensNode, tagToMint, minter1, "0x");
      });

      // revoke the tag
      await asAccount(minter1, async (signer) => {
        await ensGuilds.connect(signer).revokeGuildTag(ensNode, tagToMint, "0x");
      });

      // mint the same tag again from a different EOA
      await asAccount(minter2, async (signer) => {
        await ensGuilds.connect(signer).claimGuildTag(ensNode, tagToMint, minter2, "0x");
      });

      await expect(resolveAddr(ensRegistry, `test.${domain}`)).to.eventually.eq(minter2);
    });

    it("Minting a new tag might revoke an existing one if the auth policy says so", async function () {
      const { ensGuilds, ensRegistry } = this.deployedContracts;
      const { ensNode, domain } = this.guildInfo;
      const { minter: minter1, unauthorizedThirdParty: minter2 } = this.addresses;

      // mint a tag
      const firstTagToMint = "first";
      await asAccount(minter1, async (signer) => {
        await ensGuilds.connect(signer).claimGuildTag(ensNode, firstTagToMint, minter1, "0x");
      });

      // configure the stub Auth Policy to have the next mint trigger a revocation of the mint prior
      await asAccount(minter1, async (signer) => {
        await revocationTestHelper.connect(signer).stub_onTagClaimedReturnVal(firstTagToMint);
      });

      // mint a new tag
      const secondTagToMint = "second";
      await asAccount(minter2, async (signer) => {
        await ensGuilds.connect(signer).claimGuildTag(ensNode, secondTagToMint, minter2, "0x");
      });

      // check that the first tag got revoked
      await expect(resolveAddr(ensRegistry, `${firstTagToMint}.${domain}`)).to.eventually.be.null;

      // sanity-check second tag is still OK
      await expect(resolveAddr(ensRegistry, `${secondTagToMint}.${domain}`)).to.eventually.eq(minter2);
    });

    it("Tags of a registered guild cannot be revoked if the auth policy does not permit it", async function () {
      const { ensGuilds } = this.deployedContracts;
      const { ensNode } = this.guildInfo;
      const { minter } = this.addresses;

      const tagToMint = "first";
      await asAccount(minter, async (signer) => {
        // mint a tag
        await ensGuilds.connect(signer).claimGuildTag(ensNode, tagToMint, minter, "0x");

        // stub: canRevoke == false
        await revocationTestHelper.connect(signer).stub_tagCanBeRevokedReturnVal(false);

        // attempt to revoke should fail
        const tx = ensGuilds.connect(signer).revokeGuildTag(ensNode, tagToMint, minter);
        await this.expectRevertedWithCustomError(tx, "RevokeUnauthorized");

        // stub: canRevoke == true
        await revocationTestHelper.connect(signer).stub_tagCanBeRevokedReturnVal(true);

        // attempt to revoke should succeed
        await ensGuilds.connect(signer).revokeGuildTag(ensNode, tagToMint, minter);
      });
    });

    it("Nonexistent guild tags cannot be revoked", async function () {
      const { ensGuilds } = this.deployedContracts;
      const { ensNode } = this.guildInfo;
      const { minter } = this.addresses;

      const tagToMint = "first";
      await asAccount(minter, async (signer) => {
        // mint a tag
        await ensGuilds.connect(signer).claimGuildTag(ensNode, tagToMint, minter, "0x");

        // attempt to revoke some other, unrelated tag
        const tx = ensGuilds.connect(signer).revokeGuildTag(ensNode, "something-else", minter);
        await this.expectRevertedWithCustomError(tx, "RevokeUnauthorized");
      });
    });

    it("Subdomains that were created independently of the guild tag process cannot be revoked", async function () {
      const { ensRegistry, ensGuilds } = this.deployedContracts;
      const { ensNameOwner, ensNode } = this.guildInfo;
      const { ensDefaultResolver: ensDefaultResolverAddr } = await getNamedAccounts();
      const { minter } = this.addresses;

      const tagToMint = "test";

      // the domain owner registers a subdomain outside the guilds process
      await asAccount(ensNameOwner, async (signer) => {
        await ensRegistry
          .connect(signer)
          .setSubnodeRecord(ensNode, ensLabelHash(tagToMint), ensNameOwner, ensDefaultResolverAddr, 0);
      });

      // verify that subdomain cannot be revoked
      await asAccount(minter, async (signer) => {
        const tx = ensGuilds.connect(signer).revokeGuildTag(ensNode, tagToMint, "0x");
        await this.expectRevertedWithCustomError(tx, "RevokeUnauthorized");
      });
    });

    it("Multiple subdomains may be revoked in batch", async function () {
      const { ensGuilds } = this.deployedContracts;
      const { ensNode } = this.guildInfo;
      const { minter: minter1, unauthorizedThirdParty: minter2 } = this.addresses;

      const tag1 = "test1";
      const tag2 = "test2";

      // claim both tags
      await asAccount(minter1, async (signer) => {
        await ensGuilds.connect(signer).claimGuildTagsBatch(ensNode, [tag1, tag2], [minter1, minter2], ["0x", "0x"]);
      });

      // revoke both tags
      await asAccount(minter1, async (signer) => {
        await ensGuilds.connect(signer).revokeGuildTagsBatch(ensNode, [tag1, tag2], ["0x", "0x"]);
      });

      await expect(ensGuilds.tagOwner(ensNode, ensLabelHash(tag1))).to.eventually.eq(ZeroAddress);
      await expect(ensGuilds.tagOwner(ensNode, ensLabelHash(tag2))).to.eventually.eq(ZeroAddress);
    });
  });
}
