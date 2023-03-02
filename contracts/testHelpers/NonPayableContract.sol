// SPDX-License-Identifier: MIT
pragma solidity ^0.8.4;

// A contract that reverts any TX that tries to send it ETH
contract NonPayableContract {
    // solhint-disable-next-line payable-fallback
    fallback() external {
        revert("This contract is not payable!");
    }
}
