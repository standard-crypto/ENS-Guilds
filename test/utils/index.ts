import { type EventFragment } from "@ethersproject/abi";
import type { Event } from "@ethersproject/contracts";
import type { Log } from "@ethersproject/providers";
import { impersonateAccount, stopImpersonatingAccount } from "@nomicfoundation/hardhat-network-helpers";
import { increase, increaseTo } from "@nomicfoundation/hardhat-network-helpers/dist/src/helpers/time";
import type { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import chai from "chai";
import type { utils } from "ethers";
import { ethers } from "hardhat";

import { dateToBlockchainTimestamp } from "../../utils";

const { expect } = chai;

export function expectDefined<T>(arg: T): asserts arg is NonNullable<T> {
  expect(arg).to.not.be.undefined;
  expect(arg).to.not.be.null;
}

export async function getSigner(address: string): Promise<SignerWithAddress> {
  return await asAccount(address, async () => {
    return await ethers.getSigner(address);
  });
}

export async function asAccount<T>(address: string, action: (signer: SignerWithAddress) => Promise<T>): Promise<T> {
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
