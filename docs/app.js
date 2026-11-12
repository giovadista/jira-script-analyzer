import {RULES,SAMPLE,reportOf,toSarif,toCsv,toHtml} from "./engine.js";
const el=id=>document.getElementById(id);
let report=null;
const outputButtons=["download","downloadHtml","downloadCsv","downloadSarif"];
const selectedFiles=[];
for(const rule of RULES){
  const label=document.createElement("label");
  const cb=document.createElement("input");cb.type="checkbox";cb.checked=true;cb.value=rule.id;
  label.append(cb,document.createTextNode(rule.id+" · "+rule.label+(rule.target?" [Jira "+rule.target+"]":"")));el("rules").append(label);
}
el("sample").addEventListener("click",()=>{el("source").value=SAMPLE;el("files").value="";el("fileLabel").textContent="No files selected";selectedFiles.length=0;el("error").hidden=true;});
el("clear").addEventListener("click",()=>{el("source").value="";el("files").value="";selectedFiles.length=0;el("fileLabel").textContent="No files selected";report=null;el("severityFilter").value="ALL";el("search").value="";render();el("error").hidden=true;});
el("files").addEventListener("change",e=>{selectedFiles.length=0;selectedFiles.push(...e.target.files);el("fileLabel").textContent=selectedFiles.length?selectedFiles.length+" file(s) selected":"No files selected";});
el("severityFilter").addEventListener("change",render);
el("search").addEventListener("input",render);
el("run").addEventListener("click",async()=>{
  el("error").hidden=true;
  try {
    const files=[];
    if(selectedFiles.length){
      if(selectedFiles.length>30)throw new Error("Select at most 30 Groovy files.");
      for(const file of selectedFiles){
        if(!file.name.toLowerCase().endsWith(".groovy"))throw new Error("Only .groovy files are accepted.");
        if(file.size>1024*1024)throw new Error("Each script must be smaller than 1 MB.");
        files.push({name:file.name,content:await file.text()});
      }
    }else{
      const content=el("source").value;
      if(!content.trim())throw new Error("Paste Groovy code or choose local .groovy files.");
      if(content.length>1024*1024)throw new Error("Pasted script must be smaller than 1 MB.");
      files.push({name:"pasted-script.groovy",content});
    }
    const disabled=[...el("rules").querySelectorAll('input[type="checkbox"]:not(:checked)')].map(c=>c.value);
    report=reportOf(files,disabled,{jiraVersion:el("jiraVersion").value});
    el("severityFilter").value="ALL";el("search").value="";render();
  }catch(error){el("error").textContent=error.message;el("error").hidden=false;}
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
el("downloadSarif").addEventListener("click",()=>{
  if(report)downloadFile(JSON.stringify(toSarif(report),null,2)+"\n","jira-script-analyzer.sarif","application/sarif+json");
});
function render(){
  for(const id of ["total","high","medium","low"])el(id).textContent=report?(id==="total"?report.findings.length:report.counts[id.toUpperCase()]):"—";
  for(const button of outputButtons)el(button).disabled=!report;
  el("scanSummary").textContent=report?report.files_scanned+" script(s) analyzed locally. Target: "+report.target_jira+".":"Run an analysis to see results.";
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
  }
}
render();
