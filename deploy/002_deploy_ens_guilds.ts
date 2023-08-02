import { namehash } from "ethers";
import { type DeployFunction } from "hardhat-deploy/types";
import { type HardhatRuntimeEnvironment } from "hardhat/types";

import { GuildsResolver__factory } from "../types";

// Deploys a copy of all the contracts
const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployments, getNamedAccounts, ethers } = hre;
  const { deploy } = deployments;
  const { deployer, ensRegistry, ensNameWrapper } = await getNamedAccounts();

  const baseDeployArgs = {
    from: deployer,
    log: true,
    autoMine: hre.network.tags.test,
    deterministicDeployment: !hre.network.tags.test,
  };

  const guildsResolverDeployment = await deployments.get("GuildsResolver");

  const ens = await ethers.getContractAt("ENS", ensRegistry);
  const ensDomainOwner = await ens.owner(namehash("standard-crypto.eth"));

  // ENSGuilds
  const ensGuildsDeployment = await deploy("ENSGuilds", {
    ...baseDeployArgs,
    // TODO: don't use a stub here
    args: ["stubMetadataUri", ensRegistry, ensNameWrapper, guildsResolverDeployment.address, ensDomainOwner],
  });

  // Initialize the GuildTagsResolver with the address of the base ENSGuilds contract
  const guildTagsResolver = GuildsResolver__factory.connect(
    guildsResolverDeployment.address,
    await ethers.getSigner(deployer),
  );
  await guildTagsResolver.initialize(ensGuildsDeployment.address);

  return true;
};
func.id = "002_deploy_ens_guilds";
export default func;
