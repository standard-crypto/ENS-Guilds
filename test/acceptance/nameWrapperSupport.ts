import { expect } from "chai";
import { ZeroAddress, namehash } from "ethers";
import { deployments, getNamedAccounts } from "hardhat";

import { ensLabelHash, resolveAddr } from "../../utils";
import { asAccount } from "../utils";

type Fixture = () => Promise<void>;

export function testNameWrapperSupport(): void {
  describe("NameWrapper Support", function () {
    const tagToMint = "test";
    const wrappedEnsName = "agi.eth";
    const ensNode = namehash(wrappedEnsName);
    let ensNameOwner: string;

    let guildRegistered: Fixture;
    let tagMinted: Fixture;

    beforeEach("check name owner", async function () {
      const { ensRegistry, ensNameWrapper } = this.deployedContracts;
      ensNameOwner = await ensRegistry.owner(ensNode);

      // sanity-check that this name uses ENS wrapper
      expect(ensNameOwner).to.eq(await ensNameWrapper.getAddress());

      ensNameOwner = await ensNameWrapper.ownerOf(ensNode);
    });

    it("Names registered with the ENS NameWrapper can be used as guilds", async function () {
      guildRegistered = deployments.createFixture(async (): Promise<void> => {
        const { ensGuilds, ensNameWrapper, flatFeePolicy, openAuthPolicy } = this.deployedContracts;

        // Register a guild for this wrapped ENS name
        await asAccount(ensNameOwner, async (signer) => {
          await ensNameWrapper.connect(signer).setApprovalForAll(ensGuilds.getAddress(), true);

          await ensGuilds
            .connect(signer)
            .registerGuild(wrappedEnsName, ensNameOwner, flatFeePolicy.getAddress(), openAuthPolicy.getAddress());
        });
      });
      await guildRegistered();
    });

    it("Users can mint tags off of wrapped guild domains", async function () {
      const { ensRegistry, ensGuilds } = this.deployedContracts;
      const { minter } = this.addresses;

      tagMinted = deployments.createFixture(async (): Promise<void> => {
        await guildRegistered();

        // claim a tag
        await asAccount(minter, async (signer) => {
          await ensGuilds.connect(signer).claimGuildTag(ensNode, tagToMint, minter, "0x");
        });
      });

      await tagMinted();

      // check the ENS name resolution
      await expect(resolveAddr(ensRegistry, `${tagToMint}.${wrappedEnsName}`)).to.eventually.eq(minter);

      // check the tag owner
      await expect(ensGuilds.tagOwner(ensNode, ensLabelHash(tagToMint))).to.eventually.eq(minter);
    });

    it("Unclaimed tags appear as owned by the zero address", async function () {
      const { ensGuilds } = this.deployedContracts;
      await guildRegistered();
      await expect(ensGuilds.tagOwner(ensNode, ensLabelHash("unclaimed-tag"))).to.eventually.eq(ZeroAddress);
    });

    it("User cannot mint a tag if its full name was already registered in ENS", async function () {
      const { ensNameWrapper, ensGuilds } = this.deployedContracts;
      const { ensDefaultResolver: ensDefaultResolverAddr } = await getNamedAccounts();
      const { minter } = this.addresses;

      await guildRegistered();

      // Register a subdomain using NameWrapper directly
      await asAccount(ensNameOwner, async (signer) => {
        await ensNameWrapper
          .connect(signer)
          .setSubnodeRecord(
            ensNode,
            tagToMint,
            ensNameOwner,
            ensDefaultResolverAddr,
            0 /* ttl */,
            0 /* fuses */,
            0 /* expiry */,
          );
      });

      // Attempt to claim that tag
      await asAccount(minter, async (signer) => {
        const tx = ensGuilds.connect(signer).claimGuildTag(ensNode, tagToMint, minter, "0x");
        await this.expectRevertedWithCustomError(tx, "TagAlreadyClaimed");
      });
    });

    it("User cannot mint an existing tag that has not been revoked", async function () {
      const { ensGuilds } = this.deployedContracts;
      const { minter } = this.addresses;

      await tagMinted();

      // Attempt to mint the same tag
      await asAccount(minter, async (signer) => {
        const tx = ensGuilds.connect(signer).claimGuildTag(ensNode, tagToMint, minter, "0x");
        await this.expectRevertedWithCustomError(tx, "TagAlreadyClaimed");
      });
    });
  });
}
