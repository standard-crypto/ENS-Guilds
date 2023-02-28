import type { ContractTransaction } from "ethers";

import type {
  AllowlistTagsAuthPolicy,
  ENS,
  FlatFeePolicy,
  IENSGuilds,
  NFTTagsAuthPolicy,
  OpenTagsAuthPolicy,
} from "../../types";

declare module "mocha" {
  export interface Context {
    deployedContracts: {
      ensGuilds: IENSGuilds;
      nftAuthPolicy: NFTTagsAuthPolicy;
      allowlistAuthPolicy: AllowlistTagsAuthPolicy;
      openAuthPolicy: OpenTagsAuthPolicy;
      flatFeePolicy: FlatFeePolicy;
      ensRegistry: ENS;
    };

    guildInfo: {
      domain: string;
      ensNode: string;
      ensNameOwner: string;
      admin: string;
    };

    addresses: {
      unauthorizedThirdParty: string;
      minter: string;
    };

    expectRevertedWithCustomError: (tx: Promise<ContractTransaction>, customErrorName: string) => Promise<void>;
  }
}
