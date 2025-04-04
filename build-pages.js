// This file helps Cloudflare Pages build the project correctly

console.log('Building for Cloudflare Pages...');
console.log('Node version:', process.version);

// Force exit with success code to allow Cloudflare to continue with its own build process
process.exit(0);
