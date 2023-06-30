import { type DeployFunction } from "hardhat-deploy/types";
import { type HardhatRuntimeEnvironment } from "hardhat/types";

// Deploys a copy of all the contracts
const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployments, getNamedAccounts } = hre;
  const { deploy } = deployments;
  const { deployer, ensRegistry, ensNameWrapper } = await getNamedAccounts();

  const baseDeployArgs = {
    from: deployer,
    log: true,
    autoMine: hre.network.tags.test,
    deterministicDeployment: !hre.network.tags.test,
  };

  await deploy("Erc721WildcardResolver", {
    ...baseDeployArgs,
    args: [ensRegistry /* _ens */, ensNameWrapper /* wrapperAddress */],
  });

  return true;
};
func.id = "004_deploy_wildcard_resolver";
export default func;
