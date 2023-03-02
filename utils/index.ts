import { BigNumber } from "@ethersproject/bignumber";
import type { Provider } from "@ethersproject/providers";

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

export * from "./ens";
