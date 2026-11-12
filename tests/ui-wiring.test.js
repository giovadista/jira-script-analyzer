import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const html=readFileSync(new URL("../docs/index.html",import.meta.url),"utf8");
const app=readFileSync(new URL("../docs/app.js",import.meta.url),"utf8");
const css=readFileSync(new URL("../docs/style.css",import.meta.url),"utf8");

test("every direct DOM ID reference from app.js exists in the HTML",()=>{
 const ids=[...app.matchAll(/\bel\("([A-Za-z][\w-]+)"\)/g)].map(m=>m[1]);
 const absent=[...new Set(ids)].filter(id=>!html.includes('id="'+id+'"'));
 assert.deepEqual(absent,[]);
});
test("all migration modes are in the HTML mode selector",()=>{
 for(const mode of ["scriptrunner-cloud","automation-cloud","dc-to-cloud","data-center",
                     "dc-converter","listener-migration"]){
   assert.ok(html.includes('value="'+mode+'"'),"missing "+mode);
 }
});
test("listener workbench controls and fallback descriptions are present",()=>{
 for(const id of ["listenerPanel","listenerBlueprint","listenerSummary","listenerSteps",
   "listenerDisposition","listenerTaskSearch","downloadListenerMarkdown",
   "downloadListenerBlueprint","downloadListenerJson"]){
   assert.ok(html.includes('id="'+id+'"'),id);
 }
 assert.match(app,/migrationBlueprint/);
 assert.match(app,/migrationMarkdown/);
 assert.match(css,/workbench-snippet/);
});
test("the web application preserves its explicit no-network Content Security Policy",()=>{
 assert.match(html,/connect-src 'none'/);
 assert.match(html,/object-src 'none'/);
 assert.match(html,/script-src 'self'/);
});
