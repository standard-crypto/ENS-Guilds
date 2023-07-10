import { expect } from "chai";
import { ZeroAddress } from "ethers";
import { deployments, getNamedAccounts } from "hardhat";

import { ensLabelHash } from "../../utils";
import { asAccount } from "../utils";

export function testMintAuthorization(): void {
  describe("Mint Authorization", function () {
    beforeEach("Set ENSGuilds contract as an ENS manager for the domain", async function () {
      await this.approveGuildsAsEnsOperator();
    });

    it("Domain owner can set authorization policy when registering a new guild", async function () {
      const { ensGuilds, flatFeePolicy, openAuthPolicy } = this.deployedContracts;
      const { ensNameOwner, ensNode, admin } = this.guildInfo;

      await asAccount(ensNameOwner, async (signer) => {
        // Register guild
        await ensGuilds
          .connect(signer)
          .registerGuild(ensNode, admin, flatFeePolicy.getAddress(), openAuthPolicy.getAddress());
      });
    });

    it("User can claim a guild tag if they pass the authz check", async function () {
      const { ensGuilds, flatFeePolicy, allowlistAuthPolicy } = this.deployedContracts;
      const { ensNameOwner, ensNode, admin } = this.guildInfo;
      const { minter } = this.addresses;

      const tagToMint = "test";

      // Register guild
      await asAccount(ensNameOwner, async (signer) => {
        await ensGuilds
          .connect(signer)
          .registerGuild(ensNode, admin, flatFeePolicy.getAddress(), allowlistAuthPolicy.getAddress());
      });

      // Add allowlist entry for the minter
      await asAccount(admin, async (signer) => {
        await allowlistAuthPolicy.connect(signer).allowMint(ensNode, minter);
      });

      // claiming a tag should succeed
      await asAccount(minter, async (signer) => {
        await ensGuilds.connect(signer).claimGuildTag(ensNode, tagToMint, minter, "0x");
      });
    });

    it("Domain owner can't register an nonexistent or invalid contract as the authz policy for a guild", async function () {
      const { ensGuilds, flatFeePolicy } = this.deployedContracts;
      const { ensNameOwner, ensNode, admin } = this.guildInfo;

      await asAccount(ensNameOwner, async (signer) => {
        // Attempt to set zero address as the auth policy should fail
        let tx = ensGuilds.connect(signer).registerGuild(ensNode, admin, flatFeePolicy.getAddress(), ZeroAddress);
        await this.expectRevertedWithCustomError(tx, "InvalidPolicy");

        // Attempt to use an existing contract that doesn't implement AuthPolicy
        tx = ensGuilds
          .connect(signer)
          .registerGuild(ensNode, admin, flatFeePolicy.getAddress(), flatFeePolicy.getAddress());
        await this.expectRevertedWithCustomError(tx, "InvalidPolicy");
        tx = ensGuilds
          .connect(signer)
          .registerGuild(ensNode, admin, flatFeePolicy.getAddress(), ensGuilds.getAddress());
        await this.expectRevertedWithCustomError(tx, "InvalidPolicy");

        // Attempt to use an EOA as the AuthPolicy
        tx = ensGuilds.connect(signer).registerGuild(ensNode, admin, flatFeePolicy.getAddress(), ensNameOwner);
        await this.expectRevertedWithCustomError(tx, "InvalidPolicy");
      });
    });

    it("User cannot circumvent authz via reentrancy attack", async function () {
      const { ensGuilds, flatFeePolicy } = this.deployedContracts;
      const { ensNameOwner, ensNode, admin } = this.guildInfo;
      const { minter } = this.addresses;

      const tagToMint = "test";

      // Deploy a naive AuthPolicy that can trigger a reentrancy attack, along with the attacker itself
      const { deploy } = deployments;
      const { deployer } = await getNamedAccounts();
      const attackerDeployment = await deploy("ClaimGuildTagReentrancyAttacker", {
        from: deployer,
        autoMine: true,
        args: [await ensGuilds.getAddress(), ensNode, tagToMint, minter, "0x"],
      });
      const authPolicyDeployment = await deploy("ReentrancyAttackAuthPolicy", {
        from: deployer,
        autoMine: true,
        args: [attackerDeployment.address],
      });

      // Register our guild with this reentrancy-vulnerable AuthPolicy
      await asAccount(ensNameOwner, async (signer) => {
        // Register guild
        await ensGuilds
          .connect(signer)
          .registerGuild(ensNode, admin, flatFeePolicy.getAddress(), authPolicyDeployment.address);
      });

      // Attempt to claim a tag, indirectly triggering a reentrant call on claimGuildTag
      await asAccount(minter, async (signer) => {
        const tx = ensGuilds.connect(signer).claimGuildTag(ensNode, tagToMint, minter, "0x", { gasLimit: 30000000 });
        await expect(tx).to.be.revertedWith("ReentrancyGuard: reentrant call");
      });
    });

    it("User failing authz check causes TX to revert", async function () {
      const { ensGuilds, flatFeePolicy, allowlistAuthPolicy } = this.deployedContracts;
      const { ensNameOwner, ensNode, admin } = this.guildInfo;
      const { minter } = this.addresses;

      const tagToMint = "test";

      // Register guild
      await asAccount(ensNameOwner, async (signer) => {
        await ensGuilds
          .connect(signer)
          .registerGuild(ensNode, admin, flatFeePolicy.getAddress(), allowlistAuthPolicy.getAddress());
      });

      // attempt to claim a tag without first being allowlisted
      await asAccount(minter, async (signer) => {
        const tx = ensGuilds.connect(signer).claimGuildTag(ensNode, tagToMint, minter, "0x", { gasLimit: 30000000 });
        await this.expectRevertedWithCustomError(tx, "ClaimUnauthorized");
      });
    });

    it("Frozen guild causes mint TX to revert", async function () {
      const { ensGuilds, flatFeePolicy, openAuthPolicy } = this.deployedContracts;
      const { ensNameOwner, ensNode, admin } = this.guildInfo;
      const { minter } = this.addresses;

      const tagToMint = "test";

      // Register guild
      await asAccount(ensNameOwner, async (signer) => {
        await ensGuilds
          .connect(signer)
          .registerGuild(ensNode, admin, flatFeePolicy.getAddress(), openAuthPolicy.getAddress());
      });

      // Freeze the guild
      await asAccount(admin, async (signer) => {
        await ensGuilds.connect(signer).setGuildActive(ensNode, false);
      });

      // attempt to claim a tag without first being allowlisted
      await asAccount(minter, async (signer) => {
        const tx = ensGuilds.connect(signer).claimGuildTag(ensNode, tagToMint, minter, "0x", { gasLimit: 30000000 });
        await this.expectRevertedWithCustomError(tx, "GuildNotActive");
      });
    });

    it("User cannot mint an existing tag that has not been revoked", async function () {
      const { ensGuilds, flatFeePolicy, openAuthPolicy } = this.deployedContracts;
      const { ensNameOwner, ensNode, admin } = this.guildInfo;
      const { minter: minter1, unauthorizedThirdParty: minter2 } = this.addresses;

      const tagToMint = "test";

      // Register guild
      await asAccount(ensNameOwner, async (signer) => {
        await ensGuilds
          .connect(signer)
          .registerGuild(ensNode, admin, flatFeePolicy.getAddress(), openAuthPolicy.getAddress());
      });

      // minter1 successfully claims this tag
      await asAccount(minter1, async (signer) => {
        await ensGuilds.connect(signer).claimGuildTag(ensNode, tagToMint, minter1, "0x");
      });

      // minter2 cannot then claim the same tag
      await asAccount(minter2, async (signer) => {
        const tx = ensGuilds.connect(signer).claimGuildTag(ensNode, tagToMint, minter2, "0x");
        await this.expectRevertedWithCustomError(tx, "TagAlreadyClaimed");
      });
    });

    it("User cannot mint a tag if its full name was already registered in ENS", async function () {
      const { ensRegistry, ensGuilds, flatFeePolicy, openAuthPolicy } = this.deployedContracts;
      const { ensNameOwner, ensNode, admin } = this.guildInfo;
      const { ensDefaultResolver: ensDefaultResolverAddr } = await getNamedAccounts();
      const { minter } = this.addresses;

      const tagToMint = "test";

      // Register a subdomain using the default resolver, before the guild is even registered
      await asAccount(ensNameOwner, async (signer) => {
        await ensRegistry
          .connect(signer)
          .setSubnodeRecord(ensNode, ensLabelHash(tagToMint), ensNameOwner, ensDefaultResolverAddr, 0);
      });

      // Register guild
      await asAccount(ensNameOwner, async (signer) => {
        await ensGuilds
          .connect(signer)
          .registerGuild(ensNode, admin, flatFeePolicy.getAddress(), openAuthPolicy.getAddress());
      });

      // minter should fail when trying to claim this tag
      await asAccount(minter, async (signer) => {
        const tx = ensGuilds.connect(signer).claimGuildTag(ensNode, tagToMint, minter, "0x");
        await this.expectRevertedWithCustomError(tx, "TagAlreadyClaimed");
      });
    });

    it("Caller can specify different address to receive the tag if authz policy allows", async function () {
      const { ensGuilds, flatFeePolicy, openAuthPolicy } = this.deployedContracts;
      const { ensNameOwner, ensNode, admin } = this.guildInfo;
      const { minter, unauthorizedThirdParty: tagRecipient } = this.addresses;

      const tagToMint = "test";

      // Register guild
      await asAccount(ensNameOwner, async (signer) => {
        await ensGuilds
          .connect(signer)
          .registerGuild(ensNode, admin, flatFeePolicy.getAddress(), openAuthPolicy.getAddress());
      });

      // claim a tag for a separate recipient
      await asAccount(minter, async (signer) => {
        await ensGuilds.connect(signer).claimGuildTag(ensNode, tagToMint, tagRecipient, "0x");
      });
    });

    it("Multiple tags can be minted in batch", async function () {
      const { ensGuilds, flatFeePolicy, openAuthPolicy } = this.deployedContracts;
      const { ensNameOwner, ensNode, admin } = this.guildInfo;
      const { minter: minter1, unauthorizedThirdParty: minter2 } = this.addresses;

      const tag1 = "test1";
      const tag2 = "test2";

      // Register guild
      await asAccount(ensNameOwner, async (signer) => {
        await ensGuilds
          .connect(signer)
          .registerGuild(ensNode, admin, flatFeePolicy.getAddress(), openAuthPolicy.getAddress());
      });

      // claim both tags
      await asAccount(minter1, async (signer) => {
        await ensGuilds.connect(signer).claimGuildTagsBatch(ensNode, [tag1, tag2], [minter1, minter2], ["0x", "0x"]);
      });

      await expect(ensGuilds.tagOwner(ensNode, ensLabelHash(tag1))).to.eventually.eq(minter1);
      await expect(ensGuilds.tagOwner(ensNode, ensLabelHash(tag2))).to.eventually.eq(minter2);
    });
  });
}
