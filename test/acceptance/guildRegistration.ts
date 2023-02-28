import { expect } from "chai";
import { namehash } from "ethers/lib/utils";

import { ensLabelHash } from "../../utils";
import { asAccount } from "../utils";

export function testGuildRegistration(): void {
  describe("Guild Registration", function () {
    it("A domain owner can register their domain for minting", async function () {
      const { ensRegistry, ensGuilds, flatFeePolicy, nftAuthPolicy } = this.deployedContracts;
      const { ensNameOwner, ensNode, admin } = this.guildInfo;

      await asAccount(ensNameOwner, async (signer) => {
        // Set ENSGuilds contract as the new ENS resolver
        await ensRegistry.connect(signer).setResolver(ensNode, ensGuilds.address);

        // Register guild
        await ensGuilds.connect(signer).registerGuild(ensNode, admin, flatFeePolicy.address, nftAuthPolicy.address);
      });
    });

    it("A subdomain owner can register their domain for minting", async function () {
      const { ensRegistry, ensGuilds, flatFeePolicy, nftAuthPolicy } = this.deployedContracts;
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
        await ensGuilds.connect(signer).registerGuild(guildHash, admin, flatFeePolicy.address, nftAuthPolicy.address);
      });
    });
  });
}
