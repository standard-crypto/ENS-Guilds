// SPDX-License-Identifier: MIT
pragma solidity ^0.8.4;

// A contract that accepts ETH
contract PayableContract {
    fallback() external payable {}
}
