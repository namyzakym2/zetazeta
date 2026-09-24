const mysql = require('mysql2/promise');
const crypto = require('crypto');

let pool = null;
let connected = false;
const models = new Map();

function now() { return new Date(); }
function clone(v) {
  if (v instanceof Date) return new Date(v.getTime());
  if (v instanceof Map) return Object.fromEntries(v.entries());
  if (Array.isArray(v)) return v.map(clone);
  if (v && typeof v === 'object') return Object.fromEntries(Object.entries(v).map(([k,x]) => [k, clone(x)]));
  return v;
}
function id() { return crypto.randomBytes(12).toString('hex'); }

class Schema {
  constructor(definition = {}, options = {}) { this.definition = definition; this.options = options; this.indexesList = []; }
  index(fields, options) { this.indexesList.push([fields, options]); return this; }
}
Schema.Types = { ObjectId: String, Map: Map, Mixed: Object };

function defaultValue(def) {
  if (!def) return undefined;
  if (Array.isArray(def)) return [];
  if (def instanceof Schema) return {};
  if (typeof def === 'object' && !def.type) {
    const out = {};
    for (const [k,v] of Object.entries(def)) {
      const d = defaultValue(v); if (d !== undefined) out[k] = d;
    }
    return Object.keys(out).length ? out : undefined;
  }
  if (typeof def === 'object' && def.default !== undefined) {
    const d = def.default;
    return typeof d === 'function' ? d() : clone(d);
  }
  return undefined;
}

// ---------------------------------------------------------------------------
// Mongoose-style sub-documents.
//
// The whole code base (bot systems + dashboard routes) was written against
// Mongoose, so it expects:
//   - nested schemas declared as `{ type: SubSchema, default: () => ({}) }` to come
//     back with ALL of their field defaults applied (guildDoc.ticketSettings.claimButton
//     === true, guildDoc.ticketSettings.buttons === []),
//   - arrays of sub-documents to have `.id(x)` / `.pull(x)`, and to give every pushed
//     item its own `_id`,
//   - sub-documents to have `.toObject()`.
// This layer used to only handle the bare `SubSchema` / `[SubSchema]` forms, so every
// nested schema declared with the `{ type: ... }` wrapper (ticketSettings, automod,
// logSettings, staffPoints, ...) silently came back as an empty `{}`.
// ---------------------------------------------------------------------------

// Classifies one field definition from a schema.
function fieldKind(v) {
  if (v instanceof Schema) return { kind: 'subdoc', schema: v, wrapper: null };
  if (Array.isArray(v)) return { kind: 'array', of: v[0], wrapper: null };
  if (v && typeof v === 'object' && !(v instanceof Date)) {
    const t = v.type;
    if (t instanceof Schema) return { kind: 'subdoc', schema: t, wrapper: v };
    if (Array.isArray(t)) return { kind: 'array', of: t[0], wrapper: v };
    if (t === undefined || (t && typeof t === 'object')) return { kind: 'nested', definition: v };
  }
  return { kind: 'leaf', def: v };
}

function stableId(seed) { return crypto.createHash('sha1').update(String(seed)).digest('hex').slice(0, 24); }

function sameId(a, b) { return a != null && b != null && String(a) === String(b); }

// Mongoose's `array.pull(idOrValue)` — removes IN PLACE (callers hold a reference to the array).
function pullFromArray(arr, values) {
  for (const value of values) {
    const key = value && typeof value === 'object' ? (value._id ?? value) : value;
    for (let i = arr.length - 1; i >= 0; i--) {
      const item = arr[i];
      const hit = item && typeof item === 'object' ? sameId(item._id, key) : eq(item, value);
      if (hit) Array.prototype.splice.call(arr, i, 1);
    }
  }
  return arr;
}

console.log('🗄️  mysqlCompat v20 loaded (nested defaults + array helpers active)');

