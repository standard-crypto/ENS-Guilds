import { expect } from "chai";
import { ZeroAddress, namehash } from "ethers";
import { ethers } from "hardhat";

import { AddrResolver__factory } from "../../types";
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
    const { ensNameOwner, domain, admin } = this.guildInfo;

    await this.approveGuildsAsEnsOperator();

    await asAccount(ensNameOwner, async (signer) => {
      // Register guild
      await ensGuilds
        .connect(signer)
        .registerGuild(domain, admin, flatFeePolicy.getAddress(), openAuthPolicy.getAddress());
    });
  });

  it("Tags minted on a deregistered guild cannot be revoked", async function () {
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

    // attempt to revoke the existing tag on the deregistered guild should fail
    await asAccount(thirdParty, async (signer) => {
      const tx = ensGuilds.connect(signer).revokeGuildTag(ensNode, tagToMint, "0x");
      await this.expectRevertedWithCustomError(tx, "GuildNotActive");
    });
  });

  it("A deregistered guild's tags will have no owner", async function () {
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
    await expect(ensGuilds.tagOwner(ensNode, ensLabelHash(tagToMint))).to.eventually.eq(ZeroAddress);
  });

  it("ENS records for a deregistered guild's tags are wiped", async function () {
    const { ensGuilds, ensRegistry } = this.deployedContracts;
    const { ensNode, admin, domain } = this.guildInfo;
    const { minter } = this.addresses;

    // mint a tag
    const tagToMint = "test";
    await asAccount(minter, async (signer) => {
      await ensGuilds.connect(signer).claimGuildTag(ensNode, tagToMint, minter, "0x");
    });
    await expect(resolveAddr(ensRegistry, `${tagToMint}.${domain}`)).to.eventually.eq(minter);

    // deregister the guild
    await asAccount(admin, async (signer) => {
      await ensGuilds.connect(signer).deregisterGuild(ensNode);
    });

    // The old ENS record should be gone
    await expect(resolveAddr(ensRegistry, `${tagToMint}.${domain}`)).to.eventually.be.null;
  });

  it("Existing ENS records set outside of the Guilds contract are preserved", async function () {
    const { ensRegistry, ensNameWrapper, ensGuilds, guildsResolver } = this.deployedContracts;
    const { ensNameOwner, ensNode, domain, admin } = this.guildInfo;

    const ensDefaultResolverAddr = await guildsResolver.getPassthroughTarget(ensNode);
    const ensDefaultResolver = AddrResolver__factory.connect(ensDefaultResolverAddr, ethers.provider);
    const subdomain = `foo`;
    const subdomainHash = ensLabelHash(subdomain);
    const subdomainNode = namehash(`${subdomain}.${domain}`);
    const expectedParentDomainResolvesTo = ethers.Wallet.createRandom().address;
    const expectedSubdomainResolvesTo = ethers.Wallet.createRandom().address;

    await asAccount(ensNameOwner, async (signer) => {
      // put a record on the guild's top-level domain
      await ensDefaultResolver.connect(signer)["setAddr(bytes32,address)"](ensNode, expectedParentDomainResolvesTo);

      // register a custom subdomain too
      if (this.usingNameWrapper) {
        await ensNameWrapper
          .connect(signer)
          .setSubnodeRecord(ensNode, subdomain, ensNameOwner, ensDefaultResolver, 0, 0, 0);
      } else {
        await ensRegistry
          .connect(signer)
          .setSubnodeRecord(ensNode, subdomainHash, ensNameOwner, ensDefaultResolverAddr, 0);
      }
    });

    // set the forward record for the custom subdomain
    await asAccount(ensNameOwner, async (signer) => {
      await ensDefaultResolver.connect(signer)["setAddr(bytes32,address)"](subdomainNode, expectedSubdomainResolvesTo);
    });

    // sanity-check that we manually set these two record correctly
    let subdomainResolvesTo = await resolveAddr(ensRegistry, `${subdomain}.${domain}`);
    expect(subdomainResolvesTo).to.eq(expectedSubdomainResolvesTo);
    let parentDomainResolvesTo = await resolveAddr(ensRegistry, domain);
    expect(parentDomainResolvesTo).to.eq(expectedParentDomainResolvesTo);

    // de-register the guild
    await asAccount(admin, async (signer) => {
      await ensGuilds.connect(signer).deregisterGuild(ensNode);
    });

    // those same two records should have been preserved
    subdomainResolvesTo = await resolveAddr(ensRegistry, `${subdomain}.${domain}`);
    expect(subdomainResolvesTo).to.eq(expectedSubdomainResolvesTo);
    parentDomainResolvesTo = await resolveAddr(ensRegistry, domain);
    expect(parentDomainResolvesTo).to.eq(expectedParentDomainResolvesTo);
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
      const { domain, ensNode, admin, ensNameOwner } = this.guildInfo;

      // deregister the guild
      await asAccount(admin, async (signer) => {
        await ensGuilds.connect(signer).deregisterGuild(ensNode);
      });

      // re-register the same guild
      await asAccount(ensNameOwner, async (signer) => {
        await ensGuilds
          .connect(signer)
          .registerGuild(domain, admin, flatFeePolicy.getAddress(), openAuthPolicy.getAddress());
      });
    });

    it("Tags that minted before deregistration can then be re-minted again to new owners", async function () {
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

      // re-register the same guild
      await asAccount(ensNameOwner, async (signer) => {
        await ensGuilds
          .connect(signer)
          .registerGuild(domain, admin, flatFeePolicy.getAddress(), openAuthPolicy.getAddress());
      });

      // ENSGuilds should report that the minted tag is un-owned
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
