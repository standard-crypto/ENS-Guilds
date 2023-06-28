import { type EventLog, type Log } from "ethers";

import { findTypedEvent } from ".";
import { IERC1155__factory } from "../../types";
import type { TransferSingleEvent } from "../../types/@openzeppelin/contracts/token/ERC1155/IERC1155";

export function findTransferSingleEvent(logs: Array<Log | EventLog> | undefined): TransferSingleEvent.Log {
  const contractInterface = IERC1155__factory.createInterface();
  const eventFragment = contractInterface.getEvent("TransferSingle");

  return findTypedEvent<TransferSingleEvent.Event>(logs, eventFragment);
}
