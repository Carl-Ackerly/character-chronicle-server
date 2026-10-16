const path=require('node:path');
let playwright;
try{playwright=require('playwright')}catch{const modulePath=process.env.PLAYWRIGHT_MODULE||path.join(process.env.USERPROFILE||process.env.HOME,'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');playwright=require(modulePath)}
module.exports={chromium:playwright.chromium,launchOptions:process.platform==='win32'?{channel:process.env.PLAYWRIGHT_CHANNEL||'msedge',headless:true}:{headless:true}};
