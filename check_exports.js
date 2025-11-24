import * as kit from '@metamask/smart-accounts-kit';
console.log('Exports:', Object.keys(kit));
if (kit.disableDelegation) {
  console.log('✅ disableDelegation found');
} else {
  console.log('❌ disableDelegation NOT found');
}
