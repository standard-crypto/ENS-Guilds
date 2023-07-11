import { expect } from "chai";

import { asAccount } from "../utils";

export function testAdminControls(): void {
  describe("Guild Admin Controls", function () {
    beforeEach("Set ENSGuilds contract as an ENS manager for the domain", async function () {
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

    it("Admin is set at guild registration time, and can be separate from domain owner", async function () {
      const { ensNameOwner, admin } = this.guildInfo;
      expect(ensNameOwner).not.eq(admin);
    });

    it("Only admin can freeze mints", async function () {
      const { ensGuilds } = this.deployedContracts;
      const { ensNameOwner, ensNode, admin } = this.guildInfo;
      const { unauthorizedThirdParty } = this.addresses;

      // Freeze the guild
      await asAccount(admin, async (signer) => {
        await ensGuilds.connect(signer).setGuildActive(ensNode, false);
      });

      // Unfreeze the guild
      await asAccount(admin, async (signer) => {
        await ensGuilds.connect(signer).setGuildActive(ensNode, true);
      });

      // Freezing the guild as owner should fail
      await asAccount(ensNameOwner, async (signer) => {
        const tx = ensGuilds.connect(signer).setGuildActive(ensNode, false);
        await this.expectRevertedWithCustomError(tx, "GuildAdminOnly");
      });

      // Freezing the guild as third party should fail
      await asAccount(unauthorizedThirdParty, async (signer) => {
        const tx = ensGuilds.connect(signer).setGuildActive(ensNode, false);
        await this.expectRevertedWithCustomError(tx, "GuildAdminOnly");
      });
    });

    it("Only admin can transfer admin rights", async function () {
      const { ensGuilds } = this.deployedContracts;
      const { ensNameOwner, ensNode, admin } = this.guildInfo;
      const { unauthorizedThirdParty } = this.addresses;

      // Transfer admin rights
      await asAccount(admin, async (signer) => {
        await ensGuilds.connect(signer).transferGuildAdmin(ensNode, unauthorizedThirdParty);
      });

      // Transfer admin rights back
      await asAccount(unauthorizedThirdParty, async (signer) => {
        await ensGuilds.connect(signer).transferGuildAdmin(ensNode, admin);
      });

      // Transferring admin rights as owner should fail
      await asAccount(ensNameOwner, async (signer) => {
        const tx = ensGuilds.connect(signer).transferGuildAdmin(ensNode, unauthorizedThirdParty);
        await this.expectRevertedWithCustomError(tx, "GuildAdminOnly");
      });

      // Transferring admin rights as third party should fail
      await asAccount(unauthorizedThirdParty, async (signer) => {
        const tx = ensGuilds.connect(signer).transferGuildAdmin(ensNode, ensNameOwner);
        await this.expectRevertedWithCustomError(tx, "GuildAdminOnly");
      });
    });

    it("Only admin can set a new authorization policy", async function () {
      const { ensGuilds, openAuthPolicy, nftAuthPolicy } = this.deployedContracts;
      const { ensNameOwner, ensNode, admin } = this.guildInfo;
      const { unauthorizedThirdParty } = this.addresses;

      // Set new authorization policy
      await asAccount(admin, async (signer) => {
        await ensGuilds.connect(signer).updateGuildTagsAuthPolicy(ensNode, nftAuthPolicy.getAddress());
      });

      // Setting new authorization policy as owner should fail
      await asAccount(ensNameOwner, async (signer) => {
        const tx = ensGuilds.connect(signer).updateGuildTagsAuthPolicy(ensNode, openAuthPolicy.getAddress());
        await this.expectRevertedWithCustomError(tx, "GuildAdminOnly");
      });

      // Setting new authorization policy as third party should fail
      await asAccount(unauthorizedThirdParty, async (signer) => {
        const tx = ensGuilds.connect(signer).updateGuildTagsAuthPolicy(ensNode, openAuthPolicy.getAddress());
        await this.expectRevertedWithCustomError(tx, "GuildAdminOnly");
      });
    });

    it("Only admin can set a new fee policy", async function () {
      const { ensGuilds, flatFeePolicy } = this.deployedContracts;
      const { ensNameOwner, ensNode, admin } = this.guildInfo;
      const { unauthorizedThirdParty } = this.addresses;

      // Set new fee policy
      await asAccount(admin, async (signer) => {
        await ensGuilds.connect(signer).updateGuildFeePolicy(ensNode, flatFeePolicy.getAddress());
      });

      // Setting new fee policy as third party should fail
      await asAccount(ensNameOwner, async (signer) => {
        const tx = ensGuilds.connect(signer).updateGuildFeePolicy(ensNode, flatFeePolicy.getAddress());
        await this.expectRevertedWithCustomError(tx, "GuildAdminOnly");
      });

      // Setting new fee policy as third party should fail
      await asAccount(unauthorizedThirdParty, async (signer) => {
        const tx = ensGuilds.connect(signer).updateGuildFeePolicy(ensNode, flatFeePolicy.getAddress());
        await this.expectRevertedWithCustomError(tx, "GuildAdminOnly");
      });
    });
  });
}
