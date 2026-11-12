/**
 * Jira Cloud assessment helpers: OFFLINE, heuristic and deliberately non-executing.
 * Data is analyzed locally; never returns source snippets or credential values.
 * Not an official Atlassian migration/compatibility certification.
 */
import {maskNonCode,analyze as analyzeGroovy,VERSION} from "./engine.js";

export const CLOUD_RULES=[
{id:"CLD001",severity:"HIGH",category:"Cloud architecture",message:"Data Center Java API dependency",effort:"HIGH",help:"Jira Cloud scripts cannot directly invoke Jira's in-process Java APIs. Redesign around Cloud REST APIs or supported HAPI functions; validate permissions and app context.",reference:"https://docs.adaptavist.com/sr4js/latest/scriptrunner-migration/scriptrunner-migration-to-cloud/"},
{id:"CLD002",severity:"MEDIUM",category:"Cloud integration",message:"Server-style Jira REST endpoint",effort:"MEDIUM",help:"Review path and method against the Jira Cloud REST API. Some /rest/api/2 endpoints remain supported; this is a review hint, not an assertion of removal.",reference:"https://developer.atlassian.com/cloud/jira/platform/rest/v3/intro/"},
{id:"CLD003",severity:"HIGH",category:"Cloud architecture",message:"Local filesystem or process dependency",effort:"HIGH",help:"Reconsider local filesystem, shell, or host-level dependencies. Cloud app runtimes do not grant access to the Jira server filesystem or JVM.",reference:"https://docs.adaptavist.com/sr4js/latest/scriptrunner-migration/scriptrunner-migration-to-cloud/"},
{id:"CLD004",severity:"MEDIUM",category:"Cloud identity",message:"Legacy user identifier lookup",effort:"MEDIUM",help:"Assess migration to Cloud accountId-based identity. Validate endpoint, privacy rules and target platform rather than assuming username mappings survive.",reference:"https://support.atlassian.com/cloud-automation/docs/import-and-export-jira-automation-rules/"},
{id:"CLD005",severity:"MEDIUM",category:"Cloud security",message:"Potential inline secret or authorization header",effort:"MEDIUM",help:"Review how authentication is managed. Do not place live credentials in source, rule exports or public repositories.",reference:"https://developer.atlassian.com/cloud/jira/platform/security-overview/"},
{id:"CLD006",severity:"MEDIUM",category:"Cloud reliability",message:"HTTP call requires rate-limit/error review",effort:"MEDIUM",help:"Check pagination, 429 retry/backoff, scopes, timeouts, and transient errors for Cloud REST calls.",reference:"https://developer.atlassian.com/cloud/jira/platform/rate-limiting/"},
{id:"AUT001",severity:"MEDIUM",category:"Automation security",message:"Outgoing web request action",effort:"MEDIUM",help:"Review destination, credential storage and data minimization. Export alone cannot prove webhook safety.",reference:"https://support.atlassian.com/cloud-automation/docs/import-and-export-jira-automation-rules/"},
{id:"AUT002",severity:"MEDIUM",category:"Automation migration",message:"Instance-specific field or identifier reference",effort:"MEDIUM",help:"Verify that project, custom-field, status and issue-type identifiers map correctly to the target site.",reference:"https://support.atlassian.com/cloud-automation/docs/import-and-export-jira-automation-rules/"},
{id:"AUT003",severity:"LOW",category:"Automation operations",message:"Disabled automation flow",effort:"LOW",help:"Verify whether this flow should be enabled. Imports initially disable flows; do not automatically enable in production.",reference:"https://support.atlassian.com/cloud-automation/docs/import-and-export-jira-automation-rules/"},
{id:"AUT004",severity:"MEDIUM",category:"Automation identity",message:"User identity reference requires review",effort:"MEDIUM",help:"Validate owners and user/accountId references on the destination site. Server/DC-to-Cloud owners may need manual accountId mapping.",reference:"https://support.atlassian.com/cloud-automation/docs/import-and-export-jira-automation-rules/"}
];
const byId=new Map(CLOUD_RULES.map(r=>[r.id,r]));
const DC_REFERENCE="https://docs.adaptavist.com/sr4js/latest/scriptrunner-migration/scriptrunner-migration-to-cloud/";
const MIG_RULES=[
{id:"MIG001",severity:"HIGH",category:"Architecture",message:"In-process Jira Data Center Java API",effort:"HIGH",help:"Rewrite or redesign around available Jira Cloud REST APIs / ScriptRunner Cloud HAPI, then validate runtime and permissions.",reference:DC_REFERENCE},
{id:"MIG002",severity:"HIGH",category:"Architecture",message:"Server filesystem, process or database access",effort:"HIGH",help:"Cloud cannot access Jira's server filesystem, database or local processes. Identify a supported Cloud integration or redesign.",reference:DC_REFERENCE},
{id:"MIG003",severity:"MEDIUM",category:"Identity",message:"User key/username logic requiring Cloud review",effort:"MEDIUM",help:"Review use of accountId, privacy controls, and identity mappings on the target Cloud site.",reference:"https://support.atlassian.com/migration/docs/scriptrunner-for-jira/"},
{id:"MIG004",severity:"MEDIUM",category:"App parity",message:"ScriptRunner-specific script or workflow behavior",effort:"UNKNOWN",help:"Verify feature-by-feature availability in ScriptRunner Cloud; Groovy is supported for some features, JS/TS and Jira Expressions for others.",reference:"https://docs.adaptavist.com/sr4jc/latest/get-started/scripting-in-scriptrunner-for-jira-cloud/"}
];
function lineAt(source,index){
 const before=source.slice(0,index),last=before.lastIndexOf("\n");
 return {line:before.split("\n").length,column:index-last};
}
function finding(rule,file,line,column=1){
 return {file,line,column,rule:rule.id,severity:rule.severity,category:rule.category,
 message:rule.message,help:rule.help,effort:rule.effort,reference:rule.reference};
}
function testPatterns(source,file,definitions,mask){
 const findings=[];
 for(const [rule,pattern,raw] of definitions){
   const input=raw?source:mask;
   for(const m of input.matchAll(pattern)){
     if(raw&&mask[m.index]===" ")continue;
     findings.push(finding(rule,file,...Object.values(lineAt(source,m.index))));
   }
 }
 return findings;
}
function count(findings){
 return Object.fromEntries(["HIGH","MEDIUM","LOW"].map(k=>[k,findings.filter(f=>f.severity===k).length]));
}
function finalReport(mode,files,findings,additional={}){
 findings.sort((a,b)=>a.file.localeCompare(b.file)||a.line-b.line||a.column-b.column||a.rule.localeCompare(b.rule));
 return {schema_version:2,engine:"browser",engine_version:VERSION,mode,files_scanned:files,
   counts:count(findings),findings,...additional};
}
function unique(findings){
 const found=new Set();
 return findings.filter(f=>{
  const key=[f.file,f.line,f.column,f.rule].join("|");
  if(found.has(key))return false; found.add(key);return true;
 });
}
export function analyzeCloudScript(source,filename="cloud.groovy",language="groovy"){
 if(!["groovy","javascript","typescript"].includes(language))throw new Error("Unsupported Cloud scripting language");
 const mask=maskNonCode(source); // Approximate for JS/TS; template literals are not fully handled
 const patterns=[
 [byId.get("CLD001"),/\b(?:com\.atlassian\.jira|ComponentAccessor|com\.onresolve\.scriptrunner\.runner\.customisers\.PluginModule)\b/gi,false],
 [byId.get("CLD002"),/\/rest\/api\/2\/(?:search|issue|user)\b/gi,true],
 [byId.get("CLD003"),/\b(?:java\.io\.File|new\s+File\s*\(|ProcessBuilder\s*\(|Runtime\.getRuntime\s*\(|FileInputStream\s*\()/gi,false],
 [byId.get("CLD004"),/\b(?:getUserByName|getUserByKey|username\s*[:=])/gi,false],
 [byId.get("CLD005"),/\b(?:password|clientSecret|apiToken|authorization)\s*[:=]\s*(['"])[^'"\r\n]{4,}\1/gi,true],
 [byId.get("CLD006"),/\b(?:get|post|put|delete|patch)\s*\(\s*['"]\/rest\/api\//gi,true]
 ];
 let findings=testPatterns(source,filename,patterns,mask);
 // Cross-check Groovy secrets, while avoiding redundant cloud warnings.
 if(language==="groovy"){
  for(const f of analyzeGroovy(source,filename,["JSA002","JSA003","JSA004","JSA005","JSA006","JSA007","JSA008","JSA009","JSA010","JSA011"])){
   if(f.rule==="JSA001"&&!findings.some(x=>x.rule==="CLD005"&&x.line===f.line))
    findings.push({...f,effort:"MEDIUM",reference:byId.get("CLD005").reference});
  }
 }
 return unique(findings);
}
const maxNodes=25000;
export function parseAutomationExport(text){
 if(text.length>5*1024*1024)throw new Error("Automation export exceeds 5 MB limit");
 let doc;try{doc=JSON.parse(text)}catch{throw new Error("Invalid JSON: select an Automation export") }
 if(!doc||typeof doc!=="object")throw new Error("Expected a JSON object or rules array");
 // Atlassian exports may be {rules:[...]}, an array of rules, or a single rule.
 const rules=Array.isArray(doc)?doc:Array.isArray(doc.rules)?doc.rules:
    Array.isArray(doc.flows)?doc.flows:doc.name&&typeof doc==="object"?[doc]:null;
 if(!rules||!rules.length)throw new Error("No recognizable automation rules or flows in JSON");
 if(rules.length>2000)throw new Error("Too many rules in one export");
 return rules;
}
function scanAutomationRules(rules,filename){
 const findings=[];let visited=0;let nodes=0;
 for(let i=0;i<rules.length;i++){
  const rule=rules[i];
  if(!rule||typeof rule!=="object"||Array.isArray(rule))continue;
  visited++;
  if(rule.state==="DISABLED"||rule.enabled===false||rule.state==="disabled"){
    findings.push(finding(byId.get("AUT003"),filename,i+1));
  }
  const stack=[{node:rule,depth:0}];
  while(stack.length){
   const {node,depth}=stack.pop();
   if(++nodes>maxNodes)throw new Error("Automation export too complex to analyze safely");
   if(depth>50)throw new Error("Automation nesting too deep");
   if(!node||typeof node!=="object")continue;
   for(const [key,value] of Object.entries(node)){
    const k=key.toLowerCase();
    if(typeof value==="string"){
     if(/(?:type|component|action)/.test(k)&&/send.?web.?request|webhook|outgoingwebrequest/i.test(value))
      findings.push(finding(byId.get("AUT001"),filename,i+1));
     if(/(?:customfield_\d+|customFieldId|fieldId|statusId|issueTypeId|projectId)/i.test(key+" "+value))
      findings.push(finding(byId.get("AUT002"),filename,i+1));
     if(/(?:owner|user(key|name|id)?|actor|accountid)/i.test(key))
      findings.push(finding(byId.get("AUT004"),filename,i+1));
    }else if(value&&typeof value==="object")stack.push({node:value,depth:depth+1});
   }
  }
 }
 return {visited,findings:unique(findings)};
}
export function analyzeAutomationJson(text,filename="automation.json"){
 const rules=parseAutomationExport(text);
 const {visited,findings}=scanAutomationRules(rules,filename);
 return finalReport("automation-cloud",1,findings,{rules_scanned:visited,
 note:"Locations refer to rule ordinal positions, not JSON source lines. Verify results in Jira."});
}
export function assessMigration(files){
 const findings=[];
 const patternSets=[
 [MIG_RULES[0],/\b(?:com\.atlassian\.jira|ComponentAccessor|IssueManager|CustomFieldManager)\b/gi],
 [MIG_RULES[1],/\b(?:java\.io\.File|FileInputStream|new\s+File\s*\(|ProcessBuilder\s*\(|Runtime\.getRuntime\s*\(|getConnection\s*\(|DriverManager)\b/gi],
 [MIG_RULES[2],/\b(?:getUserByName|getUserByKey|username)\b/gi],
 [MIG_RULES[3],/\b(?:@Field|@WithPlugin|PluginModule|ScriptRunner|com\.onresolve)\b/gi]
 ];
 for(const f of files){
   const code=maskNonCode(f.content);
   for(const [rule,pat] of patternSets){
     for(const m of code.matchAll(pat)){
       const loc=lineAt(f.content,m.index);
       findings.push(finding(rule,f.name,loc.line,loc.column));
     }
   }
 }
 const condensed=unique(findings);
 const effortCounts={HIGH:0,MEDIUM:0,LOW:0,UNKNOWN:0};
 for(const f of condensed)effortCounts[f.effort]++;
 return finalReport("dc-to-cloud",files.length,condensed,{
   effort_indicators:effortCounts,
   assessment:"Review indicators only. Effort is per finding, not a project duration or automated migration feasibility result.",
   next_steps:["Inventory scripts and usage frequency","Validate ScriptRunner Cloud feature parity",
               "Review Cloud REST APIs, HAPI and Jira Expressions",
               "Test rewrite with a permitted Cloud sandbox and owner approval"]
 });
}
export function analyzeCloudFiles(files,language){
 return finalReport("scriptrunner-cloud",files.length,unique(files.flatMap(f=>analyzeCloudScript(f.content,f.name,language))),
  {language,note:"Heuristic source review; no runtime execution, connectivity or API compatibility guarantee."});
}
