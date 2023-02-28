import { expect } from "chai";
import { namehash } from "ethers/lib/utils";

import { ensLabelHash } from "../../utils";
import { asAccount } from "../utils";

export function testGuildRegistration(): void {
  describe("Guild Registration", function () {
    it("A domain owner can register their domain for minting", async function () {
      const { ensRegistry, ensGuilds, flatFeePolicy, openAuthPolicy } = this.deployedContracts;
      const { ensNameOwner, ensNode, admin } = this.guildInfo;

      await asAccount(ensNameOwner, async (signer) => {
        // Set ENSGuilds contract as the new ENS resolver
        await ensRegistry.connect(signer).setResolver(ensNode, ensGuilds.address);

        // Register guild
        await ensGuilds.connect(signer).registerGuild(ensNode, admin, flatFeePolicy.address, openAuthPolicy.address);
      });
    });

    it("A subdomain owner can register their domain for minting", async function () {
      const { ensRegistry, ensGuilds, flatFeePolicy, openAuthPolicy } = this.deployedContracts;
      const { domain, ensNameOwner, ensNode, admin } = this.guildInfo;

      const subdomain = "test-subdomain";
      const subdomainHash = ensLabelHash(subdomain);

      const guildName = `${subdomain}.${domain}`;
      const guildHash = namehash(guildName);

      await asAccount(ensNameOwner, async (signer) => {
        // Register subdomain in ENS
        await ensRegistry.connect(signer).setSubnodeRecord(ensNode, subdomainHash, ensNameOwner, ensGuilds.address, 0);
        const owner = await ensRegistry.owner(guildHash);
        expect(owner).eq(ensNameOwner);

        // Register guild
        await ensGuilds.connect(signer).registerGuild(guildHash, admin, flatFeePolicy.address, openAuthPolicy.address);
      });
    });

    it("A domain owner cannot register an already registered domain", async function () {
      const { ensRegistry, ensGuilds, flatFeePolicy, openAuthPolicy } = this.deployedContracts;
      const { ensNameOwner, ensNode, admin } = this.guildInfo;

      await asAccount(ensNameOwner, async (signer) => {
        // Set ENSGuilds contract as the new ENS resolver
        await ensRegistry.connect(signer).setResolver(ensNode, ensGuilds.address);

        // Register guild
        await ensGuilds.connect(signer).registerGuild(ensNode, admin, flatFeePolicy.address, openAuthPolicy.address);

        // Register the guild again
        const tx = ensGuilds
          .connect(signer)
          .registerGuild(ensNode, admin, flatFeePolicy.address, openAuthPolicy.address);
        await this.expectRevertedWithCustomError(tx, "AlreadyRegistered");
      });
    });

    it("A guild cannot be registered by a non-owner of that domain", async function () {
      const { ensRegistry, ensGuilds, flatFeePolicy, openAuthPolicy } = this.deployedContracts;
      const { ensNameOwner, ensNode, admin } = this.guildInfo;
      const { unauthorizedThirdParty } = this.addresses;

      await asAccount(ensNameOwner, async (signer) => {
        // Set ENSGuilds contract as the new ENS resolver
        await ensRegistry.connect(signer).setResolver(ensNode, ensGuilds.address);
      });

      await asAccount(unauthorizedThirdParty, async (signer) => {
        const tx = ensGuilds
          .connect(signer)
          .registerGuild(ensNode, admin, flatFeePolicy.address, openAuthPolicy.address);
        await this.expectRevertedWithCustomError(tx, "NotDomainOwner");
      });
    });

    it("A guild cannot be registered for a non-existent ENS name", async function () {
      const { ensGuilds, flatFeePolicy, openAuthPolicy } = this.deployedContracts;
      const { admin } = this.guildInfo;
      const { unauthorizedThirdParty } = this.addresses;

      const ensNode = namehash("nosuchensnameexistsxxxxxxxxx.eth"); // cspell: disable-line

      await asAccount(unauthorizedThirdParty, async (signer) => {
        const tx = ensGuilds
          .connect(signer)
          .registerGuild(ensNode, admin, flatFeePolicy.address, openAuthPolicy.address);
        await this.expectRevertedWithCustomError(tx, "NotDomainOwner");
      });
    });

    it("A guild cannot be registered until the domain owner has set ENSGuilds as its resolver", async function () {
      const { ensGuilds, flatFeePolicy, openAuthPolicy } = this.deployedContracts;
      const { ensNameOwner, ensNode, admin } = this.guildInfo;

      await asAccount(ensNameOwner, async (signer) => {
        // Register guild
        const tx = ensGuilds
          .connect(signer)
          .registerGuild(ensNode, admin, flatFeePolicy.address, openAuthPolicy.address);
        await this.expectRevertedWithCustomError(tx, "IncorrectENSResolver");
      });
    });
  });
}
