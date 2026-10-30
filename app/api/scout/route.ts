import { readState,writeBatch,brief } from '../../../lib/scout';
export const dynamic='force-dynamic';
export async function GET(){return Response.json(await readState(),{headers:{'Cache-Control':'no-store'}});}
// This endpoint is protected by the confirmed owner-private Sites boundary.
// Scheduled agents obtain supported service access from get_site, never from source.
export async function POST(req:Request){try{return Response.json(await writeBatch(await req.json()));}catch(e){return Response.json({error:String(e)},{status:400});}}
