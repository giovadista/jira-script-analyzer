import test from "node:test";
import assert from "node:assert/strict";
import {analyze,maskNonCode,reportOf,toSarif,toCsv,toHtml,RULES,SAMPLE,VERSION} from "../docs/engine.js";

test("engine has version and ten documented rules",()=>{
 assert.equal(VERSION,"0.4.0"); assert.equal(RULES.length,10);
 for(const r of RULES){assert.match(r.id,/^JSA\d{3}$/);assert.ok(r.help.length>25);}
});
test("sample has four findings, expected severities and locations",()=>{
 const f=analyze(SAMPLE,"demo.groovy");
 assert.deepEqual(f.map(x=>x.rule),["JSA001","JSA003","JSA002","JSA004"]);
 assert.deepEqual(f.map(x=>x.line),[2,3,4,5]);
 assert.equal(f[0].severity,"HIGH");
 assert.equal(f[0].column,5);
});
test("comments and strings do not trigger code rules",()=>{
 const s='// println("ignored")\n/* Thread.sleep(1) */\ndef x = "println(3)"\n';
 assert.deepEqual(analyze(s,"a.groovy"),[]);
});
test("triple-quoted literals are skipped",()=>{
 assert.deepEqual(analyze("'''println(1)'''\nprintln(2)","a.groovy").map(x=>x.line),[2]);
});
test("nested block comments are skipped",()=>{
 assert.deepEqual(analyze("/* outer /* inner */ println(1) */\nprintln(2)","a.groovy").map(x=>x.line),[2]);
});
test("credential rule ignores comments and string literals",()=>{
 const s='// password = "fake"\ndef msg = \'password = "string"\'\npassword = "demo"';
 assert.deepEqual(analyze(s,"a.groovy").map(x=>x.line),[3]);
});
test("actual passwords never enter report content",()=>{
 const s='def clientSecret = "TOP_SECRET_123"';
 const rep=reportOf([{name:"sample.groovy",content:s}]);
 assert.equal(rep.findings[0].rule,"JSA001");
 assert.ok(!JSON.stringify(rep).includes("TOP_SECRET_123"));
});
test("rule suppression next line",()=>{
 const s='// jsa-ignore JSA003\nprintln("suppressed")\nprintln("visible")';
 assert.deepEqual(analyze(s,"a.groovy").map(x=>x.line),[3]);
});
test("rule suppression same line",()=>{
 const s='println("suppressed") // jsa-ignore JSA003\nprintln("visible")';
 assert.deepEqual(analyze(s,"a.groovy").map(x=>x.line),[2]);
});
test("disabled rule",()=>assert.equal(analyze("println(1)","a.groovy",["JSA003"]).length,0));
test("mask preserves offsets and lines",()=>{
 const s='println("ok")\n/* multiline\n comment */';
 assert.equal(maskNonCode(s).length,s.length);
 assert.equal(maskNonCode(s).split("\n").length,3);
});
test("new detection rules",()=>{
 const s='try {} catch (Exception e) {}\nnew ProcessBuilder("ls")\nlog.debug("hello")';
 assert.deepEqual(analyze(s,"a.groovy").map(x=>x.rule),["JSA008","JSA009","JSA010"]);
});
test("report counts and metadata",()=>{
 const r=reportOf([{name:"a.groovy",content:SAMPLE}]);
 assert.equal(r.schema_version,2);assert.equal(r.files_scanned,1);
 assert.deepEqual(r.counts,{HIGH:1,MEDIUM:2,LOW:1});
});
test("SARIF 2.1.0 contains tools, rules and valid positions",()=>{
 const sarif=toSarif(reportOf([{name:"sample.groovy",content:SAMPLE}]));
 assert.equal(sarif.version,"2.1.0");
 assert.equal(sarif.runs[0].tool.driver.rules.length,10);
 assert.equal(sarif.runs[0].results.length,4);
 assert.equal(sarif.runs[0].results[0].locations[0].physicalLocation.region.startLine,2);
});
test("CSV quotes filenames and does not leak code content",()=>{
 const r=reportOf([{name:'a,"b".groovy',content:SAMPLE}]);
 const csv=toCsv(r);
 assert.ok(csv.includes('"a,""b"".groovy"'));
 assert.ok(!csv.includes("demo-not-a-real-token"));
});
test("empty files return empty report",()=>{
 const r=reportOf([]);
 assert.equal(r.files_scanned,0);assert.deepEqual(r.findings,[]);
});

test("standalone HTML report escapes malicious filenames and never includes script text",()=>{
 const r=reportOf([{name:'<img src=x onerror=alert(1)>.groovy',content:'password = "secretvalue"'}]);
 const page=toHtml(r);
 assert.ok(page.includes("&lt;img src=x onerror=alert(1)&gt;"));
 assert.ok(!page.includes('<img src=x'));
 assert.ok(!page.includes("secretvalue"));
});
test("line index handles a large input without changing positions",()=>{
 const source="\n".repeat(2500)+"println('ok')";
 const f=analyze(source,"long.groovy");
 assert.equal(f.length,1);assert.equal(f[0].line,2501);assert.equal(f[0].column,1);
});
