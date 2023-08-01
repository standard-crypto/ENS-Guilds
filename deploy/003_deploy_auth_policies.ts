import { type DeployFunction } from "hardhat-deploy/types";
import { type HardhatRuntimeEnvironment } from "hardhat/types";

// Deploys a copy of all the contracts
const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployments, getNamedAccounts } = hre;
  const { deploy } = deployments;
  const { deployer, ensRegistry } = await getNamedAccounts();

  const baseDeployArgs = {
    from: deployer,
    log: true,
    autoMine: hre.network.tags.test,
    deterministicDeployment: !hre.network.tags.test,
  };

  const ensGuildsDeployment = await deployments.get("ENSGuilds");

  // NFTTagsAuthPolicy
  await deploy("NFTTagsAuthPolicy", {
    ...baseDeployArgs,
    args: [ensRegistry, ensGuildsDeployment.address],
  });

  // AllowlistTagsAuthPolicy
  await deploy("AllowlistTagsAuthPolicy", {
    ...baseDeployArgs,
    args: [ensRegistry, ensGuildsDeployment.address],
  });

  // OpenTagsAuthPolicy
  await deploy("OpenTagsAuthPolicy", {
    ...baseDeployArgs,
    args: [ensRegistry],
  });

  return true;
};
func.id = "003_deploy_auth_policies";
export default func;