// ---------------------------------------------------------------------------
// Performance helpers
// ---------------------------------------------------------------------------
// The bot and the dashboard share ONE Node process and one 5-connection MySQL pool. Almost every
// message the bot sees re-reads the (large) Guild settings document several times (automod,
// auto-responder, shortcuts, ...), and each read used to be a full-table SELECT. That queued up
// behind/in front of dashboard requests and made login + every dashboard page crawl.
//
//  * Guild / BotGuild single-document reads are cached for a few seconds. Every write that goes
//    through this layer (INSERT/UPDATE/DELETE) clears the cache instantly, and readers always get
//    their OWN copy, so a mutated document can never leak into another caller.
//  * Reads slower than SLOW_MS are logged so we can see exactly which query is the problem.
const SLOW_MS = 400;
const CACHE_TTL_MS = 5000;
const CACHEABLE_MODELS = new Set(['Guild', 'BotGuild']);
const readCache = new Map();          // `${model}|${filterJSON}` -> { at, doc }
let writeVersion = 0;                 // bumped by every write; stops stale in-flight reads from being cached
const lastSlowLog = new Map();

function touched() { writeVersion++; readCache.clear(); }
function cacheGet(key) {
  const hit = readCache.get(key);
  if (!hit) return null;
  if (Date.now() - hit.at > CACHE_TTL_MS) { readCache.delete(key); return null; }
  return clone(hit.doc);
}
function cacheSet(key, doc) {
  if (readCache.size > 200) readCache.clear();
  readCache.set(key, { at: Date.now(), doc: clone(doc) });
}
function noteSlow(model, ms, rows, filter) {
  const last = lastSlowLog.get(model) || 0;
  if (Date.now() - last < 10_000) return;      // at most one line per model per 10s
  lastSlowLog.set(model, Date.now());
  console.warn(`🐢 slow DB read: ${model} took ${ms}ms (${rows} rows, filter ${JSON.stringify(filter || {}).slice(0, 120)})`);
}

const hidden = (fn) => ({ value: fn, enumerable: false, configurable: true, writable: true });

// Adds the Mongoose array helpers as NON-enumerable properties, so they never leak into
// JSON.stringify()/clone()/Object.entries() (i.e. never into what is stored in MySQL).
function decorateArray(arr, subSchema) {
  Object.defineProperties(arr, {
    pull: hidden(function pull(...values) { return pullFromArray(this, values); }),
    id: hidden(function id(x) { return this.find((d) => d && typeof d === 'object' && sameId(d._id, x)) || null; })
  });
  if (subSchema) {
    Object.defineProperty(arr, 'push', hidden(function push(...items) {
      return Array.prototype.push.apply(this, items.map((item) => applyDefaults(item || {}, subSchema)));
    }));
  }
  return arr;
}

function decorateSubdoc(obj) {
  Object.defineProperty(obj, 'toObject', hidden(function toObject() { return clone(this); }));
  return obj;
}

function applyDefaults(doc, schema, opts = {}) {
  const out = clone(doc || {});
  const def = schema?.definition || {};

  for (const [k, v] of Object.entries(def)) {
    const f = fieldKind(v);
    const current = out[k];

    // Nested schema (sub-document): bare `SubSchema`, or `{ type: SubSchema, default }`.
    if (f.kind === 'subdoc') {
      let base = current;
      if (base === undefined || base === null) {
        base = f.wrapper && f.wrapper.default !== undefined
          ? (typeof f.wrapper.default === 'function' ? f.wrapper.default() : clone(f.wrapper.default))
          : (f.wrapper ? undefined : {});
      }
      if (base !== undefined && base !== null) out[k] = decorateSubdoc(applyDefaults(base, f.schema, { noId: true }));
      continue;
    }

    // Arrays: `[SubSchema]`, `{ type: [SubSchema] }`, `[String]`, `{ type: [String] }`.
    if (f.kind === 'array') {
      let arr = current;
      if (arr === undefined || arr === null) {
        const d = f.wrapper?.default;
        arr = d === undefined ? [] : (typeof d === 'function' ? d() : clone(d));
      }
      if (!Array.isArray(arr)) { out[k] = arr; continue; }
      if (f.of instanceof Schema) {
        arr = arr.map((item, i) => {
          const src = item && typeof item === 'object' ? item : {};
          // Items stored before they had an _id get a DETERMINISTIC one, so the id is the
          // same on every load (a random one would change each time and break button ids).
          const idSeed = src._id ? undefined : `${k}:${i}:${JSON.stringify(src)}`;
          return applyDefaults(src, f.of, { idSeed });
        });
      }
      out[k] = decorateArray(arr.slice(), f.of instanceof Schema ? f.of : null);
      continue;
    }

    // Plain nested object of fields (no `type` key).
    if (f.kind === 'nested') {
      out[k] = decorateSubdoc(applyDefaults(current || {}, { definition: f.definition, options: { _id: false } }, { noId: true }));
      continue;
    }

    if (current === undefined) {
      const d = defaultValue(v);
      if (d !== undefined) out[k] = d;
    }
  }

  if (!out._id && !opts.noId && schema?.options?._id !== false) out._id = opts.idSeed ? stableId(opts.idSeed) : id();
  if (schema?.options?.timestamps) {
    const createdKey = schema.options.timestamps.createdAt === false ? null : (typeof schema.options.timestamps.createdAt === 'string' ? schema.options.timestamps.createdAt : 'createdAt');
    const updatedKey = schema.options.timestamps.updatedAt === false ? null : (typeof schema.options.timestamps.updatedAt === 'string' ? schema.options.timestamps.updatedAt : 'updatedAt');
    if (createdKey && !out[createdKey]) out[createdKey] = now();
    if (updatedKey) out[updatedKey] = now();
  }
  return out;
}

