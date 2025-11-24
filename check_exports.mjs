import * as kit from '@metamask/smart-accounts-kit';
console.log('Checking exports...');
try {
  console.log('Exports available:', Object.keys(kit));
  if (typeof kit.disableDelegation === 'function') {
    console.log('✅ disableDelegation found');
  } else {
    console.log('❌ disableDelegation NOT found');
  }
} catch (e) {
  console.error('Error:', e);
}
process.exit(0);
