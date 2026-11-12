/**
 * Groovy source tokenizer and structural statement segmenter.
 *
 * No execution, dynamic imports, or network calls.
 * This IS NOT a complete Groovy grammar/AST. Source ranges are exact for
 * recognized tokens; ambiguities are returned as diagnostics, never hidden.
 */
export const STRUCTURE_VERSION = "0.1.0";
const MAX_SOURCE = 1024*1024;
const MAX_TOKENS = 130000;
const idStart=c=>/[A-Za-z_$]/.test(c||"");
const idCont=c=>/[A-Za-z0-9_$]/.test(c||"");
function skipString(s,i,delimiter){
  const triple=delimiter.length===3;
  let j=i+delimiter.length,closed=false;
  while(j<s.length){
    if(s[j]==="\\"){j=Math.min(s.length,j+2);continue;}
    if(s.startsWith(delimiter,j)){j+=delimiter.length;closed=true;break;}
    if(!triple&&(s[j]==="\n"||s[j]==="\r"))break;
    j++;
  }
  return {end:j,closed};
}
export function tokenizeGroovy(source){
  if(typeof source!=="string")throw new TypeError("Groovy source must be text.");
  if(source.length>MAX_SOURCE)throw new Error("Source exceeds the 1 MB limit.");
  const tokens=[],diagnostics=[],mask=source.split("");
  let i=0,line=1,col=1,lastNonNewline=null;
  const advance=end=>{
    while(i<end){
      if(source[i]==="\n"){line++;col=1;}else col++;
      i++;
    }
  };
  const blank=(start,end)=>{
    for(let j=start;j<end;j++)if(source[j]!=="\n"&&source[j]!=="\r")mask[j]=" ";
  };
  const emit=(type,start,end,value)=>{
    if(tokens.length>=MAX_TOKENS)throw new Error("Too many Groovy tokens; split the script.");
    const token={type,start,end,line,column:col,value};tokens.push(token);
    if(type!=="newline")lastNonNewline=token;
    advance(end);
  };
  while(i<source.length){
    const c=source[i],start=i;
    if(c===" "||c==="\t"||c==="\r"||c==="\f"){advance(i+1);continue;}
    if(c==="\n"){emit("newline",start,i+1,"\n");continue;}
    if(source.startsWith("//",i)){
      let end=source.indexOf("\n",i);
      if(end<0)end=source.length;
      blank(start,end);advance(end);continue;
    }
    if(source.startsWith("/*",i)){
      let depth=1,j=i+2;
      while(j<source.length&&depth){
        if(source.startsWith("/*",j)){depth++;j+=2;}
        else if(source.startsWith("*/",j)){depth--;j+=2;}
        else j++;
      }
      if(depth)diagnostics.push({line,column:col,reason:"Unterminated block comment"});
      blank(start,j);advance(j);continue;
    }
    if(source.startsWith("$/",i)){
      let j=i+2,closed=false;
      while(j<source.length){
        if(source.startsWith("/$",j)){j+=2;closed=true;break;}
        if(source.startsWith("$$",j)||source.startsWith("$/",j)){j+=2;continue;}
        j++;
      }
      if(!closed)diagnostics.push({line,column:col,reason:"Unterminated dollar-slashy literal"});
      blank(start,j);emit("literal",start,j,"<literal>");continue;
    }
    if(c==="'"||c==='"'){
      const delimiter=source.startsWith(c.repeat(3),i)?c.repeat(3):c;
      const {end,closed}=skipString(source,i,delimiter);
      if(!closed)diagnostics.push({line,column:col,reason:"Unterminated quoted string"});
      blank(start,end);emit("literal",start,end,"<literal>");continue;
    }
    // Slashy Groovy regex only in unambiguous expression positions, e.g. def r = /.../
    // Ambiguous divisions are left as symbols and never automatically rewritten.
    if(c==="/"&&tokens.length){
      const previous=lastNonNewline;
      const couldStart=previous&&(["=","(","[",":",",","return"].includes(previous.value));
      if(couldStart){
        let j=i+1,closed=false;
        while(j<source.length){
          if(source[j]==="\\"){j+=2;continue;}
          if(source[j]==="/"){j++;closed=true;break;}
          if(source[j]==="\n")break;
          j++;
        }
        if(closed){blank(start,j);emit("literal",start,j,"<literal>");continue;}
      }
    }
    if(idStart(c)){
      let j=i+1;
      while(j<source.length&&idCont(source[j]))j++;
      emit("identifier",start,j,source.slice(start,j));continue;
    }
    if(/[0-9]/.test(c)){
      let j=i+1;
      while(j<source.length&&/[A-Za-z0-9_.]/.test(source[j]))j++;
      emit("number",start,j,"<number>");continue;
    }
    const composite=["?.","*.","->","==","!=",">=","<=","&&","||","?:","..","::","++","--","+=","-=","<<",">>"];
    const symbol=composite.find(v=>source.startsWith(v,i))||c;
    emit("symbol",start,i+symbol.length,symbol);
  }
  return {tokens,mask:mask.join(""),diagnostics,lines:source.split(/\r?\n/).length};
}
const NEXT_CONTINUATION=new Set([".","?.","*.","(", "[","?:","&&","||","+","-","*","/"]);
const PREV_CONTINUATION=new Set([".","?.","*.","(", "[","=",",",":","?","+","-","*","/","&&","||","->","?:"]);
export function segmentGroovy(source){
  const lex=tokenizeGroovy(source);
  const segments=[],diagnostics=[...lex.diagnostics];
  let startToken=null,lastToken=null,part=[],braceDepth=0,paren=0,square=0;
  const meaningful=lex.tokens.filter(t=>t.type!=="newline");
  const emit=(kind="statement")=>{
    if(!part.length)return;
    const first=part[0],last=part[part.length-1];
    segments.push({id:"S"+String(segments.length+1).padStart(4,"0"),
      start:first.start,end:last.end,lineStart:first.line,
      lineEnd:last.line,depth:braceDepth,kind});
    part=[];startToken=null;
  };
  let tokenCount=0;
  for(let index=0;index<lex.tokens.length;index++){
    const t=lex.tokens[index],v=t.value;
    if(t.type==="newline"){
      if(!part.length)continue;
      const previous=part[part.length-1];
      let nextIndex=index+1;
      while(nextIndex<lex.tokens.length&&lex.tokens[nextIndex].type==="newline")nextIndex++;
      const next=lex.tokens[nextIndex];
      if(paren===0&&square===0&&!PREV_CONTINUATION.has(previous.value)&&
         (!next||!NEXT_CONTINUATION.has(next.value)))emit();
      continue;
    }
    if(v==="(")paren++;
    if(v===")")paren=Math.max(0,paren-1);
    if(v==="[")square++;
    if(v==="]")square=Math.max(0,square-1);
    if(v==="{"&&paren===0&&square===0){
      part.push(t);emit("block-open");braceDepth++;continue;
    }
    if(v==="}"&&paren===0&&square===0){
      emit();
      braceDepth--;
      if(braceDepth<0){diagnostics.push({line:t.line,column:t.column,reason:"Unexpected closing brace"});braceDepth=0;}
      continue;
    }
    if(v===";"&&paren===0&&square===0){emit();continue;}
    part.push(t);tokenCount++;
    if(tokenCount>MAX_TOKENS)throw new Error("Too many Groovy tokens");
  }
  emit();
  if(braceDepth)diagnostics.push({line:lex.lines,column:1,reason:"Unbalanced braces"});
  if(paren)diagnostics.push({line:lex.lines,column:1,reason:"Unbalanced parentheses"});
  if(square)diagnostics.push({line:lex.lines,column:1,reason:"Unbalanced brackets"});
  return {segments,masked:lex.mask,tokens:meaningful,diagnostics,lineCount:lex.lines,
    sourceLength:source.length};
}
