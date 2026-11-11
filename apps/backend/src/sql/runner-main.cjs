// Fixed container entry point. SQL is JSON data, never JavaScript or shell input.
const {parseSqlDefinition,parseSqlDataset,parseSqlSteps,sqlObject}=require('/app/content/sql.js');
const {gradeSql}=require('/app/content/sql-grading.js');
let bytes=0;const chunks=[];
process.stdin.on('data',chunk=>{bytes+=chunk.length;if(bytes>300000)process.exit(2);chunks.push(chunk);});
process.stdin.on('end',async()=>{
 try {
  const input=sqlObject(JSON.parse(Buffer.concat(chunks).toString('utf8')),['definition','dataset','steps']);
  const definition=parseSqlDefinition(input.definition), dataset=parseSqlDataset(input.dataset), steps=parseSqlSteps(input.steps);
  const passed=await gradeSql(definition,dataset,steps);
  process.stdout.write(JSON.stringify({passed}));
 } catch {process.stdout.write(JSON.stringify({error:'Não foi possível avaliar o SQL. Confira os comandos e os limites.'}));process.exitCode=2;}
});
