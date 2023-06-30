import type { ContractTransactionResponse } from "ethers";

import type {
  AllowlistTagsAuthPolicy,
  ENS,
  Erc721WildcardResolver,
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
      erc721WildcardResolver: Erc721WildcardResolver;
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

    expectRevertedWithCustomError: (tx: Promise<ContractTransactionResponse>, customErrorName: string) => Promise<void>;
  }
}
