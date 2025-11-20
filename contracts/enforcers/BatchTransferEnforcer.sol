// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

/**
 * @title BatchTransferEnforcer
 * @notice Enforcer for batch transfer operations with limits
 * @dev Controls batch size and total amount limits
 */

import {CaveatEnforcer} from "../../lib/delegation-framework/src/enforcers/CaveatEnforcer.sol";
import {ModeCode, Execution} from "../../lib/delegation-framework/src/utils/Types.sol";
import {ExecutionLib} from "@erc7579/lib/ExecutionLib.sol";
import {ModeLib} from "@erc7579/lib/ModeLib.sol";

interface IERC20 {
    function transfer(address to, uint256 amount) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
}

contract BatchTransferEnforcer is CaveatEnforcer {
    using ExecutionLib for bytes;
    using ModeLib for ModeCode;

    // ========== State Variables ==========

    /// @notice Track spent amounts per delegation
    mapping(address delegationManager => mapping(bytes32 delegationHash => uint256 totalSpent))
        public spentAmounts;

    /// @notice Track number of executions per delegation
    mapping(address delegationManager => mapping(bytes32 delegationHash => uint256 count))
        public executionCounts;

    /// @notice Contract version
    string public constant VERSION = "1.0.0";

    // ========== Structs ==========

    struct BatchTransferTerms {
        uint256 maxRecipients;     // Maximum number of recipients per batch
        uint256 maxTotalAmount;     // Maximum total amount per batch (ETH or token)
        uint256 maxExecutions;      // Maximum number of batch executions
        address allowedToken;       // Specific token address (0x0 for ETH)
    }

    // ========== Events ==========

    event BatchTransferValidated(
        address indexed delegator,
        bytes32 indexed delegationHash,
        uint256 recipientCount,
        uint256 totalAmount
    );

    event SpentAmountUpdated(
        address indexed delegationManager,
        bytes32 indexed delegationHash,
        uint256 newTotalSpent
    );

    // ========== Enforcer Hooks ==========

    /**
     * @notice Validates batch transfer before execution
     * @param _terms Encoded BatchTransferTerms
     * @param _mode Execution mode (must be batch)
     * @param _executionCallData The batch execution data
     * @param _delegationHash Hash of the delegation
     * @param _delegator Address of the delegator
     */
    function beforeHook(
        bytes calldata _terms,
        bytes calldata,
        ModeCode _mode,
        bytes calldata _executionCallData,
        bytes32 _delegationHash,
        address _delegator,
        address
    ) public override onlyBatchCallTypeMode(_mode) {
        // Decode terms
        BatchTransferTerms memory terms = abi.decode(_terms, (BatchTransferTerms));

        // Check execution count limit
        uint256 currentCount = executionCounts[msg.sender][_delegationHash];
        if (terms.maxExecutions > 0 && currentCount >= terms.maxExecutions) {
            revert("BatchTransferEnforcer: execution limit exceeded");
        }

        // Decode batch executions
        Execution[] calldata executions = _executionCallData.decodeBatch();

        // Validate recipient count
        if (terms.maxRecipients > 0 && executions.length > terms.maxRecipients) {
            revert("BatchTransferEnforcer: too many recipients");
        }

        // Calculate total amount
        uint256 totalAmount = 0;
        for (uint256 i = 0; i < executions.length; i++) {
            Execution calldata exec = executions[i];

            // Check if it's ETH or token transfer
            if (terms.allowedToken == address(0)) {
                // ETH transfer
                totalAmount += exec.value;
            } else {
                // ERC20 transfer
                if (exec.target != terms.allowedToken) {
                    revert("BatchTransferEnforcer: invalid token");
                }

                // Decode transfer amount from calldata
                if (exec.callData.length >= 68) {
                    // transfer(address,uint256) selector + params
                    uint256 amount = uint256(bytes32(exec.callData[36:68]));
                    totalAmount += amount;
                }
            }
        }

        // Check total amount limit
        uint256 totalSpent = spentAmounts[msg.sender][_delegationHash];
        if (terms.maxTotalAmount > 0 && totalSpent + totalAmount > terms.maxTotalAmount) {
            revert("BatchTransferEnforcer: amount limit exceeded");
        }

        // Update state
        spentAmounts[msg.sender][_delegationHash] = totalSpent + totalAmount;
        executionCounts[msg.sender][_delegationHash] = currentCount + 1;

        // Emit events
        emit BatchTransferValidated(_delegator, _delegationHash, executions.length, totalAmount);
        emit SpentAmountUpdated(msg.sender, _delegationHash, totalSpent + totalAmount);
    }

    /**
     * @notice Optional post-execution hook
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
        // Optional: Additional post-execution logic
    }

    // ========== View Functions ==========

    /**
     * @notice Get current spending status for a delegation
     * @param delegationManager The delegation manager address
     * @param delegationHash The delegation hash
     * @return spent Total amount spent
     * @return executions Number of executions
     */
    function getSpendingStatus(
        address delegationManager,
        bytes32 delegationHash
    ) public view returns (uint256 spent, uint256 executions) {
        spent = spentAmounts[delegationManager][delegationHash];
        executions = executionCounts[delegationManager][delegationHash];
    }

    /**
     * @notice Check if a batch transfer would be valid
     * @param _terms Encoded terms
     * @param delegationHash The delegation hash
     * @param batchSize Number of recipients
     * @param totalAmount Total transfer amount
     * @return isValid Whether the transfer would be valid
     * @return reason Reason if invalid
     */
    function wouldBeValid(
        bytes calldata _terms,
        bytes32 delegationHash,
        uint256 batchSize,
        uint256 totalAmount
    ) public view returns (bool isValid, string memory reason) {
        BatchTransferTerms memory terms = abi.decode(_terms, (BatchTransferTerms));

        // Check execution count
        uint256 currentCount = executionCounts[msg.sender][delegationHash];
        if (terms.maxExecutions > 0 && currentCount >= terms.maxExecutions) {
            return (false, "Execution limit exceeded");
        }

        // Check recipient count
        if (terms.maxRecipients > 0 && batchSize > terms.maxRecipients) {
            return (false, "Too many recipients");
        }

        // Check total amount
        uint256 totalSpent = spentAmounts[msg.sender][delegationHash];
        if (terms.maxTotalAmount > 0 && totalSpent + totalAmount > terms.maxTotalAmount) {
            return (false, "Amount limit exceeded");
        }

        return (true, "");
    }

    /**
     * @notice Decode and return the terms
     * @param _terms Encoded terms
     * @return Decoded BatchTransferTerms
     */
    function decodeTerms(bytes calldata _terms) public pure returns (BatchTransferTerms memory) {
        return abi.decode(_terms, (BatchTransferTerms));
    }
}