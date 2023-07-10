import type { ContractTransactionResponse } from "ethers";

import type {
  AllowlistTagsAuthPolicy,
  ENS,
  Erc721WildcardResolver,
  FlatFeePolicy,
  IENSGuilds,
  INameWrapper,
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
      ensNameWrapper: INameWrapper;
      erc721WildcardResolver: Erc721WildcardResolver;
    };

    usingNameWrapper: boolean;

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
    approveGuildsAsEnsOperator: () => Promise<void>;
  }
}
