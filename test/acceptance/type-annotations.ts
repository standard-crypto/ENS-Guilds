import type { ContractTransaction } from "ethers";

import type { ENS, FlatFeePolicy, IENSGuilds, NFTTagsAuthPolicy } from "../../types";

declare module "mocha" {
  export interface Context {
    deployedContracts: {
      ensGuilds: IENSGuilds;
      nftAuthPolicy: NFTTagsAuthPolicy;
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
    };

    expectRevertedWithCustomError: (tx: Promise<ContractTransaction>, customErrorName: string) => Promise<void>;
  }
}
