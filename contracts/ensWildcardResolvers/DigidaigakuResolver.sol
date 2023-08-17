// SPDX-License-Identifier: MIT
pragma solidity ^0.8.4;

import "./WildcardResolverBase.sol";
import "../libraries/StringParsing.sol";
import "../ensGuilds/GuildsResolver.sol";
import "@ensdomains/ens-contracts/contracts/reverseRegistrar/ReverseClaimer.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/IERC721Metadata.sol";
import "@openzeppelin/contracts/utils/Strings.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract DigidaigakuResolver is WildcardResolverBase, ReverseClaimer, Ownable {
    using StringParsing for bytes;
    using Strings for string;
    using Strings for address;
    using Strings for uint256;

    string public url;
    IERC721 digidaigakuContract;

    constructor(
        ENS _ensRegistry,
        INameWrapper _ensNameWrapper,
        address reverseRecordOwner,
        address tokenContract,
        string memory _url
    ) WildcardResolverBase(_ensRegistry, _ensNameWrapper) ReverseClaimer(_ensRegistry, reverseRecordOwner) {
        digidaigakuContract = IERC721(tokenContract);
        url = _url;
        return;
    }

    function setUrl(string memory new_url) public onlyOwner {
        url = new_url;
    }

    function _resolveWildcardEthAddr(
        bytes calldata childUtf8Encoded,
        bytes calldata parentDnsEncoded
    ) internal view virtual override returns (address) {
        // Extract tokenId from child name
        (bool valid, uint256 tokenId) = childUtf8Encoded.parseUint256();
        // No token, try resolving using name
        if (!valid) {
            string[] memory urls = new string[](1);
            urls[0] = url;

            revert OffchainLookup(
                address(this),
                urls,
                childUtf8Encoded,
                this.resolveByNameCallback.selector,
                parentDnsEncoded
            );
        }

        return resolveOwnerAddress(tokenId);
    }

    function resolveByNameCallback(
        bytes calldata response,
        bytes calldata extraData
    ) public view returns (bytes memory) {
        // Get tokenId from offchain response
        uint256 tokenId = abi.decode(response, (uint256));
        return abi.encode(resolveOwnerAddress(tokenId));
    }

    function resolveOwnerAddress(uint256 tokenId) internal view returns (address) {
        // Lookup token owner
        address tokenOwner;
        try digidaigakuContract.ownerOf(tokenId) returns (address _tokenOwner) {
            tokenOwner = _tokenOwner;
        } catch {
            tokenOwner = address(0);
        }
        return tokenOwner;
    }

    function _resolveWildcardTextRecord(
        bytes calldata childUtf8Encoded,
        bytes calldata parentDnsEncoded,
        string calldata key
    ) internal view virtual override returns (string memory) {
        // Extract tokenId from child name
        (bool valid, uint256 tokenId) = childUtf8Encoded.parseUint256();
        // No token, try resolving using name
        if (!valid) {
            string[] memory urls = new string[](1);
            urls[0] = url;

            revert OffchainLookup(
                address(this),
                urls,
                childUtf8Encoded,
                this.resolveTextByNameCallback.selector,
                abi.encode(key)
            );
        }

        return resolveTextRecord(key, tokenId);
    }

    function resolveTextByNameCallback(
        bytes calldata response,
        bytes calldata extraData
    ) public view returns (bytes memory) {
        // Get tokenId from offchain response
        uint256 tokenId = abi.decode(response, (uint256));
        // Get text key from extraData
        string memory key = abi.decode(extraData, (string));
        return abi.encode(resolveTextRecord(key, tokenId));
    }

    function resolveTextRecord(string memory key, uint256 tokenId) internal view returns (string memory) {
        // Don't bother returning anything if this tokenId has never been minted
        // solhint-disable-next-line no-empty-blocks
        try digidaigakuContract.ownerOf(tokenId) {} catch {
            return "";
        }

        if (key.equal("avatar")) {
            // Standard described here:
            // https://docs.ens.domains/ens-improvement-proposals/ensip-12-avatar-text-records
            return
                string.concat("eip155:1/erc721:", address(digidaigakuContract).toHexString(), "/", tokenId.toString());
        } else if (key.equal("url")) {
            string memory url;
            try IERC721Metadata(address(digidaigakuContract)).tokenURI(tokenId) returns (string memory _url) {
                url = _url;
            } catch {
                url = "";
            }
            return url;
        }

        // unsupported key
        return "";
    }

    function isAuthorised(bytes32 node) internal view virtual override returns (bool) {
        address owner = _nodeOwner(node);
        address sender = _msgSender();
        return sender == owner;
    }
}
