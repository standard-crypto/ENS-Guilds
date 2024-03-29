import { expect } from "chai";
import { deployments, getNamedAccounts, getUnnamedAccounts } from "hardhat";

import { TestERC721__factory } from "../../types";
import { resolveAddr } from "../../utils";
import { asAccount } from "../utils";
import { setTestUsesEnsNameWrapper } from "./utils";

export function testWildcardResolution(): void {
  describe("Wildcard Resolution", function () {
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

  it("works for ERC721 token owner wildcard lookups", async function () {
    const { deployer } = await getNamedAccounts();
    const { ensGuilds, erc721WildcardResolver, ensRegistry } = this.deployedContracts;
    const { admin, ensNode, domain, ensNameOwner } = this.guildInfo;

    // Deploy an ERC721 contract
    const tokenDeployment = await deployments.deploy("TestERC721", {
      from: deployer,
      autoMine: true,
      args: ["TestToken", "TEST"],
    });
    const tokenContract = TestERC721__factory.connect(tokenDeployment.address, ensGuilds.runner);

    // ENS name owner configures the wildcard resolver for their parent name
    const originalResolver = await ensRegistry.resolver(ensNode);
    await asAccount(ensNameOwner, async (signer) => {
      await erc721WildcardResolver
        .connect(signer)
        .setTokenContract(domain, tokenContract.getAddress(), originalResolver);
    });

    // Guild admin sets the wildcard resolver for their guild
    await asAccount(admin, async (signer) => {
      await ensGuilds.connect(signer).setFallbackResolver(ensNode, erc721WildcardResolver.getAddress());
    });

    // Mint a token to someone
    const tokenId = 123;
    const [tokenOwner] = await getUnnamedAccounts();
    await asAccount(admin, async (signer) => {
      await tokenContract.connect(signer).mint(tokenOwner, tokenId);
    });

    // Check the wildcard resolver now correctly resolves [token-id].[guild-name].eth
    const resolvedAddr = await resolveAddr(ensRegistry, `${tokenId}.${domain}`);
    expect(resolvedAddr).to.eq(tokenOwner);
  });

  it("regular guild tag resolution still works if wildcard resolver is active", async function () {
    const { ensGuilds, erc721WildcardResolver, ensRegistry } = this.deployedContracts;
    const { admin, ensNode, domain } = this.guildInfo;
    const { minter } = this.addresses;

    // Guild admin sets the wildcard resolver for their guild
    await asAccount(admin, async (signer) => {
      await ensGuilds.connect(signer).setFallbackResolver(ensNode, erc721WildcardResolver.getAddress());
    });

    // mint a tag
    const tagToMint = "test";
    const fullTagName = `${tagToMint}.${domain}`;
    await asAccount(minter, async (signer) => {
      await ensGuilds.connect(signer).claimGuildTag(ensNode, tagToMint, minter, "0x");
    });
    const registeredAddress = await resolveAddr(ensRegistry, fullTagName);
    expect(registeredAddress).to.eq(minter);
  });

  it("non-guild-admin cannot set a wildcard resolver", async function () {
    const { ensGuilds, erc721WildcardResolver } = this.deployedContracts;
    const { ensNameOwner, ensNode } = this.guildInfo;
    const { unauthorizedThirdParty } = this.addresses;

    // Third party setting the wildcard resolver should fail
    await asAccount(unauthorizedThirdParty, async (signer) => {
      const tx = ensGuilds.connect(signer).setFallbackResolver(ensNode, erc721WildcardResolver.getAddress());
      await this.expectRevertedWithCustomError(tx, "GuildAdminOnly");
    });

    // Owner setting the wildcard resolver should fail
    await asAccount(ensNameOwner, async (signer) => {
      const tx = ensGuilds.connect(signer).setFallbackResolver(ensNode, erc721WildcardResolver.getAddress());
      await this.expectRevertedWithCustomError(tx, "GuildAdminOnly");
    });
  });
}
