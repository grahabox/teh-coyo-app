// Browser smoke using Node's built-in WebSocket + Chrome DevTools Protocol.
// API responses are mocked before navigation; no real user/catalog data is mutated.
// Requires running Vite at WEB_TEST_URL (default localhost:5173) and Chromium.
import { spawn } from 'node:child_process';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createServer } from 'node:net';
import assert from 'node:assert/strict';

const browserPath =
  process.env.BROWSER_PATH ??
  [
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    '/usr/bin/chromium',
    '/usr/bin/google-chrome',
  ].find((path) => existsSync(path));
if (!browserPath) throw new Error('Set BROWSER_PATH to a Chromium/Edge executable.');
const webUrl = process.env.WEB_TEST_URL ?? 'http://localhost:5173';
const screenshots = process.env.UI_SCREENSHOT_DIR;
const profile = await mkdtemp(join(tmpdir(), 'coyo-ui-test-'));
const port = await new Promise((resolve) => {
  const server = createServer();
  server.listen(0, '127.0.0.1', () => {
    const value = server.address().port;
    server.close(() => resolve(value));
  });
});
const browser = spawn(
  browserPath,
  [
    '--headless',
    '--disable-gpu',
    '--no-first-run',
    '--no-default-browser-check',
    `--remote-debugging-port=${port}`,
    `--user-data-dir=${profile}`,
    'about:blank',
  ],
  { stdio: 'ignore' },
);
let ws;
const pending = new Map();
const pageErrors = [];
let sequence = 0;
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
async function send(method, params = {}) {
  const id = ++sequence;
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      pending.delete(id);
      reject(new Error(`CDP timeout: ${method}`));
    }, 15000);
    pending.set(id, { resolve, reject, timer });
    ws.send(JSON.stringify({ id, method, params }));
  });
}
async function evaluate(expression) {
  const response = await send('Runtime.evaluate', {
    expression,
    returnByValue: true,
    awaitPromise: true,
  });
  if (response.exceptionDetails)
    throw new Error(
      response.exceptionDetails.text + ' ' + JSON.stringify(response.exceptionDetails.exception),
    );
  return response.result.value;
}
async function waitFor(expression, message) {
  for (let i = 0; i < 100; i++) {
    if (await evaluate(`Boolean(${expression})`)) return;
    await delay(100);
  }
  throw new Error(`Browser assertion timeout: ${message}`);
}
const click = async (text) => {
  await waitFor(
    `([...document.querySelectorAll('button')].some(button => (button.textContent.trim() === ${JSON.stringify(text)} || button.getAttribute('aria-label') === ${JSON.stringify(text)} || (button.getAttribute('role') === 'tab' && button.textContent.trim().startsWith(${JSON.stringify(text)}))) && button.getClientRects().length && !button.disabled))`,
    `button ready: ${text}`,
  );
  return evaluate(`window.testUI.click(${JSON.stringify(text)})`);
};
const fill = (label, value) =>
  evaluate(`window.testUI.fill(${JSON.stringify(label)},${JSON.stringify(value)})`);

async function screenshot(name) {
  if (!screenshots) return;
  await mkdir(screenshots, { recursive: true });
  const image = await send('Page.captureScreenshot', {
    format: 'png',
    captureBeyondViewport: false,
  });
  await writeFile(join(screenshots, `${name}.png`), Buffer.from(image.data, 'base64'));
}

