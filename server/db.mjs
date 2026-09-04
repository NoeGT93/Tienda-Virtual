import {DatabaseSync} from 'node:sqlite';
import {mkdirSync,readFileSync} from 'node:fs';
import {dirname,resolve} from 'node:path';
export const path=resolve(process.env.DATABASE_PATH||'data/lulos.sqlite');mkdirSync(dirname(path),{recursive:true});
export const db=new DatabaseSync(path);db.exec(`PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;
CREATE TABLE IF NOT EXISTS users(id TEXT PRIMARY KEY,email TEXT NOT NULL UNIQUE,name TEXT NOT NULL,password TEXT NOT NULL,role TEXT NOT NULL CHECK(role IN ('CUSTOMER','ADMIN')),phone TEXT NOT NULL DEFAULT '',created TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS sessions(id TEXT PRIMARY KEY,user_id TEXT REFERENCES users(id) ON DELETE CASCADE,csrf TEXT NOT NULL,expires INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS products(id TEXT PRIMARY KEY,name TEXT NOT NULL,description TEXT NOT NULL,category TEXT NOT NULL,gender TEXT NOT NULL,color TEXT NOT NULL,price INTEGER NOT NULL CHECK(price>=0),old_price INTEGER,cell INTEGER NOT NULL DEFAULT 1,image TEXT,active INTEGER NOT NULL DEFAULT 1,created TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS variants(id TEXT PRIMARY KEY,product_id TEXT NOT NULL REFERENCES products(id),size TEXT NOT NULL,sku TEXT NOT NULL UNIQUE,stock INTEGER NOT NULL DEFAULT 0 CHECK(stock>=0),UNIQUE(product_id,size));
CREATE TABLE IF NOT EXISTS inventory_movements(id TEXT PRIMARY KEY,variant_id TEXT NOT NULL REFERENCES variants(id),delta INTEGER NOT NULL,reason TEXT NOT NULL,actor TEXT REFERENCES users(id),created TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS mannequins(id TEXT PRIMARY KEY,name TEXT NOT NULL,gender TEXT NOT NULL,image TEXT NOT NULL,active INTEGER NOT NULL DEFAULT 1,sort INTEGER NOT NULL DEFAULT 0);
CREATE TABLE IF NOT EXISTS garment_assets(product_id TEXT NOT NULL REFERENCES products(id),mannequin_id TEXT NOT NULL REFERENCES mannequins(id),x REAL NOT NULL,y REAL NOT NULL,width REAL NOT NULL,height REAL NOT NULL,rotation REAL NOT NULL DEFAULT 0,z INTEGER NOT NULL DEFAULT 10,image TEXT,PRIMARY KEY(product_id,mannequin_id));
CREATE TABLE IF NOT EXISTS addresses(id TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,street TEXT NOT NULL,city TEXT NOT NULL,region TEXT NOT NULL,reference TEXT NOT NULL DEFAULT '');
CREATE TABLE IF NOT EXISTS outfits(id TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,name TEXT NOT NULL,mannequin_id TEXT NOT NULL,items TEXT NOT NULL,share_id TEXT UNIQUE,created TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS favorites(user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,product_id TEXT NOT NULL REFERENCES products(id),PRIMARY KEY(user_id,product_id));
CREATE TABLE IF NOT EXISTS promotions(id TEXT PRIMARY KEY,code TEXT NOT NULL UNIQUE,percent INTEGER NOT NULL CHECK(percent BETWEEN 1 AND 100),minimum INTEGER NOT NULL DEFAULT 0,max_uses INTEGER NOT NULL DEFAULT 100,uses INTEGER NOT NULL DEFAULT 0,expires TEXT NOT NULL,active INTEGER NOT NULL DEFAULT 1);
CREATE TABLE IF NOT EXISTS orders(id TEXT PRIMARY KEY,user_id TEXT REFERENCES users(id),guest_session TEXT NOT NULL,idempotency TEXT NOT NULL UNIQUE,name TEXT NOT NULL,email TEXT NOT NULL,phone TEXT NOT NULL,address TEXT NOT NULL,delivery TEXT NOT NULL,payment_method TEXT NOT NULL,status TEXT NOT NULL,subtotal INTEGER NOT NULL,discount INTEGER NOT NULL,shipping INTEGER NOT NULL,total INTEGER NOT NULL,promotion_id TEXT REFERENCES promotions(id),created TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS order_items(id TEXT PRIMARY KEY,order_id TEXT NOT NULL REFERENCES orders(id),variant_id TEXT NOT NULL REFERENCES variants(id),name TEXT NOT NULL,size TEXT NOT NULL,price INTEGER NOT NULL,quantity INTEGER NOT NULL CHECK(quantity>0));
CREATE TABLE IF NOT EXISTS order_history(id TEXT PRIMARY KEY,order_id TEXT NOT NULL REFERENCES orders(id),status TEXT NOT NULL,note TEXT NOT NULL,actor TEXT REFERENCES users(id),created TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS payments(order_id TEXT PRIMARY KEY REFERENCES orders(id),status TEXT NOT NULL DEFAULT 'PENDING',reference TEXT NOT NULL DEFAULT '',recorded_by TEXT REFERENCES users(id));
CREATE TABLE IF NOT EXISTS shipments(order_id TEXT PRIMARY KEY REFERENCES orders(id),carrier TEXT NOT NULL,tracking TEXT NOT NULL,updated TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS reviews(id TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES users(id),product_id TEXT NOT NULL REFERENCES products(id),rating INTEGER NOT NULL CHECK(rating BETWEEN 1 AND 5),body TEXT NOT NULL,created TEXT NOT NULL,UNIQUE(user_id,product_id));
CREATE TABLE IF NOT EXISTS events(id TEXT PRIMARY KEY,session_id TEXT NOT NULL,type TEXT NOT NULL,product_id TEXT,created TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS settings(id INTEGER PRIMARY KEY CHECK(id=1),shipping INTEGER NOT NULL DEFAULT 3500,free_over INTEGER NOT NULL DEFAULT 0,bank_instructions TEXT NOT NULL DEFAULT '',cod INTEGER NOT NULL DEFAULT 0,store_name TEXT NOT NULL DEFAULT 'Lulos Fashion Xela',address TEXT NOT NULL DEFAULT '',phone TEXT NOT NULL DEFAULT '',checkout_enabled INTEGER NOT NULL DEFAULT 0);
INSERT OR IGNORE INTO settings(id) VALUES(1);
CREATE INDEX IF NOT EXISTS orders_user ON orders(user_id,created); CREATE INDEX IF NOT EXISTS movements_variant ON inventory_movements(variant_id,created); CREATE INDEX IF NOT EXISTS events_type ON events(type,created); CREATE INDEX IF NOT EXISTS sessions_expiry ON sessions(expires);
`);
export const all=(sql,...args)=>db.prepare(sql).all(...args);export const one=(sql,...args)=>db.prepare(sql).get(...args);export const run=(sql,...args)=>db.prepare(sql).run(...args);
export function transaction(fn){db.exec('BEGIN IMMEDIATE');try{const result=fn();db.exec('COMMIT');return result}catch(error){db.exec('ROLLBACK');throw error}}
if(!one('SELECT id FROM products LIMIT 1')){
 const seed=JSON.parse(readFileSync(new URL('./seed.json',import.meta.url),'utf8'));
 transaction(()=>{for(const p of seed){run('INSERT INTO products(id,name,description,category,gender,color,price,old_price,cell,created) VALUES(?,?,?,?,?,?,?,?,?,?)',p.id,p.name,p.description,p.category,p.gender,p.color,Math.round(p.price*100),p.oldPrice?Math.round(p.oldPrice*100):null,p.cell,new Date().toISOString());for(const size of p.sizes)run('INSERT INTO variants VALUES(?,?,?,?,?)',`${p.id}-${size}`,p.id,size,`${p.id}-${size}`,0)}
 for(const [id,name,gender,image] of [['female','Dama · estándar','Damas','/assets/mannequin-female.png'],['male','Caballero · estándar','Caballeros','/assets/mannequin-male.png']])run('INSERT INTO mannequins(id,name,gender,image) VALUES(?,?,?,?)',id,name,gender,image);
 });
}
