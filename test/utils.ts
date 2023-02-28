import type { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import chai from "chai";
import type { BigNumber } from "ethers";
import { ethers, network } from "hardhat";

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
  await network.provider.request({ method: "hardhat_impersonateAccount", params: [address] });
  const signer = await ethers.getSigner(address);
  const result = await action(signer);
  await network.provider.request({ method: "hardhat_stopImpersonatingAccount", params: [address] });
  return result;
}

export async function setBalance(address: string, balance: BigNumber): Promise<void> {
  await network.provider.send("hardhat_setBalance", [address, balance.toHexString()]);
}

export async function fastForward(seconds: number): Promise<void> {
  await ethers.provider.send("evm_mine", []); // force mine the next block
  await ethers.provider.send("evm_increaseTime", [seconds]);
  await ethers.provider.send("evm_mine", []); // force mine the next block
}

export async function mineBlockAtTimestamp(timestamp: Date): Promise<void> {
  const timestampNumber = dateToBlockchainTimestamp(timestamp).toNumber();
  await ethers.provider.send("evm_setNextBlockTimestamp", [timestampNumber]);
  await ethers.provider.send("evm_mine", []);
}
