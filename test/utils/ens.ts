import { type EventLog, type Log } from "ethers";

import { findTypedEvent } from ".";
import { ENS__factory } from "../../types";
import type { NewOwnerEvent, NewResolverEvent } from "../../types/@ensdomains/ens-contracts/contracts/registry/ENS";

export function findNewResolverEvent(logs: Array<Log | EventLog> | undefined): NewResolverEvent.Log {
  const contractInterface = ENS__factory.createInterface();
  return findTypedEvent<NewResolverEvent.Event>(logs, contractInterface.getEvent("NewResolver"));
}

export function findNewOwnerEvent(logs: Array<Log | EventLog> | undefined): NewOwnerEvent.Log {
  const contractInterface = ENS__factory.createInterface();
  return findTypedEvent<NewOwnerEvent.Event>(logs, contractInterface.getEvent("NewOwner"));
}
