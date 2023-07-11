import { type DeployFunction } from "hardhat-deploy/types";
import { type HardhatRuntimeEnvironment } from "hardhat/types";

// Deploys a copy of all the contracts
const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployments, getNamedAccounts } = hre;
  const { deploy } = deployments;
  const { deployer } = await getNamedAccounts();

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
    args: [ensGuildsDeployment.address],
  });

  // AllowlistTagsAuthPolicy
  await deploy("AllowlistTagsAuthPolicy", {
    ...baseDeployArgs,
    args: [ensGuildsDeployment.address],
  });

  // OpenTagsAuthPolicy
  await deploy("OpenTagsAuthPolicy", {
    ...baseDeployArgs,
    args: [],
  });

  return true;
};
func.id = "003_deploy_auth_policies";
export default func;
