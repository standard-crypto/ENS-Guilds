import { setBalance } from "@nomicfoundation/hardhat-network-helpers";
import { expect } from "chai";
import type { ContractTransactionResponse } from "ethers";
import { namehash, parseEther } from "ethers";
import { deployments, ethers, getNamedAccounts, getUnnamedAccounts } from "hardhat";

import { IENSGuilds__factory } from "../../types";
import { testAdminControls } from "./adminControls";
import { testDomainOwnerControls } from "./domainOwnerControls";
import { testEnsRecords } from "./ensRecords";
import { testGuildDeregistration } from "./guildDeregistration";
import { testGuildRegistration } from "./guildRegistration";
import { testMintAuthorization } from "./mintAuthorization";
import { testMintFees } from "./mintFees";
import { testNFTFeatures } from "./nftFeatures";
import { testTagRevocation } from "./tagRevocation";
import "./type-annotations";
import { testWildcardResolution } from "./wildcardResolution";

describe("Acceptance Tests", function () {
  beforeEach("Base setup", async function () {
    await deployments.fixture();

    // Grab handles to all deployed contracts
    const { ensRegistry } = await getNamedAccounts();
    const ensGuildsDeployment = await deployments.get("ENSGuilds");
    const nftAuthPolicyDeployment = await deployments.get("NFTTagsAuthPolicy");
    const allowlistAuthPolicyDeployment = await deployments.get("AllowlistTagsAuthPolicy");
    const openAuthPolicyDeployment = await deployments.get("OpenTagsAuthPolicy");
    const flatFeePolicyDeployment = await deployments.get("FlatFeePolicy");
    const erc721WildcardResolverDeployment = await deployments.get("Erc721WildcardResolver");

    const ensGuildsImpl = await ethers.getContractAt("ENSGuilds", ensGuildsDeployment.address);

    const ens = await ethers.getContractAt("ENS", ensRegistry);

    this.deployedContracts = {
      ensRegistry: ens,

      ensGuilds: IENSGuilds__factory.connect(ensGuildsDeployment.address, ethers.provider),
      flatFeePolicy: await ethers.getContractAt("FlatFeePolicy", flatFeePolicyDeployment.address),
      openAuthPolicy: await ethers.getContractAt("OpenTagsAuthPolicy", openAuthPolicyDeployment.address),
      nftAuthPolicy: await ethers.getContractAt("NFTTagsAuthPolicy", nftAuthPolicyDeployment.address),
      allowlistAuthPolicy: await ethers.getContractAt("AllowlistTagsAuthPolicy", allowlistAuthPolicyDeployment.address),
      erc721WildcardResolver: await ethers.getContractAt(
        "Erc721WildcardResolver",
        erc721WildcardResolverDeployment.address,
      ),
    };

    // Setup basic info for a guild that is / will be registered
    const ensName = "standard-crypto.eth";
    const guildHash = namehash(ensName);
    const ensNameOwner = await ens.owner(guildHash);
    const [guildAdmin, minter, unauthorizedThirdParty] = await getUnnamedAccounts();

    this.guildInfo = {
      domain: ensName,
      ensNode: guildHash,
      ensNameOwner: await ens.owner(guildHash),
      admin: guildAdmin,
    };

    this.addresses = {
      minter,
      unauthorizedThirdParty,
    };

    // Fund plenty of gas for some important accounts
    await setBalance(ensNameOwner, parseEther("100000000"));
    await setBalance(guildAdmin, parseEther("100000000"));
    await setBalance(minter, parseEther("100000000"));
    await setBalance(unauthorizedThirdParty, parseEther("100000000"));

    this.expectRevertedWithCustomError = async (
      tx: Promise<ContractTransactionResponse>,
      customErrorName: string,
    ): Promise<void> => {
      await expect(tx).to.be.revertedWithCustomError(ensGuildsImpl, customErrorName);
    };
  });

  testGuildRegistration.bind(this)();
  testMintAuthorization.bind(this)();
  testEnsRecords.bind(this)();
  testMintFees.bind(this)();
  testNFTFeatures.bind(this)();
  testAdminControls.bind(this)();
  testDomainOwnerControls.bind(this)();
  testGuildDeregistration.bind(this)();
  testTagRevocation.bind(this)();
  testWildcardResolution.bind(this)();
});
