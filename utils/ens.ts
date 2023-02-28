import type { Log } from "@ethersproject/providers";
import { keccak256, toUtf8Bytes } from "ethers/lib/utils";

import { findTypedEvent } from ".";
import { ENS__factory } from "../types";
import type { NewOwnerEvent, NewResolverEvent } from "../types/@ensdomains/ens-contracts/contracts/registry/ENS";

// Applies the ENS namehash function to a single label within a domain, such as "eth" or "test"
export function ensLabelHash(label: string): string {
  return keccak256(toUtf8Bytes(label));
}

export function findNewResolverEvent(logs: Log[] | undefined): Log & { args: NewResolverEvent["args"] } {
  const contractInterface = ENS__factory.createInterface();
  return findTypedEvent<NewResolverEvent>(
    logs,
    contractInterface.events["NewResolver(bytes32,address)"],
    contractInterface,
  );
}

export function findNewOwnerEvent(logs: Log[] | undefined): Log & { args: NewOwnerEvent["args"] } {
  const contractInterface = ENS__factory.createInterface();
  return findTypedEvent<NewOwnerEvent>(
    logs,
    contractInterface.events["NewOwner(bytes32,bytes32,address)"],
    contractInterface,
  );
}
