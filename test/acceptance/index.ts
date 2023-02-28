import { namehash, parseEther } from "ethers/lib/utils";
import { deployments, ethers, getNamedAccounts, getUnnamedAccounts } from "hardhat";

import { ENS__factory } from "../../types";
import { setBalance } from "../utils";
import { testGuildRegistration } from "./guildRegistration";

describe("Acceptance Tests", function () {
  beforeEach("Base setup", async function () {
    await deployments.fixture();

    // Grab handles to all deployed contracts
    const { ensRegistry, ensRegistrar } = await getNamedAccounts();
    const ensGuildsDeployment = await deployments.get("ENSGuilds");
    const nftAuthPolicyDeployment = await deployments.get("NFTTagsAuthPolicy");
    const flatFeePolicyDeployment = await deployments.get("FlatFeePolicy");

    const ens = await ethers.getContractAt("ENS", ensRegistry);
    const ensRegistrarContract = await ethers.getContractAt("IBaseRegistrar", ensRegistrar);

    this.deployedContracts = {
      ensRegistry: ens,
      ensRegistrar: ensRegistrarContract,

      ensGuilds: await ethers.getContractAt("ENSGuilds", ensGuildsDeployment.address),
      flatFeePolicy: await ethers.getContractAt("FlatFeePolicy", flatFeePolicyDeployment.address),
      nftAuthPolicy: await ethers.getContractAt("NFTTagsAuthPolicy", nftAuthPolicyDeployment.address),
    };

    // Setup basic info for a guild that is / will be registered
    const ensName = "standard-crypto.eth";
    const guildHash = namehash(ensName);
    const ensNameOwner = await ens.owner(guildHash);
    const [guildAdmin, unauthorizedThirdParty] = await getUnnamedAccounts();

    this.guildInfo = {
      domain: ensName,
      ensNode: guildHash,
      ensNameOwner: await ens.owner(guildHash),
      admin: guildAdmin,
    };

    this.addresses = {
      unauthorizedThirdParty,
    };

    // Fund plenty of gas for some important accounts
    await setBalance(ensNameOwner, parseEther("100000000"));
    await setBalance(guildAdmin, parseEther("100000000"));
    await setBalance(unauthorizedThirdParty, parseEther("100000000"));
  });

  testGuildRegistration.bind(this)();
});
