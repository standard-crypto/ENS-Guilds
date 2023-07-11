import { setBalance } from "@nomicfoundation/hardhat-network-helpers";
import { expect } from "chai";
import { ZeroAddress, ensNormalize, namehash, parseEther } from "ethers";
import { deployments, ethers, getNamedAccounts, getUnnamedAccounts } from "hardhat";

import {
  type ENS,
  type ENSGuilds,
  ENSGuilds__factory,
  type IENSGuilds,
  type IENSGuildsHumanized,
  IENSGuildsHumanized__factory,
  IENSGuilds__factory,
} from "../../../../types";
import { resolveAddr } from "../../../../utils";
import { asAccount } from "../../../utils";

export function testENSGuildsHumanized(): void {
  describe("ENSGuildsHumanized", () => {
    let ensGuildsHumanized: IENSGuildsHumanized;
    let ensGuildsOriginal: IENSGuilds;
    let ensGuildsImpl: ENSGuilds;
    let ens: ENS;

    const ensName = "standard-crypto.eth";
    const guildHash = namehash(ensName);
    let ensNameOwner: string;
    let flatFeePolicy: string;
    let openAuthPolicy: string;
    let allowlistAuthPolicy: string;
    let minter: string;

    const tagToMint = "test";

    beforeEach("setup", async function () {
      await deployments.fixture();

      const { ensRegistry } = await getNamedAccounts();
      [minter] = await getUnnamedAccounts();

      const ensGuildsDeployment = await deployments.get("ENSGuilds");
      const flatFeePolicyDeployment = await deployments.get("FlatFeePolicy");
      const openAuthPolicyDeployment = await deployments.get("OpenTagsAuthPolicy");
      const allowlistAuthPolicyDeployment = await deployments.get("AllowlistTagsAuthPolicy");

      // sanity-check that we don't have a denormalized version of the ENS name in our tests
      expect(ensName).to.eq(ensNormalize(ensName));

      ensGuildsHumanized = IENSGuildsHumanized__factory.connect(ensGuildsDeployment.address, ethers.provider);
      ensGuildsOriginal = IENSGuilds__factory.connect(ensGuildsDeployment.address, ethers.provider);
      ensGuildsImpl = ENSGuilds__factory.connect(ensGuildsDeployment.address, ethers.provider);
      ens = await ethers.getContractAt("ENS", ensRegistry);
      ensNameOwner = await ens.owner(guildHash);

      flatFeePolicy = flatFeePolicyDeployment.address;
      openAuthPolicy = openAuthPolicyDeployment.address;
      allowlistAuthPolicy = allowlistAuthPolicyDeployment.address;

      await setBalance(ensNameOwner, parseEther("100000000"));
      await setBalance(minter, parseEther("100000000"));

      await asAccount(ensNameOwner, async (signer) => {
        await ens.connect(signer).setApprovalForAll(ensGuildsHumanized.getAddress(), true);
      });
    });

    it("supports humanized deregisterGuild()", async function () {
      // Register guild
      await asAccount(ensNameOwner, async (signer) => {
        await ensGuildsOriginal.connect(signer).registerGuild(ensName, ensNameOwner, flatFeePolicy, openAuthPolicy);
      });

      // De-register guild
      await asAccount(ensNameOwner, async (signer) => {
        await ensGuildsHumanized.connect(signer).deregisterGuild(ensName);
      });

      // Check that correct guild was deregistered
      const guildAdmin = await ensGuildsOriginal.guildAdmin(guildHash);
      expect(guildAdmin).to.eq(ZeroAddress);
    });

    it("supports humanized claimGuildTag()", async function () {
      // Register guild
      await asAccount(ensNameOwner, async (signer) => {
        await ensGuildsOriginal.connect(signer).registerGuild(ensName, ensNameOwner, flatFeePolicy, openAuthPolicy);
      });

      // Mint a tag
      await asAccount(minter, async (signer) => {
        await ensGuildsHumanized.connect(signer).claimGuildTag(ensName, tagToMint, minter, "0x");
      });

      // Check correct tag owner
      const registeredAddress = await resolveAddr(ens, `${tagToMint}.${ensName}`);
      expect(registeredAddress).to.eq(minter);
    });

    it("supports humanized revokeGuildTag()");

    it("supports humanized updateGuildFeePolicy()");

    it("supports humanized updateGuildTagsAuthPolicy()", async function () {
      const authPolicyOld = openAuthPolicy;
      const authPolicyNew = allowlistAuthPolicy;

      // Register guild
      await asAccount(ensNameOwner, async (signer) => {
        await ensGuildsOriginal.connect(signer).registerGuild(ensName, ensNameOwner, flatFeePolicy, authPolicyOld);
      });

      // Change auth policy
      await asAccount(ensNameOwner, async (signer) => {
        await ensGuildsHumanized.connect(signer).updateGuildTagsAuthPolicy(ensName, authPolicyNew);
      });

      // Check current auth policy
      const { tagsAuthPolicy } = await ensGuildsImpl.guilds(guildHash);
      expect(tagsAuthPolicy).to.eq(authPolicyNew);
    });

    it("supports humanized setGuildTokenUriTemplate()");

    it("supports humanized setGuildActive()", async function () {
      // Register guild
      await asAccount(ensNameOwner, async (signer) => {
        await ensGuildsOriginal.connect(signer).registerGuild(ensName, ensNameOwner, flatFeePolicy, openAuthPolicy);
      });

      // Set guild inactive
      await asAccount(ensNameOwner, async (signer) => {
        await ensGuildsHumanized.connect(signer).setGuildActive(ensName, false);
      });

      // Check current auth policy
      const { active } = await ensGuildsImpl.guilds(guildHash);
      expect(active).to.be.false;
    });

    it("supports humanized guildAdmin()", async function () {
      // Register guild
      await asAccount(ensNameOwner, async (signer) => {
        await ensGuildsOriginal.connect(signer).registerGuild(ensName, ensNameOwner, flatFeePolicy, openAuthPolicy);
      });

      // lookup guild admin
      const guildAdmin = await ensGuildsHumanized.guildAdmin(ensName);
      expect(guildAdmin).to.eq(ensNameOwner);
    });

    it("supports humanized transferGuildAdmin()", async function () {
      const newAdmin = minter;

      // Register guild
      await asAccount(ensNameOwner, async (signer) => {
        await ensGuildsOriginal.connect(signer).registerGuild(ensName, ensNameOwner, flatFeePolicy, openAuthPolicy);
      });

      // transfer guild admin role
      await asAccount(ensNameOwner, async (signer) => {
        await ensGuildsHumanized.connect(signer).transferGuildAdmin(ensName, newAdmin);
      });

      // check new admin
      const observedAdmin = await ensGuildsOriginal.guildAdmin(guildHash);
      expect(observedAdmin).to.eq(newAdmin);
    });
  });
}