function getPath(obj, path) { return path.split('.').reduce((a,k)=>a==null?undefined:a[k], obj); }
function setPath(obj, path, value) { const p=path.split('.'); let cur=obj; for(let i=0;i<p.length-1;i++){ if(!cur[p[i]]||typeof cur[p[i]]!=='object') cur[p[i]]={}; cur=cur[p[i]]; } cur[p[p.length-1]]=value; }
function delPath(obj,path){ const p=path.split('.'); let cur=obj; for(let i=0;i<p.length-1;i++){cur=cur?.[p[i]]; if(!cur) return;} delete cur[p[p.length-1]]; }
function eq(a,b){ if(a instanceof Date || b instanceof Date) return new Date(a).getTime()===new Date(b).getTime(); return JSON.stringify(a)===JSON.stringify(b); }
function matchValue(value, cond) {
  if (cond instanceof RegExp) return cond.test(String(value ?? ''));
  if (cond && typeof cond === 'object' && !Array.isArray(cond) && !(cond instanceof Date)) {
    for (const [op,x] of Object.entries(cond)) {
      if (op === '$in' && !x.some(v=>eq(value,v))) return false;
      if (op === '$nin' && x.some(v=>eq(value,v))) return false;
      if (op === '$ne' && eq(value,x)) return false;
      if (op === '$exists' && ((value !== undefined) !== !!x)) return false;
      if (op === '$gte' && !(value >= x)) return false;
      if (op === '$gt' && !(value > x)) return false;
      if (op === '$lte' && !(value <= x)) return false;
      if (op === '$lt' && !(value < x)) return false;
      if (op === '$regex' && !(new RegExp(x, cond.$options || '')).test(String(value ?? ''))) return false;
      if (op === '$elemMatch' && !(Array.isArray(value) && value.some(v=>matches(v,x)))) return false;
    }
    return true;
  }
  if (Array.isArray(value)) return value.some(v=>eq(v,cond)) || eq(value,cond);
  return eq(value, cond);
}
function matches(doc, filter={}) {
  for (const [k,c] of Object.entries(filter)) {
    if (k === '$or') { if (!c.some(f=>matches(doc,f))) return false; continue; }
    if (k === '$and') { if (!c.every(f=>matches(doc,f))) return false; continue; }
    if (!matchValue(getPath(doc,k),c)) return false;
  }
  return true;
}
function applyUpdate(doc, update, isInsert=false) {
  const out = clone(doc);
  const hasOps = Object.keys(update||{}).some(k=>k.startsWith('$'));
  if (!hasOps) Object.assign(out, clone(update));
  for (const [op, fields] of Object.entries(update||{})) {
    if (!op.startsWith('$')) continue;
    for (const [path,value] of Object.entries(fields||{})) {
      const cur=getPath(out,path);
      if(op==='$set') setPath(out,path,clone(value));
      else if(op==='$setOnInsert' && isInsert) setPath(out,path,clone(value));
      else if(op==='$inc') setPath(out,path,(Number(cur)||0)+Number(value));
      else if(op==='$unset') delPath(out,path);
      else if(op==='$push') { const arr=Array.isArray(cur)?cur.slice():[]; if(value&&typeof value==='object'&&Array.isArray(value.$each)) arr.push(...clone(value.$each)); else arr.push(clone(value)); setPath(out,path,arr); }
      else if(op==='$addToSet') { const arr=Array.isArray(cur)?cur.slice():[]; const vals=value&&Array.isArray(value.$each)?value.$each:[value]; for(const v of vals) if(!arr.some(x=>eq(x,v))) arr.push(clone(v)); setPath(out,path,arr); }
      else if(op==='$pull') { const arr=Array.isArray(cur)?cur.slice():[]; setPath(out,path,arr.filter(x=>!matchValue(x,value))); }
    }
  }
  return out;
}

