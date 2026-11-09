export function normalize(text){return String(text||'').normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/spring[\s-]*boot/g,'springboot').replace(/back[\s-]*end/g,'backend').replace(/front[\s-]*end/g,'frontend').replace(/full[\s-]*stack/g,'fullstack').replace(/\.net\b/g,'dotnet').replace(/[^a-z0-9+#]+/g,' ').trim();}
export function matchesQuery(job,query){
 const tokens=normalize(query).split(/\s+/).filter(Boolean);
 const words=new Set(normalize(`${job.title} ${job.company} ${job.description} ${(job.matched_skills||[]).join(' ')}`).split(/\s+/));
 const equivalents={developer:['developer','developers','development','engineer','engineers','engineering'],engineer:['developer','developers','development','engineer','engineers','engineering'],rest:['rest','restful'],api:['api','apis'],sql:['sql','mysql']};
 return tokens.every(token=>(equivalents[token]||[token]).some(term=>words.has(term)));
}
const CANADA=/\b(canada|canadian|vancouver|toronto|montreal|ottawa|calgary|edmonton|waterloo|kitchener|victoria|winnipeg|halifax|quebec|saskatoon|regina|mississauga|burnaby|ontario|british columbia|alberta|manitoba|nova scotia|new brunswick|newfoundland|prince edward island|saskatchewan)\b/i;
export function matchesLocation(job,query){const value=normalize(query);if(!value)return true;const location=normalize(job.location);if(['canada','ca','canadian'].includes(value))return CANADA.test(location);if(['vancouver bc','vancouver british columbia'].includes(value))return /\bvancouver\b/.test(location);return value.split(/\s+/).every(token=>location.includes(token));}
