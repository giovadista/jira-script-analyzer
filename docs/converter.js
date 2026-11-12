/**
 * Conservative offline DC -> ScriptRunner Cloud conversion engine.
 * Deliberately accepts ONLY a small grammar of isolated, read-only scripts.
 * Never executes source, contacts Jira, or returns raw source on failure.
 */
export const CONVERTER_VERSION="0.2.0";
const GUIDE="https://docs.adaptavist.com/sr4js/latest/scriptrunner-migration/migrating-to-cloud";
const ISSUES="https://developer.atlassian.com/cloud/jira/platform/rest/v3/api-group-issues/";
const FIELDS="https://developer.atlassian.com/cloud/jira/platform/rest/v3/api-group-issue-fields/";
const COMMENT="https://developer.atlassian.com/cloud/jira/platform/rest/v3/api-group-issue-comments/";
const CONTEXTS=["console","listener","job","scripted-field","workflow","behaviour"];
const IDENT="[A-Za-z_$][\\w$]*";
const KEY="[A-Z][A-Z0-9_]*-\\d+";
const lookup=new RegExp("^def\\s+("+IDENT+")\\s*=\\s*ComponentAccessor\\s*\\.\\s*getIssueManager\\s*\\(\\s*\\)\\s*\\.\\s*(?:getIssueByCurrentKey|getIssueByKey|getIssueObject)\\s*\\(\\s*(['\"])("+KEY+")\\2\\s*\\)\\s*;?$");
const hapi=new RegExp("^def\\s+("+IDENT+")\\s*=\\s*Issues\\s*\\.\\s*getByKey\\s*\\(\\s*(['\"])("+KEY+")\\2\\s*\\)\\s*;?$");
const safeImport=/^import\s+com\.atlassian\.jira\.component\.ComponentAccessor\s*;?$/;
const lookups=new Set(["getSummary()","summary","getKey()","key","getStatus().getName()","getStatus().name","getProjectObject().getKey()"]);
function normalizedStatements(source){
  const statements=[];
  for(const raw of source.replace(/\r\n?/g,"\n").split("\n")){
    const line=raw.trim();
    if(!line||safeImport.test(line)||line.startsWith("//"))continue;
    // Refuse inline comments, multiline literal syntax, control flow and multiple statements.
    if(line.includes("/*")||line.includes("*/")||line.includes("'''")||line.includes('"""')||
      line.includes(";")&&!line.endsWith(";"))return null;
    statements.push(line);
  }
  return statements;
}
function parsed(source){
  const statements=normalizedStatements(source);
  if(!statements||statements.length<1||statements.length>2)return null;
  let m=statements[0].match(lookup),kind="DC_ISSUE_LOOKUP";
  if(!m){m=statements[0].match(hapi);kind="HAPI_LOOKUP";}
  if(!m)return null;
  const out={recipe:kind,variable:m[1],key:m[3],operation:"lookup"};
  if(statements.length===2){
    // Only read-only safe methods; no mutations, dynamic expressions or arbitrary chains.
    const second=new RegExp("^def\\s+("+IDENT+")\\s*=\\s*"+out.variable.replace(/[$]/g,"\\$&")+"\\s*\\.\\s*(getSummary\\(\\)|summary|getKey\\(\\)|key|getStatus\\(\\)\\s*\\.\\s*(?:getName\\(\\)|name)|getProjectObject\\(\\)\\s*\\.\\s*getKey\\(\\))\\s*;?$");
    const found=statements[1].match(second);
    if(!found)return null;
    const expression=found[2].replace(/\s+/g,"");
    if(!lookups.has(expression))return null;
    out.operation="field";
    out.target=found[1];
    out.accessor=expression;
  }
  return out;
}
const patternHints=[
  {id:"write",pattern:/\b(?:setSummary|setDescription|setCustomFieldValue|updateIssue|setAssignee)\s*\(/,
   note:"Write operation found. Jira Cloud updates use PUT /rest/api/3/issue/{key} and fields/update payloads; text areas require Atlassian Document Format. Mutations cannot be safely inferred from DC setters.",ref:ISSUES},
  {id:"comment",pattern:/\b(?:create|add)Comment\s*\(/,
   note:"Comment operations require Jira Cloud issue comment POST and Atlassian Document Format content, with appropriate permissions.",ref:COMMENT},
  {id:"transition",pattern:/\b(?:transition|progress|doTransition)\w*\s*\(/i,
   note:"Workflow transitions use POST /rest/api/3/issue/{key}/transitions and destination transition IDs, not arbitrary DC status setters.",ref:ISSUES},
  {id:"jql",pattern:/\b(?:SearchService|searchProvider|parseQuery|JqlQueryParser)\b/,
   note:"JQL migration requires REST search semantics, pagination, scopes and site-dependent fields. No direct statement rewrite is assumed.",ref:"https://developer.atlassian.com/cloud/jira/platform/rest/v3/api-group-issue-search/"},
  {id:"server",pattern:/\b(?:ComponentAccessor|com\.atlassian\.jira|java\.io|FileInputStream|ProcessBuilder|DriverManager)\b/,
   note:"On-premise Java API, filesystem or server dependency requires redesign for Cloud runtime and REST APIs.",ref:GUIDE},
  {id:"identity",pattern:/\b(?:getUserByName|getUserByKey|username|userKey)\b/,
   note:"Review Cloud accountId mapping and privacy restrictions.",ref:GUIDE}
];
function hints(source){
  const result=[];
  for(const h of patternHints)if(h.pattern.test(source))result.push({id:h.id,message:h.note,reference:h.ref});
  return result;
}
function mapAccessor(accessor){
  if(accessor==="getSummary()"||accessor==="summary")return {code:"fields.summary",note:"Summary is a string on Jira Cloud issue fields."};
  if(accessor==="getStatus().getName()"||accessor==="getStatus().name")return {code:"fields.status.name",note:"Status field shape and availability depend on permissions."};
  if(accessor==="getProjectObject().getKey()")return {code:"fields.project.key",note:"Project information is exposed through Cloud fields.project."};
  if(accessor==="getKey()"||accessor==="key")return {code:"key",note:"Issue key is a top-level field in the Cloud issue response."};
  return null;
}
export function convertDcScript(source,context="console"){
  if(typeof source!=="string"||!source.trim())throw new Error("Paste a Data Center Groovy script first.");
  if(source.length>1024*1024)throw new Error("Script exceeds the 1 MB limit.");
  if(!CONTEXTS.includes(context))throw new Error("Unsupported execution context.");
  const operation=parsed(source);
  const supportedContext=context==="console"||context==="job";
  const tasks=hints(source);
  const references=[
    {label:"Adaptavist migration guidance",url:GUIDE},
    {label:"Jira Cloud Issues REST API",url:ISSUES},
    {label:"Jira Cloud issue fields",url:FIELDS}
  ];
  let status="manual-review";
  let generated_code="";
  let recipe=null;
  let confidence="none";
  const notices=[];
  if(!supportedContext){
    notices.push("Execution context '"+context+"' requires contextual bindings and ScriptRunner Cloud feature-parity review. No runnable candidate generated.");
  }else if(operation){
    recipe=operation.recipe;
    if(operation.recipe==="HAPI_LOOKUP"&&operation.operation==="lookup"){
      status="candidate";confidence="low";
      generated_code=[
        "// REVIEW CANDIDATE: Cloud HAPI availability and method behavior must be checked.",
        'def '+operation.variable+' = Issues.getByKey("'+operation.key+'")',
        "// TODO: Verify feature parity, runtime, permissions and response semantics."
      ].join("\n")+"\n";
      notices.push("No change to HAPI lookup. Validate feature parity on the target Cloud app version.");
    }else{
      status="candidate";confidence="medium";
      const bodyVariable="cloudIssueResponse";
      const lines=[
        "// GENERATED READ-ONLY CANDIDATE — NOT VERIFIED IN CLOUD.",
        "// Validate execution context, permissions, scopes and HTTP failures before deployment.",
        'def '+bodyVariable+' = get("/rest/api/3/issue/'+operation.key+'").asObject(Map)',
        "if ("+bodyVariable+".status != 200) {",
        '    throw new IllegalStateException("Issue lookup failed: HTTP " + '+bodyVariable+'.status)',
        "}",
        "def "+operation.variable+" = "+bodyVariable+".body"
      ];
      if(operation.operation==="field"){
        const accessor=mapAccessor(operation.accessor);
        if(!accessor){status="manual-review";confidence="none";}
        else{
          lines.push("def "+operation.target+" = "+operation.variable+"."+accessor.code);
          notices.push(accessor.note);
          recipe=operation.recipe+"_READ_"+operation.accessor;
        }
      }
      if(status==="candidate"){
        lines.push("// TODO: Verify map fields and nullability in an authorized Cloud sandbox.");
        generated_code=lines.join("\n")+"\n";
        notices.push("Recognized a static, read-only issue lookup. This candidate returns a Map, not a DC Issue object.");
      }
    }
  }
  if(status==="manual-review"){
    generated_code=[
      "// MANUAL CONVERSION REQUIRED — no runnable Cloud implementation generated.",
      "// Inventory input/output behavior, side effects, script context and dependencies.",
      "// Rewrite using supported Cloud APIs or HAPI and validate in a sandbox."
    ].join("\n")+"\n";
    notices.push("Unrecognized or multi-operation input. Only safe, isolated read-only patterns are converted; edits are never silently translated.");
  }
  return {converter_version:CONVERTER_VERSION,context,status,recipe,
    confidence,generated_code,notices,review_tasks:tasks,references,
    disclaimer:"Unverified migration candidate. Not guaranteed to work in Jira Cloud. Review and test before use."};
}
