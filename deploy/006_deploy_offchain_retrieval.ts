import { namehash } from "ethers";
import { type DeployFunction } from "hardhat-deploy/types";
import { type HardhatRuntimeEnvironment } from "hardhat/types";

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

  const ens = await ethers.getContractAt("ENS", ensRegistry);
  const ensDomainOwner = await ens.owner(namehash("standard-crypto.eth"));

  // Digidaigaku
  await deploy("DigidaigakuResolver", {
    ...baseDeployArgs,
    // TODO: don't use a stub here
    args: [ensRegistry /* _ens */, ensNameWrapper /* wrapperAddress */, ensDomainOwner],
  });

  return true;
};
func.id = "006_deploy_offchain_retrieval";
export default func;
