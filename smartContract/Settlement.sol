// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/access/Ownable.sol";

contract Settlement is Ownable {
    mapping(bytes32 => bool) public merkleRoots; // Track committed roots

    event MerkleRootCommitted(bytes32 indexed root, address indexed committer);

    function commitMerkleRoot(bytes32 root) external onlyOwner {
        require(!merkleRoots[root], "Root already committed");
        merkleRoots[root] = true;
        emit MerkleRootCommitted(root, msg.sender);
    }

    function verifyMerkleRoot(bytes32 root) external view returns (bool) {
        return merkleRoots[root];
    }
}
