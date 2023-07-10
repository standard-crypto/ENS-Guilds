import { setBalance } from "@nomicfoundation/hardhat-network-helpers";
import { expect } from "chai";
import type { ContractTransactionResponse } from "ethers";
import { namehash, parseEther } from "ethers";
import { deployments, ethers, getNamedAccounts, getUnnamedAccounts } from "hardhat";

import { IENSGuilds__factory } from "../../types";
import { asAccount } from "../utils";
import { testAdminControls } from "./adminControls";
import { testDomainOwnerControls } from "./domainOwnerControls";
import { testEnsRecords } from "./ensRecords";
import { testGuildDeregistration } from "./guildDeregistration";
import { testGuildRegistration } from "./guildRegistration";
import { testMintAuthorization } from "./mintAuthorization";
import { testMintFees } from "./mintFees";
import { testNameWrapperSupport } from "./nameWrapperSupport";
import { testNFTFeatures } from "./nftFeatures";
import { testTagRevocation } from "./tagRevocation";
import { testTagTransfers } from "./tagTransfers";
import "./type-annotations";
import { testWildcardResolution } from "./wildcardResolution";

describe("Acceptance Tests", function () {
  beforeEach("Base acceptance test setup", async function () {
    await deployments.fixture();

    // Grab handles to all deployed contracts
    const { ensRegistry, ensNameWrapper } = await getNamedAccounts();
    const ensGuildsDeployment = await deployments.get("ENSGuilds");
    const nftAuthPolicyDeployment = await deployments.get("NFTTagsAuthPolicy");
    const allowlistAuthPolicyDeployment = await deployments.get("AllowlistTagsAuthPolicy");
    const openAuthPolicyDeployment = await deployments.get("OpenTagsAuthPolicy");
    const flatFeePolicyDeployment = await deployments.get("FlatFeePolicy");
    const erc721WildcardResolverDeployment = await deployments.get("Erc721WildcardResolver");

    const ensGuildsImpl = await ethers.getContractAt("ENSGuilds", ensGuildsDeployment.address);

    const ens = await ethers.getContractAt("ENS", ensRegistry);
    const nameWrapper = await ethers.getContractAt("INameWrapper", ensNameWrapper);

    this.deployedContracts = {
      ensRegistry: ens,
      ensNameWrapper: nameWrapper,

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
    this.usingNameWrapper = this.usingNameWrapper ?? false;
    const ensName = this.usingNameWrapper ? "agi.eth" : "standard-crypto.eth";
    const guildHash = namehash(ensName);
    const ensNameOwner = this.usingNameWrapper ? await nameWrapper.ownerOf(guildHash) : await ens.owner(guildHash);
    const [guildAdmin, minter, unauthorizedThirdParty] = await getUnnamedAccounts();

    this.guildInfo = {
      domain: ensName,
      ensNode: guildHash,
      ensNameOwner,
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

    this.approveGuildsAsEnsOperator = async (): Promise<void> => {
      const { ensGuilds, ensRegistry } = this.deployedContracts;
      const { ensNameOwner } = this.guildInfo;
      await asAccount(ensNameOwner, async (signer) => {
        if (this.usingNameWrapper) {
          await nameWrapper.connect(signer).setApprovalForAll(ensGuilds.getAddress(), true);
        } else {
          await ensRegistry.connect(signer).setApprovalForAll(ensGuilds.getAddress(), true);
        }
      });
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
  testTagTransfers.bind(this)();
  testWildcardResolution.bind(this)();
  testNameWrapperSupport.bind(this)();
});
