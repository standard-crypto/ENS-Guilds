import { expect } from "chai";
import { deployments, ethers, getNamedAccounts } from "hardhat";

import { ensLabelHash } from "../../utils";
import { asAccount } from "../utils";

export function testMintAuthorization(): void {
  describe("Mint Authorization", function () {
    beforeEach("Set ENSGuilds contract as the ENS resolver for the domain", async function () {
      const { ensRegistry, ensGuilds } = this.deployedContracts;
      const { ensNameOwner } = this.guildInfo;

      await asAccount(ensNameOwner, async (signer) => {
        // Set ENSGuilds contract as an approved operator
        await ensRegistry.connect(signer).setApprovalForAll(ensGuilds.address, true);
      });
    });

    it("Domain owner can set authorization policy when registering a new guild", async function () {
      const { ensGuilds, flatFeePolicy, openAuthPolicy } = this.deployedContracts;
      const { ensNameOwner, ensNode, admin } = this.guildInfo;

      await asAccount(ensNameOwner, async (signer) => {
        // Register guild
        await ensGuilds.connect(signer).registerGuild(ensNode, admin, flatFeePolicy.address, openAuthPolicy.address);
      });
    });

    it("User can claim a guild tag if they pass the authz check", async function () {
      const { ensGuilds, flatFeePolicy, allowlistAuthPolicy } = this.deployedContracts;
      const { ensNameOwner, ensNode, admin } = this.guildInfo;
      const { minter } = this.addresses;

      const tagToMint = ensLabelHash("test");

      // Register guild
      await asAccount(ensNameOwner, async (signer) => {
        await ensGuilds
          .connect(signer)
          .registerGuild(ensNode, admin, flatFeePolicy.address, allowlistAuthPolicy.address);
      });

      // Add allowlist entry for the minter
      await asAccount(admin, async (signer) => {
        await allowlistAuthPolicy.connect(signer).allowMint(ensNode, minter);
      });

      // claiming a tag should succeed
      await asAccount(minter, async (signer) => {
        await ensGuilds.connect(signer).claimGuildTag(ensNode, tagToMint, minter, []);
      });
    });

    it("Domain owner can’t register an nonexistent or invalid contract as the authz policy for a guild", async function () {
      const { ensGuilds, flatFeePolicy } = this.deployedContracts;
      const { ensNameOwner, ensNode, admin } = this.guildInfo;

      await asAccount(ensNameOwner, async (signer) => {
        // Attempt to set zero address as the auth policy should fail
        let tx = ensGuilds
          .connect(signer)
          .registerGuild(ensNode, admin, flatFeePolicy.address, ethers.constants.AddressZero);
        await this.expectRevertedWithCustomError(tx, "InvalidPolicy");

        // Attempt to use an existing contract that doesn't implement AuthPolicy
        tx = ensGuilds.connect(signer).registerGuild(ensNode, admin, flatFeePolicy.address, flatFeePolicy.address);
        await this.expectRevertedWithCustomError(tx, "InvalidPolicy");
        tx = ensGuilds.connect(signer).registerGuild(ensNode, admin, flatFeePolicy.address, ensGuilds.address);
        await this.expectRevertedWithCustomError(tx, "InvalidPolicy");

        // Attempt to use an EOA as the AuthPolicy
        tx = ensGuilds.connect(signer).registerGuild(ensNode, admin, flatFeePolicy.address, ensNameOwner);
        await this.expectRevertedWithCustomError(tx, "InvalidPolicy");
      });
    });

    it("User cannot circumvent authz via reentrancy attack", async function () {
      const { ensGuilds, flatFeePolicy } = this.deployedContracts;
      const { ensNameOwner, ensNode, admin } = this.guildInfo;
      const { minter } = this.addresses;

      const tagToMint = ensLabelHash("test");

      // Deploy a naive AuthPolicy that can trigger a reentrancy attack, along with the attacker itself
      const { deploy } = deployments;
      const { deployer } = await getNamedAccounts();
      const attackerDeployment = await deploy("ClaimGuildTagReentrancyAttacker", {
        from: deployer,
        autoMine: true,
        args: [ensGuilds.address, ensNode, tagToMint, minter, []],
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
          .registerGuild(ensNode, admin, flatFeePolicy.address, authPolicyDeployment.address);
      });

      // Attempt to claim a tag, indirectly triggering a reentrant call on claimGuildTag
      await asAccount(minter, async (signer) => {
        const tx = ensGuilds.connect(signer).claimGuildTag(ensNode, tagToMint, minter, [], { gasLimit: 30000000 });
        await expect(tx).to.be.revertedWith("ReentrancyGuard: reentrant call");
      });
    });

    it("User failing authz check causes TX to revert", async function () {
      const { ensGuilds, flatFeePolicy, allowlistAuthPolicy } = this.deployedContracts;
      const { ensNameOwner, ensNode, admin } = this.guildInfo;
      const { minter } = this.addresses;

      const tagToMint = ensLabelHash("test");

      // Register guild
      await asAccount(ensNameOwner, async (signer) => {
        await ensGuilds
          .connect(signer)
          .registerGuild(ensNode, admin, flatFeePolicy.address, allowlistAuthPolicy.address);
      });

      // attempt to claim a tag without first being allowlisted
      await asAccount(minter, async (signer) => {
        const tx = ensGuilds.connect(signer).claimGuildTag(ensNode, tagToMint, minter, [], { gasLimit: 30000000 });
        await this.expectRevertedWithCustomError(tx, "ClaimUnauthorized");
      });
    });

    it("Frozen guild causes mint TX to revert", async function () {
      const { ensGuilds, flatFeePolicy, openAuthPolicy } = this.deployedContracts;
      const { ensNameOwner, ensNode, admin } = this.guildInfo;
      const { minter } = this.addresses;

      const tagToMint = ensLabelHash("test");

      // Register guild
      await asAccount(ensNameOwner, async (signer) => {
        await ensGuilds.connect(signer).registerGuild(ensNode, admin, flatFeePolicy.address, openAuthPolicy.address);
      });

      // Freeze the guild
      await asAccount(admin, async (signer) => {
        await ensGuilds.connect(signer).setGuildActive(ensNode, false);
      });

      // attempt to claim a tag without first being allowlisted
      await asAccount(minter, async (signer) => {
        const tx = ensGuilds.connect(signer).claimGuildTag(ensNode, tagToMint, minter, [], { gasLimit: 30000000 });
        await this.expectRevertedWithCustomError(tx, "GuildNotActive");
      });
    });

    it("User cannot mint an existing tag that has not been revoked", async function () {
      const { ensGuilds, flatFeePolicy, openAuthPolicy } = this.deployedContracts;
      const { ensNameOwner, ensNode, admin } = this.guildInfo;
      const { minter: minter1, unauthorizedThirdParty: minter2 } = this.addresses;

      const tagToMint = ensLabelHash("test");

      // Register guild
      await asAccount(ensNameOwner, async (signer) => {
        await ensGuilds.connect(signer).registerGuild(ensNode, admin, flatFeePolicy.address, openAuthPolicy.address);
      });

      // minter1 successfully claims this tag
      await asAccount(minter1, async (signer) => {
        await ensGuilds.connect(signer).claimGuildTag(ensNode, tagToMint, minter1, []);
      });

      // minter2 cannot then claim the same tag
      await asAccount(minter2, async (signer) => {
        const tx = ensGuilds.connect(signer).claimGuildTag(ensNode, tagToMint, minter2, []);
        await this.expectRevertedWithCustomError(tx, "TagAlreadyClaimed");
      });
    });

    it("Caller can specify different address to receive the tag if authz policy allows", async function () {
      const { ensGuilds, flatFeePolicy, openAuthPolicy } = this.deployedContracts;
      const { ensNameOwner, ensNode, admin } = this.guildInfo;
      const { minter, unauthorizedThirdParty: tagRecipient } = this.addresses;

      const tagToMint = ensLabelHash("test");

      // Register guild
      await asAccount(ensNameOwner, async (signer) => {
        await ensGuilds.connect(signer).registerGuild(ensNode, admin, flatFeePolicy.address, openAuthPolicy.address);
      });

      // claim a tag for a separate recipient
      await asAccount(minter, async (signer) => {
        await ensGuilds.connect(signer).claimGuildTag(ensNode, tagToMint, tagRecipient, []);
      });
    });
  });
}
