import { expect } from "chai";

import { ensLabelHash, getReverseName, getReverseRegistrar, resolveName } from "../../utils";
import { asAccount } from "../utils";

export function testEnsRecords(): void {
  describe("ENS Records", function () {
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

    it("ENS address lookup works as expected for minter", async function () {
      const { ensGuilds, ensRegistry } = this.deployedContracts;
      const { ensNode, domain } = this.guildInfo;
      const { minter } = this.addresses;

      const tagToMint = "test";
      const tagHash = ensLabelHash(tagToMint);
      const fullTagName = `${tagToMint}.${domain}`;

      // claim the tag
      await asAccount(minter, async (signer) => {
        await ensGuilds.connect(signer).claimGuildTag(ensNode, tagHash, minter, []);
      });

      const registeredAddress = await resolveName(ensRegistry, fullTagName);
      expect(registeredAddress).to.eq(minter);
    });

    it("A minter can set reverse ENS record for their guild tag", async function () {
      const { ensGuilds, ensRegistry } = this.deployedContracts;
      const { ensNode, domain } = this.guildInfo;
      const { minter } = this.addresses;
      const reverseRegistrar = await getReverseRegistrar(ensRegistry);

      const tagToMint = "test";
      const tagHash = ensLabelHash(tagToMint);
      const fullTagName = `${tagToMint}.${domain}`;

      await asAccount(minter, async (signer) => {
        // claim the tag
        await ensGuilds.connect(signer).claimGuildTag(ensNode, tagHash, minter, []);

        // set the reverse record
        const tx = await reverseRegistrar.connect(signer).setName(fullTagName);
        await tx.wait();
      });

      // lookup the reverse record
      const reverseName = await getReverseName(ensRegistry, minter);
      expect(reverseName).to.eq(fullTagName);
    });
  });
}