const preload = String.raw`
  const units = [
    { id: '7c6460b6-80ba-43a3-9487-107c67333101', code: 'g', name: 'Gram', dimension: 'MASS', factor: '1' },
    { id: '7c6460b6-80ba-43a3-9487-107c67333102', code: 'ml', name: 'Mililiter', dimension: 'VOLUME', factor: '1' },
    { id: '7c6460b6-80ba-43a3-9487-107c67333103', code: 'pcs', name: 'Buah', dimension: 'COUNT', factor: '1' },
    { id: '7c6460b6-80ba-43a3-9487-107c67333104', code: 'L', name: 'Liter', dimension: 'VOLUME', factor: '1000' },
    { id: '7c6460b6-80ba-43a3-9487-107c67333105', code: 'kg', name: 'Kilogram', dimension: 'MASS', factor: '1000' },
  ];
  const group = { id: '7c6460b6-80ba-43a3-9487-107c67333201', name: 'Es Teh' };
  const owner = { id: '7c6460b6-80ba-43a3-9487-107c67333501', code: 'COYO', name: 'Teh Coyo' };
  const partnerOwner = { id: '7c6460b6-80ba-43a3-9487-107c67333502', code: 'MITRA', name: 'Usaha Mitra' };
  const owners = [owner, partnerOwner];
  const center = { id: '7c6460b6-80ba-43a3-9487-107c67333601', code: 'PUSAT', name: 'Pusat Utama', type: 'CENTER', ownership: 'OWNED', entityId: owner.id, entity: owner, parentId: null, parent: null, _count: { children: 60 } };
  const dcs = Array.from({length: 60}, (_,index) => ({ id: crypto.randomUUID(), code: 'DC-' + String(index+1).padStart(3,'0'), name: 'DC ' + String(index+1).padStart(3,'0'), type: 'DC', ownership: 'OWNED', entityId: owner.id, entity: owner, parentId: center.id, parent: center, _count: {children: index === 0 ? 63 : 0} }));
  const stands = Array.from({length: 63}, (_,index) => { const partner = index%2 === 1; return { id: crypto.randomUUID(), code: 'STAND-' + String(index+1).padStart(3,'0'), name: 'Stand ' + String(index+1).padStart(3,'0'), type: 'STAND', ownership: partner ? 'PARTNER' : 'OWNED', entityId: partner ? partnerOwner.id : owner.id, entity: partner ? partnerOwner : owner, parentId: dcs[0].id, parent: dcs[0], _count: {children: 0} }; });
  const locations = [center, ...dcs, ...stands];
  const catalog = { units, items: [{ id: '7c6460b6-80ba-43a3-9487-107c67333301', name: 'Bahan Teh', code: 'BAHAN-TEH', baseUnitId: units[0].id, baseUnit: units[0] }], menus: [group], variants: [{ id: '7c6460b6-80ba-43a3-9487-107c67333401', code: 'ORIGINAL', name: 'Original', menuId: group.id, menu: group }] };
  const baseTea={id:'7c6460b6-80ba-43a3-9487-107c67333302',name:'Teh Dasar',code:'TEH-DASAR',baseUnitId:units[1].id,baseUnit:units[1]};
  const cup={id:'7c6460b6-80ba-43a3-9487-107c67333303',name:'Cup Kosong',code:'CUP-KOSONG',baseUnitId:units[2].id,baseUnit:units[2]};
  catalog.items.push(baseTea,cup);
  const stockDocs=[];
  const stockBalances=new Map();
  const stockMovements=[];
  const suppliers=[];
  const invoices=[];
  const presentInvoice=p=>({...p,outstandingAmount:(BigInt(p.totalAmount)-BigInt(p.paidAmount)).toString(),receiptStatus:p.lines.every(l=>l.quantity===l.receivedQuantity)?'COMPLETE':p.lines.some(l=>l.receivedQuantity!=='0')?'PARTIAL':'NONE',paymentStatus:p.paidAmount==='0'?'UNPAID':p.paidAmount===p.totalAmount?'PAID':'PARTIAL'});
  const recipes=Array.from({length:31},(_,index)=>({id:crypto.randomUUID(),name:'Teh Batch '+String(index+1).padStart(3,'0'),code:'fixture-recipe',kind:'PRODUCTION',version:1,status:'DRAFT',scopeLocationId:null,scopeLocation:null,outputItem:baseTea,outputQuantity:'10',outputUnitCode:'L',components:[{stockItemId:catalog.items[0].id,stockItem:catalog.items[0],quantity:'100',unitCode:'g'}],_count:{components:1}}));
  const role=sessionStorage.getItem('smokeRole')??'CENTRAL_ADMIN';
  const user = { id: 'browser-user', name: 'Admin UI test', email: 'ui@test.invalid', role, locationId:role==='DC_ADMIN'?dcs[0].id:null };
  const originalFetch = window.fetch.bind(window);
  window.testState = { calls: [], networkFail: false, delay: 0, refreshFail: false, invalidUnit: false };
  window.testState.seedExistingPurchaseReceipt=()=>{
    const p=invoices[0];const key=p.locationId+cup.id;
    stockBalances.set(key,String(Number(stockBalances.get(key)??0)+2));
    stockDocs.push({id:crypto.randomUUID(),kind:'RECEIPT',status:'POSTED',locationId:p.locationId,supplierName:p.supplierName,reference:'EXISTING-UI-2',businessDate:p.businessDate,lines:[{stockItemId:cup.id,quantity:'2'}]});
    return stockBalances.get(key);
  };
  window.testState.purchaseStockBalance=()=>stockBalances.get(invoices[0].locationId+cup.id);
  window.fetch = async (input, options = {}) => {
    const url = new URL(typeof input === 'string' ? input : input.url, location.origin);
    const path = url.pathname;
    if (!path.startsWith('/api/v1/')) return originalFetch(input, options);
    const method = options.method ?? 'GET';
    window.testState.calls.push({ path, method, query: Object.fromEntries(url.searchParams) });
    const response = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
    if (path.endsWith('/auth/refresh')) return response({ user, accessToken: 'mock-access' }, 201);
    if (path.endsWith('/auth/logout')) return response({ success: true });
    if(path.endsWith('/catalog/units'))return response(units);
    const pageOf = (values) => {
      const q=(url.searchParams.get('q')??'').toLowerCase(); const page=Number(url.searchParams.get('page')??1); const perPage=Number(url.searchParams.get('perPage')??25);
      const filtered=values.filter(value=>value.name.toLowerCase().includes(q)||value.code.toLowerCase().includes(q)).sort((a,b)=>a.name.localeCompare(b.name));
      return {items:filtered.slice((page-1)*perPage,page*perPage),total:filtered.length,page,perPage,totalPages:Math.ceil(filtered.length/perPage)};
    };
    if (path.endsWith('/locations/page')) {
      let list=locations.filter(row=>!url.searchParams.get('type')||row.type===url.searchParams.get('type'));
      if(url.searchParams.get('parentId'))list=list.filter(row=>row.parentId===url.searchParams.get('parentId'));
      if(url.searchParams.get('ownership'))list=list.filter(row=>row.ownership===url.searchParams.get('ownership'));
      if(user.role==='DC_ADMIN')list=list.filter(row=>row.id===dcs[0].id||row.parentId===dcs[0].id);
      return response(pageOf(list));
    }
    if(path.endsWith('/entities/page'))return response(pageOf(owners.filter(row=>row.id!==url.searchParams.get('excludeEntityId'))));
    if(path.endsWith('/catalog/items/page'))return response(pageOf(catalog.items));
    if(path.endsWith('/catalog/variants/page'))return response(pageOf(catalog.variants));
    if(path.endsWith('/purchasing/suppliers')&&method==='GET')return response(pageOf(suppliers));
    if(path.endsWith('/purchasing/invoices')&&method==='GET')return response(pageOf(invoices.filter(p=>p.locationId===url.searchParams.get('locationId')).map(p=>({...presentInvoice(p),name:p.invoiceReference,code:p.supplierName}))));
    if(/^\/api\/v1\/purchasing\/invoices\/[^/]+$/.test(path)&&method==='GET')return response(presentInvoice(invoices.find(p=>p.id===path.split('/')[5])));
    if(path.endsWith('/receipt-options')){const p=invoices.find(p=>p.id===path.split('/')[5]);return response(pageOf(stockDocs.filter(s=>s.kind==='RECEIPT'&&s.supplierName===p.supplierName&&!s.linked).map(s=>({...s,name:s.reference,code:s.businessDate}))));}
    if(path.endsWith('/inventory/balances')){
      const p=pageOf(catalog.items);
      return response({...p,items:p.items.map(item=>({...item,quantity:stockBalances.get(url.searchParams.get('locationId')+item.id)??null,openingDate:stockBalances.has(url.searchParams.get('locationId')+item.id)?'2026-01-01':null}))});
    }
    if(path.endsWith('/inventory/documents')&&method==='GET'){
      const list=stockDocs.filter(d=>d.locationId===url.searchParams.get('locationId')||(d.destinationId===url.searchParams.get('locationId')&&d.status!=='DRAFT'));
      return response(pageOf(list.map(d=>({...d,name:d.reference,code:d.reference}))));
    }
    if(path.endsWith('/inventory/movements'))return response(pageOf(stockMovements.filter(m=>m.locationId===url.searchParams.get('locationId'))));
    if(/^\/api\/v1\/inventory\/documents\/[^/]+$/.test(path)&&method==='GET')return response(stockDocs.find(d=>d.id===path.split('/')[5]));
    if(path.endsWith('/recipes/page'))return response(pageOf(recipes.filter(row=>(!url.searchParams.get('kind')||row.kind===url.searchParams.get('kind'))&&(user.role==='CENTRAL_ADMIN'||(user.role==='DC_ADMIN'&&row.scopeLocationId===user.locationId)))));
    if(/^\/api\/v1\/recipes\/[^/]+\/detail$/.test(path))return response(recipes.find(row=>row.id===path.split('/')[4]));
    if(/^\/api\/v1\/locations\/[^/]+\/detail$/.test(path))return response(locations.find(row=>row.id===path.split('/')[4]));
    if (path.endsWith('/catalog') && method === 'GET') {
      if (window.testState.refreshFail) return response({ message: 'Daftar sementara tidak tersedia.' }, 503);
      return response(structuredClone(catalog));
    }
    if (method === 'POST') {
      const body = JSON.parse(options.body);
      if (window.testState.delay) await new Promise((resolve) => setTimeout(resolve, window.testState.delay));
      if (window.testState.networkFail) throw new TypeError('Mock network unavailable');
      if(path.endsWith('/purchasing/suppliers')){const supplier={...body};suppliers.push(supplier);return response(supplier,201);}
      if(path.endsWith('/purchasing/invoices')){
        const lines=body.lines.map(l=>({...l,id:crypto.randomUUID(),stockItem:catalog.items.find(i=>i.id===l.stockItemId),receivedQuantity:'0',lineAmount:String(Math.round(Number(l.quantity)*Number(l.unitPrice)))}));
        const p={...body,location:locations.find(l=>l.id===body.locationId),supplierName:suppliers.find(s=>s.id===body.supplierId).name,status:'DRAFT',totalAmount:lines.reduce((s,l)=>s+BigInt(l.lineAmount),0n).toString(),paidAmount:'0',lines,receipts:[],payments:[],currency:'IDR'};invoices.unshift(p);return response(presentInvoice(p),201);
      }
      if(/^\/api\/v1\/purchasing\/invoices\/[^/]+\/(confirm|receive|payments|link-receipt)$/.test(path)){
        const p=invoices.find(p=>p.id===path.split('/')[5]);const action=path.split('/')[6];
        if(action==='confirm')p.status='CONFIRMED';
        if(action==='receive'){
          if(!p.receipts.some(r=>r.id===body.id)){
            p.receipts.push({id:body.id,stockDocumentId:body.id,linkedExisting:false,stockDocument:{reference:body.reference,businessDate:body.businessDate}});
            for(const l of body.lines){const line=p.lines.find(x=>x.id===l.lineId);line.receivedQuantity=String(Number(line.receivedQuantity)+Number(l.quantity));const key=p.locationId+line.stockItemId;stockBalances.set(key,String(Number(stockBalances.get(key)??0)+Number(l.quantity)));}
          }
        }
        if(action==='payments'&&!p.payments.some(v=>v.id===body.id)){p.payments.push(body);p.paidAmount=(BigInt(p.paidAmount)+BigInt(body.amount)).toString();}
        if(action==='link-receipt'){
          const stock=stockDocs.find(s=>s.id===body.stockDocumentId);stock.linked=true;
          p.receipts.push({id:body.id,linkedExisting:true,stockDocumentId:stock.id,stockDocument:stock});
          for(const l of stock.lines){const line=p.lines.find(x=>x.stockItemId===l.stockItemId);line.receivedQuantity=String(Number(line.receivedQuantity)+Number(l.quantity));}
        }
        return response(presentInvoice(p),201);
      }
      if(path.endsWith('/inventory/documents')){
        const existing=stockDocs.find(d=>d.id===body.id);if(existing)return response(existing,201);
        const doc={...body,status:'DRAFT',location:locations.find(l=>l.id===body.locationId),destination:locations.find(l=>l.id===body.destinationId)??null,receipts:[],lines:body.lines.map(l=>({...l,id:crypto.randomUUID(),receivedQuantity:'0',stockItem:catalog.items.find(i=>i.id===l.stockItemId)}))};stockDocs.unshift(doc);return response(doc,201);
      }
      if(/^\/api\/v1\/inventory\/documents\/[^/]+\/(post|ship|receive)$/.test(path)){
        const doc=stockDocs.find(d=>d.id===path.split('/')[5]);const action=path.split('/')[6];
        if(action==='receive'){
          if(!doc.receipts.some(r=>r.id===body.id)){
            doc.receipts.push({...body,createdAt:new Date().toISOString()});
            for(const received of body.lines){const line=doc.lines.find(l=>l.id===received.lineId);line.receivedQuantity=String(Number(line.receivedQuantity)+Number(received.quantity));stockBalances.set(doc.destinationId+line.stockItemId,String(Number(stockBalances.get(doc.destinationId+line.stockItemId)??0)+Number(received.quantity)));}
            doc.status=doc.lines.every(l=>l.quantity===l.receivedQuantity)?'RECEIVED':'SHIPPED';
          }
        }else if(doc.status==='DRAFT'){
          doc.status=action==='ship'?'SHIPPED':'POSTED';
          for(const line of doc.lines){const key=doc.locationId+line.stockItemId;const delta=(action==='ship'?-1:1)*Number(line.quantity);stockBalances.set(key,String(Number(stockBalances.get(key)??0)+delta));stockMovements.push({id:crypto.randomUUID(),name:line.stockItem.name,code:line.stockItem.code,locationId:doc.locationId,businessDate:doc.businessDate,kind:action==='ship'?'SHIPMENT':doc.kind,quantity:String(delta),balanceAfter:stockBalances.get(key),line:{...line,document:doc}});}
        }
        return response(doc,201);
      }
      if(path.endsWith('/recipes')){
        const row={...body,id:crypto.randomUUID(),code:'fixture-recipe',version:1,status:'DRAFT',outputItem:catalog.items.find(item=>item.id===body.outputItemId)??null,menuVariant:catalog.variants.find(menu=>menu.id===body.menuVariantId)??null,scopeLocation:locations.find(dc=>dc.id===body.scopeLocationId)??null,components:body.components.map(line=>({...line,stockItem:catalog.items.find(item=>item.id===line.stockItemId)})),_count:{components:body.components.length}};
        recipes.unshift(row);return response(row,201);
      }
      if(/^\/api\/v1\/recipes\/[^/]+\/preview$/.test(path)){
        const recipe=recipes.find(row=>row.id===path.split('/')[4]);
        const factor=Number(body.targetQuantity)/Number(recipe.outputQuantity)*(recipe.kind==='PRODUCTION'?Number(units.find(unit=>unit.code===body.targetUnitCode).factor)/Number(units.find(unit=>unit.code===recipe.outputUnitCode).factor):1);
        return response({recipeId:recipe.id,version:1,planningOnly:true,targetQuantity:body.targetQuantity,targetUnitCode:body.targetUnitCode,warning:'Simulasi, bukan stok aktual.',components:recipe.components.map(line=>({name:line.stockItem.name,quantity:String(Number(line.quantity)*factor*Number(units.find(unit=>unit.code===line.unitCode).factor)),unitCode:line.stockItem.baseUnit.code,rounded:false}))},201);
      }
      if(path.endsWith('/entities')) { const entity={...body,id:crypto.randomUUID()};owners.push(entity);return response(entity,201); }
      if(path.endsWith('/locations')) {
        if(locations.some(row=>row.code===body.code))return response({message:'Kode lokasi sudah digunakan.',issues:[{field:'code',message:'Kode lokasi ini sudah digunakan. Gunakan kode lain.'}]},409);
        const entity=owners.find(row=>row.id===body.entityId); const parent=locations.find(row=>row.id===body.parentId)??null;
        const row={...body,id:crypto.randomUUID(),entity,parent,_count:{children:0}};locations.push(row);if(parent)parent._count.children++;return response(row,201);
      }
      if (path.endsWith('/catalog/items')) {
        if (window.testState.invalidUnit) return response({ message: 'Satuan tidak berlaku.', issues: [{ field: 'baseUnitId', message: 'Pilih satuan pencatatan yang tersedia.' }] }, 400);
        if (catalog.items.some((item) => item.code === body.code)) return response({ message: 'Kode sudah digunakan.', issues: [{ field: 'code', message: 'Kode ini sudah digunakan. Gunakan kode lain.' }] }, 409);
        const item = { ...body, id: crypto.randomUUID(), baseUnit: units.find((unit) => unit.id === body.baseUnitId) };
        catalog.items.push(item);
        return response(item, 201);
      }
      if (path.endsWith('/catalog/menus')) {
        if (catalog.menus.some((menu) => menu.name === body.name)) return response({ message: 'Kelompok sudah ada.', issues: [{ field: 'name', message: 'Kelompok minuman ini sudah ada.' }] }, 409);
        const menu = { ...body, id: crypto.randomUUID() }; catalog.menus.push(menu); return response(menu, 201);
      }
      if (path.endsWith('/catalog/variants')) {
        const variant = { ...body, id: crypto.randomUUID(), menu: catalog.menus.find((menu) => menu.id === body.menuId) }; catalog.variants.push(variant); return response(variant, 201);
      }
    }
    return response([]);
  };
  window.testUI = {
    click(text) {
      const element = [...document.querySelectorAll('button')].find((button) => (button.textContent.trim() === text || button.getAttribute('aria-label')===text || (button.getAttribute('role') === 'tab' && button.textContent.trim().startsWith(text))) && button.getClientRects().length);
      if (!element) throw new Error('Button missing: ' + text);
      element.focus(); element.click();
    },
    fill(labelText, value) {
      const label = [...document.querySelectorAll('label')].find((label) => label.textContent.replace('*','').trim() === labelText);
      const input = label ? document.getElementById(label.htmlFor) : document.querySelector('[aria-label="' + labelText + '"]');
      if (!input) throw new Error('Field missing: ' + labelText);
      input.focus();
      const prototype = input instanceof HTMLSelectElement ? HTMLSelectElement.prototype : HTMLInputElement.prototype;
      Object.getOwnPropertyDescriptor(prototype, 'value').set.call(input, value);
      input.dispatchEvent(new Event(input instanceof HTMLSelectElement ? 'change' : 'input', { bubbles: true }));
      input.blur();
    },
  };
`;

