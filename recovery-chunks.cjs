const http=require('http'),fs=require('fs');
const output='dist/index-recovered.html';
http.createServer((req,res)=>{let data=[];req.on('data',c=>data.push(c));req.on('end',()=>{const body=Buffer.concat(data);if(req.url.includes('reset'))fs.writeFileSync(output,body);else fs.appendFileSync(output,body);res.end('ok');});}).listen(4175,'127.0.0.1');
