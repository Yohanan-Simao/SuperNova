const http=require('http'),fs=require('fs');
http.createServer((req,res)=>{let data=[];req.on('data',c=>data.push(c));req.on('end',()=>{fs.writeFileSync('dist/index-recovered.html',Buffer.concat(data));res.end('ok');process.exit(0);});}).listen(4174,'127.0.0.1');
