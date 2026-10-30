import {spawnSync} from 'node:child_process';
process.env.FIRSTLOOK_CLOUDFLARE='1';
const result=spawnSync(process.execPath,['node_modules/vinext/dist/cli.js','build'],{env:process.env,stdio:'inherit'});
if(result.error)throw result.error;
process.exit(result.status??1);
