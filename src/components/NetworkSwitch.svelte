<script lang="ts">
  import { currentChainConfig } from '$lib/chainConfig';
</script>

<div class="border border-gray-200 rounded-full px-3 py-1 text-gray-600 flex items-center">
  <div class="flex items-center space-x-2">
    <div class="w-2 h-2 bg-green-500 rounded-full"></div>
    <span class="text-sm font-medium">{$currentChainConfig.chain.name}</span>
  </div>
</div>
