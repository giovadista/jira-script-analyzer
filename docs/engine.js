// Jira Script Analyzer — browser-only heuristic engine (no network, no eval).
// This is NOT a complete Groovy parser, security scanner or API compatibility checker.
export const VERSION="0.4.0";
export const RULES=[
{id:"JSA001",severity:"HIGH",label:"Possible hard-coded credential",category:"Security",help:"A string literal is assigned to a credential-like variable. Confirm that it is not a secret. Use a managed secret source or secure application configuration; never commit live tokens.",pattern:/\b(?:password|api[_-]?token|secret|accessToken|clientSecret|privateKey)\s*=\s*(["'])(?:\\.|(?!\1)[^\r\n\\])+\1/gi,raw:true},
{id:"JSA002",severity:"MEDIUM",label:"Blocking Thread.sleep",category:"Performance",help:"Sleeping a Jira worker or listener thread can reduce throughput. Prefer asynchronous orchestration or an appropriate scheduled job.",pattern:/\bThread\s*\.\s*sleep\s*\(/gi},
{id:"JSA003",severity:"LOW",label:"Prefer structured logging to println",category:"Observability",help:"Use the logger available in your ScriptRunner execution context and avoid logging confidential values.",pattern:/\bprintln\s*\(/gi},
{id:"JSA004",severity:"MEDIUM",label:"Review unbounded getIssues()",category:"Performance",help:"Review result cardinality, pagination and permission context. A no-argument call is not automatically unsafe.",pattern:/\bgetIssues\s*\(\s*\)/gi},
{id:"JSA005",severity:"MEDIUM",label:"Review direct database operations",category:"Maintainability",help:"Review SQL access, transaction isolation and supported Jira APIs. Not every executeQuery call is a direct Jira database query.",pattern:/\b(?:executeQuery|executeUpdate)\s*\(/gi},
{id:"JSA006",severity:"LOW",label:"Prefer application logger",category:"Observability",help:"System.out and stack traces may bypass structured Jira logging. Use proper logging and controlled error handling.",pattern:/\b(?:System\s*\.\s*out\s*\.\s*print(?:ln)?|printStackTrace)\s*\(/gi},
{id:"JSA007",severity:"MEDIUM",label:"Review network calls and timeouts",category:"Reliability",help:"Check network timeouts, TLS, failure handling and credential management. Some usages may be safe.",pattern:/\b(?:URL|HttpURLConnection)\s*\(/gi},
{id:"JSA008",severity:"MEDIUM",label:"Broad exception catch",category:"Reliability",help:"Catch the narrowest exception appropriate, log context safely and handle retries or failure explicitly.",pattern:/\bcatch\s*\(\s*(?:Exception|Throwable)\s+\w+\s*\)/gi},
{id:"JSA009",severity:"MEDIUM",label:"Process execution",category:"Security",help:"Review command execution, untrusted arguments and the host execution policy. Prefer a constrained integration API.",pattern:/\b(?:Runtime\s*\.\s*getRuntime\s*\(\s*\)\s*\.\s*exec|ProcessBuilder)\s*\(/gi},
{id:"JSA010",severity:"LOW",label:"Potential debug output",category:"Privacy",help:"Review whether debug output contains personal information, credentials or large payloads.",pattern:/\b(?:log|logger)\s*\.\s*debug\s*\(/gi}
];
export const SAMPLE = '// Synthetic input only\n' +
  'def apiToken = "demo-not-a-real-token"\n' +
  'println("Starting analysis")\n' +
  'Thread.sleep(500)\n' +
  'def issues = getIssues()\n';

// Offset-preserving lexical mask for ordinary strings and comments, including nested block
// comments. Groovy slashy/dollar-slashy literals and arbitrary interpolation are not supported.
export function maskNonCode(source){
  const out=source.split("");
  const n=source.length;
  const blank=(from,to)=>{for(let k=from;k<to;k++)if(source[k]!=="\n"&&source[k]!=="\r")out[k]=" ";};
  let i=0;
  while(i<n){
    if(source.startsWith("//",i)){
      let end=source.indexOf("\n",i);if(end<0)end=n;
      blank(i,end);i=end;continue;
    }
    if(source.startsWith("/*",i)){
      const start=i;let depth=1;i+=2;
      while(i<n&&depth){
        if(source.startsWith("/*",i)){depth++;i+=2;}
        else if(source.startsWith("*/",i)){depth--;i+=2;}
        else i++;
      }
      blank(start,i);continue;
    }
    if(source[i]==="'"||source[i]==='"'){
      const quote=source[i],delimiter=source.startsWith(quote.repeat(3),i)?quote.repeat(3):quote;
      const start=i;i+=delimiter.length;
      while(i<n){
        if(source[i]==="\\"){i=Math.min(n,i+2);continue;}
        if(source.startsWith(delimiter,i)){i+=delimiter.length;break;}
        i++;
      }
      blank(start,i);continue;
    }
    i++;
  }
  return out.join("");
}
function location(source,offset){
  const prior=source.slice(0,offset),last=prior.lastIndexOf("\n");
  return {line:prior.split("\n").length,column:offset-last};
}
function suppressed(source,ruleId,line){
  // Inline suppression of the exact rule: // jsa-ignore JSA003
  // Directives work on their own line (next line) or on the finding's line.
  const lines=source.split(/\r?\n/);
  const directives=[lines[line-1]||"",lines[line-2]||""];
  return directives.some(text=>new RegExp("//\\s*jsa-ignore\\s+"+ruleId+"(?:\\b|$)","i").test(text));
}
export function analyze(source,filename="script.groovy",disabled=[]){
  const masked=maskNonCode(source);
  const ignored=new Set(disabled);
  const results=[];
  for(const rule of RULES){
    if(ignored.has(rule.id))continue;
    // matchAll clones regex state, allowing deterministic repeated scans.
    const input=rule.raw?source:masked;
    for(const match of input.matchAll(rule.pattern)){
      const offset=match.index;
      // For credential rules confirm the variable identifier begins in executable code.
      if(rule.raw&&masked[offset]===" ")continue;
      const loc=location(source,offset);
      if(suppressed(source,rule.id,loc.line))continue;
      results.push({file:filename,...loc,rule:rule.id,severity:rule.severity,
                    category:rule.category,message:rule.label,help:rule.help});
    }
  }
  const order={HIGH:0,MEDIUM:1,LOW:2};
  results.sort((a,b)=>a.file.localeCompare(b.file)||a.line-b.line||a.column-b.column||order[a.severity]-order[b.severity]||a.rule.localeCompare(b.rule));
  return results;
}
export function reportOf(files,disabled=[]){
  if(!Array.isArray(files))throw new TypeError("files must be an array");
  const findings=files.flatMap(f=>analyze(f.content,f.name,disabled));
  return {schema_version:2,engine:"browser",engine_version:VERSION,files_scanned:files.length,
    counts:Object.fromEntries(["HIGH","MEDIUM","LOW"].map(level=>[level,findings.filter(f=>f.severity===level).length])),
    findings};
}
export function toSarif(report){
  const level={HIGH:"error",MEDIUM:"warning",LOW:"note"};
  return {version:"2.1.0",$schema:"https://json.schemastore.org/sarif-2.1.0.json",runs:[{
    tool:{driver:{name:"Jira Script Analyzer",version:VERSION,informationUri:"https://github.com/giovadista/jira-script-analyzer",
      rules:RULES.map(r=>({id:r.id,name:r.label,shortDescription:{text:r.label},
        fullDescription:{text:r.help},properties:{category:r.category,severity:r.severity}}))}},
    results:report.findings.map(f=>({ruleId:f.rule,level:level[f.severity],
      message:{text:f.message},locations:[{physicalLocation:{
        artifactLocation:{uri:f.file},region:{startLine:f.line,startColumn:f.column}
      }}]}))
  }]};
}
export function toCsv(report){
  const esc=v=>'"'+String(v??"").replaceAll('"','""')+'"';
  const fields=["file","line","column","rule","severity","category","message","help"];
  return [fields.map(esc).join(","),...report.findings.map(f=>fields.map(k=>esc(f[k])).join(","))].join("\r\n")+"\r\n";
}
