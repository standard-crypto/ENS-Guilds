import { expect } from "chai";
import { ZeroAddress } from "ethers";

import { ensLabelHash, resolveAddr } from "../../utils";
import { asAccount } from "../utils";
import { setTestUsesEnsNameWrapper } from "./utils";

export function testGuildDeregistration(): void {
  describe("Guild Deregistration", function () {
    describe("With NameWrapper", function () {
      before(function (this) {
        setTestUsesEnsNameWrapper.bind(this)(true);
      });
      after(function (this) {
        setTestUsesEnsNameWrapper.bind(this)(false);
      });
      _testSuite();
    });

    describe("Without NameWrapper", function () {
      _testSuite();
    });
  });
}

function _testSuite(): void {
  beforeEach("Setup guild", async function () {
    const { ensGuilds, flatFeePolicy, openAuthPolicy } = this.deployedContracts;
    const { ensNameOwner, ensNode, admin } = this.guildInfo;

    await this.approveGuildsAsEnsOperator();

    await asAccount(ensNameOwner, async (signer) => {
      // Register guild
      await ensGuilds
        .connect(signer)
        .registerGuild(ensNode, admin, flatFeePolicy.getAddress(), openAuthPolicy.getAddress());
    });
  });

  it("Tags minted on a guild can be revoked by anyone once the guild is deregistered", async function () {
    const { ensGuilds } = this.deployedContracts;
    const { ensNode, admin } = this.guildInfo;
    const { minter, unauthorizedThirdParty: thirdParty } = this.addresses;

    // mint a tag
    const tagToMint = "test";
    await asAccount(minter, async (signer) => {
      await ensGuilds.connect(signer).claimGuildTag(ensNode, tagToMint, minter, "0x");
    });

    // deregister the guild
    await asAccount(admin, async (signer) => {
      await ensGuilds.connect(signer).deregisterGuild(ensNode);
    });

    // verify anyone can now revoke the existing tag on the deregistered guild
    await asAccount(thirdParty, async (signer) => {
      await ensGuilds.connect(signer).revokeGuildTag(ensNode, tagToMint, "0x");
    });
  });

  it("A deregistered guild's tags will still exist until they're individually revoked", async function () {
    const { ensGuilds } = this.deployedContracts;
    const { ensNode, admin } = this.guildInfo;
    const { minter } = this.addresses;

    // mint a tag
    const tagToMint = "test";
    await asAccount(minter, async (signer) => {
      await ensGuilds.connect(signer).claimGuildTag(ensNode, tagToMint, minter, "0x");
    });
    await expect(ensGuilds.tagOwner(ensNode, ensLabelHash(tagToMint))).to.eventually.eq(minter);

    // deregister the guild
    await asAccount(admin, async (signer) => {
      await ensGuilds.connect(signer).deregisterGuild(ensNode);
    });

    // ENSGuilds should still report that the minted tag is owned by its original owner
    await expect(ensGuilds.tagOwner(ensNode, ensLabelHash(tagToMint))).to.eventually.eq(minter);

    // revoke that tag
    await asAccount(minter, async (signer) => {
      await ensGuilds.connect(signer).revokeGuildTag(ensNode, tagToMint, "0x");
    });

    // ENSGuilds should say the tag is now un-owned
    await expect(ensGuilds.tagOwner(ensNode, ensLabelHash(tagToMint))).to.eventually.eq(ZeroAddress);
  });

  it("ENS records are preserved for all minted tags once a guild is deregistered, until those tags are revoked", async function () {
    const { ensGuilds, ensRegistry } = this.deployedContracts;
    const { ensNode, admin, domain } = this.guildInfo;
    const { minter } = this.addresses;

    // mint a tag
    const tagToMint = "test";
    await asAccount(minter, async (signer) => {
      await ensGuilds.connect(signer).claimGuildTag(ensNode, tagToMint, minter, "0x");
    });

    // deregister the guild
    await asAccount(admin, async (signer) => {
      await ensGuilds.connect(signer).deregisterGuild(ensNode);
    });

    // The old ENS record should still be there
    await expect(resolveAddr(ensRegistry, `${tagToMint}.${domain}`)).to.eventually.eq(minter);

    // revoke that tag
    await asAccount(minter, async (signer) => {
      await ensGuilds.connect(signer).revokeGuildTag(ensNode, tagToMint, "0x");
    });

    // The ENS record should now be gone
    await expect(resolveAddr(ensRegistry, `${tagToMint}.${domain}`)).to.eventually.be.null;
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
      const tx = ensGuilds.connect(signer).claimGuildTag(ensNode, tagToMint, minter, "0x");
      await this.expectRevertedWithCustomError(tx, "GuildNotActive");
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

  describe("Re-registering again using the same guild ENS name", function () {
    it("A guild that was deregistered can be registered again", async function () {
      const { ensGuilds, flatFeePolicy, openAuthPolicy } = this.deployedContracts;
      const { ensNode, admin, ensNameOwner } = this.guildInfo;

      // deregister the guild
      await asAccount(admin, async (signer) => {
        await ensGuilds.connect(signer).deregisterGuild(ensNode);
      });

      // re-register the same guild
      await asAccount(ensNameOwner, async (signer) => {
        await ensGuilds
          .connect(signer)
          .registerGuild(ensNode, admin, flatFeePolicy.getAddress(), openAuthPolicy.getAddress());
      });
    });

    it("Tags minted before the de-registration that haven't been individually revoked are preserved", async function () {
      const { ensGuilds, flatFeePolicy, openAuthPolicy } = this.deployedContracts;
      const { ensNode, admin, ensNameOwner } = this.guildInfo;
      const { minter, unauthorizedThirdParty: thirdParty } = this.addresses;

      // mint a tag
      const tagToMint = "test";
      await asAccount(minter, async (signer) => {
        await ensGuilds.connect(signer).claimGuildTag(ensNode, tagToMint, minter, "0x");
      });

      // deregister the guild
      await asAccount(admin, async (signer) => {
        await ensGuilds.connect(signer).deregisterGuild(ensNode);
      });

      // re-register the same guild
      await asAccount(ensNameOwner, async (signer) => {
        await ensGuilds
          .connect(signer)
          .registerGuild(ensNode, admin, flatFeePolicy.getAddress(), openAuthPolicy.getAddress());
      });

      // ENSGuilds should still report that the minted tag is owned by its original owner
      await expect(ensGuilds.tagOwner(ensNode, ensLabelHash(tagToMint))).to.eventually.eq(minter);

      // Attempts to claim that tag again should fail
      await asAccount(thirdParty, async (signer) => {
        const tx = ensGuilds.connect(signer).claimGuildTag(ensNode, tagToMint, minter, "0x");
        await this.expectRevertedWithCustomError(tx, "TagAlreadyClaimed");
      });
    });

    it("Tags that were revoked after de-registration can then be re-minted again to new owners", async function () {
      const { ensGuilds, ensRegistry, flatFeePolicy, openAuthPolicy } = this.deployedContracts;
      const { ensNode, admin, ensNameOwner, domain } = this.guildInfo;
      const { minter, unauthorizedThirdParty: thirdParty } = this.addresses;

      // mint a tag
      const tagToMint = "test";
      await asAccount(minter, async (signer) => {
        await ensGuilds.connect(signer).claimGuildTag(ensNode, tagToMint, minter, "0x");
      });

      // deregister the guild
      await asAccount(admin, async (signer) => {
        await ensGuilds.connect(signer).deregisterGuild(ensNode);
      });

      // revoke the tag
      await asAccount(minter, async (signer) => {
        await ensGuilds.connect(signer).revokeGuildTag(ensNode, tagToMint, "0x");
      });

      // re-register the same guild
      await asAccount(ensNameOwner, async (signer) => {
        await ensGuilds
          .connect(signer)
          .registerGuild(ensNode, admin, flatFeePolicy.getAddress(), openAuthPolicy.getAddress());
      });

      // ENSGuilds should still report that the minted tag is un-owned
      await expect(ensGuilds.tagOwner(ensNode, ensLabelHash(tagToMint))).to.eventually.eq(ZeroAddress);

      // Someone else can then claim the revoked tag
      await asAccount(thirdParty, async (signer) => {
        await ensGuilds.connect(signer).claimGuildTag(ensNode, tagToMint, thirdParty, "0x");
      });

      // Check that the new tag owner is indeed the owner, and has the correct ENS record
      await expect(ensGuilds.tagOwner(ensNode, ensLabelHash(tagToMint))).to.eventually.eq(thirdParty);
      await expect(resolveAddr(ensRegistry, `${tagToMint}.${domain}`)).to.eventually.eq(thirdParty);
    });
  });
}
