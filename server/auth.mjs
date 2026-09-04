import {scryptSync,randomBytes,timingSafeEqual,createHash} from 'node:crypto';
import {one,run} from './db.mjs';
export const token=()=>randomBytes(32).toString('hex');export const hash=value=>createHash('sha256').update(value).digest('hex');
export function passwordHash(value){const salt=randomBytes(16).toString('hex');return `${salt}:${scryptSync(value,salt,64).toString('hex')}`}
export function verifyPassword(value,stored){const [salt,digest]=stored.split(':');return timingSafeEqual(scryptSync(value,salt,64),Buffer.from(digest,'hex'))}
export function session(req,res){const raw=(req.headers.cookie||'').split(';').map(v=>v.trim()).find(v=>v.startsWith('lulos_session='))?.slice(14);let s=raw?one('SELECT * FROM sessions WHERE id=? AND expires>?',hash(raw),Date.now()):null;if(!s){const key=token();s={id:hash(key),user_id:null,csrf:token(),expires:Date.now()+86400000};run('INSERT INTO sessions VALUES(?,?,?,?)',s.id,null,s.csrf,s.expires);res.setHeader('Set-Cookie',`lulos_session=${key}; HttpOnly; SameSite=Lax; Path=/; Max-Age=86400${process.env.NODE_ENV==='production'?'; Secure':''}`)}return s}
export function rotate(s,userId,res){run('DELETE FROM sessions WHERE id=?',s.id);const key=token(),csrf=token();run('INSERT INTO sessions VALUES(?,?,?,?)',hash(key),userId,csrf,Date.now()+86400000);res.setHeader('Set-Cookie',`lulos_session=${key}; HttpOnly; SameSite=Lax; Path=/; Max-Age=86400${process.env.NODE_ENV==='production'?'; Secure':''}`);return csrf}
export const publicUser=id=>id?one('SELECT id,name,email,phone,role FROM users WHERE id=?',id):null;
