import { namehash } from "@ethersproject/hash";
import { expect } from "chai";
import { ethers, getNamedAccounts } from "hardhat";

import { AddrResolver__factory } from "../../types";
import { ensLabelHash, resolveName } from "../../utils";
import { asAccount } from "../utils";

export function testDomainOwnerControls(): void {
  describe("Domain Owner Controls", function () {
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

    it("Original domain owner still retains domain ownership after guild registration", async function () {
      const { ensRegistry } = this.deployedContracts;
      const { ensNameOwner, ensNode } = this.guildInfo;

      const observedDomainOwner = await ensRegistry.owner(ensNode);
      expect(observedDomainOwner).to.eq(ensNameOwner);
    });

    it("Original domain owner can backdoor-mint new subdomains off guild domain if needed", async function () {
      const { ensRegistry } = this.deployedContracts;
      const { ensNameOwner, ensNode, domain } = this.guildInfo;
      const { ensDefaultResolver: ensDefaultResolverAddr } = await getNamedAccounts();
      const ensDefaultResolver = AddrResolver__factory.connect(ensDefaultResolverAddr, ensRegistry.provider);
      const subdomain = `foo`;
      const subdomainHash = ensLabelHash(subdomain);
      const subdomainNode = namehash(`${subdomain}.${domain}`);
      const expectedSubdomainResolvesTo = ethers.Wallet.createRandom().address;

      // mint a subdomain using the default resolver
      await asAccount(ensNameOwner, async (signer) => {
        await ensRegistry
          .connect(signer)
          .setSubnodeRecord(ensNode, subdomainHash, ensNameOwner, ensDefaultResolverAddr, 0);
      });
      const subdomainOwner = await ensRegistry.owner(subdomainNode);
      expect(subdomainOwner).to.eq(ensNameOwner);

      // set the forward record for this new domain
      await asAccount(ensNameOwner, async (signer) => {
        await ensDefaultResolver
          .connect(signer)
          ["setAddr(bytes32,address)"](subdomainNode, expectedSubdomainResolvesTo);
      });

      // check that the new forward record was created correctly
      const subdomainResolvesTo = await resolveName(ensRegistry, `${subdomain}.${domain}`);
      expect(subdomainResolvesTo).to.eq(expectedSubdomainResolvesTo);
    });

    it("Original domain owner can edit or delete any existing guild tag ENS records if needed", async function () {
      const { ensRegistry, ensGuilds } = this.deployedContracts;
      const { ensNameOwner, ensNode, domain } = this.guildInfo;
      const { ensDefaultResolver: ensDefaultResolverAddr } = await getNamedAccounts();
      const ensDefaultResolver = AddrResolver__factory.connect(ensDefaultResolverAddr, ensRegistry.provider);
      const { minter } = this.addresses;
      const tagToMint = "spicy";
      const tagHash = ensLabelHash(tagToMint);
      const tagNode = namehash(`${tagToMint}.${domain}`);
      const expectedSubdomainResolvesTo = ethers.Wallet.createRandom().address;

      // mint a tag
      await asAccount(minter, async (signer) => {
        await ensGuilds.connect(signer).claimGuildTag(ensNode, tagHash, minter, []);
      });

      // domain owner can edit the tag in the ENS registry
      await asAccount(ensNameOwner, async (signer) => {
        await ensRegistry.connect(signer).setSubnodeRecord(ensNode, tagHash, ensNameOwner, ensDefaultResolverAddr, 0);
      });
      const newTagOwner = await ensRegistry.owner(tagNode);
      expect(newTagOwner).to.eq(ensNameOwner);

      // change the forward record for this domain
      await asAccount(ensNameOwner, async (signer) => {
        await ensDefaultResolver.connect(signer)["setAddr(bytes32,address)"](tagNode, expectedSubdomainResolvesTo);
      });

      // check that the forward record was edited correctly
      const subdomainResolvesTo = await resolveName(ensRegistry, `${tagToMint}.${domain}`);
      expect(subdomainResolvesTo).to.eq(expectedSubdomainResolvesTo);
    });
  });
}
