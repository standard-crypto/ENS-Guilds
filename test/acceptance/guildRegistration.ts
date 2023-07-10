import { expect } from "chai";
import { namehash } from "ethers";

import { ensLabelHash, resolveAddr } from "../../utils";
import { asAccount } from "../utils";
import { setTestUsesEnsNameWrapper } from "./utils";

export function testGuildRegistration(): void {
  describe("Guild Registration", function () {
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
  it("A domain owner can register their domain for minting", async function () {
    const { ensGuilds, flatFeePolicy, openAuthPolicy } = this.deployedContracts;
    const { ensNameOwner, ensNode, admin } = this.guildInfo;

    // Set ENSGuilds contract as an ENS operator
    await this.approveGuildsAsEnsOperator();

    await asAccount(ensNameOwner, async (signer) => {
      // Register guild
      await ensGuilds
        .connect(signer)
        .registerGuild(ensNode, admin, flatFeePolicy.getAddress(), openAuthPolicy.getAddress());
    });
  });

  it("A subdomain owner can register their domain for minting", async function () {
    const { ensRegistry, ensNameWrapper, ensGuilds, flatFeePolicy, openAuthPolicy } = this.deployedContracts;
    const { domain, ensNameOwner, ensNode, admin } = this.guildInfo;

    const subdomain = "test-subdomain";
    const subdomainHash = ensLabelHash(subdomain);

    const guildName = `${subdomain}.${domain}`;
    const guildHash = namehash(guildName);

    // Set ENSGuilds contract as an ENS operator
    await this.approveGuildsAsEnsOperator();

    await asAccount(ensNameOwner, async (signer) => {
      // Register subdomain in ENS
      if (this.usingNameWrapper) {
        await ensNameWrapper.connect(signer).setSubnodeOwner(ensNode, subdomain, ensNameOwner, 0, 0);
      } else {
        await ensRegistry.connect(signer).setSubnodeOwner(ensNode, subdomainHash, ensNameOwner);
      }

      // Register guild
      await ensGuilds
        .connect(signer)
        .registerGuild(guildHash, admin, flatFeePolicy.getAddress(), openAuthPolicy.getAddress());

      // Mint a tag and check that it resolves correctly
      const tag = "test-tag";
      await ensGuilds.connect(signer).claimGuildTag(guildHash, tag, ensNameOwner, "0x");
      const tagOwner = await resolveAddr(ensRegistry, `${tag}.${guildName}`);
      expect(tagOwner).to.eq(ensNameOwner);
    });
  });

  it("A domain owner cannot register an already registered domain", async function () {
    const { ensGuilds, flatFeePolicy, openAuthPolicy } = this.deployedContracts;
    const { ensNameOwner, ensNode, admin } = this.guildInfo;

    // Set ENSGuilds contract as an ENS operator
    await this.approveGuildsAsEnsOperator();

    await asAccount(ensNameOwner, async (signer) => {
      // Register guild
      await ensGuilds
        .connect(signer)
        .registerGuild(ensNode, admin, flatFeePolicy.getAddress(), openAuthPolicy.getAddress());

      // Register the guild again
      const tx = ensGuilds
        .connect(signer)
        .registerGuild(ensNode, admin, flatFeePolicy.getAddress(), openAuthPolicy.getAddress());
      await this.expectRevertedWithCustomError(tx, "AlreadyRegistered");
    });
  });

  it("A guild cannot be registered by a non-owner of that domain", async function () {
    const { ensGuilds, flatFeePolicy, openAuthPolicy } = this.deployedContracts;
    const { ensNode, admin } = this.guildInfo;
    const { unauthorizedThirdParty } = this.addresses;

    await this.approveGuildsAsEnsOperator();

    await asAccount(unauthorizedThirdParty, async (signer) => {
      const tx = ensGuilds
        .connect(signer)
        .registerGuild(ensNode, admin, flatFeePolicy.getAddress(), openAuthPolicy.getAddress());
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
        .registerGuild(ensNode, admin, flatFeePolicy.getAddress(), openAuthPolicy.getAddress());
      await this.expectRevertedWithCustomError(tx, "NotDomainOwner");
    });
  });

  it("A guild cannot be registered until the domain owner has set ENSGuilds as its operator", async function () {
    const { ensGuilds, flatFeePolicy, openAuthPolicy } = this.deployedContracts;
    const { ensNameOwner, ensNode, admin } = this.guildInfo;

    await asAccount(ensNameOwner, async (signer) => {
      // Register guild
      const tx = ensGuilds
        .connect(signer)
        .registerGuild(ensNode, admin, flatFeePolicy.getAddress(), openAuthPolicy.getAddress());
      await this.expectRevertedWithCustomError(tx, "ENSGuildsIsNotRegisteredOperator");
    });
  });
}
