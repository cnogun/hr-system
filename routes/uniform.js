const express=require('express');
const router=express.Router();
const Employee=require('../models/Employee');
const User=require('../models/User');
const ExcelJS=require('exceljs');

const ITEMS=[
 {key:'cap',qty:'capQty',name:'모자',sizes:['별대','특대','대','중','소']},
 {key:'uniformSummerTop',qty:'uniformSummerTopQty',name:'하복 상의',sizes:['3별대','2별대','별대','특대','대','중']},
 {key:'uniformSummerBottom',qty:'uniformSummerBottomQty',name:'하복 하의',sizes:['38','36','35','34','33','32','31','30']},
 {key:'uniformWinterTop',qty:'uniformWinterTopQty',name:'동복 상의',sizes:['3별대','2별대','별대','특대','대','중']},
 {key:'uniformWinterBottom',qty:'uniformWinterBottomQty',name:'동복 하의',sizes:['38','36','35','34','33','32','31','30']},
 {key:'uniformWinterPants',qty:'uniformWinterPantsQty',name:'방한하의',sizes:['38','36','35','34','33','32','31','30']},
 {key:'springAutumnUniform',qty:'springAutumnUniformQty',name:'춘추복',sizes:['3별대','2별대','별대','특대','대','중']},
 {key:'uniformWinterCoat',qty:'uniformWinterCoatQty',name:'방한외투',sizes:['3별대','2별대','별대','특대','대','중']},
 {key:'winterJacket',qty:'winterJacketQty',name:'동점퍼',sizes:['3별대','2별대','별대','특대','대','중']},
 {key:'doubleJacket',qty:'doubleJacketQty',name:'겹점퍼',sizes:['3별대','2별대','별대','특대','대','중']},
 {key:'raincoat',qty:'raincoatQty',name:'우의',sizes:['3별대','2별대','별대','특대','대','중']},
 {key:'safetyShoes',qty:'safetyShoesQty',name:'안전화',sizes:['290','285','280','275','270','265','260','255','250']},
 {key:'rainBoots',qty:'rainBootsQty',name:'장화',sizes:['290','285','280','275','270','265','260','255','250']}
];
function requireLogin(req,res,next){if(!req.session||!req.session.userId)return res.redirect('/auth/login');next();}
async function loadViewer(req,res,next){try{req.viewer=await User.findById(req.session.userId).select('role');if(!req.viewer)return res.status(403).send('권한이 없습니다.');next();}catch(e){next(e);}}
function requireAdmin(req,res,next){if(!req.viewer||req.viewer.role!=='admin')return res.status(403).send('관리자만 접근 가능합니다.');next();}
function takeMessage(req){const value=req.session.message;delete req.session.message;return value;}
function buildStats(employees){const rows=[];ITEMS.forEach(item=>item.sizes.forEach(size=>{const requested=employees.reduce((sum,e)=>sum+(e[item.key]===size?(Number(e[item.qty])||0):0),0);const issued=employees.reduce((sum,e)=>sum+(e.uniformIssues||[]).filter(h=>h.itemKey===item.key&&h.size===size).reduce((n,h)=>n+(Number(h.quantity)||0),0),0);if(requested||issued)rows.push({item:item.name,size,requested,issued,quantity:Math.max(0,requested-issued)});}));return rows;}

router.get('/',requireLogin,loadViewer,async(req,res,next)=>{try{
 if(req.viewer.role==='admin'){
  const q=String(req.query.q||'').trim(),department=String(req.query.department||'').trim(),completion=String(req.query.completion||'').trim(),filter={};
  if(q)filter.$or=[{name:{$regex:q,$options:'i'}},{empNo:{$regex:q,$options:'i'}}];
  if(department)filter.department=department;
  const [employees,departments]=await Promise.all([Employee.find(filter).sort({department:1,name:1}),Employee.distinct('department',{department:{$nin:[null,'']}})]);
  const visibleEmployees=completion?employees.filter(e=>(ITEMS.every(i=>Boolean(e[i.key])))===(completion==='complete')):employees;
  return res.render('uniformStats',{employees:visibleEmployees,allEmployees:employees,departments,items:ITEMS,stats:buildStats(visibleEmployees),q,department,completion,message:takeMessage(req),session:req.session,view:'employees'});
 }
 const employee=await Employee.findOne({userId:req.session.userId});
 if(!employee)return res.status(404).send('연결된 직원 정보가 없습니다. 관리자에게 계정 연결을 요청하세요.');
 res.render('uniform',{employee,items:ITEMS,message:takeMessage(req),session:req.session});
}catch(e){next(e);}});

