import type { ENS, ENSGuilds, FlatFeePolicy, IBaseRegistrar, NFTTagsAuthPolicy } from "../../types";

declare module "mocha" {
  export interface Context {
    deployedContracts: {
      ensGuilds: ENSGuilds;
      nftAuthPolicy: NFTTagsAuthPolicy;
      flatFeePolicy: FlatFeePolicy;
      ensRegistry: ENS;
      ensRegistrar: IBaseRegistrar;
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
  }
}
