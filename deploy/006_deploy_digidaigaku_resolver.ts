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
  const digiOffchainUrl = "https://storage.googleapis.com/digidagiaku-by-name/{data}.json";
  const digiContractAddress = "0xd1258DB6Ac08eB0e625B75b371C023dA478E94A9";

  // Digidaigaku
  await deploy("DigidaigakuResolver", {
    ...baseDeployArgs,
    args: [
      ensRegistry /* _ens */,
      ensNameWrapper /* wrapperAddress */,
      ensDomainOwner,
      digiContractAddress,
      digiOffchainUrl,
    ],
  });

  return true;
};
func.id = "006_deploy_digidaigaku_resolver";
export default func;
