/**
 * Listener migration workbench: line-accurate migration inventory + reviewable
 * Cloud candidate snippets. It is NOT an automatic executable listener translator.
 * No source is executed or transmitted; unrecognized statements remain explicit TODOs.
 */
import {segmentGroovy} from "./groovy-structure.js";
export const WORKBENCH_VERSION="0.1.0";
const DOCS={
 migration:"https://docs.adaptavist.com/sr4js/latest/scriptrunner-migration/scriptrunner-migration-to-cloud/rewrite-scripts-for-cloud-hints-and-tips/",
 listener:"https://docs.adaptavist.com/sr4jc/latest/features/script-listeners/",
 forge:"https://docs.adaptavist.com/sr4jc/latest/features/script-listeners/concept-8zac6ru5/",
 issues:"https://developer.atlassian.com/cloud/jira/platform/rest/v3/api-group-issues/",
 comments:"https://developer.atlassian.com/cloud/jira/platform/rest/v3/api-group-issue-comments/",
 search:"https://developer.atlassian.com/cloud/jira/platform/rest/v3/api-group-issue-search/",
 rate:"https://developer.atlassian.com/cloud/jira/platform/rate-limiting/"
};
const ISSUE_KEY="[A-Z][A-Z0-9_]*-\\d+";
const IDENT="[A-Za-z_$][A-Za-z0-9_$]*";
const staticLookup=new RegExp("^def\\s+("+IDENT+")\\s*=\\s*(?:(?:ComponentAccessor\\s*\\.\\s*getIssueManager\\s*\\(\\s*\\)|("+IDENT+"))\\s*\\.\\s*)?(?:getIssueByCurrentKey|getIssueByKey|getIssueObject)\\s*\\(\\s*(['\"])("+ISSUE_KEY+")\\3\\s*\\)\\s*;?$","s");
const staticDirect=/^def\s+([A-Za-z_$][\w$]*)\s*=\s*ComponentAccessor\s*\.\s*getIssueManager\s*\(\s*\)\s*\.\s*(?:getIssueByCurrentKey|getIssueByKey|getIssueObject)\s*\(\s*(['"])([A-Z][A-Z0-9_]*-\d+)\2\s*\)\s*;?$/s;
const managerDef=/^def\s+([A-Za-z_$][\w$]*)\s*=\s*ComponentAccessor\s*\.\s*(?:getIssueManager\s*\(\s*\)|issueManager)\s*;?$/s;
const lookupWithAlias=new RegExp("^def\\s+("+IDENT+")\\s*=\\s*("+IDENT+")\\s*\\.\\s*(?:getIssueByCurrentKey|getIssueByKey|getIssueObject)\\s*\\(\\s*(['\"])("+ISSUE_KEY+")\\3\\s*\\)\\s*;?$","s");
const fieldAccessor=new RegExp("^def\\s+("+IDENT+")\\s*=\\s*("+IDENT+")\\s*\\.\\s*(getSummary\\(\\)|summary|getKey\\(\\)|key|getStatus\\(\\)\\s*\\.\\s*(?:getName\\(\\)|name)|getProjectObject\\(\\)\\s*\\.\\s*getKey\\(\\))\\s*;?$","s");
const fieldMap={
 "getSummary()":"fields.summary",summary:"fields.summary",
 "getKey()":"key",key:"key",
 "getStatus().getName()":"fields.status.name","getStatus().name":"fields.status.name",
 "getProjectObject().getKey()":"fields.project.key"
};
const DEPS=[
 {id:"JAVA-API",pattern:/\b(?:ComponentAccessor|com\.atlassian\.jira|com\.onresolve|com\.adaptavist)\b/,
  title:"Data Center Java/API dependency",severity:"HIGH",category:"Platform",doc:DOCS.migration,
  advice:"Replace in-process Jira components with Cloud REST/HAPI where supported; review full method semantics."},
 {id:"FS-DB",pattern:/\b(?:java\.io|java\.nio|FileInputStream|FileOutputStream|ProcessBuilder|Runtime\s*\.\s*getRuntime|DriverManager|Sql\s*\.\s*newInstance|executeQuery)\b/,
  title:"Filesystem, process or direct database dependency",severity:"HIGH",category:"Architecture",doc:DOCS.migration,
  advice:"Redesign host-level dependencies; Cloud cannot access the Data Center JVM or server filesystem/database."},
 {id:"ISSUE-WRITE",pattern:/\b(?:setSummary|setDescription|setCustomFieldValue|updateIssue|setAssignee|setPriority|setDueDate)\s*\(/,
  title:"Issue mutation / persistence",severity:"HIGH",category:"Write API",doc:DOCS.issues,
  advice:"Map fields and field types to PUT /rest/api/3/issue/{key}; description and multiline text need ADF. Validate permission, update semantics and event loops."},
 {id:"COMMENT",pattern:/\b(?:createComment|addComment|getCommentManager)\s*\(/,
  title:"Issue comment operation",severity:"MEDIUM",category:"Write API",doc:DOCS.comments,
  advice:"Review POST /rest/api/3/issue/{key}/comment and Atlassian Document Format (ADF) payloads."},
 {id:"TRANSITION",pattern:/\b(?:transitionIssue|doTransition|progressWorkflowAction|transition\s*\()/,
  title:"Workflow transition",severity:"HIGH",category:"Write API",doc:DOCS.issues,
  advice:"Cloud uses POST /rest/api/3/issue/{key}/transitions with valid per-issue transition IDs."},
 {id:"JQL",pattern:/\b(?:SearchService|SearchProvider|searchProvider|JqlQueryParser|parseQuery|PagerFilter)\b/,
  title:"JQL search or pagination",severity:"MEDIUM",category:"Search",doc:DOCS.search,
  advice:"Use supported Cloud search endpoints, explicitly handle pagination, rate limits, permissions and JQL identifiers."},
 {id:"IDENTITY",pattern:/\b(?:getUserByName|getUserByKey|UserManager|userManager|userKey|username)\b/,
  title:"User identity mapping",severity:"MEDIUM",category:"Identity",doc:DOCS.migration,
  advice:"Review Cloud accountId, actor permissions and site-specific identity mappings."},
 {id:"EVENT",pattern:/\b(?:event\s*\.\s*(?:issue|changeLog|user|eventTypeId)|IssueEvent|ChangeItemBean|event\s+as\s+IssueEvent)\b/,
  title:"Data Center event context",severity:"HIGH",category:"Listener context",doc:DOCS.listener,
  advice:"Cloud listener context comes from webhook/Forge events. Verify available issue/user/changelog properties and map trigger and condition separately."},
 {id:"NETWORK",pattern:/\b(?:HttpURLConnection|URLConnection|new\s+URL\s*\(|RESTClient|HttpClient)\b/,
  title:"External HTTP integration",severity:"MEDIUM",category:"Integration",doc:DOCS.rate,
  advice:"Review allowed Cloud HTTP clients, URL allowlists, scopes, retries/429 and credentials."},
 {id:"CF",pattern:/\b(?:getCustomFieldObject|getCustomFieldValue|getCustomFieldManager|customFieldManager|customfield_\d+)\b/,
  title:"Custom field mapping",severity:"MEDIUM",category:"Fields",doc:DOCS.issues,
  advice:"Map custom field IDs and contexts; inspect Cloud field type, response payload, ADF and edit metadata."},
 {id:"LOOP",pattern:/\b(?:Thread\s*\.\s*sleep|while\s*\(|for\s*\(|each\s*\{|collect\s*\{|findAll\s*\{)\b/,
  title:"Loop or blocking execution",severity:"MEDIUM",category:"Execution",doc:DOCS.rate,
  advice:"Review Cloud execution limits, paged retrieval, retries and idempotency."},
 {id:"SECURITY",pattern:/\b(?:password|secret|apiToken|clientSecret|Bearer|Authorization)\b/i,
  title:"Potential credential handling",severity:"HIGH",category:"Security",doc:DOCS.migration,
  advice:"Move live secrets into approved ScriptRunner Cloud Script Variables or other supported secret stores."}
];
function isControl(raw){
 return /^(?:if|else|switch|case|for|while|try|catch|finally|synchronized|do|return|throw|break|continue|class|interface)\b/.test(raw)||
     /(?:->|\beach\s*\{)\s*$/.test(raw);
}
const content=(source,segment)=>source.slice(segment.start,segment.end).trim();
function classify(source,masked,segment,state){
  const original=content(source,segment);
  const code=masked.slice(segment.start,segment.end).trim();
  const base={id:segment.id,start:segment.start,end:segment.end,lineStart:segment.lineStart,
    lineEnd:segment.lineEnd,depth:segment.depth,category:"Unclassified",title:"Requires human translation",
    disposition:"manual",severity:"MEDIUM",advice:"Review behavior, effects and available Cloud APIs. No automatic translation is attempted.",
    doc:DOCS.migration,snippet:null,rule:"UNKNOWN"};
  if(!original)return null;
  if(/^import\s+/.test(original)){
    const isDC=/\b(?:com\.atlassian\.jira|com\.onresolve|com\.adaptavist|java\.(?:io|sql|nio))\b/.test(original);
    return {...base,category:"Imports",title:isDC?"Data Center import to remove/redesign":"Import requires review",
      disposition:isDC?"remove":"manual",rule:isDC?"IMPORT-DC":"IMPORT",
      severity:isDC?"HIGH":"LOW",
      advice:isDC?"Remove import after migrating ALL dependent API calls; a simple import removal does not migrate behavior.":"Verify that this import exists in ScriptRunner Cloud."};
  }
  if(segment.kind==="block-open"||isControl(original)){
    return {...base,category:"Control flow",title:"Control flow / closure requires semantic review",
      disposition:"structural",rule:"FLOW",severity:"MEDIUM",
      advice:"Preserve branch conditions, guards, scope and exception behavior while rewriting dependent API calls."};
  }
  let m=original.match(managerDef);
  if(m){
    state.managers.add(m[1]);
    return {...base,category:"Platform",title:"Jira issue manager dependency",rule:"MANAGER-DC",
      disposition:"remove",severity:"HIGH",
      advice:"Cloud does not expose the Data Center IssueManager; replace its usage with supported Cloud REST/HAPI operations."};
  }
  m=original.match(staticDirect);
  let key=null,variable=null;
  if(m){variable=m[1];key=m[3];}
  else{
    const alias=original.match(lookupWithAlias);
    if(alias&&state.managers.has(alias[2])){variable=alias[1];key=alias[4];}
  }
  if(key!==null){
    state.issueVars.add(variable);
    const response="cloudResponse_"+segment.id.replace("S","");
    const code=[
      "// Cloud REST v3 candidate for original line "+segment.lineStart+" — validate permissions and event context.",
      'def '+response+' = get("/rest/api/3/issue/'+key+'").asObject(Map)',
      'if ('+response+'.status != 200) {',
      '  throw new IllegalStateException("Issue lookup failed: HTTP " + '+response+'.status)',
      '}',
      'def '+variable+' = '+response+'.body'
    ].join("\n");
    return {...base,category:"Issue read",title:"Static issue lookup → Jira Cloud REST v3",
      disposition:"candidate",rule:"LOOKUP-STATIC",severity:"LOW",snippet:code,doc:DOCS.issues,
      advice:"Returns a Map instead of a DC Issue. Check permissions, scopes, error policy and downstream consumers."};
  }
  m=original.match(fieldAccessor);
  if(m&&state.issueVars.has(m[2])){
    const accessor=m[3].replace(/\s+/g,"");
    if(Object.hasOwn(fieldMap,accessor)){
      return {...base,category:"Issue read",title:"Read-only issue property → Cloud response field",
        disposition:"candidate",rule:"FIELD-READ",severity:"LOW",doc:DOCS.issues,
        snippet:"def "+m[1]+" = "+m[2]+"."+fieldMap[accessor],
        advice:"Verify field shape, nullability and Data Center-to-Cloud semantics in a Cloud sandbox."};
    }
  }
  if(/^\s*(?:log|logger)\s*\.\s*(?:info|warn|error|debug)\s*\(/.test(original)){
    const level=(original.match(/^\s*(?:log|logger)\s*\.\s*(info|warn|error|debug)/)||[])[1]||"info";
    return {...base,category:"Logging",title:"Cloud logger mapping (template)",
      disposition:"template",rule:"LOGGER",severity:"LOW",doc:DOCS.listener,
      snippet:'logger.'+level+'("TODO: review original message and sensitive data")',
      advice:"Cloud listener offers logger; message, interpolation and privacy must be manually reviewed."};
  }
  if(/\b(?:event\s*\.\s*issue|issue\s*=\s*event\s*\.)/.test(code)){
    return {...base,category:"Listener context",title:"Event issue binding requires Cloud context mapping",
      disposition:"manual",rule:"EVENT-CONTEXT",severity:"HIGH",doc:DOCS.forge,
      advice:"Cloud listener exposes event-specific variables, potentially lazy-fetched Forge data; validate event and field availability."};
  }
  const matched=DEPS.filter(rule=>rule.pattern.test(code));
  if(matched.length){
    const first=matched[0];
    return {...base,category:first.category,title:first.title,rule:first.id,
      severity:matched.some(x=>x.severity==="HIGH")?"HIGH":first.severity,
      advice:[...new Set(matched.map(x=>x.advice))].join(" "),
      doc:first.doc,dependencies:matched.map(x=>x.id)};
  }
  if(/^\s*(?:def|final|String|Long|Integer|Boolean|Map|List|Set)\b/.test(code)){
    return {...base,category:"Data/logic",title:"Groovy expression requires compatibility review",
      disposition:"manual",rule:"GROOVY-EXPRESSION",severity:"LOW",
      advice:"Pure language expressions may transfer; inspect types, implicit coercion, non-Cloud classes and variable provenance."};
  }
  return base;
}
export function analyzeListenerMigration(source,options={}){
  if(typeof source!=="string"||!source.trim())throw new Error("Paste a Data Center listener first.");
  if(source.length>1024*1024)throw new Error("Listener exceeds 1 MB limit.");
  const structured=segmentGroovy(source);
  const state={managers:new Set(),issueVars:new Set()};
  const steps=structured.segments.map(s=>classify(source,structured.masked,s,state)).filter(Boolean);
  const totals={candidate:0,template:0,manual:0,structural:0,remove:0};
  for(const step of steps)totals[step.disposition]++;
  const risk={
    high:steps.filter(s=>s.severity==="HIGH").length,
    medium:steps.filter(s=>s.severity==="MEDIUM").length,
    low:steps.filter(s=>s.severity==="LOW").length
  };
  const controls=[
    {id:"listener-event",title:"Event mapping",description:"Select Cloud Script Listener events and Jira Expression condition; do not copy DC event classes.",reference:DOCS.listener},
    {id:"forge-event",title:"Forge event payload",description:"Review missing/proxied event properties and changed event bindings; do not assume DC changelog structure.",reference:DOCS.forge},
    {id:"execution-user",title:"Execution identity",description:"Select ScriptRunner Add-on vs initiating user and verify permissions/scopes.",reference:DOCS.listener},
    {id:"idempotency",title:"Event recursion / idempotency",description:"Prevent duplicate effects and listener re-trigger loops, especially after issue updates.",reference:DOCS.listener},
    {id:"rate-limit",title:"Cloud limits and retries",description:"Test API pagination, 429 retry/backoff, timeouts, and execution duration.",reference:DOCS.rate},
    {id:"sandbox",title:"Sandbox acceptance test",description:"Verify with authorized synthetic cases, negative cases, permission variations and event timing.",reference:DOCS.migration}
  ];
  if(structured.diagnostics.length)controls.unshift({
    id:"syntax",title:"Potentially malformed or ambiguous Groovy syntax",
    description:"Correct tokenization diagnostics before using any generated candidate.",reference:DOCS.migration});
  const report={schema_version:1,tool:"Listener Migration Workbench",version:WORKBENCH_VERSION,
    mode:"dc-listener-migration",source_lines:structured.lineCount,
    statements_analyzed:steps.length,counts:totals,severity:risk,
    lexical_diagnostics:structured.diagnostics,
    source_mapping:steps.map(s=>({id:s.id,from:s.lineStart,to:s.lineEnd,disposition:s.disposition,rule:s.rule})),
    steps,controls, disclaimer:"This is a structured migration plan, NOT a ready-to-run Jira Cloud listener. No automatic deployment or runtime validation.",
    verified:false};
  return report;
}
function singleLine(text){return String(text).replace(/\s+/g," ").trim();}
export function migrationBlueprint(report){
  const lines=[
    "// =====================================================",
    "// ScriptRunner DC -> Cloud listener migration blueprint",
    "// NOT EXECUTABLE: every section requires human review.",
    "// No original source is included, except identifiers in supported candidates.",
    "// =====================================================",
    "// Listener setup: choose event(s), optional Jira Expression condition, execution user.",
    "// Safety gates: permissions, Forge event payload, ADF, 429 retries, idempotency.",
    "// Source lines: "+report.source_lines+" | statements: "+report.statements_analyzed,
    ""
  ];
  for(const step of report.steps){
    lines.push("// ["+step.id+" | DC "+step.lineStart+"-"+step.lineEnd+" | "+step.disposition.toUpperCase()+
       " | "+step.rule+"] "+singleLine(step.title));
    lines.push("// TODO: "+singleLine(step.advice));
    if(step.snippet){
      lines.push("// Proposed snippet (UNVERIFIED; comment-only):");
      for(const l of step.snippet.split("\n"))lines.push("//   "+l);
    }
    lines.push("");
  }
  lines.push("// FINAL GATE: Validate and assemble a new Cloud listener in a permitted sandbox.");
  return lines.join("\n")+"\n";
}
export function migrationMarkdown(report){
  const rows=report.steps.map(s=>
    "| "+s.id+" | "+s.lineStart+"–"+s.lineEnd+" | "+s.disposition+" | "+s.rule+" | "+
    s.title.replaceAll("|","/")+" |").join("\n");
  let text="# Jira Data Center → Cloud Listener Migration Plan\n\n";
  text+="**Status:** migration guidance, **not** a runnable Cloud listener.\n\n";
  text+="Source: "+report.source_lines+" lines; "+report.statements_analyzed+" statements; "+
    report.counts.candidate+" candidate snippets; "+report.counts.manual+" manual steps; "+
    report.counts.structural+" control-flow nodes.\n\n";
  text+="## Line-mapped inventory\n\n| ID | DC lines | Treatment | Rule | Operation |\n|---|---:|---|---|---|\n"+rows+"\n\n";
  text+="## Step-by-step rewrites and TODOs\n\n";
  for(const s of report.steps){
    text+="### "+s.id+" — DC lines "+s.lineStart+"–"+s.lineEnd+"\n\n**"+s.title+"** ("+s.disposition+")\n\n"+
      s.advice+"\n\n";
    if(s.snippet)text+="Candidate snippet — **not verified**:\n\n"+String.fromCharCode(96).repeat(3)+
       "groovy\n"+s.snippet+"\n"+String.fromCharCode(96).repeat(3)+"\n\n";
    text+="Reference: "+s.doc+"\n\n";
  }
  text+="## Mandatory migration acceptance gates\n\n";
  for(const c of report.controls)text+="- [ ] **"+c.title+":** "+c.description+" ("+c.reference+")\n";
  if(report.lexical_diagnostics.length){
    text+="\n## Parsing warnings\n\n";
    for(const d of report.lexical_diagnostics)text+="- Line "+d.line+": "+d.reason+"\n";
  }
  return text+"\n";
}
