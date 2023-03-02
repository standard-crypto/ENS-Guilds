import { type EnsProvider, type EnsResolver } from "@ethersproject/providers";
import { keccak256, namehash, toUtf8Bytes } from "ethers/lib/utils";

import { INameResolver__factory, type IReverseRegistrar, IReverseRegistrar__factory } from "../types";
import type { ENS } from "../types/@ensdomains/ens-contracts/contracts/registry/ENS";

// Applies the ENS namehash function to a single label within a domain, such as "eth" or "test"
export function ensLabelHash(label: string): string {
  return keccak256(toUtf8Bytes(label));
}

export async function resolveName(ensRegistry: ENS, name: string): Promise<string | null> {
  const provider = ensRegistry.provider;

  // hack the address of the ENS registry into the ethers provider so that we can directly use
  // the implementation of ENS lookups provided by ethers.js
  (provider as any)._network.ensAddress = ensRegistry.address; // eslint-disable-line @typescript-eslint/no-explicit-any

  return await provider.resolveName(name);
}

export async function getResolver(ensRegistry: ENS, name: string): Promise<EnsResolver | null> {
  const provider = ensRegistry.provider;

  // hack the address of the ENS registry into the ethers provider so that we can directly use
  // the implementation of ENS lookups provided by ethers.js
  (provider as any)._network.ensAddress = ensRegistry.address; // eslint-disable-line @typescript-eslint/no-explicit-any

  return await (provider as unknown as EnsProvider).getResolver(name);
}

export async function getReverseRegistrar(ensRegistry: ENS): Promise<IReverseRegistrar> {
  const reverseRegistrarAddr = await ensRegistry.owner(namehash("addr.reverse"));
  if (reverseRegistrarAddr === null) {
    throw Error("addr.reverse not found");
  }
  return IReverseRegistrar__factory.connect(reverseRegistrarAddr, ensRegistry.provider);
}

export async function getReverseName(ensRegistry: ENS, address: string): Promise<string> {
  const reverseRegistrar = await getReverseRegistrar(ensRegistry);
  const reverseRecordNode = await reverseRegistrar.node(address);
  const reverseRecordResolverAddr = await ensRegistry.resolver(reverseRecordNode);
  const reverseRecordResolver = INameResolver__factory.connect(reverseRecordResolverAddr, ensRegistry.provider);
  return await reverseRecordResolver.name(reverseRecordNode);
}