router.get('/order-stats',requireLogin,loadViewer,requireAdmin,async(req,res,next)=>{try{
 const employees=await Employee.find().sort({department:1,name:1});
 const departments=await Employee.distinct('department',{department:{$nin:[null,'']}});
 res.render('uniformStats',{employees,allEmployees:employees,departments,items:ITEMS,stats:buildStats(employees),q:'',department:'',completion:'',message:takeMessage(req),session:req.session,view:'stats'});
}catch(e){next(e);}});

router.get('/issues',requireLogin,loadViewer,requireAdmin,async(req,res,next)=>{try{
 const q=String(req.query.q||'').trim(),department=String(req.query.department||'').trim(),itemKey=String(req.query.itemKey||'').trim(),from=String(req.query.from||''),to=String(req.query.to||'');
 const employees=await Employee.find(department?{department}:{ }).sort({name:1});
 let issues=[];
 employees.forEach(e=>(e.uniformIssues||[]).forEach(h=>issues.push({employee:e,history:h})));
 if(q)issues=issues.filter(x=>(x.employee.name||'').includes(q)||(x.employee.empNo||'').includes(q));
 if(itemKey)issues=issues.filter(x=>x.history.itemKey===itemKey);
 if(from)issues=issues.filter(x=>new Date(x.history.issuedAt)>=new Date(from));
 if(to){const end=new Date(to);end.setHours(23,59,59,999);issues=issues.filter(x=>new Date(x.history.issuedAt)<=end);}
 issues.sort((a,b)=>new Date(b.history.issuedAt)-new Date(a.history.issuedAt));
 const departments=await Employee.distinct('department',{department:{$nin:[null,'']}});
 res.render('uniformIssues',{issues,items:ITEMS,departments,q,department,itemKey,from,to,message:takeMessage(req),session:req.session});
}catch(e){next(e);}});

