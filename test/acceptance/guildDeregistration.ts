import { asAccount } from "../utils";

export function testGuildDeregistration(): void {
  describe("Guild Deregistration", function () {
    beforeEach("Setup guild", async function () {
      const { ensRegistry, ensGuilds, flatFeePolicy, openAuthPolicy } = this.deployedContracts;
      const { ensNameOwner, ensNode, admin } = this.guildInfo;

      await asAccount(ensNameOwner, async (signer) => {
        // Set ENSGuilds contract as an approved operator
        await ensRegistry.connect(signer).setApprovalForAll(ensGuilds.address, true);
        // Register guild
        await ensGuilds.connect(signer).registerGuild(ensNode, admin, flatFeePolicy.address, openAuthPolicy.address);
      });
    });

    it("Tags minted on a guild can be revoked by anyone once it is deregistered", async function () {
      const { ensGuilds } = this.deployedContracts;
      const { ensNode, admin } = this.guildInfo;
      const { minter, unauthorizedThirdParty: thirdParty } = this.addresses;

      // mint a tag
      const tagToMint = "test";
      await asAccount(minter, async (signer) => {
        await ensGuilds.connect(signer).claimGuildTag(ensNode, tagToMint, minter, []);
      });

      // deregister the guild
      await asAccount(admin, async (signer) => {
        await ensGuilds.connect(signer).deregisterGuild(ensNode);
      });

      // verify anyone can now revoke the existing tag on the deregistered guild
      await asAccount(thirdParty, async (signer) => {
        await ensGuilds.connect(signer).revokeGuildTag(ensNode, tagToMint, []);
      });
    });

    it("Users cannot mint new tags once a guild is deregistered", async function () {
      const { ensGuilds } = this.deployedContracts;
      const { ensNode, admin } = this.guildInfo;
      const { minter } = this.addresses;

      // deregister the guild
      await asAccount(admin, async (signer) => {
        await ensGuilds.connect(signer).deregisterGuild(ensNode);
      });

      // minting a tag should fail
      const tagToMint = "test";
      await asAccount(minter, async (signer) => {
        const tx = ensGuilds.connect(signer).claimGuildTag(ensNode, tagToMint, minter, []);
        await this.expectRevertedWithCustomError(tx, "GuildNotActive");
      });
    });

    it("A guild that was deregistered can be registered again", async function () {
      const { ensGuilds, flatFeePolicy, openAuthPolicy } = this.deployedContracts;
      const { ensNode, admin, ensNameOwner } = this.guildInfo;

      // deregister the guild
      await asAccount(admin, async (signer) => {
        await ensGuilds.connect(signer).deregisterGuild(ensNode);
      });

      // re-register the same guild
      await asAccount(ensNameOwner, async (signer) => {
        await ensGuilds.connect(signer).registerGuild(ensNode, admin, flatFeePolicy.address, openAuthPolicy.address);
      });
    });

    it("A guild may only be deregistered by its admin", async function () {
      const { ensGuilds } = this.deployedContracts;
      const { ensNode, admin, ensNameOwner } = this.guildInfo;
      const { unauthorizedThirdParty } = this.addresses;

      // attempt to deregister the guild as several unauthorized parties
      for (const addr of [ensNameOwner, unauthorizedThirdParty]) {
        await asAccount(addr, async (signer) => {
          const tx = ensGuilds.connect(signer).deregisterGuild(ensNode);
          await this.expectRevertedWithCustomError(tx, "GuildAdminOnly");
        });
      }

      // works for the admin
      await asAccount(admin, async (signer) => {
        await ensGuilds.connect(signer).deregisterGuild(ensNode);
      });
    });
  });
}
