import {RULES,SAMPLE,reportOf,toSarif,toCsv,toHtml} from "./engine.js";
import {analyzeCloudFiles,analyzeAutomationJson,assessMigration} from "./cloud.js";
import {convertDcScript} from "./converter.js";
import {analyzeListenerMigration,migrationBlueprint,migrationMarkdown} from "./listener-workbench.js";
const el=id=>document.getElementById(id);
let report=null;
let listenerReport=null;
const outputButtons=["download","downloadHtml","downloadCsv","downloadSarif"];
const selectedFiles=[];
function resetListenerPanel(){
 listenerReport=null;
 el("listenerBlueprint").value="";el("listenerSummary").textContent="Select a listener and run the assessment.";
 for(const name of ["downloadListenerMarkdown","downloadListenerBlueprint","downloadListenerJson"])el(name).disabled=true;
 const tbody=el("listenerSteps");tbody.replaceChildren();const tr=tbody.insertRow(),td=tr.insertCell();td.colSpan=3;td.className="empty";td.textContent="Run the listener migration assessment";
}
for(const rule of RULES){
  const label=document.createElement("label");
  const cb=document.createElement("input");cb.type="checkbox";cb.checked=true;cb.value=rule.id;
  label.append(cb,document.createTextNode(rule.id+" · "+rule.label+(rule.target?" [Jira "+rule.target+"]":"")));el("rules").append(label);
}
const MODE_EXAMPLES={
 "scriptrunner-cloud":'// Synthetic ScriptRunner Cloud example\nimport com.atlassian.jira.component.ComponentAccessor\n// DC-only code above is not available in Cloud scripts\nget("/rest/api/3/issue/DEMO-1").asObject(Map)\n',
 "automation-cloud":JSON.stringify({rules:[{name:"Synthetic example",state:"DISABLED",components:[{type:"ACTION",value:"send-web-request",configuration:{field:"customfield_10001",owner:"sample-account"}}]}]},null,2),
 "dc-to-cloud":'// Synthetic DC listener to assess before Jira Cloud migration\nimport com.atlassian.jira.component.ComponentAccessor\nimport java.io.File\n// Review Jira API dependencies, filesystem access and username-based user lookups\ndef issueManager = ComponentAccessor.issueManager\n',
 "listener-migration":`// Synthetic listener sample (no company data)
import com.atlassian.jira.component.ComponentAccessor
def manager = ComponentAccessor.getIssueManager()
if (event.issue != null) {
  def issue = manager.getIssueByCurrentKey("DEMO-123")
  def summary = issue.getSummary()
  log.info("Synthetic migration sample")
  issue.setSummary("REVIEW: mutation requires Cloud REST mapping")
}
`,
 "dc-converter":'import com.atlassian.jira.component.ComponentAccessor\ndef issue = ComponentAccessor.getIssueManager().getIssueByCurrentKey("TEST-123")',
 "data-center":SAMPLE
};
const hints={
 "scriptrunner-cloud":"Cloud script source patterns, including REST authentication and legacy Data Center Java dependencies. Not a parser or runtime validator.",
 "automation-cloud":"Load a Jira Cloud Automation JSON export. Identifies review candidates; does not execute/import rules or expose field values.",
 "dc-to-cloud":"Assess Groovy scripts for Java API, host access, identity and ScriptRunner parity indicators. This is NOT an automatic effort estimate.",
 "listener-migration":"Analyze long Groovy Data Center listeners: line-mapped Cloud candidates, blockers, control-flow review and a non-executable migration blueprint.",
 "dc-converter":"Experimental conservative converter: generates Cloud candidates only for recognized, isolated Groovy patterns. Other inputs require manual migration.",
 "data-center":"Existing offline Jira Data Center Groovy scanner and version-specific rules."
};
function updateMode(){
 const mode=el("analysisMode").value;
 el("cloudLanguageRow").hidden=mode!=="scriptrunner-cloud";
 el("converterPanel").hidden=mode!=="dc-converter";
 el("listenerPanel").hidden=mode!=="listener-migration";
 resetListenerPanel();
 el("convertedCode").value="";el("conversionStatus").textContent="No conversion attempted.";
 el("conversionNotices").replaceChildren();
 el("copyConverted").disabled=true;el("downloadConverted").disabled=true;
 el("jiraVersionRow").hidden=mode!=="data-center";
 el("dcRules").hidden=mode!=="data-center";
 el("modeHint").textContent=hints[mode];
 el("sourceLabel").textContent=mode==="automation-cloud"?"Automation export JSON":"Script source";
 el("source").placeholder=mode==="automation-cloud"?"Paste an Automation JSON export...":"Paste script source...";
 el("files").accept=mode==="automation-cloud"?".json,application/json":mode==="scriptrunner-cloud"?".groovy,.js,.ts,text/plain":".groovy,text/plain";
 el("files").multiple=!["automation-cloud","dc-converter","listener-migration"].includes(mode);
 el("source").value="";
 el("files").value="";
 selectedFiles.length=0;
 el("fileLabel").textContent="No files selected";
 report=null;render();
}
el("analysisMode").addEventListener("change",updateMode);
el("sample").addEventListener("click",()=>{
 el("source").value=MODE_EXAMPLES[el("analysisMode").value];
 el("files").value="";selectedFiles.length=0;el("fileLabel").textContent="No files selected";el("error").hidden=true;
});
el("clear").addEventListener("click",()=>{
 el("source").value="";el("files").value="";selectedFiles.length=0;el("fileLabel").textContent="No files selected";
 report=null;resetListenerPanel();el("severityFilter").value="ALL";el("search").value="";render();el("error").hidden=true;
});
el("files").addEventListener("change",e=>{
 selectedFiles.length=0;selectedFiles.push(...e.target.files);
 el("fileLabel").textContent=selectedFiles.length?selectedFiles.length+" file(s) selected":"No files selected";
});
el("severityFilter").addEventListener("change",render);
el("search").addEventListener("input",render);
el("run").addEventListener("click",async()=>{
 el("error").hidden=true;
 try{
   const mode=el("analysisMode").value;
   const language=el("cloudLanguage").value;
   const files=[];
   if(selectedFiles.length){
     if(selectedFiles.length>(["automation-cloud","dc-converter","listener-migration"].includes(mode)?1:30))throw new Error("Too many files selected for this analysis mode.");
     for(const file of selectedFiles){
       const suffixes=mode==="automation-cloud"?[".json"]:
         mode==="scriptrunner-cloud"?[".groovy",".js",".ts"]:[".groovy"];
       if(!suffixes.some(s=>file.name.toLowerCase().endsWith(s)))
         throw new Error("Select supported "+suffixes.join(", ")+" files only.");
       if(file.size>(mode==="automation-cloud"?5:1)*1024*1024)throw new Error("File exceeds safe browser size limit.");
       files.push({name:file.name,content:await file.text()});
     }
   }else{
     const content=el("source").value;
     if(!content.trim())throw new Error("Paste source code / JSON or choose local files.");
     if(content.length>(mode==="automation-cloud"?5:1)*1024*1024)throw new Error("Input exceeds safe browser size limit.");
     files.push({name:mode==="automation-cloud"?"pasted-automation.json":mode==="scriptrunner-cloud"?"pasted-cloud."+({groovy:"groovy",javascript:"js",typescript:"ts"}[language]):"pasted-script.groovy",content});
   }
   if(mode==="listener-migration"){
     listenerReport=analyzeListenerMigration(files[0].content);
     renderListenerPanel(listenerReport);
     report={schema_version:2,engine:"browser",mode:"listener-migration",files_scanned:1,
       counts:{HIGH:listenerReport.severity.high,MEDIUM:listenerReport.severity.medium,LOW:listenerReport.severity.low},
       findings:listenerReport.steps.map(step=>({file:files[0].name,line:step.lineStart,column:1,rule:step.rule,
         severity:step.severity,category:step.category,message:step.title,help:step.advice,reference:step.doc}))};
   }
   else if(mode==="dc-converter"){
     const converted=convertDcScript(files[0].content,el("executionContext").value);
     el("convertedCode").value=converted.generated_code;
     el("conversionStatus").textContent=converted.status==="candidate"?"Read-only conversion candidate — unverified ("+converted.confidence+" confidence).":"Automatic conversion unavailable — manual review required.";
     const notice=el("conversionNotices");notice.replaceChildren();
     for(const message of converted.notices){const p=document.createElement("p");p.textContent=message;notice.append(p);}
     for(const task of converted.review_tasks||[]){const p=document.createElement("p");p.textContent="Review "+task.id.toUpperCase()+": "+task.message;notice.append(p);}
     for(const reference of converted.references){const link=document.createElement("a");link.href=reference.url;link.target="_blank";link.rel="noopener noreferrer";link.textContent=reference.label;notice.append(link,document.createTextNode(" · "));}
     el("copyConverted").disabled=false;el("downloadConverted").disabled=false;
     report=assessMigration(files);
   }
   else if(mode==="automation-cloud")report=analyzeAutomationJson(files[0].content,files[0].name);
   else if(mode==="dc-to-cloud")report=assessMigration(files);
   else if(mode==="scriptrunner-cloud")report=analyzeCloudFiles(files,language);
   else{
     const disabled=[...el("rules").querySelectorAll('input[type="checkbox"]:not(:checked)')].map(c=>c.value);
     report=reportOf(files,disabled,{jiraVersion:el("jiraVersion").value});
   }
   el("severityFilter").value="ALL";el("search").value="";render();
 }catch(error){el("error").textContent=error.message;el("error").hidden=false;}
});
function renderListenerPanel(data){
 const counts=data.counts;
 el("listenerSummary").textContent=data.source_lines+" lines; "+data.statements_analyzed+" statements; "+
   counts.candidate+" Cloud candidate(s), "+counts.manual+" manual tasks, "+counts.remove+" DC dependencies to remove, "+
   counts.structural+" control-flow nodes"+(data.lexical_diagnostics.length?"; "+data.lexical_diagnostics.length+" parse warning(s)":"")+".";
 el("listenerBlueprint").value=migrationBlueprint(data);
 for(const name of ["downloadListenerMarkdown","downloadListenerBlueprint","downloadListenerJson"])el(name).disabled=false;
 const tbody=el("listenerSteps");tbody.replaceChildren();
 for(const step of data.steps){
   const tr=tbody.insertRow(),line=tr.insertCell(),status=tr.insertCell(),detail=tr.insertCell();
   const jump=document.createElement("button");jump.className="workbench-jump";jump.textContent=String(step.lineStart)+(step.lineEnd>step.lineStart?"–"+step.lineEnd:"");
   jump.title="Jump to original code at line "+step.lineStart;
   jump.addEventListener("click",()=>{
     const source=el("source"),text=source.value;
     const start=text.split("\n").slice(0,step.lineStart-1).reduce((sum,l)=>sum+l.length+1,0);
     source.focus();source.setSelectionRange(start,Math.min(text.length,start+120));
   });
   line.append(jump);status.textContent=step.disposition;const strong=document.createElement("strong"),p=document.createElement("p");
   strong.textContent=step.title;p.className="recommendation";p.textContent=step.advice;detail.append(strong,p);
 }
}
el("downloadListenerMarkdown").addEventListener("click",()=>{
 if(listenerReport)downloadFile(migrationMarkdown(listenerReport),"listener-migration-plan.md","text/markdown;charset=utf-8");
});
el("downloadListenerBlueprint").addEventListener("click",()=>{
 if(listenerReport)downloadFile(migrationBlueprint(listenerReport),"listener-cloud-blueprint.groovy","text/plain;charset=utf-8");
});
el("downloadListenerJson").addEventListener("click",()=>{
 if(listenerReport)downloadFile(JSON.stringify(listenerReport,null,2),"listener-migration-map.json","application/json");
});
function downloadFile(text,name,type){
  const blob=new Blob([text],{type});
  const url=URL.createObjectURL(blob),a=document.createElement("a");
  a.href=url;a.download=name;a.click();
  setTimeout(()=>URL.revokeObjectURL(url),1000);
}
el("download").addEventListener("click",()=>{
  if(report)downloadFile(JSON.stringify(report,null,2)+"\n","jira-script-analyzer-report.json","application/json");
});
el("downloadHtml").addEventListener("click",()=>{
  if(report)downloadFile(toHtml(report),"jira-script-analyzer-report.html","text/html;charset=utf-8");
});
el("downloadCsv").addEventListener("click",()=>{
  if(report)downloadFile(toCsv(report),"jira-script-analyzer-report.csv","text/csv;charset=utf-8");
});
el("copyConverted").addEventListener("click",async()=>{
 if(el("convertedCode").value)try{await navigator.clipboard.writeText(el("convertedCode").value);}catch{
   el("convertedCode").select();document.execCommand("copy");
 }
});
el("downloadConverted").addEventListener("click",()=>{
 if(el("convertedCode").value)downloadFile(el("convertedCode").value,"cloud-conversion-candidate.groovy","text/plain;charset=utf-8");
});
el("downloadSarif").addEventListener("click",()=>{
  if(report)downloadFile(JSON.stringify(toSarif(report),null,2)+"\n","jira-script-analyzer.sarif","application/sarif+json");
});
function render(){
  for(const id of ["total","high","medium","low"])el(id).textContent=report?(id==="total"?report.findings.length:report.counts[id.toUpperCase()]):"—";
  for(const button of outputButtons)el(button).disabled=!report;
  el("scanSummary").textContent=report?report.files_scanned+" file(s) analyzed locally. Mode: "+(report.mode||"data-center")+(report.rules_scanned!==undefined?"; "+report.rules_scanned+" automation rules":"")+".":"Run an analysis to see results.";
  const tbody=el("findings");tbody.replaceChildren();
  const query=el("search").value.toLocaleLowerCase().trim();
  const filtered=report?.findings.filter(f=>(el("severityFilter").value==="ALL"||f.severity===el("severityFilter").value)&&
    (!query||[f.file,f.rule,f.severity,f.category,f.message,f.help].some(v=>String(v).toLocaleLowerCase().includes(query))))||[];
  if(!filtered.length){const tr=tbody.insertRow(),td=tr.insertCell();td.colSpan=4;td.className="empty";td.textContent=report?"No findings for this filter.":"No analysis yet";return;}
  for(const finding of filtered){
    const row=tbody.insertRow();
    const severity=row.insertCell(),pill=document.createElement("span");
    pill.className="pill "+finding.severity;pill.textContent=finding.severity;severity.append(pill);
    for(const value of [finding.rule,finding.file+":"+finding.line+":"+finding.column])row.insertCell().textContent=value;
    const messageCell=row.insertCell(),main=document.createElement("strong"),recommendation=document.createElement("p");
    main.textContent=finding.message;recommendation.className="recommendation";recommendation.textContent=finding.help;
    messageCell.append(main,recommendation);
    if(finding.effort){const effort=document.createElement("small");effort.textContent="Migration effort indicator: "+finding.effort;messageCell.append(effort);}
    if(finding.reference){const a=document.createElement("a");a.href=finding.reference;a.rel="noopener noreferrer";a.target="_blank";a.textContent=" · Documentation";messageCell.append(a);}
  }
}
render();

updateMode();
