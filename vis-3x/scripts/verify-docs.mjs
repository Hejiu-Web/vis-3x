/** 文档站验证：抓取多个关键页面，检查渲染与报错 */
import { launchBrowser } from './lib/browser.mjs'
const PORT = 9510
const browser = launchBrowser({ port: PORT, windowSize: '1440,1000', tag: 'vx-docs' })
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
class CDP{constructor(ws){this.ws=ws;this.id=0;this.p=new Map();this.errs=[]
ws.addEventListener('message',e=>{const m=JSON.parse(e.data)
if(m.id&&this.p.has(m.id)){const{resolve,reject}=this.p.get(m.id);this.p.delete(m.id);m.error?reject(new Error(JSON.stringify(m.error))):resolve(m.result);return}
if(m.method==='Runtime.exceptionThrown'){this.errs.push(m.params.exceptionDetails?.exception?.description||m.params.exceptionDetails?.text)}})}
send(method,params={},t=90000){const id=++this.id;return new Promise((resolve,reject)=>{this.p.set(id,{resolve,reject});this.ws.send(JSON.stringify({id,method,params}));setTimeout(()=>{if(this.p.has(id)){this.p.delete(id);reject(new Error('timeout '+method))}},t)})}}
async function waitForEndpoint(port){for(let i=0;i<90;i++){try{const r=await fetch(`http://127.0.0.1:${port}/json/version`);if(r.ok)return}catch{}await sleep(400)}throw new Error('no cdp')}

const PAGES = [
  ['首页', '/'],
  ['简介', '/guide/introduction'],
  ['安装', '/guide/installation'],
  ['快速开始', '/guide/quick-start'],
  ['配置项结构', '/guide/option-structure'],
  ['柱状图', '/charts/bar'],
  ['曲面图', '/charts/surface'],
  ['仪表盘', '/charts/gauge'],
  ['阶梯地形', '/charts/step-terrain'],
  ['自定义概览', '/custom/'],
  ['defineChart', '/custom/define-chart'],
  ['渲染上下文', '/custom/render-context'],
  ['Option API', '/api/option'],
  ['事件列表', '/api/events'],
  ['类型定义', '/api/types'],
  ['更新日志', '/changelog'],
  ['配置速查', '/guide/cheatsheet'],
  ['架构', '/guide/architecture'],
  ['ECharts适配器', '/guide/echarts-adapter'],
  ['许可证', '/license'],
]

async function main(){
try{
await waitForEndpoint(PORT)
const tab=await fetch(`http://127.0.0.1:${PORT}/json/new?${encodeURIComponent('about:blank')}`,{method:'PUT'}).then(r=>r.json())
const ws=new WebSocket(tab.webSocketDebuggerUrl)
await new Promise((res,rej)=>{ws.addEventListener('open',res);ws.addEventListener('error',rej)})
const cdp=new CDP(ws)
await cdp.send('Runtime.enable');await cdp.send('Page.enable')
await cdp.send('Emulation.setDeviceMetricsOverride',{width:1440,height:1000,deviceScaleFactor:1,mobile:false})

console.log('=== 文档站页面验证 ===')
console.log('  页面'.padEnd(16) + 'h1 / 标题'.padEnd(34) + 'h2数  表格  代码块')
console.log('  ' + '-'.repeat(74))
let bad = 0
for (const [name, path] of PAGES) {
  await cdp.send('Page.navigate',{url:'http://localhost:5196'+path})
  await sleep(1400)
  const r = await cdp.send('Runtime.evaluate',{expression:`(() => {
    const h1 = document.querySelector('.vp-doc h1')?.textContent?.trim()
      || document.querySelector('h1')?.textContent?.trim() || '';
    return {
      h1: h1.slice(0, 30),
      h2: document.querySelectorAll('.vp-doc h2').length,
      tables: document.querySelectorAll('.vp-doc table').length,
      code: document.querySelectorAll('.vp-doc div[class*="language-"]').length,
      hasSidebar: !!document.querySelector('.VPSidebar'),
      bodyLen: document.querySelector('.vp-doc')?.textContent?.length ?? 0,
    };
  })()`,returnByValue:true})
  const v = r.result?.value ?? {}
  const ok = (v.bodyLen ?? 0) > 200
  if (!ok) bad++
  console.log('  ' + name.padEnd(16) + String(v.h1||'(空)').padEnd(30) +
    String(v.h2).padStart(4) + String(v.tables).padStart(6) + String(v.code).padStart(8) +
    (ok ? '' : '   ★ 内容过少'))
}
console.log(`\n  异常页面: ${bad}`)
if (cdp.errs.length) { console.log('\n  页面异常:'); cdp.errs.slice(0,5).forEach(e=>console.log('   - '+String(e).slice(0,200))) }
else console.log('  页面异常: 0')
ws.close()
}catch(e){console.error('FAIL',e.message);process.exitCode=1}
finally{browser.kill()}
}
main()