class Query {
  constructor(run){ this._run=run; this._sort=null; this._limit=null; this._skip=0; this._select=null; }
  sort(s){this._sort=s;return this;} limit(n){this._limit=n;return this;} skip(n){this._skip=n;return this;}
  select(s){this._select=s;return this;} lean(){return this;} exec(){return this._run(this);} then(a,b){return this.exec().then(a,b);} catch(b){return this.exec().catch(b);}
}

async function ensurePool() {
  if (pool) return pool;
  // Prefer explicit Bot-Hosting MYSQL_* variables. Some hosts inject a default
  // MYSQL_URL pointing at 127.0.0.1:3306; that must not override the database
  // credentials in the project's .env.
  if (process.env.MYSQL_HOST && process.env.MYSQL_USER && process.env.MYSQL_DATABASE) {
    pool = mysql.createPool({
      host: process.env.MYSQL_HOST,
      port: Number(process.env.MYSQL_PORT || 3306),
      user: process.env.MYSQL_USER,
      password: process.env.MYSQL_PASSWORD || '',
      database: process.env.MYSQL_DATABASE,
      waitForConnections: true,
      connectionLimit: 5,
      charset: 'utf8mb4'
    });
  } else if (process.env.MYSQL_URL) {
    pool = mysql.createPool(process.env.MYSQL_URL);
  } else {
    throw new Error('Missing MYSQL_URL (or MYSQL_HOST/MYSQL_USER/MYSQL_DATABASE) in .env');
  }
  console.log(`🔌 MySQL target: ${process.env.MYSQL_HOST || 'URL-configured'}:${process.env.MYSQL_PORT || 3306}/${process.env.MYSQL_DATABASE || 'URL-configured'}`);
  const rawQuery = pool.query.bind(pool);
  pool.query = async (sql, params) => {
    const result = await rawQuery(sql, params);
    if (/^\s*(UPDATE|INSERT|DELETE|REPLACE)/i.test(sql)) touched();
    return result;
  };
  await pool.query(`CREATE TABLE IF NOT EXISTS zeta_documents (model_name VARCHAR(80) NOT NULL, doc_id VARCHAR(64) NOT NULL, data JSON NOT NULL, created_at DATETIME(3) NOT NULL, updated_at DATETIME(3) NOT NULL, PRIMARY KEY(model_name, doc_id), INDEX idx_model_created(model_name, created_at), INDEX idx_model_updated(model_name, updated_at)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
  connected=true;
  return pool;
}
function project(doc, select){ if(!select) return doc; const fields=String(select).split(/\s+/).filter(Boolean); const include=fields.filter(x=>!x.startsWith('-')); if(include.length){const o={}; for(const f of include){const v=getPath(doc,f); if(v!==undefined)setPath(o,f,v);} if(!fields.includes('-_id')) o._id=doc._id; return o;} const o=clone(doc); for(const f of fields.filter(x=>x.startsWith('-'))) delPath(o,f.slice(1)); return o; }

function makeModel(name, schema){
  class Model {
    constructor(data={}) { Object.assign(this, applyDefaults(data,schema)); }
    toObject(){ return clone(this); }
    toJSON(){ return this.toObject(); }
    async save(){ await ensurePool(); const p=process.env; const t=now(); const data=this.toObject(); if(schema?.options?.timestamps){ if(!data.createdAt)data.createdAt=t; data.updatedAt=t; } const [rows]=await pool.query('SELECT doc_id FROM zeta_documents WHERE model_name=? AND doc_id=?',[name,String(data._id)]); if(rows.length) await pool.query('UPDATE zeta_documents SET data=?, updated_at=? WHERE model_name=? AND doc_id=?',[JSON.stringify(data),t,name,String(data._id)]); else await pool.query('INSERT INTO zeta_documents(model_name,doc_id,data,created_at,updated_at) VALUES(?,?,?,?,?)',[name,String(data._id),JSON.stringify(data),data.createdAt||t,t]); const fresh=applyDefaults(data,schema); if(schema?.options?.timestamps){fresh.createdAt=data.createdAt; fresh.updatedAt=data.updatedAt;} Object.assign(this,fresh); return this; }
  }
  // Every query used to SELECT *every* document of the model (all servers, all users) over the
  // network, JSON.parse them all on the bot's single thread, and only then filter in JS. With a
  // few thousand User/Transaction docs that made each dashboard request (and each message the bot
  // tracks) slow. Plain-string equality filters on String fields (guildId, userId, status, ...) are
  // now also applied inside MySQL. It is only a PRE-filter: the exact JS matches() still runs on the
  // result, so it can return extra rows but never miss any. On any SQL error we fall back to the old
  // full read (and remember, so we don't retry a query the server doesn't support).
  function sqlPrefilter(filter) {
    const clauses = [], params = [];
    for (const [k, c] of Object.entries(filter || {})) {
      if (typeof c !== 'string' || !/^[A-Za-z_][A-Za-z0-9_]*$/.test(k)) continue;
      const d = schema?.definition?.[k];
      const isString = d === String || (d && typeof d === 'object' && !Array.isArray(d) && d.type === String);
      if (!isString) continue;
      clauses.push(`JSON_UNQUOTE(JSON_EXTRACT(data, '$.${k}')) = ?`);
      params.push(c);
    }
    return { clauses, params };
  }
  let prefilterBroken = false;
  async function all(filter){
    const t0 = Date.now();
    const rows = await allRaw(filter);
    const ms = Date.now() - t0;
    if (ms >= SLOW_MS) noteSlow(name, ms, rows.length, filter);
    return rows;
  }
  async function allRaw(filter){
    await ensurePool();
    const parse = (rows) => rows.map(r=>typeof r.data==='string'?JSON.parse(r.data):r.data);
    const { clauses, params } = prefilterBroken ? { clauses: [], params: [] } : sqlPrefilter(filter);
    if (clauses.length) {
      try {
        const [rows] = await pool.query(`SELECT data FROM zeta_documents WHERE model_name=? AND ${clauses.join(' AND ')}`, [name, ...params]);
        return parse(rows);
      } catch (err) {
        prefilterBroken = true;
        console.warn(`⚠️ MySQL JSON pre-filter unavailable (${err.message}); using full reads instead.`);
      }
    }
    const [rows]=await pool.query('SELECT data FROM zeta_documents WHERE model_name=?',[name]);
    return parse(rows);
  }
  function qFind(filter={}, one=false, deleter=false){ return new Query(async q=>{ const cacheable = one && !deleter && CACHEABLE_MODELS.has(name) && !q._sort && !q._skip && q._limit==null && !q._select; const cacheKey = cacheable ? name+'|'+JSON.stringify(filter||{}) : null; let docs = cacheable ? (()=>{ const hit=cacheGet(cacheKey); return hit?[hit]:null; })() : null; if(!docs){ const ver=writeVersion; docs=(await all(filter)).filter(d=>matches(d,filter)); if(cacheable && docs[0] && ver===writeVersion) cacheSet(cacheKey, docs[0]); } if(q._sort){ const entries=Object.entries(q._sort); docs.sort((a,b)=>{for(const [k,dir] of entries){const av=getPath(a,k),bv=getPath(b,k); if(eq(av,bv))continue; return (av>bv?1:-1)*(dir<0?-1:1);} return 0;}); } if(q._skip)docs=docs.slice(q._skip); if(q._limit!=null)docs=docs.slice(0,q._limit); if(deleter){if(!docs.length)return null; const target=docs[0]; await pool.query('DELETE FROM zeta_documents WHERE model_name=? AND doc_id=?',[name,String(target._id)]); return target;} if(one)docs=docs.slice(0,1); docs=docs.map(d=>project(d,q._select)); const hydrated=docs.map(d=>new Model(d)); return one?(hydrated[0]||null):hydrated; }); }
  Model.create = async data => { const m=new Model(data); return m.save(); };
  Model.find = filter => qFind(filter,false);
  Model.findOne = filter => qFind(filter,true);
  Model.findById = idv => qFind({_id:String(idv)},true);
  Model.findOneAndDelete = filter => qFind(filter,true,true);
  Model.deleteOne = async filter => { const x=await qFind(filter,true,true).exec(); return {deletedCount:x?1:0}; };
  Model.deleteMany = async filter => { const docs=await qFind(filter,false).exec(); if(docs.length) await pool.query(`DELETE FROM zeta_documents WHERE model_name=? AND doc_id IN (${docs.map(()=>'?').join(',')})`,[name,...docs.map(d=>String(d._id))]); return {deletedCount:docs.length}; };
  Model.countDocuments = async filter => (await all(filter)).filter(d=>matches(d,filter||{})).length;
  Model.exists = async filter => (await qFind(filter,true).exec()) ? {_id:true}:null;
  Model.updateOne = async (filter,update,opts={}) => { const existing=await qFind(filter,true).exec(); if(existing){ const next=applyUpdate(existing,update,false); next.updatedAt=now(); await pool.query('UPDATE zeta_documents SET data=?,updated_at=? WHERE model_name=? AND doc_id=?',[JSON.stringify(next),next.updatedAt,name,String(next._id)]); return {matchedCount:1,modifiedCount:1}; } if(opts.upsert){const base={...filter}; const next=applyDefaults(applyUpdate(base,update,true),schema); const m=new Model(next); await m.save(); return {matchedCount:0,modifiedCount:0,upsertedId:m._id};} return {matchedCount:0,modifiedCount:0}; };
  Model.updateMany = async (filter,update) => { const docs=await qFind(filter,false).exec(); for(const d of docs){const next=applyUpdate(d,update,false);next.updatedAt=now();await pool.query('UPDATE zeta_documents SET data=?,updated_at=? WHERE model_name=? AND doc_id=?',[JSON.stringify(next),next.updatedAt,name,String(next._id)]);} return {matchedCount:docs.length,modifiedCount:docs.length}; };
  Model.findOneAndUpdate = (filter,update,opts={}) => new Query(async()=>{ const existing=await qFind(filter,true).exec(); if(existing){const next=applyUpdate(existing,update,false); if(schema?.options?.timestamps)next.updatedAt=now(); await pool.query('UPDATE zeta_documents SET data=?,updated_at=? WHERE model_name=? AND doc_id=?',[JSON.stringify(next),next.updatedAt||now(),name,String(next._id)]); return new Model(opts.new===false?existing:next);} if(opts.upsert){const next=applyDefaults(applyUpdate({...filter},update,true),schema);const m=new Model(next);await m.save();return opts.new===false?null:m;} return null;});
  Model.syncIndexes = async()=>{};
  return Model;
}

function model(name,schema){ if(models.has(name))return models.get(name); const M=makeModel(name,schema); models.set(name,M); return M; }
async function connect(){ await ensurePool(); }
async function disconnect(){ if(pool){await pool.end();pool=null;connected=false;} }
const connection={get readyState(){return connected?1:0;}};
function modelNames(){return [...models.keys()];}
const Types={ObjectId: class ObjectId extends String { constructor(v){super(String(v||id()));} }};
module.exports={Schema,model,connect,disconnect,connection,modelNames,Types};
