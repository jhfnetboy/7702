const fs = require('fs');
const path = require('path');

function inspectPackage(pkgName) {
  try {
    const pkgPath = require.resolve(pkgName);
    console.log(`Package path: ${pkgPath}`);
    
    const module = require(pkgName);
    console.log(`Exports of ${pkgName}:`, Object.keys(module));
    
    // Try to find actions submodule
    try {
      const actions = require(`${pkgName}/actions`);
      console.log(`Exports of ${pkgName}/actions:`, Object.keys(actions));
    } catch (e) {
      console.log(`Could not require ${pkgName}/actions: ${e.message}`);
    }

  } catch (e) {
    console.error(`Error inspecting ${pkgName}:`, e);
  }
}

inspectPackage('@metamask/smart-accounts-kit');
