import { HardhatEthersProvider } from "@nomicfoundation/hardhat-ethers/internal/hardhat-ethers-provider";
import { type AbstractProvider, EnsPlugin, EnsResolver, type Network, keccak256, namehash, toUtf8Bytes } from "ethers";

import { INameResolver__factory, type IReverseRegistrar, IReverseRegistrar__factory } from "../types";
import type { ENS } from "../types/@ensdomains/ens-contracts/contracts/registry/ENS";

// Applies the ENS namehash function to a single label within a domain, such as "eth" or "test"
export function ensLabelHash(label: string): string {
  return keccak256(toUtf8Bytes(label));
}

export async function resolveName(ensRegistry: ENS, name: string): Promise<string | null> {
  const resolver = await getResolver(ensRegistry, name);

  if (resolver === null) {
    return null;
  }

  return await resolver.getAddress();
}

export async function resolveText(ensRegistry: ENS, name: string, key: string): Promise<string | null> {
  const resolver = await getResolver(ensRegistry, name);

  if (resolver === null) {
    return null;
  }

  return await resolver.getText(key);
}

export async function getResolver(ensRegistry: ENS, name: string): Promise<EnsResolver | null> {
  const ensRegistryAddress = await ensRegistry.getAddress();

  const provider = ensRegistry.runner?.provider;

  if (provider === null || provider === undefined) {
    throw new Error("provider not found");
  }

  // hack the address of the ENS registry into the ethers provider so that we can directly use
  // the implementation of ENS lookups provided by ethers.js
  class WrappedProvider extends HardhatEthersProvider {
    public async getNetwork(): Promise<Network> {
      const network = await super.getNetwork();
      network.attachPlugin(new EnsPlugin(ensRegistryAddress));
      return network;
    }
  }
  Object.setPrototypeOf(provider, WrappedProvider.prototype);
  return await EnsResolver.fromName(provider as unknown as AbstractProvider, name);
}

export async function getReverseRegistrar(ensRegistry: ENS): Promise<IReverseRegistrar> {
  const reverseRegistrarAddr = await ensRegistry.owner(namehash("addr.reverse"));
  if (reverseRegistrarAddr === null) {
    throw Error("addr.reverse not found");
  }
  return IReverseRegistrar__factory.connect(reverseRegistrarAddr, ensRegistry.runner);
}

export async function getReverseName(ensRegistry: ENS, address: string): Promise<string> {
  const reverseRegistrar = await getReverseRegistrar(ensRegistry);
  const reverseRecordNode = await reverseRegistrar.node(address);
  const reverseRecordResolverAddr = await ensRegistry.resolver(reverseRecordNode);
  const reverseRecordResolver = INameResolver__factory.connect(reverseRecordResolverAddr, ensRegistry.runner);
  return await reverseRecordResolver.name(reverseRecordNode);
}
