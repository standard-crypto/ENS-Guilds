// SPDX-License-Identifier: MIT
pragma solidity ^0.8.4;

import "./Erc721WildcardResolver.sol";
import "../libraries/StringParsing.sol";
import "@openzeppelin/contracts/utils/Strings.sol";
import "../ensGuilds/GuildsResolver.sol";

contract DigidaigakuResolver is Erc721WildcardResolver {
    using StringParsing for bytes;
    using Strings for string;
    using Strings for address;
    using Strings for uint256;

    constructor(
        ENS _ensRegistry,
        INameWrapper _ensNameWrapper,
        address reverseRecordOwner
    ) Erc721WildcardResolver(_ensRegistry, _ensNameWrapper, reverseRecordOwner) {
        return;
    }

    function _resolveWildcardEthAddr(
        bytes calldata childUtf8Encoded,
        bytes calldata parentDnsEncoded
    ) internal view virtual override returns (address) {
        IERC721 tokenContract = tokens[parentDnsEncoded];

        // No NFT contract registered for this address
        if (address(tokenContract) == address(0)) {
            return address(0);
        }

        // Extract tokenId from child name
        (bool valid, uint256 tokenId) = childUtf8Encoded.parseUint256();
        // No token, try resolving using name
        if (!valid) {
            string[] memory urls = new string[](1);
            urls[0] = string(
                abi.encodePacked(
                    "https://storage.googleapis.com/digidagiaku-by-name/",
                    childUtf8Encoded,
                    ".json#{data}"
                )
            );
            bytes memory callData = abi.encode(parentDnsEncoded);

            revert OffchainLookup(address(this), urls, callData, this.resolveByNameCallback.selector, callData);
        }

        // Lookup token owner
        address tokenOwner;
        try tokenContract.ownerOf(tokenId) returns (address _tokenOwner) {
            tokenOwner = _tokenOwner;
        } catch {
            tokenOwner = address(0);
        }
        return tokenOwner;
    }

    function resolveByNameCallback(
        bytes calldata response,
        bytes calldata extraData
    ) public view returns (bytes memory) {
        bytes memory parentDnsEncoded = abi.decode(extraData, (bytes));
        IERC721 tokenContract = tokens[parentDnsEncoded];

        // No NFT contract registered for this address
        if (address(tokenContract) == address(0)) {
            return abi.encode(0);
        }
        uint256 digi = abi.decode(response, (uint256));

        // Lookup token owner
        address tokenOwner;
        try tokenContract.ownerOf(digi) returns (address _tokenOwner) {
            tokenOwner = _tokenOwner;
        } catch {
            tokenOwner = address(0);
        }
        return abi.encode(tokenOwner);
    }
}
