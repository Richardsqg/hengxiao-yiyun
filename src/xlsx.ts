// Inline strings keep visitor text from becoming spreadsheet formulas.
const encoder = new TextEncoder();
function xml(v: unknown) { return String(v ?? '').replace(/[\x00-\x08\x0b\x0c\x0e-\x1f]/g,'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
function crc32(bytes: Uint8Array) { let crc = 0xffffffff; for(const b of bytes){ crc ^= b; for(let i=0;i<8;i++) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1)); } return (crc ^ 0xffffffff) >>> 0; }
function word(n:number, size:number) {const a=new Uint8Array(size);const d=new DataView(a.buffer);if(size===2)d.setUint16(0,n,true);else d.setUint32(0,n,true);return a;}
function concat(arr: Uint8Array[]) { const a = new Uint8Array(arr.reduce((n,b)=>n+b.length,0));let p=0;for(const b of arr){a.set(b,p);p+=b.length;}return a; }
function zip(files: Record<string,string>) {
 const local:Uint8Array[]=[],central:Uint8Array[]=[];let offset=0;
 for(const [name, value] of Object.entries(files)){
 const n=encoder.encode(name),b=encoder.encode(value),crc=crc32(b);
 const h=concat([word(0x04034b50,4),word(20,2),word(0,2),word(0,2),word(0,2),word(0,2),word(crc,4),word(b.length,4),word(b.length,4),word(n.length,2),word(0,2),n,b]);
 central.push(concat([word(0x02014b50,4),word(20,2),word(20,2),word(0,2),word(0,2),word(0,2),word(0,2),word(crc,4),word(b.length,4),word(b.length,4),word(n.length,2),word(0,2),word(0,2),word(0,2),word(0,2),word(0,4),word(offset,4),n]));local.push(h);offset+=h.length;
 }const c=concat(central);return concat([...local,c,word(0x06054b50,4),word(0,2),word(0,2),word(central.length,2),word(central.length,2),word(c.length,4),word(offset,4),word(0,2)]);
}
function column(i:number){let s='';for(i++;i>0;i=Math.floor((i-1)/26))s=String.fromCharCode(65+(i-1)%26)+s;return s;}
function sheet(rows:unknown[][]) { return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews><cols><col min="1" max="12" width="23" customWidth="1"/></cols><sheetData>'+rows.map((row,i)=>'<row r="'+(i+1)+'">'+row.map((v,j)=>typeof v==='number'?'<c r="'+column(j)+(i+1)+'" t="n"><v>'+v+'</v></c>':'<c r="'+column(j)+(i+1)+'" t="inlineStr"><is><t xml:space="preserve">'+xml(v)+'</t></is></c>').join('')+'</row>').join('')+'</sheetData></worksheet>'; }
export function createWorkbook(sheets:{name:string,rows:unknown[][]}[]) {
 const files:Record<string,string>={
 '[Content_Types].xml':'<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>'+sheets.map((s,i)=>'<Override PartName="/xl/worksheets/sheet'+(i+1)+'.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>').join('')+'</Types>',
 '_rels/.rels':'<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>',
 'xl/workbook.xml':'<?xml version="1.0" encoding="UTF-8"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>'+sheets.map((s,i)=>'<sheet name="'+xml(s.name)+'" sheetId="'+(i+1)+'" r:id="rId'+(i+1)+'"/>').join('')+'</sheets></workbook>',
 'xl/_rels/workbook.xml.rels':'<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'+sheets.map((s,i)=>'<Relationship Id="rId'+(i+1)+'" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet'+(i+1)+'.xml"/>').join('')+'</Relationships>'};
 sheets.forEach((s,i)=>files['xl/worksheets/sheet'+(i+1)+'.xml']=sheet(s.rows));return zip(files);
}
