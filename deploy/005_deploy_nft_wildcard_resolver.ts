import { namehash } from "ethers";
import { type DeployFunction } from "hardhat-deploy/types";
import { type HardhatRuntimeEnvironment } from "hardhat/types";

import { getLibraries } from "./000_deploy_libraries";

// Deploys a copy of all the contracts
const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployments, getNamedAccounts, ethers } = hre;
  const { deploy } = deployments;
  const { deployer, ensRegistry, ensNameWrapper } = await getNamedAccounts();

  const baseDeployArgs = {
    from: deployer,
    log: true,
    autoMine: hre.network.tags.test,
    deterministicDeployment: false,
    libraries: await getLibraries(deployments),
  };

  const ens = await ethers.getContractAt("ENS", ensRegistry);
  const ensDomainOwner = await ens.owner(namehash("standard-crypto.eth"));

  await deploy("Erc721WildcardResolver", {
    ...baseDeployArgs,
    args: [ensRegistry /* _ens */, ensNameWrapper /* wrapperAddress */, ensDomainOwner],
  });

  return true;
};
func.id = "005_deploy_nft_wildcard_resolver";
export default func;
