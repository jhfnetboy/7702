const kit = require('@metamask/smart-accounts-kit');
console.log('Root exports:', Object.keys(kit));

try {
  const actions = require('@metamask/smart-accounts-kit/actions');
  console.log('Actions exports:', Object.keys(actions));
} catch (e) {
  console.log('Actions submodule not found');
}
