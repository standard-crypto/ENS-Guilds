import { impersonateAccount, stopImpersonatingAccount } from "@nomicfoundation/hardhat-network-helpers";
import { increase, increaseTo } from "@nomicfoundation/hardhat-network-helpers/dist/src/helpers/time";
import type { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import chai from "chai";
import { ethers } from "hardhat";

import { dateToBlockchainTimestamp } from "../utils";

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
