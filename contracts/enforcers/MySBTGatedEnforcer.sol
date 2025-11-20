// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

/**
 * @title MySBTGatedEnforcer
 * @notice Enforcer that requires the delegator to hold a MySBT token
 * @dev Integrates with MetaMask Delegation Framework
 */

// Import from MetaMask delegation-framework submodule
import {CaveatEnforcer} from "../../lib/delegation-framework/src/enforcers/CaveatEnforcer.sol";
import {ModeCode} from "../../lib/delegation-framework/src/utils/Types.sol";

// MySBT interface
interface IMySBT {
    /// @notice Get user's SBT token ID (returns 0 if user has no SBT)
    function getUserSBT(address u) external view returns (uint256);

    /// @notice Get SBT balance of user (should be 0 or 1 for SBT)
    function balanceOf(address owner) external view returns (uint256);

    /// @notice Verify if user is member of a specific community
    function verifyCommunityMembership(address u, address comm) external view returns (bool);
}

contract MySBTGatedEnforcer is CaveatEnforcer {
    // ========== State Variables ==========

    /// @notice MySBT contract address (injected at deployment from shared-config)
    address public immutable MY_SBT;

    /// @notice Contract version
    string public constant VERSION = "1.0.0";

    // ========== Events ==========

    event SBTVerified(address indexed delegator, uint256 sbtId);
    event SBTVerificationFailed(address indexed delegator);

    // ========== Constructor ==========

    /**
     * @notice Constructor
     * @param _mySBT Address of the MySBT contract (from shared-config)
     */
    constructor(address _mySBT) {
        require(_mySBT != address(0), "MySBTGatedEnforcer: invalid MySBT address");
        MY_SBT = _mySBT;
    }

    // ========== Enforcer Hooks ==========

    /**
     * @notice Called before the execution to verify the delegator holds MySBT
     * @param _terms Optional terms for additional verification
     * @param _mode The execution mode
     * @param _delegator The address of the delegator
     */
    function beforeHook(
        bytes calldata _terms,
        bytes calldata, // _args (unused)
        ModeCode _mode,
        bytes calldata, // _executionCallData (unused)
        bytes32, // _delegationHash (unused)
        address _delegator,
        address // _redeemer (unused)
    ) public view override {
        // Get the SBT ID of the delegator
        uint256 sbtId = IMySBT(MY_SBT).getUserSBT(_delegator);

        // Basic verification: delegator must hold an SBT
        if (sbtId == 0) {
            revert("MySBTGatedEnforcer: delegator must hold MySBT");
        }

        // Optional: Additional verification based on terms
        if (_terms.length > 0) {
            // Decode minimum SBT ID requirement
            uint256 minSBTId = abi.decode(_terms, (uint256));
            if (sbtId < minSBTId) {
                revert("MySBTGatedEnforcer: SBT ID too low");
            }
        }

        // Optional: Check balance as additional verification
        uint256 balance = IMySBT(MY_SBT).balanceOf(_delegator);
        if (balance == 0) {
            revert("MySBTGatedEnforcer: no SBT balance");
        }
    }

    /**
     * @notice Called after the execution (optional logging)
     * @dev Override this if you need post-execution verification
     */
    function afterHook(
        bytes calldata _terms,
        bytes calldata _args,
        ModeCode _mode,
        bytes calldata _executionCallData,
        bytes32 _delegationHash,
        address _delegator,
        address _redeemer
    ) public override {
        // Optional: Log successful execution
        uint256 sbtId = IMySBT(MY_SBT).getUserSBT(_delegator);
        emit SBTVerified(_delegator, sbtId);
    }

    // ========== View Functions ==========

    /**
     * @notice Check if an address holds MySBT
     * @param user The address to check
     * @return hasSBT Whether the user holds MySBT
     * @return sbtId The SBT token ID (0 if none)
     */
    function checkSBTStatus(address user) public view returns (bool hasSBT, uint256 sbtId) {
        sbtId = IMySBT(MY_SBT).getUserSBT(user);
        hasSBT = sbtId > 0;
    }

    /**
     * @notice Verify community membership (if applicable)
     * @param user The user address
     * @param community The community address
     * @return isMember Whether the user is a member
     */
    function verifyCommunityMembership(
        address user,
        address community
    ) public view returns (bool isMember) {
        return IMySBT(MY_SBT).verifyCommunityMembership(user, community);
    }

    /**
     * @notice Get the terms info for this enforcer
     * @param _terms The encoded terms
     * @return minSBTId The minimum required SBT ID (0 if no requirement)
     */
    function getTermsInfo(bytes calldata _terms) public pure returns (uint256 minSBTId) {
        if (_terms.length == 0) {
            return 0; // No minimum requirement
        }
        return abi.decode(_terms, (uint256));
    }
}