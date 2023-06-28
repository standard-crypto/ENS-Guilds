import type { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { impersonateAccount, stopImpersonatingAccount } from "@nomicfoundation/hardhat-network-helpers";
import { increase, increaseTo } from "@nomicfoundation/hardhat-network-helpers/dist/src/helpers/time";
import chai from "chai";
import { type EventFragment, EventLog, type Log } from "ethers";
import { ethers } from "hardhat";

import { type TypedContractEvent, type TypedEventLog } from "../../types/common";
import { dateToBlockchainTimestamp } from "../../utils";

const { expect } = chai;

export function expectDefined<T>(arg: T): asserts arg is NonNullable<T> {
  expect(arg).to.not.be.undefined;
  expect(arg).to.not.be.null;
}

export async function getSigner(address: string): Promise<HardhatEthersSigner> {
  return await asAccount(address, async () => {
    return await ethers.getSigner(address);
  });
}

export async function asAccount<T>(address: string, action: (signer: HardhatEthersSigner) => Promise<T>): Promise<T> {
  await impersonateAccount(address);
  const signer = await ethers.getSigner(address);
  const result = await action(signer);
  await stopImpersonatingAccount(address);
  return result;
}

export async function fastForward(seconds: number): Promise<void> {
  await increase(seconds);
}

export async function mineBlockAtTimestamp(timestamp: Date): Promise<void> {
  const timestampNumber = dateToBlockchainTimestamp(timestamp).toNumber();
  await increaseTo(timestampNumber);
}

export function findTypedEvent<EventType extends TypedContractEvent>(
  logs: Array<Log | EventLog> | undefined,
  targetEventFragment: EventFragment,
): TypedEventLog<EventType> {
  expectDefined(logs);

  const foundLog = logs.find((log) => {
    return log instanceof EventLog && log.eventName === targetEventFragment.name;
  });

  expectDefined(foundLog);

  return foundLog as TypedEventLog<EventType>;

  // const targetEventTopic = contractInterface.getEventTopic(contractInterface.events[targetEventFragment.format()]);
  // const foundLog = logs.find((log) => log.topics.includes(targetEventTopic));

  // const logDescription = contractInterface.parseLog(foundLog);
  // return { ...foundLog, args: logDescription?.args };
}
