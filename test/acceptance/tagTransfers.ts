import { expect } from "chai";
import { deployments, getNamedAccounts } from "hardhat";

import { type TagTestHelper, TagTestHelper__factory } from "../../types";
import { resolveAddr } from "../../utils";
import { asAccount } from "../utils";
import { findTransferSingleEvent } from "../utils/erc1155";
import { setTestUsesEnsNameWrapper } from "./utils";

export function testTagTransfers(): void {
  describe("Tag Transfers", function () {
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
  let tagTestHelper: TagTestHelper;
  beforeEach("Setup guild", async function () {
    const { ensGuilds, flatFeePolicy, openAuthPolicy } = this.deployedContracts;
    const { ensNameOwner, domain, admin } = this.guildInfo;

    // Set ENSGuilds contract as an ENS operator
    await this.approveGuildsAsEnsOperator();

    await asAccount(ensNameOwner, async (signer) => {
      // Register guild
      await ensGuilds
        .connect(signer)
        .registerGuild(domain, admin, flatFeePolicy.getAddress(), openAuthPolicy.getAddress());
    });
  });

  describe("happy path", function () {
    it("updates the ENS forward record", async function () {
      const { ensRegistry, ensGuilds } = this.deployedContracts;
      const { ensNode, domain } = this.guildInfo;
      const { minter, unauthorizedThirdParty: recipient } = this.addresses;
      // first, mint a tag
      const tagToMint = "test";
      const tagFullDomain = `${tagToMint}.${domain}`;
      await asAccount(minter, async (signer) => {
        await ensGuilds.connect(signer).claimGuildTag(ensNode, tagToMint, minter, "0x");
      });

      // Transfer the tag
      await asAccount(minter, async (signer) => {
        await ensGuilds.connect(signer).transferGuildTag(ensNode, tagToMint, recipient, "0x");
      });

      // Verify the tag resolves to the recipient address
      await expect(resolveAddr(ensRegistry, tagFullDomain)).to.eventually.eq(recipient);
    });

    it("transfers the corresponding tag NFT", async function () {
      const { ensRegistry, ensGuilds } = this.deployedContracts;
      const { ensNode, domain } = this.guildInfo;
      const { minter, unauthorizedThirdParty: recipient } = this.addresses;
      // first, mint a tag
      const tagToMint = "test";
      const tagFullDomain = `${tagToMint}.${domain}`;
      const claimTx = await asAccount(minter, async (signer) => {
        return await ensGuilds.connect(signer).claimGuildTag(ensNode, tagToMint, minter, "0x");
      });

      // Transfer the tag
      await asAccount(minter, async (signer) => {
        await ensGuilds.connect(signer).transferGuildTag(ensNode, tagToMint, recipient, "0x");
      });

      // look for the event that was logged for the new token mint
      const claimTxReceipt = await claimTx.wait();
      const mintEvent = findTransferSingleEvent(claimTxReceipt?.logs);

      // from the event, get the tokenID that was minted
      // check that the token contract says the recipient now owns that token
      const tokenId = mintEvent.args.id;
      const tokenBalance = await ensGuilds.balanceOf(recipient, tokenId);
      expect(tokenBalance).eq(1n);
    });
  });

  it("fails if tag does not exist", async function () {
    const { ensGuilds } = this.deployedContracts;
    const { ensNode, admin } = this.guildInfo;
    const { unauthorizedThirdParty: recipient } = this.addresses;

    const tagToNotMint = "test";

    // Transfering a tag that does not exist should fail
    await asAccount(admin, async (signer) => {
      const tx = ensGuilds.connect(signer).transferGuildTag(ensNode, tagToNotMint, recipient, "0x");
      await this.expectRevertedWithCustomError(tx, "TransferUnauthorized");
    });
  });

  it("fails if the auth policy does not permit the transfer", async function () {
    const { ensGuilds, ensRegistry } = this.deployedContracts;
    const { ensNode, admin } = this.guildInfo;
    const { minter, unauthorizedThirdParty: recipient } = this.addresses;
    const { deploy } = deployments;
    const { deployer } = await getNamedAccounts();
    const tagTestHelperDeployment = await deploy("TagTestHelper", {
      from: deployer,
      autoMine: true,
    });
    tagTestHelper = TagTestHelper__factory.connect(tagTestHelperDeployment.address, ensRegistry.runner);

    // first, mint a tag
    const tagToMint = "test";
    await asAccount(minter, async (signer) => {
      return await ensGuilds.connect(signer).claimGuildTag(ensNode, tagToMint, minter, "0x");
    });

    // Set new authorization policy that doesn't allow transfers
    await asAccount(admin, async (signer) => {
      await ensGuilds.connect(signer).updateGuildTagsAuthPolicy(ensNode, tagTestHelperDeployment.address);
    });

    // Transferring a tag with a policy that doesn't allow transfers should fail
    await asAccount(minter, async (signer) => {
      const tx = ensGuilds.connect(signer).transferGuildTag(ensNode, tagToMint, recipient, "0x");
      await this.expectRevertedWithCustomError(tx, "TransferUnauthorized");
    });
  });
}
