import "@nomicfoundation/hardhat-toolbox";
import { config as dotenvConfig } from "dotenv";
import "hardhat-dependency-compiler";
import "hardhat-deploy";
import type { HardhatUserConfig } from "hardhat/config";
import type { HttpNetworkUserConfig, NetworkUserConfig } from "hardhat/types";
import { resolve } from "path";

import "./tasks/accounts";

const dotenvConfigPath: string = "./.env";
dotenvConfig({ path: resolve(__dirname, dotenvConfigPath) });

// Ensure that we have all the environment variables we need.
const mnemonic: string | undefined = process.env.MNEMONIC;
if (mnemonic === undefined || mnemonic.length === 0) {
  // eslint-disable-next-line no-console
  console.error("Please set your MNEMONIC in a .env file");
}

const infuraApiKey: string | undefined = process.env.INFURA_API_KEY;
if (infuraApiKey === undefined || infuraApiKey.length === 0) {
  // eslint-disable-next-line no-console
  console.error("Please set your INFURA_API_KEY in a .env file");
}

const chainIds = {
  "arbitrum-mainnet": 42161,
  avalanche: 43114,
  bsc: 56,
  hardhat: 31337,
  mainnet: 1,
  "optimism-mainnet": 10,
  "polygon-mainnet": 137,
  "polygon-mumbai": 80001,
  sepolia: 11155111,
  goerli: 5,
};

function getChainConfig(chain: keyof typeof chainIds): NetworkUserConfig {
  let jsonRpcUrl: string;
  let accounts: NetworkUserConfig["accounts"] = {
    count: 10,
    mnemonic,
    path: "m/44'/60'/0'/0",
  };
  let deployerPrivKey: string | undefined;
  switch (chain) {
    case "avalanche":
      jsonRpcUrl = "https://api.avax.network/ext/bc/C/rpc";
      break;
    case "bsc":
      jsonRpcUrl = "https://bsc-dataseed1.binance.org";
      break;
    case "goerli":
      deployerPrivKey = process.env.DEPLOYER_GOERLI_PRIVATE_KEY;

      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      jsonRpcUrl = `https://${chain}.infura.io/v3/${infuraApiKey!}`;

      // eslint-disable-next-line no-extra-boolean-cast, @typescript-eslint/strict-boolean-expressions
      accounts = !!deployerPrivKey ? [deployerPrivKey] : [];
      break;
    case "mainnet":
      deployerPrivKey = process.env.DEPLOYER_MAINNET_PRIVATE_KEY;

      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      jsonRpcUrl = `https://${chain}.infura.io/v3/${infuraApiKey!}`;

      // eslint-disable-next-line no-extra-boolean-cast, @typescript-eslint/strict-boolean-expressions
      accounts = !!deployerPrivKey ? [deployerPrivKey] : [];
      break;
    default:
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      jsonRpcUrl = `https://${chain}.infura.io/v3/${infuraApiKey!}`;
  }
  return {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    accounts: accounts as any,
    chainId: chainIds[chain],
    url: jsonRpcUrl,
  };
}

const config: HardhatUserConfig = {
  defaultNetwork: "hardhat",
  etherscan: {
    apiKey: {
      /* spell-checker: disable */
      arbitrumOne: process.env.ARBISCAN_API_KEY ?? "",
      avalanche: process.env.SNOWTRACE_API_KEY ?? "",
      bsc: process.env.BSCSCAN_API_KEY ?? "",
      mainnet: process.env.ETHERSCAN_API_KEY ?? "",
      optimisticEthereum: process.env.OPTIMISM_API_KEY ?? "",
      polygon: process.env.POLYGONSCAN_API_KEY ?? "",
      polygonMumbai: process.env.POLYGONSCAN_API_KEY ?? "",
      sepolia: process.env.ETHERSCAN_API_KEY ?? "",
      /* spell-checker: enable */
    },
  },
  gasReporter: {
    currency: "USD",
    enabled: !(process.env.REPORT_GAS == null),
    excludeContracts: [],
    src: "./contracts",
  },
  namedAccounts: {
    deployer: {
      default: 0,
    },
    ensRegistry: {
      default: "0x00000000000C2E074eC69A0dFb2997BA6C7d2e1e",
    },
    ensDefaultResolver: {
      default: "0x231b0Ee14048e9dCcD1d247744d114a4EB5E8E63",
      goerli: "0x4B1488B7a6B320d2D721406204aBc3eeAa9AD329",
    },
    ensNameWrapper: {
      default: "0xD4416b13d2b3a9aBae7AcD5D6C2BbDBE25686401",
      goerli: "0x114D4603199df73e7D157787f8778E21fCd13066",
    },
  },
  networks: {
    hardhat: {
      chainId: chainIds.hardhat,
      tags: ["test"],
      hardfork: "london",
      forking: {
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        url: (getChainConfig("mainnet") as HttpNetworkUserConfig).url!,
        blockNumber: 17575698,
      },
    },
    arbitrum: getChainConfig("arbitrum-mainnet"),
    avalanche: getChainConfig("avalanche"),
    bsc: getChainConfig("bsc"),
    mainnet: getChainConfig("mainnet"),
    optimism: getChainConfig("optimism-mainnet"),
    "polygon-mainnet": getChainConfig("polygon-mainnet"),
    "polygon-mumbai": getChainConfig("polygon-mumbai"),
    sepolia: getChainConfig("sepolia"),
    goerli: getChainConfig("goerli"),
  },
  paths: {
    artifacts: "./artifacts",
    cache: "./cache",
    sources: "./contracts",
    tests: "./test",
  },
  solidity: {
    version: "0.8.17",
    settings: {
      metadata: {
        // Not including the metadata hash
        // https://github.com/paulrberg/hardhat-template/issues/31
        bytecodeHash: "none",
      },
      // Disable the optimizer when debugging
      // https://hardhat.org/hardhat-network/#solidity-optimizer-support
      optimizer: {
        enabled: true,
        runs: 800,
      },
    },
  },
  typechain: {
    outDir: "types",
    target: "ethers-v6",
  },
  dependencyCompiler: {
    paths: [
      "@ensdomains/ens-contracts/contracts/reverseRegistrar/IReverseRegistrar.sol",
      "@ensdomains/ens-contracts/contracts/resolvers/profiles/INameResolver.sol",
      "@ensdomains/ens-contracts/contracts/resolvers/profiles/AddrResolver.sol",
      "@ensdomains/ens-contracts/contracts/resolvers/profiles/ITextResolver.sol",
      "@ensdomains/ens-contracts/contracts/resolvers/profiles/IPubkeyResolver.sol",
    ],
  },
};

export default config;
