import { type Log } from "@ethersproject/providers";

import { findTypedEvent } from ".";
import { ENS__factory } from "../../types";
import type { NewOwnerEvent, NewResolverEvent } from "../../types/@ensdomains/ens-contracts/contracts/registry/ENS";

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
