import test from "node:test";
import assert from "node:assert/strict";
import {analyzeCloudScript,analyzeCloudFiles,analyzeAutomationJson,parseAutomationExport,assessMigration,CLOUD_RULES} from "../docs/cloud.js";
import {toCsv,toSarif,toHtml} from "../docs/engine.js";

test("cloud Groovy detects Data Center Java dependencies",()=>{
 const r=analyzeCloudFiles([{name:"listener.groovy",content:"import com.atlassian.jira.component.ComponentAccessor\n"}],"groovy");
 assert.equal(r.mode,"scriptrunner-cloud");assert.equal(r.findings[0].rule,"CLD001");
 assert.equal(r.findings[0].line,1);
});
test("Cloud HAPI script can be clean under current heuristic checks",()=>{
 const f=analyzeCloudScript("Issues.getByKey('TEST-1')","hapi.groovy","groovy");
 assert.deepEqual(f,[]);
});
test("source literal in comment should not trigger Cloud Java API rule",()=>{
 const f=analyzeCloudScript('// ComponentAccessor\nlog.info("ComponentAccessor")',"safe.groovy","groovy");
 assert.deepEqual(f,[]);
});
test("Cloud JS script mode accepts REST review",()=>{
 const f=analyzeCloudScript('get("/rest/api/3/issue/TEST-1")',"behavior.js","javascript");
 assert.equal(f[0].rule,"CLD006");
});
test("invalid language fails",()=>assert.throws(()=>analyzeCloudScript("x","a.js","java"),/Unsupported/));
test("automation export supports rules array and disabled action",()=>{
 const json=JSON.stringify({rules:[{name:"demo",state:"DISABLED",components:[
  {type:"SEND_WEB_REQUEST",configuration:{field:"customfield_10001",owner:"sample"}}]}]});
 const r=analyzeAutomationJson(json);
 assert.equal(r.rules_scanned,1);
 assert.deepEqual(new Set(r.findings.map(x=>x.rule)),new Set(["AUT001","AUT002","AUT003","AUT004"]));
 assert.equal(r.findings[0].file,"automation.json");
});
test("automation findings do not leak configuration content",()=>{
 const doc=JSON.stringify({rules:[{name:"demo",enabled:false,components:[{type:"SEND_WEB_REQUEST",secret:"hidden-token-value"}]}]});
 const result=analyzeAutomationJson(doc);
 assert.ok(!JSON.stringify(result).includes("hidden-token-value"));
});
test("automation invalid and unrelated JSON refused",()=>{
 assert.throws(()=>parseAutomationExport("{"),/Invalid JSON/);
 assert.throws(()=>parseAutomationExport('{"other":1}'),/No recognizable/);
});
test("automation empty export refused",()=>{
 assert.throws(()=>parseAutomationExport('{"rules":[]}'),/No recognizable/);
});
test("automation large payload rejected",()=>{
 assert.throws(()=>parseAutomationExport(" ".repeat(5*1024*1024+1)),/5 MB/);
});
test("migration inventory detects Java API, filesystem and identity",()=>{
 const r=assessMigration([{name:"listener.groovy",
 content:"import com.atlassian.jira.component.ComponentAccessor\nimport java.io.File\ngetUserByName('test')\n"}]);
 assert.equal(r.mode,"dc-to-cloud");
 assert.ok(r.findings.some(x=>x.rule==="MIG001"));
 assert.ok(r.findings.some(x=>x.rule==="MIG002"));
 assert.ok(r.findings.some(x=>x.rule==="MIG003"));
 assert.ok(r.effort_indicators.HIGH>0);
});
test("migration cannot claim automatic cost estimate",()=>{
 const r=assessMigration([{name:"clean.groovy",content:"log.info('ok')"}]);
 assert.equal(r.findings.length,0);
 assert.match(r.assessment,/not a project duration/i);
});
test("Cloud findings export through existing output formats",()=>{
 const r=analyzeCloudFiles([{name:"x.groovy",content:"ComponentAccessor"}],"groovy");
 assert.ok(toCsv(r).includes("CLD001"));
 assert.ok(toHtml(r).includes("CLD001"));
 assert.equal(toSarif(r).version,"2.1.0");
});
test("Cloud rule IDs are unique and well formed",()=>{
 assert.equal(new Set(CLOUD_RULES.map(r=>r.id)).size,CLOUD_RULES.length);
 assert.ok(CLOUD_RULES.every(r=>/^(CLD|AUT)\d{3}$/.test(r.id)));
});
