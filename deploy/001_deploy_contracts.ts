import { type DeployFunction } from "hardhat-deploy/types";
import { type HardhatRuntimeEnvironment } from "hardhat/types";

// Deploys a copy of all the contracts
const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployments, getNamedAccounts } = hre;
  const { deploy } = deployments;
  const { deployer, ensRegistry, ensDefaultResolver } = await getNamedAccounts();

  const baseDeployArgs = {
    from: deployer,
    log: true,
    autoMine: hre.network.tags.test,
    deterministicDeployment: !hre.network.tags.test,
  };

  // ENSGuilds
  const ensGuildsDeployment = await deploy("ENSGuilds", {
    ...baseDeployArgs,
    args: ["stubMetadataUri", ensRegistry, ensDefaultResolver],
  });

  // NFTTagsAuthPolicy
  await deploy("NFTTagsAuthPolicy", {
    ...baseDeployArgs,
    args: [ensGuildsDeployment.address],
  });

  // FlatFeePolicy
  await deploy("FlatFeePolicy", {
    ...baseDeployArgs,
    args: [ensGuildsDeployment.address],
  });

  return true;
};
func.id = "001_deploy_contracts";
export default func;