try {
  let targets;
  for (let i = 0; i < 100; i++) {
    try {
      targets = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
      if (targets.some((target) => target.type === 'page')) break;
    } catch {}
    await delay(100);
  }
  const target = targets?.find((target) => target.type === 'page');
  if (!target) throw new Error('Chromium did not start.');
  ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    ws.addEventListener('open', resolve, { once: true });
    ws.addEventListener('error', reject, { once: true });
  });
  ws.addEventListener('message', (event) => {
    const message = JSON.parse(event.data);
    if (message.id && pending.has(message.id)) {
      const item = pending.get(message.id);
      pending.delete(message.id);
      clearTimeout(item.timer);
      if (message.error) item.reject(new Error(message.error.message));
      else item.resolve(message.result);
    }
    if (message.method === 'Runtime.exceptionThrown')
      pageErrors.push(message.params.exceptionDetails.text);
    if (message.method === 'Runtime.consoleAPICalled' && message.params.type === 'error')
      pageErrors.push(
        JSON.stringify(message.params.args.map((arg) => arg.value ?? arg.description)),
      );
  });
  await send('Page.enable');
  await send('Runtime.enable');
  await send('Page.addScriptToEvaluateOnNewDocument', { source: preload });
  await send('Emulation.setDeviceMetricsOverride', {
    width: 1280,
    height: 900,
    deviceScaleFactor: 1,
    mobile: false,
  });
  await send('Page.navigate', { url: webUrl });
  await waitFor(
    `document.querySelector('nav') && document.body.textContent.includes('Admin UI test')`,
    'initial session',
  );
  await click('Barang & Menu');
  await waitFor(
    `document.querySelector('[role=tablist]') && document.body.textContent.includes('BAHAN-TEH')`,
    'catalog list',
  );
  assert.equal(
    await evaluate(`document.querySelectorAll('form').length`),
    0,
    'list has no permanent forms',
  );
  await screenshot('catalog-desktop');
  await fill('Cari barang', 'no-match');
  await waitFor(
    `document.body.textContent.includes('Tidak ada hasil yang cocok')`,
    'search empty result',
  );
  await evaluate(`document.querySelector('[aria-label="Hapus pencarian"]').click()`);
  await click('Tambah barang');
  await waitFor(
    `document.querySelector('dialog[open]') && document.activeElement?.placeholder === 'Contoh: Powder Coklat'`,
    'initial modal focus',
  );
  await delay(150);
  assert.equal(
    await evaluate(`document.querySelector('dialog [aria-invalid=true]') === null`),
    true,
    'fresh modal has no premature errors',
  );
  for (let i = 0; i < 8; i++) {
    await send('Input.dispatchKeyEvent', {
      type: 'keyDown',
      key: 'Tab',
      code: 'Tab',
      windowsVirtualKeyCode: 9,
    });
    await send('Input.dispatchKeyEvent', {
      type: 'keyUp',
      key: 'Tab',
      code: 'Tab',
      windowsVirtualKeyCode: 9,
    });
    assert.equal(
      await evaluate(`!!document.activeElement?.closest('dialog')`),
      true,
      'keyboard focus stays inside modal',
    );
  }
  await click('Simpan barang');
  await waitFor(
    `document.body.textContent.includes('Isi nama barang terlebih dahulu.') && document.body.textContent.includes('Pilih satuan pencatatan barang.')`,
    'inline required validation',
  );
  await fill('Nama barang', 'Powder Test');
  await fill('Kode barang', 'BAHAN-TEH');
  await fill('Stok dihitung dalam', '7c6460b6-80ba-43a3-9487-107c67333101');
  await click('Simpan barang');
  await waitFor(
    `document.body.textContent.includes('Kode ini sudah digunakan. Gunakan kode lain.') && document.activeElement?.value === 'BAHAN-TEH'`,
    'duplicate code focus',
  );
  assert.equal(
    await evaluate(`document.querySelector('input[placeholder="Contoh: Powder Coklat"]').value`),
    'Powder Test',
    'failed submit keeps input',
  );
  await evaluate('window.testState.networkFail = true');
  await fill('Kode barang', 'POWDER-TEST');
  await click('Simpan barang');
  await waitFor(
    `document.body.textContent.includes('Tidak dapat terhubung.') && !document.querySelector('fieldset').disabled`,
    'network error',
  );
  await evaluate('window.testState.networkFail = false; window.testState.invalidUnit = true');
  await click('Simpan barang');
  await waitFor(
    `document.body.textContent.includes('Pilih satuan pencatatan yang tersedia.')`,
    'server field mapping',
  );
  await evaluate(
    'window.testState.invalidUnit = false; window.testState.delay = 700; window.testState.before = window.testState.calls.filter(c=>c.method === "POST" && c.path.endsWith("/items")).length',
  );
  await click('Simpan barang');
  await waitFor(`document.body.textContent.includes('Menyimpan…')`, 'pending state');
  await evaluate(`document.querySelector('button[type=submit]').click()`);
  await send('Input.dispatchKeyEvent', {
    type: 'keyDown',
    key: 'Escape',
    code: 'Escape',
    windowsVirtualKeyCode: 27,
  });
  assert.equal(
    await evaluate(`!!document.querySelector('dialog[open]')`),
    true,
    'pending modal cannot close',
  );
  await waitFor(
    `!document.querySelector('dialog') && document.body.textContent.includes('Barang berhasil ditambahkan.')`,
    'save closes modal with feedback',
  );
  assert.equal(
    await evaluate(
      `window.testState.calls.filter(c=>c.method === 'POST' && c.path.endsWith('/items')).length - window.testState.before`,
    ),
    1,
    'one pending request',
  );
  assert.equal(
    await evaluate(`document.activeElement?.textContent.trim()`),
    'Tambah barang',
    'focus returns to trigger',
  );
  await click('Tambah barang');
  await send('Input.dispatchKeyEvent', {
    type: 'keyDown',
    key: 'Escape',
    code: 'Escape',
    windowsVirtualKeyCode: 27,
  });
  await waitFor(`!document.querySelector('dialog')`, 'empty Escape closes');
  await click('Tambah barang');
  await send('Input.dispatchMouseEvent', {
    type: 'mousePressed',
    x: 5,
    y: 5,
    button: 'left',
    clickCount: 1,
  });
  await send('Input.dispatchMouseEvent', {
    type: 'mouseReleased',
    x: 5,
    y: 5,
    button: 'left',
    clickCount: 1,
  });
  await waitFor(`!document.querySelector('dialog')`, 'empty backdrop closes');
  await click('Tambah barang');
  await click('Batal');
  await waitFor(`!document.querySelector('dialog')`, 'empty cancel');
  await click('Tambah barang');
  await fill('Nama barang', 'Unsaved draft');
  await send('Input.dispatchKeyEvent', {
    type: 'keyDown',
    key: 'Escape',
    code: 'Escape',
    windowsVirtualKeyCode: 27,
  });
  await waitFor(
    `document.body.textContent.includes('Batalkan perubahan?')`,
    'dirty Escape asks first',
  );
  await click('Lanjut isi');
  await click('Batal');
  await waitFor(
    `document.body.textContent.includes('Batalkan perubahan?') && document.activeElement.textContent === 'Lanjut isi'`,
    'dirty confirmation focus',
  );
  await click('Lanjut isi');
  assert.equal(
    await evaluate(`document.querySelector('input[placeholder="Contoh: Powder Coklat"]').value`),
    'Unsaved draft',
  );
  await click('Batal');
  await click('Buang isian');
  await waitFor(`!document.querySelector('dialog')`, 'discard form');
  await click('Menu Minuman');
  await waitFor(`document.body.textContent.includes('Original')`, 'menu tab');
  await click('Buat kelompok');
  await fill('Nama kelompok minuman', 'Es Teh');
  await click('Simpan kelompok');
  await waitFor(
    `document.body.textContent.includes('Kelompok minuman ini sudah ada.')`,
    'group server validation',
  );
  await fill('Nama kelompok minuman', 'Minuman Test');
  await click('Simpan kelompok');
  await waitFor(
    `!document.querySelector('dialog') && document.body.textContent.includes('Minuman Test')`,
    'group saved',
  );
  await click('Tambah menu');
  await fill('Nama rasa / menu', 'Melon Test');
  await fill('Kelompok minuman', '7c6460b6-80ba-43a3-9487-107c67333201');
  await fill('Kode menu', 'MELON-TEST');
  await click('Simpan menu');
  await waitFor(
    `!document.querySelector('dialog') && document.body.textContent.includes('Melon Test')`,
    'menu saved',
  );
  await send('Emulation.setDeviceMetricsOverride', {
    width: 390,
    height: 844,
    deviceScaleFactor: 1,
    mobile: false,
  });
  await click('Barang');
  await screenshot('catalog-mobile-list');
  await click('Tambah barang');
  await waitFor(
    `document.querySelector('dialog')?.getBoundingClientRect().width === 390`,
    'full width mobile modal',
  );
  await delay(150);
  assert.equal(
    await evaluate(`document.querySelector('dialog [aria-invalid=true]') === null`),
    true,
    'reopened mobile modal starts without errors',
  );
  const geometry = await evaluate(
    `(()=>{const d=document.querySelector('dialog');const r=d.getBoundingClientRect();const b=d.querySelector('button[type=submit]').getBoundingClientRect();return {width:r.width,height:r.height,buttonBottom:b.bottom,viewport:innerHeight,overflow:document.documentElement.scrollWidth > innerWidth}})()`,
  );
  assert.equal(geometry.overflow, false, 'mobile page has no horizontal overflow');
  assert.ok(geometry.buttonBottom <= geometry.viewport, 'mobile footer stays visible');
  await screenshot('catalog-mobile-dialog');
  await click('Batal');
  await send('Emulation.setDeviceMetricsOverride', {
    width: 768,
    height: 1024,
    deviceScaleFactor: 1,
    mobile: false,
  });
  await click('Tambah barang');
  assert.ok(
    await evaluate(`document.querySelector('dialog').getBoundingClientRect().width < innerWidth`),
    'tablet modal is bounded',
  );
  await fill('Nama barang', 'Cache Success');
  await fill('Kode barang', 'CACHE-SUCCESS');
  await fill('Stok dihitung dalam', '7c6460b6-80ba-43a3-9487-107c67333101');
  await evaluate('window.testState.refreshFail = true; window.testState.delay = 0');
  await click('Simpan barang');
  await waitFor(
    `!document.querySelector('dialog') && document.body.textContent.includes('Cache Success')`,
    'server-confirmed item visible even if refetch fails',
  );
  // Organization stress fixture: sixty DCs and sixty-three stands, paged API.
  await click('Pusat, DC & Stand');
  await waitFor(`document.body.textContent.includes('1–25 dari 60 data')`, 'DC server pagination');
  assert.equal(
    await evaluate(`document.querySelectorAll('form').length`),
    0,
    'organization has no permanent forms',
  );
  await click('Halaman berikutnya');
  await waitFor(`document.body.textContent.includes('26–50 dari 60 data')`, 'next page');
  await fill('Cari DC', 'DC 060');
  await waitFor(
    `document.body.textContent.includes('1–1 dari 1 data') && document.body.textContent.includes('DC 060')`,
    'search covers data beyond first page',
  );
  await click('Hapus pencarian');
  await waitFor(`document.body.textContent.includes('1–25 dari 60 data')`, 'reset server search');
  await click('Lihat detail DC 001');
  await waitFor(
    `document.querySelector('dialog[open]')?.textContent.includes('63 lokasi')`,
    'DC detail stand count',
  );
  await click('Lihat stand binaan');
  await waitFor(
    `document.body.textContent.includes('1–25 dari 63 data') && !document.querySelector('dialog')`,
    'DC drill-down filter',
  );
  await fill('Filter kepemilikan stand', 'PARTNER');
  await waitFor(
    `document.body.textContent.includes('1–25 dari 31 data')`,
    'ownership server filter',
  );
  await fill('Filter kepemilikan stand', '');
  await click('Tambah stand');
  await waitFor(
    `document.querySelector('dialog[open]') && document.activeElement?.placeholder === 'Contoh: Stand Kesambi'`,
    'stand dialog',
  );
  assert.equal(
    await evaluate(`document.querySelector('dialog [aria-invalid=true]') === null`),
    true,
    'new organization dialog no errors',
  );
  await click('Simpan stand');
  await waitFor(
    `document.body.textContent.includes('Isi nama minimal 2 karakter.')`,
    'stand required validation',
  );
  await fill('Nama stand', 'Stand Added');
  await fill('Kode stand', 'STAND-001');
  await click('Simpan stand');
  await waitFor(
    `document.body.textContent.includes('Kode lokasi ini sudah digunakan.')`,
    'duplicate location mapped to code',
  );
  await fill('Kode stand', 'STAND-ADDED');
  await evaluate('window.testState.networkFail = true');
  await click('Simpan stand');
  await waitFor(
    `document.body.textContent.includes('Tidak dapat terhubung.')`,
    'location network error retains form',
  );
  await evaluate('window.testState.networkFail = false');
  await click('Simpan stand');
  await waitFor(
    `!document.querySelector('dialog') && document.body.textContent.includes('berhasil ditambahkan.')`,
    'stand saved success',
  );
  assert.equal(
    await evaluate(
      `window.testState.calls.some(call=>call.path.endsWith('/locations/page') && call.query.ownership==='PARTNER')`,
    ),
    true,
    'server receives filter query',
  );
  await click('DC');
  await click('Tambah DC');
  await fill('Nama DC', 'DC Added');
  await fill('Kode DC', 'DC-ADDED');
  await click('Pilih pusat');
  await waitFor(
    `document.querySelector('dialog')?.textContent.includes('Pusat Utama')`,
    'paged parent picker',
  );
  await evaluate(
    `(()=>{const buttons=[...document.querySelectorAll('dialog button')];const option=buttons.find(button=>button.textContent.includes('Pusat Utama')&&button.textContent.includes('PUSAT'));if(!option)throw new Error('Parent option missing');option.click()})()`,
  );
  await click('Simpan DC');
  await waitFor(
    `!document.querySelector('dialog') && document.body.textContent.includes('DC Added')`,
    'DC parent entity auto assigned',
  );
  await click('Stand');
  await click('Tambah stand');
  await fill('Nama stand', 'Partner Added');
  await fill('Kode stand', 'PARTNER-ADDED');
  await click('Pilih DC');
  await fill('Cari pilih dc', 'DC 060');
  await waitFor(
    `document.querySelector('dialog')?.textContent.includes('DC 060')`,
    'picker searches DC beyond initial ten',
  );
  await evaluate(
    `[...document.querySelectorAll('dialog button')].find(button=>button.textContent.includes('DC 060')&&button.textContent.includes('DC-060')).click()`,
  );
  await fill('Kepemilikan stand', 'PARTNER');
  await click('Pilih pemilik mitra');
  await waitFor(
    `document.querySelector('dialog')?.textContent.includes('Usaha Mitra')`,
    'partner owner picker',
  );
  assert.equal(
    await evaluate(`document.querySelector('dialog ul')?.textContent.includes('Teh Coyo')`),
    false,
    'DC owner excluded from partner options',
  );
  await evaluate(
    `[...document.querySelectorAll('dialog button')].find(button=>button.textContent.includes('Usaha Mitra')&&button.textContent.includes('MITRA')).click()`,
  );
  await click('Simpan stand');
  await waitFor(
    `!document.querySelector('dialog') && document.body.textContent.includes('berhasil ditambahkan.')`,
    'partner stand saved',
  );
  await send('Emulation.setDeviceMetricsOverride', {
    width: 390,
    height: 844,
    deviceScaleFactor: 1,
    mobile: false,
  });
  assert.equal(
    await evaluate(`document.documentElement.scrollWidth <= innerWidth`),
    true,
    'location mobile list no overflow',
  );
  await screenshot('organization-mobile-list');
  await click('Tambah stand');
  await waitFor(
    `document.querySelector('dialog[open]')?.getBoundingClientRect().width === 390`,
    'location mobile fullscreen',
  );
  await screenshot('organization-mobile-dialog');
  await click('Batal');
  await click('Pemilik Usaha');
  await click('Tambah pemilik usaha');
  await fill('Nama pemilik usaha', 'Owner Cancel Test');
  await click('Batal');
  await waitFor(
    `document.body.textContent.includes('Batalkan perubahan?')`,
    'organization dirty cancel',
  );
  await click('Buang isian');
  await click('Resep');
  await waitFor(`document.body.textContent.includes('1–25 dari 31 data')`, 'recipe server list');
  assert.equal(
    await evaluate(`document.querySelectorAll('form').length`),
    0,
    'recipe list has no editors/simulations',
  );
  await fill('Cari resep', 'Teh Batch 031');
  await waitFor(
    `document.body.textContent.includes('1–1 dari 1 data')`,
    'recipe search beyond first page',
  );
  await click('Hapus pencarian resep');
  await click('Buat resep');
  await waitFor(
    `document.body.textContent.includes('Buat resep produksi DC')`,
    'dedicated production editor',
  );
  await fill('Nama resep', 'Unstored recipe');
  await click('Barang & Menu');
  await waitFor(
    `document.querySelector('dialog[open]')?.textContent.includes('Keluar tanpa menyimpan?')`,
    'navigation dirty guard',
  );
  await click('Lanjut isi');
  assert.equal(
    await evaluate(`document.querySelector('input[placeholder="Contoh: Teh Dasar"]').value`),
    'Unstored recipe',
    'guard retains recipe values',
  );
  await click('Batal');
  await click('Buang isian');
  await waitFor(`document.querySelector('[aria-label="Cari resep"]')`, 'return list');
  await click('Buat resep');
  await click('Simpan draft');
  await waitFor(
    `document.body.textContent.includes('Pilih barang hasil produksi.')`,
    'output field required',
  );
  await fill('Nama resep', 'A Production Test');
  await click('Pilih barang hasil');
  await waitFor(`document.body.textContent.includes('TEH-DASAR')`, 'output picker');
  await evaluate(
    `[...document.querySelectorAll('button')].find(button=>button.textContent.includes('Teh Dasar')&&button.textContent.includes('TEH-DASAR')).click()`,
  );
  await fill('Jumlah hasil standar', '10');
  await fill('Satuan hasil', 'L');
  assert.equal(
    await evaluate(
      `[...document.querySelector('select[id$="-unit"]').options].some(option=>option.value==='g')`,
    ),
    false,
    'output unit dimension filtered',
  );
  await click('Tambah bahan');
  await click('Simpan draft');
  await waitFor(
    `document.body.textContent.includes('Pilih bahan yang digunakan.')`,
    'added incomplete line fails',
  );
  await click('Pilih bahan');
  await waitFor(`document.body.textContent.includes('BAHAN-TEH')`, 'ingredient picker');
  await evaluate(
    `[...document.querySelectorAll('button')].find(button=>button.textContent.includes('Bahan Teh')&&button.textContent.includes('BAHAN-TEH')).click()`,
  );
  await fill('Takaran bahan 1', '0');
  await click('Simpan draft');
  await waitFor(
    `document.body.textContent.includes('Jumlah harus lebih dari nol.')`,
    'positive ingredient validation',
  );
  await fill('Takaran bahan 1', '100');
  assert.equal(
    await evaluate(
      `[...document.querySelector('select[id$="-unit"]').options].some(option=>option.value==='g')`,
    ),
    false,
    'production output units stay compatible',
  );
  await evaluate('window.testState.networkFail=true');
  await click('Simpan draft');
  await waitFor(
    `document.body.textContent.includes('Tidak dapat terhubung.')`,
    'recipe server failure keeps input',
  );
  await evaluate(
    'window.testState.networkFail=false;window.testState.delay=400;window.testState.recipeBefore=window.testState.calls.filter(call=>call.path.endsWith("/recipes")&&call.method==="POST").length',
  );
  await click('Simpan draft');
  await waitFor(`document.body.textContent.includes('Menyimpan…')`, 'recipe pending');
  await click('Barang & Menu');
  assert.equal(
    await evaluate(`document.body.textContent.includes('Buat resep produksi DC')`),
    true,
    'pending save blocks navigation',
  );
  await waitFor(
    `document.querySelector('[aria-label="Cari resep"]')&&document.body.textContent.includes('A Production Test')`,
    'saved returns list',
  );
  assert.equal(
    await evaluate(
      `window.testState.calls.filter(call=>call.path.endsWith('/recipes')&&call.method==='POST').length-window.testState.recipeBefore`,
    ),
    1,
    'save makes one new draft',
  );
  await click('Buka resep A Production Test');
  await waitFor(
    `document.body.textContent.includes('Hitung Kebutuhan Bahan')`,
    'readonly detail simulation',
  );
  await fill('Target produksi', '25');
  await click('Hitung kebutuhan');
  await waitFor(
    `document.body.textContent.includes('Kebutuhan untuk 25 L')&&document.body.textContent.includes('250 g')`,
    'production scaling',
  );
  await fill('Target produksi', '30');
  await waitFor(
    `document.body.textContent.includes('Target sudah berubah.')`,
    'stale simulation hidden',
  );
  assert.equal(
    await evaluate(`document.body.textContent.includes('Kebutuhan untuk 25 L')`),
    false,
    'old target result hidden',
  );
  await click('Kembali ke daftar');
  await click('Takaran per Cup');
  await click('Buat resep');
  await waitFor(`document.body.textContent.includes('Buat takaran per cup')`, 'serving editor');
  await fill('Nama resep', 'A Original Test');
  await click('Pilih menu minuman');
  await waitFor(`document.body.textContent.includes('ORIGINAL')`, 'menu options');
  await evaluate(
    `[...document.querySelectorAll('button')].find(button=>button.textContent.includes('Original')&&button.textContent.includes('ORIGINAL')).click()`,
  );
  await click('Tambah bahan');
  await click('Pilih bahan');
  await waitFor(`document.body.textContent.includes('TEH-DASAR')`, 'serving ingredient options');
  await evaluate(
    `[...document.querySelectorAll('button')].find(button=>button.textContent.includes('Teh Dasar')&&button.textContent.includes('TEH-DASAR')).click()`,
  );
  await fill('Takaran bahan 1', '150');
  await click('Tambah bahan');
  await evaluate(
    `(()=>{const buttons=[...document.querySelectorAll('button')].filter(button=>button.textContent.trim()==='Pilih bahan');buttons[buttons.length-1].click()})()`,
  );
  await waitFor(
    `[...document.querySelectorAll('ul button')].some(button=>button.textContent.includes('TEH-DASAR'))`,
    'second ingredient options',
  );
  await evaluate(
    `[...document.querySelectorAll('ul button')].find(button=>button.textContent.includes('Teh Dasar')&&button.textContent.includes('TEH-DASAR')).click()`,
  );
  await fill('Takaran bahan 2', '10');
  await click('Simpan draft');
  await waitFor(
    `document.body.textContent.includes('Bahan sudah dipilih.')`,
    'duplicate ingredient error',
  );
  await click('Hapus baris bahan 2');
  await click('Simpan draft');
  await waitFor(
    `document.querySelector('[aria-label="Cari resep"]')&&document.body.textContent.includes('A Original Test')`,
    'original without powder saved',
  );
  await click('Buka resep A Original Test');
  await waitFor(`document.body.textContent.includes('Jumlah cup')`, 'serving simulation');
  await fill('Jumlah cup', '2.5');
  await click('Hitung kebutuhan');
  await waitFor(
    `document.body.textContent.includes('Jumlah cup harus bilangan bulat positif.')`,
    'fractional cup rejected',
  );
  await fill('Jumlah cup', '3');
  await click('Hitung kebutuhan');
  await waitFor(
    `document.body.textContent.includes('Kebutuhan untuk 3 cup')&&document.body.textContent.includes('450 ml')`,
    'serving recipe scaling',
  );
  assert.equal(
    await evaluate(`document.documentElement.scrollWidth<=innerWidth`),
    true,
    'recipe detail mobile no overflow',
  );
  await screenshot('recipe-mobile-detail');
  await click('Kembali ke daftar');
  await click('Buat resep');
  await fill('Nama resep', 'Mobile editor');
  await screenshot('recipe-mobile-editor');
  await click('Batal');
  await click('Buang isian');
  await click('Buat resep');
  await fill('Nama resep', 'A Empty Draft');
  await click('Pilih menu minuman');
  await waitFor(`document.body.textContent.includes('ORIGINAL')`, 'empty recipe menu picker');
  await evaluate(
    `[...document.querySelectorAll('button')].find(button=>button.textContent.includes('Original')&&button.textContent.includes('ORIGINAL')).click()`,
  );
  await click('Simpan draft');
  await waitFor(
    `document.querySelector('[aria-label="Cari resep"]')&&document.body.textContent.includes('A Empty Draft')`,
    'empty component draft allowed',
  );
  await click('Buka resep A Empty Draft');
  await waitFor(`document.body.textContent.includes('Belum ada bahan.')`, 'empty draft detail');
  assert.equal(
    await evaluate(`document.body.textContent.includes('Hitung Kebutuhan Bahan')`),
    false,
    'no simulation for empty components',
  );
  await click('Kembali ke daftar');
  // Inventory online UI. Backend invariants are tested separately against PostgreSQL.
  await click('Stok & Mutasi');
  await waitFor(`document.body.textContent.includes('Lokasi pencatatan')`, 'inventory list');
  await click('Pilih lokasi');
  await fill('Cari pilih lokasi', 'Pusat');
  await waitFor(
    `[...document.querySelectorAll('ul button')].some(b=>b.textContent.includes('Pusat Utama'))`,
    'stock center options',
  );
  await evaluate(
    `[...document.querySelectorAll('ul button')].find(b=>b.textContent.includes('Pusat Utama')).click()`,
  );
  await waitFor(
    `document.body.textContent.includes('Belum ditetapkan')`,
    'missing balances not zero',
  );
  await click('+ Saldo awal');
  await click('Simpan draft');
  await waitFor(
    `document.body.textContent.includes('Isi referensi dokumen.')`,
    'stock required fields',
  );
  await fill('Referensi dokumen', 'UI-OPENING');
  await fill('Keterangan', 'TEST verified count');
  await click('+ Tambah barang');
  await click('Pilih barang');
  await waitFor(
    `[...document.querySelectorAll('ul button')].some(b=>b.textContent.includes('CUP-KOSONG'))`,
    'stock item picker',
  );
  await evaluate(
    `[...document.querySelectorAll('ul button')].find(b=>b.textContent.includes('CUP-KOSONG')).click()`,
  );
  await fill('Jumlah (pcs)', '100');
  await click('Barang & Menu');
  await waitFor(
    `document.body.textContent.includes('Dokumen stok belum disimpan')`,
    'stock dirty navigation',
  );
  await click('Lanjut isi');
  await evaluate(`window.testState.networkFail=true`);
  await click('Simpan draft');
  await waitFor(
    `document.body.textContent.includes('Tidak dapat terhubung')`,
    'stock failed save preserved',
  );
  assert.equal(await evaluate(`document.querySelector('input[inputmode="decimal"]').value`), '100');
  await evaluate(`window.testState.networkFail=false`);
  await click('Simpan draft');
  await waitFor(
    `document.body.textContent.includes('Saldo awal · UI-OPENING')`,
    'stock draft detail',
  );
  await click('Konfirmasi masuk buku stok');
  await waitFor(`document.querySelector('dialog[open]')`, 'stock posting confirmation');
  await click('Ya, konfirmasi');
  await waitFor(`document.body.textContent.includes('Konfirmasi berhasil')`, 'stock posted');
  await click('← Kembali ke daftar');
  await waitFor(`document.body.textContent.includes('100 pcs')`, 'stock balance refreshed');
  await click('+ Transfer');
  await fill('Referensi dokumen', 'UI-TRANSFER');
  await fill('Keterangan', 'TEST shipping only');
  await click('Pilih tujuan');
  await waitFor(
    `[...document.querySelectorAll('ul button')].some(b=>b.textContent.includes('DC-001'))`,
    'transfer child options',
  );
  await evaluate(
    `[...document.querySelectorAll('ul button')].find(b=>b.textContent.includes('DC-001')).click()`,
  );
  await click('+ Tambah barang');
  await click('Pilih barang');
  await waitFor(
    `[...document.querySelectorAll('ul button')].some(b=>b.textContent.includes('CUP-KOSONG'))`,
    'transfer item options',
  );
  await evaluate(
    `[...document.querySelectorAll('ul button')].find(b=>b.textContent.includes('CUP-KOSONG')).click()`,
  );
  await fill('Jumlah (pcs)', '20');
  await click('Simpan draft');
  await waitFor(
    `document.body.textContent.includes('Transfer · UI-TRANSFER')`,
    'transfer draft detail',
  );
  await click('Konfirmasi kirim');
  await waitFor(`document.querySelector('dialog[open]')`, 'shipping confirmation');
  await click('Ya, konfirmasi');
  await waitFor(
    `document.body.textContent.includes('Konfirmasi jumlah yang benar-benar diterima')`,
    'actual transfer receipt',
  );
  await fill('Cup Kosong (pcs)', '21');
  await fill('Catatan penerimaan / selisih', 'TEST shortage');
  await click('Konfirmasi penerimaan aktual');
  await waitFor(
    `document.body.textContent.includes('Melebihi sisa kiriman.')`,
    'receipt max validation',
  );
  await fill('Cup Kosong (pcs)', '18');
  await click('Konfirmasi penerimaan aktual');
  await waitFor(
    `document.body.textContent.includes('Terima 18')&&document.body.textContent.includes('Sisa perjalanan 2')`,
    'partial receipt and open transit',
  );
  assert.equal(
    await evaluate(`document.documentElement.scrollWidth<=innerWidth`),
    true,
    'inventory mobile no overflow',
  );
  await screenshot('inventory-mobile-partial-receipt');
  await click('← Kembali ke daftar');
  await click('Riwayat mutasi');
  await waitFor(
    `document.body.textContent.includes('Saldo sesudah: 80')`,
    'stock movement history',
  );
  await send('Emulation.setDeviceMetricsOverride', {
    width: 1280,
    height: 900,
    deviceScaleFactor: 1,
    mobile: false,
  });
  await screenshot('inventory-desktop-history');
  await click('Pembelian');
  await waitFor(`document.body.textContent.includes('Lokasi pembelian')`, 'purchasing page');
  assert.equal(
    await evaluate(`document.querySelectorAll('form').length`),
    0,
    'no permanent purchase forms',
  );
  await click('Supplier');
  await click('+ Tambah supplier');
  await waitFor(`document.querySelector('dialog[open]')`, 'supplier dialog');
  await click('Simpan supplier');
  await waitFor(`document.body.textContent.includes('Isi kode supplier.')`, 'supplier required');
  await fill('Kode supplier', 'TEST-SUPPLIER');
  await fill('Nama supplier', 'Supplier Test');
  await click('Simpan supplier');
  await waitFor(
    `!document.querySelector('dialog[open]')&&document.body.textContent.includes('Supplier Test berhasil')`,
    'supplier saved',
  );
  await click('Nota pembelian');
  await click('Pilih lokasi pembelian');
  await fill('Cari pilih lokasi pembelian', 'Pusat');
  await waitFor(
    `[...document.querySelectorAll('ul button')].some(b=>b.textContent.includes('Pusat Utama'))`,
    'purchase location options',
  );
  await evaluate(
    `[...document.querySelectorAll('ul button')].find(b=>b.textContent.includes('Pusat Utama')).click()`,
  );
  await click('+ Buat nota pembelian');
  await click('Simpan draft nota');
  await waitFor(`document.body.textContent.includes('Pilih supplier.')`, 'invoice required');
  await fill('Nomor nota / faktur supplier', 'BUY-UI-1');
  await fill('Keterangan pembelian', 'TEST no real invoice');
  await click('Pilih supplier');
  await waitFor(
    `[...document.querySelectorAll('ul button')].some(b=>b.textContent.includes('TEST-SUPPLIER'))`,
    'supplier paged picker',
  );
  await evaluate(
    `[...document.querySelectorAll('ul button')].find(b=>b.textContent.includes('TEST-SUPPLIER')).click()`,
  );
  await click('+ Tambah barang pembelian');
  await click('Pilih barang pembelian');
  await waitFor(
    `[...document.querySelectorAll('ul button')].some(b=>b.textContent.includes('CUP-KOSONG'))`,
    'purchase item picker',
  );
  await evaluate(
    `[...document.querySelectorAll('ul button')].find(b=>b.textContent.includes('CUP-KOSONG')).click()`,
  );
  await fill('Jumlah beli 1 (pcs)', '10');
  await fill('Harga per pcs (Rp) 1', '5000');
  await waitFor(
    `document.body.textContent.includes('Total nota: Rp50.000')`,
    'exact total invoice',
  );
  await click('Stok & Mutasi');
  await waitFor(
    `document.body.textContent.includes('Nota pembelian belum disimpan')`,
    'invoice dirty navigation',
  );
  await click('Lanjut isi');
  await evaluate(`window.testState.networkFail=true`);
  await click('Simpan draft nota');
  await waitFor(
    `document.body.textContent.includes('Tidak dapat terhubung')`,
    'invoice network preserves',
  );
  await evaluate(`window.testState.networkFail=false`);
  await click('Simpan draft nota');
  await waitFor(`document.body.textContent.includes('Nota BUY-UI-1')`, 'invoice detail');
  await click('Konfirmasi nota');
  await waitFor(`document.querySelector('dialog[open]')`, 'invoice confirmation');
  await click('Ya, konfirmasi nota');
  await waitFor(`document.body.textContent.includes('Dikonfirmasi')`, 'invoice confirmed');
  await screenshot('purchasing-desktop-invoice');
  await click('Terima barang pembelian');
  await fill('Bukti terima / surat jalan', 'GR-UI-1');
  await fill('Catatan terima pembelian', 'TEST received partial');
  await fill('Terima Cup Kosong (pcs)', '11');
  await click('Konfirmasi terima & tambah stok');
  await waitFor(
    `document.body.textContent.includes('Melebihi sisa nota.')`,
    'invoice excess receiving',
  );
  await fill('Terima Cup Kosong (pcs)', '8');
  await click('Konfirmasi terima & tambah stok');
  await waitFor(
    `document.body.textContent.includes('Terima 8')&&document.body.textContent.includes('Diterima sebagian')`,
    'invoice partial receive',
  );
  await click('Catat pembayaran');
  await fill('Jumlah bayar (Rp)', '50001');
  await fill('Sumber dana / kas / rekening', 'TEST cash');
  await fill('Nomor bukti pembayaran', 'PAY-UI-1');
  await fill('Catatan pembayaran', 'TEST paid partial');
  await click('Konfirmasi catatan pembayaran');
  await waitFor(`document.body.textContent.includes('Melebihi sisa tagihan.')`, 'overpayment UI');
  await fill('Jumlah bayar (Rp)', '20000');
  await click('Konfirmasi catatan pembayaran');
  await waitFor(
    `document.body.textContent.includes('Rp30.000')&&document.body.textContent.includes('Dibayar sebagian')`,
    'partial payment independent',
  );
  await send('Emulation.setDeviceMetricsOverride', {
    width: 390,
    height: 844,
    deviceScaleFactor: 1,
    mobile: true,
  });
  assert.equal(
    await evaluate(`document.documentElement.scrollWidth<=innerWidth`),
    true,
    'invoice mobile no overflow',
  );
  await screenshot('purchasing-mobile-partial');
  const linkedBalance = await evaluate(`window.testState.seedExistingPurchaseReceipt()`);
  await click('Tautkan penerimaan existing');
  await click('Pilih penerimaan existing');
  await waitFor(
    `[...document.querySelectorAll('ul button')].some(b=>b.textContent.includes('EXISTING-UI-2'))`,
    'link posted stock options',
  );
  await evaluate(
    `[...document.querySelectorAll('ul button')].find(b=>b.textContent.includes('EXISTING-UI-2')).click()`,
  );
  await fill('Dasar tautan nota & penerimaan', 'TEST same original delivery');
  await click('Tautkan tanpa tambah stok');
  await waitFor(
    `document.body.textContent.includes('Diterima lengkap')&&document.body.textContent.includes('stok tidak bertambah lagi')`,
    'linked receipt no double stock',
  );
  assert.equal(
    await evaluate(`(()=>{const p=document.body.textContent;return p.includes('Rp30.000')})()`),
    true,
    'link leaves payment independently partial',
  );
  assert.equal(
    await evaluate(`window.testState.purchaseStockBalance()`),
    linkedBalance,
    'link does not add stock a second time',
  );
  await click('← Kembali ke pembelian');
  await waitFor(
    `document.querySelector('[aria-label="Cari pembelian atau supplier"]')`,
    'purchasing list',
  );
  await evaluate(`sessionStorage.setItem('smokeRole','DC_ADMIN')`);
  await send('Page.reload');
  await waitFor(
    `document.querySelector('nav') && document.body.textContent.includes('Admin DC')`,
    'restricted account session',
  );
  await click('Barang & Menu');
  await waitFor(`document.querySelector('[role=tablist]')`, 'restricted catalog');
  assert.equal(
    await evaluate(`document.body.textContent.includes('Tambah barang')`),
    false,
    'non-central account has no create action',
  );
  await click('Menu Minuman');
  assert.equal(
    await evaluate(
      `document.body.textContent.includes('Tambah menu') || document.body.textContent.includes('Tambah rasa') || document.body.textContent.includes('Buat kelompok')`,
    ),
    false,
    'non-central menu actions hidden',
  );
  await click('Pusat, DC & Stand');
  await waitFor(
    `document.querySelector('[role=tablist]')?.textContent.includes('Stand')`,
    'DC organization read access',
  );
  assert.equal(
    await evaluate(
      `document.body.textContent.includes('Tambah DC') || document.body.textContent.includes('Pemilik Usaha')`,
    ),
    false,
    'DC has no organization writes or owners tab',
  );
  await click('Resep');
  await waitFor(
    `document.body.textContent.includes('Produksi DC')&&document.body.textContent.includes('Buat resep')`,
    'DC recipe list',
  );
  await click('Buat resep');
  await waitFor(
    `document.body.textContent.includes('DC yang ditugaskan pada akunmu')`,
    'DC editor fixed scope',
  );
  assert.equal(
    await evaluate(`document.body.textContent.includes('Semua DC (diatur pusat)')`),
    false,
    'DC cannot pick global draft scope',
  );
  assert.equal(pageErrors.length, 0, `No React/browser errors: ${pageErrors.join('; ')}`);
  console.log(
    'Browser smoke passed: catalog/organization/recipes/inventory and purchasing supplier/invoice/required/dirty/network/exact totals/confirmation/partial receipts/partial payments; desktop/mobile/tablet. Mock API only, no real database writes.',
  );
} finally {
  ws?.close();
  browser.kill();
  for (const item of pending.values()) clearTimeout(item.timer);
  await delay(600);
  await rm(profile, { recursive: true, force: true, maxRetries: 6, retryDelay: 500 }).catch(
    () => {},
  );
}
