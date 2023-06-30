import { expect } from "chai";
import { namehash } from "ethers";

import { ensLabelHash, getReverseName, getReverseRegistrar, resolveAddr } from "../../utils";
import { asAccount } from "../utils";

export function testEnsRecords(): void {
  describe("ENS Records", function () {
    beforeEach("Setup guild", async function () {
      const { ensRegistry, ensGuilds, flatFeePolicy, openAuthPolicy } = this.deployedContracts;
      const { ensNameOwner, ensNode, admin } = this.guildInfo;

      await asAccount(ensNameOwner, async (signer) => {
        // Set ENSGuilds contract as an approved operator
        await ensRegistry.connect(signer).setApprovalForAll(ensGuilds.getAddress(), true);
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
  });
}
