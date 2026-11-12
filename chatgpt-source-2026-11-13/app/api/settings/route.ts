import {saveSettings} from '../../../lib/scout';
export async function POST(req:Request){try{return Response.json(await saveSettings(await req.json()))}catch(e){return Response.json({error:e instanceof Error?e.message:'Invalid settings'},{status:400})}}
