// Independent, browser-native heuristic scanner. No external dependencies.
// Known limitation: slashy/dollar-slashy Groovy strings and GStrings are not fully parsed.
export const RULES = [
  {id:"JSA001", severity:"HIGH", label:"Possible hard-coded credential", pattern:/\b(?:password|api[_-]?token|secret|accessToken)\s*=\s*(["'])(?:(?!\1)[^\r\n])+\1/gi, raw:true},
  {id:"JSA002", severity:"MEDIUM", label:"Blocking Thread.sleep", pattern:/\bThread\s*\.\s*sleep\s*\(/gi},
  {id:"JSA003", severity:"LOW", label:"Prefer structured logging to println", pattern:/\bprintln\s*\(/gi},
  {id:"JSA004", severity:"MEDIUM", label:"Review unbounded getIssues()", pattern:/\bgetIssues\s*\(\s*\)/gi},
  {id:"JSA005", severity:"MEDIUM", label:"Review direct database operations", pattern:/\b(?:executeQuery|executeUpdate)\s*\(/gi},
  {id:"JSA006", severity:"LOW", label:"Prefer application logger", pattern:/\b(?:System\.out\.print(?:ln)?|printStackTrace)\s*\(/gi},
  {id:"JSA007", severity:"MEDIUM", label:"Review network calls and timeouts", pattern:/\b(?:URL|HttpURLConnection)\s*\(/gi},
];
export const SAMPLE = '// Synthetic input only\n' +
  'def apiToken = "demo-not-a-real-token"\n' +
  'println("Starting analysis")\n' +
  'Thread.sleep(500)\n' +
  'def issues = getIssues()\n';

export function maskNonCode(source) {
  const chars = source.split("");
  const n=source.length;
  let i=0;
  while(i<n){
    let end=i;
    if(source.startsWith("//",i)){
      end=source.indexOf("\n",i); if(end<0)end=n;
    } else if(source.startsWith("/*",i)){
      end=source.indexOf("*/",i+2); end=end<0?n:end+2;
    } else if(source[i]==="'"||source[i]==='"'){
      const quote=source[i], delimiter=source.startsWith(quote.repeat(3),i)?quote.repeat(3):quote;
      end=i+delimiter.length;
      while(end<n){
        if(source[end]==="\\"){end=Math.min(n,end+2);continue;}
        if(source.startsWith(delimiter,end)){end+=delimiter.length;break;}
        end++;
      }
    } else {i++;continue;}
    for(let p=i;p<Math.min(end,n);p++)if(chars[p]!=="\n"&&chars[p]!=="\r")chars[p]=" ";
    i=Math.min(end,n);
  }
  return chars.join("");
}

export function analyze(source, filename="script.groovy", disabled=[]) {
  const masked=maskNonCode(source);
  const ignored=new Set(disabled);
  const findings=[];
  for(const rule of RULES){
    if(ignored.has(rule.id))continue;
    rule.pattern.lastIndex=0;
    const input=rule.raw?source:masked;
    for(const match of input.matchAll(rule.pattern)){
      const offset=match.index;
      // For raw credential matching, verify the assignment starts in code, not in a comment/string.
      if(rule.raw && masked[offset]===" ")continue;
      const prefix=source.slice(0,offset);
      const line=prefix.split("\n").length;
      const column=offset-prefix.lastIndexOf("\n");
      findings.push({file:filename,line,column,rule:rule.id,severity:rule.severity,message:rule.label});
    }
  }
  findings.sort((a,b)=>a.file.localeCompare(b.file)||a.line-b.line||a.column-b.column||a.rule.localeCompare(b.rule));
  return findings;
}
export function reportOf(files,disabled=[]) {
  const findings=files.flatMap(f=>analyze(f.content,f.name,disabled));
  return {schema_version:1,engine:"browser",files_scanned:files.length,
    counts:Object.fromEntries(["HIGH","MEDIUM","LOW"].map(level=>[level,findings.filter(f=>f.severity===level).length])),
    findings};
}