router.get('/excel-qty',requireLogin,loadViewer,requireAdmin,async(req,res,next)=>{try{
 const stats=buildStats(await Employee.find()),book=new ExcelJS.Workbook(),sheet=book.addWorksheet('발주 통계');
 sheet.columns=[{header:'품목',key:'item',width:22},{header:'사이즈',key:'size',width:14},{header:'신청 수량',key:'requested',width:14},{header:'지급 완료',key:'issued',width:14},{header:'발주 필요',key:'quantity',width:14}];
 sheet.getRow(1).font={bold:true,color:{argb:'FFFFFFFF'}};sheet.getRow(1).fill={type:'pattern',pattern:'solid',fgColor:{argb:'FF17365D'}};
 stats.forEach(row=>sheet.addRow(row));sheet.addRow({item:'전체 합계',requested:stats.reduce((s,r)=>s+r.requested,0),issued:stats.reduce((s,r)=>s+r.issued,0),quantity:stats.reduce((s,r)=>s+r.quantity,0)}).font={bold:true};
 res.setHeader('Content-Type','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
 res.setHeader('Content-Disposition','attachment; filename="uniform_order_stats_'+new Date().toISOString().slice(0,10)+'.xlsx"');
 await book.xlsx.write(res);res.end();
}catch(e){next(e);}});

router.post('/order-excel',requireLogin,loadViewer,requireAdmin,async(req,res,next)=>{try{
 let lines=[];
 try{lines=JSON.parse(String(req.body.orderLines||'[]'));}catch(error){return res.status(400).send('발주 항목 형식이 올바르지 않습니다.');}
 if(!Array.isArray(lines)||!lines.length)return res.status(400).send('발주할 품목을 선택하세요.');
 const validLines=lines.slice(0,200).map(line=>{
  const item=ITEMS.find(v=>v.name===String(line.item||''));
  const size=String(line.size||''),quantity=Math.max(0,parseInt(line.quantity,10)||0);
  if(!item||!item.sizes.includes(size)||quantity<1)return null;
  return {item:item.name,size,quantity};
 }).filter(Boolean);
 if(!validLines.length)return res.status(400).send('발주할 수 있는 항목이 없습니다.');
 const book=new ExcelJS.Workbook(),sheet=book.addWorksheet('유니폼 발주서');
 sheet.columns=[{header:'번호',key:'no',width:8},{header:'품목',key:'item',width:22},{header:'사이즈',key:'size',width:14},{header:'발주 수량',key:'quantity',width:14},{header:'비고',key:'note',width:30}];
 sheet.getRow(1).font={bold:true,color:{argb:'FFFFFFFF'}};sheet.getRow(1).fill={type:'pattern',pattern:'solid',fgColor:{argb:'FF17365D'}};
 validLines.forEach((line,index)=>sheet.addRow({no:index+1,...line,note:''}));
 sheet.addRow({item:'전체 합계',quantity:validLines.reduce((sum,line)=>sum+line.quantity,0)}).font={bold:true};
 res.setHeader('Content-Type','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
 res.setHeader('Content-Disposition','attachment; filename="uniform_order_'+new Date().toISOString().slice(0,10)+'.xlsx"');
 await book.xlsx.write(res);res.end();
}catch(e){next(e);}});

router.get('/edit',requireLogin,loadViewer,async(req,res,next)=>{try{
 if(req.viewer.role==='admin')return res.redirect('/uniform');
 const employee=await Employee.findOne({userId:req.session.userId});
 if(!employee)return res.status(404).send('연결된 직원 정보가 없습니다.');
 res.render('editUniform',{employee,items:ITEMS,session:req.session});
}catch(e){next(e);}});
async function saveUniform(employee,body){ITEMS.forEach(item=>{if(body[item.key]!==undefined)employee[item.key]=String(body[item.key]||'');if(body[item.qty]!==undefined)employee[item.qty]=Math.max(0,parseInt(body[item.qty],10)||0);});if(body.jacketType==='winterJacket')employee.doubleJacket='';else if(body.jacketType==='doubleJacket')employee.winterJacket='';await employee.save();}
router.post('/edit',requireLogin,loadViewer,async(req,res,next)=>{try{
 if(req.viewer.role==='admin')return res.status(400).send('관리자는 직원별 수정 화면을 이용하세요.');
 const employee=await Employee.findOne({userId:req.session.userId});if(!employee)return res.status(404).send('연결된 직원 정보가 없습니다.');
 await saveUniform(employee,req.body);req.session.message='유니폼 정보가 수정되었습니다.';res.redirect('/uniform');
}catch(e){next(e);}});

router.get('/:id/edit',requireLogin,loadViewer,requireAdmin,async(req,res,next)=>{try{const employee=await Employee.findById(req.params.id);if(!employee)return res.status(404).send('직원을 찾을 수 없습니다.');res.render('editUniform',{employee,items:ITEMS,session:req.session});}catch(e){next(e);}});
router.post('/:id/edit',requireLogin,loadViewer,requireAdmin,async(req,res,next)=>{try{const employee=await Employee.findById(req.params.id);if(!employee)return res.status(404).send('직원을 찾을 수 없습니다.');await saveUniform(employee,req.body);req.session.message=employee.name+'의 유니폼 정보가 수정되었습니다.';res.redirect('/uniform/'+employee._id);}catch(e){next(e);}});

router.post('/:id/issues',requireLogin,loadViewer,requireAdmin,async(req,res,next)=>{try{
 const employee=await Employee.findById(req.params.id);if(!employee)return res.status(404).send('직원을 찾을 수 없습니다.');
 const item=ITEMS.find(v=>v.key===req.body.itemKey);if(!item)return res.status(400).send('올바른 품목을 선택하세요.');
 const size=String(req.body.size||'');
 if(!size||!item.sizes.includes(size))return res.status(400).send('선택한 품목에 맞는 사이즈를 선택하세요.');
 employee.uniformIssues.push({itemKey:item.key,itemName:item.name,size,quantity:Math.max(1,parseInt(req.body.quantity,10)||1),issuedAt:req.body.issuedAt?new Date(req.body.issuedAt):new Date(),note:String(req.body.note||'').trim(),issuedBy:req.session.userId});
 await employee.save();req.session.message='지급 이력이 등록되었습니다.';res.redirect('/uniform/'+employee._id);
}catch(e){next(e);}});
router.post('/:id/issues/:issueId/delete',requireLogin,loadViewer,requireAdmin,async(req,res,next)=>{try{
 const employee=await Employee.findById(req.params.id);if(!employee)return res.status(404).send('직원을 찾을 수 없습니다.');
 const issue=employee.uniformIssues.id(req.params.issueId);if(!issue)return res.status(404).send('지급 이력을 찾을 수 없습니다.');
 issue.deleteOne();await employee.save();req.session.message='지급 이력이 삭제되었습니다.';res.redirect('/uniform/'+employee._id);
}catch(e){next(e);}});
router.get('/:id',requireLogin,loadViewer,requireAdmin,async(req,res,next)=>{try{const employee=await Employee.findById(req.params.id);if(!employee)return res.status(404).send('직원을 찾을 수 없습니다.');res.render('uniform',{employee,items:ITEMS,message:takeMessage(req),session:req.session});}catch(e){next(e);}});
module.exports=router;
