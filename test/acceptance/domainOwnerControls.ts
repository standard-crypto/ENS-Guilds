import { expect } from "chai";
import { namehash } from "ethers";
import { ethers, getNamedAccounts } from "hardhat";

import { AddrResolver__factory } from "../../types";
import { ensLabelHash, resolveAddr } from "../../utils";
import { asAccount } from "../utils";
import { setTestUsesEnsNameWrapper } from "./utils";

export function testDomainOwnerControls(): void {
  describe("Domain Owner Controls", function () {
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

  it("Original domain owner still retains domain ownership after guild registration", async function () {
    const { ensRegistry, ensNameWrapper } = this.deployedContracts;
    const { ensNameOwner, ensNode } = this.guildInfo;

    const observedDomainOwner = this.usingNameWrapper
      ? await ensNameWrapper.ownerOf(ensNode)
      : await ensRegistry.owner(ensNode);
    expect(observedDomainOwner).to.eq(ensNameOwner);
  });

  it("Original domain owner can backdoor-mint new subdomains off guild domain if needed", async function () {
    const { ensRegistry, ensNameWrapper } = this.deployedContracts;
    const { ensNameOwner, ensNode, domain } = this.guildInfo;
    const { ensDefaultResolver: ensDefaultResolverAddr } = await getNamedAccounts();
    const ensDefaultResolver = AddrResolver__factory.connect(ensDefaultResolverAddr, ethers.provider);
    const subdomain = `foo`;
    const subdomainHash = ensLabelHash(subdomain);
    const subdomainNode = namehash(`${subdomain}.${domain}`);
    const expectedSubdomainResolvesTo = ethers.Wallet.createRandom().address;

    // mint a subdomain using the default resolver
    await asAccount(ensNameOwner, async (signer) => {
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
    const subdomainOwner = this.usingNameWrapper
      ? await ensNameWrapper.ownerOf(subdomainNode)
      : await ensRegistry.owner(subdomainNode);
    expect(subdomainOwner).to.eq(ensNameOwner);

    // set the forward record for this new domain
    await asAccount(ensNameOwner, async (signer) => {
      await ensDefaultResolver.connect(signer)["setAddr(bytes32,address)"](subdomainNode, expectedSubdomainResolvesTo);
    });

    // check that the new forward record was created correctly
    // console.log(subdomain, domain, ensRegistry.address);
    const subdomainResolvesTo = await resolveAddr(ensRegistry, `${subdomain}.${domain}`);

    expect(subdomainResolvesTo).to.eq(expectedSubdomainResolvesTo);
  });

  it("Original domain owner can edit or delete any existing guild tag ENS records if needed", async function () {
    const { ensRegistry, ensGuilds, ensNameWrapper } = this.deployedContracts;
    const { ensNameOwner, ensNode, domain } = this.guildInfo;
    const { ensDefaultResolver: ensDefaultResolverAddr } = await getNamedAccounts();
    const ensDefaultResolver = AddrResolver__factory.connect(ensDefaultResolverAddr, ensRegistry.runner);
    const { minter } = this.addresses;
    const tagToMint = "spicy";
    const tagHash = ensLabelHash(tagToMint);
    const tagNode = namehash(`${tagToMint}.${domain}`);
    const expectedSubdomainResolvesTo = ethers.Wallet.createRandom().address;

    // mint a tag
    await asAccount(minter, async (signer) => {
      await ensGuilds.connect(signer).claimGuildTag(ensNode, tagToMint, minter, "0x");
    });

    // domain owner can edit the tag in the ENS registry
    await asAccount(ensNameOwner, async (signer) => {
      if (this.usingNameWrapper) {
        await ensNameWrapper
          .connect(signer)
          .setSubnodeRecord(ensNode, tagToMint, ensNameOwner, ensDefaultResolverAddr, 0, 0, 0);
      } else {
        await ensRegistry.connect(signer).setSubnodeRecord(ensNode, tagHash, ensNameOwner, ensDefaultResolverAddr, 0);
      }
    });
    const newTagOwner = this.usingNameWrapper
      ? await ensNameWrapper.ownerOf(tagNode)
      : await ensRegistry.owner(tagNode);
    expect(newTagOwner).to.eq(ensNameOwner);

    // change the forward record for this domain
    await asAccount(ensNameOwner, async (signer) => {
      await ensDefaultResolver.connect(signer)["setAddr(bytes32,address)"](tagNode, expectedSubdomainResolvesTo);
    });

    // check that the forward record was edited correctly
    const subdomainResolvesTo = await resolveAddr(ensRegistry, `${tagToMint}.${domain}`);
    expect(subdomainResolvesTo).to.eq(expectedSubdomainResolvesTo);
  });
}
