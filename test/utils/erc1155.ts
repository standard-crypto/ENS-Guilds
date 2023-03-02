import { type Log } from "@ethersproject/providers";

import { findTypedEvent } from ".";
import { IERC1155__factory } from "../../types";
import type { TransferSingleEvent } from "../../types/@openzeppelin/contracts/token/ERC1155/IERC1155";

export function findTransferSingleEvent(logs: Log[] | undefined): Log & { args: TransferSingleEvent["args"] } {
  const contractInterface = IERC1155__factory.createInterface();
  return findTypedEvent<TransferSingleEvent>(
    logs,
    contractInterface.events["TransferSingle(address,address,address,uint256,uint256)"],
    contractInterface,
  );
}
