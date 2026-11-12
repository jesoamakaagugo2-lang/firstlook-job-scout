export function validateSettings(value) {
 if(!value || typeof value !== 'object' || Array.isArray(value)) throw Error('Invalid settings');
 const allowed=['roles','geography','pay','payFloor','postingWindowDays'];
 if(Object.keys(value).some(k=>!allowed.includes(k))) throw Error('Only search settings can be edited');
 if(!Array.isArray(value.roles)||!value.roles.length||value.roles.length>20||value.roles.some(r=>typeof r!=='string'||!r.trim()||r.length>150)) throw Error('Enter 1–20 role names, each up to 150 characters');
 if(!Number.isFinite(value.payFloor)||value.payFloor<0||value.payFloor>100000) throw Error('Enter a valid monthly pay floor');
 if(typeof value.geography!=='string'||!value.geography.trim()||value.geography.length>3000||typeof value.pay!=='string'||value.pay.length>3000) throw Error('Enter valid geography and pay notes');
 if(!Number.isInteger(value.postingWindowDays)||value.postingWindowDays<1||value.postingWindowDays>30) throw Error('Choose a posting window from 1 to 30 days');
 return {postingWindowDays:value.postingWindowDays,roles:value.roles.map(r=>r.trim()),geography:value.geography.trim(),pay:value.pay.trim(),payFloor:value.payFloor};
}
