import {RULES,SAMPLE,reportOf} from "./engine.js";
const el=id=>document.getElementById(id);
let report=null;
const selectedFiles=[];
for(const rule of RULES){
  const label=document.createElement("label");
  const cb=document.createElement("input");cb.type="checkbox";cb.checked=true;cb.value=rule.id;
  label.append(cb,document.createTextNode(rule.id+" · "+rule.label));el("rules").append(label);
}
el("sample").addEventListener("click",()=>{el("source").value=SAMPLE;el("files").value="";el("fileLabel").textContent="No files selected";selectedFiles.length=0;el("error").hidden=true;});
el("clear").addEventListener("click",()=>{el("source").value="";el("files").value="";selectedFiles.length=0;el("fileLabel").textContent="No files selected";report=null;el("severityFilter").value="ALL";render();el("error").hidden=true;});
el("files").addEventListener("change",e=>{selectedFiles.length=0;selectedFiles.push(...e.target.files);el("fileLabel").textContent=selectedFiles.length?selectedFiles.length+" file(s) selected":"No files selected";});
el("severityFilter").addEventListener("change",render);
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
    report=reportOf(files,disabled);
    el("severityFilter").value="ALL";render();
  }catch(error){el("error").textContent=error.message;el("error").hidden=false;}
});
el("download").addEventListener("click",()=>{
  if(!report)return;
  const blob=new Blob([JSON.stringify(report,null,2)+"\n"],{type:"application/json"});
  const url=URL.createObjectURL(blob),a=document.createElement("a");
  a.href=url;a.download="jira-script-analyzer-report.json";a.click();
  setTimeout(()=>URL.revokeObjectURL(url),1000);
});
function render(){
  for(const id of ["total","high","medium","low"])el(id).textContent=report?(id==="total"?report.findings.length:report.counts[id.toUpperCase()]):"—";
  el("download").disabled=!report;
  el("scanSummary").textContent=report?report.files_scanned+" script(s) analyzed entirely in your browser.":"Run an analysis to see results.";
  const tbody=el("findings");tbody.replaceChildren();
  const filtered=report?.findings.filter(f=>el("severityFilter").value==="ALL"||f.severity===el("severityFilter").value)||[];
  if(!filtered.length){const tr=tbody.insertRow(),td=tr.insertCell();td.colSpan=4;td.className="empty";td.textContent=report?"No findings for this filter.":"No analysis yet";return;}
  for(const finding of filtered){
    const row=tbody.insertRow();
    const severity=row.insertCell(),pill=document.createElement("span");
    pill.className="pill "+finding.severity;pill.textContent=finding.severity;severity.append(pill);
    for(const value of [finding.rule,finding.file+":"+finding.line+":"+finding.column,finding.message])row.insertCell().textContent=value;
  }
}
render();
