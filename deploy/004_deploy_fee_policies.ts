import { namehash } from "ethers";
import { type DeployFunction } from "hardhat-deploy/types";
import { type HardhatRuntimeEnvironment } from "hardhat/types";

import { getLibraries } from "./000_deploy_libraries";

// Deploys a copy of all the contracts
const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployments, getNamedAccounts, ethers } = hre;
  const { deploy } = deployments;
  const { deployer, ensRegistry } = await getNamedAccounts();

  const baseDeployArgs = {
    from: deployer,
    log: true,
    autoMine: hre.network.tags.test,
    deterministicDeployment: false,
    libraries: await getLibraries(deployments),
  };

  const ensGuildsDeployment = await deployments.get("ENSGuilds");

  const ens = await ethers.getContractAt("ENS", ensRegistry);
  const ensDomainOwner = await ens.owner(namehash("standard-crypto.eth"));

  // FlatFeePolicy
  await deploy("FlatFeePolicy", {
    ...baseDeployArgs,
    args: [ensRegistry, ensGuildsDeployment.address, ensDomainOwner],
  });

  return true;
};
func.id = "004_deploy_fee_policies";
export default func;
