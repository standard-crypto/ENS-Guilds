import { type EventFragment } from "@ethersproject/abi";
import { BigNumber } from "@ethersproject/bignumber";
import type { Event } from "@ethersproject/contracts";
import type { Log, Provider } from "@ethersproject/providers";
import type { utils } from "ethers";

import { expectDefined } from "../test/utils";

export function dateToBlockchainTimestamp(date: Date): BigNumber {
  return BigNumber.from(Math.floor(date.getTime() / 1000));
}

export function dateFromBlockchainTimestamp(timestamp: number | BigNumber): Date {
  const asNumber = BigNumber.from(timestamp).toNumber();
  return new Date(asNumber * 1000);
}

export async function getLatestBlockTime(provider: Provider): Promise<Date> {
  return new Date((await provider.getBlock("latest")).timestamp * 1000);
}

export function findTypedEvent<EventType extends Event>(
  logs: Log[] | undefined,
  targetEventFragment: EventFragment,
  contractInterface: utils.Interface,
): Log & { args: EventType["args"] } {
  expectDefined(logs);
  const targetEventTopic = contractInterface.getEventTopic(contractInterface.events[targetEventFragment.format()]);
  const foundLog = logs.find((log) => log.topics.includes(targetEventTopic));
  expectDefined(foundLog);
  const logDescription = contractInterface.parseLog(foundLog);
  return { ...foundLog, args: logDescription.args };
}

export * from "./ens";
