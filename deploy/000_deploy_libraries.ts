import { type DeployFunction, type DeploymentsExtension } from "hardhat-deploy/types";
import { type HardhatRuntimeEnvironment } from "hardhat/types";

// Deploys a copy of all the contracts
const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployments, getNamedAccounts } = hre;
  const { deploy } = deployments;
  const { deployer } = await getNamedAccounts();

  await deploy("NameEncoder", {
    from: deployer,
  });
  await deploy("ENSNamehash", {
    from: deployer,
  });
  await deploy("ENSByteUtils", {
    from: deployer,
  });
  await deploy("ENSParentName", {
    from: deployer,
  });
  await deploy("ERC165Checker", {
    from: deployer,
  });
  await deploy("StringParsing", {
    from: deployer,
  });
  await deploy("Strings", {
    from: deployer,
  });

  return true;
};
func.id = "000_deploy_libraries";

export async function getLibraries(deployments: DeploymentsExtension): Promise<Record<string, string>> {
  return {
    ERC165Checker: (await deployments.get("ERC165Checker")).address,
    StringParsing: (await deployments.get("StringParsing")).address,
    Strings: (await deployments.get("Strings")).address,
    NameEncoder: (await deployments.get("NameEncoder")).address,
    ENSNameHash: (await deployments.get("ENSNamehash")).address,
    ENSByteUtils: (await deployments.get("ENSByteUtils")).address,
    ENSParentName: (await deployments.get("ENSParentName")).address,
  };
}

export default func;
