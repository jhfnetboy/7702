#!/bin/bash
# Check EIP-7702 delegation status using cast

ADDRESS="0xB747313F403dE459aa7C58654Fd908EE89241acF"

echo "=== Checking EIP-7702 Delegation Status ==="
echo "Address: $ADDRESS"
echo ""

# Get bytecode
CODE=$(cast code $ADDRESS --rpc-url $VITE_SEPOLIA_RPC_URL)

echo "Raw bytecode: $CODE"
echo "Length: ${#CODE}"
echo ""

# Check if it's delegated
if [[ $CODE == 0xef01* ]]; then
    echo "✅ EIP-7702 delegation detected!"
    echo ""
    
    # Extract delegation address (skip 0xef0100, take next 40 chars)
    DELEGATION_ADDR="0x${CODE:8:40}"
    echo "🎯 Delegated to: $DELEGATION_ADDR"
    
    if [[ $DELEGATION_ADDR == "0x0000000000000000000000000000000000000000" ]]; then
        echo "⚠️ Delegation REVOKED (zero address)"
    else
        echo "✅ Active delegation"
    fi
elif [[ -z $CODE || $CODE == "0x" ]]; then
    echo "❌ No bytecode - Regular EOA (not delegated)"
else
    echo "❓ Unknown bytecode format: ${CODE:0:10}..."
fi
