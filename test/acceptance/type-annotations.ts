import type { ENS, ENSGuilds, FlatFeePolicy, NFTTagsAuthPolicy } from "../../types";

declare module "mocha" {
  export interface Context {
    deployedContracts: {
      ensGuilds: ENSGuilds;
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
  }
}
