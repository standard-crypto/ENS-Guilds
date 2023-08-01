// SPDX-License-Identifier: MIT
pragma solidity ^0.8.4;

import "@ensdomains/ens-contracts/contracts/utils/NameEncoder.sol";
import "@ensdomains/ens-contracts/contracts/reverseRegistrar/ReverseClaimer.sol";
import "@openzeppelin/contracts/utils/introspection/ERC165.sol";
import "@openzeppelin/contracts/utils/introspection/ERC165Checker.sol";
import "@openzeppelin/contracts/utils/Strings.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/IERC721Metadata.sol";
import "../libraries/ENSNamehash.sol";
import "../libraries/StringParsing.sol";
import "./WildcardResolverBase.sol";

contract Erc721WildcardResolver is WildcardResolverBase, ReverseClaimer {
    using ENSNamehash for bytes;
    using ERC165Checker for address;
    using NameEncoder for string;
    using StringParsing for bytes;
    using Strings for string;
    using Strings for address;
    using Strings for uint256;

    error CallerNotAuthorised();
    error InvalidTokenContract();

    // dnsEncode(parentName) -> address
    // ex: key for "test.eth" is `0x04746573740365746800`
    mapping(bytes => IERC721) public tokens;

    // mapping of namehash(parentName) to set of addresses authorized to set records on the parent
    mapping(bytes32 => mapping(address => bool)) public approvedDelegates;

    constructor(
        ENS _ensRegistry,
        INameWrapper _ensNameWrapper
    ) WildcardResolverBase(_ensRegistry, _ensNameWrapper) ReverseClaimer(_ensRegistry, msg.sender) {
        return;
    }

    function setTokenContract(string calldata ensName, address tokenContract, address fallbackResolver) external {
        // Must have provided valid ERC721 contract
        if (!tokenContract.supportsInterface(type(IERC721).interfaceId)) {
            revert InvalidTokenContract();
        }

        (bytes memory encodedName, bytes32 ensNode) = ensName.dnsEncodeName();

        // Caller must be the name owner or a delegate of the name owner
        if (!isAuthorised(ensNode)) {
            revert CallerNotAuthorised();
        }

        tokens[encodedName] = IERC721(tokenContract);
        parentEnsNodes[encodedName] = ensNode;
        _setPassthroughTarget(ensNode, fallbackResolver);
    }

    function isAuthorised(bytes32 node) internal view virtual override returns (bool) {
        address owner = _nodeOwner(node);
        address sender = _msgSender();
        return sender == owner || isApprovedFor(owner, node, sender);
    }

    function isApprovedFor(address, bytes32 node, address delegate) public view returns (bool) {
        return approvedDelegates[node][delegate];
    }

    function setApprovedFor(bytes32 node, address delegate, bool approved) external {
        if (_msgSender() != _nodeOwner(node)) {
            revert CallerNotAuthorised();
        }
        approvedDelegates[node][delegate] = approved;
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
        if (!valid) {
            return address(0);
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

    function _resolveWildcardTextRecord(
        bytes calldata childUtf8Encoded,
        bytes calldata parentDnsEncoded,
        string calldata key
    ) internal view virtual override returns (string memory) {
        IERC721 tokenContract = tokens[parentDnsEncoded];

        // No NFT contract registered for this address
        if (address(tokenContract) == address(0)) {
            return "";
        }

        // Extract tokenId from child name
        (bool valid, uint256 tokenId) = childUtf8Encoded.parseUint256();
        if (!valid) {
            return "";
        }

        // Don't bother returning anything if this tokenId has never been minted
        // solhint-disable-next-line no-empty-blocks
        try tokenContract.ownerOf(tokenId) {} catch {
            return "";
        }

        if (key.equal("avatar")) {
            // Standard described here:
            // https://docs.ens.domains/ens-improvement-proposals/ensip-12-avatar-text-records
            return string.concat("eip155:1/erc721:", address(tokenContract).toHexString(), "/", tokenId.toString());
        } else if (key.equal("url")) {
            string memory url;
            try IERC721Metadata(address(tokenContract)).tokenURI(tokenId) returns (string memory _url) {
                url = _url;
            } catch {
                url = "";
            }
            return url;
        }

        // unsupported key
        return "";
    }
}
