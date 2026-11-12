/**
 * Conservative DC -> ScriptRunner Cloud conversion prototype.
 * Converts only narrowly recognized, isolated statements. No network / AI / eval.
 */
export const CONVERTER_VERSION="0.1.0";
const ADAPTAVIST="https://docs.adaptavist.com/sr4js/latest/scriptrunner-migration/scriptrunner-migration-to-cloud/rewrite-scripts-for-cloud-hints-and-tips/";
const API="https://developer.atlassian.com/cloud/jira/platform/rest/v3/api-group-issues/";
const issueLookup=/^def\s+([A-Za-z_$][\w$]*)\s*=\s*ComponentAccessor\s*\.\s*getIssueManager\s*\(\s*\)\s*\.\s*getIssueByCurrentKey\s*\(\s*(['"])([A-Z][A-Z0-9_]*-\d+)\2\s*\)\s*;?$/s;
const hapiLookup=/^def\s+([A-Za-z_$][\w$]*)\s*=\s*Issues\s*\.\s*getByKey\s*\(\s*(['"])([A-Z][A-Z0-9_]*-\d+)\2\s*\)\s*;?$/s;
function identify(source){
 const withoutImport=source.trim().split(/\r?\n/).filter(
   line=>!/^import\s+com\.atlassian\.jira\.component\.ComponentAccessor\s*;?\s*$/.test(line.trim())
 ).join("\n").trim();
 let match=withoutImport.match(issueLookup);
 if(match)return {recipe:"DC_ISSUE_LOOKUP",variable:match[1],key:match[3]};
 match=withoutImport.match(hapiLookup);
 if(match)return {recipe:"HAPI_LOOKUP",variable:match[1],key:match[3]};
 return null;
}
export function convertDcScript(source,context="console"){
 if(typeof source!=="string"||!source.trim())throw new Error("Paste a Data Center Groovy script first.");
 if(source.length>1024*1024)throw new Error("Script exceeds the 1 MB limit.");
 if(!["console","listener","job","scripted-field","workflow","behaviour"].includes(context))
   throw new Error("Unsupported execution context.");
 const mapping=identify(source);
 let status="manual-review";
 let output="";
 const notices=[];
 if(context!=="console"&&context!=="job"){
   notices.push("The selected execution context has distinct Cloud bindings and feature parity. Automatic conversion is unavailable.");
 }else if(mapping?.recipe==="DC_ISSUE_LOOKUP"){
   const key=mapping.key,variable=mapping.variable;
   output=[
     "// Generated migration candidate; test in an authorized ScriptRunner Cloud "+context+" environment.",
     "// Recipe: fetch one issue by static key using Jira Cloud REST API v3.",
     'def response = get("/rest/api/3/issue/'+key+'").asObject(Map)',
     'if (response.status != 200) {',
     '    throw new IllegalStateException("Issue lookup failed: HTTP " + response.status)',
     '}',
     'def '+variable+' = response.body',
     '// TODO: Validate Cloud execution context, permissions, auth, scopes and error handling.'
   ].join("\n")+"\n";
   status="candidate";
   notices.push("Recognized an isolated issue lookup. Proposed Cloud REST API replacement.");
   notices.push("The new value is a Map rather than a Data Center Issue object; any downstream code needs separate migration.");
 }else if(mapping?.recipe==="HAPI_LOOKUP"){
   output=[
     "// Cloud HAPI parity requires checking the exact method and execution context.",
     'def '+mapping.variable+' = Issues.getByKey("'+mapping.key+'")',
     "// TODO: Verify HAPI support, permissions and response behavior in ScriptRunner Cloud."
   ].join("\n")+"\n";
   status="candidate";
   notices.push("HAPI lookup is retained as a candidate only; Cloud HAPI has limited feature parity.");
 }else{
   notices.push("No exact safe recipe matched this input; it may have multiple statements, dynamic values or unsupported APIs.");
   notices.push("Use the DC-to-Cloud assessment and a manual design review. No runnable conversion was generated.");
   output=[
     "// MANUAL CONVERSION REQUIRED — no runnable Cloud script generated.",
     "// Inventory execution context, dependencies, inputs, outputs and side effects.",
     "// Review Cloud feature parity and implement/test an approved replacement."
   ].join("\n")+"\n";
 }
 if(status==="manual-review"&&context!=="console"&&context!=="job"){
   output="// MANUAL CONVERSION REQUIRED: execution context "+context+" requires tailored implementation.\n"+
     "// Review Adaptavist feature parity, Cloud execution model and target behavior.\n";
 }
 return {converter_version:CONVERTER_VERSION,context,status,recipe:mapping?.recipe||null,
   generated_code:output,notices,
   references:[{label:"Adaptavist migration rewrite guide",url:ADAPTAVIST},
               {label:"Atlassian Jira Cloud issues API",url:API}],
   disclaimer:"Generated output is unverified and must be tested in an authorized Cloud sandbox."};
}
