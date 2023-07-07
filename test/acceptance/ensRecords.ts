import { expect } from "chai";
import { namehash } from "ethers";

import { ensLabelHash, getReverseName, getReverseRegistrar, resolveAddr } from "../../utils";
import { asAccount } from "../utils";
import { setTestUsesEnsNameWrapper } from "./utils";

export function testEnsRecords(): void {
  describe("ENS Records", function () {
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

  it("ENS address lookup works as expected for minter", async function () {
    const { ensGuilds, ensRegistry } = this.deployedContracts;
    const { ensNode, domain } = this.guildInfo;
    const { minter } = this.addresses;

    const tagToMint = "test";
    const fullTagName = `${tagToMint}.${domain}`;

    // claim the tag
    await asAccount(minter, async (signer) => {
      await ensGuilds.connect(signer).claimGuildTag(ensNode, tagToMint, minter, "0x");
    });

    const registeredAddress = await resolveAddr(ensRegistry, fullTagName);
    expect(registeredAddress).to.eq(minter);
  });

  it("A minter can set reverse ENS record for their guild tag", async function () {
    const { ensGuilds, ensRegistry } = this.deployedContracts;
    const { ensNode, domain } = this.guildInfo;
    const { minter } = this.addresses;
    const reverseRegistrar = await getReverseRegistrar(ensRegistry);

    const tagToMint = "test";
    const fullTagName = `${tagToMint}.${domain}`;

    await asAccount(minter, async (signer) => {
      // claim the tag
      await ensGuilds.connect(signer).claimGuildTag(ensNode, tagToMint, minter, "0x");

      // set the reverse record
      const tx = await reverseRegistrar.connect(signer).setName(fullTagName);
      await tx.wait();
    });

    // lookup the reverse record
    const reverseName = await getReverseName(ensRegistry, minter);
    expect(reverseName).to.eq(fullTagName);
  });

  it("Tag owner cannot change any ENS records for their tag", async function () {
    const { ensGuilds, ensRegistry } = this.deployedContracts;
    const { ensNode, domain } = this.guildInfo;
    const { minter, unauthorizedThirdParty } = this.addresses;

    const tagToMint = "test";
    const tagHash = ensLabelHash(tagToMint);
    const fullTagName = `${tagToMint}.${domain}`;

    await asAccount(minter, async (signer) => {
      // claim the tag
      await ensGuilds.connect(signer).claimGuildTag(ensNode, tagToMint, minter, "0x");

      // attempt to change owner of the tag's ENS node
      let tx = ensRegistry.connect(signer).setOwner(namehash(fullTagName), unauthorizedThirdParty);
      await expect(tx).to.be.revertedWithoutReason();
      tx = ensRegistry.connect(signer).setSubnodeOwner(ensNode, tagHash, unauthorizedThirdParty);
      await expect(tx).to.be.revertedWithoutReason();
    });
  });
}
